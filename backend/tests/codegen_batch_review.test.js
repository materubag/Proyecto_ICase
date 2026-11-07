const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { fixture } = require('./fixtures/ai-library.cjs');
const store = require('../src/services/codegen/aiProposalStore');
const { splitAmbiguities } = require('../src/services/codegen/generationClarifications');
function isolated(name, stubs, queued = []) {
  const filename = path.resolve(__dirname, '../src/services/codegen', name);
  const module = { exports: {} }, actual = createRequire(filename);
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, process, console, Buffer, __dirname: path.dirname(filename), setImmediate: fn => queued.push(fn), require: key => Object.hasOwn(stubs, key) ? stubs[key] : actual(key) }, { filename });
  return module.exports;
}

test('batch review keeps a cached question and visits remaining operations and screens', async () => {
  const { spec, source, proposal } = fixture('batch-cached-' + Date.now());
  spec.operations.push({ ...source, operationId: 'second' });
  spec.screens = [{ id: 'screen', name: 'Screen', html: '<form></form>', contract: { unresolved: ['pending'] } }];
  const catalog = { ...spec, roles: spec.security.roles, rules: spec.businessRules };
  store.saveOperationProposal(spec.project.id, source.operationId, { ...proposal, ambiguities: ['¿Cuál es el plazo permitido?'] }, store.operationDependencies(source, catalog));
  const called = [], checkpoints = [];
  const pipeline = isolated('aiGenerationPipeline.js', {
    './aiOperationPlanner': { async planOperationSteps(_, operation) { called.push(operation.operationId); return { valid: false, proposal: { ambiguities: ['¿Qué resultado espera el usuario?'] }, providerMetadata: { mode: 'AI', outcome: 'SUCCEEDED', usage: { totalTokens: 20 } } }; } },
    './aiScreenPlanner': { async planScreen() { called.push('screen'); return { valid: false, ambiguities: ['¿Qué datos desea consultar?'], providerMetadata: { outcome: 'SUCCEEDED' } }; } }
  });
  const result = await pipeline.planGeneration(spec.project.id, spec, { enableAI: true, batchMode: true, onCheckpoint: value => checkpoints.push(value) });
  assert.deepEqual(called, ['second', 'screen']);
  assert.equal(result.questions.length, 3);
  assert.equal(result.tokensUsed, 20);
  assert.equal(checkpoints.at(-1).phase, 'COMPLETE');
});

test('batch review retries technical ambiguities, collects blockers, and continues after provider failures or missing roles', async () => {
  const { spec, source, proposal } = fixture('batch-technical-' + Date.now());
  spec.operations = ['technical', 'failure', 'business', 'roles'].map(operationId => ({ ...source, operationId, ...(operationId === 'roles' ? { authorizedRoles: [] } : {}) }));
  spec.screens = [];
  const calls = [];
  const pipeline = isolated('aiGenerationPipeline.js', { './aiOperationPlanner': { async planOperationSteps(_, operation, __, options) {
    calls.push(operation.operationId);
    if (operation.operationId === 'failure') throw new Error('PROVIDER_DOWN');
    if (operation.operationId === 'business') return { valid: false, proposal: { ambiguities: ['¿Qué política de vencimiento debe aplicarse?'] }, providerMetadata: { outcome: 'SUCCEEDED' } };
    if (calls.filter(id => id === 'technical').length > 1) assert(options.validationFeedback.some(text => text.includes('QUERY')));
    return { valid: false, proposal: { ...proposal, ambiguities: ['El binding QUERY no implementa GROUP BY.'] }, providerMetadata: { mode: 'AI', outcome: 'SUCCEEDED' } };
  } } });
  const result = await pipeline.planGeneration(spec.project.id, spec, { enableAI: true, batchMode: true });
  assert.equal(calls.filter(id => id === 'technical').length, 3);
  assert(!calls.includes('roles'));
  assert.equal(result.blockers.length, 2);
  assert.equal(result.questions.length, 2);
  assert(result.questions.some(question => question.targetId === 'roles'));
  assert(!result.questions.some(question => question.targetId === 'technical'));
});

test('technical classification preserves business decisions that require explicit values', () => {
  const result = splitAmbiguities(['La acción requiere bindingVersion=2.', 'No se especifica la tasa de impuestos.', 'La pantalla en su contrato solo declara la consulta.', '¿Qué roles pueden confirmar una venta?']);
  assert.equal(result.technical.length, 2);
  assert.equal(result.business.length, 2);
});

test('provider failures never turn deterministic fallback messages into business questions', async () => {
  const { spec, source, proposal } = fixture('batch-provider-failure-' + Date.now());
  const catalog = { ...spec, roles: spec.security.roles, rules: spec.businessRules };
  store.saveOperationProposal(spec.project.id, source.operationId, { ...proposal, ambiguities: ['¿Qué campos debe recibir?'] }, store.operationDependencies(source, catalog), { outcome: 'FAILED' });
  let calls = 0;
  const pipeline = isolated('aiGenerationPipeline.js', { './aiOperationPlanner': { async planOperationSteps() {
    calls++;
    return { valid: false, proposal: { ambiguities: ['¿Qué campos debe recibir?'] }, providerMetadata: { mode: 'AI', outcome: 'FAILED', reason: 'PROVIDER_ERROR', errorMessage: 'Connection unavailable' } };
  } } });
  const result = await pipeline.planGeneration(spec.project.id, spec, { enableAI: true, batchMode: true });
  assert.equal(calls, 1);
  assert.equal(result.questions, undefined);
  assert.equal(result.blockers[0].errors[0], 'PROVIDER_ERROR');
  assert.equal(result.blockers[0].errors[1], 'Connection unavailable');
});

