/**
 * Migration Generator for Sequelize
 * Produces timestamped, versioned database migration files for PostgreSQL.
 * Solves camelCase vs snake_case column mapping, creates N:M join tables,
 * and adds foreign key constraints in a cycle-safe manner.
 */

const { deriveNaming, toSnakeCase, toSnakeCasePlural, toPascalCase } = require('./typeMapper');

function generateMigrationForEntity(entity, relationships = [], timestamp = null) {
  const ts = timestamp || new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const naming = deriveNaming(entity.name);
  const fileName = `${ts}-create-${naming.tableName}.js`;

  const attrLines = (entity.attributes || []).map(attr => {
    const colName = attr.columnName || toSnakeCase(attr.fieldName);
    const cleanType = (attr.type || attr.dataType || 'STRING').replace('DataTypes.', '');
    const lines = [
      `type: Sequelize.${cleanType}`,
      `allowNull: ${attr.allowNull !== undefined ? attr.allowNull : true}`
    ];

    if (attr.isPk) {
      lines.push('primaryKey: true');
    }

    if (attr.autoIncrement) {
      lines.push('autoIncrement: true');
    }

    if (attr.unique) {
      lines.push('unique: true');
    }

    if (attr.defaultValue !== null && attr.defaultValue !== undefined) {
      if (attr.defaultValue === 'NOW') {
        lines.push('defaultValue: Sequelize.fn("now")');
      } else if (attr.defaultValue === 'UUIDV4') {
        lines.push('defaultValue: Sequelize.UUIDV4');
      } else {
        lines.push(`defaultValue: ${JSON.stringify(attr.defaultValue)}`);
      }
    }

    return `      ${colName}: {\n        ${lines.join(',\n        ')}\n      }`;
  });

  // Standard timestamps
  attrLines.push(`      created_at: {\n        type: Sequelize.DATE,\n        allowNull: false,\n        defaultValue: Sequelize.fn("now")\n      }`);
  attrLines.push(`      updated_at: {\n        type: Sequelize.DATE,\n        allowNull: false,\n        defaultValue: Sequelize.fn("now")\n      }`);

  const content = `'use strict';

/**
 * Migración Sequelize para tabla: ${naming.tableName}
 * Entidad: ${naming.modelName}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('${naming.tableName}', {
${attrLines.join(',\n')}
    });
${(entity.indexes || []).map((index, position) => `    await queryInterface.addIndex('${naming.tableName}', ${JSON.stringify(index.fields.map(field => entity.attributes.find(attr => attr.fieldName === field)?.columnName || toSnakeCase(field)))}, { unique: ${index.unique === true}, name: '${naming.tableName}_reviewed_${position}' });`).join('\n')}
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('${naming.tableName}');
  }
};
`;

  return {
    fileName,
    content
  };
}

/**
 * Generates an intermediate join table migration for N:M relationships
 */
function generateMigrationForJoinTable(rel, sourceEntity, targetEntity, timestamp = null) {
  const ts = timestamp || new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const srcNaming = deriveNaming(sourceEntity.name);
  const tgtNaming = deriveNaming(targetEntity.name);

  const throughTable = rel.through || `${srcNaming.tableName}_${tgtNaming.tableName}`;
  const fileName = `${ts}-create-join-${throughTable}.js`;

  const srcFkCol = toSnakeCase(rel.foreignKey || `${srcNaming.paramName}Id`);
  const tgtFkCol = toSnakeCase(rel.otherKey || `${tgtNaming.paramName}Id`);

  // Detect PK type of source and target (integer or uuid)
  const srcPkAttr = (sourceEntity.attributes || []).find(a => a.isPk);
  const tgtPkAttr = (targetEntity.attributes || []).find(a => a.isPk);
  const srcPkType = (srcPkAttr?.type || srcPkAttr?.dataType || '').includes('UUID') ? 'UUID' : 'INTEGER';
  const tgtPkType = (tgtPkAttr?.type || tgtPkAttr?.dataType || '').includes('UUID') ? 'UUID' : 'INTEGER';

  const content = `'use strict';

/**
 * Migración Sequelize para tabla intermedia N:M: ${throughTable}
 * Entre: ${srcNaming.modelName} <--> ${tgtNaming.modelName}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('${throughTable}', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      ${srcFkCol}: {
        type: Sequelize.${srcPkType},
        allowNull: false,
        references: {
          model: '${srcNaming.tableName}',
          key: '${srcPkAttr?.columnName || 'id'}'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      ${tgtFkCol}: {
        type: Sequelize.${tgtPkType},
        allowNull: false,
        references: {
          model: '${tgtNaming.tableName}',
          key: '${tgtPkAttr?.columnName || 'id'}'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("now")
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("now")
      }
    });

    await queryInterface.addIndex('${throughTable}', ['${srcFkCol}', '${tgtFkCol}'], {
      unique: true,
      name: 'idx_${throughTable}_unique'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('${throughTable}');
  }
};
`;

  return {
    fileName,
    content
  };
}

