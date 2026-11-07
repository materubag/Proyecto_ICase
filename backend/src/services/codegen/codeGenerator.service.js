/**
 * Code Generator Orchestrator Service
 * Driven exclusively by the unified, approved and validated Project Specification (icase.spec.json).
 * Eliminates domain hardcoding, enforces strict approvals, consumes approved snapshots,
 * and guarantees 100% resolvable local imports across backend and frontend.
 */

const { buildProjectSpec } = require('./projectSpecBuilder');
const { validateProjectSpec } = require('./projectSpecValidator');
const projectSpecService = require('./projectSpec.service');
const { applyApprovedProposals } = require('./aiProposalStore');
const {
  deriveNaming,
  toPascalCase,
  toCamelCase,
  toSnakeCase
} = require('./typeMapper');
const { generateModelFile, generateModelsIndexFile } = require('./modelGenerator');
const { generateControllerFile } = require('./controllerGenerator');
const {
  generateEntityRoutesFile,
  generateMasterRoutesIndexFile,
  generateUploadMiddlewareFile,
  generateUploadRoutesFile
} = require('./routeGenerator');
const {
  generateOperationServiceFile,
  generateOperationControllerFile,
  generateOperationRoutesFile
} = require('./operationGenerator');
const {
  generateMigrationForEntity,
  generateMigrationForJoinTable,
  generateMigrationForConstraints,
  generateMigrationRunnerFile,
  generateSequelizercFile
} = require('./migrationGenerator');
const { generateDockerfile, generateDockerCompose, generateDockerIgnore } = require('./dockerGenerator');
const {
  generateServerFile,
  generateDatabaseConfig,
  generatePackageJson,
  generateEnvExample,
  generateReadme
} = require('./serverGenerator');
const {
  generateAuthMiddlewareFile,
  generateAuthControllerFile,
  generateAuthRoutesFile,
  generateAuthUserModelFile,
  generateAuthUserMigrationFile
} = require('./authGenerator');
const frontendGen = require('./reactFrontendGenerator');
const { convertHtmlToJsx, generateInteractiveMockupComponent } = require('./mockupConverter');
const { createZipBuffer } = require('./zipHelper');

/**
 * Validates that all relative require/import paths in generated files resolve to an existing file in the bundle
 */
function validateGeneratedFileImports(files = []) {
  const filePaths = new Set(files.map(f => f.path.replace(/\\/g, '/')));
  const importErrors = [];

  for (const file of files) {
    if (!file.path.endsWith('.js') && !file.path.endsWith('.jsx')) continue;
    const content = file.content;
    const dir = file.path.substring(0, file.path.lastIndexOf('/'));

    // Match require('./...') or require('../...') and from './...' or from '../...'
    const regex = /(?:require\s*\(\s*['"](\.[^'"]+)['"]\s*\)|from\s+['"](\.[^'"]+)['"])/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const relPath = match[1] || match[2];
      const parts = (dir ? dir.split('/') : []);
      const segments = relPath.split('/');
      for (const seg of segments) {
        if (seg === '.' || seg === '') continue;
        if (seg === '..') parts.pop();
        else parts.push(seg);
      }
      const resolved = parts.join('/');

      const candidates = [
        resolved,
        `${resolved}.js`,
        `${resolved}.jsx`,
        `${resolved}/index.js`,
        `${resolved}/index.jsx`
      ];

      const exists = candidates.some(c => filePaths.has(c));
      if (!exists) {
        importErrors.push({
          sourceFile: file.path,
          importPath: relPath,
          resolvedTarget: resolved
        });
      }
    }
  }

  if (importErrors.length > 0) {
    const details = importErrors.map(e => `'${e.sourceFile}' -> '${e.importPath}'`).join(', ');
    const err = new Error(`Se detectaron imports locales que no resuelven a ningún archivo generado: [${details}]`);
    err.code = 'UNRESOLVED_LOCAL_IMPORT';
    err.details = importErrors;
    throw err;
  }
}

