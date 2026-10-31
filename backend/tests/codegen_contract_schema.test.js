/**
 * Contract Schema Test Suite
 * Tests versioned contracts (icase.operation.contract.v1 & icase.binding.contract.v1)
 * verifying step actions, parameter validations, RBAC and reference checks.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  OPERATION_CONTRACT_VERSION,
  BINDING_CONTRACT_VERSION,
  SUPPORTED_STEP_ACTIONS,
  validateOperationContract,
  validateBindingContract
} = require('../src/services/codegen/contractSchema');

describe('ICASE Executable Contract Schema Tests', () => {
  const sampleCatalog = {
    entities: [
      {
        modelName: 'Libro',
        tableName: 'libros',
        attributes: [
          { fieldName: 'id', type: 'integer', isPk: true },
          { fieldName: 'titulo', type: 'string', allowNull: false },
          { fieldName: 'isbn', type: 'string', allowNull: false },
          { fieldName: 'estado', type: 'string', allowNull: false }
        ]
      },
      {
        modelName: 'Prestamo',
        tableName: 'prestamos',
        attributes: [
          { fieldName: 'id', type: 'integer', isPk: true },
          { fieldName: 'libroId', type: 'integer', allowNull: false },
          { fieldName: 'fechaPrestamo', type: 'date', allowNull: false },
          { fieldName: 'diasPrestamo', type: 'integer', allowNull: false }
        ]
      }
    ],
    roles: ['Administrador', 'Bibliotecario', 'Lector'],
    businessRules: [
      { code: 'RN-01', name: 'Máximo 3 días', field: 'diasPrestamo', operator: 'lte', value: 3 }
    ],
    operations: [
      { operationId: 'op_libros_list', method: 'GET', route: '/api/libros' },
      { operationId: 'op_libros_create', method: 'POST', route: '/api/libros' }
    ]
  };

  test('Supported step actions must contain all 8 executable operations', () => {
    const required = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ASSOCIATE', 'QUERY', 'CALCULATION', 'VALIDATION'];
    for (const req of required) {
      assert.ok(SUPPORTED_STEP_ACTIONS.includes(req), `Debe soportar la acción ${req}`);
    }
  });

  test('Validates compliant operation with structured steps and catalog references', () => {
    const validOp = {
      contractVersion: OPERATION_CONTRACT_VERSION,
      operationId: 'op_registrar_prestamo',
      name: 'Registrar Préstamo de Libro',
      type: 'BUSINESS_LOGIC',
      route: '/api/operations/registrar-prestamo',
      method: 'POST',
      targetEntity: 'Prestamo',
      authorizedRoles: ['Bibliotecario'],
      steps: [
        {
          step: 1,
          action: 'CREATE',
          entity: 'Prestamo',
          description: 'Crear registro de préstamo'
        },
        {
          step: 2,
          action: 'STATUS_CHANGE',
          entity: 'Libro',
          statusField: 'estado',
          newStatus: 'PRESTADO',
          description: 'Cambiar estado del libro a PRESTADO'
        }
      ]
    };

    const result = validateOperationContract(validOp, sampleCatalog);
    assert.strictEqual(result.valid, true, `Debe ser válida. Errores: ${result.errors.join(', ')}`);
    assert.strictEqual(result.errors.length, 0);
  });

  test('Rejects operation referencing non-existent entity in catalog', () => {
    const invalidOp = {
      contractVersion: OPERATION_CONTRACT_VERSION,
      operationId: 'op_test_phantom',
      name: 'Operación Fantasma',
      type: 'BUSINESS_LOGIC',
      route: '/api/operations/test',
      method: 'POST',
      targetEntity: 'EntidadInexistente',
      steps: []
    };

    const result = validateOperationContract(invalidOp, sampleCatalog);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Entidad objetivo')));
  });

  test('Rejects operation with unsupported step action', () => {
    const invalidOp = {
      contractVersion: OPERATION_CONTRACT_VERSION,
      operationId: 'op_test_bad_step',
      name: 'Operación Paso Inválido',
      type: 'BUSINESS_LOGIC',
      route: '/api/operations/test',
      method: 'POST',
      targetEntity: 'Libro',
      steps: [
        {
          step: 1,
          action: 'NOT_AN_ACTION',
          entity: 'Libro'
        }
      ]
    };

    const result = validateOperationContract(invalidOp, sampleCatalog);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('no soportada')));
  });

  test('Validates compliant Mockup Binding contract', () => {
    const validBinding = {
      contractVersion: BINDING_CONTRACT_VERSION,
      screenId: 'scr_catalogo',
      screenRoute: '/catalogo',
      title: 'Catálogo de Libros',
      tableBindings: [
        {
          selector: '#tabla-libros',
          tableId: 'tbl_libros',
          operationId: 'op_libros_list',
          columns: [
            { header: 'Título', fieldName: 'titulo', type: 'string' },
            { header: 'ISBN', fieldName: 'isbn', type: 'string' }
          ]
        }
      ],
      formBindings: [
        {
          selector: '#form-libro',
          formId: 'form_libro',
          targetOperationId: 'op_libros_create',
          fields: [
            { selector: '#inp-titulo', inputName: 'titulo', boundField: 'titulo' }
          ]
        }
      ],
      actionButtons: [
        {
          selector: '#btn-guardar',
          buttonId: 'btn_guardar',
          label: 'Guardar',
          operationId: 'op_libros_create'
        }
      ]
    };

    const result = validateBindingContract(validBinding, sampleCatalog);
    assert.strictEqual(result.valid, true, `Debe ser válida. Errores: ${result.errors.join(', ')}`);
  });

  test('Rejects binding referencing non-existent operationId', () => {
    const invalidBinding = {
      contractVersion: BINDING_CONTRACT_VERSION,
      screenId: 'scr_catalogo',
      tableBindings: [
        {
          selector: '#tbl-1',
          operationId: 'op_inexistente_999'
        }
      ]
    };

    const result = validateBindingContract(invalidBinding, sampleCatalog);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('inexistente')));
  });
});

