// Real migrations + HTTP + Chromium; AI is a deterministic provider double
// unless --live-ai is explicitly passed. Never uses the project's database.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const vm = require('vm');
const { createRequire } = require('module');
const { fixture } = require('./fixtures/ai-library.cjs');
function isolated(name, stubs) {
  const filename = path.resolve(__dirname, '../src/services/codegen', name), module = { exports: {} }, actual = createRequire(filename);
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports, process, console, __dirname: path.dirname(filename), require: key => Object.hasOwn(stubs, key) ? stubs[key] : actual(key) }, { filename });
  return module.exports;
}
async function main() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.resolve(__dirname, '../../.verification/browsers');
  process.env.TEST_DB_ADMIN_NAME = 'icase_acceptance';
  const reuseProject = process.argv.find(argument => argument.startsWith('--reuse-project='))?.slice('--reuse-project='.length);
  if (reuseProject && !/^[a-zA-Z0-9_-]+$/.test(reuseProject)) throw new Error('INVALID_REUSE_PROJECT');
  const { spec, proposal, screen } = fixture(reuseProject || 'ai-library-real-' + Date.now());
  const live = Boolean(reuseProject) || process.argv.includes('--live-ai');
  const list = { ...proposal, operationId: 'my-books', name: 'Consultar libros propios', route: '/api/operations/my-books', method: 'GET', input: { bodySchema: { type: 'object', properties: {}, additionalProperties: false } }, steps: [{ id: 'listed', action: 'QUERY', entity: 'Book', where: { ownerId: { $ref: 'user.id' } } }], resultStep: 'listed', output: { successStatus: 200 } };
  const own = { ...proposal, operationId: 'own-book', name: 'Consultar un libro propio', route: '/api/operations/own-book', input: { bodySchema: { type: 'object', properties: { bookId: { type: 'integer' } }, required: ['bookId'], additionalProperties: false } }, recordAccess: [{ entity: 'Book', where: { id: { $ref: 'payload.bookId' }, ownerId: { $ref: 'user.id' } } }], steps: [{ id: 'found', action: 'QUERY', entity: 'Book', where: { id: { $ref: 'payload.bookId' }, ownerId: { $ref: 'user.id' } } }], resultStep: 'found', output: { successStatus: 200 } };
  spec.operations.push(list, own);
  screen.contract.dataSources = [{ name: 'books', route: list.route, operationId: list.operationId }];
  screen.contract.listSource = 'books';
  screen.contract.tableColumns = [{ index: 0, field: 'title' }];
  screen.contract.columns = [{ field: 'title', label: 'Título' }];
  const scenario = {
    id: 'library-create-reload-owner-isolation', requirementIds: ['r1'], users: [{ id: 'a', role: 'Lector' }, { id: 'b', role: 'Lector' }, { id: 'visitor', role: 'Visitante' }],
    requests: [
      { id: 'created', operationId: proposal.operationId, as: 'a', body: { title: 'Persistencia API' }, status: 201, equals: [{ path: 'data.data.title', value: 'Persistencia API' }] },
      { id: 'listed', operationId: list.operationId, as: 'a', status: 200, equals: [{ path: 'data.data.0.title', value: 'Persistencia API' }] },
      { id: 'other-list', operationId: list.operationId, as: 'b', status: 200, equals: [{ path: 'data.data', value: [] }] },
      { id: 'invalid', operationId: proposal.operationId, as: 'a', body: {}, status: 400 },
      { id: 'unknown', operationId: proposal.operationId, as: 'a', body: { title: 'No guardar', ownerId: 42 }, status: 400 },
      { id: 'anonymous', operationId: proposal.operationId, body: { title: 'No guardar' }, status: 401 },
      { id: 'wrong-role', operationId: proposal.operationId, as: 'visitor', body: { title: 'No guardar' }, status: 403 },
      { id: 'owner', operationId: own.operationId, as: 'a', body: { bookId: { $ref: 'responses.created.data.data.id' } }, status: 200, equals: [{ path: 'data.data.0.title', value: 'Persistencia API' }] },
      { id: 'cross-owner', operationId: own.operationId, as: 'b', body: { bookId: { $ref: 'responses.created.data.data.id' } }, status: 403 }
    ],
    persistence: [{ entity: 'Book', where: { id: { $ref: 'responses.created.data.data.id' } }, count: 1, fields: { title: 'Persistencia API', ownerId: { $ref: 'users.a.id' } } }, { entity: 'Book', where: { title: 'Persistencia navegador' }, count: 1, fields: { ownerId: { $ref: 'users.a.id' } } }, { entity: 'Book', where: { title: 'No guardar' }, count: 0 }],
    browser: [{ as: 'a', screenId: screen.id, steps: [{ action: 'fill', field: 'title', value: 'Persistencia navegador' }, { action: 'click', actionId: 'confirmar' }, { action: 'text', value: 'Persistencia navegador' }, { action: 'reload' }, { action: 'text', value: 'Persistencia navegador' }] }]
  };
  // Trusted expectations are separate from the provider response in this test.
  spec.acceptanceScenarios = [scenario];
  const store = require('../src/services/codegen/aiProposalStore');
  const screenPlanner = require('../src/services/codegen/aiScreenPlanner');
  const bindings = { primaryOperationId: proposal.operationId, controlBindings: { input: [{ index: 0, field: 'title' }], button: [{ index: 0, actionId: 'confirmar' }] }, ambiguities: [] };
  const trace = [];
  const stubs = live ? {} : {
    './aiOperationPlanner': { async planOperationSteps(projectId, op, catalog) {
      const entry = store.saveOperationProposal(projectId, op.operationId, proposal, store.operationDependencies(op, catalog));
      return { valid: true, proposal, proposalId: entry.id, providerMetadata: { mode: 'AI', provider: 'TEST_DOUBLE', outcome: 'SUCCEEDED', usage: { totalTokens: 0 } } };
    } },
    './aiScreenPlanner': { async planScreen(projectId, currentScreen, effective, dependencySpec) {
      const compiled = screenPlanner.compileScreenProposal(currentScreen, bindings, effective);
      assert.deepEqual(compiled.errors, []);
      const entry = store.saveBindingProposal(projectId, currentScreen.id, { screenId: currentScreen.id, controlBindings: compiled.contract.controlBindings, screenContract: compiled.contract }, store.bindingDependencies(currentScreen, { ...dependencySpec, rules: dependencySpec.businessRules, roles: dependencySpec.security.roles }));
      return { valid: true, proposalId: entry.id, providerMetadata: { mode: 'AI', provider: 'TEST_DOUBLE', outcome: 'SUCCEEDED' } };
    } }
  };
  const pipeline = isolated('aiGenerationPipeline.js', stubs);
  if (reuseProject) {
    const entries = store.getProposals(reuseProject);
    assert.equal(entries.operations[proposal.operationId]?.status, 'APPROVED');
    trace.push({ stage: 'PROVIDER_RESPONSE_REUSE', mode: 'AI', provider: entries.operations[proposal.operationId].providerMetadata.provider, outcome: 'CACHED_RESPONSE', tokensUsed: 0 });
  }
  await pipeline.planGeneration(spec.project.id, spec, { enableAI: !reuseProject, maxTokens: 12000, deadline: Date.now() + 120000, onTrace: event => trace.push(event) });
  const result = await require('../src/services/codegen/codeGenerator.service').generateProjectFiles(spec.project.id, { spec, reviewOnly: true, onTrace: event => trace.push(event) });
  assert.ok(result.files.length, JSON.stringify(result.diagnostics.errors));
  const root = path.resolve(__dirname, '../.verification'); fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, 'ai-library-'));
  for (const file of result.files) { const target = path.join(directory, file.path); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, file.content); }
  fs.writeFileSync(path.join(directory, 'AI_ACCEPTANCE_TRACE.json'), JSON.stringify({ liveProvider: live, reusedProviderResponses: Boolean(reuseProject), trace }, null, 2));
  console.log('EXPORT_DIRECTORY=' + directory);
  const locks = await require('../src/services/codegen/exportDependencies').prepareExportDependencies(directory);
  const exportedSpec = JSON.parse(fs.readFileSync(path.join(directory, 'icase.spec.json')));
  const filePaths = [...result.files.map(file => file.path), ...locks, 'AI_ACCEPTANCE_TRACE.json'];
  const report = await require('../src/services/codegen/codegenVerification.service').runVerification(directory, exportedSpec, { filePaths, onProgress: event => console.log(JSON.stringify(event)) });
  console.log(JSON.stringify({ liveProvider: live, passed: report.passed, ready: report.ready, tests: report.tests, errors: report.errors, behaviorFailures: report.behaviorFailures }, null, 2));
  assert.equal(report.passed, true, 'Real PostgreSQL/browser acceptance must pass');
  const integrity = require('../src/services/codegen/exportIntegrity');
  const paths = [...new Set([...filePaths, ...(report.screenshots || []), 'acceptance-results.json'])];
  const bundle = integrity.bundleVerifiedFiles(integrity.snapshotFiles(directory, paths), { tested: true, ready: report.ready, testedSourceHash: report.testedSourceHash, liveProvider: live });
  fs.writeFileSync(directory + '.zip', bundle.buffer);
  console.log('VERIFIED_ZIP=' + directory + '.zip SHA256=' + bundle.sha256);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await require('../src/config/prisma').$disconnect(); });