class CodeGeneratorService {
  /**
   * Retrieves the specification artifacts for code generation.
   * By default, retrieves the approved, valid snapshot.
   */
  async getProjectArtifacts(projectId, options = {}) {
    let spec = options.spec || null;

    if (!spec) {
      if (options.useApprovedSpec !== false) {
        spec = await projectSpecService.getLatestApprovedSpec(projectId);

        if (!spec) {
          if (options.allowUnapproved) {
            spec = await buildProjectSpec(projectId, options);
          } else {
            const err = new Error('No existe una especificación aprobada para este proyecto. Debe validar y aprobar una especificación antes de generar el código.');
            err.code = 'SPEC_NOT_APPROVED';
            throw err;
          }
        } else {
          // Verify spec freshness against current project elements
          const freshness = await projectSpecService.checkSpecFreshness(projectId, spec);
          if (!freshness.upToDate && !options.ignoreOutdated) {
            if (options.allowUnapproved) {
              spec = await buildProjectSpec(projectId, options);
              spec.outdatedBaselineWarning = `La especificación aprobada previa está desactualizada (${freshness.reason}: ${freshness.details?.message || ''}). Mostrando previsualización con los elementos actuales del proyecto. Se requiere una nueva aprobación formal.`;
            } else {
              const err = new Error(`La especificación aprobada está desactualizada respecto a los elementos del proyecto (${freshness.reason}). Se requiere una nueva validación y aprobación.`);
              err.code = 'SPEC_OUTDATED';
              err.details = freshness.details;
              throw err;
            }
          }
        }
      } else {
        spec = await buildProjectSpec(projectId, options);
      }
    }

    // Apply any approved AI operation proposals and mockup bindings
    const { spec: mergedSpec, applications } = applyApprovedProposals(projectId, spec);
    spec = mergedSpec;
    for (const application of applications) options.onTrace?.({ stage: 'PROPOSAL_APPLICATION', mode: 'DETERMINISTIC', ...application });

    let diagnostics = validateProjectSpec(spec, options);
    if (spec.outdatedBaselineWarning) {
      if (!diagnostics.warnings) diagnostics.warnings = [];
      diagnostics.warnings.push({
        code: 'SPEC_OUTDATED',
        message: spec.outdatedBaselineWarning,
        element: 'ProjectBaseline'
      });
    }

    // If an approved spec was loaded from database but fails validation, and allowUnapproved is true,
    // fallback to building a fresh specification from current project elements
    if (!diagnostics.ready && options.allowUnapproved && !options.spec && !applications.some(item => item.applied)) {
      try {
        const freshSpec = await buildProjectSpec(projectId, options);
        const freshDiagnostics = validateProjectSpec(freshSpec, options);
        if (freshDiagnostics.ready || freshDiagnostics.errors.length < diagnostics.errors.length) {
          spec = freshSpec;
          diagnostics = freshDiagnostics;
        }
      } catch (buildErr) {
        // Retain original spec and diagnostics if rebuild fails
      }
    }

    return {
      spec,
      diagnostics,
      isApprovedOnly: Boolean(spec?.approvedAt && spec?.hash)
    };
  }

