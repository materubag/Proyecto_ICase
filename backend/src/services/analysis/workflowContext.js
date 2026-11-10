const { createHash } = require('node:crypto');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const hash = value => createHash('sha256').update(JSON.stringify(canonical(value)) ?? 'undefined').digest('hex');
const PROMPT_VERSION = 'document-workflow-1';
const ROLES = ['INITIATES', 'EXECUTES', 'APPROVES', 'CONSULTS', 'RECEIVES_INFORMATION'];
const invalid = message => { throw Object.assign(new Error(message), { statusCode: 422 }); };
function units(sources) {
  return sources.flatMap(source => {
    const version = source.currentVersion;
    if (!version?.extractedText) return [];
    return require('./documentExtraction').segmentText(version.extractedText).map(s => ({
      id: hash([source.id, version.id, s.start, s.end]), sourceId: source.id,
      sourceVersionId: version.id, page: s.page, section: s.section,
      start: s.start, end: s.end, text: s.originalText
    }));
  });
}
function build({ task, state, unit, items = [], extra = [] }) {
  const compact = value => { if (!value || typeof value !== 'object') return value; const { legacyRecord, ...content } = value; return content; };
  const evidenceIds = new Set(items.flatMap(i => (i.evidence || []).map(e => e.unitId)));
  const related = state.units.filter(u => evidenceIds.has(u.id));
  const participants = new Set(items.flatMap(i => (i.participants || []).map(p => p.actorId)));
  const actors = state.actors?.approval ? state.actors.content.items.filter(a => a.status !== 'REJECTED' && !a.mergedInto &&
    (task !== 'review' || participants.has(a.id) || a.evidence?.some(e => e.unitId === unit?.id))) : [];
  return { task, expectedResult: task === 'review' ? 'observations, corrections, questions, additionalContext' : 'summary or items, questions, additionalContext',
    approvedSummary: state.context?.approval ? state.context.content : null,
    approvedActors: actors.map(compact),
    items: items.map(compact), evidence: [...new Map([unit, ...related, ...extra].filter(Boolean).map(u => [u.id, u])).values()],
    decisions: (state.decisions || []).filter(d => items.some(i => i.id === d.itemId) || d.stage === 'context').slice(-20).map(d => ({ itemId: d.itemId, stage: d.stage, reason: d.reason, action: d.action, after: compact(d.after) })),
    versions: { sources: [...new Set([unit, ...related, ...extra].filter(Boolean).map(u => u.sourceVersionId))],
      summary: hash(state.context?.approval ? state.context.content : null), actors: hash(actors) },
    availableSections: state.units.map(u => ({ unitId: u.id, section: u.section, page: u.page })),
    pendingQuestions: items.flatMap(i => i.questions || []) };
}
function validateEvidence(item, state) {
  if (!['EXPLICIT', 'INFERRED', 'USER'].includes(item.origin)) invalid('Origen inválido');
  if (item.origin === 'USER' && !state.decisions.some(d => d.itemId === item.id)) invalid('Decisión humana ausente');
  if (item.origin === 'EXPLICIT' && !item.evidence?.length) invalid('Falta evidencia literal');
  for (const e of item.evidence || []) {
    const unit = state.units.find(u => u.id === e.unitId);
    if (!unit || unit.sourceVersionId !== e.sourceVersionId || e.sourceId && e.sourceId !== unit.sourceId || !e.quote?.trim() || !unit.text.includes(e.quote) ||
      (e.page != null && e.page !== unit.page) || (e.section && e.section !== unit.section)) invalid('Evidencia ajena, incorrecta o desactualizada');
  }
}
function validateParticipants(items, actors) {
  const ids = new Set(actors.filter(a => a.status !== 'REJECTED' && !a.mergedInto).map(a => a.id));
  for (const item of items) for (const p of item.participants || []) {
    if (!ids.has(p.actorId) || !ROLES.includes(p.role)) invalid('Participante inexistente, no aprobado o participación inválida');
  }
}
module.exports = { hash, units, build, validateEvidence, validateParticipants, PROMPT_VERSION, ROLES };
