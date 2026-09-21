const assert = require('assert');
const { createAIProvider, AIService } = require('../src/services/ai/AIService');
const MockAIProvider = require('../src/services/ai/MockAIProvider');
const GeminiProvider = require('../src/services/ai/GeminiProvider');
const OllamaProvider = require('../src/services/ai/OllamaProvider');
const OpenAIProvider = require('../src/services/ai/OpenAIProvider');
const N8nProvider = require('../src/services/ai/N8nProvider');
const { validateAIResponse } = require('../src/services/ai/ai.contract.validator');
const prisma = require('../src/config/prisma');

async function runTests() {
  console.log('====================================================');
  console.log('       INICIANDO SUITE DE PRUEBAS DE IA - ICASE     ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}`);
      console.error(`       Detalle: ${err.message}\n`);
      failed++;
    }
  }

  // PRUEBA 1: MockAIProvider devuelve JSON válido según el contrato
  await test('1. MockAIProvider devuelve JSON válido con todos los campos requeridos', async () => {
    const mock = new MockAIProvider();
    const result = await mock.analyzeProject({
      name: 'Sistema de Biblioteca',
      description: 'Sistema para administrar libros, usuarios y préstamos.'
    });

    assert.ok(result.project, 'Falta objeto project');
    assert.ok(Array.isArray(result.actors), 'actors debe ser un arreglo');
    assert.ok(Array.isArray(result.requirements), 'requirements debe ser un arreglo');
    assert.ok(Array.isArray(result.entities), 'entities debe ser un arreglo');
    assert.ok(Array.isArray(result.relationships), 'relationships debe ser un arreglo');
    assert.ok(Array.isArray(result.screens), 'screens debe ser un arreglo');
    assert.ok(Array.isArray(result.navigation), 'navigation debe ser un arreglo');
    assert.ok(result.architecture, 'architecture debe existir');

    const validation = validateAIResponse(result);
    assert.strictEqual(validation.isValid, true, `La validación falló: ${validation.error}`);
  });

  // PRUEBA 2: createAIProvider selecciona correctamente 'mock'
  await test('2. createAIProvider selecciona correctamente MockAIProvider por defecto o explícito', () => {
    const provider = createAIProvider('mock');
    assert.ok(provider instanceof MockAIProvider, 'Debe ser instancia de MockAIProvider');

    const defaultProvider = createAIProvider(undefined);
    assert.ok(defaultProvider instanceof MockAIProvider, 'Debe seleccionar MockAIProvider por defecto');
  });

  // PRUEBA 3: Un proveedor no configurado produce un error controlado
  await test('3. Proveedores no configurados producen errores controlados', async () => {
    const gemini = new GeminiProvider();
    let geminiFailed = false;
    try {
      await gemini.analyzeProject({ name: 'Test', description: 'Test' });
    } catch (err) {
      geminiFailed = true;
      assert.ok(err.message.includes('no está configurado') || err.message.includes('API key'), 'Mensaje de error descriptivo');
    }
    assert.strictEqual(geminiFailed, true, 'GeminiProvider sin clave debió lanzar error');

    const n8n = new N8nProvider();
    let n8nFailed = false;
    try {
      await n8n.analyzeProject({ name: 'Test', description: 'Test' });
    } catch (err) {
      n8nFailed = true;
      assert.ok(err.message.includes('no está configurado'), 'Mensaje descriptivo para n8n');
    }
    assert.strictEqual(n8nFailed, true, 'N8nProvider sin webhook debió lanzar error');
  });

  // PRUEBA 4: La validación rechaza respuestas inválidas o referencias rotas
  await test('4. Validador rechaza respuestas incompletas o con referencias inválidas', () => {
    // Falta project
    const invalid1 = validateAIResponse({ actors: [] });
    assert.strictEqual(invalid1.isValid, false);

    // actorIds que apuntan a un actor inexistente
    const invalidRef = validateAIResponse({
      project: { name: 'P' },
      actors: [{ id: 'ACT-01', name: 'Admin' }],
      requirements: [{ code: 'RF-01', name: 'Req', actorIds: ['ACT-999'] }],
      entities: [],
      relationships: [],
      screens: [],
      navigation: [],
      architecture: {}
    });
    assert.strictEqual(invalidRef.isValid, false);
    assert.ok(invalidRef.error.includes('actor inexistente'), 'Debe detectar actor inexistente');
  });

  // PRUEBA 5 y 6: El endpoint/servicio /analyze guarda en PostgreSQL
  let testProjectId = null;
  await test('5 y 6. AIService.analyzeProject persiste datos en PostgreSQL', async () => {
    const project = await prisma.project.create({
      data: {
        name: 'Proyecto de Prueba Automatizada',
        description: 'Quiero desarrollar un sistema para administrar una biblioteca con libros, usuarios y préstamos.',
        systemDescription: 'Quiero desarrollar un sistema para administrar una biblioteca con libros, usuarios y préstamos.'
      }
    });
    testProjectId = project.id;

    const result = await AIService.analyzeProject({
      projectId: testProjectId,
      name: project.name,
      description: project.description
    });

    assert.ok(result.requirements.length > 0, 'Debe haber guardado requisitos');
    assert.ok(result.actors.length > 0, 'Debe haber guardado actores');
    assert.ok(result.entities.length > 0, 'Debe haber guardado entidades');

    // Verificar en la BD
    const countReq = await prisma.requirement.count({ where: { projectId: testProjectId } });
    assert.strictEqual(countReq, result.requirements.length, 'Requisitos en BD deben coincidir');
  });

  // PRUEBA 7: Re-análisis no genera duplicados
  await test('7. Ejecutar nuevamente el análisis reemplaza sin generar duplicados', async () => {
    assert.ok(testProjectId, 'Se requiere testProjectId previo');

    // Ejecutar análisis por segunda vez
    const result2 = await AIService.analyzeProject({
      projectId: testProjectId,
      name: 'Proyecto de Prueba Automatizada',
      description: 'Quiero desarrollar un sistema para administrar una biblioteca con libros, usuarios y préstamos.'
    });

    const countReqAfter = await prisma.requirement.count({ where: { projectId: testProjectId } });
    const countActorsAfter = await prisma.actor.count({ where: { projectId: testProjectId } });
    const countEntitiesAfter = await prisma.entity.count({ where: { projectId: testProjectId } });

    assert.strictEqual(countReqAfter, result2.requirements.length, 'No deben acumularse requisitos duplicados');
    assert.strictEqual(countActorsAfter, result2.actors.length, 'No deben acumularse actores duplicados');
    assert.strictEqual(countEntitiesAfter, result2.entities.length, 'No deben acumularse entidades duplicadas');

    // Limpieza
    await prisma.project.delete({ where: { id: testProjectId } });
  });

  console.log('\n====================================================');
  console.log(`RESUMEN: ${passed} pruebas superadas, ${failed} fallidas.`);
  console.log('====================================================\n');

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Error fatal al ejecutar pruebas:', err);
  process.exit(1);
});
