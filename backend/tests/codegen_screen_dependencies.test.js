const test = require('node:test');
const assert = require('node:assert/strict');
const { planScreen, screenChoices, screenOperationProblems } = require('../src/services/codegen/aiScreenPlanner');

test('approved entity reads use their controller without requiring business steps or broadening roles', () => {
  const read = { operationId: 'op_citas_list', type: 'READ', method: 'GET', entity: 'CITA', route: '/api/citas', authorizedRoles: ['Recepción'] };
  const screen = { roles: ['Recepción'], contract: { actions: [{ operationId: read.operationId }] } };
  const spec = { entities: [{ modelName: 'CITA' }], operations: [read] };
  assert.deepEqual(screenOperationProblems(read, spec), []);
  assert.equal(screenChoices(screen, spec).length, 1);
  assert.equal(screenChoices({ ...screen, roles: ['Cliente'] }, spec).length, 0);
  assert.equal(screenChoices(screen, { ...spec, entities: [] }).length, 0);
  assert.equal(screenChoices(screen, { ...spec, operations: [{ ...read, unresolved: ['Ownership missing'] }] }).length, 0);
  assert(screenOperationProblems({ ...read, type: 'BUSINESS_LOGIC' }, spec).length > 0);
  assert(screenOperationProblems({ ...read, type: 'CREATE', method: 'POST' }, spec).length > 0);
});

test('a blocked screen reports its actual operation dependency before calling a provider', async () => {
  const result = await planScreen('project', { id: 'screen', roles: ['Cliente'], requirementIds: ['r'] }, {
    entities: [], operations: [{ operationId: 'UC-test', requirementIds: ['r'], authorizedRoles: ['Cliente'], unresolved: ['Missing approved field'] }]
  });
  assert.equal(result.valid, false);
  assert.equal(result.providerMetadata.reason, 'NO_EXECUTABLE_SCREEN_OPERATION');
  assert(result.errors.some(error => error.includes('UC-test') && error.includes('Missing approved field')));
});
