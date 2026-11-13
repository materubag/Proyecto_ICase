/**
 * Type and Identifier Normalizer for Sequelize Code Generation
 * Transforms domain entity attributes and names into valid Sequelize DataTypes and JavaScript identifiers.
 * Strictly preserves camelCase and PascalCase (e.g. clienteId, fechaHora, OrdenTrabajo).
 */

const JS_RESERVED_WORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function',
  'if', 'import', 'in', 'instanceof', 'new', 'return', 'super', 'switch',
  'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
  'let', 'static', 'enum', 'await', 'implements', 'package', 'protected',
  'interface', 'private', 'public', 'null', 'true', 'false'
]);

const SQL_RESERVED_WORDS = new Set([
  'select', 'insert', 'update', 'delete', 'from', 'where', 'table', 'database',
  'alter', 'create', 'drop', 'group', 'order', 'by', 'having', 'join', 'left',
  'right', 'inner', 'outer', 'full', 'on', 'as', 'distinct', 'union', 'all',
  'and', 'or', 'not', 'null', 'is', 'in', 'between', 'like', 'exists', 'case',
  'when', 'then', 'else', 'end', 'primary', 'key', 'foreign', 'references',
  'check', 'unique', 'default', 'index', 'view', 'trigger', 'procedure',
  'user', 'role', 'grant', 'revoke', 'limit', 'offset', 'values', 'into'
]);

// Mapping of standardized types to Sequelize DataTypes
const TYPE_MAPPINGS = {
  // UUID
  uuid: 'DataTypes.UUID',
  guid: 'DataTypes.UUID',

  // String / Text
  string: 'DataTypes.STRING',
  texto: 'DataTypes.STRING',
  varchar: 'DataTypes.STRING',
  char: 'DataTypes.STRING',
  email: 'DataTypes.STRING',
  correo: 'DataTypes.STRING',
  url: 'DataTypes.STRING',
  telefono: 'DataTypes.STRING',
  phone: 'DataTypes.STRING',
  password: 'DataTypes.STRING',
  contraseña: 'DataTypes.STRING',
  contrasena: 'DataTypes.STRING',
  text: 'DataTypes.TEXT',
  descripcion: 'DataTypes.TEXT',

  // Integer
  int: 'DataTypes.INTEGER',
  integer: 'DataTypes.INTEGER',
  entero: 'DataTypes.INTEGER',
  numero: 'DataTypes.INTEGER',
  number: 'DataTypes.INTEGER',
  cantidad: 'DataTypes.INTEGER',
  edad: 'DataTypes.INTEGER',
  smallint: 'DataTypes.SMALLINT',
  bigint: 'DataTypes.BIGINT',

  // Decimal / Float / Monetary
  float: 'DataTypes.DECIMAL(12, 2)',
  double: 'DataTypes.DECIMAL(12, 2)',
  decimal: 'DataTypes.DECIMAL(12, 2)',
  precio: 'DataTypes.DECIMAL(12, 2)',
  monto: 'DataTypes.DECIMAL(12, 2)',
  saldo: 'DataTypes.DECIMAL(12, 2)',
  total: 'DataTypes.DECIMAL(12, 2)',
  subtotal: 'DataTypes.DECIMAL(12, 2)',
  costo: 'DataTypes.DECIMAL(12, 2)',
  impuestos: 'DataTypes.DECIMAL(12, 2)',
  moneda: 'DataTypes.DECIMAL(12, 2)',

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
  dateonly: 'DataTypes.DATEONLY',
  time: 'DataTypes.TIME',
  hora: 'DataTypes.TIME',

  // JSON
  json: 'DataTypes.JSON',
  jsonb: 'DataTypes.JSONB',
  object: 'DataTypes.JSON',
  array: 'DataTypes.JSON'
};

/**
 * Splits words while honoring existing camelCase and PascalCase transitions.
 * E.g. "clienteId" -> ["cliente", "Id"]
 *      "fechaHora" -> ["fecha", "Hora"]
 *      "OrdenTrabajo" -> ["Orden", "Trabajo"]
 *      "orden_trabajo" -> ["orden", "trabajo"]
 */
function splitWords(str) {
  if (!str || typeof str !== 'string') return [];
  const normalized = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // remove diacritics

  // Split transitions between lower/digit and upper: "clienteId" -> "cliente Id"
  const withSpaces = normalized
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .trim();

  if (!withSpaces) return [];
  return withSpaces.split(/\s+/).filter(Boolean);
}

/**
 * Normalizes a raw string into PascalCase (for class/model names)
 * Preserves camelCase compounds properly:
 * "clienteId" -> "ClienteId"
 * "OrdenTrabajo" -> "OrdenTrabajo"
 * "fecha_hora" -> "FechaHora"
 */
