const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { Client } = require('pg');
const p = require('./deliveryPolicy');
const root = () => path.resolve(process.cwd().endsWith('backend') ? process.cwd() : path.join(process.cwd(), 'backend'), '.cache/implementation');
function safeFile(directory, name) {
  if (typeof name !== 'string' || name.includes('\\') || path.isAbsolute(name) || name.split('/').some(part => ['..', '.git', 'node_modules'].includes(part))) p.fail('Ruta de archivo inválida', 422);
  const absolute = path.resolve(directory, name);
  if (!absolute.startsWith(path.resolve(directory) + path.sep)) p.fail('Ruta fuera del workspace', 422);
  return absolute;
}
function filesIn(directory, relative = '') {
  if (!fs.existsSync(path.join(directory, relative))) return [];
  return fs.readdirSync(path.join(directory, relative), { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', 'dist', '.git', '.runtime', 'screenshots', 'uploads'].includes(entry.name)) return [];
    const name = [relative, entry.name].filter(Boolean).join('/');
    return entry.isDirectory() ? filesIn(directory, name) : [name];
  });
}
function manifest(directory) { return Object.fromEntries(filesIn(directory).filter(f => !/\.env$|acceptance-results|runtime\.json/.test(f)).map(f => [f, p.hash(fs.readFileSync(safeFile(directory, f), 'utf8'))])); }
function writeFiles(directory, files, prior = {}, options = {}) {
  const changed = [], conflicts = [];
  for (const file of files) {
    const target = safeFile(directory, file.path);
    if (fs.existsSync(target)) {
      const content = fs.readFileSync(target, 'utf8');
      if (content === file.content) continue;
      if (prior[file.path] && prior[file.path] !== p.hash(content)) { conflicts.push(file.path); continue; }
      if (file.path.includes('/migrations/') && options.preserveMigrations !== false) { conflicts.push(file.path); continue; }
    }
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, file.content, 'utf8'); changed.push(file.path);
  }
  if (conflicts.length) throw Object.assign(new Error('Conflicto: se conservaron los archivos modificados o migraciones previas'), { conflicts });
  return changed;
}
class DeliveryRuntime {
  constructor() { this.servers = new Map(); this.children=new Map();this.paused=new Set(); }
  pause(projectId){this.paused.add(projectId);}
  resume(projectId){this.paused.delete(projectId);}
  async cancel(projectId){this.paused.add(projectId);for(const[child,id]of this.children)if(id===projectId)child.kill();await this.close(projectId);}
  directory(projectId, workspace = 'working') {
    if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) p.fail('ID de proyecto inválido');
    if (!/^[a-zA-Z0-9_-]+$/.test(workspace)) p.fail('Versión de workspace inválida');
    const directory = path.join(root(), projectId, 'workspaces', workspace); fs.mkdirSync(directory, { recursive: true }); return directory;
  }
  fork(projectId, workspace, previous) {
    const directory = this.directory(projectId, workspace);
    if (previous && !filesIn(directory).length) {
      const source = this.directory(projectId, previous);
      fs.cpSync(source, directory, { recursive: true, filter: name => !name.split(path.sep).some(p => ['node_modules', 'dist', 'uploads'].includes(p)) });
      for (const part of ['backend', 'frontend']) {
        const modules = path.join(source, part, 'node_modules'), target = path.join(directory, part, 'node_modules');
        if (fs.existsSync(modules) && !fs.existsSync(target)) fs.symlinkSync(modules, target, process.platform === 'win32' ? 'junction' : 'dir');
      }
    }
    return directory;
  }
  async command(command, args, directory, log, options = {}) {
    if(log?.projectId&&this.paused.has(log.projectId))p.fail('Ejecución pausada en un punto recuperable');
    if (command === 'npm') {
      const cli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
      if (!fs.existsSync(cli)) throw new Error('Runtime npm no disponible');
      args = [cli, ...args]; command = process.execPath;
    }
    const startedAt = new Date().toISOString(); let output = '';
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd: directory, env: { ...process.env, ...options.env }, windowsHide: true, shell: false });
      this.children.set(child,log?.projectId);
      const timer = setTimeout(() => child.kill(), options.timeout || 240000);
      const collect = data => { let text = data.toString();for(const key of ['DB_PASSWORD','JWT_SECRET','OPENAI_API_KEY','ANTHROPIC_API_KEY','GOOGLE_STITCH_API_KEY'])for(const value of[options.env?.[key],process.env[key]])if(value?.length>=6)text=text.split(value).join('[REDACTED]'); output = (output + text).slice(-40000); log?.(text); };
      child.stdout.on('data', collect); child.stderr.on('data', collect);
      child.on('error', error => { clearTimeout(timer);this.children.delete(child); reject(error); });
      child.on('close', code => { clearTimeout(timer);this.children.delete(child); const result = { command: path.basename(command), args: args.filter(a => !String(a).includes('PASSWORD')), code, output, startedAt, executedAt: new Date().toISOString(), passed: code === 0 };
        if (code !== 0) reject(Object.assign(new Error('La comprobación ejecutada falló'), { execution: result })); else resolve(result); });
    });
  }
  connection() {
    if (!process.env.CODEGEN_TEST_DB_PORT || !process.env.TEST_DB_ADMIN_NAME) p.fail('Configure PostgreSQL aislado: CODEGEN_TEST_DB_PORT y TEST_DB_ADMIN_NAME');
    return { host: process.env.TEST_DB_HOST || '127.0.0.1', port: Number(process.env.CODEGEN_TEST_DB_PORT), user: process.env.TEST_DB_USER || 'icase_user', password: process.env.TEST_DB_PASSWORD || '', connectionTimeoutMillis: 5000 };
  }
  async database(projectId, prior) {
    if (prior?.database) { if (!/^icase_stage_[a-f0-9]{24}$/.test(prior.database)) p.fail('Base de prueba no reconocida'); return prior; }
    const connection = this.connection(), admin = new Client({ ...connection, database: process.env.TEST_DB_ADMIN_NAME });
    await admin.connect();
    const database = 'icase_stage_' + randomBytes(12).toString('hex');
    try { await admin.query('CREATE DATABASE "' + database + '"'); } finally { await admin.end(); }
    return { database, projectId, createdAt: new Date().toISOString() };
  }
  runtimeEnv(runtime) {
    const connection = this.connection();
    return { DB_HOST: connection.host, DB_PORT: String(connection.port), DB_USER: connection.user, DB_PASSWORD: connection.password, DB_NAME: runtime.database,
      JWT_SECRET: p.hash(['isolated', runtime.database]), AUTO_SYNC_DB: 'false', NODE_ENV: 'test' };
  }
  async generated(spec) {
    const result = await require('./codeGenerator.service').generateProjectFiles(spec.project.id, { spec, includeDocker: true, reviewOnly: true });
    if (!result.files?.length) throw Object.assign(new Error('El modelo central no puede generar archivos: revise sus diagnósticos'), { diagnostics: result.diagnostics });
    return result.files;
  }
  scaffold(spec) {
    const server = require('./serverGenerator'), frontend = require('./reactFrontendGenerator');
    return [
      { path: 'backend/package.json', content: server.generatePackageJson(spec.project.name) },
      { path: 'backend/.env.example', content: server.generateEnvExample(spec.project.name) },
      { path: 'backend/src/server.js', content: "const express=require('express');const app=express();app.get('/api/health',(_q,r)=>r.json({status:'OK',scope:'scaffold'}));app.listen(process.env.PORT||8080,'0.0.0.0');\n" },
      { path: 'frontend/package.json', content: frontend.generateFrontendPackageJson(spec.project.name) },
      { path: 'frontend/index.html', content: '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Proyecto base</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>' },
      { path: 'frontend/src/main.jsx', content: "import React from 'react';import{createRoot}from'react-dom/client';createRoot(document.getElementById('root')).render(React.createElement('h1',null,'Estructura de proyecto lista'));\n" },
      { path: 'frontend/vite.config.js', content: "import{defineConfig}from'vite';export default defineConfig({});\n" },
      { path: 'docker-compose.yml', content: require('./dockerGenerator').generateDockerCompose(spec.project.name) },
      { path: 'backend/Dockerfile', content: require('./dockerGenerator').generateDockerfile() },
      { path: 'frontend/Dockerfile', content: frontend.generateFrontendDockerfile() },
      { path: 'frontend/nginx.conf', content: frontend.generateFrontendNginxConf() }
    ];
  }
  async install(directory, log) {
    const tests = [];
    for (const part of ['backend', 'frontend']) tests.push(await this.command('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund','--fetch-retries=0','--fetch-timeout=20000'], path.join(directory, part), log));
    return tests;
  }
  async boot(projectId, directory, runtime, options = {}) {
    await this.close(projectId);
    const net = require('node:net');
    const port = await new Promise((resolve, reject) => { const socket = net.createServer(); socket.once('error', reject); socket.listen(0, '127.0.0.1', () => { const chosen = socket.address().port; socket.close(() => resolve(chosen)); }); });
    const child = spawn(process.execPath, [path.join(directory, 'backend/src/server.js')], { cwd: path.join(directory, 'backend'), windowsHide: true,
      env: { ...process.env, ...(runtime ? this.runtimeEnv(runtime) : {}), PORT: String(port) } });
    const entry = { child, port, directory, runtime, output: '' }; this.servers.set(projectId, entry);
    child.stdout.on('data', d => { entry.output = (entry.output + d).slice(-12000); });
    child.stderr.on('data', d => { entry.output = (entry.output + d).slice(-12000); });
    let exit; child.on('error', e => { exit = e.message; }); child.on('exit', code => { exit = 'exit ' + code; });
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 80; i++) {
      if (exit) throw new Error('El servicio no arrancó: ' + exit + ' ' + entry.output);
      try { const response = await fetch(base + '/api/health'); if (response.ok) return { base, port, executedAt: new Date().toISOString(), passed: true, check: 'HTTP_HEALTH', actual: await response.json() }; } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    child.kill(); throw new Error('Tiempo de arranque agotado: ' + entry.output);
  }
  async close(projectId) { const prior = this.servers.get(projectId); if (prior) { prior.child.kill(); await new Promise(resolve => { prior.child.once('exit', resolve); setTimeout(resolve, 2000); }); this.servers.delete(projectId); } }
  async execute(stage, context, log) {
    const { spec, state, target, content } = context, directory = this.fork(spec.project.id, context.workspace || 'working', state.workspace);
    if(log)log.projectId=spec.project.id;
    const prior = {...state.files,...Object.fromEntries((state.manualFiles||[]).map(f=>[f,'MANUAL_MODIFICATION_REQUIRES_REVIEW']))}; let changed = [], tests = [], runtime = state.runtime;
    if (stage === 2) {
      changed = writeFiles(directory, this.scaffold(spec), prior);
      tests = await this.install(directory, log);
      tests.push(await this.command(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], path.join(directory, 'frontend'), log));
      tests.push(await this.boot(spec.project.id, directory));
    }
    if (stage === 3) {
      const generated = await this.generated(spec);
      const selected = generated.filter(f => /^backend\/src\/(models|migrations|config|middleware|controllers\/auth|routes\/auth|services\/operation\.runtime)/.test(f.path) || f.path === 'backend/src/migrate.js');
      const oldSpec = state.stages[3]?.content?.physicalModel;
      if (oldSpec?.length && p.hash(oldSpec) !== p.hash(spec.entities)) {
        // Applied migrations remain immutable. Add columns only, with explicit model approval upstream.
        const migrations = this.incrementalMigrations(oldSpec, spec.entities, state.stages[3].version + 1);
        changed.push(...writeFiles(directory, migrations, prior));
        changed.push(...writeFiles(directory, selected.filter(f => !f.path.includes('/migrations/')), prior));
      } else changed = writeFiles(directory, selected, prior);
      runtime = await this.database(spec.project.id, runtime);
      tests.push(await this.command(process.execPath, ['src/migrate.js'], path.join(directory, 'backend'), log, { env: this.runtimeEnv(runtime) }));
      const db = new Client({ ...this.connection(), database: runtime.database }); await db.connect();
      try {
        const rows = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
        if (!rows.rows.length) throw new Error('Las migraciones no crearon tablas');
        tests.push({ check: 'PHYSICAL_SCHEMA', passed: true, executedAt: new Date().toISOString(), tables: rows.rows });
      } finally { await db.end(); }
    }
    if (stage === 4 && content) {
      const op = content.operation, key = 'endpoint_' + p.hash(op.operationId).slice(0, 16), generator = require('./operationGenerator');
      if (op.bindingVersion !== 2) p.fail('La implementación individual necesita contrato declarativo bindingVersion=2; revise la definición');
      const service = generator.generateOperationServiceFile([op], spec.entities);
      const controller = generator.generateOperationControllerFile([op]).replace("../services/operation.service", '../services/' + key + '.service');
      const routes = generator.generateOperationRoutesFile([{ ...op, route: '/api/operations/' + op.route.replace(/^\/api\/?/, '') }], spec.security).replace('../controllers/operation.controller', '../controllers/' + key + '.controller');
      const endpoints = { ...state.endpoints, [target]: { ...state.endpoints[target], implemented: true } };
      const mounts = Object.entries(endpoints).filter(([id, e]) => e.implemented || id === target).map(([id]) => `router.use(require('./endpoint_${p.hash(id).slice(0, 16)}.routes'));`).join('\n');
      changed = writeFiles(directory, [
        { path: `backend/src/services/${key}.service.js`, content: service }, { path: `backend/src/controllers/${key}.controller.js`, content: controller },
        { path: `backend/src/routes/${key}.routes.js`, content: routes },
        { path: 'backend/src/routes/index.js', content: `const router=require('express').Router();router.get('/health',(_q,r)=>r.json({status:'OK'}));${spec.security?.authType === 'JWT' ? "router.use('/auth',require('./auth.routes'));" : ''}${mounts}\nmodule.exports=router;` },
        { path: 'backend/src/server.js', content: require('./serverGenerator').generateServerFile(spec.project.name,{serveFrontend:true}) },
        { path: 'backend/src/services/operation.runtime.js', content: fs.readFileSync(require.resolve('./operationRuntime'), 'utf8') },
        { path: 'openapi.json', content: JSON.stringify(this.openapi(state, op), null, 2) }
      ], prior);
      // Explicit endpoints only: no catch-all entity CRUD is mounted.
      runtime = await this.database(spec.project.id, runtime);
      tests.push(await this.boot(spec.project.id, directory, runtime));
      const testOperations = Object.values(endpoints).filter(entry => entry.implemented && p.approved(entry.definition)).map(entry => entry.definition.content.operation);
      if (!testOperations.some(entry => entry.operationId === op.operationId)) testOperations.push(op);
      const report = await this.behavior(directory, { ...spec,requirements:spec.requirements.filter(r=>(op.requirementIds||[]).includes(r.id)), operations: testOperations, acceptanceScenarios: content.acceptanceScenarios || op.acceptanceScenarios || [] }, false);
      tests.push(...report.tests); if (!report.passed) throw Object.assign(new Error('Las pruebas reales del endpoint fallaron'), { report });
      this.requireEndpointCoverage(op, content.acceptanceScenarios || op.acceptanceScenarios || [], spec);
    }
    if (stage === 5) {
      // Do not emit or replace backend files at integration time.
      tests.push(await this.boot(spec.project.id, directory, runtime));
      const report = await this.behavior(directory, this.runtimeSpec(spec, state, false), false);
      tests.push(...report.tests); if (!report.passed) throw Object.assign(new Error('Los procesos integrados no pasaron'), { report });
      const operations=this.runtimeSpec(spec,state,false).operations;
      if(operations.length>1&&!operations.some(op=>op.acceptanceScenarios?.some(s=>new Set(s.requests.map(r=>r.operationId)).size>1)))p.fail('Falta un escenario de integración que conecte los endpoints del proceso');
    }
    if (stage === 6) {
      const runSpec = this.runtimeSpec(spec, state), generated = await this.generated(runSpec);
      const frontendFiles = generated.filter(f => f.path.startsWith('frontend/') || f.path.startsWith('mockups/'));
      changed = writeFiles(directory, frontendFiles, prior);
      const modules = path.join(directory, 'frontend/node_modules');
      if (fs.existsSync(modules) && fs.lstatSync(modules).isSymbolicLink()) fs.unlinkSync(modules);
      tests.push(await this.command('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], path.join(directory, 'frontend'), log));
      tests.push(await this.command(process.execPath, ['scripts/compile-mockup-themes.cjs'], path.join(directory, 'frontend'), log));
      tests.push(await this.command(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], path.join(directory, 'frontend'), log));
      // Serve the actual built frontend from the same isolated HTTP backend.
      tests.push(await this.boot(spec.project.id, directory, runtime));
      const report = await this.behavior(directory, runSpec, true);
      tests.push(...report.tests); if (!report.passed || !report.browserPassed) throw Object.assign(new Error('No se demostraron recorridos de navegador con persistencia'), { report });
    }
    if (stage === 7) return this.docker(context, directory, log);
    return { directory, workspace: context.workspace || 'working', changed, manifest: manifest(directory), runtime, tests, passed: tests.length > 0 && tests.every(t => t.passed === true), executedAt: new Date().toISOString() };
  }
  runtimeSpec(spec, state, includeScreens = true) {
    const operations = Object.values(state.endpoints || {}).filter(e => p.approved(e.definition)).map(e => ({ ...e.definition.content.operation, acceptanceScenarios: e.definition.content.acceptanceScenarios || e.definition.content.operation.acceptanceScenarios || [] }));
    const runtimeSpec = { ...spec, operations:[...operations,...spec.operations.filter(op=>op.invocation==='SYSTEM'&&!operations.some(o=>o.operationId===op.operationId))] };
    const { buildScreenContract } = require('./screenContract');
    runtimeSpec.screens = (includeScreens ? spec.screens || [] : []).map(screen => {
      const approvedHtml = state.mockups?.[screen.id]?.content?.html || screen.html;
      const contract = buildScreenContract(screen, runtimeSpec);
      if (screen.contract?.fields?.length) {
        const declaredFields = new Set(screen.contract.fields.map(field => field.fieldName));
        contract.fields = contract.fields.filter(field => declaredFields.has(field.fieldName));
        contract.validations = contract.validations.filter(rule => declaredFields.has(rule.field));
      }
      const hydrated = { ...screen, html: approvedHtml, contract };
      for (const action of hydrated.contract.actions || []) if (action.operationId && !runtimeSpec.operations.some(op => op.operationId === action.operationId && op.route === action.route && op.method === action.method)) p.fail('La pantalla usa una acción sin endpoint aprobado: ' + screen.id + ' / ' + action.operationId);
      for (const source of hydrated.contract.dataSources || []) if (!runtimeSpec.operations.some(op => op.operationId === source.operationId && op.route === source.route)) p.fail('La pantalla usa una fuente sin endpoint aprobado: ' + screen.id + ' / ' + source.route);
      return hydrated;
    });
    return runtimeSpec;
  }
  async patch(projectId,workspace,state,patches){
    const directory=this.fork(projectId,workspace,state.workspace);
    for(const patch of patches){
      if(patch.baseHash!==state.files[patch.path]||!Object.hasOwn(state.files,patch.path)||/(^|\/)\.env|secret|\/migrations\//.test(patch.path))p.fail('Conflicto o archivo no autorizado: '+patch.path);
      const current=fs.readFileSync(safeFile(directory,patch.path),'utf8');
      if(p.hash(current)!==patch.baseHash)p.fail('Se conservó una modificación manual en conflicto: '+patch.path);
    }
    const changed=writeFiles(directory,patches,state.files),tests=[];
    for(const name of changed.filter(f=>f.endsWith('.js')&&!f.startsWith('frontend/')))tests.push(await this.command(process.execPath,['--check',safeFile(directory,name)],directory));
    return{workspace,changed,manifest:manifest(directory),tests,passed:false,scope:'ARCHIVOS_APLICADOS; REQUIERE PRUEBAS DE LA ETAPA AFECTADA',executedAt:new Date().toISOString()};
  }
  async behavior(directory, spec, browser) {
    const report = await require('./codegenVerification.service').runVerification(directory, spec, { skipVite: !browser, skipBrowser: !browser,
      runBehavior: async args => {
        const restricted = !browser ? { ...args.spec, acceptanceScenarios: (args.spec.acceptanceScenarios || []).map(s => ({ ...s, browser: [] })), operations: args.spec.operations.map(op => ({ ...op, acceptanceScenarios: (op.acceptanceScenarios || []).map(s => ({ ...s, browser: [] })) })) } : args.spec;
        return require('./contractAcceptanceRunner').runContractAcceptance({ ...args, spec: restricted });
      } });
    // skipVite/skipBrowser are deliberately allowed only for backend-specific stages.
    const covered=new Set(report.tests.filter(t=>t.passed).flatMap(t=>t.requirementIds||[]));
    const coveredOperations=new Set(report.tests.filter(t=>t.passed).flatMap(t=>t.operationIds||[]));
    const passed = report.errors.length === 0 && report.tests.length > 0 && report.tests.every(t => t.passed && t.executedAt) && (!browser || report.browserPassed)&&spec.requirements.filter(r=>r.type==='FUNCTIONAL').every(r=>covered.has(r.id))&&spec.operations.every(op=>coveredOperations.has(op.operationId));
    return { ...report, passed };
  }
  requireEndpointCoverage(op, scenarios, spec) {
    const requests = scenarios.flatMap(s => s.requests || []).filter(r => r.operationId === op.operationId);
    if (!requests.some(r => r.status >= 200 && r.status < 300)) p.fail('Falta caso válido ejecutable');
    if (op.input?.bodySchema && !requests.some(r => [400, 422].includes(r.status))) p.fail('Falta prueba de validación');
    if (spec.security?.authType === 'JWT' && (!requests.some(r => r.status === 401) || !requests.some(r => r.status === 403))) p.fail('Faltan pruebas de autenticación y permisos');
    if (!scenarios.some(s => s.persistence?.length)) p.fail('Falta comprobación independiente de persistencia');
  }
  openapi(state, current) {
    const operations = Object.values(state.endpoints || {}).map(e => e.definition?.content?.operation).filter(Boolean).filter(o => o.operationId !== current.operationId).concat(current);
    const paths = {};
    for (const op of operations) {
      const route = op.route.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
      paths[route] ||= {}; paths[route][op.method.toLowerCase()] = { operationId: op.operationId, summary: op.name,
        ...(op.input?.bodySchema ? { requestBody: { content: { 'application/json': { schema: op.input.bodySchema } } } } : {}),
        responses: { [op.output?.successStatus || 200]: { description: 'Respuesta definida en el contrato aprobado' } } };
    }
    return { openapi: '3.0.3', info: { title: 'Backend de pruebas', version: '1' }, paths };
  }
  incrementalMigrations(before, after, version) {
    const additions = [];
    for (const entity of after) {
      const old = before.find(e => e.id === entity.id);
      if (!old) p.fail('Nueva entidad: requiere migración explícita revisada; no se reescribirá una migración aplicada');
      for (const attribute of old.attributes) {
        const current = entity.attributes.find(a => a.fieldName === attribute.fieldName);
        if (!current || p.hash(current) !== p.hash(attribute)) p.fail('Cambio de columna existente: prepare una migración explícita sin pérdida de datos');
      }
      for (const field of entity.attributes.filter(a => !old.attributes.some(b => b.fieldName === a.fieldName))) {
        if (field.allowNull === false && field.defaultValue == null) p.fail('La nueva columna obligatoria requiere una decisión aprobada para completar registros previos');
        if (!/^(STRING(?:\(\d+\))?|INTEGER|TEXT|BOOLEAN|DATE|FLOAT|DOUBLE|UUID)$/.test(field.type || field.dataType || '')) p.fail('Tipo de migración incremental no soportado');
        additions.push({ table: entity.tableName, column: field.columnName || field.fieldName, type: field.type || field.dataType, allowNull: field.allowNull !== false, defaultValue: field.defaultValue });
      }
    }
    if (before.some(e => !after.some(a => a.id === e.id))) p.fail('No se eliminarán tablas automáticamente');
    const calls = additions.map(a => `await q.addColumn(${JSON.stringify(a.table)},${JSON.stringify(a.column)},{type:S.${a.type},allowNull:${a.allowNull}${a.defaultValue != null ? ',defaultValue:' + JSON.stringify(a.defaultValue) : ''}});`).join('\n');
    return [{ path: `backend/src/migrations/20990101${String(version).padStart(6, '0')}-incremental.js`, content: `'use strict';module.exports={async up(q,S){${calls}},async down(){throw new Error('Reversión con datos requiere revisión explícita');}};` }];
  }
  async docker(context, directory, log) {
    // Docker owns its own database volume, never the iCASE database.
    const { spec, state } = context, name = 'icase-delivery-' + p.hash(spec.project.id).slice(0, 12);
    const generated = await this.generated(this.runtimeSpec(spec, state));
    const selected = generated.filter(f => /Dockerfile$|nginx\.conf$|^docker-compose\.yml$|^\.dockerignore$/.test(f.path));
    let compose = selected.find(f => f.path === 'docker-compose.yml');
    // Namespace isolation uses Compose instead of global, project-name-derived container names.
    const address=process.env.DELIVERY_BIND_ADDRESS||'127.0.0.1';
    if(!['127.0.0.1','0.0.0.0'].includes(address))p.fail('DELIVERY_BIND_ADDRESS no admitida');
    compose.content = compose.content.replace(/^\s*container_name:.*\r?\n/gm, '').replace(/"\$\{DB_PORT:-5435\}:5432"/, `"${address}::5432"`).replace(/"\$\{BACKEND_PORT:-8085\}:8080"/, `"${address}::8080"`).replace(/"\$\{FRONTEND_PORT:-3005\}:80"/, `"${address}::80"`);
    compose.content = compose.content.replace(/\$\{DB_PASSWORD:-[^}]*\}/g, '${DB_PASSWORD:?Configure DB_PASSWORD}').replace(/\$\{JWT_SECRET:-[^}]*\}/g, '${JWT_SECRET:?Configure JWT_SECRET}').replace(/\$\{INITIAL_ADMIN_PASSWORD:-[^}]*\}/g, '${INITIAL_ADMIN_PASSWORD:?Configure INITIAL_ADMIN_PASSWORD}');
    const changed = writeFiles(directory, [...selected,
      { path: 'backend/.dockerignore', content: 'node_modules\n.env\n.cache\n.verification\nscreenshots\nuploads\n' },
      { path: 'frontend/.dockerignore', content: 'node_modules\ndist\n.env\n.cache\nscreenshots\n' }
    ], state.files || {});
    const privateDir=path.join(directory,'.runtime');fs.mkdirSync(privateDir,{recursive:true});
    const envFile=path.join(directory,'.env');
    if(!fs.existsSync(envFile))fs.writeFileSync(envFile,`DB_NAME=app\nDB_USER=icase_generated\nDB_PASSWORD=${randomBytes(24).toString('hex')}\nJWT_SECRET=${randomBytes(32).toString('hex')}\nINITIAL_ADMIN_PASSWORD=${randomBytes(24).toString('hex')}\n`,{mode:0o600});
    const secrets=require('dotenv').parse(fs.readFileSync(envFile));
    const args = ['compose', '-p', name]; let tests = [];
    const docker=async(arguments_,options={})=>this.command('docker',[...args,...arguments_],directory,log,{...options,env:{...secrets,...options.env}});
    tests.push(await docker(['up', '--build', '-d', '--wait'],{timeout:600000}));
    const port=async(service,internal)=>{const result=await docker(['port',service,String(internal)]);const found=result.output.trim().match(/:(\d+)$/);if(!found)throw new Error('Puerto Docker no disponible');return Number(found[1]);};
    const host=process.env.CODEGEN_DOCKER_HOST||'127.0.0.1';let dbPort=await port('db',5432),apiPort=await port('backend',8080),frontPort=await port('frontend',80);
    const workerEnv={DB_HOST:host,DB_PORT:String(dbPort),DB_NAME:secrets.DB_NAME,DB_USER:secrets.DB_USER,DB_PASSWORD:secrets.DB_PASSWORD,JWT_SECRET:secrets.JWT_SECRET,AUTO_SYNC_DB:'false'};
    const runSpec=this.runtimeSpec(spec,state),specFile=path.join(privateDir,'spec.json'),reportFile=path.join(privateDir,'container-results.json');fs.writeFileSync(specFile,JSON.stringify(runSpec));
    const config={directory,specFile,reportFile,baseUrl:`http://${host}:${frontPort}`,apiUrl:`http://${host}:${apiPort}`};
    const runBrowser=async()=>{
      await this.command(process.execPath,[require.resolve('./deliveryContainer.worker.cjs')],directory,log,{env:{...workerEnv,ICASE_CONTAINER_TEST_CONFIG:JSON.stringify(config)},timeout:240000});
      const report=JSON.parse(fs.readFileSync(reportFile,'utf8'));if(!report.passed||!report.browserPassed||!report.tests?.length)throw new Error('Las pruebas contra contenedores no acreditan funcionamiento');return report;
    };
    const first=await runBrowser();tests.push(...first.tests);
    const dataFingerprint=async()=>{
      const client=new Client({host,port:dbPort,database:secrets.DB_NAME,user:secrets.DB_USER,password:secrets.DB_PASSWORD});await client.connect();
      try{const tables=await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");const fingerprints={};for(const row of tables.rows){const name='"'+row.tablename.replace(/"/g,'""')+'"';const result=await client.query(`SELECT count(*)::int AS count,md5(COALESCE(string_agg(row_to_json(t)::text,'' ORDER BY row_to_json(t)::text),'')) AS hash FROM public.${name} t`);fingerprints[row.tablename]=result.rows[0];}return fingerprints;}finally{await client.end();}
    };
    const before=await dataFingerprint();
    tests.push(await docker(['restart']));
    tests.push(await docker(['up', '-d', '--wait']));
    dbPort=await port('db',5432);apiPort=await port('backend',8080);frontPort=await port('frontend',80);
    workerEnv.DB_PORT=String(dbPort);config.baseUrl=`http://${host}:${frontPort}`;config.apiUrl=`http://${host}:${apiPort}`;
    const after=await dataFingerprint();if(p.hash(before)!==p.hash(after))throw new Error('Los datos cambiaron tras reiniciar los contenedores');
    tests.push({check:'CONTAINER_DATA_SURVIVES_RESTART',passed:true,before,after,executedAt:new Date().toISOString()});
    const second=await runBrowser();tests.push(...second.tests);
    return { directory,workspace:context.workspace,changed,manifest:manifest(directory),runtime:state.runtime,composeProject:name,tests,passed:true,containerBehaviorPassed:true,
      endpoints:{application:`http://${host}:${frontPort}`,api:`http://${host}:${apiPort}`},executedAt:new Date().toISOString() };
  }
}
module.exports = { DeliveryRuntime, safeFile, writeFiles, manifest, filesIn };
