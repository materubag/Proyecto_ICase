const test = require('node:test');
const assert = require('node:assert/strict');
const { generateAuthControllerFile, deriveUserFieldMapping } = require('../src/services/codegen/authGenerator');
const { generateOperationServiceFile, generateOperationControllerFile, buildOperationNameMap } = require('../src/services/codegen/operationGenerator');
const { generateInteractiveMockupComponent, convertHtmlToJsx } = require('../src/services/codegen/mockupConverter');
const { generateAppJsx, generateLoginPageJsx, generateAppShellComponent } = require('../src/services/codegen/reactFrontendGenerator');
const { validateProjectSpec } = require('../src/services/codegen/projectSpecValidator');
const codeGenerator = require('../src/services/codegen/codeGenerator.service');

test('Codegen Corrections: 1. Auth mapping with non-standard field names (correo, passwordHash, nombre)', () => {
  const customUserEntity = {
    id: 'ent_usuario',
    name: 'USUARIO',
    modelName: 'Usuario',
    tableName: 'usuarios',
    attributes: [
      { fieldName: 'idUsuario', isPk: true, type: 'DataTypes.INTEGER' },
      { fieldName: 'nombre', type: 'DataTypes.STRING' },
      { fieldName: 'correo', type: 'DataTypes.STRING', unique: true },
      { fieldName: 'passwordHash', type: 'DataTypes.STRING' },
      { fieldName: 'rol', type: 'DataTypes.STRING' }
    ]
  };

  const mapping = deriveUserFieldMapping(customUserEntity);
  assert.equal(mapping.idField, 'idUsuario');
  assert.equal(mapping.identifierField, 'correo');
  assert.equal(mapping.passwordField, 'passwordHash');
  assert.equal(mapping.roleField, 'rol');
  assert.equal(mapping.hasPasswordField, true);
  assert.equal(mapping.hasIdentifierField, true);

  const authCode = generateAuthControllerFile(customUserEntity);
  assert.ok(authCode.includes('user.passwordHash'), 'Controller checks user.passwordHash with bcrypt');
  assert.ok(authCode.includes('correo: identifier'), 'Controller queries by correo');
  assert.ok(authCode.includes('user.rol'), 'Controller extracts role from user.rol');
  assert.ok(!authCode.includes('user.password ='), 'Does not use dummy user.password');
});

test('Codegen Corrections: 2. Operation generator prevents duplicate function names and handles structured steps', () => {
  const duplicateOps = [
    {
      operationId: 'op_registrar_1',
      name: 'Registrar Operación',
      targetEntity: 'Orden',
      type: 'BUSINESS_LOGIC',
      method: 'POST',
      route: '/api/operaciones/registrar',
      steps: [
        { action: 'CREATE', entity: 'Orden', fields: { estado: 'NUEVO' } }
      ]
    },
    {
      operationId: 'op_registrar_2',
      name: 'Registrar Operación', // Duplicate name!
      targetEntity: 'Entrega',
      type: 'BUSINESS_LOGIC',
      method: 'POST',
      route: '/api/operaciones/registrar-entrega',
      steps: [
        { action: 'CREATE', entity: 'Entrega', fields: { estado: 'PENDIENTE' } }
      ]
    }
  ];

  const entities = [
    { modelName: 'Orden', attributes: [{ fieldName: 'id', isPk: true }] },
    { modelName: 'Entrega', attributes: [{ fieldName: 'id', isPk: true }] }
  ];

  const nameMap = buildOperationNameMap(duplicateOps);
  assert.notEqual(nameMap.get('op_registrar_1'), nameMap.get('op_registrar_2'), 'Duplicate operation names receive distinct unique function names');

  const serviceCode = generateOperationServiceFile(duplicateOps, entities);
  assert.ok(serviceCode.includes('sequelize.transaction'), 'Encloses operations in transactions');
  assert.ok(serviceCode.includes(`async ${nameMap.get('op_registrar_1')}(`), 'Defines first function');
  assert.ok(serviceCode.includes(`async ${nameMap.get('op_registrar_2')}(`), 'Defines second unique function');
});

