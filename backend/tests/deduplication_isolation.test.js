const test = require('node:test');
const assert = require('node:assert/strict');

const deduplicationService = require('../src/services/analysis/deduplicationService');
const architectureGenerator = require('../src/services/diagrams/architectureGenerator');
const { normalizeClass, normalizeER } = require('../src/services/diagrams/mermaidNormalizer');

test('DEDUPLICACIÓN 1: Normalización de roles y actores con alias y género', () => {
  const actors = [
    { name: 'Administrador/a', description: 'Gestiona catálogos e indicadores', reviewStatus: 'APPROVED' },
    { name: 'Administrador', description: 'Usuario que administra el sistema y usuarios', reviewStatus: 'PENDING' },
    { name: 'ADMINISTRADOR/A', description: 'Rol administrativo', reviewStatus: 'PENDING' },
    { name: 'Cliente', description: 'Solicita citas y consulta avances', reviewStatus: 'APPROVED' },
    { name: 'cliente', description: 'Dueño del vehículo', reviewStatus: 'PENDING' },
    { name: 'Mecánico', description: 'Realiza reparaciones e inspecciones', reviewStatus: 'APPROVED' },
    { name: 'Mecanico', description: 'Técnico de taller', reviewStatus: 'PENDING' },
    { name: 'Recepción', description: 'Registra vehículos y atiende clientes', reviewStatus: 'APPROVED' },
    { name: 'Recepcion', description: 'Personal de mesa de entrada', reviewStatus: 'PENDING' }
  ];

  const consolidated = deduplicationService.consolidateActors(actors);
  assert.equal(consolidated.length, 4, 'Deben existir exactamente 4 actores canónicos');

  const names = consolidated.map(a => a.name);
  assert.ok(names.some(n => n.includes('Administrador')), 'Debe existir Administrador');
  assert.ok(names.some(n => n.includes('Cliente')), 'Debe existir Cliente');
  assert.ok(names.some(n => n.includes('Mecánico')), 'Debe existir Mecánico');
  assert.ok(names.some(n => n.includes('Recepción')), 'Debe existir Recepción');

  // Verify approved status is preserved
  for (const c of consolidated) {
    assert.equal(c.reviewStatus, 'APPROVED', `El actor canónico ${c.name} debe conservar reviewStatus APPROVED`);
    assert.ok(c.aliases.length >= 1, `El actor ${c.name} debe registrar variantes/aliases`);
    assert.ok(c.codeId.startsWith('ACT-'), `Debe tener código canónico ACT-0X: ${c.codeId}`);
  }
});

test('DEDUPLICACIÓN 2: Auditoría y selección de requisitos para IA', () => {
  const sampleReqs = [
    { id: '1', code: 'RF-01', name: 'El sistema debe permitir registrar clientes', type: 'FUNCTIONAL', status: 'APPROVED' },
    { id: '2', code: 'RF-02', name: 'El sistema debe registrar clientes', type: 'FUNCTIONAL', status: 'PENDING' }, // Redundante
    { id: '3', code: 'RF-03', name: 'El sistema debe permitir consultar clientes', type: 'FUNCTIONAL', status: 'APPROVED' },
    { id: '4', code: 'RF-04', name: 'El sistema debe permitir crear citas', type: 'FUNCTIONAL', status: 'APPROVED' },
    { id: '5', code: 'RF-05', name: 'El sistema debe permitir cancelar citas', type: 'FUNCTIONAL', status: 'APPROVED' },
    { id: '6', code: 'RNF-01', name: 'El tiempo de respuesta debe ser menor a 2 segundos', type: 'NON_FUNCTIONAL', status: 'APPROVED' }
  ];

  const audit = deduplicationService.auditRequirements(sampleReqs);
  assert.equal(audit.total, 6);
  assert.equal(audit.functional, 5);
  assert.equal(audit.nonFunctional, 1);
  assert.ok(audit.redundantCount >= 1, 'Debe detectar al menos un requisito redundante');
  assert.ok(audit.validCount <= audit.total, 'Válidos debe ser <= total');

  // Seleccionar relevantes para ER (no debe incluir RNF)
  const erContextReqs = deduplicationService.selectRelevantRequirements(sampleReqs, 'ER', 10);
  assert.ok(!erContextReqs.some(r => r.type === 'NON_FUNCTIONAL'), 'El contexto ER nunca debe incluir RNF');
});

