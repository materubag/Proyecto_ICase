/**
 * Model Generator for Sequelize
 * Generates individual model files and models/index.js with associations
 */

const { toPascalCase, toCamelCase, toSnakeCasePlural, normalizeAttributes } = require('./typeMapper');

/**
 * Generates the source code for an individual Sequelize model file
 */
function generateModelFile(entity) {
  const modelName = toPascalCase(entity.name);
  const tableName = toSnakeCasePlural(entity.name);
  const normalizedAttrs = normalizeAttributes(entity.attributes || []);

  const attributeLines = normalizedAttrs.map(attr => {
    const options = [
      `type: ${attr.dataType}`,
      `allowNull: ${attr.allowNull}`
    ];
    if (attr.isPk) {
      options.push('primaryKey: true');
      if (attr.autoIncrement || attr.dataType.includes('INTEGER')) {
        options.push('autoIncrement: true');
      }
    }

    return `    ${attr.fieldName}: {\n      ${options.join(',\n      ')}\n    }`;
  }).join(',\n');

  return `/**
 * Modelo Sequelize para ${modelName}
 * Generado automáticamente por ICASE Studio
 * ${entity.description ? `Descripción: ${entity.description}` : ''}
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ${modelName} = sequelize.define('${modelName}', {
${attributeLines}
  }, {
    tableName: '${tableName}',
    timestamps: true,
    underscored: true
  });

  return ${modelName};
};
`;
}

/**
 * Generates the master models/index.js with all associations
 */
function generateModelsIndexFile(entities = [], relationships = []) {
  const modelImports = [];
  const modelInits = [];
  const associationLines = [];

  const entityNames = new Set(entities.map(e => toPascalCase(e.name)));

  // Model initialization
  for (const entity of entities) {
    const name = toPascalCase(entity.name);
    modelImports.push(`const define${name} = require('./${name}');`);
    modelInits.push(`const ${name} = define${name}(sequelize);`);
  }

  // Association generation
  const processedRels = new Set();

  for (const rel of relationships) {
    const sourceName = toPascalCase(rel.source);
    const targetName = toPascalCase(rel.target);

    // Skip relationships pointing to non-existent entities
    if (!entityNames.has(sourceName) || !entityNames.has(targetName)) continue;
    if (sourceName === targetName) continue; // skip circular self-ref for simplicity

    const relKey = `${sourceName}->${targetName}`;
    if (processedRels.has(relKey)) continue;
    processedRels.add(relKey);

    const card = (rel.cardinality || '1:N').replace(/\s+/g, '');
    const sourceFk = `${toCamelCase(sourceName)}Id`;
    const targetFk = `${toCamelCase(targetName)}Id`;
    const targetPlural = toCamelCase(toSnakeCasePlural(targetName));
    const sourcePlural = toCamelCase(toSnakeCasePlural(sourceName));
    const targetSingular = toCamelCase(targetName);
    const sourceSingular = toCamelCase(sourceName);

    if (card === 'N:M' || card === '*:*' || card === '*..*') {
      const throughTable = `${sourceName}${targetName}s`;
      associationLines.push(`  // Relación Muchos a Muchos: ${sourceName} <--> ${targetName}`);
      associationLines.push(`  ${sourceName}.belongsToMany(${targetName}, { through: '${throughTable}', foreignKey: '${sourceFk}', as: '${targetPlural}' });`);
      associationLines.push(`  ${targetName}.belongsToMany(${sourceName}, { through: '${throughTable}', foreignKey: '${targetFk}', as: '${sourcePlural}' });`);
    } else if (card === '1:1') {
      associationLines.push(`  // Relación Uno a Uno: ${sourceName} <-> ${targetName}`);
      associationLines.push(`  ${sourceName}.hasOne(${targetName}, { foreignKey: '${sourceFk}', as: '${targetSingular}', onDelete: 'CASCADE' });`);
      associationLines.push(`  ${targetName}.belongsTo(${sourceName}, { foreignKey: '${sourceFk}', as: '${sourceSingular}' });`);
    } else {
      // Default: 1:N
      associationLines.push(`  // Relación Uno a Muchos: ${sourceName} (1) -> ${targetName} (N)`);
      associationLines.push(`  ${sourceName}.hasMany(${targetName}, { foreignKey: '${sourceFk}', as: '${targetPlural}', onDelete: 'CASCADE' });`);
      associationLines.push(`  ${targetName}.belongsTo(${sourceName}, { foreignKey: '${sourceFk}', as: '${sourceSingular}' });`);
    }
  }

  const modelExports = entities.map(e => toPascalCase(e.name)).join(',\n  ');

  return `/**
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

module.exports = {
  sequelize,
  ${modelExports}
};
`;
}

module.exports = {
  generateModelFile,
  generateModelsIndexFile
};