  /**
   * Generates all project files in memory from the validated specification.
   */
  async generateProjectFiles(projectId, options = {}) {
    const { includeDocker = true } = options;
    const trace = [{ stage: 'SPEC_VALIDATION', mode: 'DETERMINISTIC', provider: null, model: null }];
    const { spec, diagnostics } = await this.getProjectArtifacts(projectId, { ...options, onTrace: event => { trace.push(event); options.onTrace?.(event); } });

    // If validation fails with blocking errors, return diagnostic report without generating broken code
    const reviewableCodes = ['UNDEFINED_OPERATION_BEHAVIOR', 'UNRESOLVED_SCREEN_CONTRACT', 'UNRESOLVED_OPERATION_CONTRACT', 'UNRESOLVED_PROJECT_CONTRACT', 'UNRESOLVED_OPERATION_PERMISSION', 'MISSING_APPROVED_MOCKUP', 'UNIMPLEMENTED_REQUIREMENT_BEHAVIOR'];
    const qualityOnly = (diagnostics.errors || []).length === 0 || diagnostics.errors.every(error => reviewableCodes.includes(error.code));
    const reviewable = options.reviewOnly === true && qualityOnly;
    const reviewOnly = options.reviewOnly === true && !diagnostics.ready;
    if (!diagnostics.ready && !reviewable) {
      return {
        projectId: spec?.project?.id || projectId,
        projectName: spec?.project?.name || 'Proyecto',
        ready: false,
        isEmpty: (spec?.entities || []).length === 0,
        diagnostics,
        stats: {
          entitiesCount: (spec?.entities || []).length,
          relationshipsCount: (spec?.relationships || []).length,
          operationsCount: (spec?.operations || []).length,
          filesCount: 0,
          isApprovedOnly: false
        },
        isApprovedSpec: Boolean(spec?.approvedAt && spec?.hash),
        files: []
      };
    }

    const files = [];
    const addFile = (path, content, language = 'javascript') => {
      files.push({ path, content, language });
    };

    const projectName = spec.project.name;
    if (require('./reviewedAcceptanceRegistry').resolve(spec)) addFile('backend/tests/reviewed.acceptance.cjs', require('./reviewedAcceptanceRegistry').source(), 'javascript');
    const safeDbName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_db';

    // 1. Root Configuration & Documentation
    if (reviewOnly) addFile('REVIEW_STATUS.json', JSON.stringify({ ready: false, notForDeployment: true, diagnostics }, null, 2), 'json');
    const readme = generateReadme(projectName, spec.entities);
    addFile('README.md', reviewOnly ? '# Paquete de revisión — ready=false\n\nNo aprobado para despliegue. Consulte REVIEW_STATUS.json: las operaciones pendientes responden 501 y los permisos sin fuente explícita se rechazan.\n\n' + readme : readme, 'markdown');
    addFile('icase.spec.json', JSON.stringify(spec, null, 2), 'json');
    addFile('GENERATION_TRACE.json', JSON.stringify([...trace, { stage: 'CODE_EMISSION', mode: 'DETERMINISTIC', outcome: 'GENERATED', liveAiInvoked: false }], null, 2), 'json');
    addFile('SCREEN_BINDINGS.json', JSON.stringify((spec.screens || []).map(screen => ({ screenId: screen.id, route: screen.route, ...require('./screenBindingAudit').auditScreenBindings(screen) })), null, 2), 'json');
    addFile('GENERATOR_PROVENANCE.json', JSON.stringify(require('./exportIntegrity').generatorProvenance(spec, options), null, 2), 'json');
    for (const screen of spec.screens || []) if (screen.html) addFile('mockups/original/' + String(screen.id).replace(/[^a-zA-Z0-9_-]/g, '_') + '.html', screen.html, 'html');
    addFile('openapi.json', JSON.stringify(spec.apiContract || {}, null, 2), 'json');

    addFile('.env', `# Configuración de Puertos y Entorno para Docker Compose
FRONTEND_PORT=3005
BACKEND_PORT=8085
DB_PORT=5435

DB_NAME=${safeDbName}
DB_USER=postgres
DB_PASSWORD=postgres123

# Seguridad JWT
JWT_SECRET=super_secret_jwt_key_change_in_production
JWT_EXPIRATION=8h
`, 'shell');

    if (includeDocker) {
      addFile('docker-compose.yml', generateDockerCompose(projectName), 'yaml');
      addFile('.dockerignore', generateDockerIgnore(), 'text');
    }

    // 2. BACKEND: Express + Sequelize + PostgreSQL
    addFile('backend/package.json', generatePackageJson(projectName), 'json');
    addFile('backend/.env.example', generateEnvExample(projectName), 'shell');
    addFile('backend/.env', generateEnvExample(projectName), 'shell');
    addFile('backend/.sequelizerc', generateSequelizercFile(), 'javascript');
    addFile('backend/src/migrate.js', generateMigrationRunnerFile(spec), 'javascript');
    addFile('backend/src/seed-account.js', require('./initialAccountGenerator').generateInitialAccountScript(spec), 'javascript');
    if (spec.permissionMatrix) addFile('backend/src/seed-permissions.js', `const models = require('./models');\nconst codes = ${JSON.stringify(Object.keys(spec.permissionMatrix))};\nexports.seed = async () => { await models.sequelize.transaction(async transaction => { for (const nombre of ${JSON.stringify(spec.security.roles)}) await models.ROL.findOrCreate({ where: { nombre }, transaction }); for (const codigo of codes) await models.PERMISO.findOrCreate({ where: { codigo }, defaults: { descripcion: codigo }, transaction }); }); };\n`, 'javascript');
    addFile('backend/demo-seeds.json', JSON.stringify(spec.demoSeeds || [], null, 2), 'json');

    if (includeDocker) {
      addFile('backend/Dockerfile', generateDockerfile(), 'dockerfile');
    }
    const systemOps = (spec.operations || []).filter(op => op.invocation === 'SYSTEM' && op.schedule);
    addFile('backend/src/server.js', generateServerFile(projectName, { privateUploads: Boolean(spec.uploads?.private), systemOperations: systemOps.length > 0 }), 'javascript');
    addFile('backend/src/config/database.js', generateDatabaseConfig(projectName), 'javascript');

    // 2.3 Authentication and Authorization Layer setup
    const hasAuth = spec.security && spec.security.authType === 'JWT';
    const userEntity = spec.entities.find(e => /user|usuario|cuenta|account/i.test(e.name));
    const entitiesForModels = [...spec.entities];

    if (hasAuth && !userEntity) {
      addFile('backend/src/models/AuthUser.js', generateAuthUserModelFile(), 'javascript');
      addFile('backend/src/migrations/20261026000000-create-auth-users.js', generateAuthUserMigrationFile('20261026000000'), 'javascript');
      entitiesForModels.push({
        id: 'auth_user_internal',
        name: 'AuthUser',
        modelName: 'AuthUser',
        tableName: 'auth_users',
        attributes: [
          { fieldName: 'id', isPk: true },
          { fieldName: 'username' },
          { fieldName: 'email' },
          { fieldName: 'password' },
          { fieldName: 'role' }
        ]
      });
    }

    // Sequelize Model Files
    for (const entity of spec.entities) {
      const watched = systemOps.flatMap(op => op.schedule.watchedFields || []).filter(watch => watch.entity === entity.modelName).map(watch => watch.field);
      addFile(`backend/src/models/${entity.modelName}.js`, generateModelFile({ ...entity, systemWatchFields: watched }), 'javascript');
    }
    addFile('backend/src/models/index.js', generateModelsIndexFile(entitiesForModels, spec.relationships), 'javascript');

    // Database Migrations (Table creation, Join tables for N:M, and cycle-safe Foreign Keys)
    let migIndex = 1;
    for (const entity of spec.entities) {
      const ts = `202610260000${String(migIndex).padStart(2, '0')}`;
      migIndex++;
      const mig = generateMigrationForEntity(entity, spec.relationships, ts);
      addFile(`backend/src/migrations/${mig.fileName}`, mig.content, 'javascript');
    }

    // Join tables for N:M relationships
    const nmRels = (spec.relationships || []).filter(r => r.cardinality === 'N:M');
    for (const rel of nmRels) {
      const srcEnt = spec.entities.find(e => e.id === rel.sourceEntityId || e.modelName === rel.sourceEntity);
      const tgtEnt = spec.entities.find(e => e.id === rel.targetEntityId || e.modelName === rel.targetEntity);
      if (srcEnt && tgtEnt) {
        const ts = `202610260000${String(migIndex).padStart(2, '0')}`;
        migIndex++;
        const mig = generateMigrationForJoinTable(rel, srcEnt, tgtEnt, ts);
        addFile(`backend/src/migrations/${mig.fileName}`, mig.content, 'javascript');
      }
    }

    // Post-creation Foreign Key constraints
    const constraintMig = generateMigrationForConstraints(spec.relationships, spec.entities, `202610260000${String(migIndex).padStart(2, '0')}`);
    if (constraintMig) {
      addFile(`backend/src/migrations/${constraintMig.fileName}`, constraintMig.content, 'javascript');
    }

    if (hasAuth) {
      const auth = require('./reviewedAuth').hardenReviewedAuth(generateAuthControllerFile(userEntity, spec.security?.roles || [], spec.entities || []), generateAuthMiddlewareFile(), generateAuthRoutesFile(), spec);
      addFile('backend/src/middleware/auth.middleware.js', auth.middleware, 'javascript');
      addFile('backend/src/controllers/auth.controller.js', auth.source, 'javascript');
      addFile('backend/src/routes/auth.routes.js', auth.routes, 'javascript');
    }

    // Express REST Controllers and Routes
    addFile('backend/src/services/crud.runtime.js', require('fs').readFileSync(require.resolve('./crudRuntime'), 'utf8').replace("require('./operationRuntime')", "require('./operation.runtime')"), 'javascript');
    addFile('backend/src/services/operation.runtime.js', require('fs').readFileSync(require.resolve('./operationRuntime'), 'utf8'), 'javascript');
    for (const entity of spec.entities) {
      const naming = deriveNaming(entity.name);
      addFile(`backend/src/controllers/${naming.paramName}.controller.js`, generateControllerFile(entity), 'javascript');
      addFile(`backend/src/routes/${naming.paramName}.routes.js`, generateEntityRoutesFile(entity, { hasAuth, operations: spec.operations, defaultRoles: spec.security?.roles || spec.roles || [] }), 'javascript');
    }

    // Custom Business Operations (services, controllers, routes with transactional execution)
    const businessOps = (spec.operations || []).filter(o => o.type === 'BUSINESS_LOGIC');
    if (systemOps.length) {
      const names = require('./operationGenerator').buildOperationNameMap(businessOps);
      addFile('backend/src/services/system-operations.json', JSON.stringify(systemOps.map(op => ({ operationId: op.operationId, functionName: names.get(op.operationId), intervalMs: op.schedule.intervalMs })), null, 2), 'json');
      addFile('backend/src/services/system.scheduler.js', require('fs').readFileSync(require.resolve('./systemOperationScheduler'), 'utf8'), 'javascript');
    }
    const hasOperations = businessOps.length > 0;
    if (hasOperations) {
      addFile('backend/src/services/operation.service.js', generateOperationServiceFile(businessOps, spec.entities, { reviewOnly }), 'javascript');
      addFile('backend/src/controllers/operation.controller.js', generateOperationControllerFile(businessOps), 'javascript');
      addFile('backend/src/routes/operation.routes.js', generateOperationRoutesFile(businessOps, spec.security), 'javascript');
    }

    // File & Image Upload Infrastructure (Multer)
    addFile('backend/src/middleware/upload.middleware.js', generateUploadMiddlewareFile(), 'javascript');
    addFile('backend/src/routes/upload.routes.js', spec.credentialChangeContract ? require('fs').readFileSync(require.resolve('./reviewedUploadRoutes'), 'utf8') : generateUploadRoutesFile({ privateUploads: Boolean(spec.uploads?.private), roles: spec.uploads?.roles || [] }), 'javascript');
    addFile('backend/src/services/upload.storage.js', require('fs').readFileSync(require.resolve('./uploadStorageRuntime'), 'utf8'), 'javascript');

    // Central API Router index
    addFile('backend/src/routes/index.js', generateMasterRoutesIndexFile(spec.entities, { hasOperations, hasAuth }), 'javascript');

    // 3. FRONTEND: React 18 + Vite SPA
    addFile('frontend/package.json', frontendGen.generateFrontendPackageJson(projectName), 'json');
    addFile('frontend/scripts/compile-mockup-themes.cjs', `const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const autoprefixer = require('autoprefixer');
const root = path.resolve(__dirname, '..');
async function compile() {
  const themes = path.join(root, 'themes');
  if (!fs.existsSync(themes)) return;
  fs.mkdirSync(path.join(root, 'src/styles'), { recursive: true });
  for (const file of fs.readdirSync(themes).filter(file => file.endsWith('.cjs'))) {
    const target = path.join(root, 'src/styles', file.replace(/\\.cjs$/, '.css'));
    const result = await postcss([tailwind(path.join(themes, file)), autoprefixer]).process('@tailwind utilities;', { from: target });
    fs.writeFileSync(target, result.css);
  }
}
compile().catch(error => { console.error(error.message); process.exitCode = 1; });
`, 'javascript');
    addFile('frontend/vite.config.js', frontendGen.generateViteConfig(), 'javascript');
    addFile('frontend/tailwind.config.js', frontendGen.generateTailwindConfig(), 'javascript');
    addFile('frontend/postcss.config.js', frontendGen.generatePostcssConfig(), 'javascript');
    addFile('frontend/index.html', frontendGen.generateIndexHtml(projectName), 'html');
    if (includeDocker) {
      addFile('frontend/Dockerfile', frontendGen.generateFrontendDockerfile(), 'dockerfile');
      addFile('frontend/nginx.conf', frontendGen.generateFrontendNginxConf(), 'nginx');
    }
    addFile('frontend/src/main.jsx', reviewOnly ? frontendGen.generateMainJsx().replace('<App />', '<><div role="status" style={{padding:12,background:"#fffbeb",color:"#92400e"}}>Paquete de revision | ready=false | Contiene funciones pendientes</div><App /></>') : frontendGen.generateMainJsx(), 'javascript');
    addFile('frontend/src/index.css', frontendGen.generateFrontendCss(), 'css');
    addFile('frontend/src/api/client.js', frontendGen.generateApiClientJs(), 'javascript');

    // Shared React UI Components based on DESIGN_SYSTEM.md
    addFile('frontend/src/components/AppShell.jsx', frontendGen.generateAppShellComponent(), 'javascript');
    addFile('frontend/src/components/shared/FormField.jsx', frontendGen.generateSharedFormFieldComponent(), 'javascript');
    addFile('frontend/src/components/shared/Button.jsx', frontendGen.generateSharedButtonComponent(), 'javascript');
    addFile('frontend/src/components/shared/StatusBadge.jsx', frontendGen.generateSharedStatusBadgeComponent(), 'javascript');

    // Dynamic Entity CRUD Pages
    for (const entity of spec.entities) {
      addFile(`frontend/src/pages/${entity.modelName}Page.jsx`, frontendGen.generateEntityViewPage(entity, spec.relationships, spec.entities, { hasAuth, operations: spec.operations }), 'javascript');
    }

    addFile('frontend/src/components/ContractTask.jsx', require('fs').readFileSync(require.resolve('./contractTaskRuntime.jsx'), 'utf8'), 'javascript');
    addFile('frontend/src/components/ReviewedWorkspace.jsx', require('fs').readFileSync(require.resolve('./reviewedWorkspace.jsx'), 'utf8'), 'javascript');

    // Operational screens: ContractTask pages (HTML mockups become layout, never a separate CRUD dump)
    const { screenTabKey, compactNavLabel } = require('./screenContract');
    const isLoginScreen = s => /iniciodesesi|accesoalsistema|login|auth/i.test((s.name || '') + (s.route || '') + (s.title || '') + (s.key || ''));
    const operationalScreens = (spec.screens || []).filter(s => !isLoginScreen(s));
    const screensNav = operationalScreens.map(s => ({
      key: screenTabKey(s),
      title: s.title || s.name,
      label: compactNavLabel(s.title || s.name),
      route: s.route
    }));

    const compiledMockups = [];
    let mockupIdx = 1;
    for (const scr of operationalScreens) {
      if (scr.contract && scr.html) scr.contract = { ...scr.contract, visualReference: true };
      const audit = require('./screenBindingAudit').auditScreenBindings(scr);
      if (scr.contract && (audit.missingFields.length || audit.missingPrimaryAction)) {
        scr.contract = { ...scr.contract, unresolved: [...(scr.contract.unresolved || []), `UNRESOLVED: campos sin control (${audit.missingFields.join(', ')}); acción principal sin control: ${audit.missingPrimaryAction}. Complete las correspondencias del mockup.`] };
      }
      const hasWork = scr.html || scr.contract?.renderer === 'task' || (scr.contract?.fields || []).length || (scr.actions || []).length;
      if (!hasWork) continue;
      const cleanBase = toPascalCase((scr.name || 'Screen').replace(/[^a-zA-Z0-9_]/g, '')) || 'Screen';
      const compName = `${cleanBase}${mockupIdx > 1 ? mockupIdx : ''}Mockup`;
      const key = screenTabKey(scr);
      mockupIdx++;

      const matchingOp = (spec.operations || []).find(o => o.operationId === scr.connectedOperationId);
      const targetEntity = scr.targetEntity || scr.entity || '';
      const entityObj = spec.entities.find(e => (e.modelName || e.name || '').toUpperCase() === String(targetEntity).toUpperCase());
      const convertedJsx = scr.contract?.renderer === 'workspace' ? '' : convertHtmlToJsx(scr.html || '<main></main>', compName, scr.route, targetEntity, scr.contract ? { ...scr.mockupBinding, screenContract: scr.contract } : scr.mockupBinding, screensNav);
      const mockupCode = ['task', 'workspace'].includes(scr.contract?.renderer || 'task')
        ? require('./contractTaskGenerator').generateContractTask(compName, scr, convertedJsx, screensNav)
        : generateInteractiveMockupComponent(compName, scr, convertedJsx, matchingOp, scr.actions, entityObj);

      const visual = require('./mockupVisualContract').extractVisualContract(scr.contract?.renderer === 'workspace' ? '' : scr.html || '');
      const visualConfig = { ...visual.config, content: { relative: true, files: [`../src/pages/mockups/${compName}.jsx`] }, important: `[data-mockup-screen="${visual.id}"]`, corePlugins: { preflight: false }, plugins: [] };
      addFile(`frontend/themes/${visual.id}.cjs`, 'module.exports = ' + JSON.stringify(visualConfig, null, 2), 'javascript');
      addFile(`frontend/src/styles/${visual.id}.css`, '/* Generated by npm run prebuild / predev from the declarative screen theme. */', 'css');

      addFile(`frontend/src/pages/mockups/${compName}.jsx`, `import '../../styles/${visual.id}.css';\n` + mockupCode, 'javascript');
      compiledMockups.push({
        compName,
        key,
        title: scr.title || scr.name,
        route: scr.route,
        fileName: `${compName}.jsx`,
        roles: scr.roles || [],
        order: scr.contract?.order
      });
    }

    // Role-Aware Dashboard connected to entities and operational screens
    addFile('frontend/src/pages/Dashboard.jsx', frontendGen.generateDashboardJsx(projectName, spec.entities, compiledMockups), 'javascript');

    // Login Page when project requires authentication
    if (hasAuth) {
      const loginScreen = (spec.screens || []).find(s => isLoginScreen(s) && s.html);
      if (loginScreen) {
        const visual = require('./mockupVisualContract').extractVisualContract(loginScreen.html);
        const config = { ...visual.config, content: { relative: true, files: ['../src/pages/LoginPage.jsx'] }, important: `[data-mockup-screen="${visual.id}"]`, corePlugins: { preflight: false }, plugins: [] };
        addFile(`frontend/themes/${visual.id}.cjs`, 'module.exports = ' + JSON.stringify(config, null, 2), 'javascript');
        addFile(`frontend/src/styles/${visual.id}.css`, '/* Generated from the original login theme by prebuild/predev. */', 'css');
        addFile('frontend/src/pages/LoginPage.jsx', `import '../styles/${visual.id}.css';\n` + require('./loginMockupGenerator').generateLoginMockup(loginScreen), 'javascript');
      } else addFile('frontend/src/pages/LoginPage.jsx', frontendGen.generateLoginPageJsx(projectName), 'javascript');
    }

    // Main App Shell with Navigation & Dynamic Routing
    addFile(
      'frontend/src/App.jsx',
      frontendGen.generateAppJsx(projectName, spec.entities.map(e => ({ ...e, permissions: [...new Set(spec.operations.filter(o => o.entity === e.modelName && o.method === 'GET').flatMap(o => o.authorizedRoles || []))] })), spec.screens, spec.actors, compiledMockups, { hasAuth }),
      'javascript'
    );

    // 4. Apply any verified persisted patches from decision/repair store so they survive clean regenerations
    let persistedExportPatchesApplied = 0;
    try {
      const codegenDecisionService = require('./codegenDecision.service');
      const storedPatches = codegenDecisionService.getStoredPatches(spec.project.id);
      for (const patch of storedPatches) {
        if (patch.targetFile && patch.targetString && patch.replacementString) {
          const matchingFile = files.find(f => f.path.replace(/\\/g, '/') === patch.targetFile.replace(/\\/g, '/'));
          if (matchingFile && matchingFile.content.includes(patch.targetString)) {
            matchingFile.content = matchingFile.content.replace(patch.targetString, patch.replacementString);
            persistedExportPatchesApplied++;
          }
        }
      }
    } catch (_) {}

    // 5. Verify all local imports resolve to existing files in the generated bundle
    validateGeneratedFileImports(files);

    const isApprovedSpec = Boolean(spec.approvedAt && spec.hash);

    return {
      projectId: spec.project.id,
      projectName,
      ready: diagnostics.ready && persistedExportPatchesApplied === 0,
      persistedExportPatchesApplied,
      reviewOnly,
      isApprovedSpec,
      diagnostics,
      stats: {
        entitiesCount: spec.entities.length,
        relationshipsCount: spec.relationships.length,
        operationsCount: spec.operations.length,
        filesCount: files.length,
        isApprovedOnly: isApprovedSpec
      },
      files
    };
  }

