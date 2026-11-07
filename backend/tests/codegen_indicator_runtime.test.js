const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Op } = require('sequelize');
const runtime = require('../src/services/codegen/operationRuntime');
const { executionProblems } = require('../src/services/codegen/executableContract');
const { applyCommandScreens, decisionHash } = require('../src/services/codegen/commandContracts');

test('low stock compares real columns and rejects unknown or ambiguous column filters', async () => {
  const contract = { bindingVersion: 2, authorizedRoles: ['Administrador'], steps: [{ id: 'stock', action: 'QUERY', entity: 'PRODUCTO', filters: [{ field: 'stock', operator: 'lte', valueField: 'stockMinimo' }] }], resultStep: 'stock' };
  const entities = [{ modelName: 'PRODUCTO', attributes: ['stock', 'stockMinimo'].map(fieldName => ({ fieldName })) }];
  assert.deepEqual(executionProblems(contract, entities), []);
  const model = { rawAttributes: { stock: { field: 'stock' }, stockMinimo: { field: 'stock_minimo' } }, findAll: async ({ where }) => {
    assert.equal(where[Op.and][0].stock[Op.lte].col, 'stock_minimo');
    return [{ stock: 2, stockMinimo: 2 }];
  } };
  assert.equal((await runtime.executeSteps({ PRODUCTO: model }, contract, {}, { role: 'Administrador' }, {})).length, 1);
  const invalid = structuredClone(contract);
  invalid.steps[0].filters[0].valueField = 'missing';
  assert(executionProblems(invalid, entities).length > 0);
  await assert.rejects(runtime.executeSteps({ PRODUCTO: model }, invalid, {}, { role: 'Administrador' }, {}), /Columna/);
  invalid.steps[0].filters[0] = { field: 'stock', operator: 'lte', valueField: 'stockMinimo', value: 10 };
  assert(executionProblems(invalid, entities).length > 0);
});

test('conditional alert creation skips ineligible cycles and continues the loop', async () => {
  const writes = [];
  const contract = { bindingVersion: 2, authorizedRoles: ['Administrador'], input: { bodySchema: { properties: { cycles: {} } } }, steps: [{ id: 'cycles', action: 'FOR_EACH', collection: { $ref: 'payload.cycles' }, steps: [{ id: 'alert', action: 'CREATE', entity: 'ALERTA', when: { operator: 'or', conditions: [{ operator: 'lte', left: { $ref: 'item.days' }, right: 7 }, { operator: 'lte', left: { $ref: 'item.km' }, right: 500 }] }, fields: { cicloId: { $ref: 'item.id' } } }] }], resultStep: 'cycles' };
  assert.deepEqual(executionProblems(contract, [{ modelName: 'ALERTA', attributes: [{ fieldName: 'cicloId' }] }]), []);
  await runtime.executeSteps({ ALERTA: { create: async fields => { writes.push(fields.cicloId); return fields; } } }, contract, { cycles: [{ id: 1, days: 8, km: 501 }, { id: 2, days: 7, km: 900 }, { id: 3, days: 90, km: 500 }, { id: 4, days: -1, km: 900 }] }, { role: 'Administrador' }, {});
  assert.deepEqual(writes, [2, 3, 4]);
});

test('counts and grouping preserve null groups and cannot use prototype properties as fields', () => {
  const rows = [{ estado: 'ABIERTA' }, { estado: 'ABIERTA' }, { estado: null }, { estado: '__proto__' }];
  assert.equal(runtime.resolve({ $op: 'count', items: [] }, {}), 0);
  assert.equal(runtime.resolve({ $op: 'count', items: rows }, {}), 4);
  assert.deepEqual(runtime.resolve({ $op: 'group_count', items: rows, field: 'estado' }, {}), [{ estado: 'ABIERTA', count: 2 }, { estado: '__proto__', count: 1 }, { estado: null, count: 1 }]);
  assert.throws(() => runtime.resolve({ $op: 'group_count', items: rows, field: '__proto__' }, {}), /agrupación/);
  assert.throws(() => runtime.resolve({ $op: 'count', items: {} }, {}), /conteo/);
});

test('local date bounds become UTC instants and invalid calendar dates or zones reject with 400', () => {
  const convert = (date, timeZone = 'America/Guayaquil') => runtime.resolve({ $op: 'date_start', date, timeZone }, {});
  assert.equal(convert('2035-01-02'), '2035-01-02T05:00:00.000Z');
  assert.equal(convert('2024-02-29'), '2024-02-29T05:00:00.000Z');
  for (const date of ['2035-02-30', '2035-13-01', 'not-a-date', '2035-01-02T00:00Z']) assert.throws(() => convert(date), error => error.statusCode === 400);
  assert.throws(() => convert('2035-01-02', 'Invalid/Zone'), error => error.statusCode === 400);
});

