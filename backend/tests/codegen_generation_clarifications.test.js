const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { questionFor, attachDecisions } = require('../src/services/codegen/generationClarifications');
const store = require('../src/services/codegen/aiProposalStore');
const decisions = require('../src/services/codegen/codegenDecision.service');
const { fixture } = require('./fixtures/ai-library.cjs');

function isolated(name, stubs, scheduled = []) {
  const filename = path.resolve(__dirname, '../src/services/codegen', name);
  const module = { exports: {} }, actual = createRequire(filename);
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, process, console, Buffer, __dirname: path.dirname(filename),
    setImmediate: callback => scheduled.push(callback),
    require: key => Object.hasOwn(stubs, key) ? stubs[key] : actual(key)
  }, { filename });
  return module.exports;
}

test('human ambiguities become stable, deduplicated questions, not technical error codes', () => {
  const { source } = fixture();
  const question = questionFor(source, ['¿Qué campos recibe?', '¿Qué campos recibe?', { question: '¿Las fotos son obligatorias?' }, 'AI_REQUIRES_RESULT_STEP']);
  assert.equal(question.details.length, 2);
  assert.equal(question.source, 'GENERATION');
  assert.equal(question.targetId, source.operationId);
  assert.equal(question.options.length, 0, 'No business choices are invented');
  assert.equal(questionFor(source, question.details).questionId, question.questionId);
  assert.equal(questionFor(source, ['AI_PERMISSION_CHANGE']), null);
  assert.equal(questionFor(source, [{ issue: '¿Qué estados puede tener la reparación?', recommendation: 'Aprobar estados' }]).details[0], '¿Qué estados puede tener la reparación?');
  assert.equal(questionFor({ ...source, generationDecisions: [{ questionId: question.questionId }] }, question.details), null);
});

test('existing rejected-by-validation proposals show questions without new provider calls', async () => {
  const { spec, source, proposal } = fixture('questions-cache-' + Date.now());
  const catalog = { ...spec, roles: spec.security.roles, rules: spec.businessRules };
  store.saveOperationProposal(spec.project.id, source.operationId, { ...proposal, ambiguities: ['¿Cómo se adjuntan las fotos?'] }, store.operationDependencies(source, catalog));
  const pipeline = isolated('aiGenerationPipeline.js', { './aiOperationPlanner': { planOperationSteps() { throw new Error('MUST_NOT_CALL_PROVIDER'); } } });
  const result = await pipeline.planGeneration(spec.project.id, spec, { enableAI: true });
  assert.equal(result.tokensUsed, 0);
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].details[0], '¿Cómo se adjuntan las fotos?');
});

test('a new business ambiguity pauses before trying the next operation', async () => {
  const { spec, source } = fixture('questions-live-' + Date.now());
  spec.operations.push({ ...source, operationId: 'second' });
  let calls = 0;
  const pipeline = isolated('aiGenerationPipeline.js', { './aiOperationPlanner': { async planOperationSteps() {
    calls++;
    return { valid: false, proposal: { ambiguities: ['¿Qué resultado debe guardarse?'] }, providerMetadata: { mode: 'AI', outcome: 'SUCCEEDED', usage: { totalTokens: 21 } } };
  } } });
  const result = await pipeline.planGeneration(spec.project.id, spec, { enableAI: true });
  assert.equal(calls, 1);
  assert.equal(result.tokensUsed, 21);
  assert.equal(result.questions[0].targetId, source.operationId);
});

test('pure technical errors receive bounded retries and explicit blockers without invented questions', async () => {
  const { spec, proposal } = fixture('technical-blocker-' + Date.now());
  let calls = 0;
  const pipeline = isolated('aiGenerationPipeline.js', { './aiOperationPlanner': { async planOperationSteps() {
    calls++;
    return { valid: false, proposal: { ...proposal, transaction: false }, providerMetadata: { mode: 'AI', outcome: 'SUCCEEDED' } };
  } } });
  const result = await pipeline.planGeneration(spec.project.id, spec, { enableAI: true });
  assert.equal(calls, 3);
  assert.equal(result.questions, undefined);
  assert.equal(result.blockers[0].operationId, spec.operations[0].operationId);
});

test('job waits for all answers, validates question identity, and resumes generation directly', async () => {
  const { spec, source } = fixture();
  const questions = [questionFor(source, ['¿Qué datos recibe?']), questionFor({ ...source, operationId: 'second' }, ['¿Qué datos devuelve?'])];
  const scheduled = [], submissions = [];
  const service = isolated('codegenJob.service.js', {
    './projectSpecBuilder': { buildProjectSpec: async () => spec },
    './codegenAiRepair.service': { reviewProjectCoherence: async () => ({ coherent: true }) },
    './aiGenerationPipeline': { planGeneration: async () => ({ tokensUsed: 0, questions }) },
    './codeGenerator.service': { generateProjectFiles() { throw new Error('MUST_NOT_EXPORT_WITH_PENDING_QUESTIONS'); } },
    './codegenDecision.service': { submitDecision: async (_, input) => { submissions.push(input); return { decision: { label: input.customAnswer, data: input.data } }; } }
  }, scheduled);
  service.saveJob = job => service.memoryJobs.set(job.id, job);
  service.getActiveJob = () => null;
  const job = await service.startJob('questions-job', { enableAI: true });
  job.status = 'GENERATING'; service.queuedJobs.clear();
  await service.runPipeline(job.id);
  assert.equal(job.status, 'WAITING_FOR_INPUT');
  assert.equal(job.questions.length, 2);
  await assert.rejects(service.submitInput(job.id, { questionId: 'unknown', customAnswer: 'fake' }), /pregunta no pertenece/);
  await assert.rejects(service.submitInput(job.id, { questionId: questions[0].questionId, customAnswer: ' ' }), /Escribe tu respuesta/);
  await service.submitInput(job.id, { questionId: questions[0].questionId, customAnswer: 'Nombre obligatorio; fotos opcionales.', data: { targetId: 'forged' }, requirementIds: ['forged'] });
  assert.equal(job.status, 'WAITING_FOR_INPUT');
  assert.equal(submissions[0].data.targetId, source.operationId);
  assert.equal(JSON.stringify(submissions[0].requirementIds), JSON.stringify(source.requirementIds));
  await service.submitInput(job.id, { questionId: questions[1].questionId, customAnswer: 'Devolver el registro guardado.' });
  assert.equal(job.status, 'GENERATING');
  assert.equal(job.questions.length, 0);
  assert.equal(scheduled.length, 2, 'Only the last answer schedules generation');
});

