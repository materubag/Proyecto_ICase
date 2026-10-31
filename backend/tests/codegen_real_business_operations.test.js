const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateOperationServiceFile,
  generateOperationControllerFile,
  generateOperationRoutesFile
} = require('../src/services/codegen/operationGenerator');

test('Business Operations: Generates real transactional execution and rollback on rule violation', () => {
  const operations = [
    {
      operationId: 'op_prestar_libro',
      name: 'Prestar Libro',
      type: 'BUSINESS_LOGIC',
      targetEntity: 'Prestamo',
      route: '/api/operations/prestar-libro',
      method: 'POST',
      authorizedRoles: ['Bibliotecario'],
      businessRules: [
        {
          code: 'BR_STOCK_DISPONIBLE',
          name: 'Disponibilidad de Ejemplares',
          description: 'El libro debe contar con al menos un ejemplar disponible',
          condition: 'payload.ejemplaresDisponibles > 0'
        }
      ]
    }
  ];

  const entities = [
    { modelName: 'Prestamo', name: 'Prestamo' },
    { modelName: 'Libro', name: 'Libro' }
  ];

  const serviceCode = generateOperationServiceFile(operations, entities);

  // 1. Must use sequelize.transaction()
  assert.ok(serviceCode.includes('await sequelize.transaction()'), 'Must start database transaction');
  // 2. Must commit on success
  assert.ok(serviceCode.includes('await t.commit()'), 'Must commit transaction on success');
  // 3. Must rollback on error
  assert.ok(serviceCode.includes('await t.rollback()'), 'Must rollback transaction on error');
  // 4. Must enforce business rule condition
  assert.ok(serviceCode.includes('payload.ejemplaresDisponibles > 0'), 'Must generate rule verification code');
  assert.ok(serviceCode.includes("err.code = 'BUSINESS_RULE_VIOLATION'"), 'Must mark rule violation code');
  assert.ok(serviceCode.includes('err.statusCode = 422'), 'Must throw 422 for unfulfilled business rule');
  // 5. Must perform real model creation or mutation
  assert.ok(serviceCode.includes('await models.Prestamo.create(payload, { transaction: t })'), 'Must mutate target model inside transaction');
  // 6. Must NOT contain simulator flags _rejectRule or _failRule
  assert.equal(serviceCode.includes('_rejectRule'), false, '_rejectRule simulator must be removed');
  assert.equal(serviceCode.includes('_failRule'), false, '_failRule simulator must be removed');
  // 7. Zero automotive or workshop hardcoded references
  assert.equal(serviceCode.includes('vehiculoId'), false);
  assert.equal(serviceCode.includes('P0300'), false);
  assert.equal(serviceCode.includes('Roberto'), false);
});

test('Business Operations: Unexecutable rule blocks generation with diagnostic', () => {
  const operations = [
    {
      operationId: 'op_rechazar_sin_regla',
      name: 'Operacion Invalida',
      type: 'BUSINESS_LOGIC',
      targetEntity: 'Factura',
      route: '/api/operations/facturar',
      businessRules: [
        {
          code: 'BR_UNEXECUTABLE',
          name: 'Regla sin condicion',
          description: 'Solo texto sin campo ni expresion'
        }
      ]
    }
  ];

  assert.throws(() => {
    generateOperationServiceFile(operations, [{ modelName: 'Factura', name: 'Factura' }]);
  }, (err) => {
    assert.equal(err.code, 'UNEXECUTABLE_BUSINESS_RULE');
    return true;
  }, 'Should throw UNEXECUTABLE_BUSINESS_RULE when rule has no executable definition');
});

test('Business Operations: Operation without targetEntity or steps does NOT default to entities[0]', () => {
  const operations = [
    {
      operationId: 'op_sin_entidad',
      name: 'Operacion Huerfana',
      type: 'BUSINESS_LOGIC',
      route: '/api/operations/huerfana'
      // targetEntity is intentionally missing
    }
  ];

  const entities = [
    { modelName: 'EntidadTrampa', name: 'EntidadTrampa' }
  ];

  assert.throws(() => {
    generateOperationServiceFile(operations, entities);
  }, (err) => {
    assert.equal(err.code, 'UNDEFINED_OPERATION_BEHAVIOR');
    return true;
  }, 'Should throw UNDEFINED_OPERATION_BEHAVIOR instead of defaulting to EntidadTrampa');
});

test('Business Operations: Generates controller and routes with proper HTTP status codes and RBAC', () => {
  const operations = [
    {
      operationId: 'op_transferir',
      name: 'Transferir Fondos',
      type: 'BUSINESS_LOGIC',
      targetEntity: 'Transferencia',
      route: '/api/operations/transferir',
      method: 'POST',
      authorizedRoles: ['Cajero', 'Gerente'],
      output: { successStatus: 201 }
    }
  ];

  const controllerCode = generateOperationControllerFile(operations);
  assert.ok(controllerCode.includes('res.status(201)'), 'Must return operation defined successStatus');
  assert.ok(controllerCode.includes('operationService.transferirFondos(payload, req.user)'));

  const routesCode = generateOperationRoutesFile(operations, { authType: 'JWT' });
  assert.ok(routesCode.includes("authenticateToken, authorizeRoles('Cajero', 'Gerente')"), 'Must apply server-side RBAC on route');
});
