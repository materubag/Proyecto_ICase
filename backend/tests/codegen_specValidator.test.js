const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProjectSpec, operationNeedsExecutableBehavior } = require('../src/services/codegen/projectSpecValidator');

test('validateProjectSpec blocks generation when no entities exist', () => {
  const emptySpec = {
    entities: [],
    requirements: []
  };

  const diag = validateProjectSpec(emptySpec);
  assert.equal(diag.ready, false);
  assert.ok(diag.errors.some(e => e.code === 'NO_APPROVED_ENTITIES'));
});

test('validateProjectSpec detects unresolved relationship endpoints', () => {
  const spec = {
    entities: [
      { id: '1', name: 'Libro', modelName: 'Libro', primaryKey: { fieldName: 'id' }, attributes: [] }
    ],
    relationships: [
      { id: 'rel-1', sourceEntity: 'Libro', targetEntity: 'EntidadInexistente' }
    ]
  };

  const diag = validateProjectSpec(spec);
  assert.equal(diag.ready, false);
  assert.ok(diag.errors.some(e => e.code === 'UNRESOLVED_RELATIONSHIP_ENDPOINT'));
});

test('validateProjectSpec detects route collisions across operations', () => {
  const spec = {
    entities: [
      { id: '1', name: 'Cliente', modelName: 'Cliente', primaryKey: { fieldName: 'id' }, attributes: [] }
    ],
    operations: [
      { operationId: 'op_1', route: '/api/clientes', method: 'GET', authorizedRoles: ['Admin'] },
      { operationId: 'op_2', route: '/api/clientes', method: 'GET', authorizedRoles: ['Admin'] }
    ]
  };

  const diag = validateProjectSpec(spec);
  assert.equal(diag.ready, false);
  assert.ok(diag.errors.some(e => e.code === 'ROUTE_COLLISION'));
});

test('validateProjectSpec passes clean spec and calculates coverage', () => {
  const cleanSpec = {
    schemaVersion: '1.0.0',
    entities: [
      {
        id: 'ent-1',
        name: 'Libro',
        modelName: 'Libro',
        tableName: 'libros',
        requirementIds: ['rf-1'],
        primaryKey: { fieldName: 'id' },
        attributes: [
          { fieldName: 'id', isPk: true, dataType: 'DataTypes.INTEGER' },
          { fieldName: 'titulo', isPk: false, dataType: 'DataTypes.STRING' }
        ]
      }
    ],
    relationships: [],
    operations: [
      { operationId: 'op_list', name: 'Listar Libros', entity: 'Libro', route: '/api/libros', method: 'GET', authorizedRoles: ['Admin'], requirementIds: ['rf-1'], output: { successStatus: 200 } },
      { operationId: 'op_create', name: 'Crear Libro', entity: 'Libro', route: '/api/libros', method: 'POST', authorizedRoles: ['Admin'], requirementIds: ['rf-1'], output: { successStatus: 201 } }
    ],
    requirements: [
      { id: 'rf-1', code: 'RF-01', name: 'Registrar Libros', type: 'FUNCTIONAL' }
    ],
    screens: [
      { name: 'LibrosPage', route: '/libros', connectedOperationId: 'op_list' }
    ]
  };

  const diag = validateProjectSpec(cleanSpec);
  assert.equal(diag.ready, true);
  assert.equal(diag.errors.length, 0);
  assert.equal(diag.coverage.requirementsTotal, 1);
  assert.equal(diag.coverage.requirementsCovered, 1);
  assert.equal(diag.coverage.coveragePercentage, 100);
});

test('operationNeedsExecutableBehavior matches quality-gate incomplete business operations', () => {
  assert.equal(operationNeedsExecutableBehavior({
    type: 'BUSINESS_LOGIC', operationId: 'UC-01', name: 'Gestionar órdenes', method: 'POST'
  }), true);
  assert.equal(operationNeedsExecutableBehavior({
    type: 'BUSINESS_LOGIC', targetEntity: 'OrdenTrabajo', method: 'POST', action: 'CREATE',
    steps: [{ step: 1, action: 'CREATE', entity: 'OrdenTrabajo' }]
  }), false);
});
