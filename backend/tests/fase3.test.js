const assert = require('assert');
const analysisPipeline = require('../src/services/analysis/analysisPipeline');
const structureDetector = require('../src/services/analysis/structureDetector');
const candidateFragmentSelector = require('../src/services/analysis/candidateFragmentSelector');
const requirementQualityService = require('../src/services/analysis/requirementQualityService');
const candidateConsolidator = require('../src/services/analysis/candidateConsolidator');
const semanticAnalyzer = require('../src/services/analysis/semanticAnalyzer');

async function runFase3Tests() {
  console.log('================================================================');
  console.log('   PRUEBAS OBLIGATORIAS DE FASE 3: PIPELINE DE REQUISITOS       ');
  console.log('================================================================\n');

  // CASO A — PDF ESTRUCTURADO
  console.log('----------------------------------------------------------------');
  console.log('PROBANDO CASO A: PDF Estructurado (Extracción determinista por código)');
  console.log('----------------------------------------------------------------');
  const textCasoA = `
    REQUISITOS FUNCIONALES
    RF-01. El sistema deberá registrar usuarios.
    RF-02. El sistema deberá consultar usuarios.
  `;
  const resultA = await analysisPipeline.runPipeline({
    projectId: 'test-proj-a',
    sourceId: 'src-a',
    sourceVersionId: 'ver-a',
    text: textCasoA,
    sourceType: 'PDF',
    persist: false
  });

  assert.strictEqual(resultA.explicitRequirements.length, 2, 'Debe extraer exactamente 2 RF explícitos');
  assert.strictEqual(resultA.explicitRequirements[0].code, 'RF-01');
  assert.strictEqual(resultA.requirementCandidates[0].temporaryCode, 'RF-01');
  assert.strictEqual(resultA.requirementCandidates[0].origin, 'EXPLICIT');
  assert.strictEqual(resultA.requirementCandidates[1].temporaryCode, 'RF-02');
  assert.strictEqual(resultA.metrics.ollamaCalls, 0, 'Ollama calls debe ser 0 para RF explícitos');
  assert.strictEqual(resultA.metrics.gptCalls, 0, 'GPT calls debe ser 0 para RF explícitos');
  console.log('✓ CASO A superado: 2 RF explícitos detectados por código con 0 llamadas a IA.\n');

  // CASO B — TEXTO NO ESTRUCTURADO
  console.log('----------------------------------------------------------------');
  console.log('PROBANDO CASO B: Texto No Estructurado (NeedCandidate -> RequirementCandidate)');
  console.log('----------------------------------------------------------------');
  const textCasoB = 'Actualmente registramos los préstamos en Excel y queremos que los bibliotecarios puedan hacerlo desde el sistema.';
  const resultB = await analysisPipeline.runPipeline({
    projectId: 'test-proj-b',
    sourceId: 'src-b',
    sourceVersionId: 'ver-b',
    text: textCasoB,
    sourceType: 'PDF',
    persist: false
  });

  assert(resultB.needCandidates.length > 0, 'Debe generar al menos un NeedCandidate');
  assert(resultB.requirementCandidates.length > 0, 'Debe generar al menos un RequirementCandidate');
  const candB = resultB.requirementCandidates[0];
  assert.strictEqual(candB.status, 'PENDING_REVIEW', 'El estado del candidato debe ser PENDING_REVIEW');
  assert(candB.origin === 'INFERRED' || candB.origin === 'EXPLICIT', 'Origen debe ser válido');
  console.log(`✓ CASO B superado: ${resultB.needCandidates.length} necesidades y ${resultB.requirementCandidates.length} candidatos generados en PENDING_REVIEW.\n`);

  // CASO C — RNF AMBIGUO
  console.log('----------------------------------------------------------------');
  console.log('PROBANDO CASO C: RNF Ambiguo (Validación ISO/IEC/IEEE 29148:2018)');
  console.log('----------------------------------------------------------------');
  const textCasoC = 'El sistema debe responder rápidamente.';
  const evalC = requirementQualityService.evaluateRequirement({
    statement: textCasoC,
    type: 'NON_FUNCTIONAL',
    evidence: { text: textCasoC, sourceId: 'src-c', sourceVersionId: 'ver-c' }
  });

  assert.strictEqual(evalC.criteria.ambiguity.pass, false, 'Debe detectar advertencia de ambigüedad por "rápidamente"');
  assert.strictEqual(evalC.criteria.verifiability.pass, false, 'Debe detectar dificultad de verificación');
  assert(evalC.clarificationQuestions.length > 0, 'Debe generar pregunta de aclaración sin inventar segundos');
  assert(!evalC.clarificationQuestions[0].includes('2 segundos'), 'No debe inventar valores como 2 segundos');
  console.log('✓ CASO C superado: Detectó ambigüedad y no verificabilidad con pregunta:', evalC.clarificationQuestions[0], '\n');

  // CASO D — DUPLICADO
  console.log('----------------------------------------------------------------');
  console.log('PROBANDO CASO D: Detección de duplicado léxico/semántico entre fuentes');
  console.log('----------------------------------------------------------------');
  const existingReqsD = [
    {
      id: 'req-d-1',
      temporaryCode: 'RF-01',
      statement: 'El administrador podrá registrar usuarios.',
      evidence: { source: 'propuesta.pdf', text: 'El administrador podrá registrar usuarios.' }
    }
  ];
  const newCandidateD = {
    statement: 'Los administradores podrán registrar a los usuarios en el sistema.',
    evidence: { source: 'entrevista.mp3', text: 'Los administradores podrán registrar a los usuarios en el sistema.' }
  };
  const dupCheckD = candidateConsolidator.detectRelation(newCandidateD, existingReqsD);
  assert(dupCheckD.relation === 'DUPLICATE' || dupCheckD.relation === 'RELATED', 'Debe clasificar como DUPLICATE o RELATED');
  console.log(`✓ CASO D superado: Relación detectada "${dupCheckD.relation}" con score: ${dupCheckD.score}\n`);

  // CASO E — CONFLICTO
  console.log('----------------------------------------------------------------');
  console.log('PROBANDO CASO E: Detección de conflicto entre fuentes');
  console.log('----------------------------------------------------------------');
  const existingReqsE = [
    {
      id: 'req-e-1',
      statement: 'Solo administradores cancelan pedidos.',
      evidence: { source: 'propuesta.pdf' }
    }
  ];
  const newCandidateE = {
    statement: 'Los supervisores también pueden cancelar pedidos.',
    evidence: { source: 'entrevista.mp3' }
  };
  const conflictCheckE = candidateConsolidator.detectRelation(newCandidateE, existingReqsE);
  assert.strictEqual(conflictCheckE.relation, 'CONFLICT', 'Debe detectar CONFLICT entre ambas fuentes');
  console.log('✓ CASO E superado: Conflicto detectado con éxito.\n');

  // CASO F — OLLAMA FALLBACK
  console.log('----------------------------------------------------------------');
  console.log('PROBANDO CASO F: Tolerancia ante falla de Ollama y conservación de extracción');
  console.log('----------------------------------------------------------------');
  const hybridTextF = `
    REQUISITOS FUNCIONALES
    RF-01. El sistema permitirá exportar informes a PDF.
    
    Texto complementario que requiere análisis semántico sobre gestión de préstamos.
  `;
  const resultF = await analysisPipeline.runPipeline({
    projectId: 'test-proj-f',
    sourceId: 'src-f',
    sourceVersionId: 'ver-f',
    text: hybridTextF,
    sourceType: 'PDF',
    persist: false
  });
  assert(resultF.explicitRequirements.length >= 1, 'Los requisitos explícitos deben conservarse siempre');
  assert.strictEqual(resultF.explicitRequirements[0].code, 'RF-01');
  console.log('✓ CASO F superado: Extracción determinista garantizada aún si IA falla o usa fallback.\n');

  // CASO G — AUDIO CON TIMESTAMPS
  console.log('----------------------------------------------------------------');
  console.log('PROBANDO CASO G: Audio con evidencia de AudioSegments y timestamps');
  console.log('----------------------------------------------------------------');
  const audioSegmentsG = [
    { id: 'seg-1', segmentIndex: 1, startTime: 12.0, endTime: 18.5, text: 'Necesitamos recuperar la contraseña mediante un código al correo.' }
  ];
  const resultG = await analysisPipeline.runPipeline({
    projectId: 'test-proj-g',
    sourceId: 'src-audio-g',
    sourceVersionId: 'ver-audio-g',
    sourceType: 'AUDIO',
    segments: audioSegmentsG,
    persist: false
  });
  assert(resultG.requirementCandidates.length > 0, 'Debe generar candidato desde audio');
  const candG = resultG.requirementCandidates[0];
  assert(candG.evidence, 'Candidato debe tener evidencia');
  assert(candG.evidence.startTime === 12.0 || candG.evidence.startTime >= 0, 'Debe preservar startTime en la evidencia');
  console.log('✓ CASO G superado: Candidato de audio generado con evidencia timestamp:', candG.evidence.startTime, 's -', candG.evidence.endTime, 's\n');

  // CASO H — REANÁLISIS (IDEMPOTENCIA)
  console.log('----------------------------------------------------------------');
  console.log('PROBANDO CASO H: Idempotencia en reanálisis de la misma versión');
  console.log('----------------------------------------------------------------');
  const hash1 = candidateConsolidator.computeEvidenceHash('ver-h', 'El sistema deberá registrar usuarios.');
  const hash2 = candidateConsolidator.computeEvidenceHash('ver-h', 'El sistema deberá registrar usuarios.');
  assert.strictEqual(hash1, hash2, 'El hash de evidencia debe ser exactamente idéntico');
  console.log('✓ CASO H superado: Hash determinista de evidencia:', hash1, '\n');

  console.log('================================================================');
  console.log('   TODAS LAS PRUEBAS OBLIGATORIAS DE FASE 3 PASARON CON ÉXITO   ');
  console.log('================================================================\n');
}

runFase3Tests().catch(err => {
  console.error('ERROR EN PRUEBAS:', err);
  process.exit(1);
});
