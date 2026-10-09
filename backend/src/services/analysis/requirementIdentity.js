const crypto = require('node:crypto');
const normalize = value => String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim().replace(/[.]$/, '').toLowerCase();
const keyFor = r => crypto.createHash('sha256').update(JSON.stringify([r.type, normalize(r.statement || r.description)])).digest('hex');
const unique = values => [...new Map((values || []).map(value => [JSON.stringify(value), value])).values()];
const same = (a, b) => a.type === b.type && normalize(a.statement || a.description) === normalize(b.statement || b.description);
function merge(a, b) {
  const evidence = unique([...(a.evidence || []), ...(b.evidence || [])]);
  return { ...a, canonicalKey: keyFor(a), id: `REQ-${keyFor(a).substring(0, 20)}`,
    originalCode: a.originalCode || b.originalCode || null,
    originalCodes: unique([...(a.originalCodes || []), ...(b.originalCodes || []), a.originalCode, b.originalCode].filter(Boolean)),
    source: a.source === 'inferred' && b.source !== 'inferred' ? b.source : a.source,
    extractionMethods: unique([...(a.extractionMethods || []), ...(b.extractionMethods || []), a.extractionMethod, b.extractionMethod].filter(Boolean)),
    evidence, associations: unique([...(a.associations || []), ...(b.associations || [])]),
    actorIds: [...new Set([...(a.actorIds || []), ...(b.actorIds || [])])],
    segmentIds: [...new Set([...(a.segmentIds || []), ...(b.segmentIds || [])])],
    pending: unique([...(a.pending || []), ...(b.pending || [])]),
    refinements: unique([...(a.refinements || []), ...(b.refinements || [])]) };
}
function consolidate(items = []) {
  const out = [];
  for (const item of items) {
    const existing = out.findIndex(r => same(r, item));
    if (existing >= 0) out[existing] = merge(out[existing], item);
    else out.push(merge({ ...item, evidence: [] }, item));
  }
  return out;
}
function subsumes(existing, candidate) {
  if (!existing || !candidate || existing.type !== candidate.type) return false;
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\w\s]/g, ' ');
  const tokenize = s => norm(s).split(/\s+/).filter(w => w.length >= 4 && !/^(?:para|como|este|esta|estos|estas|entre|sobre|desde|hasta|segun|donde|cuando|durante|proceso|sistema|aplicacion|modulo|debe|debera|deberan|puede|podra|podran|permite|permitira|mediante|cuenta|forma|parte|cada|todo|toda|todos|todas)$/.test(w));
  const candTokens = tokenize(candidate.statement || candidate.description || '');
  if (candTokens.length < 2) return false;
  const existTokens = tokenize(existing.statement || existing.description || '');
  if (existTokens.length < 2) return false;
  const matched = candTokens.filter(ct => existTokens.some(et => et.startsWith(ct.slice(0, 5)) || ct.startsWith(et.slice(0, 5))));
  return matched.length >= 3 || (matched.length >= 2 && (matched.length / candTokens.length) >= 0.6);
}
module.exports = { normalize, keyFor, same, unique, merge, consolidate, subsumes };