  /**
   * Generates a downloadable ZIP buffer containing the full-stack project.
   */
  async generateZipArchive(projectId, options = {}) {
    const result = await this.generateProjectFiles(projectId, options);
    if (!result.files || result.files.length === 0) {
      const errorMsg = (result.diagnostics?.errors || []).map(e => e.message).join(' | ');
      const err = new Error(errorMsg
        ? `No se puede generar el archivo ZIP: la especificación contiene errores bloqueantes. [${errorMsg}]`
        : 'El proyecto no contiene archivos generados para empaquetar.');
      err.code = 'SPEC_VALIDATION_FAILED';
      err.diagnostics = result.diagnostics;
      throw err;
    }

    const sealed = require('./exportIntegrity').bundleVerifiedFiles(result.files.map(f => ({ ...f, content: Buffer.from(f.content || '') })), { tested: false, status: 'NOT_RUN', contractReady: result.ready });
    const zipBuffer = sealed.buffer;
    const safeName = result.projectName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    return {
      filename: `${safeName}-fullstack.zip`,
      buffer: zipBuffer,
      size: zipBuffer.length,
      ready: false,
      contractReady: result.ready,
      verification: 'NOT_RUN',
      sha256: sealed.sha256,
      reviewOnly: result.reviewOnly,
      diagnostics: result.diagnostics
    };
  }
}

module.exports = new CodeGeneratorService();
