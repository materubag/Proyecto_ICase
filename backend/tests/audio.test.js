const assert = require('assert');
const { validateAudioFile, sanitizeFilename } = require('../src/utils/fileSecurity');
const transcriptionService = require('../src/services/n8n/transcription.service');

function runTests() {
  console.log('--- Iniciando Pruebas de Audio y Transcripción (Fase 2) ---');

  // Test 1: Sanitización de nombres
  console.log('Test 1: Sanitización de nombres de archivo');
  assert.strictEqual(
    sanitizeFilename('../../../entrevista.mp3'),
    'entrevista.mp3',
    'Debe remover secuencias de directory traversal'
  );
  assert.strictEqual(
    sanitizeFilename('audio:cliente*test?.wav'),
    'audio_cliente_test_.wav',
    'Debe reemplazar caracteres no permitidos por guion bajo'
  );
  assert.strictEqual(
    sanitizeFilename(''),
    'audio_source.mp3',
    'Debe retornar nombre por defecto si es vacío'
  );
  console.log('✔ Test 1 superado');

  // Test 2: Validación de extensiones y MIME types
  console.log('Test 2: Validación de formatos de audio');
  assert.strictEqual(
    validateAudioFile('grabacion.mp3', 'audio/mpeg').valid,
    true,
    '.mp3 con audio/mpeg debe ser válido'
  );
  assert.strictEqual(
    validateAudioFile('reunion.wav', 'audio/wav').valid,
    true,
    '.wav con audio/wav debe ser válido'
  );
  assert.strictEqual(
    validateAudioFile('entrevista.m4a', 'audio/x-m4a').valid,
    true,
    '.m4a con audio/x-m4a debe ser válido'
  );
  assert.strictEqual(
    validateAudioFile('audio.webm', 'audio/webm').valid,
    true,
    '.webm con audio/webm debe ser válido'
  );
  assert.strictEqual(
    validateAudioFile('audio.ogg', 'audio/ogg').valid,
    true,
    '.ogg con audio/ogg debe ser válido'
  );
  assert.strictEqual(
    validateAudioFile('script.exe', 'application/x-msdownload').valid,
    false,
    '.exe debe ser rechazado'
  );
  assert.strictEqual(
    validateAudioFile('documento.pdf', 'application/pdf').valid,
    false,
    '.pdf debe ser rechazado en endpoint de audio'
  );
  console.log('✔ Test 2 superado');

  // Test 3: Normalización de respuestas n8n / Whisper
  console.log('Test 3: Normalización de transcripción estructurada con segmentos');
  const samplePayload = {
    text: 'El sistema debe permitir registrar usuarios con correo y contraseña.',
    duration: 12.5,
    segments: [
      {
        id: 0,
        start: 0.0,
        end: 4.2,
        text: 'El sistema debe permitir registrar usuarios',
        speaker: 'Cliente'
      },
      {
        id: 1,
        start: 4.5,
        end: 12.0,
        text: 'con correo y contraseña.',
        speaker: 'Cliente',
        confidence: 0.94
      }
    ]
  };

  const normalized = transcriptionService.normalizeTranscription(samplePayload);
  assert.strictEqual(
    normalized.text,
    'El sistema debe permitir registrar usuarios con correo y contraseña.'
  );
  assert.strictEqual(normalized.duration, 12.5);
  assert.strictEqual(normalized.segments.length, 2);
  assert.strictEqual(normalized.segments[0].sequence, 1);
  assert.strictEqual(normalized.segments[0].startTime, 0.0);
  assert.strictEqual(normalized.segments[0].endTime, 4.2);
  assert.strictEqual(normalized.segments[0].speaker, 'Cliente');
  assert.strictEqual(normalized.segments[1].confidence, 0.94);
  console.log('✔ Test 3 superado');

  // Test 4: Reconstrucción de texto a partir de segmentos si texto global viene vacío
  console.log('Test 4: Reconstrucción de texto desde segmentos');
  const segmentedOnlyPayload = [
    {
      segments: [
        { start: 1.0, end: 3.0, text: 'Hola,' },
        { start: 3.5, end: 6.0, text: 'bienvenido a ICASE.' }
      ]
    }
  ];
  const reconstructed = transcriptionService.normalizeTranscription(segmentedOnlyPayload);
  assert.strictEqual(reconstructed.text, 'Hola, bienvenido a ICASE.');
  assert.strictEqual(reconstructed.segments.length, 2);
  assert.strictEqual(reconstructed.duration, 6.0);
  console.log('✔ Test 4 superado');

  console.log('--- Todas las pruebas de Audio (Fase 2) superadas con éxito ---');
}

runTests();
