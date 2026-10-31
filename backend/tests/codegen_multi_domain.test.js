const test = require('node:test');
const assert = require('node:assert/strict');
const codeGenerator = require('../src/services/codegen/codeGenerator.service');
const { buildProjectSpec } = require('../src/services/codegen/projectSpecBuilder');
const { validateProjectSpec } = require('../src/services/codegen/projectSpecValidator');

// Helper to simulate a project state in the specification
function createDomainSpec(domainConfig) {
  const { name, entities, relationships, requirements, actors } = domainConfig;

  const spec = {
    schemaVersion: '1.0.0',
    project: {
      id: `proj-${name.toLowerCase()}`,
      name,
      description: `Sistema de ${name}`,
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
      roles: actors.map(a => a.name),
      tokenExpiry: '8h'
    },
    requirements: requirements.map(r => ({ ...r, status: 'APPROVED' })),
    actors: actors.map(a => ({ ...a, status: 'APPROVED' })),
    entities: entities.map(e => ({
      ...e,
      status: 'APPROVED',
      reviewStatus: 'APPROVED'
    })),
    relationships: relationships.map(r => ({
      ...r,
      status: 'APPROVED',
      reviewStatus: 'APPROVED'
    })),
    operations: entities.map(ent => ({
      operationId: `op_${ent.tableName}_list`,
      name: `Listar ${ent.modelName}`,
      entity: ent.modelName,
      route: `/api/${ent.endpoint}`,
      method: 'GET',
      authorizedRoles: actors.map(a => a.name),
      requirementIds: requirements.map(r => r.id),
      input: { params: [], query: [] },
      output: { successStatus: 200 }
    })),
    screens: entities.map(ent => ({
      name: `${ent.modelName}Page`,
      route: `/${ent.endpoint}`,
      connectedOperationId: `op_${ent.tableName}_list`
    }))
  };

  return spec;
}

