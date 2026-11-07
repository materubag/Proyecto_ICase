const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProjectSpec } = require('../src/services/codegen/projectSpecValidator');

test('Coverage Breakdown: Distinguishes traced, implemented, and validated requirements', () => {
  const spec = {
    schemaVersion: '1.0.0',
    entities: [
      {
        id: 'ent-1',
        name: 'Producto',
        modelName: 'Producto',
        requirementIds: ['rf-data'],
        primaryKey: { fieldName: 'id' },
        attributes: [{ fieldName: 'id', isPk: true }, { fieldName: 'nombre', isPk: false }]
      }
    ],
    operations: [
      {
        operationId: 'op_calcular',
        name: 'Calcular Descuento',
        route: '/api/operations/calcular-descuento',
        method: 'POST',
        output: { successStatus: 200 },
        requirementIds: ['rf-logic'],
        authorizedRoles: ['Admin']
      }
    ],
    screens: [
      {
        id: 'scr-1',
        name: 'Vista Catalogo',
        route: '/catalogo',
        connectedOperationId: 'op_calcular',
        components: [{ type: 'button' }],
        requirementIds: ['rf-ui']
      }
    ],
    requirements: [
      { id: 'rf-data', code: 'RF-01', name: 'Almacenar datos de producto en catálogo', type: 'FUNCTIONAL' },
      { id: 'rf-logic', code: 'RF-02', name: 'Calcular descuento y validar promociones', type: 'FUNCTIONAL' },
      { id: 'rf-ui', code: 'RF-03', name: 'Pantalla de visualización interactiva', type: 'FUNCTIONAL' }
    ]
  };

  const diag = validateProjectSpec(spec, { validatedRequirementIds: ['rf-data'] });

  assert.equal(diag.ready, false);
  assert.equal(diag.coverage.requirementsTotal, 3);
  assert.equal(diag.coverage.requirementsTraced, 3);
  assert.equal(diag.coverage.requirementsImplemented, 0);
  assert.equal(diag.coverage.requirementsValidated, 0);
  assert.equal(diag.coverage.coveragePercentage, 0);

  const reqData = diag.coverage.details.find(d => d.code === 'RF-01');
  assert.equal(reqData.nature, 'DATA');
  assert.equal(reqData.implemented, false);
  assert.equal(reqData.validated, false);

  const reqLogic = diag.coverage.details.find(d => d.code === 'RF-02');
  assert.equal(reqLogic.nature, 'BUSINESS_LOGIC');
  assert.equal(reqLogic.implemented, false);
});

test('Coverage Breakdown: Blocks declaration when behavior is missing and reports incomplete reasons', () => {
  const spec = {
    schemaVersion: '1.0.0',
    entities: [
      {
        id: 'ent-1',
        name: 'Libro',
        modelName: 'Libro',
        requirementIds: ['rf-unimplemented'],
        primaryKey: { fieldName: 'id' },
        attributes: [{ fieldName: 'id', isPk: true }]
      }
    ],
    operations: [],
    screens: [],
    requirements: [
      {
        id: 'rf-unimplemented',
        code: 'RF-99',
        name: 'Procesar devolución de préstamo con cálculo de mora',
        type: 'FUNCTIONAL'
      }
    ]
  };

  // Without allowPartialScope, must block
  const diagBlocked = validateProjectSpec(spec);
  assert.equal(diagBlocked.ready, false);
  assert.ok(diagBlocked.errors.some(e => e.code === 'UNIMPLEMENTED_REQUIREMENT_BEHAVIOR'));
  assert.equal(diagBlocked.coverage.incomplete.length, 1);
  assert.equal(diagBlocked.coverage.incomplete[0].reason, 'MISSING_BEHAVIOR_OPERATION');

  // With allowPartialScope: true, must pass with warnings and report excluded requirements
  const diagAllowed = validateProjectSpec(spec, { allowPartialScope: true });
  assert.equal(diagAllowed.ready, true);
  assert.ok(diagAllowed.warnings.some(w => w.code === 'PARTIAL_SCOPE_EXCLUSION'));
  assert.equal(diagAllowed.coverage.excluded.length, 1);
  assert.equal(diagAllowed.coverage.excluded[0].code, 'RF-99');
});
