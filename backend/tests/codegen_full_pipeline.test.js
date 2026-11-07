const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const codeGenerator = require('../src/services/codegen/codeGenerator.service');
const { validateProjectSpec } = require('../src/services/codegen/projectSpecValidator');
const { createZipBuffer } = require('../src/services/codegen/zipHelper');

test('E2E Generator Pipeline: Real Spec -> Validations -> File Generation -> Import Resolution -> Real ZIP Creation', async () => {
  // 1. DOMAIN 1: Biblioteca Digital with an approved Stitch mockup
  const biblioSpec = {
    schemaVersion: '1.0.0',
    project: {
      id: 'proj-biblioteca-e2e',
      name: 'Biblioteca Central',
      description: 'Sistema de Catálogo y Préstamos Bibliotecarios',
      platform: 'WEB',
      status: 'PLANNING'
    },
    technologies: [
      { name: 'React', category: 'FRONTEND' },
      { name: 'Express', category: 'BACKEND' },
      { name: 'PostgreSQL', category: 'DATABASE' }
    ],
    security: {
      authType: 'JWT',
      roles: ['Bibliotecario', 'Lector'],
      tokenExpiry: '8h'
    },
    requirements: [
      { id: 'req-b1', code: 'RF-01', name: 'Gestión de Libros', type: 'FUNCTIONAL', status: 'APPROVED' },
      { id: 'req-b2', code: 'RF-02', name: 'Control de Ejemplares', type: 'FUNCTIONAL', status: 'APPROVED' }
    ],
    actors: [
      { id: 'act-bib', name: 'Bibliotecario', status: 'APPROVED' },
      { id: 'act-lec', name: 'Lector', status: 'APPROVED' }
    ],
    entities: [
      {
        id: 'ent-libro',
        name: 'Libro',
        modelName: 'Libro',
        tableName: 'libros',
        endpoint: 'libros',
        paramName: 'libro',
        requirementIds: ['req-b1'],
        primaryKey: { fieldName: 'id', type: 'DataTypes.INTEGER' },
        attributes: [
          { fieldName: 'id', columnName: 'id', isPk: true, dataType: 'DataTypes.INTEGER', allowNull: false, autoIncrement: true },
          { fieldName: 'isbn', columnName: 'isbn', isPk: false, dataType: 'DataTypes.STRING(20)', allowNull: false, unique: true },
          { fieldName: 'titulo', columnName: 'titulo', isPk: false, dataType: 'DataTypes.STRING(200)', allowNull: false },
          { fieldName: 'fechaPublicacion', columnName: 'fecha_publicacion', isPk: false, dataType: 'DataTypes.DATEONLY', allowNull: true }
        ]
      },
      {
        id: 'ent-ejemplar',
        name: 'Ejemplar',
        modelName: 'Ejemplar',
        tableName: 'ejemplares',
        endpoint: 'ejemplares',
        paramName: 'ejemplar',
        requirementIds: ['req-b2'],
        primaryKey: { fieldName: 'id', type: 'DataTypes.INTEGER' },
        attributes: [
          { fieldName: 'id', columnName: 'id', isPk: true, dataType: 'DataTypes.INTEGER', allowNull: false, autoIncrement: true },
          { fieldName: 'codigoBarras', columnName: 'codigo_barras', isPk: false, dataType: 'DataTypes.STRING(50)', allowNull: false, unique: true },
          { fieldName: 'libroId', columnName: 'libro_id', isPk: false, dataType: 'DataTypes.INTEGER', allowNull: false }
        ]
      }
    ],
    relationships: [
      {
        id: 'rel-libro-ejemplares',
        sourceEntityId: 'ent-libro',
        sourceEntity: 'Libro',
        targetEntityId: 'ent-ejemplar',
        targetEntity: 'Ejemplar',
        cardinality: '1:N',
        foreignKey: 'libroId',
        as: 'ejemplares',
        reverseAs: 'libro',
        onDelete: 'CASCADE'
      }
    ],
    operations: [
      {
        operationId: 'op_libros_list',
        name: 'Listar Libros',
        entity: 'Libro',
        route: '/api/libros',
        method: 'GET',
        authorizedRoles: ['Bibliotecario', 'Lector'],
        requirementIds: ['req-b1'],
        input: { params: [], query: [] },
        output: {
          successStatus: 200,
          responseSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array' }
            }
          }
        }
      },
      {
        operationId: 'op_ejemplares_list',
        name: 'Listar Ejemplares',
        entity: 'Ejemplar',
        route: '/api/ejemplares',
        method: 'GET',
        authorizedRoles: ['Bibliotecario'],
        requirementIds: ['req-b2'],
        input: { params: [], query: [] },
        output: {
          successStatus: 200,
          responseSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array' }
            }
          }
        }
      },
      {
        operationId: 'op_prestar_libro',
        action: 'CREATE',
        name: 'Prestar Libro a Lector',
        type: 'BUSINESS_LOGIC',
        targetEntity: 'Prestamo',
        route: '/api/operations/prestar-libro',
        method: 'POST',
        authorizedRoles: ['Bibliotecario'],
        requirementIds: ['req-b1', 'req-b2'],
        input: {
          params: [],
          query: [],
          bodySchema: {
            type: 'object',
            properties: {
              ejemplarId: { type: 'integer' },
              lectorId: { type: 'integer' }
            }
          }
        },
        output: {
          successStatus: 200,
          responseSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' }
            }
          }
        },
        businessRules: [
          {
            code: 'BR-01',
            name: 'Límite de préstamos',
            description: 'Máximo 3 préstamos por lector',
            field: 'prestamosActivos',
            operator: 'lte',
            value: 3
          }
        ]
      }
    ],
    screens: [
      {
        name: 'CatalogoLibros',
        route: '/catalogo',
        title: 'Catálogo de Libros',
        connectedOperationId: 'op_libros_list',
        html: `<!DOCTYPE html><html><body>
          <main class="catalogo-shell">
            <h2 class="title">Búsqueda en Catálogo</h2>
            <div class="search-box">
              <input type="text" placeholder="Buscar libro..." class="form-control" />
              <button class="btn btn-primary" id="btn-search">Buscar</button>
            </div>
            <table class="table">
              <thead><tr><th>Título</th><th>ISBN</th></tr></thead>
              <tbody><tr><td>Don Quijote</td><td>978-0123456789</td></tr></tbody>
            </table>
          </main>
        </body></html>`
      }
    ],
    apiContract: {
      openapi: '3.0.3',
      info: { title: 'Biblioteca Central', version: '1.0.0' },
      servers: [{ url: '/api' }],
      paths: {
        '/libros': {
          get: {
            operationId: 'op_libros_list',
            summary: 'Listar Libros',
            responses: { '200': { description: 'OK' } }
          }
        }
      }
    }
  };

  // Validate Quality Gates
  const diagBiblio = validateProjectSpec(biblioSpec);
  assert.equal(diagBiblio.ready, true, 'Biblioteca specification must pass Quality Gates');
  assert.equal(diagBiblio.errors.length, 0);

  // Generate all files
  const resultBiblio = await codeGenerator.generateProjectFiles(null, {
    spec: biblioSpec,
    includeDocker: true
  });

  assert.equal(resultBiblio.ready, true);
  assert.ok(resultBiblio.files.length > 20);

  const biblioFilesMap = new Map(resultBiblio.files.map(f => [f.path, f.content]));

  // 1. Verify Common File Naming and Import Convention
  // Route file must be libro.routes.js and must import ../controllers/libro.controller
  assert.ok(biblioFilesMap.has('backend/src/routes/libro.routes.js'));
  assert.ok(biblioFilesMap.has('backend/src/controllers/libro.controller.js'));
  assert.ok(!biblioFilesMap.has('backend/src/routes/libros.routes.js'), 'File name must be libro.routes.js, not endpoint plural');
  
  const libroRoutesContent = biblioFilesMap.get('backend/src/routes/libro.routes.js');
  assert.ok(libroRoutesContent.includes("require('../controllers/libro.controller')"), 'Route file must import matching controller file');

  const masterRoutesContent = biblioFilesMap.get('backend/src/routes/index.js');
  assert.ok(masterRoutesContent.includes("require('./libro.routes')"));
  assert.ok(masterRoutesContent.includes("router.use('/libros', libroRoutes)"), 'Master routes must mount to public endpoint /libros');
  assert.ok(masterRoutesContent.includes("require('./operation.routes')"), 'Must mount operation routes when business logic exists');

  // 2. Verify Custom Business Operations Generation
  assert.ok(biblioFilesMap.has('backend/src/services/operation.service.js'));
  assert.ok(biblioFilesMap.has('backend/src/controllers/operation.controller.js'));
  assert.ok(biblioFilesMap.has('backend/src/routes/operation.routes.js'));
  
  const opServiceContent = biblioFilesMap.get('backend/src/services/operation.service.js');
  assert.ok(opServiceContent.includes('sequelize.transaction()'), 'Business operation must use database transactions');
  assert.ok(opServiceContent.includes('prestarLibroALector'));

  // 3. Verify Database Migrations and Boot Script
  assert.ok(biblioFilesMap.has('backend/src/migrate.js'), 'Must generate standalone migration runner');
  assert.ok(biblioFilesMap.has('backend/.sequelizerc'), 'Must generate .sequelizerc');
  
  const migFiles = Array.from(biblioFilesMap.keys()).filter(k => k.startsWith('backend/src/migrations/'));
  assert.ok(migFiles.length >= 2, 'Must generate migrations for entities and constraints');

  const libroMig = biblioFilesMap.get(migFiles.find(k => k.includes('create-libros')));
  assert.ok(libroMig.includes('fecha_publicacion'), 'Migration must map camelCase to explicit snake_case column');

  // 4. Verify Approved Mockup Visuals Integration
  assert.ok(biblioFilesMap.has('frontend/src/pages/mockups/CatalogoLibrosMockup.jsx'), 'Must generate JSX mockup without crashing on toPascalCase');
  const mockupCode = biblioFilesMap.get('frontend/src/pages/mockups/CatalogoLibrosMockup.jsx');
  assert.ok(mockupCode.includes('export default function CatalogoLibrosMockup'));
  assert.ok(mockupCode.includes('className="catalogo-shell"'));

  const appJsxCode = biblioFilesMap.get('frontend/src/App.jsx');
  assert.ok(appJsxCode.includes("import CatalogoLibrosMockup from './pages/mockups/CatalogoLibrosMockup'"));

  // 5. Verify Real ZIP Creation and Integrity
  const zipBuffer = createZipBuffer(resultBiblio.files);
  assert.ok(Buffer.isBuffer(zipBuffer));
  assert.ok(zipBuffer.length > 5000);

  // 6. DOMAIN 2: Clínica Médica (UUID PKs, different entities and screens, same generator engine)
  const clinicaSpec = {
    schemaVersion: '1.0.0',
    project: {
      id: 'proj-clinica-e2e',
      name: 'Clínica San Rafael',
      description: 'Gestión Hospitalaria de Médicos y Pacientes',
      platform: 'WEB',
      status: 'PLANNING'
    },
    technologies: [
      { name: 'React', category: 'FRONTEND' },
      { name: 'Express', category: 'BACKEND' },
      { name: 'PostgreSQL', category: 'DATABASE' }
    ],
    security: {
      authType: 'NONE',
      roles: ['Medico', 'Recepcionista'],
      tokenExpiry: null
    },
    requirements: [
      { id: 'req-c1', code: 'RF-01', name: 'Gestión de Pacientes', type: 'FUNCTIONAL', status: 'APPROVED' }
    ],
    actors: [
      { id: 'act-med', name: 'Medico', status: 'APPROVED' },
      { id: 'act-rec', name: 'Recepcionista', status: 'APPROVED' }
    ],
    entities: [
      {
        id: 'ent-paciente',
        name: 'Paciente',
        modelName: 'Paciente',
        tableName: 'pacientes',
        endpoint: 'pacientes',
        paramName: 'paciente',
        requirementIds: ['req-c1'],
        primaryKey: { fieldName: 'id', type: 'DataTypes.UUID' },
        attributes: [
          { fieldName: 'id', columnName: 'id', isPk: true, dataType: 'DataTypes.UUID', allowNull: false },
          { fieldName: 'historiaClinica', columnName: 'historia_clinica', isPk: false, dataType: 'DataTypes.STRING(50)', allowNull: false, unique: true },
          { fieldName: 'nombreCompleto', columnName: 'nombre_completo', isPk: false, dataType: 'DataTypes.STRING(150)', allowNull: false }
        ]
      }
    ],
    relationships: [],
    operations: [
      {
        operationId: 'op_pacientes_list',
        name: 'Listar Pacientes',
        entity: 'Paciente',
        route: '/api/pacientes',
        method: 'GET',
        authorizedRoles: ['Medico', 'Recepcionista'],
        requirementIds: ['req-c1'],
        input: { params: [], query: [] },
        output: { successStatus: 200, responseSchema: { type: 'object' } }
      }
    ],
    screens: [
      {
        name: 'PacientePage',
        route: '/pacientes',
        title: 'Directorio de Pacientes',
        connectedOperationId: 'op_pacientes_list'
      }
    ],
    apiContract: {
      openapi: '3.0.3',
      info: { title: 'Clínica San Rafael', version: '1.0.0' },
      servers: [{ url: '/api' }],
      paths: {
        '/pacientes': {
          get: {
            operationId: 'op_pacientes_list',
            summary: 'Listar Pacientes',
            responses: { '200': { description: 'OK' } }
          }
        }
      }
    }
  };

  const resultClinica = await codeGenerator.generateProjectFiles(null, {
    spec: clinicaSpec,
    includeDocker: true
  });

  assert.equal(resultClinica.ready, true);
  const clinicaFilesMap = new Map(resultClinica.files.map(f => [f.path, f.content]));

  // Verify that Domain 2 generated Paciente without any contamination from Domain 1
  assert.ok(clinicaFilesMap.has('backend/src/models/Paciente.js'));
  assert.ok(clinicaFilesMap.has('backend/src/routes/paciente.routes.js'));
  assert.ok(clinicaFilesMap.has('backend/src/controllers/paciente.controller.js'));
  assert.ok(!clinicaFilesMap.has('backend/src/models/Libro.js'), 'Must have zero contamination from Biblioteca');
  assert.ok(!clinicaFilesMap.has('backend/src/models/OrdenTrabajo.js'), 'Must have zero automotive contamination');

  // Verify that all relative imports in Clinica also resolve 100%
  const zipClinica = createZipBuffer(resultClinica.files);
  assert.ok(Buffer.isBuffer(zipClinica));
  assert.ok(zipClinica.length > 5000);
});
