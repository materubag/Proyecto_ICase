/**
 * Test Fixtures for ICASE Studio Automated QA Suite
 * Provides controlled test data, offline responses, and model fixtures.
 */

const SAMPLE_PROJECT = {
  name: 'ICASE QA Test Project',
  description: 'Sistema integral de gestión de préstamos bibliotecarios y control de catálogo.',
  systemDescription: 'El sistema permite registrar usuarios, gestionar libros, realizar préstamos y generar reportes.',
  platform: 'WEB'
};

const SAMPLE_REQUIREMENTS = [
  {
    code: 'RF-001',
    name: 'Registrar préstamos de libros',
    description: 'El bibliotecario debe registrar los préstamos de libros asignando socio y fecha límite.',
    type: 'FUNCTIONAL',
    priority: 'HIGH',
    status: 'APPROVED'
  },
  {
    code: 'RF-002',
    name: 'Consultar catálogo en línea',
    description: 'El socio y público general pueden consultar la disponibilidad de libros por título y autor.',
    type: 'FUNCTIONAL',
    priority: 'MEDIUM',
    status: 'APPROVED'
  },
  {
    code: 'RF-003',
    name: 'Registrar nuevo préstamo (duplicado semántico)',
    description: 'El bibliotecario registrará el préstamo de libros indicando el socio y la fecha de devolución.',
    type: 'FUNCTIONAL',
    priority: 'HIGH',
    status: 'PENDING'
  },
  {
    code: 'RNF-001',
    name: 'Tiempo de respuesta del catálogo',
    description: 'La consulta del catálogo debe responder en menos de 2 segundos para el 95% de las solicitudes.',
    type: 'NON_FUNCTIONAL',
    priority: 'MEDIUM',
    status: 'APPROVED'
  }
];

const SAMPLE_ACTORS = [
  { name: 'Bibliotecario', description: 'Personal encargado de la administración y préstamos' },
  { name: 'Socio', description: 'Usuario registrado con carnet activo de la biblioteca' }
];

const SAMPLE_ER_MODEL = {
  entities: [
    {
      id: 'ent-1',
      name: 'Libro',
      attributes: [
        { name: 'isbn', type: 'String', isPk: true },
        { name: 'titulo', type: 'String', isPk: false },
        { name: 'disponible', type: 'Boolean', isPk: false }
      ]
    },
    {
      id: 'ent-2',
      name: 'Prestamo',
      attributes: [
        { name: 'id', type: 'UUID', isPk: true },
        { name: 'fechaInicio', type: 'DateTime', isPk: false },
        { name: 'fechaLimite', type: 'DateTime', isPk: false }
      ]
    }
  ],
  relationships: [
    {
      source: 'ent-1',
      target: 'ent-2',
      cardinality: 'ONE_TO_MANY',
      description: 'incluye'
    }
  ]
};

const SAMPLE_USE_CASES = {
  actors: [
    { id: 'act-1', name: 'Bibliotecario' },
    { id: 'act-2', name: 'Socio' }
  ],
  useCases: [
    {
      id: 'uc-1',
      code: 'CU-01',
      name: 'Registrar Prestamo',
      actorIds: ['act-1'],
      relations: [{ type: 'include', targetId: 'uc-2', evidence: 'requiere validar estado' }]
    },
    {
      id: 'uc-2',
      code: 'CU-02',
      name: 'Validar Carnet Socio',
      actorIds: ['act-1'],
      relations: []
    }
  ]
};

const SAMPLE_NAVIGATION = {
  projectName: 'Biblioteca Virtual',
  screens: [
    { id: 'scr-1', name: 'Login', route: '/login', platform: 'WEB' },
    { id: 'scr-2', name: 'Dashboard Principal', route: '/dashboard', platform: 'WEB', parentId: 'scr-1' },
    { id: 'scr-3', name: 'Gestion de Prestamos', route: '/prestamos', platform: 'WEB', parentId: 'scr-2' },
    { id: 'scr-4', name: 'Catalogo Publico', route: '/catalogo', platform: 'WEB', parentId: 'scr-2' }
  ]
};

const SAMPLE_ARCHITECTURE = {
  architecture: {
    components: [
      { name: 'Frontend React SPA', layer: 'Presentation', technology: 'React' },
      { name: 'API Gateway Express', layer: 'Application', technology: 'Node.js Express' },
      { name: 'Base de Datos PostgreSQL', layer: 'Data', technology: 'PostgreSQL' }
    ],
    connections: [
      { from: 'Frontend React SPA', to: 'API Gateway Express', type: 'HTTP / REST' },
      { from: 'API Gateway Express', to: 'Base de Datos PostgreSQL', type: 'TCP / Prisma ORM' }
    ]
  }
};

module.exports = {
  SAMPLE_PROJECT,
  SAMPLE_REQUIREMENTS,
  SAMPLE_ACTORS,
  SAMPLE_ER_MODEL,
  SAMPLE_USE_CASES,
  SAMPLE_NAVIGATION,
  SAMPLE_ARCHITECTURE
};

