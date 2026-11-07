'use strict';

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
      console.log(`[MIGRATE] Ya ejecutada: ${file}`);
      continue;
    }

    console.log(`[MIGRATE] Aplicando: ${file}...`);
    const migration = require(path.join(migrationsDir, file));
    await migration.up(queryInterface, sequelize.Sequelize);

    await sequelize.query('INSERT INTO "SequelizeMeta" (name) VALUES (:name)', {
      replacements: { name: file }
    });
    console.log(`[MIGRATE] OK: ${file}`);
  }

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
