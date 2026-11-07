const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { scopeFor } = require('../src/services/codegen/crudRuntime');
const { applyCommandRecordScopes, decisionHash } = require('../src/services/codegen/commandContracts');

const policy = { roles: ['Cliente'], lookups: [{ id: 'owners', entity: 'CLIENTE', many: true, where: { usuarioId: { $ref: 'user.id' } } }], whereIn: { field: 'clienteId', lookup: 'owners', valueField: 'id' }, immutableFields: ['clienteId'] };
test('customer read scope includes every linked client and an empty set never removes the filter', async () => {
  for (const ids of [[7, 11], [7], []]) {
    const models = { CLIENTE: { findAll: async options => {
      assert.deepEqual(options.where, { usuarioId: 42 });
      return ids.map(id => ({ toJSON: () => ({ id }) }));
    } } };
    const scope = await scopeFor(models, { recordScope: [policy] }, { id: 42, role: 'Cliente' });
    assert.deepEqual(scope.where.clienteId[Op.in], ids);
    assert.deepEqual(scope.immutableFields, ['clienteId']);
    assert.deepEqual((await scopeFor(models, { recordScope: [policy] }, { id: 2, role: 'Administrador' })).where, {});
  }
});

test('record scope overrides require unchanged approval and valid entity fields', () => {
  const decision = { questionId: 'q', customAnswer: 'Customer ownership', revision: 1 };
  const declarations = [{ operationId: 'readVehicles', decisionQuestionId: 'q', decisionHash: decisionHash(decision), recordScope: [policy] }];
  const operations = [{ operationId: 'readVehicles', entity: 'VEHICULO', method: 'GET', authorizedRoles: ['Cliente'] }];
  const entities = [{ modelName: 'VEHICULO', attributes: [{ fieldName: 'clienteId' }] }, { modelName: 'CLIENTE', attributes: [{ fieldName: 'id' }, { fieldName: 'usuarioId' }] }];
  applyCommandRecordScopes(declarations, operations, entities, { q: decision });
  assert.deepEqual(operations[0].recordScope, [policy]);
  assert.throws(() => applyCommandRecordScopes(declarations, operations, entities, { q: { ...decision, revision: 2 } }), /UNAPPROVED_RECORD_SCOPE/);
  const invalid = structuredClone(declarations);
  invalid[0].recordScope[0].whereIn.field = 'missing';
  assert.throws(() => applyCommandRecordScopes(invalid, operations, entities, { q: decision }), /INVALID_RECORD_SCOPE_FIELD/);
});