test('Multi-Domain Validation: Domain 1 (Biblioteca) and Domain 2 (Clínica) generated cleanly without cross-contamination or automotive hardcoding', async () => {
  // 1. DOMAIN 1: Biblioteca Digital
  const bibliotecaEntities = [
    {
      id: 'ent-libro',
      name: 'Libro',
      modelName: 'Libro',
      tableName: 'libros',
      endpoint: 'libros',
      primaryKey: { fieldName: 'id', type: 'DataTypes.INTEGER', autoIncrement: true },
      attributes: [
        { fieldName: 'id', isPk: true, dataType: 'DataTypes.INTEGER', autoIncrement: true, allowNull: false },
        { fieldName: 'isbn', isPk: false, dataType: 'DataTypes.STRING(20)', allowNull: false, unique: true },
        { fieldName: 'titulo', isPk: false, dataType: 'DataTypes.STRING(200)', allowNull: false },
        { fieldName: 'stockDisponible', isPk: false, dataType: 'DataTypes.INTEGER', allowNull: false, defaultValue: 0 }
      ]
    },
    {
      id: 'ent-ejemplar',
      name: 'Ejemplar',
      modelName: 'Ejemplar',
      tableName: 'ejemplares',
      endpoint: 'ejemplares',
      primaryKey: { fieldName: 'id', type: 'DataTypes.INTEGER', autoIncrement: true },
      attributes: [
        { fieldName: 'id', isPk: true, dataType: 'DataTypes.INTEGER', autoIncrement: true, allowNull: false },
        { fieldName: 'libroId', isPk: false, dataType: 'DataTypes.INTEGER', allowNull: false },
        { fieldName: 'codigoBarras', isPk: false, dataType: 'DataTypes.STRING(50)', allowNull: false, unique: true }
      ]
    },
    {
      id: 'ent-lector',
      name: 'Lector',
      modelName: 'Lector',
      tableName: 'lectores',
      endpoint: 'lectores',
      primaryKey: { fieldName: 'id', type: 'DataTypes.INTEGER', autoIncrement: true },
      attributes: [
        { fieldName: 'id', isPk: true, dataType: 'DataTypes.INTEGER', autoIncrement: true, allowNull: false },
        { fieldName: 'numeroCredencial', isPk: false, dataType: 'DataTypes.STRING(30)', allowNull: false, unique: true },
        { fieldName: 'nombreCompleto', isPk: false, dataType: 'DataTypes.STRING(150)', allowNull: false }
      ]
    }
  ];

  const bibliotecaRels = [
    {
      id: 'rel-libro-ejemplar',
      source: 'ent-libro',
      target: 'ent-ejemplar',
      sourceEntityId: 'ent-libro',
      sourceEntity: 'Libro',
      targetEntityId: 'ent-ejemplar',
      targetEntity: 'Ejemplar',
      cardinality: '1:N',
      foreignKey: 'libroId',
      as: 'ejemplares',
      reverseAs: 'libro'
    }
  ];

  const specBiblio = createDomainSpec({
    name: 'BibliotecaDigital',
    entities: bibliotecaEntities,
    relationships: bibliotecaRels,
    requirements: [{ id: 'rf-b1', code: 'RF-01', name: 'Gestión de Libros y Ejemplares', type: 'FUNCTIONAL' }],
    actors: [{ id: 'act-bib', name: 'Bibliotecario' }, { id: 'act-lec', name: 'Lector' }]
  });

  // Validate Biblioteca specification
  const diagBiblio = validateProjectSpec(specBiblio);
  assert.equal(diagBiblio.ready, true, 'Biblioteca specification must pass quality gates');

  // 2. DOMAIN 2: Clínica Médica (UUID-based PKs and Date fields)
  const clinicaEntities = [
    {
      id: 'ent-medico',
      name: 'Medico',
      modelName: 'Medico',
      tableName: 'medicos',
      endpoint: 'medicos',
      primaryKey: { fieldName: 'id', type: 'DataTypes.UUID', autoIncrement: false },
      attributes: [
        { fieldName: 'id', isPk: true, dataType: 'DataTypes.UUID', allowNull: false },
        { fieldName: 'numeroColegiado', isPk: false, dataType: 'DataTypes.STRING(30)', allowNull: false, unique: true },
        { fieldName: 'nombreMedico', isPk: false, dataType: 'DataTypes.STRING(120)', allowNull: false },
        { fieldName: 'especialidad', isPk: false, dataType: 'DataTypes.STRING(80)', allowNull: false }
      ]
    },
    {
      id: 'ent-paciente',
      name: 'Paciente',
      modelName: 'Paciente',
      tableName: 'pacientes',
      endpoint: 'pacientes',
      primaryKey: { fieldName: 'id', type: 'DataTypes.UUID', autoIncrement: false },
      attributes: [
        { fieldName: 'id', isPk: true, dataType: 'DataTypes.UUID', allowNull: false },
        { fieldName: 'historiaClinica', isPk: false, dataType: 'DataTypes.STRING(40)', allowNull: false, unique: true },
        { fieldName: 'nombrePaciente', isPk: false, dataType: 'DataTypes.STRING(120)', allowNull: false },
        { fieldName: 'fechaNacimiento', isPk: false, dataType: 'DataTypes.DATEONLY', allowNull: false }
      ]
    },
    {
      id: 'ent-cita',
      name: 'CitaMedica',
      modelName: 'CitaMedica',
      tableName: 'citas_medicas',
      endpoint: 'citas-medicas',
      primaryKey: { fieldName: 'id', type: 'DataTypes.UUID', autoIncrement: false },
      attributes: [
        { fieldName: 'id', isPk: true, dataType: 'DataTypes.UUID', allowNull: false },
        { fieldName: 'medicoId', isPk: false, dataType: 'DataTypes.UUID', allowNull: false },
        { fieldName: 'pacienteId', isPk: false, dataType: 'DataTypes.UUID', allowNull: false },
        { fieldName: 'fechaHoraCita', isPk: false, dataType: 'DataTypes.DATE', allowNull: false },
        { fieldName: 'motivoConsulta', isPk: false, dataType: 'DataTypes.TEXT', allowNull: true }
      ]
    }
  ];

  const clinicaRels = [
    {
      id: 'rel-med-cita',
      source: 'ent-medico',
      target: 'ent-cita',
      sourceEntityId: 'ent-medico',
      sourceEntity: 'Medico',
      targetEntityId: 'ent-cita',
      targetEntity: 'CitaMedica',
      cardinality: '1:N',
      foreignKey: 'medicoId',
      as: 'citasMedicas',
      reverseAs: 'medico'
    },
    {
      id: 'rel-pac-cita',
      source: 'ent-paciente',
      target: 'ent-cita',
      sourceEntityId: 'ent-paciente',
      sourceEntity: 'Paciente',
      targetEntityId: 'ent-cita',
      targetEntity: 'CitaMedica',
      cardinality: '1:N',
      foreignKey: 'pacienteId',
      as: 'citasMedicas',
      reverseAs: 'paciente'
    }
  ];

  const specClinica = createDomainSpec({
    name: 'ClinicaSanRafael',
    entities: clinicaEntities,
    relationships: clinicaRels,
    requirements: [{ id: 'rf-c1', code: 'RF-01', name: 'Agendamiento de Citas', type: 'FUNCTIONAL' }],
    actors: [{ id: 'act-med', name: 'Medico' }, { id: 'act-pac', name: 'Paciente' }]
  });

  const diagClinica = validateProjectSpec(specClinica);
  assert.equal(diagClinica.ready, true, 'Clínica specification must pass quality gates');

  // Verify Domain Separation & Zero Hardcoded Automotive Contamination:
  // 1. Check generated associations for Biblioteca
  const { generateModelsIndexFile } = require('../src/services/codegen/modelGenerator');
  const biblioIndexCode = generateModelsIndexFile(bibliotecaEntities, bibliotecaRels);
  assert.ok(biblioIndexCode.includes("Libro.hasMany(Ejemplar, { foreignKey: 'libroId', as: 'ejemplares'"));
  assert.ok(biblioIndexCode.includes("Ejemplar.belongsTo(Libro, { foreignKey: 'libroId', as: 'libro'"));

  // Must NOT contain any automotive terms or clinic terms
  assert.ok(!biblioIndexCode.includes('P0300'));
  assert.ok(!biblioIndexCode.includes('Actividad'));
  assert.ok(!biblioIndexCode.includes('Medico'));
  assert.ok(!biblioIndexCode.includes('Roberto Gómez'));

  // 2. Check generated associations for Clínica
  const clinicaIndexCode = generateModelsIndexFile(clinicaEntities, clinicaRels);
  assert.ok(clinicaIndexCode.includes("Medico.hasMany(CitaMedica, { foreignKey: 'medicoId', as: 'citasMedicas'"));
  assert.ok(clinicaIndexCode.includes("Paciente.hasMany(CitaMedica, { foreignKey: 'pacienteId', as: 'citasMedicas'"));
  assert.ok(clinicaIndexCode.includes("CitaMedica.belongsTo(Medico, { foreignKey: 'medicoId', as: 'medico'"));
  assert.ok(clinicaIndexCode.includes("CitaMedica.belongsTo(Paciente, { foreignKey: 'pacienteId', as: 'paciente'"));

  // Must NOT contain any automotive terms or biblioteca terms
  assert.ok(!clinicaIndexCode.includes('P0300'));
  assert.ok(!clinicaIndexCode.includes('Actividad'));
  assert.ok(!clinicaIndexCode.includes('Libro'));
  assert.ok(!clinicaIndexCode.includes('Roberto Gómez'));

  // 3. Check generated Frontend UI for Clínica
  const { generateEntityViewPage } = require('../src/services/codegen/functionalPagesGenerator');
  const citaPageCode = generateEntityViewPage(clinicaEntities[2], clinicaRels); // CitaMedica

  // Must have real relational selector for medicoId and pacienteId
  assert.ok(citaPageCode.includes("apiRequest('/medicos')"));
  assert.ok(citaPageCode.includes("apiRequest('/pacientes')"));
  assert.ok(citaPageCode.includes("medicoId"));
  assert.ok(citaPageCode.includes("pacienteId"));
  assert.ok(citaPageCode.includes("fechaHoraCita"));

  // Must NOT have fixed IDs or swallowed fake Date.now() items
  assert.ok(!citaPageCode.includes('vehiculoId: 1'));
  assert.ok(!citaPageCode.includes('Date.now()'));
  assert.ok(!citaPageCode.includes('PBA-3421'));
});