test('Codegen Corrections: 3. Mockup converter creates interactive component with real feedback and strips duplicate navigation', () => {
  const rawStitchHtml = `
  <!DOCTYPE html>
  <html>
    <head><title>Stitch Screen</title></head>
    <body>
      <aside class="sidebar">Sidebar duplicado</aside>
      <header class="header">Cabecera duplicada</header>
      <main class="container">
        <h1>Gestión de Clientes</h1>
        <button id="btn_guardar">Guardar</button>
      </main>
    </body>
  </html>
  `;

  const convertedJsx = convertHtmlToJsx(rawStitchHtml, 'ClientesMockup', '/clientes');
  assert.ok(!convertedJsx.includes('Sidebar duplicado'), 'Duplicate sidebar was stripped');
  assert.ok(!convertedJsx.includes('Cabecera duplicada'), 'Duplicate header was stripped');
  assert.ok(convertedJsx.includes('Gestión de Clientes'), 'Main content was preserved');

  const screen = {
    name: 'Clientes',
    title: 'Pantalla de Clientes',
    route: '/clientes',
    actions: [
      { actionId: 'act_guardar', name: 'Guardar Cliente', method: 'POST', route: '/api/clientes/guardar' }
    ]
  };

  const compCode = generateInteractiveMockupComponent('ClientesMockup', screen, convertedJsx, null, screen.actions);
  assert.ok(compCode.includes('executeCustomAction'), 'Includes action dispatcher');
  assert.ok(compCode.includes('/api/clientes/guardar'), 'Action button targets real route');
  assert.ok(compCode.includes('setErrorMessage'), 'Handles real errors without faking success');
});

test('Codegen Corrections: 4. Frontend LoginPage and App.jsx require real auth session and avoid visual role dropdown', () => {
  const loginJsx = generateLoginPageJsx('Autron ERP');
  assert.ok(loginJsx.includes('/auth/login'), 'Calls backend login endpoint');
  assert.ok(loginJsx.includes('localStorage.setItem(\'token\', token)'), 'Stores validated token');

  const entities = [{ name: 'Cliente', modelName: 'Cliente' }];
  const mockups = [{ compName: 'ClientesMockup', key: 'mockup_clientes_1', title: 'Clientes', route: '/clientes' }];

  const appJsxWithAuth = generateAppJsx('Autron ERP', entities, [], [], mockups, { hasAuth: true });
  assert.ok(appJsxWithAuth.includes('<LoginPage'), 'Gates app behind LoginPage when not authenticated');
  assert.ok(!appJsxWithAuth.includes('ROL ACTIVO (RBAC)'), 'Removes fake visual role selector dropdown');
  assert.ok(appJsxWithAuth.includes('AppShell'), 'Wraps application views inside AppShell');

  const shellCode = generateAppShellComponent();
  assert.ok(shellCode.includes('user.role || user.rol'), 'Renders real user role');
  assert.ok(!shellCode.includes('<select'), 'AppShell does not provide arbitrary role override');
});

test('Codegen Corrections: 5. Validator blocks missing approved mockups and unresolvable operations', () => {
  const brokenSpec = {
    entities: [{ id: 'e1', name: 'Auto', modelName: 'Auto', primaryKey: { fieldName: 'id' } }],
    screens: [
      {
        id: 's1',
        name: 'DashboardAuto',
        route: '/auto',
        requiresMockup: true,
        hasApprovedMockup: false,
        html: null
      }
    ],
    operations: [
      {
        operationId: 'op1',
        name: 'OpSinPasos',
        type: 'BUSINESS_LOGIC',
        method: 'POST',
        route: '/api/op1',
        output: { successStatus: 200 },
        steps: ['Paso en texto plano no ejecutable']
      }
    ]
  };

  const result = validateProjectSpec(brokenSpec, { allowPartialScope: false });
  assert.equal(result.ready, false, 'Validation blocks invalid spec');
  assert.ok(result.errors.some(e => e.code === 'MISSING_APPROVED_MOCKUP'), 'Flags missing approved mockup');
  assert.ok(result.errors.some(e => e.code === 'UNRESOLVED_OPERATION_STEPS'), 'Flags unstructured steps');
});