/**
 * Generates cycle-safe foreign key constraints after all tables have been created
 */
function generateMigrationForConstraints(relationships = [], entities = [], timestamp = null) {
  const ts = timestamp || new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const fileName = `${ts}-add-foreign-keys.js`;

  const entityMap = new Map();
  for (const ent of entities) {
    entityMap.set(ent.id, ent);
    entityMap.set(ent.name.toLowerCase(), ent);
  }

  const addConstraintLines = [];
  const removeConstraintLines = [];

  for (const rel of relationships) {
    if (rel.cardinality === 'N:M') continue; // handled by join table

    const src = entityMap.get(rel.sourceEntityId) || entityMap.get((rel.sourceEntity || '').toLowerCase());
    const tgt = entityMap.get(rel.targetEntityId) || entityMap.get((rel.targetEntity || '').toLowerCase());
    if (!src || !tgt) continue;

    const srcNaming = deriveNaming(src.name);
    const tgtNaming = deriveNaming(tgt.name);

    // Detect PK columns and types of source and target entities
    const srcPkAttr = (src.attributes || []).find(a => a.isPk);
    const tgtPkAttr = (tgt.attributes || []).find(a => a.isPk);

    const srcPkCol = srcPkAttr ? (srcPkAttr.columnName || toSnakeCase(srcPkAttr.fieldName)) : 'id';
    const tgtPkCol = tgtPkAttr ? (tgtPkAttr.columnName || toSnakeCase(tgtPkAttr.fieldName)) : 'id';

    const srcPkType = (srcPkAttr?.type || srcPkAttr?.dataType || 'INTEGER').replace('DataTypes.', '');
    const tgtPkType = (tgtPkAttr?.type || tgtPkAttr?.dataType || 'INTEGER').replace('DataTypes.', '');

    // In 1:N, target table holds FK pointing to source
    // In N:1, source table holds FK pointing to target
    let hostTable, hostCol, refTable, refCol, refType, constraintName;

    if (rel.cardinality === 'N:1') {
      hostTable = srcNaming.tableName;
      hostCol = toSnakeCase(rel.foreignKey || `${tgtNaming.paramName}_id`);
      refTable = tgtNaming.tableName;
      refCol = tgtPkCol;
      refType = tgtPkType;
      constraintName = `fk_${hostTable}_${tgtNaming.paramName}_${hostCol}`;
    } else {
      // 1:N or 1:1
      hostTable = tgtNaming.tableName;
      hostCol = toSnakeCase(rel.foreignKey || `${srcNaming.paramName}_id`);
      refTable = srcNaming.tableName;
      refCol = srcPkCol;
      refType = srcPkType;
      constraintName = `fk_${hostTable}_${srcNaming.paramName}_${hostCol}`;
    }

    const cleanRefType = (refType || 'INTEGER').includes('UUID') ? 'UUID' : (refType || 'INTEGER');
    const descVar = `desc_${addConstraintLines.length + 1}`;

    addConstraintLines.push(`    // Verificar y asegurar columna foránea '${hostCol}' con tipo coincidente en '${hostTable}'
    const ${descVar} = await queryInterface.describeTable('${hostTable}');
    if (!${descVar}['${hostCol}']) {
      await queryInterface.addColumn('${hostTable}', '${hostCol}', {
        type: Sequelize.${cleanRefType},
        allowNull: true
      });
    }
    await queryInterface.addConstraint('${hostTable}', {
      fields: ['${hostCol}'],
      type: 'foreign key',
      name: '${constraintName}',
      references: {
        table: '${refTable}',
        field: '${refCol}'
      },
      onDelete: '${rel.onDelete || 'RESTRICT'}',
      onUpdate: 'CASCADE'
    });`);

    removeConstraintLines.push(`    await queryInterface.removeConstraint('${hostTable}', '${constraintName}');`);
  }

  if (addConstraintLines.length === 0) {
    return null;
  }

  const content = `'use strict';

/**
 * Migración para claves foráneas y restricciones relacionales
 * Ejecutada tras la creación de todas las tablas base para admitir dependencias circulares.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
${addConstraintLines.join('\n\n')}
  },

  async down(queryInterface, Sequelize) {
${removeConstraintLines.join('\n')}
  }
};
`;

  return {
    fileName,
    content
  };
}

