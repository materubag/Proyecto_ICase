const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const codeGenerator = require('../src/services/codegen/codeGenerator.service');
const { validateProjectSpec } = require('../src/services/codegen/projectSpecValidator');
const codegenDecisionService = require('../src/services/codegen/codegenDecision.service');
const codegenAiRepairService = require('../src/services/codegen/codegenAiRepair.service');
const { createZipBuffer } = require('../src/services/codegen/zipHelper');

test('Multi-Domain Acceptance: Complete generic pipeline on non-automotive domain (Biblioteca Digital)', async () => {
  const projectId = 'proj_biblioteca_generic_acceptance';

  // 1. Define complete non-automotive domain spec (Biblioteca Digital)
  const bibliotecaSpec = {
    schemaVersion: '1.0.0',
    project: {
      id: projectId,
      name: 'Biblioteca Central',
      description: 'Sistema de Catálogo y Préstamos Bibliotecarios',
      platform: 'WEB',
      status: 'APPROVED'
    },
    technologies: [
      { name: 'React', category: 'FRONTEND', version: '18.3.1' },
      { name: 'Express', category: 'BACKEND', version: '4.19.2' },
      { name: 'PostgreSQL', category: 'DATABASE', version: '16' },
      { name: 'Sequelize', category: 'ORM', version: '6.37.3' }
    ],
    security: {
      authType: 'JWT',
      roles: ['Bibliotecario', 'Lector', 'Administrador'],
      tokenExpiry: '8h'
    },
    requirements: [
      { id: 'req_b1', code: 'RF-01', name: 'Gestión de Lectores', type: 'FUNCTIONAL', status: 'APPROVED', description: 'Registro de lectores con documento y nombre' },
      { id: 'req_b2', code: 'RF-02', name: 'Gestión de Libros', type: 'FUNCTIONAL', status: 'APPROVED', description: 'Registro de libros con ISBN y título' },
      { id: 'req_b3', code: 'RF-03', name: 'Préstamos de Libros', type: 'FUNCTIONAL', status: 'APPROVED', description: 'Asignación de ejemplar a lector con fecha límite' }
    ],
    actors: [
      { id: 'act_bib', name: 'Bibliotecario', status: 'APPROVED' },
      { id: 'act_lec', name: 'Lector', status: 'APPROVED' }
    ],
    entities: [
      {
        id: 'ent_lector',
        name: 'Lector',
        modelName: 'Lector',
        tableName: 'lectores',
        endpoint: 'lectores',
        paramName: 'lector',
        requirementIds: ['req_b1'],
        primaryKey: { fieldName: 'idLector', type: 'DataTypes.INTEGER' },
        attributes: [
          { fieldName: 'idLector', columnName: 'id_lector', isPk: true, dataType: 'DataTypes.INTEGER', allowNull: false, autoIncrement: true },
          { fieldName: 'nombre', columnName: 'nombre', isPk: false, dataType: 'DataTypes.STRING(150)', allowNull: false },
          { fieldName: 'documento', columnName: 'documento', isPk: false, dataType: 'DataTypes.STRING(50)', allowNull: false, unique: true },
          { fieldName: 'email', columnName: 'email', isPk: false, dataType: 'DataTypes.STRING(150)', allowNull: false, unique: true }
        ]
      },
      {
        id: 'ent_libro',
        name: 'Libro',
        modelName: 'Libro',
        tableName: 'libros',
        endpoint: 'libros',
        paramName: 'libro',
        requirementIds: ['req_b2'],
        primaryKey: { fieldName: 'idLibro', type: 'DataTypes.INTEGER' },
        attributes: [
          { fieldName: 'idLibro', columnName: 'id_libro', isPk: true, dataType: 'DataTypes.INTEGER', allowNull: false, autoIncrement: true },
          { fieldName: 'isbn', columnName: 'isbn', isPk: false, dataType: 'DataTypes.STRING(30)', allowNull: false, unique: true },
          { fieldName: 'titulo', columnName: 'titulo', isPk: false, dataType: 'DataTypes.STRING(250)', allowNull: false },
          { fieldName: 'autor', columnName: 'autor', isPk: false, dataType: 'DataTypes.STRING(150)', allowNull: false }
        ]
      },
      {
        id: 'ent_prestamo',
        name: 'Prestamo',
        modelName: 'Prestamo',
        tableName: 'prestamos',
        endpoint: 'prestamos',
        paramName: 'prestamo',
        requirementIds: ['req_b3'],
        primaryKey: { fieldName: 'idPrestamo', type: 'DataTypes.INTEGER' },
        attributes: [
          { fieldName: 'idPrestamo', columnName: 'id_prestamo', isPk: true, dataType: 'DataTypes.INTEGER', allowNull: false, autoIncrement: true },
          { fieldName: 'lectorId', columnName: 'lector_id', isPk: false, dataType: 'DataTypes.INTEGER', allowNull: false },
          { fieldName: 'libroId', columnName: 'libro_id', isPk: false, dataType: 'DataTypes.INTEGER', allowNull: false },
          { fieldName: 'fechaPrestamo', columnName: 'fecha_prestamo', isPk: false, dataType: 'DataTypes.DATEONLY', allowNull: false },
          { fieldName: 'fechaDevolucionLimite', columnName: 'fecha_devolucion_limite', isPk: false, dataType: 'DataTypes.DATEONLY', allowNull: false }
        ]
      }
    ],
    relationships: [
      {
        id: 'rel_lector_prestamos',
        sourceEntityId: 'ent_lector',
        sourceEntity: 'Lector',
        targetEntityId: 'ent_prestamo',
        targetEntity: 'Prestamo',
        cardinality: '1:N',
        foreignKey: 'lectorId',
        as: 'prestamos',
        reverseAs: 'lector'
      },
      {
        id: 'rel_libro_prestamos',
        sourceEntityId: 'ent_libro',
        sourceEntity: 'Libro',
        targetEntityId: 'ent_prestamo',
        targetEntity: 'Prestamo',
        cardinality: '1:N',
        foreignKey: 'libroId',
        as: 'prestamos',
        reverseAs: 'libro'
      }
    ],
    operations: [
      {
        operationId: 'op_lectores_list',
        name: 'Listar Lectores',
        entity: 'Lector',
        route: '/api/lectores',
        method: 'GET',
        requirementIds: ['req_b1'],
        authorizedRoles: ['Bibliotecario', 'Administrador'],
        input: { params: [], query: [] },
        output: { successStatus: 200 }
      },
      {
        operationId: 'op_libros_list',
        name: 'Listar Libros',
        entity: 'Libro',
        route: '/api/libros',
        method: 'GET',
        requirementIds: ['req_b2'],
        authorizedRoles: ['Bibliotecario', 'Lector', 'Administrador'],
        input: { params: [], query: [] },
        output: { successStatus: 200 }
      },
      {
        operationId: 'op_registrar_prestamo',
        name: 'Registrar Préstamo de Libro',
        type: 'BUSINESS_LOGIC',
        method: 'POST',
        route: '/api/operations/registrar-prestamo',
        targetEntity: 'Prestamo',
        requirementIds: ['req_b3'],
        authorizedRoles: ['Bibliotecario'],
        bindingVersion: 2,
        input: { bodySchema: { type: 'object', properties: { lectorId: { type: 'integer' }, libroId: { type: 'integer' }, fechaDevolucionLimite: { type: 'string', format: 'date' } }, required: ['lectorId', 'libroId', 'fechaDevolucionLimite'], additionalProperties: false } },
        resultStep: '3',
        steps: [
          { step: 1, action: 'QUERY', entity: 'Lector', where: { idLector: { $ref: 'payload.lectorId' } }, requireMatch: true },
          { step: 2, action: 'QUERY', entity: 'Libro', where: { idLibro: { $ref: 'payload.libroId' } }, requireMatch: true },
          { step: 3, action: 'CREATE', entity: 'Prestamo', fields: { lectorId: { $ref: 'payload.lectorId' }, libroId: { $ref: 'payload.libroId' }, fechaPrestamo: { $ref: 'now' }, fechaDevolucionLimite: { $ref: 'payload.fechaDevolucionLimite' } } }
        ],
        output: { successStatus: 201 }
      }
    ],
    screens: [
      {
        id: 'scr_lectores',
        name: 'GestionLectores',
        route: '/lectores',
        title: 'Gestión de Lectores',
        roles: ['Bibliotecario', 'Administrador'],
        connectedOperationId: 'op_lectores_list',
        requiresMockup: false,
        hasApprovedMockup: true,
        html: null,
        components: []
      },
      {
        id: 'scr_libros',
        name: 'CatalogoLibros',
        route: '/libros',
        title: 'Catálogo de Libros',
        roles: ['Bibliotecario', 'Lector'],
        connectedOperationId: 'op_libros_list',
        requiresMockup: false,
        hasApprovedMockup: true,
        html: null,
        components: []
      }
    ]
  };

  // 2. Validate Spec Quality Gates
  const diagnostics = validateProjectSpec(bibliotecaSpec);
  if (!diagnostics.ready) console.log('SPEC ERRORS:', diagnostics.errors);
  assert.equal(diagnostics.ready, true, 'Biblioteca specification must pass Quality Gates without blocking errors');

  // 3. AI Coherence Review
  const coherence = await codegenAiRepairService.reviewProjectCoherence(bibliotecaSpec);
  assert.equal(coherence.coherent, true, 'AI coherence check passes with no disconnected screens or uncovered entities');

  // 4. Generate all project files
  const generated = await codeGenerator.generateProjectFiles(null, {
    spec: bibliotecaSpec,
    includeDocker: true
  });

  assert.equal(generated.ready, true);
  assert.ok(generated.files.length >= 20, 'Generates full-stack application files for Biblioteca');

  // 5. Verify 100% absence of domain cross-contamination (Zero automotive hardcoding)
  const fullContent = generated.files.map(f => f.content).join('\n');
  assert.ok(!fullContent.includes('autron'), 'Generated code contains no references to autron');
  assert.ok(!fullContent.includes('kilometraje'), 'Generated code contains no references to kilometraje');
  assert.ok(!/\bplaca\b/.test(fullContent), 'Generated code contains no references to placa: ' + JSON.stringify(fullContent.match(/.{0,60}\bplaca\b.{0,60}/g)));
  assert.ok(!fullContent.includes('recepcion'), 'Generated code contains no references to recepcion');

  // 6. Verify Domain Entity Models & Routes are created properly
  assert.ok(generated.files.some(f => f.path.includes('models/Lector.js')), 'Lector model exists');
  assert.ok(generated.files.some(f => f.path.includes('models/Libro.js')), 'Libro model exists');
  assert.ok(generated.files.some(f => f.path.includes('models/Prestamo.js')), 'Prestamo model exists');
  assert.ok(generated.files.some(f => f.path.includes('routes/lector.routes.js')), 'Lector routes exist');
  assert.ok(generated.files.some(f => f.path.includes('pages/LectorPage.jsx')), 'LectorPage React component exists');

  // 7. Test output deletion and regeneration without manual changes produces identical content
  const tempDir1 = fs.mkdtempSync(path.join(__dirname, 'fixtures', 'biblio_run1_'));
  for (const f of generated.files) {
    const fullP = path.join(tempDir1, f.path);
    fs.mkdirSync(path.dirname(fullP), { recursive: true });
    fs.writeFileSync(fullP, f.content || '', 'utf8');
  }

  // Syntax check backend files
  const backendJs = fs.readdirSync(path.join(tempDir1, 'backend/src'), { recursive: true })
    .map(p => path.join(tempDir1, 'backend/src', p))
    .filter(p => typeof p === 'string' && p.endsWith('.js') && fs.statSync(p).isFile());

  for (const jsFile of backendJs) {
    const checkRes = spawnSync(process.execPath, ['--check', jsFile], { encoding: 'utf8' });
    assert.equal(checkRes.status, 0, `Syntax error in ${path.relative(tempDir1, jsFile)}: ${checkRes.stderr}`);
  }

  // Delete output directory completely
  fs.rmSync(tempDir1, { recursive: true, force: true });
  assert.equal(fs.existsSync(tempDir1), false, 'Output directory deleted completely');

  // Regenerate cleanly from persisted specification
  const regenerated = await codeGenerator.generateProjectFiles(null, {
    spec: bibliotecaSpec,
    includeDocker: true
  });

  assert.equal(regenerated.files.length, generated.files.length, 'Regenerated exactly same number of files');
  for (let i = 0; i < generated.files.length; i++) {
    assert.equal(regenerated.files[i].path, generated.files[i].path);
    assert.equal(regenerated.files[i].content, generated.files[i].content, `File ${generated.files[i].path} matches deterministically on regeneration`);
  }
});
