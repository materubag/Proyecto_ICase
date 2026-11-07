const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { applyCommandContracts, decisionHash } = require('../src/services/codegen/commandContracts');
const runtime = require('../src/services/codegen/operationRuntime');
const { generateOperationServiceFile } = require('../src/services/codegen/operationGenerator');
const { generateOperationRoutesFile } = require('../src/services/codegen/operationGenerator');
const { generateModelFile } = require('../src/services/codegen/modelGenerator');
const { generateEntityRoutesFile } = require('../src/services/codegen/routeGenerator');
const { executionProblems } = require('../src/services/codegen/executableContract');
const documentPath = path.resolve(__dirname, '../src/specifications/projects/6ba45264-e3e6-4819-a0dd-18909f1fb674.commands.json');

function compiled() {
  const document = JSON.parse(fs.readFileSync(documentPath));
  const group = document.groups[0];
  document.groups = [group];
  document.policyApprovals = [{ questionId: 'uc01TaxPolicy' }];
  document.aliases = [];
  document.entityFields = document.entityFields.filter(change => change.attribute.fieldName !== 'claveOperacion');
  const decision = { questionId: group.decisionQuestionId, revision: 1,
    customAnswer: group.commands.map(c => c.roleEvidence).filter(Boolean).join('\n'), data: { targetId: 'UC-01' } };
  group.decisionHash = decisionHash(decision);
  const tax = { questionId: 'uc01TaxPolicy', customAnswer: 'IVA 15 % para ítems configurados como gravados.', revision: 1 };
  document.policyApprovals[0].hash = decisionHash(tax);
  const decisions = { [decision.questionId]: decision, uc01TaxPolicy: tax };
  const requirementIds = [...new Set(group.commands.flatMap(c => c.requirementIds))];
  const roles = [...new Set(group.commands.flatMap(c => c.authorizedRoles))];
  const operations = [{ operationId: 'UC-01', name: 'Gestión comercial', requirementIds }];
  for (const command of group.commands.filter(c => c.permissionSourceOperationId)) operations.push({ operationId: command.permissionSourceOperationId, authorizedRoles: command.authorizedRoles });
  const fields = new Map();
  const visit = steps => { for (const step of steps || []) {
    if (step.entity) {
      const found = fields.get(step.entity) || new Set(['id']);
      for (const key of [...Object.keys(step.fields || {}), ...Object.keys(step.where || {})]) found.add(key);
      fields.set(step.entity, found);
    }
    visit(step.steps);
  } };
  group.commands.forEach(command => visit(command.steps));
  fields.set('AUDITORIA', new Set(['id', 'usuarioId', 'entidad', 'entidadId', 'operacion', 'detalle', 'fechaEvento']));
  document.entities = document.entities.filter(entity => fields.has(entity.modelName));
  document.entityFields = document.entityFields.filter(change => fields.has(change.entity));
  document.entityIndexes = (document.entityIndexes || []).filter(index => fields.has(index.entity));
  const entities = [...fields].filter(([modelName]) => !document.entities?.some(entity => entity.modelName === modelName)).map(([modelName, names]) => ({ name: modelName, modelName, primaryKey: { fieldName: 'id' }, attributes: [...names].map(fieldName => ({ fieldName, isPk: fieldName === 'id', autoIncrement: fieldName === 'id', allowNull: true })) }));
  const result = applyCommandContracts(document.projectId, operations, entities, requirementIds.map(id => ({ id })), roles, decisions, document);
  return { document, operations, entities, roles, decisions, result };
}

function environment(commands) {
  const models = {};
  for (const name of ['VENTA', 'VENTADETALLE', 'PRODUCTO', 'MOVIMIENTOINVENTARIO', 'COTIZACION', 'COTIZACIONITEM', 'SERVICIO', 'DIAGNOSTICO', 'AUDITORIA']) {
    const model = { rows: [] };
    const wrap = fields => {
      const row = { ...fields };
      Object.defineProperty(row, 'update', { enumerable: false, value: async changes => { Object.assign(row, changes); if (row.stock != null) row.stock = Number(row.stock); return row; } });
      return row;
    };
    model.create = async fields => { const row = wrap({ id: model.rows.length + 1, ...fields }); model.rows.push(row); return row; };
    model.findAll = async ({ where }) => model.rows.filter(row => Object.entries(where).every(([key, value]) => row[key] === value));
    model.findOne = async options => (await model.findAll(options))[0];
    model.restore = rows => { model.rows = rows.map(wrap); };
    models[name] = model;
  }
  models.sequelize = { transaction: async () => {
    const snapshot = Object.fromEntries(Object.entries(models).filter(([, model]) => model.rows).map(([name, model]) => [name, JSON.parse(JSON.stringify(model.rows))]));
    return { LOCK: { UPDATE: 'UPDATE' }, commit: async () => {}, rollback: async () => { for (const [name, rows] of Object.entries(snapshot)) models[name].restore(rows); } };
  } };
  const module = { exports: {} };
  vm.runInNewContext(generateOperationServiceFile(commands, compiled().entities, { reviewOnly: true }), {
    module, Date, Object, require: name => name === '../models' ? models : runtime
  });
  return { models, service: module.exports };
}