function toPascalCase(str) {
  const words = splitWords(str);
  if (!words.length) return 'Model';
  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

/**
 * Normalizes a raw string into camelCase (for attributes, variables, field names)
 * Preserves internal capitalization:
 * "clienteId" -> "clienteId"
 * "fechaHora" -> "fechaHora"
 * "OrdenTrabajo" -> "ordenTrabajo"
 * "cliente_id" -> "clienteId"
 * "ID" -> "id"
 */
function toCamelCase(str) {
  const words = splitWords(str);
  if (!words.length) return 'field';
  if (words.length === 1) {
    const single = words[0];
    if (single.toUpperCase() === single) return single.toLowerCase();
    return single.charAt(0).toLowerCase() + single.slice(1);
  }
  const first = words[0].toLowerCase();
  const rest = words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  return first + rest;
}

function toSnakeCase(str) {
  const words = splitWords(str);
  if (!words.length) return 'field';
  return words.map(w => w.toLowerCase()).join('_');
}

/**
 * Normalizes a raw string into snake_case plural (for database tables)
 * "Cliente" -> "clientes"
 * "OrdenTrabajo" -> "ordenes_trabajo"
 * "Ciudad" -> "ciudades"
 */
function toSnakeCasePlural(str) {
  const words = splitWords(str);
  if (!words.length) return 'items';
  const cleanWords = words.map(w => w.toLowerCase());
  const lastIdx = cleanWords.length - 1;
  const last = cleanWords[lastIdx];

  let plural = last;
  if (!last.endsWith('s')) {
    if (last.endsWith('r') || last.endsWith('n') || last.endsWith('l') || last.endsWith('d') || last.endsWith('z')) {
      if (last.endsWith('z')) {
        plural = last.slice(0, -1) + 'ces';
      } else {
        plural = last + 'es';
      }
    } else {
      plural = last + 's';
    }
  }
  cleanWords[lastIdx] = plural;
  return cleanWords.join('_');
}

/**
 * Derives explicit naming targets for a domain entity
 */
function deriveNaming(rawName) {
  const modelName = toPascalCase(rawName);
  const paramName = toCamelCase(rawName);
  const tableName = toSnakeCasePlural(rawName);
  const endpoint = tableName.replace(/_/g, '-');
  return {
    modelName,
    paramName,
    tableName,
    endpoint,
    controllerFile: `${paramName}.controller.js`,
    routesFile: `${paramName}.routes.js`
  };
}

/**
 * Maps a Sequelize/raw type to a valid OpenAPI 3.0 type definition
 */
function toOpenApiType(rawType) {
  if (!rawType || typeof rawType !== 'string') return { type: 'string' };
  const upper = rawType.toUpperCase();
  if (upper.includes('INT')) return { type: 'integer' };
  if (upper.includes('FLOAT') || upper.includes('DOUBLE') || upper.includes('DECIMAL') || upper.includes('NUMERIC')) return { type: 'number' };
  if (upper.includes('BOOL')) return { type: 'boolean' };
  if (upper.includes('JSON')) return { type: 'object' };
  if (upper.includes('UUID')) return { type: 'string', format: 'uuid' };
  if (upper.includes('DATEONLY')) return { type: 'string', format: 'date' };
  if (upper.includes('DATE') || upper.includes('TIME')) return { type: 'string', format: 'date-time' };
  return { type: 'string' };
}

/**
 * Checks if a name is a reserved keyword in JS or SQL
 */
function isReservedWord(name) {
  if (!name || typeof name !== 'string') return false;
  const lower = name.toLowerCase();
  return JS_RESERVED_WORDS.has(lower) || SQL_RESERVED_WORDS.has(lower);
}

/**
 * Parses raw type strings that may include length/precision: e.g. "VARCHAR(255)", "DECIMAL(12,2)"
 */
function parseTypeDetails(rawType) {
  if (!rawType || typeof rawType !== 'string') return { base: 'string' };
  const trimmed = rawType.trim();
  const match = trimmed.match(/^([a-zA-Z_]+)(?:\(([^)]+)\))?$/);
  if (!match) return { base: trimmed.toLowerCase() };
  const base = match[1].toLowerCase();
  const args = match[2] ? match[2].split(',').map(s => s.trim()) : [];
  return { base, args };
}

/**
 * Maps an entity attribute type to its Sequelize DataType definition.
 * Throws a blocking validation error if the type is unknown or invalid.
 */