test('Codegen Corrections: 6. Shared contract: ASSOCIATE, STATUS_CHANGE, and custom non-id UUID keys', () => {
  const operations = [
    {
      operationId: 'op_asignar_medico',
      name: 'Asignar Medico a Cita',
      type: 'BUSINESS_LOGIC',
      targetEntity: 'Cita',
      route: '/api/citas/asignar-medico',
      method: 'POST',
      steps: [
        {
          step: 1,
          action: 'STATUS_CHANGE',
          entity: 'Cita',
          statusField: 'estadoCita',
          newStatus: 'CONFIRMADA'
        },
        {
          step: 2,
          action: 'ASSOCIATE',
          entity: 'Cita',
          withEntity: 'Medico',
          foreignKey: 'idMedico'
        }
      ]
    }
  ];

  const entities = [
    {
      name: 'Cita',
      modelName: 'Cita',
      primaryKey: { fieldName: 'codigoCita', type: 'UUID' }
    },
    {
      name: 'Medico',
      modelName: 'Medico',
      primaryKey: { fieldName: 'idMedico', type: 'INTEGER' }
    }
  ];

  const serviceCode = generateOperationServiceFile(operations, entities);
  assert.ok(serviceCode.includes('codigoCita'), 'Resolves custom non-id primary key');
  assert.ok(serviceCode.includes('estadoCita') && serviceCode.includes('CONFIRMADA'), 'Generates status change statement');
  assert.ok(serviceCode.includes('idMedico: payload.idMedico'), 'Generates foreign key association statement');
  assert.ok(serviceCode.includes('await t.commit()'), 'Transaction commits on completion');
});

test('Codegen Corrections: 7. Auth controller handles rolId foreign key, scope check, password normalization, and response hash exclusion', () => {
  const userEntityWithFk = {
    id: 'ent_usuario_clinica',
    name: 'Empleado',
    modelName: 'Empleado',
    tableName: 'empleados',
    attributes: [
      { fieldName: 'idEmpleado', isPk: true, type: 'DataTypes.INTEGER' },
      { fieldName: 'nombre', type: 'DataTypes.STRING' },
      { fieldName: 'correo', type: 'DataTypes.STRING', unique: true },
      { fieldName: 'contrasena', type: 'DataTypes.STRING' },
      { fieldName: 'rolId', type: 'DataTypes.INTEGER' }
    ]
  };

  const approvedRoles = ['Recepcionista', 'Doctor', 'Administrador'];
  const entities = [
    userEntityWithFk,
    { name: 'Rol', modelName: 'Rol', tableName: 'roles' }
  ];

  const authCode = generateAuthControllerFile(userEntityWithFk, approvedRoles, entities);
  // 1. Password normalization
  assert.ok(authCode.includes('contrasena'), 'Normalizes contrasena in payload');
  assert.ok(authCode.includes('bcrypt.hash(password, 10)'), 'Hashes normalized password');
  // 2. Safe scope checking
  assert.ok(authCode.includes("models.Empleado.options?.scopes?.withPassword"), 'Verifies scope existence before invocation');
  // 3. No string "Usuario" in numeric rolId column
  assert.ok(!authCode.includes("rolId: 'Usuario'"), 'Does not save string Usuario into integer rolId');
  assert.ok(authCode.includes("defaultRoleId = 1") || authCode.includes("models.Rol"), 'Resolves role integer ID or queries Rol model');
  // 4. Default unprivileged role from approved roles list (not invented "Usuario")
  assert.ok(authCode.includes('Recepcionista'), 'Selects unprivileged role from approved project roles');
  // 5. Excludes hashes from response
  assert.ok(authCode.includes('userResponse'), 'Returns sanitized user response');
  assert.ok(!authCode.includes('passwordHash: user.'), 'Excludes password hash from JSON responses');
});

