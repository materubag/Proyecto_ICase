const test = require('node:test');
const assert = require('node:assert/strict');
const {
  toPascalCase,
  toCamelCase,
  toSnakeCasePlural,
  deriveNaming,
  mapToSequelizeType,
  checkAttributeCollisions,
  normalizeAttributes
} = require('../src/services/codegen/typeMapper');

test('typeMapper preserves camelCase and PascalCase identifiers', () => {
  assert.equal(toCamelCase('clienteId'), 'clienteId', 'clienteId must remain camelCase');
  assert.equal(toCamelCase('fechaHora'), 'fechaHora', 'fechaHora must remain camelCase');
  assert.equal(toCamelCase('ordenTrabajoId'), 'ordenTrabajoId', 'ordenTrabajoId must remain camelCase');
  assert.equal(toCamelCase('OrdenTrabajo'), 'ordenTrabajo', 'OrdenTrabajo should convert leading letter to lower');
  assert.equal(toCamelCase('cliente_id'), 'clienteId', 'snake_case should convert to camelCase');
  assert.equal(toCamelCase('ID'), 'id', 'All-caps ID should convert to id');

  assert.equal(toPascalCase('OrdenTrabajo'), 'OrdenTrabajo', 'OrdenTrabajo must remain PascalCase');
  assert.equal(toPascalCase('clienteId'), 'ClienteId', 'clienteId should capitalize first letter only');
  assert.equal(toPascalCase('orden_trabajo'), 'OrdenTrabajo', 'snake_case should convert to PascalCase');
  assert.equal(toPascalCase('prestamo_libro'), 'PrestamoLibro');

  assert.equal(toSnakeCasePlural('Cliente'), 'clientes');
  assert.equal(toSnakeCasePlural('OrdenTrabajo'), 'orden_trabajos');
  assert.equal(toSnakeCasePlural('Ciudad'), 'ciudades');
  assert.equal(toSnakeCasePlural('Actriz'), 'actrices');
});

test('deriveNaming cleanly separates model, table, param and endpoint', () => {
  const naming = deriveNaming('OrdenTrabajo');
  assert.equal(naming.modelName, 'OrdenTrabajo');
  assert.equal(naming.paramName, 'ordenTrabajo');
  assert.equal(naming.tableName, 'orden_trabajos');
  assert.equal(naming.endpoint, 'orden-trabajos');
});

test('mapToSequelizeType maps known types and handles length/precision', () => {
  assert.equal(mapToSequelizeType('uuid'), 'DataTypes.UUID');
  assert.equal(mapToSequelizeType('GUID'), 'DataTypes.UUID');
  assert.equal(mapToSequelizeType('string'), 'DataTypes.STRING');
  assert.equal(mapToSequelizeType('varchar(255)'), 'DataTypes.STRING(255)');
  assert.equal(mapToSequelizeType('decimal(12, 4)'), 'DataTypes.DECIMAL(12, 4)');
  assert.equal(mapToSequelizeType('boolean'), 'DataTypes.BOOLEAN');
  assert.equal(mapToSequelizeType('timestamp'), 'DataTypes.DATE');
  assert.equal(mapToSequelizeType('json'), 'DataTypes.JSON');
  assert.equal(mapToSequelizeType('text'), 'DataTypes.TEXT');
});

test('mapToSequelizeType throws blocking error on unknown or empty types', () => {
  assert.throws(() => {
    mapToSequelizeType('desconocido_inventado', { attrName: 'testField' });
  }, (err) => err.code === 'UNSUPPORTED_DATA_TYPE');

  assert.throws(() => {
    mapToSequelizeType('', { attrName: 'sinTipo' });
  }, (err) => err.code === 'MISSING_DATA_TYPE');
});

test('checkAttributeCollisions detects conflicting attribute names', () => {
  const attrs = [
    { name: 'cliente_id', type: 'int' },
    { name: 'clienteId', type: 'int' }
  ];
  assert.throws(() => {
    checkAttributeCollisions(attrs);
  }, (err) => err.code === 'ATTRIBUTE_NAME_COLLISION');
});

test('normalizeAttributes preserves constraints and primary keys', () => {
  const raw = [
    { name: 'codigo', type: 'string', length: 50, allowNull: false, unique: true },
    { name: 'clienteId', type: 'uuid', allowNull: false },
    { name: 'fechaHora', type: 'datetime', defaultValue: 'NOW' },
    { name: 'total', type: 'decimal', precision: 12, scale: 2, defaultValue: 0 }
  ];

  const normalized = normalizeAttributes(raw);

  // Auto-injected id PK
  assert.equal(normalized[0].fieldName, 'id');
  assert.equal(normalized[0].isPk, true);

  // codigo
  const codigo = normalized.find(a => a.fieldName === 'codigo');
  assert.ok(codigo);
  assert.equal(codigo.allowNull, false);
  assert.equal(codigo.unique, true);
  assert.equal(codigo.dataType, 'DataTypes.STRING(50)');

  // clienteId
  const clienteId = normalized.find(a => a.fieldName === 'clienteId');
  assert.ok(clienteId);
  assert.equal(clienteId.dataType, 'DataTypes.UUID');
  assert.equal(clienteId.allowNull, false);

  // fechaHora
  const fechaHora = normalized.find(a => a.fieldName === 'fechaHora');
  assert.ok(fechaHora);
  assert.equal(fechaHora.dataType, 'DataTypes.DATE');
  assert.equal(fechaHora.defaultValue, 'NOW');
});
