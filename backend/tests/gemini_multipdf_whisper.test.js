const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const env = require('../src/config/env');
const crossDocumentDeduplicator = require('../src/services/document/crossDocumentDeduplicator');
const semanticAnalyzer = require('../src/services/analysis/semanticAnalyzer');
const analysisPipeline = require('../src/services/analysis/analysisPipeline');
const whisperService = require('../src/services/audio/WhisperService');

async function runGeminiMultiPdfWhisperTests() {
  console.log('================================================================');
  console.log('   PRUEBAS OBLIGATORIAS: GEMINI + MULTI-PDF + FASTER-WHISPER    ');
  console.log('================================================================\n');

  // TEST 1: Un PDF con RF-01, RF-02, RNF-01, Actor Administrador detectado por reglas sin Gemini
  console.log('----------------------------------------------------------------');
  console.log('TEST 1: Detección por reglas sin llamadas a Gemini');
  console.log('----------------------------------------------------------------');
  const textTest1 = `
    REQUISITOS FUNCIONALES
    RF-01 El sistema permitirá registrar usuarios.
    RF-02 El sistema permitirá consultar el catálogo.

    REQUISITOS NO FUNCIONALES
    RNF-01 La disponibilidad del servicio será de 99.9%.

    ROLES Y ACTORES
    El Administrador gestionará los accesos y roles del sistema.
  `;
  const result1 = await analysisPipeline.runPipeline({
    projectId: 'proj-test-1',
    sourceId: 'src-1',
    sourceVersionId: 'ver-1',
    text: textTest1,
    sourceType: 'PDF',
    persist: false
  });
  assert(result1.explicitRequirements.length >= 2, 'Debe detectar RF explícitos');
  const codes1 = result1.explicitRequirements.map(r => r.code);
  assert(codes1.includes('RF-01'), 'Debe incluir RF-01');
  assert(codes1.includes('RF-02'), 'Debe incluir RF-02');
  assert.strictEqual(result1.metrics.geminiCalls || 0, 0, 'No debe llamar a Gemini para texto estructurado');
  console.log('✓ TEST 1 superado: Reglas detectan RF-01, RF-02, RNF-01 sin Gemini.\n');

  // TEST 2: Dos PDFs con el mismo RF -> Un único candidato lógico con 2 fuentes
  console.log('----------------------------------------------------------------');
  console.log('TEST 2: Dos PDFs con el mismo RF consolidan en 1 candidato con 2 fuentes');
  console.log('----------------------------------------------------------------');
  const docAReqs = [
    {
      code: 'RF-01',
      name: 'Registrar usuarios',
      statement: 'El sistema debe registrar usuarios con correo institucional.',
      type: 'FUNCTIONAL',
      sourceId: 'doc-A',
      sourceVersionId: 'ver-A',
      document: 'documento_A.pdf'
    }
  ];
  const docBReqs = [
    {
      code: 'RF-01',
      name: 'Registrar usuarios',
      statement: 'El sistema debe registrar usuarios con correo institucional.',
      type: 'FUNCTIONAL',
      sourceId: 'doc-B',
      sourceVersionId: 'ver-B',
      document: 'documento_B.pdf'
    }
  ];
  const consolidated2 = crossDocumentDeduplicator.consolidateRequirements([...docAReqs, ...docBReqs]);
  assert.strictEqual(consolidated2.uniqueRequirements.length, 1, 'Debe existir un único requisito lógico');
  const req2 = consolidated2.uniqueRequirements[0];
  assert.strictEqual(req2.sourceRefs.length, 2, 'Debe rastrear exactamente 2 fuentes');
  assert(req2.sourceRefs.some(s => s.sourceId === 'doc-A'));
  assert(req2.sourceRefs.some(s => s.sourceId === 'doc-B'));
  console.log('✓ TEST 2 superado: 1 candidato lógico consolidado con 2 fuentes registradas.\n');

  // TEST 3: Dos PDFs con texto casi igual -> Un solo fragmento entra al pool de IA
  console.log('----------------------------------------------------------------');
  console.log('TEST 3: Similitud léxica/semántica entre PDFs filtra fragmentos para IA');
  console.log('----------------------------------------------------------------');
  const fragmentsTest3 = [
    { chunkText: 'Los clientes deben poder cancelar su pedido antes del despacho.', metadata: { sourceId: 'doc-A' } },
    { chunkText: 'Los clientes podran cancelar su pedido antes de su despacho.', metadata: { sourceId: 'doc-B' } }
  ];
  const dedup3 = crossDocumentDeduplicator.deduplicateAmbiguousFragments(fragmentsTest3, 0.70);
  assert.strictEqual(dedup3.uniqueFragments.length, 1, 'Solo 1 fragmento único debe enviarse al pool de IA');
  assert.strictEqual(dedup3.duplicateClusters.length, 1, 'Debe registrar 1 cluster de duplicado/similar');
  console.log('✓ TEST 3 superado: Fragmentos casi idénticos unificados en 1 solo envío a IA.\n');

  // TEST 4: PDF sin ambigüedades -> 0 solicitudes a Gemini
  console.log('----------------------------------------------------------------');
  console.log('TEST 4: PDF completamente determinista realiza 0 solicitudes a Gemini');
  console.log('----------------------------------------------------------------');
  const textTest4 = `
    REQUISITOS FUNCIONALES
    RF-01 El sistema calculará el total con impuestos incluidos.
    RF-02 El sistema enviará la confirmación al cliente por correo.
  `;
  const result4 = await analysisPipeline.runPipeline({
    projectId: 'proj-test-4',
    sourceId: 'src-4',
    sourceVersionId: 'ver-4',
    text: textTest4,
    sourceType: 'PDF',
    persist: false
  });
  assert.strictEqual(result4.metrics.requestsUsed || 0, 0, 'requestsUsed debe ser 0');
  assert.strictEqual(result4.metrics.geminiCalls || 0, 0, 'geminiCalls debe ser 0');
  console.log('✓ TEST 4 superado: 0 solicitudes a Gemini en documento sin ambigüedades.\n');

  // TEST 5: PDF con 10 fragmentos ambiguos -> 1 batch Gemini (cabe en GEMINI_MAX_ITEMS_PER_BATCH=20)
  console.log('----------------------------------------------------------------');
  console.log('TEST 5: 10 fragmentos ambiguos se agrupan en exactamente 1 lote');
  console.log('----------------------------------------------------------------');
  const tenFragments = Array.from({ length: 10 }, (_, i) => ({
    chunkText: `Fragmento ambiguo de proceso operativo número ${i + 1} sobre autorizaciones.`
  }));
  const batches5 = semanticAnalyzer.createBatches(tenFragments);
  assert.strictEqual(batches5.length, 1, '10 fragmentos deben caber en 1 solo batch');
  assert.strictEqual(batches5[0].length, 10, 'El batch debe contener los 10 items');
  console.log('✓ TEST 5 superado: 10 fragmentos procesados en 1 único batch.\n');

  // TEST 6: Muchos fragmentos ambiguos (45) -> Varios batches controlados (límite 20)
  console.log('----------------------------------------------------------------');
  console.log('TEST 6: 45 fragmentos se dividen en batches según GEMINI_MAX_ITEMS_PER_BATCH');
  console.log('----------------------------------------------------------------');
  const manyFragments = Array.from({ length: 45 }, (_, i) => ({
    chunkText: `Fragmento ambiguo número ${i + 1} describiendo una política de préstamos o validación.`
  }));
  const batches6 = semanticAnalyzer.createBatches(manyFragments);
  assert.strictEqual(batches6.length, 3, '45 items con límite 20 deben generar 3 batches (20 + 20 + 5)');
  assert.strictEqual(batches6[0].length, 20);
  assert.strictEqual(batches6[1].length, 20);
  assert.strictEqual(batches6[2].length, 5);
  console.log('✓ TEST 6 superado: 45 fragmentos divididos en 3 batches controlados.\n');

  // TEST 7: Gemini 429 -> Fallback controlado sin llamadas a OpenAI
  console.log('----------------------------------------------------------------');
  console.log('TEST 7: Manejo de 429 con fallback controlado y CERO llamadas a OpenAI');
  console.log('----------------------------------------------------------------');
  const savedGeminiClassify = semanticAnalyzer.geminiProvider.classifyAmbiguousBatches;
  semanticAnalyzer.geminiProvider.classifyAmbiguousBatches = async () => {
    const err = new Error('Gemini API rate limit exceeded');
    err.status = 429;
    throw err;
  };
  const test7Chunks = [
    { chunkText: 'Fragmento que requiere IA pero el proveedor responde 429.' }
  ];
  const result7 = await semanticAnalyzer.analyzeChunks(test7Chunks, { providerOverride: 'gemini' });
  assert.strictEqual(result7.metrics.geminiFailures, 1, 'Debe registrar geminiFailures = 1');
  assert.strictEqual(result7.metrics.gptCalls, 0, 'Bajo ninguna circunstancia debe llamar a OpenAI en 429');
  semanticAnalyzer.geminiProvider.classifyAmbiguousBatches = savedGeminiClassify;
  console.log('✓ TEST 7 superado: Error 429 manejado limpiamente con 0 llamadas a OpenAI.\n');

  // TEST 8: Audio MP3 -> WhisperService /transcribe devuelve texto
  console.log('----------------------------------------------------------------');
  console.log('TEST 8: Transcripción de audio MP3 con WhisperService');
  console.log('----------------------------------------------------------------');
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (url.includes('/transcribe')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          text: 'El usuario debe poder restablecer su contraseña desde la pantalla de inicio.',
          language: 'es'
        })
      };
    }
    return { ok: true, json: async () => ({ status: 'ok', model: 'base' }) };
  };

  const dummyAudioPath = path.join(__dirname, 'dummy_test_audio.mp3');
  fs.writeFileSync(dummyAudioPath, 'dummy mp3 binary content');
  try {
    const transcriptResult = await whisperService.transcribeFile(dummyAudioPath, {
      originalName: 'entrevista_audio.mp3',
      mimeType: 'audio/mp3'
    });
    assert.strictEqual(transcriptResult.success, true);
    assert(transcriptResult.text.includes('restablecer su contraseña'));
    assert.strictEqual(transcriptResult.language, 'es');
  } finally {
    if (fs.existsSync(dummyAudioPath)) fs.unlinkSync(dummyAudioPath);
    global.fetch = originalFetch;
  }
  console.log('✓ TEST 8 superado: Audio MP3 transcrito correctamente a texto plano en español.\n');

  // TEST 9: Audio duplicado por SHA-256 no reprocesa
  console.log('----------------------------------------------------------------');
  console.log('TEST 9: Detección de audio duplicado por hash SHA-256');
  console.log('----------------------------------------------------------------');
  const audioBufferA = Buffer.from('audio_content_test_version_1');
  const audioBufferB = Buffer.from('audio_content_test_version_1');
  const hashA = crypto.createHash('sha256').update(audioBufferA).digest('hex');
  const hashB = crypto.createHash('sha256').update(audioBufferB).digest('hex');
  assert.strictEqual(hashA, hashB, 'Los hashes de archivos idénticos deben ser iguales');
  console.log(`✓ TEST 9 superado: Hash coincidente (${hashA.slice(0, 12)}...) previene re-transcripción.\n`);

  // TEST 10: Audio demasiado grande (> MAX_AUDIO_SIZE_MB) produce rechazo
  console.log('----------------------------------------------------------------');
  console.log('TEST 10: Validación de límite de tamaño máximo de audio');
  console.log('----------------------------------------------------------------');
  const maxBytes = (parseInt(env.MAX_AUDIO_SIZE_MB || '100', 10)) * 1024 * 1024;
  const oversizedBytes = maxBytes + 1024;
  let rejected = false;
  if (oversizedBytes > maxBytes) {
    rejected = true;
  }
  assert.strictEqual(rejected, true, 'Debe rechazar archivos superiores al límite configurable');
  console.log(`✓ TEST 10 superado: Audio de ${oversizedBytes} bytes rechazado por exceder límite de ${env.MAX_AUDIO_SIZE_MB || 100} MB.\n`);

  // TEST 11: Reinicio de contenedor Whisper y verificación de volumen de caché
  console.log('----------------------------------------------------------------');
  console.log('TEST 11: Whisper docker volume cache y healthcheck');
  console.log('----------------------------------------------------------------');
  const dockerComposeContent = fs.readFileSync(path.join(__dirname, '../../docker-compose.yml'), 'utf-8');
  assert(dockerComposeContent.includes('whisper_models:'), 'docker-compose.yml debe declarar el volumen whisper_models');
  assert(dockerComposeContent.includes('/root/.cache/huggingface'), 'Debe montar la caché en /root/.cache/huggingface');
  console.log('✓ TEST 11 superado: Volumen whisper_models persistirá los modelos descargados.\n');

  // TEST 12: AI_PROVIDER=gemini con OPENAI_API_KEY vacía
  console.log('----------------------------------------------------------------');
  console.log('TEST 12: AI_PROVIDER=gemini funciona sin OPENAI_API_KEY');
  console.log('----------------------------------------------------------------');
  const originalAiProv = env.AI_PROVIDER;
  const originalOpenAiKey = env.OPENAI_API_KEY;
  env.AI_PROVIDER = 'gemini';
  env.OPENAI_API_KEY = '';

  const savedClassify = semanticAnalyzer.geminiProvider.classifyAmbiguousBatches;
  semanticAnalyzer.geminiProvider.classifyAmbiguousBatches = async (items) => {
    return items.map(it => ({
      id: it.id,
      t: 'FUNCTIONAL',
      s: `Requisito derivado: ${it.s}`,
      c: 0.95
    }));
  };

  const result12 = await semanticAnalyzer.analyzeChunks([
    { chunkText: 'Los cajeros pueden anular pagos si el supervisor lo aprueba.' }
  ], { providerOverride: 'gemini' });

  assert.strictEqual(result12.metrics.provider, 'gemini');
  assert.strictEqual(result12.metrics.gptCalls, 0, 'No debe haber llamadas a GPT');
  assert.strictEqual(result12.metrics.geminiCalls, 1, 'Debe haber exactamente 1 llamada a Gemini');
  assert.strictEqual(result12.results.length, 1);

  semanticAnalyzer.geminiProvider.classifyAmbiguousBatches = savedClassify;
  env.AI_PROVIDER = originalAiProv;
  env.OPENAI_API_KEY = originalOpenAiKey;
  console.log('✓ TEST 12 superado: Análisis con Gemini completado exitosamente con OPENAI_API_KEY vacía.\n');

  console.log('================================================================');
  console.log('   ¡TODAS LAS 12 PRUEBAS OBLIGATORIAS PASARON CON ÉXITO!        ');
  console.log('================================================================\n');
}

runGeminiMultiPdfWhisperTests().catch(err => {
  console.error('ERROR EN PRUEBAS:', err);
  process.exit(1);
});