test('saved answers survive reload, enter operation dependencies, and preserve approved permissions', async () => {
  const { spec, source } = fixture('answer-persistence-' + Date.now());
  const question = questionFor(source, ['¿Qué datos recibe?']);
  await decisions.submitDecision(spec.project.id, { questionId: question.questionId, customAnswer: 'Solo título obligatorio.', data: {
    source: 'GENERATION', targetKind: 'OPERATION', targetId: source.operationId, details: question.details
  } }, { requirements: [{ id: 'r1', description: 'Registrar un libro propio' }] });
  const originalHash = store.computeDependencyHash(source);
  attachDecisions(source, decisions.getProjectDecisions(spec.project.id));
  assert.equal(source.generationDecisions[0].answer, 'Solo título obligatorio.');
  assert.notEqual(store.computeDependencyHash(source), originalHash);
  assert.equal(questionFor(source, question.details), null);
  assert.deepEqual(source.authorizedRoles, ['Lector']);
  const unrelated = { operationId: 'unrelated' };
  attachDecisions(unrelated, decisions.getProjectDecisions(spec.project.id));
  assert.equal(unrelated.generationDecisions, undefined);
});

test('confirmed answers actually reach the operation planner prompt', async () => {
  const { spec, source, proposal } = fixture('answered-prompt-' + Date.now());
  source.generationDecisions = [{ questionId: 'q1', answer: 'Las fotografías son opcionales.', revision: 1 }];
  spec.confirmedDecisions = { globalPolicy: { customAnswer: 'Conservar el historial de cambios.', revision: 2 } };
  let received;
  const planner = isolated('aiOperationPlanner.js', {
    '../../config/env': { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'TEST_DOUBLE_ONLY' },
    '../ai/OpenAIProvider': class { async extractDocumentBatch(input) {
      received = input;
      return { data: proposal, model: 'TEST_DOUBLE', usage: {} };
    } }
  });
  await planner.planOperationSteps(spec.project.id, source, { ...spec, roles: spec.security.roles, rules: spec.businessRules });
  assert.equal(received.confirmedGenerationDecisions[0].answer, 'Las fotografías son opcionales.');
  assert.equal(received.operation.approvedContract.generationDecisions[0].questionId, 'q1');
  assert.equal(received.confirmedProjectDecisions.globalPolicy.customAnswer, 'Conservar el historial de cambios.');
});

test('screen ambiguity is shown as a screen question and the answer changes its dependency hash', async () => {
  const { spec, proposal, screen } = fixture('screen-question-' + Date.now());
  spec.operations = [proposal];
  const catalog = { ...spec, roles: spec.security.roles, rules: spec.businessRules };
  store.saveBindingProposal(spec.project.id, screen.id, { candidate: { ambiguities: ['¿Qué listado se muestra al guardar?'] } }, store.bindingDependencies(screen, catalog));
  const pipeline = isolated('aiGenerationPipeline.js', {});
  const result = await pipeline.planGeneration(spec.project.id, spec, { enableAI: true });
  assert.equal(result.questions[0].targetKind, 'SCREEN');
  const before = store.computeDependencyHash(store.bindingDependencies(screen, catalog));
  attachDecisions(screen, { answer: { questionId: result.questions[0].questionId, customAnswer: 'Mis libros registrados.', revision: 1, data: {
    source: 'GENERATION', targetKind: 'SCREEN', targetId: screen.id, details: result.questions[0].details
  } } }, 'SCREEN');
  assert.notEqual(store.computeDependencyHash(store.bindingDependencies(screen, catalog)), before);
});

test('a blocked job recovers cached object-shaped questions without scheduling a provider call', async () => {
  const { spec, source } = fixture();
  const question = questionFor(source, [{ issue: '¿Qué estados están permitidos?' }]);
  const scheduled = [];
  const service = isolated('codegenJob.service.js', {
    './projectSpecBuilder': { buildProjectSpec: async () => spec },
    './aiGenerationPipeline': { collectCachedQuestions: () => [question] }
  }, scheduled);
  service.saveJob = job => service.memoryJobs.set(job.id, job);
  const job = { id: 'job_cached_question', projectId: 'cached-question', status: 'BLOCKED', planningBlockers: [{ operationId: source.operationId }], logs: [] };
  service.saveJob(job);
  assert.equal((await service.resumeJob(job.id)).resumed, true);
  assert.equal(job.status, 'WAITING_FOR_INPUT');
  assert.equal(job.questions[0].details[0], '¿Qué estados están permitidos?');
  assert.equal(scheduled.length, 0);
});
