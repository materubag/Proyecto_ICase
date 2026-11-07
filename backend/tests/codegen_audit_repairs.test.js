const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const { createRequire } = require('module');
const { validateInput, evaluatePredicate } = require('../src/services/codegen/operationRuntime');
const { executionProblems } = require('../src/services/codegen/executableContract');
const { scopeFor, inputFor } = require('../src/services/codegen/crudRuntime');
const integrity = require('../src/services/codegen/exportIntegrity');

function isolated(name, stubs, globals = {}) {
  const filename = path.resolve(__dirname, '../src/services', name), module = { exports: {} }, actual = createRequire(filename);
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports, process, console, __dirname: path.dirname(filename),
    require: key => Object.hasOwn(stubs, key) ? stubs[key] : actual(key), ...globals }, { filename });
  return module.exports;
}

test('Analysis failures and missing provider never become NO_PENDING_DECISIONS; intake does not skip other scopes', async () => {
  const unavailable = isolated('codegen/codegenDecision.service.js', { '../../config/prisma': {}, '../../config/env': { AI_PROVIDER: 'mock' } });
  assert.equal((await unavailable.getPendingDecisions('missing')).analysis.status, 'ANALYSIS_FAILED');
  const project = { id: 'decision-audit', name: 'Autron5', requirements: [{ status: 'APPROVED' }], entities: [] };
  assert.equal((await unavailable.getPendingDecisions(project.id, { project })).analysis.status, 'NOT_ANALYZED');
  let calls = 0;
  const failed = isolated('codegen/codegenDecision.service.js', { '../../config/prisma': {}, '../../config/env': { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'dummy' },
    '../ai/OpenAIProvider': class { async extractDocumentBatch() { calls++; throw new Error('provider failed'); } } });
  assert.equal((await failed.getPendingDecisions(project.id, { project })).analysis.status, 'ANALYSIS_FAILED');
  assert.equal(calls, 1, 'Manifest for reception cannot skip global analysis');
});

test('CRUD validation preserves explicit null/empty and rejects unknown keys and incorrect types (model doubles)', async () => {
  const schema = { type: 'object', additionalProperties: false, properties: { name: { type: 'string', nullable: true }, count: { type: 'integer' } } };
  const scope = { where: {}, immutableFields: [] };
  assert.deepEqual(inputFor({ name: '' }, schema, scope, true), { name: '' });
  assert.deepEqual(inputFor({ name: null }, schema, scope, true), { name: null });
  assert.throws(() => inputFor({}, schema, scope, false), { code: 'EMPTY_INPUT' });
  assert.throws(() => inputFor({ ownerId: 2 }, schema, scope, false), { code: 'UNKNOWN_INPUT' });
  assert.throws(() => validateInput({ count: '2' }, schema), { code: 'INVALID_INPUT' });
  assert.throws(() => validateInput('bad', { type: 'string', format: 'uuid' }), { code: 'INVALID_INPUT' });
  const contracts = { recordScope: [{ roles: ['Reader'], lookups: [{ id: 'owner', entity: 'Account', where: { userId: { $ref: 'user.id' } } }], where: { accountId: { $ref: 'steps.owner.id' } }, immutableFields: ['accountId'] }] };
  const models = { Account: { findAll: async ({ where }) => where.userId === 9 ? [{ id: 10 }] : [] } };
  const owner = await scopeFor(models, contracts, { id: 9, role: 'Reader' });
  assert.deepEqual(owner.where, { accountId: 10 });
  assert.throws(() => inputFor({ accountId: 99 }, { type: 'object' }, owner, true), { code: 'IMMUTABLE_OWNER' });
  await assert.rejects(() => scopeFor(models, contracts, { id: 999, role: 'Reader' }), { code: 'FORBIDDEN_RECORD' });
});

test('Narrative expressions and destructive alternatives cannot execute as generated JavaScript', () => {
  const entities = [{ name: 'Note', attributes: [{ fieldName: 'text' }] }];
  assert.ok(executionProblems({ steps: [{ action: 'VALIDATION', condition: 'process.exit()' }] }, entities).length);
  assert.ok(executionProblems({ steps: [{ action: 'CALCULATION', formula: 'payload.total * .15' }] }, entities).length);
  assert.ok(executionProblems({ steps: [{ action: 'CREATE', entity: 'Note', fields: { text: 'x' } }, { action: 'DELETE', entity: 'Note' }] }, entities).some(p => p.includes('alternativos')));
  assert.equal(evaluatePredicate({ left: { $ref: 'payload.count' }, operator: 'gte', right: 0 }, { payload: { count: 0 } }), true);
  assert.throws(() => evaluatePredicate('payload.count >= 0', {}), { code: 'INVALID_CONTRACT' });
});