function mapToSequelizeType(rawType, options = {}) {
  if (!rawType || typeof rawType !== 'string' || !rawType.trim()) {
    const error = new Error(`Tipo de dato no especificado para el atributo '${options.attrName || 'desconocido'}'.`);
    error.code = 'MISSING_DATA_TYPE';
    throw error;
  }

  // If already mapped to DataTypes.X, return as-is
  if (rawType.startsWith('DataTypes.')) {
    return rawType;
  }

  const { base, args } = parseTypeDetails(rawType);
  const mapped = TYPE_MAPPINGS[base];

  if (!mapped) {
    const error = new Error(
      `Tipo de dato no soportado o desconocido: '${rawType}' en atributo '${options.attrName || 'campo'}'. ` +
      `Tipos válidos: UUID, STRING, TEXT, INTEGER, BIGINT, FLOAT, DECIMAL, BOOLEAN, DATE, DATEONLY, TIME, JSON, JSONB.`
    );
    error.code = 'UNSUPPORTED_DATA_TYPE';
    throw error;
  }

  // Handle explicit length/precision args
  if (base === 'varchar' || base === 'string') {
    const length = args[0] || options.length;
    if (length && !isNaN(Number(length))) {
      return `DataTypes.STRING(${Number(length)})`;
    }
  }

  if (base === 'decimal') {
    const precision = args[0] || options.precision || 10;
    const scale = args[1] || options.scale || 2;
    return `DataTypes.DECIMAL(${precision}, ${scale})`;
  }

  return mapped;
}

/**
 * Checks for attribute collisions (different original names mapping to identical camelCase fieldName).
 */
function checkAttributeCollisions(rawAttributes = []) {
  const seen = new Map();
  for (const attr of rawAttributes) {
    const rawName = attr.name || attr.fieldName || '';
    const fieldName = toCamelCase(rawName);
    if (seen.has(fieldName)) {
      const error = new Error(
        `Colisión de atributos: '${rawName}' y '${seen.get(fieldName)}' se resuelven al mismo campo '${fieldName}'.`
      );
      error.code = 'ATTRIBUTE_NAME_COLLISION';
      throw error;
    }
    seen.set(fieldName, rawName);
  }
}

/**
 * Processes an entity's attributes to ensure validity and safety for Sequelize.
 */
function normalizeAttributes(rawAttributes = [], options = {}) {
  checkAttributeCollisions(rawAttributes);

  const result = [];
  let hasPk = false;

  for (const attr of rawAttributes) {
    const rawName = attr.name || attr.fieldName || 'campo';
    const rawType = attr.type || attr.dataType;
    const fieldName = toCamelCase(rawName);
    const isPk = Boolean(attr.isPk || fieldName === 'id' || (fieldName.endsWith('Id') && attr.isPk));
    if (isPk) hasPk = true;

    const dataType = mapToSequelizeType(rawType, {
      attrName: rawName,
      length: attr.length,
      precision: attr.precision,
      scale: attr.scale
    });

    const isReserved = isReservedWord(fieldName);

    // Determine allowNull: if explicitly specified, respect it.
    // If not specified, PK is false, others default to true unless required=true.
    let allowNull = true;
    if (isPk) {
      allowNull = false;
    } else if (attr.allowNull !== undefined) {
      allowNull = Boolean(attr.allowNull);
    } else if (attr.required !== undefined) {
      allowNull = !Boolean(attr.required);
    }

    result.push({
      fieldName,
      columnName: toSnakeCase(fieldName),
      originalName: attr.name,
      dataType,
      isPk,
      readOnly: Boolean(attr.readOnly),
      allowNull,
      unique: Boolean(attr.unique || attr.isUnique),
      autoIncrement: Boolean(attr.autoIncrement || (isPk && (dataType.includes('INTEGER') || dataType.includes('BIGINT')))),
      defaultValue: attr.defaultValue !== undefined ? attr.defaultValue : null,
      length: attr.length || null,
      precision: attr.precision || null,
      scale: attr.scale || null,
      comment: attr.description || attr.comment || null,
      isReserved
      , ...Object.fromEntries(['minimum', 'maximum', 'minLength', 'maxLength', 'enum', 'format'].filter(key => attr[key] !== undefined).map(key => [key, attr[key]]))
    });
  }

  // If no PK was defined, safely prepend a standard id primary key
  if (!hasPk) {
    result.unshift({
      fieldName: 'id',
      columnName: 'id',
      originalName: 'id',
      dataType: 'DataTypes.INTEGER',
      isPk: true,
      allowNull: false,
      unique: true,
      autoIncrement: true,
      defaultValue: null,
      isReserved: false
    });
  }

  return result;
}

module.exports = {
  toPascalCase,
  toCamelCase,
  toSnakeCase,
  toSnakeCasePlural,
  deriveNaming,
  isReservedWord,
  mapToSequelizeType,
  checkAttributeCollisions,
  normalizeAttributes,
  toOpenApiType,
  TYPE_MAPPINGS
};
