const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const store = require('../src/services/codegen/aiProposalStore');
const { validateGeneratedOperation } = require('../src/services/codegen/aiGenerationPolicy');
const { compileScreenProposal } = require('../src/services/codegen/aiScreenPlanner');
const { validateScenario, resolveTest } = require('../src/services/codegen/contractAcceptanceRunner');

function isolated(name, stubs) {
  const filename = path.resolve(__dirname, '../src/services/codegen', name), module = { exports: {} }, actual = createRequire(filename);
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports, process, console, Buffer, setImmediate, __dirname: path.dirname(filename), require: key => Object.hasOwn(stubs, key) ? stubs[key] : actual(key) }, { filename });
  return module.exports;
}
const { fixture } = require('./fixtures/ai-library.cjs');

test('AI planning continues beyond 50000 tokens without an explicit budget', async () => {
  const { spec, proposal } = fixture();
  spec.screens = [];
  let calls = 0;
  const pipeline = isolated('aiGenerationPipeline.js', {
    './aiProposalStore': { ...store, getProposals: () => ({ operations: {}, bindings: {} }), applyApprovedProposals: (_, value) => ({ spec: value }) },
    './aiOperationPlanner': { planOperationSteps: async () => {
      calls++;
      return { valid: false, proposal, providerMetadata: { mode: 'AI', outcome: 'SUCCEEDED', usage: { totalTokens: 60000 } } };
    } }
  });
  const result = await pipeline.planGeneration(spec.project.id, spec, { enableAI: true });
  assert.equal(calls, 3, 'All bounded validation attempts run despite the former token limit');
  assert.equal(result.tokensUsed, 180000);
});

test('AI generation automatically selects valid response, full exporter applies it, clean regeneration retains it (provider double)', async () => {
  const { spec, proposal } = fixture();
  const trace = [];
  let calls = 0;
  const planner = { async planOperationSteps(projectId, operation, catalog) {
    calls++;
    assert.equal(catalog.screens[0].html, spec.screens[0].html);
    const entry = store.saveOperationProposal(projectId, operation.operationId, proposal, store.operationDependencies(operation, catalog));
    return { valid: true, proposal, proposalId: entry.id, providerMetadata: { mode: 'AI', provider: 'TEST_DOUBLE', outcome: 'SUCCEEDED', usage: { totalTokens: 19 } } };
  } };
  const pipeline = isolated('aiGenerationPipeline.js', { './aiOperationPlanner': planner, './aiScreenPlanner': { planScreen: async () => ({ valid: false }) } });
  const result = await pipeline.planGeneration(spec.project.id, spec, { enableAI: true, onTrace: event => trace.push(event) });
  assert.equal(result.tokensUsed, 19);
  assert.equal(store.getProposals(spec.project.id).operations['create-book'].reviewedBy, 'CODEGEN_TECHNICAL_VALIDATION');
  const generator = require('../src/services/codegen/codeGenerator.service');
  const first = await generator.generateProjectFiles(spec.project.id, { spec, reviewOnly: true });
  assert.ok(first.files.length, JSON.stringify(first.diagnostics.errors));
  assert.match(first.files.find(file => file.path.endsWith('operation.service.js')).content, /payload.title/);
  const second = await generator.generateProjectFiles(spec.project.id, { spec, reviewOnly: true });
  assert.equal(first.files.find(file => file.path.endsWith('operation.service.js')).content, second.files.find(file => file.path.endsWith('operation.service.js')).content);
  await pipeline.planGeneration(spec.project.id, spec, { enableAI: true });
  assert.equal(calls, 1, 'A fresh approved proposal is reused');
});

test('Automatic AI selection rejects permissions expansion, schema weakening and unanswered business questions', () => {
  const { source, proposal, spec } = fixture();
  const catalog = { entities: spec.entities, roles: spec.security.roles, screens: spec.screens, operations: spec.operations };
  assert.deepEqual(validateGeneratedOperation(source, proposal, catalog), []);
  assert.ok(validateGeneratedOperation(source, { ...proposal, authorizedRoles: ['Visitante'] }, catalog).includes('AI_PERMISSION_CHANGE'));
  assert.ok(validateGeneratedOperation(source, { ...proposal, ambiguities: ['Quién autoriza'] }, catalog).includes('UNRESOLVED_AI_BUSINESS_QUESTIONS'));
  assert.ok(validateGeneratedOperation({ ...source, recordAccess: [{ entity: 'Book', where: { ownerId: { $ref: 'user.id' } } }] }, { ...proposal, recordAccess: [] }, catalog).some(error => error.includes('recordAccess')));
  const constrained = { ...source, input: proposal.input };
  assert.ok(validateGeneratedOperation(constrained, { ...proposal, input: { bodySchema: { ...proposal.input.bodySchema, required: [] } } }, catalog).includes('AI_REMOVED_REQUIRED_INPUT'));
  assert.ok(validateGeneratedOperation(source, { ...proposal, acceptanceScenarios: [] }, catalog).includes('UNRESOLVED_ACCEPTANCE_SCENARIOS'));
  const incomplete = { ...source, input: { bodySchema: { type: 'object', properties: {} } } };
  assert.deepEqual(validateGeneratedOperation(incomplete, proposal, catalog), [], 'An empty generated input can be completed');
});