/**
 * Standalone migration runner script (backend/src/migrate.js)
 */
function generateMigrationRunnerFile(spec = {}) {
  return `'use strict';

/**
 * Ejecutor autónomo de migraciones Sequelize
 * Generado automáticamente por ICASE Studio.
 * No depende de CLIs externos y registra ejecuciones en SequelizeMeta.
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const sequelize = require('./config/database');

async function runMigrations() {
  console.log('[MIGRATE] Conectando a PostgreSQL...');
  await sequelize.authenticate();
  console.log('[MIGRATE] Conexión establecida con la base de datos.');

  const queryInterface = sequelize.getQueryInterface();

  // Asegurar tabla SequelizeMeta
  await queryInterface.createTable('SequelizeMeta', {
    name: {
      type: sequelize.Sequelize.STRING,
      allowNull: false,
      unique: true,
      primaryKey: true
    }
  }).catch(() => {});

  const [rows] = await sequelize.query('SELECT name FROM "SequelizeMeta"').catch(() => [[]]);
  const executed = new Set((rows || []).map(r => r.name));

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('[MIGRATE] No se encontró la carpeta de migraciones. Omitiendo.');
    return;
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js')).sort();

  for (const file of files) {
    if (executed.has(file)) {
      console.log(\`[MIGRATE] Ya ejecutada: \${file}\`);
      continue;
    }

    console.log(\`[MIGRATE] Aplicando: \${file}...\`);
    const migration = require(path.join(migrationsDir, file));
    await migration.up(queryInterface, sequelize.Sequelize);

    await sequelize.query('INSERT INTO "SequelizeMeta" (name) VALUES (:name)', {
      replacements: { name: file }
    });
    console.log(\`[MIGRATE] OK: \${file}\`);
  }

  ${spec.permissionMatrix ? "await require('./seed-permissions').seed();" : ''}
  console.log('[MIGRATE] Migraciones completadas exitosamente.');

}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[MIGRATE ERROR]', err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
`;
}

/**
 * Sequelize CLI configuration (.sequelizerc)
 */
function generateSequelizercFile() {
  return `const path = require('path');

module.exports = {
  'config': path.resolve('src/config', 'database.js'),
  'models-path': path.resolve('src', 'models'),
  'seeders-path': path.resolve('src', 'seeders'),
  'migrations-path': path.resolve('src', 'migrations')
};
`;
}

module.exports = {
  generateMigrationForEntity,
  generateMigrationForJoinTable,
  generateMigrationForConstraints,
  generateMigrationRunnerFile,
  generateSequelizercFile
};
