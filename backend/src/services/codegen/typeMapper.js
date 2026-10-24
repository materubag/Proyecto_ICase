/**
 * Type and Identifier Normalizer for Sequelize Code Generation
 * Transforms domain entity attributes and names into valid Sequelize DataTypes and JavaScript identifiers.
 */

// Mapping from common textual types in requirements/models to Sequelize DataTypes
const TYPE_MAPPINGS = {
  // String / Text
  string: 'DataTypes.STRING',
  texto: 'DataTypes.STRING',
  text: 'DataTypes.TEXT',
  descripcion: 'DataTypes.TEXT',
  email: 'DataTypes.STRING',
  correo: 'DataTypes.STRING',
  url: 'DataTypes.STRING',
  telefono: 'DataTypes.STRING',
  phone: 'DataTypes.STRING',
  password: 'DataTypes.STRING',
  contraseña: 'DataTypes.STRING',
  varchar: 'DataTypes.STRING',
  char: 'DataTypes.STRING',

  // Integer
  int: 'DataTypes.INTEGER',
  integer: 'DataTypes.INTEGER',
  entero: 'DataTypes.INTEGER',
  numero: 'DataTypes.INTEGER',
  number: 'DataTypes.INTEGER',
  cantidad: 'DataTypes.INTEGER',
  edad: 'DataTypes.INTEGER',
  bigint: 'DataTypes.BIGINT',

  // Decimal / Float
  float: 'DataTypes.FLOAT',
  double: 'DataTypes.DOUBLE',
  decimal: 'DataTypes.DECIMAL(10, 2)',
  precio: 'DataTypes.DECIMAL(10, 2)',
  monto: 'DataTypes.DECIMAL(10, 2)',
  saldo: 'DataTypes.DECIMAL(10, 2)',
  total: 'DataTypes.DECIMAL(10, 2)',

  // Boolean
  bool: 'DataTypes.BOOLEAN',
  boolean: 'DataTypes.BOOLEAN',
  booleano: 'DataTypes.BOOLEAN',
  activo: 'DataTypes.BOOLEAN',
  estado: 'DataTypes.BOOLEAN',

  // Date / Time
  date: 'DataTypes.DATE',
  fecha: 'DataTypes.DATE',
  datetime: 'DataTypes.DATE',
  timestamp: 'DataTypes.DATE',
  time: 'DataTypes.TIME',
  hora: 'DataTypes.TIME',

  // JSON
  json: 'DataTypes.JSON',
  object: 'DataTypes.JSON',
  array: 'DataTypes.JSON'
};

/**
 * Normalizes a raw string into PascalCase (for class/model names)
 * E.g. "prestamo libro" -> "PrestamoLibro", "usuario_sistema" -> "UsuarioSistema"
 */
function toPascalCase(str) {
  if (!str) return 'Model';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('') || 'Model';
}

/**
 * Normalizes a raw string into camelCase (for attributes, variables, field names)
 * E.g. "fecha prestamo" -> "fechaPrestamo", "ID Usuario" -> "idUsuario"
 */
function toCamelCase(str) {
  if (!str) return 'field';
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Normalizes a raw string into snake_case (for database tables)
 * E.g. "PrestamoLibro" -> "prestamo_libros"
 */
function toSnakeCasePlural(str) {
  const clean = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toLowerCase()
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  if (!clean) return 'items';
  // simple pluralization
  if (clean.endsWith('s')) return clean;
  if (clean.endsWith('r') || clean.endsWith('n') || clean.endsWith('l') || clean.endsWith('d')) {
    return clean + 'es';
  }
  return clean + 's';
}

/**
 * Maps an entity attribute type to its Sequelize DataType definition
 */
function mapToSequelizeType(rawType) {
  if (!rawType || typeof rawType !== 'string') return 'DataTypes.STRING';
  const clean = rawType.toLowerCase().trim();
  return TYPE_MAPPINGS[clean] || 'DataTypes.STRING';
}

/**
 * Processes an entity's attributes to ensure validity and safety for Sequelize.
 * Guaranteed:
 * 1. Valid identifier names (camelCase)
 * 2. Mapped Sequelize DataTypes
 * 3. At least one Primary Key (auto-generated if missing)
 */
function normalizeAttributes(rawAttributes = []) {
  const result = [];
  let hasPk = false;

  for (const attr of rawAttributes) {
    const fieldName = toCamelCase(attr.name || 'campo');
    const isPk = Boolean(attr.isPk || fieldName === 'id' || fieldName.endsWith('Id') && attr.isPk);
    if (isPk) hasPk = true;

    result.push({
      fieldName,
      originalName: attr.name,
      dataType: mapToSequelizeType(attr.type),
      isPk,
      allowNull: isPk ? false : !(attr.required ?? false)
    });
  }

  // If no PK was defined, safely prepend a standard id primary key
  if (!hasPk) {
    result.unshift({
      fieldName: 'id',
      originalName: 'ID',
      dataType: 'DataTypes.INTEGER',
      isPk: true,
      autoIncrement: true,
      allowNull: false
    });
  }

  return result;
}

module.exports = {
  toPascalCase,
  toCamelCase,
  toSnakeCasePlural,
  mapToSequelizeType,
  normalizeAttributes
};