test('executable contracts without scenarios are sent to the planner', async () => {
  const { spec, proposal } = fixture();
  spec.operations = [{ ...proposal, acceptanceScenarios: [] }];
  spec.screens = [];
  let calls = 0;
  const withApiScenario = { ...proposal, acceptanceScenarios: proposal.acceptanceScenarios.map(s => ({ ...s, browser: [] })) };
  const pipeline = isolated('aiGenerationPipeline.js', {
    './aiProposalStore': { ...store, getProposals: () => ({ operations: {}, bindings: {} }), reviewProposal() {}, applyApprovedProposals: (_, value) => ({ spec: value }) },
    './aiOperationPlanner': { planOperationSteps: async () => {
      calls++;
      return { valid: true, proposal: withApiScenario, providerMetadata: { mode: 'AI', outcome: 'SUCCEEDED' } };
    } }
  });
  await pipeline.planGeneration(spec.project.id, spec, { enableAI: true });
  assert.equal(calls, 1);
});

test('AI visual binding compiles existing controls without replacing original mockup; incorrect actions and indexes reject', () => {
  const { spec, screen, proposal } = fixture();
  spec.operations = [proposal];
  const response = { primaryOperationId: proposal.operationId, controlBindings: { input: [{ index: 0, field: 'title' }], button: [{ index: 0, actionId: 'confirmar' }] } };
  const result = compileScreenProposal(screen, response, spec);
  assert.deepEqual(result.errors, []);
  const jsx = require('../src/services/codegen/mockupConverter').convertHtmlToJsx(screen.html, 'Books', screen.route, '', { screenContract: result.contract });
  assert.match(jsx, /Biblioteca de muestra/);
  assert.match(jsx, /slots.setField\("title"/);
  assert.match(jsx, /slots.execute\("confirmar"/);
  assert.ok(compileScreenProposal(screen, { ...response, controlBindings: { button: [{ index: 999, actionId: 'eliminar' }] } }, spec).errors.length);
});

test('Acceptance test data cannot execute code or bypass persistence assertions', () => {
  const { spec } = fixture();
  assert.ok(validateScenario({ id: 'fake', requests: [{ id: 'ok', operationId: 'create-book', status: 200 }] }, spec).length);
  assert.throws(() => resolveTest({ $ref: 'process.env.SECRET' }, {}), /INVALID_TEST_REFERENCE/);
  assert.throws(() => resolveTest({ $ref: 'users.constructor' }, { users: {} }), /INVALID_TEST_REFERENCE/);
});

test('Provider validation errors are fed back before automatic application; rejected proposals are preserved', async () => {
  const { spec, proposal } = fixture('ai-feedback-' + Date.now());
  let calls = 0;
  const planner = { async planOperationSteps(projectId, operation, catalog, options) {
    calls++;
    if (calls === 2) assert.ok(options.validationFeedback.some(error => error.includes('TRANSACTION')));
    const candidate = { ...proposal, transaction: calls > 1 };
    const entry = store.saveOperationProposal(projectId, operation.operationId, candidate, store.operationDependencies(operation, catalog));
    return { valid: true, proposal: candidate, proposalId: entry.id, providerMetadata: { mode: 'AI', outcome: 'SUCCEEDED' } };
  } };
  const pipeline = isolated('aiGenerationPipeline.js', { './aiOperationPlanner': planner, './aiScreenPlanner': { planScreen: async () => ({ valid: false }) } });
  await pipeline.planGeneration(spec.project.id, spec, { enableAI: true });
  assert.equal(calls, 2);
  const entry = store.getProposals(spec.project.id).operations['create-book'];
  store.reviewProposal(spec.project.id, entry.id, { status: 'REJECTED', reviewer: 'User' });
  await pipeline.planGeneration(spec.project.id, spec, { enableAI: true, repairFeedback: ['failed'] });
  assert.equal(calls, 2, 'A user rejection cannot be overwritten by automatic repair');
});

test('Incomplete CREATE contracts and unknown query fields reject; false predicates never execute a write (model double)', async () => {
  const { proposal, spec } = fixture();
  const { executionProblems } = require('../src/services/codegen/executableContract');
  const incomplete = JSON.parse(JSON.stringify(proposal)); delete incomplete.steps[0].fields.ownerId;
  assert.ok(executionProblems(incomplete, spec.entities).some(error => error.includes('ownerId')));
  const query = { ...proposal, steps: [{ id: 'created', entity: 'Book', action: 'QUERY', where: { invented: 1 } }] };
  assert.ok(executionProblems(query, spec.entities).some(error => error.includes('invented')));
  const runtime = require('../src/services/codegen/operationRuntime');
  let writes = 0;
  await runtime.executeSteps({ Book: { create() { writes++; } } }, { ...proposal, steps: [{ ...proposal.steps[0], when: { operator: 'eq', left: 1, right: 2 } }] }, { title: 'Do not save' }, { id: 1, role: 'Lector' }, {});
  assert.equal(writes, 0);
});

test('Persistent legacy job seals files but cannot bypass verified delivery approval (verification double)', async () => {
  const { spec } = fixture('job-ai-sealed-' + Date.now());
  let planned = 0;
  const service = isolated('codegenJob.service.js', {
    './projectSpecBuilder': { buildProjectSpec: async () => spec },
    './aiGenerationPipeline': { planGeneration: async (_id, _spec, options) => {
      planned++;
      assert.equal(options.enableAI, true);
      options.onProgress('Generando operación 1/1: Registrar libro...');
      options.onTrace({ stage: 'OPERATION_PLANNING', operationId: 'create-book', validation: 'PASSED', usage: { totalTokens: 13 } });
      return { tokensUsed: 13 };
    } },
    './exportDependencies': { prepareExportDependencies: async () => [] },
    './codegenVerification.service': { async runVerification(directory, _spec, options) {
      assert.ok(options.filePaths.includes('icase.spec.json'));
      const report = { passed: true, ready: false, kind: 'VERIFICATION_DOUBLE', tests: [], errors: [], checks: ['DOUBLE_ONLY'], screenshots: [], scope: 'Unit fixture' };
      fs.writeFileSync(path.join(directory, 'acceptance-results.json'), JSON.stringify(report));
      return report;
    } }
  });
  const job = { id: 'job_fixture_' + Date.now(), projectId: spec.project.id, status: 'GENERATING', enableAI: true, trace: [], logs: [], metrics: { startedAt: new Date().toISOString(), stages: {}, totalTokens: 0, repairAttempts: 0 }, budget: { maxTokens: 1000, maxRepairAttempts: 1, timeoutMs: 60000 }, decisionAnalysis: { status: 'NO_PENDING_DECISIONS' } };
  service.saveJob(job);
  await service.runPipeline(job.id);
  assert.equal(planned, 1);
  assert.equal(job.metrics.totalTokens, 13, 'Tokens saved by each trace are not counted again at stage completion');
  assert.ok(job.logs.some(log => log.message.includes('Generando operación 1/1')));
  assert.equal(job.status, 'COMPLETED');
  assert.equal(job.ready, false);
  const integrity = require('../src/services/codegen/exportIntegrity');
  const buffer = fs.readFileSync(job.zipPath);
  assert.equal(integrity.sha256(buffer), job.zipSha256);
  const entries = integrity.readZip(buffer);
  assert.equal(entries.filter(entry => entry.path === 'GENERATION_TRACE.json').length, 1);
  assert.equal(entries.find(entry => entry.path === 'mockups/original/books.html').content.toString(), spec.screens[0].html);
  const requests = [];
  const controller = isolated('../../controllers/codegen.controller.js', {
    '../services/codegen/codegenJob.service': service,
    '../services/codegen/deliveryWorkflow': { service: () => ({ archive: async id => {
      requests.push(id);
      throw Object.assign(new Error('La entrega requiere siete etapas vigentes, probadas y aprobadas'), { statusCode: 409 });
    } }) }
  });
  const response = { status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } };
  await controller.downloadZip({ params: { projectId: spec.project.id }, query: { jobId: job.id } }, response);
  assert.equal(response.code, 409);
  assert.match(response.body.error.message, /siete etapas/);
  assert.deepEqual(requests, [spec.project.id]);
});

module.exports.fixture = fixture;