test('query bounds use Sequelize operators and RETURN composes independent results without writes', async () => {
  const contract = { bindingVersion: 2, authorizedRoles: ['Administrador'], input: { bodySchema: { type: 'object', properties: {} } }, steps: [
    { id: 'sales', action: 'QUERY', entity: 'VENTA', where: { estado: 'CONFIRMADA' }, filters: [{ field: 'fechaVenta', operator: 'gte', value: '2035-01-02T05:00:00.000Z' }, { field: 'fechaVenta', operator: 'lt', value: '2035-01-03T05:00:00.000Z' }] },
    { id: 'total', action: 'CALCULATION', expression: { $op: 'sum', items: { $ref: 'steps.sales' }, field: 'total', scale: 2 } },
    { id: 'response', action: 'RETURN', value: { total: { $ref: 'steps.total' }, count: { $op: 'count', items: { $ref: 'steps.sales' } } } }
  ], resultStep: 'response' };
  const entities = [{ modelName: 'VENTA', attributes: ['id', 'estado', 'fechaVenta', 'total'].map(fieldName => ({ fieldName })) }];
  assert.deepEqual(executionProblems(contract, entities), []);
  const result = await runtime.executeSteps({ VENTA: { findAll: async options => {
    assert.equal(options.where.estado, 'CONFIRMADA');
    assert.equal(options.where[Op.and][0].fechaVenta[Op.gte], '2035-01-02T05:00:00.000Z');
    assert.equal(options.where[Op.and][1].fechaVenta[Op.lt], '2035-01-03T05:00:00.000Z');
    return [{ total: '0.10' }, { total: '0.20' }];
  } } }, contract, {}, { role: 'Administrador' }, {});
  assert.deepEqual(result, { total: '0.30', count: 2 });
  const invalid = structuredClone(contract);
  invalid.steps[0].filters[0].field = 'missing';
  assert(executionProblems(invalid, entities).some(message => message.includes('campo missing')));
  invalid.steps[0].filters[0].operator = 'raw-sql';
  assert(executionProblems(invalid, entities).some(message => message.includes('filtro declarativo')));
  await assert.rejects(runtime.executeSteps({}, contract, {}, { role: 'Cliente' }, {}), error => error.statusCode === 403);
});

test('the approved dashboard adds a separate screen and cannot expand its operation permissions', () => {
  const document = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/specifications/projects/6ba45264-e3e6-4819-a0dd-18909f1fb674.commands.json')));
  const declaration = structuredClone(document.screenDefinitions[0]);
  const decision = { questionId: declaration.decisionQuestionId, customAnswer: declaration.approvalEvidence, revision: 1 };
  declaration.decisionHash = decisionHash(decision);
  const group = document.groups.find(g => g.parentOperationId === 'UC-04');
  const operation = { ...group.commands[0], approval: { questionId: decision.questionId } };
  const screens = [{ id: 'reports', route: '/reportes' }];
  applyCommandScreens([declaration], screens, [operation], { [decision.questionId]: decision });
  assert.equal(screens[0].route, '/reportes');
  assert.equal(screens[1].route, '/indicadores');
  assert.equal(screens[1].contract.dashboard.panels.length, 7);
  const invalid = structuredClone(declaration);
  invalid.screen.roles.push('Cliente');
  assert.throws(() => applyCommandScreens([invalid], [], [operation], { [decision.questionId]: decision }), /UNAPPROVED_COMMAND_SCREEN/);
  assert.throws(() => applyCommandScreens([declaration], [], [operation], { [decision.questionId]: { ...decision, revision: 2 } }), /UNAPPROVED_COMMAND_SCREEN/);
});

test('resume removes only generation questions replaced by reviewed commands and preserves other pending questions', async () => {
  const filename = path.resolve(__dirname, '../src/services/codegen/codegenJob.service.js');
  const module = { exports: {} }, actual = require('node:module').createRequire(filename), queued = [];
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, process, console, Buffer, __dirname: path.dirname(filename), setImmediate: callback => queued.push(callback),
    require: key => key === './projectSpecBuilder' ? { buildProjectSpec: async () => ({ commandGroups: [{ parentOperationId: 'UC-04' }], operations: [{ operationId: 'UC-04-indicators' }] }) } : actual(key)
  });
  const service = module.exports;
  service.saveJob = job => service.memoryJobs.set(job.id, job);
  const oldQuestion = { source: 'GENERATION', targetKind: 'OPERATION', targetId: 'UC-04' };
  const job = { id: 'reviewed-questions', projectId: 'reviewed', status: 'WAITING_FOR_INPUT', questions: [oldQuestion], clarificationResumeStage: 'GENERATING', logs: [], zipSha256: 'stale', bundleManifest: {} };
  service.saveJob(job);
  assert.equal((await service.resumeJob(job.id)).resumed, true);
  assert.equal(job.status, 'GENERATING'); assert.equal(job.questions.length, 0); assert.equal(job.zipSha256, null);
  const pending = { ...job, id: 'keep-other-question', status: 'WAITING_FOR_INPUT', questions: [oldQuestion, { ...oldQuestion, targetId: 'UC-05' }] };
  service.saveJob(pending);
  assert.equal((await service.resumeJob(pending.id)).resumed, false);
  assert.equal(pending.status, 'WAITING_FOR_INPUT'); assert.equal(pending.questions.length, 1); assert.equal(pending.questions[0].targetId, 'UC-05');
});
