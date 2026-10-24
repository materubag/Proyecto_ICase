const assert = require('assert');
const deduplicationService = require('../src/services/analysis/deduplicationService');
const architectureGenerator = require('../src/services/diagrams/architectureGenerator');
const diagramAiService = require('../src/services/diagrams/diagramAiService');
const erDiagramGenerator = require('../src/services/diagrams/erDiagramGenerator');

async function runMasterOverhaulTests() {
  console.log('================================================================');
  console.log('   PRUEBAS OBLIGATORIAS: MASTER OVERHAUL (REQ #1 - #28)         ');
  console.log('================================================================\n');

  // TEST 1: Requisitos 3 equivalentes -> 1 canónico con trazabilidad
  console.log('[TEST 1] Requisitos: 3 equivalentes -> 1 canónico con trazabilidad de fuentes');
  const candidates = [
    {
      id: 'cand-1',
      code: 'RF-001',
      name: 'Registrar usuarios',
      statement: 'El sistema permitirá al administrador registrar usuarios en la plataforma.',
      sourceFile: 'DocA.pdf'
    },
    {
      id: 'cand-2',
      code: 'RF-027',
      name: 'Crear nuevos usuarios',
      statement: 'El administrador podrá crear nuevos usuarios.',
      sourceFile: 'DocB.pdf'
    },
    {
      id: 'cand-3',
      code: 'RF-054',
      name: 'Registrar nuevos usuarios',
      statement: 'El administrador podrá registrar nuevos usuarios.',
      sourceFile: 'DocC.pdf'
    }
  ];

  const { canonicalRequirements, extractionStats } = deduplicationService.groupAndConsolidateRequirements(candidates);
  assert.strictEqual(canonicalRequirements.length, 1, 'Debe consolidar los 3 requisitos equivalentes en exactamente 1 canónico');
  const canonical = canonicalRequirements[0];
  assert.strictEqual(canonical.status, 'PENDING', 'El requisito canónico debe entrar como PENDING');
  assert.ok(Array.isArray(canonical.sources), 'Debe contener el array de sources');
  assert.strictEqual(canonical.sources.length, 3, 'Debe conservar las 3 fuentes originales');
  const sourceCodes = canonical.sources.map(s => s.temporaryCode);
  assert.ok(sourceCodes.includes('RF-001') && sourceCodes.includes('RF-027') && sourceCodes.includes('RF-054'), 'Trazabilidad de códigos original');
  assert.strictEqual(extractionStats.duplicatesGrouped, 2, 'Debe registrar 2 duplicados consolidados en las métricas');
  console.log('  -> PASS: 3 candidatos agrupados correctamente en 1 canónico con sus 3 fuentes.\n');

  // TEST 2: Actores (Administrador, Administrador/a, Admin -> 1 actor)
  console.log('[TEST 2] Actores: Normalización y canonicalización con aliases');
  const rawActors = [
    { id: 'act-1', codeId: 'ACT-01', name: 'Administrador' },
    { id: 'act-2', codeId: 'ACT-02', name: 'Administrador/a' },
    { id: 'act-3', codeId: 'ACT-03', name: 'Admin' },
    { id: 'act-4', codeId: 'ACT-04', name: 'Cliente' },
    { id: 'act-5', codeId: 'ACT-05', name: 'Mecánico' }
  ];

  const consolidatedActors = deduplicationService.consolidateActors(rawActors);
  assert.strictEqual(consolidatedActors.length, 3, 'Debe haber 3 actores únicos (Administrador, Cliente, Mecánico)');
  const adminActor = consolidatedActors.find(a => /admin/i.test(a.name));
  assert.ok(adminActor, 'El actor canónico Administrador debe existir');
  assert.strictEqual(adminActor.name, 'Administrador');
  assert.ok(Array.isArray(adminActor.aliases), 'Debe tener aliases');
  assert.ok(adminActor.aliases.includes('Administrador/a'), 'Debe incluir Administrador/a en aliases');
  console.log('  -> PASS: Actores duplicados normalizados en 1 canónico con aliases.\n');

  // TEST 3: Clases sin métodos genéricos inventados
  console.log('[TEST 3] Clases: Prohibición de métodos genéricos inventados (no getId, validate, toDTO)');
  const classInstructions = diagramAiService.getSystemInstructions('CLASS');
  assert.ok(classInstructions.includes('PROHIBIDO: getId, setId, toDTO, validate, save, validarReglas'), 'Debe prohibir explícitamente métodos genéricos');
  assert.ok(!classInstructions.includes('+validarReglas() boolean'), 'No debe dar ejemplos con métodos inventados');
  console.log('  -> PASS: Diagrama de clases sin métodos genéricos inventados.\n');

  // TEST 4: Arquitectura y Aislamiento del proyecto analizado (NO ICASE Studio)
  console.log('[TEST 4] Arquitectura: Aislamiento del proyecto analizado (NO ICASE Studio)');
  const targetProjectArchitecture = {
    name: 'AUTRON Taller',
    frontend: 'React Web',
    backend: 'Node API REST',
    database: 'PostgreSQL Taller'
  };

  const diagram = architectureGenerator.generateSoftwareArchitecture(targetProjectArchitecture, {});
  assert.ok(!/ollama/i.test(diagram), 'No debe contener Ollama');
  assert.ok(!/whisper/i.test(diagram), 'No debe contener Whisper');
  assert.ok(!/n8n/i.test(diagram), 'No debe contener n8n');
  assert.ok(!/icase/i.test(diagram), 'No debe contener i-CASE');
  assert.ok(!/:3001/.test(diagram), 'No debe contener puerto 3001');
  assert.ok(!/:8080/.test(diagram), 'No debe contener puerto 8080');
  assert.ok(!/:5433/.test(diagram), 'No debe contener puerto 5433');
  assert.ok(!/prisma\s+orm/i.test(diagram), 'No debe contener Prisma ORM');

  const archInstructions = diagramAiService.getSystemInstructions('ARCHITECTURE');
  assert.ok(archInstructions.includes('PROHIBIDO: Ollama, Gemini, n8n, Faster-Whisper, Prisma ORM'), 'Debe prohibir explícitamente infraestructura de ICASE');
  console.log('  -> PASS: Arquitectura estrictamente aislada del proyecto analizado.\n');

  // TEST 5: ER Diagram: Atributos sin caracteres ilegales y relaciones justificadas
  console.log('[TEST 5] ER: Atributos limpios y relaciones justificadas');
  const entities = [
    {
      name: 'Vehículo',
      attributes: [
        { name: 'código chasis', type: 'string', isPk: true },
        { name: 'año fabricación', type: 'int' }
      ]
    },
    {
      name: 'Cliente',
      attributes: [
        { name: 'código identificación', type: 'string', isPk: true }
      ]
    }
  ];

  const relationships = [
    { source: 'Cliente', target: 'Vehículo', cardinality: '1:N', description: 'es dueño de' }
  ];

  const mermaid = erDiagramGenerator.generate(entities, relationships);
  assert.ok(mermaid.includes('erDiagram'), 'Debe empezar con erDiagram');
  assert.ok(!mermaid.includes('código chasis'), 'No debe contener tildes ni espacios en atributos');
  assert.ok(!mermaid.includes('año fabricación'), 'No debe contener ñ ni espacios en atributos');
  assert.ok(/codigo_chasis/.test(mermaid), 'Debe tener token normalizado codigo_chasis');
  assert.ok(/ano_fabricacion/.test(mermaid), 'Debe tener token normalizado ano_fabricacion');
  assert.ok(mermaid.includes('||--o{'), 'Debe generar la relación 1:N');
  console.log('  -> PASS: Diagrama ER generado con atributos limpios y relación justificada.\n');

  console.log('================================================================');
  console.log('   TODAS LAS PRUEBAS OBLIGATORIAS PASARON SATISFACTORIAMENTE   ');
  console.log('================================================================');
}

runMasterOverhaulTests().catch(err => {
  console.error('Error en pruebas obligatorias:', err);
  process.exit(1);
});
