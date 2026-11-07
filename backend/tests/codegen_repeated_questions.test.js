const test = require('node:test');
const assert = require('node:assert/strict');
const { splitAmbiguities, reclassifyTechnicalQuestions, questionFor } = require('../src/services/codegen/generationClarifications');
const pendingCatalog = require('./fixtures/repeated-question-catalog.json');

test('the complete pending catalog retains only two authorization questions and every technical detail', () => {
  const questions = pendingCatalog.map((question, index) => ({ ...question, questionId: 'original-' + index, source: 'GENERATION', targetKind: question.targetId.startsWith('UC-') ? 'OPERATION' : 'SCREEN' }));
  const decisions = { retained: { answer: 'Approved previously' } };
  const metrics = { totalTokens: 12345 };
  const job = { status: 'WAITING_FOR_INPUT', questions, decisions, metrics };
  assert(reclassifyTechnicalQuestions(job));
  assert.deepEqual(job.questions.map(question => question.targetId), ['UC-22', '138d5557-7010-4cb6-ac58-4bf684f57b04']);
  assert.equal(job.decisions, decisions);
  assert.equal(job.metrics, metrics);
  for (const original of questions) {
    const remaining = job.questions.find(question => question.questionId === original.questionId)?.details || [];
    const technical = job.planningBlockers.find(blocker => blocker.operationId === original.targetId)?.errors || [];
    assert.deepEqual([...remaining, ...technical].sort(), [...original.details].sort());
  }
  assert.equal(reclassifyTechnicalQuestions(job), false);
});

const details = [
  'La fecha debe persistirse pero el binding no proporciona una referencia a la hora actual.',
  'El formulario es incompatible. Recomendación: actualizar el contrato de pantalla.',
  'Registrar fallas es independiente aprobado. Recomendación: completar el modelo antes de habilitarlo.',
  'El expediente es de solo lectura. Recomendación: implementarlo como operación QUERY independiente.',
  'Falta persistir revisión. Recomendación: modelar ese dato y definir su consulta.',
  'El consumo es separado. Recomendación: especificar y habilitar ese comando por separado.'
];

test('confirmed low-stock query separation is an implementation blocker, not a repeated question', () => {
  const detail = 'La consulta de productos con bajo stock es una operación independiente y no forma parte de este CREATE. La decisión de umbral vigente confirma stock menor o igual que stockMinimo; la consulta requiere su propio contrato y no se incorpora aquí.';
  assert.equal(questionFor({ operationId: 'UC-11' }, [detail]), null);
  const decisions = { threshold: { customAnswer: 'stock <= stockMinimo' } };
  const job = { status: 'WAITING_FOR_INPUT', decisions, questions: [{ source: 'GENERATION', targetId: 'UC-11', targetKind: 'OPERATION', details: [detail] }] };
  assert(reclassifyTechnicalQuestions(job));
  assert.equal(job.questions.length, 0);
  assert.equal(job.planningBlockers[0].errors[0], detail);
  assert.equal(job.decisions, decisions);
  assert.equal(job.status, 'BLOCKED');
  assert(questionFor({ operationId: 'UC-11' }, ['La decisión de umbral no confirma si debe usarse menor o menor o igual. ¿Qué comparación corresponde?']));
});

test('malformed unresolved output never becomes a question and remains a technical blocker', () => {
  const malformed = 'unresolved מתוכן';
  assert.equal(questionFor({ operationId: 'UC-15' }, [malformed]), null);
  const job = { status: 'WAITING_FOR_INPUT', questions: [{ source: 'GENERATION', targetId: 'UC-15', targetKind: 'OPERATION', details: [malformed] }] };
  assert(reclassifyTechnicalQuestions(job));
  assert.equal(job.status, 'BLOCKED');
  assert(job.planningBlockers[0].errors[0].includes('INVALID_CLARIFICATION_OUTPUT'));
  assert(job.planningBlockers[0].errors[0].includes(malformed));
});

test('approved evidence implementation is not asked again while missing business rules remain questions', () => {
  const issues = [
    'El modelo carece del atributo archivoId aprobado por la decisión confirmada. Incorporar el atributo.',
    'Implementar un default persistente para fechaCarga mediante una migración antes de habilitar CREATE.',
    'El contrato ejecutable de ese mecanismo no está incluido aquí; conectarlo antes de aceptar el registro.',
    'La autorización aprobada requiere asignación; falta un vínculo ejecutable aprobado.',
    'La pantalla no declara la acción aprobada. Actualizar el contrato de pantalla.'
  ];
  assert.equal(splitAmbiguities(issues).technical.length, 5);
  assert.equal(questionFor({ operationId: 'UC-08' }, issues), null);
  assert(questionFor({ operationId: 'UC-08' }, ['¿Qué rol puede aprobar la eliminación?']));
});

test('all six repeated UC-06 implementation points are technical, not unanswered business questions', () => {
  assert.equal(splitAmbiguities(details).business.length, 0);
  assert.equal(splitAmbiguities(details).technical.length, 6);
});

test('persisted technical questions become blockers without losing decisions or triggering generation', () => {
  const decisions = { approved: { customAnswer: 'Already answered' } };
  const job = { status: 'WAITING_FOR_INPUT', decisions, questions: [{ source: 'GENERATION', questionId: 'old', targetId: 'UC-06', targetKind: 'OPERATION', details }] };
  assert.equal(reclassifyTechnicalQuestions(job), true);
  assert.equal(job.status, 'BLOCKED');
  assert.equal(job.questions.length, 0);
  assert.equal(job.planningBlockers[0].errors.length, 6);
  assert.equal(job.decisions, decisions);
  assert.equal(reclassifyTechnicalQuestions(job), false);
});

test('mixed questions preserve their identity and genuine missing business decisions', () => {
  const job = { status: 'WAITING_FOR_INPUT', questions: [{ source: 'GENERATION', questionId: 'stable', targetId: 'UC-06', targetKind: 'OPERATION', details: [...details, '¿Qué roles pueden aprobar?', 'No se especifica la tasa de impuestos.'] }] };
  reclassifyTechnicalQuestions(job);
  assert.equal(job.status, 'WAITING_FOR_INPUT');
  assert.equal(job.questions[0].questionId, 'stable');
  assert.deepEqual(job.questions[0].details, ['¿Qué roles pueden aprobar?', 'No se especifica la tasa de impuestos.']);
});
