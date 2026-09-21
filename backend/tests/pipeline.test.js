const assert = require('assert');
const textNormalizer = require('../src/services/document/textNormalizer');
const duplicateDetector = require('../src/services/document/duplicateDetector');
const technologyCatalog = require('../src/services/catalogs/technologyCatalog');
const architectureCatalog = require('../src/services/catalogs/architectureCatalog');
const requirementDetector = require('../src/services/analysis/requirementDetector');
const ambiguityDetector = require('../src/services/analysis/ambiguityDetector');
const analysisOrchestrator = require('../src/services/analysis/analysisOrchestrator');
const erDiagramGenerator = require('../src/services/diagrams/erDiagramGenerator');
const navigationGenerator = require('../src/services/diagrams/navigationGenerator');
const architectureGenerator = require('../src/services/diagrams/architectureGenerator');

async function runPipelineTests() {
  console.log('================================================================');
  console.log('   PRUEBAS UNITARIAS Y DE INTEGRACIÓN: PIPELINE HÍBRIDO ICASE   ');
  console.log('================================================================\n');

  // CASO 1: PDF con RF-01, RF-02, RNF-01 (Detección directa, no enviar a Ollama)
  console.log('[CASO 1] Detección determinista de RF-01, RF-02, RNF-01 sin Ollama');
  const textCaso1 = `
    REQUISITOS FUNCIONALES
    RF-01 Registrar usuarios en la plataforma institucional.
    RF-02 Gestionar libros y ejemplares del catálogo.

    REQUISITOS NO FUNCIONALES
    RNF-01 El tiempo de respuesta no debe exceder 1 segundo.
  `;
  const reqs1 = requirementDetector.detect(textCaso1);
  assert.strictEqual(reqs1.functionalRequirements.length, 2, 'Debe detectar exactamente 2 RF');
  assert.strictEqual(reqs1.functionalRequirements[0].code, 'RF-01');
  assert.strictEqual(reqs1.functionalRequirements[0].source, 'explicit');
  assert.strictEqual(reqs1.functionalRequirements[1].code, 'RF-02');
  assert.strictEqual(reqs1.nonFunctionalRequirements.length, 1, 'Debe detectar exactamente 1 RNF');
  assert.strictEqual(reqs1.nonFunctionalRequirements[0].code, 'RNF-01');
  assert.strictEqual(reqs1.nonFunctionalRequirements[0].source, 'explicit');

  // Verificar que el detector de ambigüedades no los envíe a Ollama
  const paragraphs1 = textNormalizer.normalize(textCaso1).paragraphs;
  const ambig1 = ambiguityDetector.detectAmbiguities(paragraphs1, reqs1);
  assert.strictEqual(ambig1.hasAmbiguity, false, 'No debe reportar ambigüedad en requisitos estructurados');
  assert.strictEqual(ambig1.ambiguousFragments.length, 0);
  console.log('   ✓ Caso 1 superado: RF-01, RF-02 y RNF-01 detectados como explicit y no enviados a Ollama.');

  // CASO 2: PDF con React, Node.js, PostgreSQL (Catálogo determinista)
  console.log('\n[CASO 2] Detección de tecnologías conocidas mediante catálogo');
  const textCaso2 = 'El sistema se construirá utilizando React en el frontend, Node.js + Express en el backend y PostgreSQL como base de datos.';
  const tech2 = technologyCatalog.detect(textCaso2);
  assert(tech2.frontend.includes('React'), 'Debe detectar React en frontend');
  assert(tech2.backend.includes('Node.js'), 'Debe detectar Node.js en backend');
  assert(tech2.database.includes('PostgreSQL'), 'Debe detectar PostgreSQL en database');
  assert.strictEqual(tech2.detected.find(t => t.name === 'React').source, 'explicit');
  console.log('   ✓ Caso 2 superado: Tecnologías detectadas y categorizadas sin IA.');

  // CASO 3: PDF con Arquitectura Web Modular Cliente-Servidor (Plantilla explícita)
  console.log('\n[CASO 3] Reconocimiento de arquitectura explícita y asignación de plantilla');
  const textCaso3 = 'La solución sigue una Arquitectura Web Modular Cliente-Servidor con microservicios ligeros.';
  const arch3 = architectureCatalog.detect(textCaso3, tech2);
  assert.strictEqual(arch3.name, 'Arquitectura Web Modular Cliente-Servidor');
  assert.strictEqual(arch3.source, 'explicit');
  assert(arch3.mermaidDiagram.includes('flowchart LR'), 'Debe generar diagrama flowchart LR');
  assert(arch3.mermaidDiagram.includes('React'), 'Debe incluir la tecnología detectada');
  console.log('   ✓ Caso 3 superado: Arquitectura reconocida como explicit con plantilla Mermaid.');

  // CASO 4: PDF sin arquitectura (Uso de predeterminada con source = default)
  console.log('\n[CASO 4] Arquitectura por defecto cuando el documento no la menciona');
  const textCaso4 = 'Documento simple que describe únicamente reglas de inventario de almacén sin mencionar infraestructura.';
  const arch4 = architectureCatalog.detect(textCaso4, {});
  assert.strictEqual(arch4.name, 'Arquitectura Web Modular Cliente-Servidor');
  assert.strictEqual(arch4.source, 'default', 'El origen debe ser estrictamente "default"');
  console.log('   ✓ Caso 4 superado: Arquitectura predeterminada asignada con source: "default".');

  // CASO 5: PDF con contenido repetido (Detección de duplicados y registro estadístico)
  console.log('\n[CASO 5] Eliminación de duplicados y registro estadístico');
  const fragmentsConDuplicados = [
    'Registrar usuarios en el sistema.',
    'Registrar usuarios en el sistema.', // duplicado exacto
    'REGISTRAR USUARIOS EN EL SISTEMA.', // duplicado normalizado
    'El sistema permitirá registrar usuarios en el sistema.', // cercano
    'Gestionar catálogo de productos y precios.'
  ];
  const dedupResult = duplicateDetector.deduplicateFragments(fragmentsConDuplicados);
  assert(dedupResult.statistics.duplicatesRemoved >= 2, `Se esperaban al menos 2 duplicados eliminados, fueron: ${dedupResult.statistics.duplicatesRemoved}`);
  assert(dedupResult.uniqueFragments.length <= 3, 'Deben quedar sólo fragmentos únicos');
  console.log(`   ✓ Caso 5 superado: ${dedupResult.statistics.duplicatesRemoved} duplicados eliminados de ${dedupResult.statistics.totalFragments} fragmentos.`);

  // CASO 6: PDF con párrafo ambiguo (Envío exclusivo del fragmento ambiguo)
  console.log('\n[CASO 6] Aislamiento de párrafo ambiguo hacia Ollama');
  const textCaso6 = `
    RF-01 Iniciar sesión en el portal.
    RF-02 Consultar inventario.
    En el futuro se podría evaluar la integración de un módulo de inteligencia artificial predictiva etcétera.
  `;
  const norm6 = textNormalizer.normalize(textCaso6);
  const reqs6 = requirementDetector.detect(textCaso6);
  const ambig6 = ambiguityDetector.detectAmbiguities(norm6.paragraphs, reqs6);
  assert.strictEqual(ambig6.hasAmbiguity, true, 'Debe detectar ambigüedad en el fragmento difuso');
  assert.strictEqual(ambig6.ambiguousFragments.length, 1, 'Debe aislar únicamente 1 fragmento ambiguo');
  assert(ambig6.ambiguousFragments[0].includes('se podría evaluar'), 'El fragmento debe ser el que contiene lenguaje ambiguo');
  assert(!ambig6.ambiguousFragments[0].includes('RF-01'), 'No debe incluir RF-01');
  console.log('   ✓ Caso 6 superado: Solo el fragmento ambiguo fue aislado; tokens estimados:', ambig6.stats.sentTokens);

  // CASO 7: Documento completamente estructurado (Cero llamadas a Ollama)
  console.log('\n[CASO 7] Documento completamente estructurado omite Ollama al 100%');
  const structuredDocText = `
    PROPUESTA TÉCNICA
    ARQUITECTURA
    Arquitectura Web Modular Cliente-Servidor con React, Node.js y PostgreSQL.

    ACTORES
    • Administrador: gestiona el sistema.
    • Operador: registra transacciones.

    REQUISITOS FUNCIONALES
    RF-01 Crear cuenta de usuario.
    RF-02 Emitir comprobante de pago.

    REQUISITOS NO FUNCIONALES
    RNF-01 Disponibilidad 99.9%.
  `;
  const resultCaso7 = await analysisOrchestrator.process(structuredDocText, 'sistema_estructurado.pdf', { providerOverride: 'mock' });
  assert.strictEqual(resultCaso7.statistics.aiFragments, 0, 'No debe enviar ningún fragmento a IA');
  assert.strictEqual(resultCaso7.ambiguousFragments.length, 0, 'Cero fragmentos ambiguos');
  assert(resultCaso7.requirements.length >= 3, 'Requisitos completos extraídos por reglas');
  assert.strictEqual(resultCaso7.architecture.source, 'explicit');
  assert(resultCaso7.diagrams.erDiagram.includes('erDiagram'));
  assert(resultCaso7.diagrams.navigationDiagram.includes('flowchart'));
  assert(resultCaso7.diagrams.architectureDiagram.includes('flowchart'));
  console.log('   ✓ Caso 7 superado: Pipeline 100% determinista sin consumo de tokens de Ollama.');

  console.log('\n================================================================');
  console.log('   ¡TODAS LAS PRUEBAS DEL PIPELINE HÍBRIDO PASARON (7/7)!      ');
  console.log('================================================================\n');
}

runPipelineTests().catch(err => {
  console.error('\n❌ ERROR EN PRUEBAS DE PIPELINE:', err);
  process.exit(1);
});
