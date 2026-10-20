// Conservative, reversible consolidation. Never merges similar wording or changes artifacts.
const identity = require('./requirementIdentity');
const store = require('./extractionStore');
const { hash, json } = require('../engineering/domain');
const requirementFields = ['canonicalKey','sources','actorIds','dependencies','isDeleted','updatedAt'];
const candidateFields = ['canonicalKey','evidence','promotedRequirementId','status','rejectionReason','updatedAt'];
function projectFields(row, fields) {
  return json(Object.fromEntries(fields.map(k => [k, row[k] ?? (['actorIds','dependencies'].includes(k) ? [] : k === 'isDeleted' ? false : null)])));
}
function prepare({ projectId, requirements, candidates, auditRows = [] }) {
  const groups = new Map();
  for (const candidate of candidates) {
    const originalCode = candidate.evidence?.originalCode;
    const promotedRequirementId = candidate.promotedRequirementId || candidate.promotedId;
    const official = requirements.find(r => r.id === promotedRequirementId);
    if (!originalCode || !official || official.isDeleted || !identity.same(candidate, official)) continue;
    const groupKey = JSON.stringify([originalCode, candidate.type, identity.normalize(candidate.statement)]);
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push({ ...candidate, promotedRequirementId, official });
  }
  const operations = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    // Prefer an existing canonical row; otherwise retain the source-backed UUID.
    members.sort((a,b) => Number(Boolean(b.canonicalKey)) - Number(Boolean(a.canonicalKey)) ||
      Number(Boolean(b.sourceId || b.source?.id)) - Number(Boolean(a.sourceId || a.source?.id)) || a.id.localeCompare(b.id));
    const keeper = members[0];
    if (new Set(members.map(m => m.promotedRequirementId)).size !== members.length) continue;
    let evidence = {};
    for (const member of members) evidence = store.mergeEnvelope(evidence, member.evidence || {});
    evidence.canonicalKey = identity.keyFor(keeper);
    evidence.legacyCandidateIds = members.map(m => m.id);
    evidence.verifiedEvidence = identity.unique(members.flatMap(m => auditRows.find(r => r.candidateId === m.id)?.evidence.map(e => ({
      ...e, sourceVersionId: auditRows.find(r => r.candidateId === m.id).verifiedDocumentSourceVersionId,
      originCandidateId: m.id, verifiedBy: 'document-audit' })) || []));
    const canonicalSources = members.reduce((acc,m) => store.mergeEnvelope(acc,
      Array.isArray(m.official.sources) ? { legacySources: m.official.sources } : m.official.sources || {}), {});
    const changes = [
      { model: 'requirement', id: keeper.official.id, before: projectFields(keeper.official, requirementFields), after: {
        canonicalKey: identity.keyFor(keeper), sources: store.mergeEnvelope(canonicalSources, evidence),
        actorIds: [...new Set(members.flatMap(m => m.official.actorIds || []))],
        dependencies: [...new Set(members.flatMap(m => m.official.dependencies || []))], isDeleted: false } },
      { model: 'requirementCandidate', id: keeper.id, before: projectFields(keeper, candidateFields),
        after: { canonicalKey: identity.keyFor(keeper), evidence, promotedRequirementId: keeper.official.id,
          status: keeper.status, rejectionReason: keeper.rejectionReason || null } }
    ];
    for (const member of members.slice(1)) {
      changes.push({ model: 'requirement', id: member.official.id, before: projectFields(member.official, requirementFields),
        after: { canonicalKey: null, isDeleted: true } });
      changes.push({ model: 'requirementCandidate', id: member.id, before: projectFields(member, candidateFields),
        after: { canonicalKey: null, promotedRequirementId: keeper.official.id, status: 'REJECTED',
          rejectionReason: `Consolidado reversiblemente en ${keeper.id}; no es un rechazo del contenido.`,
          evidence: { ...member.evidence, mergedIntoCandidateId: keeper.id, originalPromotedRequirementId: member.official.id } } });
    }
    operations.push({ originalCode: keeper.evidence.originalCode, statement: keeper.statement, type: keeper.type,
      canonicalCandidateId: keeper.id, canonicalRequirementId: keeper.official.id,
      duplicateRequirementIds: members.slice(1).map(m => m.official.id), changes });
  }
  const body = { version: 1, projectId, strategy: 'exact-coded-copies-only', operations,
    duplicateCount: operations.reduce((n,g) => n + g.duplicateRequirementIds.length, 0) };
  return { ...json(body), planHash: hash(body) };
}
function verifyPlan(plan) {
  const { planHash, ...body } = plan;
  if (plan.version !== 1 || hash(body) !== planHash) throw new Error('Plan alterado o incompatible');
  const ids = plan.operations.flatMap(g => g.changes.map(c => c.model + ':' + c.id));
  if (new Set(ids).size !== ids.length) throw new Error('Plan solapado: revisar grupos antes de aplicar');
}
async function assertNoActiveReferences(tx, plan) {
  const removed = new Set(plan.operations.flatMap(g => g.duplicateRequirementIds));
  const requirementRows = await tx.requirement.findMany({ where: { projectId: plan.projectId, isDeleted: false } });
  if (requirementRows.some(r => (r.dependencies || []).some(id => removed.has(id)))) throw new Error('Existen dependencias: revisar referencias antes de limpiar');
  // Refuse rather than rewrite diagrams, mockups, use cases or their references.
  for (const model of ['actor','useCase','entity','entityRelationship','classModel','screen','navigationNode',
    'architecture','businessRule','technology','artifact','artifactRelation','modelCandidate','changeRequest']) {
    const rows = await tx[model].findMany({ where: { projectId: plan.projectId } });
    const active = rows.filter(r => !r.isDeleted && r.kind !== 'DOCUMENT_ANALYSIS');
    if (active.some(r => [...removed].some(id => JSON.stringify(r).includes(id)))) throw new Error(`Referencias activas en ${model}: limpieza bloqueada sin modificar artefactos`);
  }
  for (const [model, parent] of [['entityAttribute','entity'],['screenComponent','screen'],['architectureComponent','architecture']]) {
    const rows = await tx[model].findMany({ where: { [parent]: { projectId: plan.projectId } } });
    if (rows.some(r => [...removed].some(id => JSON.stringify(r).includes(id)))) throw new Error(`Referencias activas en ${model}: limpieza bloqueada sin modificar artefactos`);
  }
}
const fieldsFor = model => model === 'requirement' ? requirementFields : candidateFields;
function dataFor(data) {
  const { Prisma } = require('@prisma/client');
  return Object.fromEntries(Object.entries(data).map(([key,value]) => [key,
    value === null && ['evidence','sources'].includes(key) ? Prisma.JsonNull : value]));
}
async function apply(prisma, plan, beforeCommit) {
  verifyPlan(plan);
  return prisma.$transaction(async tx => {
    await store.lock(tx, plan.projectId);
    for (const group of plan.operations) for (const change of group.changes) {
      const row = await tx[change.model].findUnique({ where: { id: change.id } });
      if (!row || row.projectId !== plan.projectId || hash(projectFields(row, fieldsFor(change.model))) !== hash(change.before))
        throw new Error('Los datos cambiaron desde el respaldo; preparar un plan nuevo');
    }
    await assertNoActiveReferences(tx, plan);
    const changes = plan.operations.flatMap(g => g.changes);
    // Release duplicate keys before assigning the keeper; no rows are deleted physically.
    for (const change of changes.filter(c => c.after.canonicalKey === null)) await tx[change.model].update({ where: { id: change.id }, data: { canonicalKey: null } });
    for (const change of changes) await tx[change.model].update({ where: { id: change.id }, data: dataFor(change.after) });
    const after = [];
    for (const change of changes) after.push({ model: change.model, id: change.id,
      state: projectFields(await tx[change.model].findUnique({ where: { id: change.id } }), fieldsFor(change.model)) });
    const receipt = json({ planHash: plan.planHash, projectId: plan.projectId, after });
    if (beforeCommit) await beforeCommit(receipt);
    return receipt;
  }, { timeout: 20000 });
}
async function rollback(prisma, plan, receipt) {
  verifyPlan(plan);
  if (receipt.planHash !== plan.planHash || receipt.projectId !== plan.projectId) throw new Error('Recibo de reversión inválido');
  return prisma.$transaction(async tx => {
    await store.lock(tx, plan.projectId);
    const changes = plan.operations.flatMap(g => g.changes);
    for (const change of changes) {
      const row = await tx[change.model].findUnique({ where: { id: change.id } });
      const expected = receipt.after.find(r => r.model === change.model && r.id === change.id);
      if (!row || !expected || hash(projectFields(row, fieldsFor(change.model))) !== hash(expected.state))
        throw new Error('Hay cambios posteriores: no sobrescribirlos con la reversión');
    }
    for (const change of changes) await tx[change.model].update({ where: { id: change.id }, data: { canonicalKey: null } });
    for (const change of changes) await tx[change.model].update({ where: { id: change.id }, data: dataFor(change.before) });
    return { restored: changes.length };
  }, { timeout: 20000 });
}
module.exports = { prepare, apply, rollback, verifyPlan };
