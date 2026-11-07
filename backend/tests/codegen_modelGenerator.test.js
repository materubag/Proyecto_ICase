const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeCardinality,
  resolveEntity,
  generateModelFile,
  generateModelsIndexFile
} = require('../src/services/codegen/modelGenerator');

test('normalizeCardinality handles standard and verbose cardinalities', () => {
  assert.equal(normalizeCardinality('1:1'), '1:1');
  assert.equal(normalizeCardinality('ONE_TO_ONE'), '1:1');
  assert.equal(normalizeCardinality('1:N'), '1:N');
  assert.equal(normalizeCardinality('ONE_TO_MANY'), '1:N');
  assert.equal(normalizeCardinality('MANY_TO_ONE'), 'N:1');
  assert.equal(normalizeCardinality('N:M'), 'N:M');
  assert.equal(normalizeCardinality('MANY_TO_MANY'), 'N:M');
  assert.equal(normalizeCardinality('*..*'), 'N:M');

  assert.throws(() => {
    normalizeCardinality('INVALID_CARD');
  }, (err) => err.code === 'INVALID_CARDINALITY');
});

test('generateModelsIndexFile resolves relationships with UUIDs and generates proper associations', () => {
  const entities = [
    { id: '11111111-1111-1111-1111-111111111111', name: 'Usuario', attributes: [] },
    { id: '22222222-2222-2222-2222-222222222222', name: 'Prestamo', attributes: [] }
  ];

  const relationships = [
    {
      id: 'rel-1',
      source: '11111111-1111-1111-1111-111111111111',
      target: '22222222-2222-2222-2222-222222222222',
      cardinality: '1:N'
    }
  ];

  const code = generateModelsIndexFile(entities, relationships);
  assert.ok(code.includes("Usuario.hasMany(Prestamo, { foreignKey: 'usuarioId', as: 'prestamos', onDelete: 'RESTRICT' });"));
  assert.ok(code.includes("Prestamo.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });"));

  // Ensure no hardcoded automotive text
  assert.ok(!code.includes('P0300'));
  assert.ok(!code.includes('Actividad'));
  assert.ok(!code.includes('Autron21'));
});

test('generateModelsIndexFile supports self-references cleanly', () => {
  const entities = [
    { id: 'cat-id', name: 'Categoria', attributes: [] }
  ];
  const relationships = [
    {
      id: 'self-rel',
      source: 'cat-id',
      target: 'cat-id',
      cardinality: '1:N',
      as: 'subcategorias',
      reverseAs: 'categoriaPadre',
      foreignKey: 'categoriaPadreId'
    }
  ];

  const code = generateModelsIndexFile(entities, relationships);
  assert.ok(code.includes("Categoria.hasMany(Categoria, { foreignKey: 'categoriaPadreId', as: 'subcategorias'"));
  assert.ok(code.includes("Categoria.belongsTo(Categoria, { foreignKey: 'categoriaPadreId', as: 'categoriaPadre'"));
});

test('generateModelsIndexFile handles multiple relationships between same entities with distinct aliases', () => {
  const entities = [
    { id: 'user-id', name: 'Usuario', attributes: [] },
    { id: 'doc-id', name: 'Documento', attributes: [] }
  ];

  const relationships = [
    { id: 'rel-autor', source: 'user-id', target: 'doc-id', cardinality: '1:N', as: 'documentosCreados', reverseAs: 'autor' },
    { id: 'rel-revisor', source: 'user-id', target: 'doc-id', cardinality: '1:N', as: 'documentosRevisados', reverseAs: 'revisor' }
  ];

  const code = generateModelsIndexFile(entities, relationships);
  assert.ok(code.includes("as: 'documentosCreados'"));
  assert.ok(code.includes("as: 'autor'"));
  assert.ok(code.includes("as: 'documentosRevisados'"));
  assert.ok(code.includes("as: 'revisor'"));
});

test('generateModelsIndexFile throws on unresolved entities in strict mode', () => {
  const entities = [{ id: 'ent-1', name: 'Producto' }];
  const relationships = [{ source: 'ent-1', target: 'non-existent-id', cardinality: '1:N' }];

  assert.throws(() => {
    generateModelsIndexFile(entities, relationships, { strict: true });
  }, (err) => err.code === 'UNRESOLVED_RELATIONSHIP_ENDPOINT');
});

test('generateModelFile produces clean model definition preserving constraints', () => {
  const entity = {
    name: 'Libro',
    description: 'Catálogo de libros disponibles',
    attributes: [
      { name: 'isbn', type: 'string', length: 20, allowNull: false, unique: true },
      { name: 'titulo', type: 'string', length: 200, allowNull: false },
      { name: 'stock', type: 'int', defaultValue: 0 }
    ]
  };

  const code = generateModelFile(entity);
  assert.ok(code.includes("const Libro = sequelize.define('Libro',"));
  assert.ok(code.includes("tableName: 'libros'"));
  assert.ok(code.includes("isbn: {"));
  assert.ok(code.includes("unique: true"));
  assert.ok(code.includes("type: DataTypes.STRING(20)"));
  assert.ok(code.includes("defaultValue: 0"));
});
