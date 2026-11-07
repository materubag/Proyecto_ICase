const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve, validateInput, executeSteps } = require('../src/services/codegen/operationRuntime');
const { generateOperationRoutesFile } = require('../src/services/codegen/operationGenerator');
const codegen = require('../src/services/codegen/codeGenerator.service');

test('Structured references use payload, authenticated user and prior step results without evaluating code', async () => {
  const saved = [];
  const model = { create: async (data, options) => { assert.equal(options.transaction, 'tx'); const row = { id: saved.length + 1, ...data }; saved.push(row); return row; } };
  const contract = { input: { bodySchema: { type: 'object', properties: { label: { type: 'string' } }, required: ['label'], additionalProperties: false } }, resultStep: 'parent', steps: [
    { id: 'parent', entity: 'Item', action: 'CREATE', fields: { label: { $ref: 'payload.label' }, ownerId: { $ref: 'user.id' } } },
    { id: 'children', entity: 'Item', action: 'CREATE', forEach: [{ title: 'first' }, { title: 'second' }], fields: { parentId: { $ref: 'steps.parent.id' }, label: { $ref: 'item.title' } } }
  ] };
  const result = await executeSteps({ Item: model }, contract, { label: 'real input' }, { id: 77 }, 'tx');
  assert.equal(result.id, 1);
  assert.equal(saved[0].ownerId, 77);
  assert.equal(saved[2].parentId, 1);
  assert.equal(saved[2].label, 'second');
  assert.throws(() => resolve({ $ref: 'payload.constructor.prototype' }, { payload: {} }), /inválida/);
  assert.throws(() => resolve({ $ref: 'process.env' }, {}), /inválida/);
});

test('Schema validates required zero, numeric types, range and rejects forged automatic fields', () => {
  const schema = { type: 'object', required: ['fuel'], additionalProperties: false, properties: { fuel: { type: 'number', minimum: 0, maximum: 1 } } };
  assert.doesNotThrow(() => validateInput({ fuel: 0 }, schema));
  assert.throws(() => validateInput({ fuel: 1.2 }, schema));
  assert.throws(() => validateInput({ fuel: '0' }, schema));
  assert.throws(() => validateInput({ fuel: 0, ownerId: 999 }, schema), /no permitido/);
});

test('Mutation routes have no GET alias and deny unspecified authenticated permissions', () => {
  const code = generateOperationRoutesFile([{ operationId: 'create', name: 'Create', method: 'POST', route: '/api/operations/create', authorizedRoles: [] }], { authType: 'JWT' });
  assert.ok(code.includes("router.post('/create'"));
  assert.ok(!code.includes("router.get('/create'"));
  assert.ok(code.includes('UNRESOLVED_PERMISSION'));
});

test('Review export never enables normal export or removes blockers', async () => {
  const spec = { schemaVersion: '1.0.0', project: { id: 'review', name: 'Review' }, security: { authType: 'NONE', roles: [] }, requirements: [], actors: [], relationships: [], screens: [], entities: [
    { id: 'item', name: 'Item', modelName: 'Item', endpoint: 'items', tableName: 'items', primaryKey: { fieldName: 'id', type: 'INTEGER' }, attributes: [{ fieldName: 'id', type: 'INTEGER', isPk: true, autoIncrement: true, allowNull: false }] }
  ], operations: [{ operationId: 'pending', name: 'Pending', type: 'BUSINESS_LOGIC', method: 'POST', route: '/api/operations/pending', authorizedRoles: [], input: { params: [], query: [] }, output: { successStatus: 200 } }] };
  const blocked = await codegen.generateProjectFiles(null, { spec });
  assert.equal(blocked.ready, false);
  assert.equal(blocked.files.length, 0);
  const review = await codegen.generateProjectFiles(null, { spec, reviewOnly: true });
  assert.equal(review.ready, false);
  assert.equal(review.diagnostics.ready, false);
  assert.ok(review.files.find(file => file.path === 'REVIEW_STATUS.json'));
  assert.ok(review.files.find(file => file.path.endsWith('operation.service.js')).content.includes('501'));
  await assert.rejects(codegen.generateZipArchive(null, { spec }), { code: 'SPEC_VALIDATION_FAILED' });
});