test('ZIP manifest verifies exact bytes, detects tampering and rejects duplicate/traversal names', () => {
  const files = [{ path: 'backend/app.js', content: Buffer.from('tested') }, { path: 'frontend/app.jsx', content: Buffer.from('tested UI') }];
  const sealed = integrity.bundleVerifiedFiles(files, { tested: true });
  const entries = integrity.readZip(sealed.buffer);
  assert.equal(entries.length, 3);
  assert.equal(integrity.fingerprint(entries.filter(e => e.path !== 'BUNDLE_MANIFEST.json')), sealed.manifest.payloadHash);
  assert.notEqual(integrity.fingerprint([{ ...files[0], content: Buffer.from('changed') }, files[1]]), sealed.manifest.payloadHash);
  assert.throws(() => integrity.bundleVerifiedFiles([{ path: '../escape', content: Buffer.from('bad') }]));
  assert.throws(() => integrity.bundleVerifiedFiles([files[0], files[0]]));
});

test('Multiple explicit controls bind by source index without deleting mockup header or panels', () => {
  const { convertHtmlToJsx } = require('../src/services/codegen/mockupConverter');
  const jsx = convertHtmlToJsx('<html><body><header>Full header</header><aside>Full panel</aside><button>Zero</button><button>Half</button><button>Save</button></body></html>', 'Audit', '/', '', { screenContract: {
    renderer: 'task', fields: [{ fieldName: 'fuel', mode: 'editable' }], actions: [{ actionId: 'save', name: 'Save', method: 'POST' }],
    controlBindings: { button: [{ index: 0, field: 'fuel', value: 0 }, { index: 1, field: 'fuel', value: .5 }, { index: 2, actionId: 'save' }] }
  } });
  assert.match(jsx, /<header>Full header<\/header>/);
  assert.match(jsx, /<aside>Full panel<\/aside>/);
  assert.ok(jsx.includes('slots.setField("fuel", 0)'));
  assert.ok(jsx.includes('slots.setField("fuel", 0.5)'));
  assert.ok(jsx.includes('slots.execute("save")'));
});

test('Explicit process data sources exclude unrelated CRUD and preserve relation PK/endpoint when overriding labels', () => {
  const { buildScreenContract } = require('../src/services/codegen/screenContract');
  const entities = [{ id: 'order', name: 'Order', modelName: 'Order', attributes: [{ name: 'vehicleId', type: 'INTEGER' }] },
    { id: 'vehicle', name: 'Vehicle', modelName: 'Vehicle', attributes: [{ name: 'id', type: 'INTEGER', isPk: true }, { name: 'plate', type: 'STRING' }] }];
  const operations = [{ operationId: 'all-orders', entity: 'Order', method: 'GET', route: '/api/orders' }, { operationId: 'own-progress', method: 'POST', route: '/api/operations/progress', authorizedRoles: ['Reader'] }];
  const contract = buildScreenContract({ name: 'Progress', contract: { entityId: 'order', fields: [{ fieldName: 'vehicleId', relation: { dataSource: 'vehicles', labelField: 'plate' } }], actions: [{ actionId: 'progress', operationId: 'own-progress' }], dataSources: [{ name: 'vehicles', route: '/api/vehicles' }], listSource: null } }, { entities, operations, relationships: [], screens: [] });
  assert.equal(contract.fields.find(f => f.fieldName === 'vehicleId').relation.valueField, 'id');
  assert.equal(contract.fields.find(f => f.fieldName === 'vehicleId').relation.endpoint, '/api/vehicles');
  assert.equal(contract.listSource, null);
  assert.equal(contract.dataSources.some(s => s.route === '/api/orders'), false);
  assert.equal(contract.actions.some(a => a.operationId === 'all-orders'), false);
  assert.deepEqual(contract.unresolved, []);
});

