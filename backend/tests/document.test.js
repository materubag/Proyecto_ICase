const assert = require('assert');
const path = require('path');
const fs = require('fs');

const pdfExtractor = require('../src/services/document/PdfExtractor');
const pdfTextCleaner = require('../src/services/document/PdfTextCleaner');
const sectionDetector = require('../src/services/document/SectionDetector');
const ruleBasedExtractor = require('../src/services/document/RuleBasedExtractor');
const documentAnalyzer = require('../src/services/document/DocumentAnalyzer');
const { buildAIContext, buildDocumentPrompt } = require('../src/services/document/documentPrompt');
const { validateAIResponse } = require('../src/services/ai/ai.contract.validator');
const OllamaProvider = require('../src/services/ai/OllamaProvider');

async function runTests() {
  console.log('====================================================');
  console.log('   PRUEBAS AUTOMATIZADAS: FLUJO DE DOCUMENTOS ICASE   ');
  console.log('====================================================\n');

  const pdfPath = path.resolve(__dirname, '../../AUTRON_Propuesta_Overleaf.pdf');
  assert(fs.existsSync(pdfPath), `El archivo de prueba debe existir en ${pdfPath}`);
  const pdfBuffer = fs.readFileSync(pdfPath);

  // Test 1: PdfExtractor sobre AUTRON_Propuesta_Overleaf.pdf
  console.log('[TEST 1] PdfExtractor: Extracción de archivo PDF real');
  const extraction = await pdfExtractor.extractFromBuffer(pdfBuffer, 'AUTRON_Propuesta_Overleaf.pdf');
  assert.strictEqual(extraction.fileName, 'AUTRON_Propuesta_Overleaf.pdf');
  assert.strictEqual(extraction.pageCount, 16, `Se esperaban 16 páginas, se obtuvieron ${extraction.pageCount}`);
  assert(extraction.textLength > 5000, `Longitud de texto esperada > 5000, obtenida ${extraction.textLength}`);
  assert.strictEqual(extraction.isScanned, false);
  console.log('   ✓ Extracción correcta: 16 páginas, longitud:', extraction.textLength);

  // Test 2: Control de documento vacío / sin texto extraíble
  console.log('\n[TEST 2] PdfExtractor: Manejo controlado de documento sin texto');
  try {
    await pdfExtractor.extractFromBuffer(Buffer.from(''), 'vacio.pdf');
    assert.fail('Debió fallar por buffer vacío');
  } catch (err) {
    assert(err.statusCode === 400 || err.message.includes('vacío'));
    console.log('   ✓ Error controlado para buffer vacío:', err.message);
  }

  // Test 3: PdfTextCleaner
  console.log('\n[TEST 3] PdfTextCleaner: Limpieza determinística y preservación de códigos');
  const sampleDirtyText = '  NEXORA   ·   SOLUCIONES DE SOFTWARE AUTRON · 12 \n\n' +
    'RF-01   Registrar  usuarios,   autenticar.\n' +
    'opera-\n cional y cono- \n cimiento.\n\n\n\n' +
    'Página 12\n' +
    'PERFILES CONTEMPLADOS\n' +
    '• Cliente: gestiona citas.\n';

  const cleanedSample = pdfTextCleaner.clean(sampleDirtyText);
  assert(cleanedSample.includes('RF-01 Registrar usuarios, autenticar.'), 'Debe preservar RF-01 sin saltos indebidos');
  assert(cleanedSample.includes('operacional y conocimiento.'), 'Debe unir palabras partidas por guion');
  assert(!cleanedSample.includes('Página 12'), 'Debe suprimir números de página aislados');
  assert(!cleanedSample.includes('SOLUCIONES DE SOFTWARE AUTRON · 12'), 'Debe eliminar pies de página recurrentes');
  console.log('   ✓ Limpieza determinística validada');

  // Test 4: SectionDetector
  console.log('\n[TEST 4] SectionDetector: Reconocimiento de secciones');
  const cleanedFullText = pdfTextCleaner.clean(extraction.extractedText);
  const sections = sectionDetector.detectSections(cleanedFullText);
  assert(sections.length > 5, `Se esperaban múltiples secciones, detectadas: ${sections.length}`);

  const sectionTitles = sections.map(s => s.normalizedTitle);
  assert(sectionTitles.some(t => t.includes('REQUISITOS FUNCIONALES')), 'Debe detectar REQUISITOS FUNCIONALES');
  assert(sectionTitles.some(t => t.includes('PERFILES CONTEMPLADOS')), 'Debe detectar PERFILES CONTEMPLADOS');
  assert(sectionTitles.some(t => t.includes('ARQUITECTURA')), 'Debe detectar ARQUITECTURA');
  assert(sectionTitles.some(t => t.includes('PROPUESTA ECONOMICA') || t.includes('COSTOS')), 'Debe detectar PROPUESTA ECONÓMICA');
  console.log(`   ✓ Secciones identificadas: ${sections.length} secciones detectadas`);

  // Test 5: RuleBasedExtractor (Requisitos, Actores, Reglas, Tecnologías, Entidades con source: 'pdf')
  console.log('\n[TEST 5] RuleBasedExtractor: Extracción de RF, RNF, Actores, Reglas y Tecnologías por reglas');
  const rules = ruleBasedExtractor.extract(cleanedFullText, sections, { fileName: extraction.fileName, pageCount: extraction.pageCount });

  // Validar RF-01 hasta RF-34
  assert(rules.functionalRequirements.length >= 34, `Se esperaban al menos 34 RF, detectados: ${rules.functionalRequirements.length}`);
  const rf01 = rules.functionalRequirements.find(r => r.code === 'RF-01');
  assert(rf01, 'RF-01 debe existir');
  assert.strictEqual(rf01.source, 'pdf', 'El origen debe ser pdf');
  assert(rf01.name.includes('Registrar usuarios'), `Nombre de RF-01 no coincide: ${rf01.name}`);

  const rf34 = rules.functionalRequirements.find(r => r.code === 'RF-34');
  assert(rf34, 'RF-34 debe existir');
  assert(rf34.name.includes('auditoría'), `Nombre de RF-34 no coincide: ${rf34.name}`);

  // Validar RNF
  assert(rules.nonFunctionalRequirements.length >= 8, `Se esperaban al menos 8 RNF, detectados: ${rules.nonFunctionalRequirements.length}`);
  const rnf01 = rules.nonFunctionalRequirements.find(r => r.code === 'RNF-01');
  assert(rnf01, 'RNF-01 debe existir');
  assert.strictEqual(rnf01.type, 'NON_FUNCTIONAL');
  assert.strictEqual(rnf01.source, 'pdf');

  // Validar Reglas de negocio
  assert(rules.businessRules.length >= 5, `Se esperaban reglas de negocio, detectadas: ${rules.businessRules.length}`);
  assert.strictEqual(rules.businessRules[0].source, 'pdf');

  // Validar Actores
  assert(rules.actors.length >= 4, `Se esperaban al menos 4 actores, detectados: ${rules.actors.length}`);
  const actorNames = rules.actors.map(a => a.name.toLowerCase());
  assert(actorNames.some(n => n.includes('cliente')), 'Debe contener Cliente');
  assert(actorNames.some(n => n.includes('mecánico') || n.includes('mecanico')), 'Debe contener Mecánico');
  assert(actorNames.some(n => n.includes('recepción') || n.includes('recepcion')), 'Debe contener Recepción');
  assert(actorNames.some(n => n.includes('administrador')), 'Debe contener Administrador');

  // Validar Tecnologías detectadas
  assert(rules.technologies.includes('React'), 'Debe detectar React');
  assert(rules.technologies.includes('Node.js'), 'Debe detectar Node.js');
  assert(rules.technologies.includes('PostgreSQL'), 'Debe detectar PostgreSQL');

  console.log(`   ✓ Requisitos detectados: ${rules.functionalRequirements.length} RF, ${rules.nonFunctionalRequirements.length} RNF, ${rules.businessRules.length} Reglas`);
  console.log(`   ✓ Actores detectados: ${rules.actors.map(a => a.name).join(', ')}`);
  console.log(`   ✓ Tecnologías detectadas: ${rules.technologies.join(', ')}`);

  // Test 6: Estructura intermedia y reducción drástica de contexto para Ollama
  console.log('\n[TEST 6] buildAIContext: Reducción de contexto para evitar truncamiento en Ollama');
  const aiContext = buildAIContext(rules);
  const prompt = buildDocumentPrompt(aiContext);
  const approxTokens = Math.round(prompt.length / 4);

  assert(!prompt.includes('USD 4.720,00'), 'No debe incluir la tarifa total económica');
  assert(!prompt.includes('USD 8,00'), 'No debe incluir tarifas de desarrollo');
  assert(!prompt.includes(cleanedFullText.slice(1000, 2000)), 'No debe incluir el rawText completo');
  assert(approxTokens < 1400, `El prompt debe tener < 1400 tokens para no truncar en Ollama (estimados: ${approxTokens})`);
  console.log(`   ✓ Prompt compacto generado: ${prompt.length} caracteres (~${approxTokens} tokens) vs límite de 2060 tokens`);

  // Test 7: parseAIResponse con múltiples formatos (JSON puro, markdown, y extracción)
  console.log('\n[TEST 7] parseAIResponse: Normalización y recuperación de JSON');
  const pureJson = JSON.stringify({ projectName: 'Test', functionalRequirements: [] });
  const parsed1 = documentAnalyzer.parseAIResponse(pureJson);
  assert.strictEqual(parsed1.isValid, true);

  const markdownJson = 'Aquí está el resultado:\n```json\n{"projectName": "Markdown Test", "actors": []}\n```\nFin.';
  const parsed2 = documentAnalyzer.parseAIResponse(markdownJson);
  assert.strictEqual(parsed2.isValid, true);
  assert.strictEqual(parsed2.data.projectName, 'Markdown Test');

  const wrappedJson = 'Análisis completo: {"projectName": "Wrapped Test", "items": [1, 2]} Espero sirva.';
  const parsed3 = documentAnalyzer.parseAIResponse(wrappedJson);
  assert.strictEqual(parsed3.isValid, true);
  assert.strictEqual(parsed3.data.projectName, 'Wrapped Test');

  const invalidText = 'Esto es texto puramente narrativo sin ningún JSON.';
  const parsed4 = documentAnalyzer.parseAIResponse(invalidText);
  assert.strictEqual(parsed4.isValid, false);
  console.log('   ✓ parseAIResponse probó satisfactoriamente los 4 casos de respuesta');

  // Test 8: Fallback determinista cuando Ollama falla o no responde
  console.log('\n[TEST 8] Fallback determinista: Estructura canónica completa sin depender de Ollama');
  const fallbackModel = documentAnalyzer.buildDeterministicMetamodel(rules, 'Fallback prueba');
  const validation = validateAIResponse(fallbackModel);
  assert.strictEqual(validation.isValid, true, `El modelo de fallback debe ser 100% válido: ${validation.error}`);
  assert(fallbackModel.requirements.length >= 40, 'Debe incluir todos los requisitos de reglas');
  assert(fallbackModel.actors.length >= 4, 'Debe incluir todos los actores de reglas');
  assert(fallbackModel.entities.length >= 2, 'Debe incluir entidades');
  assert(fallbackModel.screens.length >= 1, 'Debe incluir pantallas');
  assert(fallbackModel.architecture.style, 'Debe incluir arquitectura');
  assert.strictEqual(fallbackModel.requirements[0].source, 'pdf', 'El origen debe ser pdf');
  console.log(`   ✓ Fallback determinista validado: ${fallbackModel.requirements.length} requisitos y ${fallbackModel.actors.length} actores conformes al contrato canónico`);

  // Test 9: analyzeWithAI con Mock Provider (simulando enriquecimiento IA)
  console.log('\n[TEST 9] analyzeWithAI: Flujo completo de análisis y enriquecimiento');
  const aiAnalysis = await documentAnalyzer.analyzeWithAI(rules, 'mock');
  const aiValidation = validateAIResponse(aiAnalysis);
  assert.strictEqual(aiValidation.isValid, true, `El análisis final debe ser válido: ${aiValidation.error}`);
  assert(aiAnalysis.requirements.length >= 34);
  console.log(`   ✓ Flujo de análisis final exitoso: ${aiAnalysis.requirements.length} requisitos estructurados`);

  // Test 10: Control de fallo de conexión de Ollama
  console.log('\n[TEST 10] OllamaProvider: Mensaje controlado en fallo de conexión');
  const ollamaProvider = new OllamaProvider();
  try {
    process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:9999';
    process.env.OLLAMA_TIMEOUT = '2000';
    await ollamaProvider.analyzeProject({ name: 'Test', description: 'Prueba' });
    assert.fail('Debió fallar al no estar Ollama en el puerto 9999');
  } catch (err) {
    assert(err.message.includes('Ollama no está disponible'), `Mensaje esperado no coincide: ${err.message}`);
    console.log('   ✓ Error de conexión con Ollama interceptado y manejado limpiamente');
  } finally {
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_TIMEOUT;
  }

  console.log('\n====================================================');
  console.log('   ¡TODAS LAS PRUEBAS AUTOMATIZADAS PASARON (10/10)! ');
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ ERROR EN LAS PRUEBAS:', err);
  process.exit(1);
});