test('AISLAMIENTO 3: Arquitectura NO debe filtrar infraestructura de ICASE Studio', () => {
  const libraryProject = {
    name: 'Sistema de Gestión de Biblioteca',
    technologies: [
      { name: 'React', category: 'FRONTEND' },
      { name: 'Node.js Express', category: 'BACKEND' },
      { name: 'PostgreSQL', category: 'DATABASE' }
    ],
    requirements: [
      { name: 'Préstamo de libros', type: 'FUNCTIONAL', status: 'APPROVED' },
      { name: 'Gestión de socios', type: 'FUNCTIONAL', status: 'APPROVED' }
    ],
    actors: [
      { name: 'Bibliotecario', codeId: 'ACT-01' },
      { name: 'Socio', codeId: 'ACT-02' }
    ]
  };

  const softwareArch = architectureGenerator.generate(libraryProject, { archType: 'software' });
  const systemArch = architectureGenerator.generate(libraryProject, { archType: 'system' });

  const bannedKeywords = ['ollama', 'whisper', 'faster-whisper', 'n8n', 'icase_backend', 'icase_frontend', 'icase_postgres', 'icase studio', '3001', '8080', '5433'];

  for (const kw of bannedKeywords) {
    assert.ok(
      !softwareArch.toLowerCase().includes(kw),
      `Arquitectura de software NO debe contener infraestructura de ICASE: "${kw}"`
    );
    assert.ok(
      !systemArch.toLowerCase().includes(kw),
      `Arquitectura de sistema NO debe contener infraestructura de ICASE: "${kw}"`
    );
  }

  // Debería contener las tecnologías del proyecto analizado
  assert.ok(softwareArch.includes('React') || softwareArch.includes('Presentación'));
  assert.ok(softwareArch.includes('Node') || softwareArch.includes('Servicios'));
});

test('CLASES 4: No métodos inventados ni relaciones duplicadas bidireccionales', () => {
  const rawClassDiagram = `classDiagram
  class OrdenTrabajo {
    +int id
    +string codigo
    +string estado
    +getId() int
    +toDTO() Object
    +validarReglas() boolean
    +iniciarReparacion() void
  }
  class Usuario {
    +int id
    +string nombre
    +getId() int
    +toDTO() Object
  }
  OrdenTrabajo o-- Usuario : agrega
  Usuario o-- OrdenTrabajo : agrega
`;

  const normalized = normalizeClass(rawClassDiagram);

  // Assert no banned methods
  assert.ok(!normalized.includes('getId()'), 'No debe existir getId()');
  assert.ok(!normalized.includes('toDTO()'), 'No debe existir toDTO()');
  assert.ok(!normalized.includes('validarReglas()'), 'No debe existir validarReglas()');
  assert.ok(normalized.includes('iniciarReparacion()'), 'Debe conservar el método de negocio legítimo');

  // Assert deduplication of bidirectional relationship
  const lines = normalized.split('\n').filter(l => l.includes('OrdenTrabajo') && l.includes('Usuario') && l.includes('o--'));
  assert.equal(lines.length, 1, 'Debe haber exactamente 1 relación entre OrdenTrabajo y Usuario, sin duplicado inverso');
});

test('ER 5: Normalización de atributos con tildes y deduplicación de relaciones', () => {
  const rawER = `erDiagram
    direction TB
    PRODUCTO {
        string código PK
        string categoría
        string descripción
        string categoría
    }
    VENTA {
        int id PK
        float monto
    }
    VENTA ||--o{ PRODUCTO : contiene
    PRODUCTO }o--|| VENTA : contiene
`;

  const normalized = normalizeER(rawER);

  // No accented attribute names
  assert.ok(!normalized.includes('código'), 'No debe contener caracteres con acento');
  assert.ok(!normalized.includes('categoría'), 'No debe contener caracteres con acento');
  assert.ok(!normalized.includes('descripción'), 'No debe contener caracteres con acento');
  assert.ok(normalized.includes('codigo'), 'Debe haber normalizado código a codigo');
  assert.ok(normalized.includes('categoria'), 'Debe haber normalizado categoría a categoria');

  // No duplicate relationships
  const relLines = normalized.split('\n').filter(l => l.includes('VENTA') && l.includes('PRODUCTO'));
  assert.equal(relLines.length, 1, 'Solo debe haber una relación entre VENTA y PRODUCTO, no relaciones inversas repetidas');
});
