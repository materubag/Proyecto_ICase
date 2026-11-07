const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { computeDependencyHash } = require('../src/services/codegen/aiProposalStore');

function isolated(name, stubs) {
  const filename = path.resolve(__dirname, '../src/services/codegen', name);
  const actualRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, __dirname: path.dirname(filename),
    require: ref => Object.hasOwn(stubs, ref) ? stubs[ref] : actualRequire(ref),
    process, console
  }, { filename });
  return module.exports;
}

test('Dependency hash detects nested attribute and rule changes', () => {
  const base = { entities: [{ name: 'Libro', attrs: ['titulo'] }], rules: [{ value: 5 }] };
  assert.notEqual(computeDependencyHash(base), computeDependencyHash({ ...base, entities: [{ name: 'Libro', attrs: ['autor'] }] }));
  assert.notEqual(computeDependencyHash(base), computeDependencyHash({ ...base, rules: [{ value: 6 }] }));
});

test('Dependency hash ignores object property order and preserves array order', () => {
  assert.equal(computeDependencyHash({ nested: { a: 1, b: 2 } }), computeDependencyHash({ nested: { b: 2, a: 1 } }));
  assert.notEqual(computeDependencyHash({ steps: ['a', 'b'] }), computeDependencyHash({ steps: ['b', 'a'] }));
});

function decisionService(response, observe) {
  return isolated('codegenDecision.service.js', {
    '../../config/prisma': {},
    '../../config/env': { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'test-placeholder', OPENAI_MODEL: 'configured-test-model' },
    '../ai/OpenAIProvider': class { async extractDocumentBatch(input, options) { observe?.(input, options); return { data: response }; } }
  });
}

test('Ambiguity analysis accepts JSON object envelope and filters confirmed question IDs', async () => {
  const service = decisionService({ questions: [{ questionId: 'answered' }, { questionId: 'pending' }] });
  const result = await service.analyzeAmbiguitiesWithAI({ id: 'audit-test', requirements: [{ status: 'APPROVED' }] }, new Set(['answered']));
  assert.deepEqual(Array.from(result, q => q.questionId), ['pending']);
});

test('Ambiguity analysis keeps all approved requirements, rules, use cases and confirmed decisions', async () => {
  let captured, options;
  const service = decisionService({ questions: [] }, (input, opts) => { captured = input; options = opts; });
  service.getProjectDecisions = () => ({ taxPolicy: { data: { rounding: 'HALF_UP' } } });
  const requirements = Array.from({ length: 35 }, (_, i) => ({ id: String(i), status: 'APPROVED' }));
  await service.analyzeAmbiguitiesWithAI({ id: 'audit-test', requirements, businessRules: [{ id: 'rule' }], useCases: [{ id: 'case' }] });
  assert.equal(typeof captured, 'object');
  assert.equal(captured.requirements.length, 35);
  assert.equal(captured.businessRules[0].id, 'rule');
  assert.equal(captured.useCases[0].id, 'case');
  assert.equal(captured.confirmedDecisions.taxPolicy.data.rounding, 'HALF_UP');
  assert.equal(options.model, 'configured-test-model');
});

test('Ambiguity analysis retains compatibility with array responses', async () => {
  const service = decisionService([{ questionId: 'legacy' }]);
  const result = await service.analyzeAmbiguitiesWithAI({ id: 'audit-test', requirements: [{ status: 'APPROVED' }] });
  assert.equal(result[0].questionId, 'legacy');
});

test('Specification preserves approved business rules and excludes pending rules', async () => {
  const project = { id: 'library-test', name: 'Biblioteca', requirements: [], actors: [], useCases: [], entities: [], relationships: [], screens: [], navigationNodes: [], technologies: [], architectures: [], businessRules: [
    { id: 'approved', name: 'Limitar préstamos', description: 'Máximo cinco préstamos', status: 'APPROVED', requirementIds: ['rf1'], value: 5 },
    { id: 'pending', name: 'Pendiente', status: 'PENDING' }
  ] };
  const builder = isolated('projectSpecBuilder.js', { '../../config/prisma': {
    project: { findUnique: async () => project },
    artifact: { findFirst: async () => null, findMany: async () => [] }
  } });
  const spec = await builder.buildProjectSpec(project.id);
  assert.equal(spec.businessRules.length, 1);
  assert.equal(spec.businessRules[0].id, 'approved');
  assert.equal(spec.businessRules[0].value, 5);
  assert.equal(builder.verifySpecHash(spec), true);
});

test('generated input has no invented payload field; explicit input contracts remain intact', async () => {
  const explicit = { bodySchema: { type: 'object', properties: { title: { type: 'string', minLength: 2 } }, required: ['title'], additionalProperties: false } };
  const project = { id: 'input-template-test', name: 'Biblioteca', requirements: [], actors: [], entities: [], relationships: [], screens: [], navigationNodes: [], technologies: [], architectures: [], businessRules: [], useCases: [
    { id: 'inferred', codeId: 'UC-01', name: 'Registrar libro', status: 'APPROVED', requirementIds: [], steps: [] },
    { id: 'explicit', codeId: 'UC-02', name: 'Consultar libro', status: 'APPROVED', requirementIds: [], steps: [], evidence: { executionContract: { input: explicit } } }
  ] };
  const builder = isolated('projectSpecBuilder.js', { '../../config/prisma': {
    project: { findUnique: async () => project }, artifact: { findFirst: async () => null, findMany: async () => [] }
  } });
  const spec = await builder.buildProjectSpec(project.id);
  assert.equal(Object.keys(spec.operations.find(op => op.operationId === 'UC-01').input.bodySchema.properties).length, 0);
  assert.equal(JSON.stringify(spec.operations.find(op => op.operationId === 'UC-02').input), JSON.stringify(explicit));
});
