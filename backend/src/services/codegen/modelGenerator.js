/**
 * Model Generator for Sequelize
 * Generates individual model files and models/index.js with robust associations.
 * Resolves source/target by stable IDs, normalizes cardinalities, supports self-relations
 * and avoids domain-specific hardcoded hooks.
 */

const {
  toPascalCase,
  toCamelCase,
  toSnakeCase,
  toSnakeCasePlural,
  deriveNaming,
  normalizeAttributes
} = require('./typeMapper');

/**
 * Normalizes cardinality strings into standard tokens: '1:1', '1:N', 'N:1', 'N:M'
 */
function normalizeCardinality(rawCard = '') {
  if (!rawCard || typeof rawCard !== 'string') return '1:N';
  const clean = rawCard.trim().toUpperCase().replace(/\s+/g, '');

  if (clean === '1:1' || clean === 'ONE_TO_ONE' || clean === '1..1' || clean === '||--||' || clean === '|O--||' || clean === '||--O|' || clean === '|O--O|') {
    return '1:1';
  }
  if (clean === 'N:M' || clean === 'M:N' || clean === 'MANY_TO_MANY' || clean === '*:*' || clean === '*..*' || clean === '}O--O{' || clean === '}O--{' || clean === '}|--|{' || clean === '}|--O{' || clean === '}O--|{') {
    return 'N:M';
  }
  if (clean === 'N:1' || clean === 'MANY_TO_ONE' || clean === '*..1' || clean === '}O--||' || clean === '}|--||' || clean === '}O--O|' || clean === '}|--O|') {
    return 'N:1';
  }
  if (clean === '1:N' || clean === 'ONE_TO_MANY' || clean === '1..*' || clean === '1..N' || clean === '||--O{' || clean === '||--{' || clean === '|O--O{' || clean === '||--|{' || clean === '|O--|{') {
    return '1:N';
  }

  const error = new Error(`Cardinalidad desconocida o no soportada: '${rawCard}'. Use 1:1, 1:N, N:1 o N:M.`);
  error.code = 'INVALID_CARDINALITY';
  throw error;
}

/**
 * Generates the source code for an individual Sequelize model file
 */
function generateModelFile(entity) {
  const naming = deriveNaming(entity.name);
  const normalizedAttrs = normalizeAttributes(entity.attributes || []);

  const attributeLines = normalizedAttrs.map(attr => {
    const colName = attr.columnName || toSnakeCase(attr.fieldName);
    const options = [
      `type: ${attr.dataType}`,
      `allowNull: ${attr.allowNull}`,
      `field: '${colName}'`
    ];

    if (attr.isPk) {
      options.push('primaryKey: true');
    }

    if (attr.autoIncrement) {
      options.push('autoIncrement: true');
    }

    if (attr.unique) {
      options.push('unique: true');
    }

    if (attr.defaultValue !== null && attr.defaultValue !== undefined) {
      if (typeof attr.defaultValue === 'string') {
        if (attr.defaultValue === 'NOW') {
          options.push('defaultValue: DataTypes.NOW');
        } else if (attr.defaultValue === 'UUIDV4') {
          options.push('defaultValue: DataTypes.UUIDV4');
        } else {
          options.push(`defaultValue: ${JSON.stringify(attr.defaultValue)}`);
        }
      } else {
        options.push(`defaultValue: ${JSON.stringify(attr.defaultValue)}`);
      }
    }

    if (attr.comment) {
      options.push(`comment: ${JSON.stringify(attr.comment)}`);
    }

    return `    ${attr.fieldName}: {\n      ${options.join(',\n      ')}\n    }`;
  }).join(',\n');

  return `/**
 * Modelo Sequelize para ${naming.modelName}
 * Generado automáticamente por ICASE Studio
 * ${entity.description ? `Descripción: ${entity.description}` : ''}
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ${naming.modelName} = sequelize.define('${naming.modelName}', {
${attributeLines}
  }, {
    tableName: '${naming.tableName}',
    timestamps: true,
    underscored: true
  });

  return ${naming.modelName};
};
`;
}

/**
 * Resolves an entity reference (by ID or exact name) against the available entity collection.
 */
