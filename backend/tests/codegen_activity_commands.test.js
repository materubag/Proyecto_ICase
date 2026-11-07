const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { applyCommandContracts, applyCommandScreenActions, decisionHash } = require('../src/services/codegen/commandContracts');
const { validateScenario } = require('../src/services/codegen/contractAcceptanceRunner');

function fixture() {
  const document = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/specifications/projects/6ba45264-e3e6-4819-a0dd-18909f1fb674.commands.json')));
  const group = document.groups.find(g => g.parentOperationId === 'UC-02');
  const form = document.screenActions.find(a => a.operationId === 'UC-02-registrar-actividad');
  document.screenActions = [form];
  const decision = { questionId: group.decisionQuestionId, customAnswer: form.approvalEvidence, revision: 1, data: { targetId: 'UC-02' } };
  group.decisionHash = form.decisionHash = decisionHash(decision);
  const roles = ['Mecánico', 'Recepción'];
  const decisions = { [decision.questionId]: decision };
  const operations = [{ operationId: 'UC-02', requirementIds: group.commands[0].requirementIds, authorizedRoles: ['Mecánico'] },
    ...form.dataSources.map(source => ({ operationId: source.name, method: 'GET', route: source.route, authorizedRoles: roles }))];
  const definitions = {
    ORDENTRABAJO: 'id estado cotizacionId', USUARIO: 'id rolId', ROL: 'id nombre', COTIZACIONITEM: 'id cotizacionId servicioId estadoAprobacion',
    ACTIVIDAD: 'id ordenTrabajoId usuarioId servicioId itemAutorizadoId descripcion observaciones pruebas estado fechaRegistro',
    ORDENMECANICO: 'id ordenTrabajoId usuarioId fechaAsignacion', PRODUCTO: 'id nombre stock precio',
    MOVIMIENTOINVENTARIO: 'id ordenTrabajoId productoId usuarioId cantidad tipoMovimiento stockResultante motivo fechaMovimiento'
  };
  const entities = Object.entries(definitions).map(([modelName, fields]) => ({ modelName, attributes: fields.split(' ').map(fieldName => ({ fieldName, type: fieldName === 'id' ? 'INTEGER' : 'STRING', isPk: fieldName === 'id', allowNull: true })) }));
  const requirements = group.commands[0].requirementIds.map(id => ({ id }));
  document.groups = [group]; document.entities = []; document.policyApprovals = [];
  document.aliases = [];
  document.entityIndexes = document.entityIndexes.filter(index => entities.some(entity => entity.modelName === index.entity));
  document.entityFields = document.entityFields.filter(c => c.attribute.fieldName === 'claveOperacion');
  const screens = [{ id: form.screenId, sourceApproval: { approved: false }, contract: { fields: [{ fieldName: 'id' }, { fieldName: 'estado' }], actions: [], unresolved: ['Pending original screen approval'] } }];
  return { document, operations, entities, requirements, roles, security: { roles }, decisions, screens, form };
}

test('UC02 compiles three independent commands and the activity form without approving the original screen', () => {
  const f = fixture();
  const result = applyCommandContracts(f.document.projectId, f.operations, f.entities, f.requirements, f.roles, f.decisions, f.document);
  assert.equal(result.groups[0].commandIds.length, 3);
  applyCommandScreenActions(result.screenActions, f.screens, f.operations, f.decisions);
  const screen = f.screens[0];
  assert.deepEqual(screen.contract.fields.map(field => field.fieldName), ['id', 'estado']);
  assert.equal(screen.sourceApproval.approved, false);
  assert.equal(screen.contract.unresolved.length, 1);
  assert.equal(screen.contract.actions[0].operationId, 'UC-02-registrar-actividad');
  assert(screen.contract.actionForms[0].fields.some(field => field.fieldName === 'descripcion'));
  const activity = f.operations.find(op => op.operationId === 'UC-02-registrar-actividad');
  assert(!Object.hasOwn(activity.input.bodySchema.properties, 'usuarioId'));
  assert(!activity.steps.some(step => step.action === 'UPDATE' && step.entity === 'ORDENTRABAJO'));
  const movement = f.entities.find(e => e.modelName === 'MOVIMIENTOINVENTARIO');
  const model = require('../src/services/codegen/modelGenerator').generateModelFile({ ...movement, name: movement.modelName });
  assert.match(model, /claveOperacion: \{/);
  assert.match(model, /field: 'clave_operacion'/);
  for (const op of f.operations) for (const scenario of op.acceptanceScenarios || []) assert.deepEqual(validateScenario(scenario, f), []);
});

test('the new form rejects stale approval and data sources without the mechanic permission', () => {
  const f = fixture();
  const result = applyCommandContracts(f.document.projectId, f.operations, f.entities, f.requirements, f.roles, f.decisions, f.document);
  const stale = structuredClone(result.screenActions);
  stale[0].decisionHash = 'stale';
  assert.throws(() => applyCommandScreenActions(stale, f.screens, f.operations, f.decisions), /UNAPPROVED_COMMAND_SCREEN_ACTION/);
  f.operations.find(op => op.operationId === 'activities').authorizedRoles = ['Recepción'];
  assert.throws(() => applyCommandScreenActions(result.screenActions, f.screens, f.operations, f.decisions), /UNAPPROVED_COMMAND_SCREEN_SOURCE/);
});
