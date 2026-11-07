const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { Client } = require('pg');
const { createRequire } = require('module');

// Verification is domain independent. A trusted acceptance runner supplies the
// behavior suite; declarations and skipped tools never count as passing tests.
class CodegenVerificationService {
  async runVerification(directory, spec, options = {}) {
    // Generated models read process.env at require time. Serialize isolated runs
    // so simultaneous project jobs cannot borrow each other's database config.
    const previous = this.pending || Promise.resolve();
    const current = previous.catch(() => {}).then(() => this.verifyIsolated(directory, spec, options));
    this.pending = current.catch(() => {});
    return current;
  }

  async verifyIsolated(directory, spec, options = {}) {
    const report = { ready: false, passed: false, scope: spec?.scope || 'Contratos explícitos del proyecto', directory, checks: [], skipped: [], errors: [], screenshots: [], tests: [] };
    const check = name => { report.checks.push(name); options.onProgress?.({ check: name }); };
    const fail = (stage, code) => { const error = { stage, code, message: code }; report.errors.push(error); options.onProgress?.({ error }); };
    const walk = dir => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? ['node_modules', 'dist', '.git'].includes(entry.name) ? [] : walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
    let admin, migrationDb, models, independentDb, independentModels, server, database;
    const envKeys = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET', 'AUTO_SYNC_DB'];
    const priorEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
    try {
      const files = walk(path.join(directory, 'backend')).filter(file => file.endsWith('.js'));
      if (!files.length) { fail('SYNTAX_CHECK', 'NO_GENERATED_BACKEND'); return report; }
      for (const file of files) {
        const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', timeout: 30000 });
        if (result.status !== 0) { fail('SYNTAX_CHECK', 'INVALID_GENERATED_JAVASCRIPT'); report.errors.at(-1).file = path.relative(directory, file); return report; }
      }
      check('Sintaxis de todo el backend exportado');
      const viteBin = path.join(directory, 'frontend/node_modules/vite/bin/vite.js');
      if (options.skipVite === true) report.skipped.push('VITE_BUILD');
      else if (!fs.existsSync(viteBin)) { fail('VITE_BUILD', 'MISSING_EXPORTED_FRONTEND_DEPENDENCIES'); return report; }
      else {
        const themes = spawnSync(process.execPath, ['scripts/compile-mockup-themes.cjs'], { cwd: path.join(directory, 'frontend'), encoding: 'utf8', timeout: 120000 });
        if (themes.status !== 0) { fail('VITE_BUILD', 'MOCKUP_THEME_BUILD_FAILED'); return report; }
        const result = spawnSync(process.execPath, [viteBin, 'build'], { cwd: path.join(directory, 'frontend'), encoding: 'utf8', timeout: 120000 });
        if (result.status !== 0) { fail('VITE_BUILD', 'FRONTEND_BUILD_FAILED'); return report; }
        check('Compilación Vite con la configuración y dependencias exportadas');
      }
      const integrity = require('./exportIntegrity');
      const testedPaths = (options.filePaths || walk(directory).map(f => path.relative(directory, f))).filter(name => !['REVIEW_STATUS.json', 'GENERATION_TRACE.json', 'acceptance-results.json'].includes(name));
      report.testedFiles = integrity.snapshotFiles(directory, testedPaths).map(f => ({ path: f.path, sha256: integrity.sha256(f.content) }));
      report.testedSourceHash = integrity.fingerprint(integrity.snapshotFiles(directory, testedPaths));
      const port = Number(process.env.CODEGEN_TEST_DB_PORT || '55439');
      if (port === 5433) { fail('ISOLATED_DB_REQUIREMENT', 'NO_ISOLATED_TEST_DATABASE'); return report; }
      const connection = { host: process.env.TEST_DB_HOST || '127.0.0.1', port, user: process.env.TEST_DB_USER || 'icase_user', password: process.env.TEST_DB_PASSWORD || 'icase_password', connectionTimeoutMillis: 3000 };
      admin = new Client({ ...connection, database: process.env.TEST_DB_ADMIN_NAME || 'autron5_acceptance' });
      try { await admin.connect(); } catch (_) { fail('ISOLATED_DB_REQUIREMENT', 'NO_ISOLATED_TEST_DATABASE'); return report; }
      database = 'icase_verify_' + crypto.randomBytes(8).toString('hex');
      await admin.query('CREATE DATABASE "' + database + '"');
      Object.assign(process.env, { DB_HOST: connection.host, DB_PORT: String(port), DB_NAME: database, DB_USER: connection.user, DB_PASSWORD: connection.password, JWT_SECRET: crypto.randomBytes(32).toString('hex'), AUTO_SYNC_DB: 'false' });
      const requireExport = createRequire(path.join(directory, 'backend/package.json'));
      const { Sequelize } = requireExport('sequelize');
      const express = requireExport('express');
      migrationDb = new Sequelize(database, connection.user, connection.password, { host: connection.host, port, dialect: 'postgres', logging: false });
      const migrations = walk(path.join(directory, 'backend/src/migrations')).filter(file => file.endsWith('.js')).sort();
      if (!migrations.length) { fail('MIGRATIONS', 'NO_MIGRATIONS'); return report; }
      for (const file of migrations) await requireExport(file).up(migrationDb.getQueryInterface(), Sequelize);
      check(migrations.length + ' migraciones reales sobre PostgreSQL vacío');
      models = requireExport(path.join(directory, 'backend/src/models'));
      independentDb = new Sequelize(database, connection.user, connection.password, { host: connection.host, port, dialect: 'postgres', logging: false });
      independentModels = Object.fromEntries(Object.entries(models).filter(([, model]) => typeof model?.getAttributes === 'function').map(([name, model]) => [name, independentDb.define(name, model.getAttributes(), { tableName: model.getTableName(), timestamps: false })]));
      const app = express(); app.use(express.json()); app.use('/api', requireExport(path.join(directory, 'backend/src/routes')));
      if (fs.existsSync(path.join(directory, 'frontend/dist/index.html'))) {
        app.use(express.static(path.join(directory, 'frontend/dist')));
        app.get('*', (_req, res) => res.sendFile(path.join(directory, 'frontend/dist/index.html')));
      }
      server = await new Promise(resolve => { const handle = app.listen(0, '127.0.0.1', () => resolve(handle)); });
      const base = 'http://127.0.0.1:' + server.address().port;
      const request = async (method, route, body, token) => {
        const response = await fetch(base + route, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        return { status: response.status, body: await response.json() };
      };
      const runner = options.runBehavior || require('./reviewedAcceptanceRegistry').resolve(spec) || require('./contractAcceptanceRunner').runContractAcceptance;
      const outcome = await runner({ models, independentModels, request, spec, directory, baseUrl: base });
      report.tests = outcome.tests || [];
      report.screenshots = outcome.screenshots || [];
      report.browserPassed = outcome.browserPassed === true;
      if (!outcome.passed || !report.tests.length || report.tests.some(test => test.passed !== true || !test.executedAt)) {
        fail('BEHAVIOR', outcome.infrastructureFailure || (!report.tests.length ? 'UNRESOLVED_ACCEPTANCE_SCENARIOS' : 'BEHAVIOR_NOT_PROVEN'));
        report.behaviorFailures = outcome.failures || [];
        return report;
      }
      check('Pruebas de comportamiento ejecutadas: ' + report.tests.length);
      if (options.skipBrowser === true || !outcome.browserPassed) report.skipped.push('BROWSER_JOURNEYS');
      report.passed = report.errors.length === 0 && report.skipped.length === 0;
      // Global readiness also requires complete contract coverage and executed
      // evidence for every requirement; one successful journey is insufficient.
      const covered = new Set(report.tests.flatMap(test => test.requirementIds || []));
      const coveredOperations = new Set(report.tests.flatMap(test => test.operationIds || []));
      const diagnostics = require('./projectSpecValidator').validateProjectSpec(spec);
      report.ready = report.passed && diagnostics.ready && (spec.requirements || []).filter(r => r.type === 'FUNCTIONAL').every(r => covered.has(r.id)) &&
        (spec.operations || []).filter(op => op.type === 'BUSINESS_LOGIC').every(op => coveredOperations.has(op.operationId));
    } catch (error) {
      fail('EXECUTION_VERIFICATION', 'VERIFICATION_EXECUTION_FAILED');
      report.errors.at(-1).errorType = error.code || error.name;
    } finally {
      if (report.testedFiles) {
        const integrity = require('./exportIntegrity');
        if (integrity.fingerprint(integrity.snapshotFiles(directory, report.testedFiles.map(f => f.path))) !== report.testedSourceHash) {
          fail('INTEGRITY', 'TESTED_FILES_CHANGED_DURING_RUN'); report.passed = false; report.ready = false;
        }
      }
      if (server) await new Promise(resolve => server.close(resolve));
      await models?.sequelize?.close().catch(() => {});
      await independentDb?.close().catch(() => {});
      await migrationDb?.close().catch(() => {});
      if (database && admin) { try { await admin.query('DROP DATABASE IF EXISTS "' + database + '" WITH (FORCE)'); } catch (_) {} }
      await admin?.end().catch(() => {});
      for (const [key, value] of Object.entries(priorEnv)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
      for (const key of Object.keys(require.cache)) if (key.startsWith(path.resolve(directory) + path.sep) && !key.includes(path.sep + 'node_modules' + path.sep)) delete require.cache[key];
      fs.writeFileSync(path.join(directory, 'acceptance-results.json'), JSON.stringify(report, null, 2));
    }
    return report;
  }
}
module.exports = new CodegenVerificationService();
