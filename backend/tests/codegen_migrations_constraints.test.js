const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateMigrationForEntity,
  generateMigrationForJoinTable,
  generateMigrationForConstraints,
  generateMigrationRunnerFile
} = require('../src/services/codegen/migrationGenerator');

test('Sequelize Migrations: Preserves non-id primary key names and UUID types in foreign keys', () => {
  const entities = [
    {
      id: 'ent-autor',
      name: 'Autor',
      attributes: [
        { fieldName: 'codigoAutor', columnName: 'codigo_autor', isPk: true, dataType: 'DataTypes.STRING', type: 'STRING' },
        { fieldName: 'nombre', columnName: 'nombre', dataType: 'DataTypes.STRING', type: 'STRING' }
      ]
    },
    {
      id: 'ent-libro',
      name: 'Libro',
      attributes: [
        { fieldName: 'isbn', columnName: 'isbn', isPk: true, dataType: 'DataTypes.STRING', type: 'STRING' },
        { fieldName: 'titulo', columnName: 'titulo', dataType: 'DataTypes.STRING', type: 'STRING' }
      ]
    }
  ];

  const relationships = [
    {
      id: 'rel-1',
      sourceEntityId: 'ent-autor',
      targetEntityId: 'ent-libro',
      sourceEntity: 'Autor',
      targetEntity: 'Libro',
      cardinality: '1:N',
      foreignKey: 'autor_codigo'
    }
  ];

  const constraintMig = generateMigrationForConstraints(relationships, entities, '20261026000001');

  assert.ok(constraintMig, 'Constraint migration must be generated');
  // Check that the referenced column is 'codigo_autor', NOT 'id'
  assert.ok(constraintMig.content.includes("field: 'codigo_autor'"), 'Must reference actual non-id PK column name');
  // Check that host column is created with type matching referenced PK (STRING, not hardcoded INTEGER)
  assert.ok(constraintMig.content.includes('type: Sequelize.STRING'), 'Must match referenced PK type (STRING)');
  // Check that error swallowing try-catch was eliminated
  assert.equal(constraintMig.content.includes('catch (e) {'), false, 'Must not catch and swallow migration errors');
});

test('Sequelize Migrations: Supports UUID primary keys in join tables and constraints', () => {
  const entities = [
    {
      id: 'ent-paciente',
      name: 'Paciente',
      attributes: [
        { fieldName: 'id', isPk: true, type: 'UUID', defaultValue: 'UUIDV4' }
      ]
    },
    {
      id: 'ent-medico',
      name: 'Medico',
      attributes: [
        { fieldName: 'id', isPk: true, type: 'UUID', defaultValue: 'UUIDV4' }
      ]
    }
  ];

  const joinRel = {
    sourceEntityId: 'ent-paciente',
    targetEntityId: 'ent-medico',
    cardinality: 'N:M'
  };

  const joinMig = generateMigrationForJoinTable(joinRel, entities[0], entities[1], '20261026000002');
  assert.ok(joinMig.content.includes('type: Sequelize.UUID'), 'Must use Sequelize.UUID for UUID foreign keys in join table');
});

test('Sequelize Migrations: Standalone migration runner halts on error', () => {
  const runnerCode = generateMigrationRunnerFile();
  assert.ok(runnerCode.includes('process.exit(1)'), 'Must exit with code 1 on migration failure');
  assert.ok(runnerCode.includes('[MIGRATE ERROR]'));
});
