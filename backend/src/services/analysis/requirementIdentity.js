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
module.exports = { normalize, keyFor, same, unique, merge, consolidate };