test('reviewed commands replace the ambiguous parent with exact role and decision provenance', () => {
  const { operations, entities, result } = compiled();
  assert(!operations.some(op => op.operationId === 'UC-01'));
  assert.equal(result.groups[0].commandIds.length, 8);
  assert(result.groups[0].commandIds.includes('UC-01-enviar-cotizacion'));
  for (const command of operations.filter(op => op.parentOperationId)) {
    assert.deepEqual(executionProblems(command, entities), []);
    assert.equal(command.permissionSource, command.invocation === 'SYSTEM' ? 'SYSTEM_DECISION' : 'CONFIRMED_DECISION');
    assert(command.approval.questionId);
  }
  assert.equal(result.blockers.length, 0);
});

test('stale approval or permission expansion cannot replace the parent', () => {
  const { document, operations, entities, roles, decisions } = compiled();
  decisions[document.groups[0].decisionQuestionId].revision++;
  const original = [{ operationId: 'UC-01', requirementIds: document.groups[0].commands.flatMap(c => c.requirementIds) }];
  assert.throws(() => applyCommandContracts(document.projectId, original, entities, [], roles, decisions, document), /STALE_COMMAND_APPROVAL/);
  assert.equal(original[0].operationId, 'UC-01');
  assert.equal(operations.filter(op => op.parentOperationId).length, 8);
});

test('decimal operations round half away from zero and never evaluate executable text', () => {
  const expression = ($op, args, scale = 2) => ({ $op, args, scale });
  assert.equal(runtime.resolve(expression('multiply', ['0.1', 3]), {}), '0.30');
  assert.equal(runtime.resolve(expression('multiply', ['0.30', '0.15']), {}), '0.05');
  assert.equal(runtime.resolve(expression('add', ['-1.005']), {}), '-1.01');
  assert.equal(runtime.resolve(expression('divide', [1, 3]), {}), '0.33');
  assert.throws(() => runtime.resolve(expression('divide', [1, 0]), {}), /cero/);
  assert.throws(() => runtime.resolve(expression('eval', ['process.exit()']), {}));
  assert.throws(() => runtime.resolve(expression('add', ['process.env.SECRET']), {}));
  assert.equal(runtime.resolve({ $op: 'date_add_days', date: '2026-02-27', days: 3 }, {}), '2026-03-02T00:00:00.000Z');
});

test('generated sale service uses catalog prices, computes IVA, and confirms exactly once', async () => {
  const commands = compiled().operations.filter(op => op.parentOperationId);
  const { models, service } = environment(commands);
  await models.PRODUCTO.create({ precio: '0.10', stock: 10, tratamientoImpuesto: 'GRAVADO' });
  const created = await service.crearVentaDirectaDeRepuestos({ clienteId: 1, items: [{ repuestoId: 1, cantidad: 3 }] }, { id: 9, role: 'Recepción' });
  assert.equal(created.data.subtotal, '0.30');
  assert.equal(created.data.impuestos, '0.05');
  assert.equal(created.data.total, '0.35');
  assert.equal(models.PRODUCTO.rows[0].stock, 10);
  await service.confirmarVentaDirecta({ ventaId: created.data.id }, { id: 9, role: 'Recepción' });
  await service.confirmarVentaDirecta({ ventaId: created.data.id }, { id: 9, role: 'Recepción' });
  assert.equal(models.PRODUCTO.rows[0].stock, 7);
  assert.equal(models.MOVIMIENTOINVENTARIO.rows.length, 1);
  assert.equal(models.VENTA.rows[0].estado, 'CONFIRMADA');
});

test('failure on a later item rolls back the header, details and stock changes', async () => {
  const commands = compiled().operations.filter(op => op.parentOperationId);
  const { models, service } = environment(commands);
  await models.PRODUCTO.create({ precio: '10.00', stock: 3, tratamientoImpuesto: 'GRAVADO' });
  const user = { id: 9, role: 'Recepción' };
  await assert.rejects(service.crearVentaDirectaDeRepuestos({ clienteId: 1, items: [{ repuestoId: 1, cantidad: 1 }, { repuestoId: 999, cantidad: 1 }] }, user), /relacionado/);
  assert.equal(models.VENTA.rows.length, 0);
  assert.equal(models.VENTADETALLE.rows.length, 0);
  await assert.rejects(service.crearVentaDirectaDeRepuestos({ clienteId: 1, items: [{ repuestoId: 1, cantidad: 1, precioUnitario: 0 }] }, user), /no permitido/);
  await assert.rejects(service.crearVentaDirectaDeRepuestos({ items: [{ repuestoId: 1, cantidad: 1 }] }, { id: 2, role: 'Cliente' }), /autorizado/);
  const sale = await service.crearVentaDirectaDeRepuestos({ clienteId: 1, items: [{ repuestoId: 1, cantidad: 2 }, { repuestoId: 1, cantidad: 2 }] }, user);
  await assert.rejects(service.confirmarVentaDirecta({ ventaId: sale.data.id }, user), /Stock insuficiente/);
  assert.equal(models.PRODUCTO.rows[0].stock, 3);
  assert.equal(models.MOVIMIENTOINVENTARIO.rows.length, 0);
  assert.equal(models.VENTA.rows[0].estado, 'BORRADOR');
});