test('Simulated AI over local HTTP receives all rules; reviewed response executes from clean exported code; nested changes invalidate it', async t => {
  let captured;
  const entity = { id: 'note', name: 'Note', modelName: 'Note', tableName: 'notes', endpoint: 'notes', primaryKey: { fieldName: 'id', autoIncrement: true, type: 'INTEGER' }, attributes: [{ fieldName: 'id', type: 'INTEGER', isPk: true }, { fieldName: 'text', type: 'STRING' }] };
  const operation = { operationId: 'audit-create', name: 'Save note', type: 'BUSINESS_LOGIC', route: '/api/operations/note', method: 'POST', targetEntity: 'Note', authorizedRoles: ['Writer'], steps: [], output: { successStatus: 201 } };
  const proposal = { ...operation, bindingVersion: 2, input: { bodySchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false } },
    steps: [{ id: 'created', action: 'CREATE', entity: 'Note', fields: { text: 'SIMULATED_REVIEWED_RULE' } }], resultStep: 'created', unresolved: [] };
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    captured = JSON.parse(body);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(proposal) } }], usage: { total_tokens: 17 } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const env = { AI_PROVIDER: 'openai', OPENAI_API_KEY: 'local-simulated-key', OPENAI_MODEL: 'local-simulated-model' };
  const Provider = isolated('ai/OpenAIProvider.js', { '../../config/env': env }, { AbortSignal, fetch: (_url, options) => fetch('http://127.0.0.1:' + server.address().port, options) });
  const planner = isolated('codegen/aiOperationPlanner.js', { '../../config/env': env, '../ai/OpenAIProvider': Provider });
  const catalog = { entities: [entity], roles: ['Writer'], rules: [{ id: 'rule-last', name: 'Approved marker', evidence: { approved: true }, value: 7 }], requirements: Array.from({ length: 35 }, (_, i) => ({ id: String(i), description: 'Requirement ' + i })) };
  operation.requirementIds = catalog.requirements.map(r => r.id);
  const id = 'audit-http-' + Date.now();
  const result = await planner.planOperationSteps(id, operation, catalog, { skipLiveAi: false });
  assert.equal(result.valid, true, result.validationErrors.join(';'));
  const input = JSON.parse(captured.messages[1].content);
  assert.equal(input.relatedRequirements.length, 35);
  assert.equal(input.approvedBusinessRules[0].evidence.approved, true);
  assert.equal(captured.model, 'local-simulated-model');
  const store = require('../src/services/codegen/aiProposalStore');
  assert.equal(store.getProposals(id).operations[operation.operationId].providerMetadata.provider, 'openai');
  store.reviewProposal(id, result.proposalId, { status: 'APPROVED' });
  const spec = { project: { id, name: 'Audit notes' }, entities: [entity], relationships: [], screens: [], operations: [operation], requirements: catalog.requirements, businessRules: catalog.rules, security: { roles: catalog.roles } };
  const applied = store.applyApprovedProposals(id, spec);
  assert.equal(applied.appliedCount, 1);
  const { generateOperationServiceFile } = require('../src/services/codegen/operationGenerator');
  const code = generateOperationServiceFile(applied.spec.operations, [entity]);
  assert.match(code, /SIMULATED_REVIEWED_RULE/);
  const exported = await require('../src/services/codegen/codeGenerator.service').generateProjectFiles(id, { spec, reviewOnly: true });
  assert.ok(exported.files.length, JSON.stringify(exported.diagnostics?.errors));
  assert.equal(exported.files.find(f => f.path === 'backend/src/services/operation.service.js').content, code, 'The full exporter applies the same approved response');
  const written = [];
  const transaction = { commit: async () => {}, rollback: async () => {} };
  const models = { sequelize: { transaction: async () => transaction }, Note: { create: async fields => { written.push(fields); return { id: 1, ...fields }; } } };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, console, require: key => key === '../models' ? models : require('../src/services/codegen/operationRuntime') });
  await Object.values(module.exports)[0]({ text: 'caller value' }, { id: 1, role: 'Writer' });
  assert.equal(written[0].text, 'SIMULATED_REVIEWED_RULE', 'Applied response changes executed export, not only preview');
  assert.equal(generateOperationServiceFile(store.applyApprovedProposals(id, spec).spec.operations, [entity]), code, 'Clean regeneration retains reviewed proposal');
  const changed = JSON.parse(JSON.stringify(spec)); changed.businessRules[0].value = 8;
  assert.equal(store.applyApprovedProposals(id, changed).appliedCount, 0);
  assert.equal(store.getProposals(id).operations[operation.operationId].status, 'INVALIDATED');
});
