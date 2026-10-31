const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');
const { Sequelize } = require('sequelize');

const codeGenerator = require('../src/services/codegen/codeGenerator.service');
const { validateProjectSpec } = require('../src/services/codegen/projectSpecValidator');

const DB_PORT = 5433;
const DB_NAME = 'icase_test_export_db';
const DB_USER = 'icase_user';
const DB_PASSWORD = 'icase_password';
const APP_PORT = 8099;
const JWT_SECRET = 'live_e2e_jwt_secret_test_2026';

test('Exported Application Live E2E: Compilation, isolated PostgreSQL migrations, Auth, RBAC, CRUD with UUID PK, and Business Rules', async (t) => {
  // 1. Define complete, multi-domain, generic specification (Clínica Hospitalaria)
  const clinicaSpec = {
    schemaVersion: '1.0.0',
    approvedAt: '2026-10-27T00:00:00.000Z',
    hash: 'canonical_clinica_hash_9876',
    project: {
      id: 'proj_hospital',
      name: 'Hospital San Lucas',
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
      roles: ['Recepcionista', 'Doctor', 'Director'],
      tokenExpiry: '8h'
    },
    entities: [
      {
        id: 'ent_rol',
        name: 'Rol',
        modelName: 'Rol',
        tableName: 'roles',
        primaryKey: { fieldName: 'idRol', type: 'INTEGER' },
        attributes: [
          { fieldName: 'idRol', name: 'idRol', type: 'INTEGER', isPk: true, allowNull: false, autoIncrement: true },
          { fieldName: 'nombre', name: 'nombre', type: 'STRING', isPk: false, allowNull: false, unique: true }
        ]
      },
      {
        id: 'ent_usuario',
        name: 'Usuario',
        modelName: 'Usuario',
        tableName: 'usuarios',
        primaryKey: { fieldName: 'idUsuario', type: 'INTEGER' },
        attributes: [
          { fieldName: 'idUsuario', name: 'idUsuario', type: 'INTEGER', isPk: true, allowNull: false, autoIncrement: true },
          { fieldName: 'email', name: 'email', type: 'STRING', isPk: false, allowNull: false, unique: true },
          { fieldName: 'password', name: 'password', type: 'STRING', isPk: false, allowNull: false },
          { fieldName: 'rolId', name: 'rolId', type: 'INTEGER', isPk: false, allowNull: false }
        ]
      },
      {
        id: 'ent_paciente',
        name: 'Paciente',
        modelName: 'Paciente',
        tableName: 'pacientes',
        primaryKey: { fieldName: 'codigoPaciente', type: 'UUID' },
        attributes: [
          { fieldName: 'codigoPaciente', name: 'codigoPaciente', type: 'UUID', isPk: true, allowNull: false, defaultValue: 'UUIDV4' },
          { fieldName: 'nombreCompleto', name: 'nombreCompleto', type: 'STRING', isPk: false, allowNull: false },
          { fieldName: 'documento', name: 'documento', type: 'STRING', isPk: false, allowNull: false, unique: true },
          { fieldName: 'activo', name: 'activo', type: 'BOOLEAN', isPk: false, allowNull: false, defaultValue: true }
        ]
      }
    ],
    relationships: [
      {
        id: 'rel_usuario_rol',
        source: 'Usuario',
        target: 'Rol',
        sourceEntityId: 'ent_usuario',
        targetEntityId: 'ent_rol',
        cardinality: 'N:1',
        foreignKey: 'rolId'
      }
    ],
    operations: [
      {
        operationId: 'op_pacientes_list',
        name: 'Listar Pacientes',
        type: 'CRUD',
        method: 'GET',
        route: '/api/pacientes',
        entity: 'Paciente',
        authorizedRoles: ['Recepcionista', 'Doctor', 'Director'],
        output: { successStatus: 200 }
      },
      {
        operationId: 'op_registrar_paciente',
        name: 'Registrar Paciente',
        type: 'BUSINESS_LOGIC',
        method: 'POST',
        route: '/api/operations/registrar-paciente',
        targetEntity: 'Paciente',
        authorizedRoles: ['Recepcionista', 'Director'],
        businessRules: [
          {
            code: 'BR_DOC_VALIDO',
            name: 'Documento Válido',
            description: 'El documento debe tener al menos 6 caracteres',
            condition: 'payload.documento && String(payload.documento).length >= 6',
            errorMessage: 'El documento del paciente debe contener al menos 6 caracteres.'
          }
        ],
        output: { successStatus: 201 }
      }
    ],
    screens: [
      {
        id: 'scr_pacientes',
        name: 'GestionPacientes',
        route: '/pacientes',
        title: 'Gestión de Pacientes',
        roles: ['Recepcionista', 'Doctor', 'Director'],
        connectedOperationId: 'op_pacientes_list',
        requiresMockup: false,
        hasApprovedMockup: true,
        html: null,
        components: []
      }
    ]
  };

  // 2. Validate specification quality gates
  const validation = validateProjectSpec(clinicaSpec);
  assert.equal(validation.ready, true, 'Specification must pass quality gates without blocking errors');
  assert.equal(validation.errors.length, 0);

  // 3. Generate export bundle
  const generated = await codeGenerator.generateProjectFiles(null, {
    spec: clinicaSpec,
    includeDocker: true
  });
  assert.equal(generated.ready, true);
  assert.ok(generated.files.length >= 20, 'Should generate all project files');

  // 4. Write generated files to isolated fixture directory
  const exportDir = path.join(__dirname, 'fixtures', 'live_exported_app');
  if (fs.existsSync(exportDir)) {
    fs.rmSync(exportDir, { recursive: true, force: true });
  }
  fs.mkdirSync(exportDir, { recursive: true });

  for (const f of generated.files) {
    if (f.content === undefined) {
      console.error('UNDEFINED FILE CONTENT FOR:', f.path);
    }
    const filePath = path.join(exportDir, f.path);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, f.content ?? '', 'utf8');
  }

  // 5. Backend Syntax Compilation: Verify every JS file in backend can be parsed
  const backendDir = path.join(exportDir, 'backend');
  const getJsFiles = (dir) => {
    let results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        results = results.concat(getJsFiles(full));
      } else if (ent.isFile() && ent.name.endsWith('.js')) {
        results.push(full);
      }
    }
    return results;
  };

  const jsFiles = getJsFiles(backendDir);
  assert.ok(jsFiles.length >= 10, 'Should find all generated backend JS files');
  for (const jsFile of jsFiles) {
    assert.doesNotThrow(() => {
      execSync(`node --check "${jsFile}"`, { stdio: 'pipe' });
    }, `File ${path.relative(exportDir, jsFile)} must compile without syntax errors`);
  }

  // 6. Connect to isolated PostgreSQL database on port 5433
  const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
    host: 'localhost',
    port: DB_PORT,
    dialect: 'postgres',
    logging: false
  });

  await sequelize.authenticate();

  const queryInterface = sequelize.getQueryInterface();
  // Ensure completely clean database schema before running migrations
  await sequelize.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');

  // 7. Execute migrations in timestamp order using Sequelize queryInterface
  const migrationsDir = path.join(backendDir, 'src', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js')).sort();
  assert.ok(migrationFiles.length >= 3, 'Should have migration files for entities and constraints');

  for (const migFile of migrationFiles) {
    const migPath = path.join(migrationsDir, migFile);
    const migration = require(migPath);
    await migration.up(queryInterface, Sequelize);
  }

  // Verify tables were created in PostgreSQL
  const tables = await queryInterface.showAllTables();
  assert.ok(tables.includes('pacientes'), 'pacientes table was created');
  assert.ok(tables.includes('usuarios'), 'usuarios table was created');
  assert.ok(tables.includes('roles'), 'roles table was created');

  // Seed default roles
  await queryInterface.bulkInsert('roles', [
    { id_rol: 1, nombre: 'Recepcionista', created_at: new Date(), updated_at: new Date() },
    { id_rol: 2, nombre: 'Doctor', created_at: new Date(), updated_at: new Date() },
    { id_rol: 3, nombre: 'Director', created_at: new Date(), updated_at: new Date() }
  ]);

  // 8. Start the generated Express server in isolated environment
  process.env.PORT = String(APP_PORT);
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = String(DB_PORT);
  process.env.DB_NAME = DB_NAME;
  process.env.DB_USER = DB_USER;
  process.env.DB_PASSWORD = DB_PASSWORD;
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.NODE_ENV = 'test';

  const express = require('express');
  const cors = require('cors');

  const masterRouter = require(path.join(backendDir, 'src', 'routes', 'index.js'));
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Mount central API router generated by ICASE
  app.use('/api', masterRouter);

  const server = await new Promise((resolve) => {
    const s = app.listen(APP_PORT, () => resolve(s));
  });

  const request = async (method, path, body = null, headers = {}) => {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const req = http.request({
        hostname: 'localhost',
        port: APP_PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  };

  try {
    // 9. TEST A: User registration with normalized password and role assignment
    const regRes = await request('POST', '/api/auth/register', {
      email: 'mariana@clinica.com',
      password: 'SecurePassword123!',
      role: 'Recepcionista'
    });
    assert.equal(regRes.status, 201, 'User registered successfully');
    assert.ok(regRes.data.token, 'JWT token returned on registration');
    assert.equal(regRes.data.user.role, 'Recepcionista', 'Assigned approved non-privileged role');
    assert.equal(regRes.data.user.password, undefined, 'Password strictly excluded from response');
    assert.equal(regRes.data.user.passwordHash, undefined, 'Password hash strictly excluded from response');

    // 10. TEST B: Role escalation prevention
    const escalateRes = await request('POST', '/api/auth/register', {
      email: 'intruder@clinica.com',
      password: 'HackerPassword123!',
      role: 'Director'
    });
    assert.equal(escalateRes.status, 403, 'Privileged role registration rejected with 403');
    assert.equal(escalateRes.data.code, 'ROLE_ASSIGNMENT_FORBIDDEN');

    // 11. TEST C: Login with valid credentials
    const loginRes = await request('POST', '/api/auth/login', {
      identifier: 'mariana@clinica.com',
      password: 'SecurePassword123!'
    });
    assert.equal(loginRes.status, 200, 'Login succeeds with valid credentials');
    assert.ok(loginRes.data.token, 'Token returned on login');
    const authToken = loginRes.data.token;

    // Login with invalid credentials
    const badLoginRes = await request('POST', '/api/auth/login', {
      identifier: 'mariana@clinica.com',
      password: 'WrongPassword!'
    });
    assert.equal(badLoginRes.status, 401, 'Invalid password rejected with 401');

    // 12. TEST D: Verify profile via /api/auth/me with Bearer token
    const meRes = await request('GET', '/api/auth/me', null, {
      'Authorization': `Bearer ${authToken}`
    });
    assert.equal(meRes.status, 200, 'Profile query succeeds');
    assert.equal(meRes.data.user.email, 'mariana@clinica.com');
    assert.equal(meRes.data.user.role, 'Recepcionista');

    // Expired or invalid token rejection
    const invalidTokenRes = await request('GET', '/api/auth/me', null, {
      'Authorization': 'Bearer invalid.token.payload'
    });
    assert.equal(invalidTokenRes.status, 401, 'Invalid token rejected');

    // 13. TEST E: CRUD on Paciente entity with UUID PK (codigoPaciente)
    const authHeaders = { 'Authorization': `Bearer ${authToken}` };

    // Create
    const createPacRes = await request('POST', '/api/pacientes', {
      nombreCompleto: 'Gabriel Garcia Marquez',
      documento: 'DOC-889900',
      activo: true
    }, authHeaders);
    assert.equal(createPacRes.status, 201, 'Paciente created');
    assert.ok(createPacRes.data.data.codigoPaciente, 'Paciente assigned UUID primary key');
    const pacUuid = createPacRes.data.data.codigoPaciente;

    // List
    const listPacRes = await request('GET', '/api/pacientes', null, authHeaders);
    assert.equal(listPacRes.status, 200, 'Pacientes listed');
    assert.ok(listPacRes.data.data.some(p => p.codigoPaciente === pacUuid), 'Created paciente is in list');

    // Get by UUID PK
    const getPacRes = await request('GET', `/api/pacientes/${pacUuid}`, null, authHeaders);
    assert.equal(getPacRes.status, 200, 'Paciente retrieved by UUID');
    assert.equal(getPacRes.data.data.nombreCompleto, 'Gabriel Garcia Marquez');

    // Update
    const updatePacRes = await request('PUT', `/api/pacientes/${pacUuid}`, {
      nombreCompleto: 'Gabriel Garcia Marquez (Actualizado)'
    }, authHeaders);
    assert.equal(updatePacRes.status, 200, 'Paciente updated');

    // Verify persistence after update
    const verifyUpdateRes = await request('GET', `/api/pacientes/${pacUuid}`, null, authHeaders);
    assert.equal(verifyUpdateRes.data.data.nombreCompleto, 'Gabriel Garcia Marquez (Actualizado)');

    // 14. TEST F: Business Operation and Rule Enforcement
    // Violate rule: documento shorter than 6 characters
    const invalidOpRes = await request('POST', '/api/operations/registrar-paciente', {
      nombreCompleto: 'Paciente Invalido',
      documento: '123'
    }, authHeaders);
    assert.equal(invalidOpRes.status, 422, 'Business rule violation throws 422');
    assert.equal(invalidOpRes.data.code, 'BUSINESS_RULE_VIOLATION');

    // Pass rule: valid document
    const validOpRes = await request('POST', '/api/operations/registrar-paciente', {
      nombreCompleto: 'Paciente Valido',
      documento: 'DOC-999888',
      activo: true
    }, authHeaders);
    assert.equal(validOpRes.status, 201, 'Business operation succeeds inside database transaction');
    assert.equal(validOpRes.data.data.status, 'COMPLETED');

    // 15. TEST G: Delete Paciente
    const deletePacRes = await request('DELETE', `/api/pacientes/${pacUuid}`, null, authHeaders);
    assert.equal(deletePacRes.status, 200, 'Paciente deleted');

    const getDeletedRes = await request('GET', `/api/pacientes/${pacUuid}`, null, authHeaders);
    assert.equal(getDeletedRes.status, 404, 'Deleted paciente is not found');
  } finally {
    // Shutdown server
    await new Promise((resolve) => server.close(resolve));
    // Drop test database tables
    for (const migFile of migrationFiles.reverse()) {
      const migPath = path.join(migrationsDir, migFile);
      const migration = require(migPath);
      if (migration.down) {
        await migration.down(queryInterface, Sequelize).catch(() => {});
      }
    }
    await sequelize.close();
    // Clean up fixture files
    fs.rmSync(exportDir, { recursive: true, force: true });
  }
});