function resolveEntity(ref, idMap, nameMap) {
  if (!ref || typeof ref !== 'string') return null;

  // 1. Direct ID lookup
  if (idMap.has(ref)) return idMap.get(ref);

  // 2. Direct Name lookup (case-insensitive)
  const lower = ref.trim().toLowerCase();
  if (nameMap.has(lower)) {
    const list = nameMap.get(lower);
    if (list.length === 1) return list[0];
    const error = new Error(`Referencia de entidad ambigua: '${ref}' coincide con múltiples entidades.`);
    error.code = 'AMBIGUOUS_ENTITY_REFERENCE';
    throw error;
  }

  return null;
}

/**
 * Generates the master models/index.js with all associations
 */
function generateModelsIndexFile(entities = [], relationships = [], options = {}) {
  const modelImports = [];
  const modelInits = [];
  const associationLines = [];
  const validationErrors = [];

  // Build ID and Name resolution maps
  const idMap = new Map();
  const nameMap = new Map();

  for (const entity of entities) {
    if (entity.id) idMap.set(entity.id, entity);
    const lowerName = entity.name.trim().toLowerCase();
    if (!nameMap.has(lowerName)) nameMap.set(lowerName, []);
    nameMap.get(lowerName).push(entity);
  }

  // Model initialization lines
  for (const entity of entities) {
    const name = toPascalCase(entity.name);
    modelImports.push(`const define${name} = require('./${name}');`);
    modelInits.push(`const ${name} = define${name}(sequelize);`);
  }

  // Track association pairs and aliases to prevent collisions
  const usedAliases = new Map(); // entityName -> Set of alias strings
  const getEntityAliases = (name) => {
    if (!usedAliases.has(name)) usedAliases.set(name, new Set());
    return usedAliases.get(name);
  };

  const processedRels = new Set();

  for (const rel of relationships) {
    const srcRef = rel.sourceEntityId || rel.source || rel.sourceEntity;
    const tgtRef = rel.targetEntityId || rel.target || rel.targetEntity;
    const sourceEntity = resolveEntity(srcRef, idMap, nameMap);
    const targetEntity = resolveEntity(tgtRef, idMap, nameMap);

    if (!sourceEntity || !targetEntity) {
      const missing = !sourceEntity ? (rel.sourceEntity || rel.source || rel.sourceEntityId) : (rel.targetEntity || rel.target || rel.targetEntityId);
      const err = {
        code: 'UNRESOLVED_RELATIONSHIP_ENDPOINT',
        relationId: rel.id || rel.codeId || 'rel',
        source: srcRef,
        target: tgtRef,
        message: `Relación no resuelta: la entidad '${missing}' no existe en el proyecto.`
      };
      validationErrors.push(err);
      if (options.strict) {
        const error = new Error(err.message);
        error.code = err.code;
        error.details = err;
        throw error;
      }
      continue;
    }

    const sourceName = toPascalCase(sourceEntity.name);
    const targetName = toPascalCase(targetEntity.name);

    let card;
    try {
      card = normalizeCardinality(rel.cardinality);
    } catch (e) {
      validationErrors.push({
        code: 'INVALID_CARDINALITY',
        relationId: rel.id || rel.codeId || 'rel',
        message: e.message
      });
      if (options.strict) throw e;
      continue;
    }

    const relKey = `${sourceEntity.id || sourceName}->${targetEntity.id || targetName}:${card}:${rel.as || ''}`;
    if (processedRels.has(relKey)) continue;
    processedRels.add(relKey);

    const isSelfRef = sourceName === targetName;
    const sourceAliases = getEntityAliases(sourceName);
    const targetAliases = getEntityAliases(targetName);

    // Derive or use explicit Foreign Keys and Aliases
    const sourceFk = rel.foreignKey || `${toCamelCase(sourceName)}Id`;
    const targetFk = rel.otherKey || `${toCamelCase(targetName)}Id`;

    let targetAs = rel.as;
    let sourceAs = rel.reverseAs;

    if (isSelfRef) {
      targetAs = targetAs || 'children';
      sourceAs = sourceAs || 'parent';
      const selfFk = rel.foreignKey || 'parentId';

      associationLines.push(`  // Autorrelación: ${sourceName} -> ${sourceName} (Jerarquía)`);
      associationLines.push(`  ${sourceName}.hasMany(${sourceName}, { foreignKey: '${selfFk}', as: '${targetAs}', onDelete: '${rel.onDelete || 'RESTRICT'}' });`);
      associationLines.push(`  ${sourceName}.belongsTo(${sourceName}, { foreignKey: '${selfFk}', as: '${sourceAs}' });`);
      continue;
    }

    // Default aliases
    if (!targetAs) {
      if (card === '1:N' || card === 'N:M') {
        targetAs = toCamelCase(toSnakeCasePlural(targetName));
      } else {
        targetAs = toCamelCase(targetName);
      }
    }

    if (!sourceAs) {
      sourceAs = toCamelCase(sourceName);
    }

    // Disambiguate if alias collision
    if (sourceAliases.has(targetAs)) {
      targetAs = `${targetAs}_${rel.id ? rel.id.slice(0, 4) : 'rel'}`;
    }
    sourceAliases.add(targetAs);

    if (targetAliases.has(sourceAs)) {
      sourceAs = `${sourceAs}_${rel.id ? rel.id.slice(0, 4) : 'rel'}`;
    }
    targetAliases.add(sourceAs);

    const deletePolicy = rel.onDelete || 'RESTRICT';

    if (card === 'N:M') {
      const throughTable = rel.throughTable || `${sourceName}${targetName}s`;
      associationLines.push(`  // Relación Muchos a Muchos: ${sourceName} <--> ${targetName}`);
      associationLines.push(`  ${sourceName}.belongsToMany(${targetName}, { through: '${throughTable}', foreignKey: '${sourceFk}', otherKey: '${targetFk}', as: '${targetAs}' });`);
      associationLines.push(`  ${targetName}.belongsToMany(${sourceName}, { through: '${throughTable}', foreignKey: '${targetFk}', otherKey: '${sourceFk}', as: '${sourceAs}' });`);
    } else if (card === '1:1') {
      associationLines.push(`  // Relación Uno a Uno: ${sourceName} <-> ${targetName}`);
      associationLines.push(`  ${sourceName}.hasOne(${targetName}, { foreignKey: '${sourceFk}', as: '${targetAs}', onDelete: '${deletePolicy}' });`);
      associationLines.push(`  ${targetName}.belongsTo(${sourceName}, { foreignKey: '${sourceFk}', as: '${sourceAs}' });`);
    } else if (card === 'N:1') {
      // Inverse: Target hasMany Source, Source belongsTo Target
      associationLines.push(`  // Relación Muchos a Uno: ${sourceName} (N) -> ${targetName} (1)`);
      associationLines.push(`  ${targetName}.hasMany(${sourceName}, { foreignKey: '${targetFk}', as: '${sourceAs}', onDelete: '${deletePolicy}' });`);
      associationLines.push(`  ${sourceName}.belongsTo(${targetName}, { foreignKey: '${targetFk}', as: '${targetAs}' });`);
    } else {
      // 1:N default: Source hasMany Target, Target belongsTo Source
      associationLines.push(`  // Relación Uno a Muchos: ${sourceName} (1) -> ${targetName} (N)`);
      associationLines.push(`  ${sourceName}.hasMany(${targetName}, { foreignKey: '${sourceFk}', as: '${targetAs}', onDelete: '${deletePolicy}' });`);
      associationLines.push(`  ${targetName}.belongsTo(${sourceName}, { foreignKey: '${sourceFk}', as: '${sourceAs}' });`);
    }
  }

  // Generate dynamic lifecycle hooks ONLY if provided via options.businessRules
  const dynamicHookLines = [];
  if (Array.isArray(options.businessRules) && options.businessRules.length > 0) {
    for (const rule of options.businessRules) {
      if (rule.hookCode) {
        dynamicHookLines.push(`// Regla de Negocio: ${rule.code || 'BR'}\n${rule.hookCode}`);
      }
    }
  }

  const modelExports = entities.map(e => toPascalCase(e.name)).join(',\n  ');

  const fileContent = `/**
 * Inicializador y Asociaciones de Modelos Sequelize
 * Generado automáticamente por ICASE Studio
 */

const sequelize = require('../config/database');

// Importación de definiciones de modelos
${modelImports.join('\n')}

// Instanciación de modelos
${modelInits.join('\n')}

// Definición de Asociaciones (Relaciones)
${associationLines.length > 0 ? associationLines.join('\n') : '  // Sin asociaciones entre entidades configuradas'}
${dynamicHookLines.length > 0 ? '\n// Reglas de Negocio Aprobadas\n' + dynamicHookLines.join('\n\n') : ''}

module.exports = {
  sequelize,
  ${modelExports}
};
`;

  return fileContent;
}

module.exports = {
  normalizeCardinality,
  resolveEntity,
  generateModelFile,
  generateModelsIndexFile
};