test('pending fiscal treatment blocks confirmation and nested detail CRUD cannot bypass business contracts', async () => {
  const { operations, entities } = compiled();
  const { models, service } = environment(operations.filter(op => op.parentOperationId));
  await models.PRODUCTO.create({ precio: '10.00', stock: 3, tratamientoImpuesto: null });
  const user = { id: 9, role: 'Recepción' };
  const sale = await service.crearVentaDirectaDeRepuestos({ clienteId: 1, items: [{ repuestoId: 1, cantidad: 1 }] }, user);
  assert.equal(sale.data.total, null);
  await assert.rejects(service.confirmarVentaDirecta({ ventaId: sale.data.id }, user), /fiscal/);
  assert.equal(models.PRODUCTO.rows[0].stock, 3);
  assert.equal(models.VENTA.rows[0].estado, 'BORRADOR');
  const routes = generateEntityRoutesFile(entities.find(e => e.modelName === 'VENTADETALLE'), { hasAuth: true, operations });
  assert(routes.includes('BUSINESS_CONTRACT_REQUIRED'));
});

test('automatic jobs have no HTTP endpoint and a JSON user cannot forge their trusted identity', async () => {
  const { operations } = compiled();
  const commands = operations.filter(op => op.parentOperationId);
  const internal = commands.find(op => op.invocation === 'SYSTEM');
  const routes = generateOperationRoutesFile(commands, { authType: 'JWT' });
  assert(!routes.includes(internal.route.replace('/api/operations', '')));
  await assert.rejects(runtime.executeSteps({}, internal, {}, { role: 'Administrador', systemInvocation: true }, {}), /interna del sistema/);
  const harmless = { invocation: 'SYSTEM', steps: [{ id: 'answer', action: 'CALCULATION', expression: { $op: 'add', args: [1, 2], scale: 0 } }], resultStep: 'answer' };
  assert.equal(await runtime.executeSteps({}, harmless, {}, runtime.systemIdentity(), {}), '3');
  const model = generateModelFile({ name: 'VEHICULO', attributes: [], systemWatchFields: ['kilometrajeActual'] });
  assert(model.includes('transaction.afterCommit(trigger)'));
  assert(model.includes('instance.changed(field)'));
});

test('a new role absent from the saved approval is rejected before replacing the original operation', () => {
  const { document, entities, operations, roles, decisions } = compiled();
  document.groups[0].commands[0].authorizedRoles.push('Cliente');
  const parent = { operationId: 'UC-01', requirementIds: [...new Set(document.groups[0].commands.flatMap(op => op.requirementIds))] };
  const original = [parent, ...operations.filter(op => !op.parentOperationId)];
  const originalEntities = entities.filter(entity => !document.entities.some(added => added.modelName === entity.modelName));
  assert.throws(() => applyCommandContracts(document.projectId, original, originalEntities, parent.requirementIds.map(id => ({ id })), [...roles, 'Cliente'], decisions, document), /UNAPPROVED_COMMAND_PERMISSION/);
  assert.equal(original[0], parent);
});

test('a repaired command group resumes the existing job and clears its obsolete ZIP seal', async () => {
  const filename = path.resolve(__dirname, '../src/services/codegen/codegenJob.service.js');
  const module = { exports: {} }, actual = require('node:module').createRequire(filename), queued = [];
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, process, console, Buffer, __dirname: path.dirname(filename), setImmediate: callback => queued.push(callback),
    require: key => key === './projectSpecBuilder' ? { buildProjectSpec: async () => ({ hash: 'new-contract', operations: [{ operationId: 'UC-01-crear-venta' }] }) } : actual(key)
  });
  const service = module.exports;
  service.saveJob = job => service.memoryJobs.set(job.id, job);
  const job = { id: 'job_repaired_group_test', projectId: 'repaired-group', status: 'BLOCKED', ready: false,
    planningBlockers: [{ operationId: 'UC-01' }], zipSha256: 'OLD-EXPORT', bundleManifest: {}, logs: [] };
  service.saveJob(job);
  assert.equal((await service.resumeJob(job.id)).resumed, true);
  assert.equal(job.status, 'GENERATING');
  assert.equal(job.zipSha256, null);
  assert.equal(job.bundleManifest, null);
  assert.equal(job.planningBlockers.length, 0);
  assert.equal(queued.length, 1);
  assert.equal((await service.resumeJob(job.id)).resumed, false);
});