test('proposal selection detects incomplete reference contracts despite narrative steps existing', () => {
  const { operationNeedsExecutableBehavior } = require('../src/services/codegen/projectSpecValidator');
  const operation = { type: 'BUSINESS_LOGIC', steps: [{ action: 'CREATE', entity: 'CLIENTE' }] };
  assert.equal(operationNeedsExecutableBehavior(operation, [{ modelName: 'CLIENTE', attributes: [{ fieldName: 'nombre', allowNull: false }] }]), true);
});

test('batch resume preserves initial business questions and clears stale delivery seals', async () => {
  const queued = [];
  const service = isolated('codegenJob.service.js', {}, queued);
  service.saveJob = job => service.memoryJobs.set(job.id, job);
  const question = { questionId: 'policy', question: 'Choose a policy' };
  const job = { id: 'batch-resume', status: 'WAITING_FOR_INPUT', questions: [question], logs: [], zipSha256: 'old', bundleManifest: {} };
  service.saveJob(job);
  assert.equal((await service.resumeJob(job.id, { batchReview: true })).resumed, true);
  assert.equal(job.status, 'GENERATING'); assert.equal(job.batchMode, true);
  assert.equal(job.questions.length, 0); assert.equal(job.analysisQuestions[0].questionId, 'policy');
  assert.equal(job.zipSha256, null); assert.equal(queued.length, 1);
});

test('resuming an interrupted generation removes obsolete blockers and preserves decisions', async () => {
  const queued = [];
  const service = isolated('codegenJob.service.js', {}, queued);
  service.saveJob = job => service.memoryJobs.set(job.id, job);
  const decisions = { approved: { customAnswer: 'Keep this answer' } };
  const job = { id: 'interrupted-stale-blockers', status: 'INTERRUPTED', resumeStage: 'GENERATING', planningBlockers: [{ operationId: 'UC-11', errors: ['old failure'] }], decisions, logs: [] };
  service.saveJob(job);
  assert.equal((await service.resumeJob(job.id)).resumed, true);
  assert.equal(job.status, 'GENERATING');
  assert.equal(job.planningBlockers.length, 0);
  assert.equal(job.decisions, decisions);
  assert.equal(queued.length, 1);
});

test('answering the last business question never schedules AI while technical blockers remain', async () => {
  const queued = [];
  const service = isolated('codegenJob.service.js', { './codegenDecision.service': { submitDecision: async () => ({ decision: { customAnswer: 'Confirmed' } }) } }, queued);
  service.saveJob = job => service.memoryJobs.set(job.id, job);
  const job = { id: 'no-ai-on-technical-blockers', status: 'WAITING_FOR_INPUT', questions: [{ questionId: 'policy', source: 'GENERATION', targetId: 'UC-22', options: [] }], planningBlockers: [{ operationId: 'UC-08', errors: ['Migration needed'] }], logs: [], metrics: { totalTokens: 99 } };
  service.saveJob(job);
  const result = await service.submitInput(job.id, { questionId: 'policy', customAnswer: 'Confirmed' });
  assert.equal(result.success, true);
  assert.equal(job.status, 'BLOCKED');
  assert.equal(job.questions.length, 0);
  assert.equal(queued.length, 0);
  assert.equal(job.metrics.totalTokens, 99);
  assert.equal(job.decisions.policy.customAnswer, 'Confirmed');
});

test('quality grouping preserves every error while grouping multiple messages for one operation', async () => {
  const { groupQualityIssues } = await import('../../frontend/src/utils/codegenQualityGroups.js');
  const errors = [
    { code: 'UNRESOLVED_OPERATION_CONTRACT', element: 'Operation:UC-05', message: 'Reference contract' },
    { code: 'UNRESOLVED_OPERATION_CONTRACT', element: 'Operation:UC-05', message: 'Missing fields' },
    { code: 'UNRESOLVED_SCREEN_CONTRACT', element: 'Screen:Repair' },
    { code: 'UNIMPLEMENTED_REQUIREMENT_BEHAVIOR', element: 'Requirement:RF-01' }
  ];
  const summary = groupQualityIssues(errors);
  assert.equal(summary.total, 4); assert.equal(summary.groups.length, 3);
  assert.equal(summary.counts.operations, 1); assert.equal(summary.totals.operations, 2);
  assert.equal(summary.groups.reduce((n, group) => n + group.issues.length, 0), errors.length);
});

test('saving a batch includes only explicit completed answers and never chooses defaults', async () => {
  const { completedBatchAnswers } = await import('../../frontend/src/utils/codegenQualityGroups.js');
  const questions = [{ questionId: 'first', options: [{ id: 'yes' }] }, { questionId: 'second' }, { questionId: 'third', options: [{ id: 'allowed' }] }];
  assert.equal(completedBatchAnswers(questions).length, 0);
  const answers = completedBatchAnswers(questions, { first: 'yes', third: 'invalid' }, { second: '   Detailed answer   ', third: '   ' });
  assert.deepEqual(answers.map(answer => answer.questionId), ['first', 'second']);
  assert.equal(answers[1].customAnswer, 'Detailed answer');
});
