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
  const projectRoles = (spec.security?.roles || spec.roles || ['Administrador', 'Usuario']).filter(Boolean);
  if (!projectRoles.some(r => /admin/i.test(r))) {
    projectRoles.unshift('Administrador');
  }
  const serializedRoles = JSON.stringify(projectRoles);

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

  console.log('[MIGRATE] Migraciones completadas exitosamente.');

  // Sembrado automático de datos iniciales esenciales (Roles y Usuario Administrador)
  await seedInitialData(sequelize, queryInterface);
}

async function seedInitialData(sequelize, queryInterface) {
  try {
    const tables = await queryInterface.showAllTables();
    let defaultRoleId = 1;

    // 1. Detectar y sembrar tabla de Roles (ej. 'roles', 'rols', 'rol')
    const roleTable = tables.find(t => /^roles?$/i.test(t));
    if (roleTable) {
      const [existingRoles] = await sequelize.query('SELECT * FROM "' + roleTable + '" LIMIT 10').catch(() => [[]]);
      const desc = await queryInterface.describeTable(roleTable).catch(() => ({}));
      const nameCol = Object.keys(desc).find(c => /^(nombre|name|titulo|title|rol)$/i.test(c)) || 'nombre';
      const pkCol = Object.keys(desc).find(c => desc[c].primaryKey) || 'id';

      if (!existingRoles || existingRoles.length === 0) {
        console.log('[SEED] Sembrando roles iniciales en "' + roleTable + '"...');
        const initialRoles = ${serializedRoles};
        for (const rName of initialRoles) {
          const row = { [nameCol]: rName };
          if (desc.created_at) row.created_at = new Date();
          if (desc.updated_at) row.updated_at = new Date();
          if (desc.createdAt) row.createdAt = new Date();
          if (desc.updatedAt) row.updatedAt = new Date();
          await queryInterface.bulkInsert(roleTable, [row]).catch(() => {});
        }
        console.log('[SEED] Roles sembrados: ' + initialRoles.join(', '));
      }

      const [allRoles] = await sequelize.query('SELECT * FROM "' + roleTable + '"').catch(() => [[]]);
      const adminRole = (allRoles || []).find(r => /admin/i.test(r[nameCol])) || (allRoles || [])[0];
      if (adminRole) {
        defaultRoleId = adminRole[pkCol];
      }
    }

    // 2. Detectar y sembrar tabla de Usuarios (ej. 'usuarios', 'users', 'auth_users')
    const userTable = tables.find(t => /^(usuarios|users|auth_users|cuentas)$/i.test(t));
    if (userTable) {
      const [existingUsers] = await sequelize.query('SELECT * FROM "' + userTable + '" LIMIT 1').catch(() => [[]]);
      if (!existingUsers || existingUsers.length === 0) {
        console.log('[SEED] Sembrando usuario administrador inicial en "' + userTable + '"...');
        const bcrypt = require('bcryptjs');
        const adminPass = process.env.INITIAL_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'admin123';
        const adminEmail = process.env.INITIAL_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@example.com';
        const adminUsername = process.env.INITIAL_ADMIN_USER || process.env.ADMIN_USER || 'admin';
        const hash = await bcrypt.hash(adminPass, 10);
        const desc = await queryInterface.describeTable(userTable).catch(() => ({}));

        const userCol = Object.keys(desc).find(c => /^(username|usuario|login|user)$/i.test(c));
        const emailCol = Object.keys(desc).find(c => /^(email|correo|mail)$/i.test(c));
        const passCol = Object.keys(desc).find(c => /^(password_?hash|password|contrasena|clave|hash)$/i.test(c));
        const roleCol = Object.keys(desc).find(c => /^(rol_?id|role_?id|id_?rol|rol|role)$/i.test(c));
        const nameCol = Object.keys(desc).find(c => /^(nombre|name|nombre_completo)$/i.test(c));

        const adminUser = {};
        if (userCol) adminUser[userCol] = adminUsername;
        if (emailCol) adminUser[emailCol] = adminEmail;
        if (passCol) adminUser[passCol] = hash;
        if (nameCol && !userCol) adminUser[nameCol] = adminUsername;
        else if (nameCol) adminUser[nameCol] = 'Administrador Sistema';

        if (roleCol) {
          const colType = (desc[roleCol].type || '').toUpperCase();
          if (colType.includes('INT') || typeof defaultRoleId === 'number') {
            adminUser[roleCol] = defaultRoleId;
          } else {
            adminUser[roleCol] = 'Administrador';
          }
        }

        if (desc.created_at) adminUser.created_at = new Date();
        if (desc.updated_at) adminUser.updated_at = new Date();
        if (desc.createdAt) adminUser.createdAt = new Date();
        if (desc.updatedAt) adminUser.updatedAt = new Date();

        await queryInterface.bulkInsert(userTable, [adminUser]).catch(err => {
          console.warn('[SEED WARN] No se pudo insertar usuario semilla automáticamente:', err.message);
        });

        console.log('----------------------------------------------------');
        console.log('[SEED] ¡USUARIO SEMILLA CREADO EXITOSAMENTE!');
        console.log('[SEED] Usuario / Email : ' + adminUsername + ' / ' + adminEmail);
        console.log('[SEED] Rol              : Administrador');
        console.log('----------------------------------------------------');
      }
    }
  } catch (seedErr) {
    console.warn('[SEED WARN] Error en proceso de sembrado inicial:', seedErr.message);
  }
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