test('Codegen Corrections: 8. Full Export Pipeline generates compilable full-stack application for Multi-Domain project with non-id PKs and RBAC', async () => {
  const clinicaSpec = {
    schemaVersion: '1.0.0',
    approvedAt: '2026-10-27T00:00:00.000Z',
    hash: 'canonical_test_hash_123',
    project: {
      id: 'proj_clinica',
      name: 'Clinica San Rafael',
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
      roles: ['Recepcionista', 'Doctor'],
      tokenExpiry: '8h'
    },
    entities: [
      {
        id: 'ent_paciente',
        name: 'Paciente',
        modelName: 'Paciente',
        tableName: 'pacientes',
        primaryKey: { fieldName: 'codigoPaciente', type: 'UUID' },
        attributes: [
          { fieldName: 'codigoPaciente', name: 'codigoPaciente', type: 'UUID', isPk: true, allowNull: false, defaultValue: 'UUIDV4' },
          { fieldName: 'nombreCompleto', name: 'nombreCompleto', type: 'STRING', isPk: false, allowNull: false },
          { fieldName: 'documento', name: 'documento', type: 'STRING', isPk: false, allowNull: false, unique: true }
        ]
      },
      {
        id: 'ent_empleado',
        name: 'Empleado',
        modelName: 'Empleado',
        tableName: 'empleados',
        primaryKey: { fieldName: 'idEmpleado', type: 'INTEGER' },
        attributes: [
          { fieldName: 'idEmpleado', name: 'idEmpleado', type: 'INTEGER', isPk: true, allowNull: false, autoIncrement: true },
          { fieldName: 'nombre', name: 'nombre', type: 'STRING', isPk: false, allowNull: false },
          { fieldName: 'email', name: 'email', type: 'STRING', isPk: false, allowNull: false, unique: true },
          { fieldName: 'password', name: 'password', type: 'STRING', isPk: false, allowNull: false },
          { fieldName: 'role', name: 'role', type: 'STRING', isPk: false, allowNull: false, defaultValue: 'Recepcionista' }
        ]
      }
    ],
    relationships: [],
    operations: [
      {
        operationId: 'op_pacientes_list',
        name: 'Listar Pacientes',
        type: 'CRUD',
        method: 'GET',
        route: '/api/pacientes',
        entity: 'Paciente',
        authorizedRoles: ['Recepcionista', 'Doctor'],
        output: { successStatus: 200 }
      },
      {
        operationId: 'op_registrar_paciente',
        name: 'Registrar Paciente',
        type: 'BUSINESS_LOGIC',
        method: 'POST',
        route: '/api/operations/registrar-paciente',
        targetEntity: 'Paciente',
        authorizedRoles: ['Recepcionista'],
        output: { successStatus: 201 }
      }
    ],
    screens: [
      {
        id: 'scr_pacientes',
        name: 'GestionPacientes',
        route: '/pacientes',
        title: 'Gestión de Pacientes',
        roles: ['Recepcionista', 'Doctor'],
        connectedOperationId: 'op_pacientes_list',
        requiresMockup: false,
        hasApprovedMockup: true,
        html: null,
        components: []
      }
    ]
  };

  const validation = validateProjectSpec(clinicaSpec);
  assert.equal(validation.ready, true, 'Clinica specification passes quality gates');

  const generated = await codeGenerator.generateProjectFiles(null, {
    spec: clinicaSpec,
    includeDocker: true
  });

  assert.equal(generated.ready, true);
  assert.ok(generated.files.length > 25, 'Generated all project files');

  // Verify non-id primary key resolution in generated files
  const pacienteModel = generated.files.find(f => f.path === 'backend/src/models/Paciente.js');
  assert.ok(pacienteModel, 'Generated Paciente model');
  assert.ok(pacienteModel.content.includes('codigoPaciente'), 'Paciente model uses custom PK codigoPaciente');

  // Verify Auth Controller with specific project roles
  const authController = generated.files.find(f => f.path === 'backend/src/controllers/auth.controller.js');
  assert.ok(authController, 'Generated Auth Controller');
  assert.ok(authController.content.includes('Recepcionista'), 'Uses approved unprivileged role');
  assert.ok(!authController.content.includes("Vehiculo") && !authController.content.includes("Taller"), 'Zero domain cross-contamination');

  // Verify App.jsx RBAC filtering
  const appJsx = generated.files.find(f => f.path === 'frontend/src/App.jsx');
  assert.ok(appJsx, 'Generated App.jsx');
  assert.ok(appJsx.content.includes('navItems'), 'Defines role-based navigation');

  // Verify ZIP archive is created
  const zipResult = await codeGenerator.generateZipArchive(null, { spec: clinicaSpec });
  assert.ok(zipResult.buffer, 'ZIP archive generated successfully');
  assert.ok(zipResult.buffer.length > 1000, 'ZIP has valid payload');
  assert.equal(zipResult.filename, 'clinica_san_rafael-fullstack.zip');
});

