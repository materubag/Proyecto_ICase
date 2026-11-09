const d = require('./domain');
const impactService = require('./ImpactAnalysisService');
const quality = require('../analysis/requirementQualityService');
const fields = ['code', 'name', 'description', 'type', 'priority', 'status', 'actorIds', 'dependencies'];
function requirementData(input, previous = {}) {
  const data = {};
  for (const k of fields) if (input[k] !== undefined) data[k] = input[k];
  for (const key of ['code', 'name', 'description']) if (key in data && (typeof data[key] !== 'string' || !data[key].trim())) d.fail('INVALID_REQUIREMENT', `Campo inválido: ${key}`, 400);
  if (data.status && !['PENDING', 'APPROVED', 'IMPLEMENTED', 'DISCARDED', 'REMOVED', 'DEPRECATED'].includes(data.status)) d.fail('INVALID_REQUIREMENT', 'Estado inválido.', 400);
  if (data.type && !['FUNCTIONAL', 'NON_FUNCTIONAL'].includes(data.type)) d.fail('INVALID_REQUIREMENT', 'Tipo inválido.', 400);
  if (data.priority && !['HIGH', 'MEDIUM', 'LOW'].includes(data.priority)) d.fail('INVALID_REQUIREMENT', 'Prioridad inválida.', 400);
  for (const k of ['actorIds', 'dependencies']) if (k in data && (!Array.isArray(data[k]) || data[k].some(v => typeof v !== 'string'))) d.fail('INVALID_REQUIREMENT', undefined, 400);
  const combined = { ...previous, ...data };
  data.qualityReport = quality.evaluate({ title: combined.name, statement: combined.description, type: combined.type });
  return data;
}
async function remember(tx, row, changeRequestId = null, basedOnVersionId = null) {
  return tx.requirementVersion.upsert({ where: { requirementId_version: { requirementId: row.id, version: row.revision } }, update: {}, create: { requirementId: row.id, version: row.revision, content: d.json(row), changeRequestId, basedOnVersionId } });
}
async function propose(projectId, input) {
  return d.transaction(async tx => {
    const elementType = input.elementType || 'Requirement';
    if (!['UPDATE', 'DELETE', 'RESTORE'].includes(input.type)) d.fail('CHANGE_REQUEST_INVALID', undefined, 400);
    const current = await d.element(tx, projectId, elementType, input.elementId);
    if (elementType === 'Artifact') d.fail('CHANGE_REQUEST_INVALID', 'Usa versiones para modificar artefactos.', 400);
    let data;
    if (input.type === 'DELETE') data = { status: 'REMOVED', ...(elementType==='Requirement'?{isDeleted:true}:{}) };
    else if (elementType === 'Requirement') {
      let proposed = input.proposedState || {};
      if (input.type === 'RESTORE') {
        const old = await tx.requirementVersion.findFirst({ where: { id: input.basedOnVersionId, requirementId: current.id } });
        if (!old) d.fail('VERSION_NOT_FOUND', undefined, 404);
        proposed = old.content;
      }
      data = requirementData(proposed, current);
      if(input.type==='RESTORE')data.isDeleted=false;
    } else {
      if (input.type === 'RESTORE') d.fail('CHANGE_REQUEST_INVALID', 'Restauración disponible para requisitos y artefactos.', 400);
      const allowed = { Actor: ['name', 'description'], Entity: ['name', 'description'], BusinessRule: ['name', 'description'], Technology: ['name', 'version', 'category'], UseCase: ['name', 'description'], NavigationNode: ['name', 'route', 'platform'], EntityRelationship: ['description', 'cardinality'], EntityAttribute: ['name', 'type', 'isPk'], Architecture: ['style'] }[elementType];
      if (!allowed) d.fail('CHANGE_REQUEST_INVALID', undefined, 400);
      data = Object.fromEntries(Object.entries(input.proposedState || {}).filter(([k]) => allowed.includes(k)));
      if (!Object.keys(data).length) d.fail('CHANGE_REQUEST_INVALID', 'Sin cambios editables.', 400);
      for (const [k, v] of Object.entries(data)) if (k !== 'isPk' && (typeof v !== 'string' || !v.trim())) d.fail('CHANGE_REQUEST_INVALID', 'Contenido inválido.', 400);
      if (data.platform && !['WEB', 'MOBILE', 'BOTH', 'UNKNOWN'].includes(data.platform)) d.fail('CHANGE_REQUEST_INVALID', 'Plataforma inválida.', 400);
      if (data.cardinality && !['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_MANY', '1:1', '1:N', 'N:M'].includes(data.cardinality)) d.fail('CHANGE_REQUEST_INVALID', 'Cardinalidad inválida.', 400);
    }
    if (typeof input.reason !== 'string' || !input.reason.trim()) d.fail('CHANGE_REQUEST_INVALID', 'Indica el motivo del cambio.', 400);
    const impact = await impactService.analyze(projectId, elementType, current.id, tx);
    if (input.sourceCandidateId) {
      const candidate = await tx.requirementCandidate.findFirst({ where: { id: input.sourceCandidateId, projectId, status: 'PENDING_REVIEW' } });
      if (!candidate) d.fail('CANDIDATE_NOT_FOUND', undefined, 404);
    }
    return tx.changeRequest.create({ data: { projectId, elementType, elementId: current.id, type: input.type, expectedRevision: current.revision, previousState: d.json(current), proposedState: d.json(data), reason: input.reason, impact: d.json(impact), basedOnVersionId: input.basedOnVersionId || null, sourceCandidateId: input.sourceCandidateId || null } });
  });
}
async function review(projectId, id, input) {
  return d.transaction(async tx => {
    const change = await tx.changeRequest.findFirst({ where: { id, projectId } });
    if (!change || change.status !== 'PENDING_APPROVAL') d.fail('CHANGE_REQUEST_INVALID');
    if (input.status === 'REJECTED') return tx.changeRequest.update({ where: { id }, data: { status: 'REJECTED' } });
    if (input.status !== 'APPROVED' || input.confirmImpact !== true) d.fail('IMPACT_CONFIRMATION_REQUIRED', 'Revisa el impacto y confirma para continuar.');
    const current = await d.element(tx, projectId, change.elementType, change.elementId);
    if (current.revision !== change.expectedRevision) d.fail('VERSION_CONFLICT');
    const impact = await impactService.analyze(projectId, change.elementType, current.id, tx);
    if (d.hash(impact) !== d.hash(change.impact)) d.fail('VERSION_CONFLICT', 'Cambió el impacto. Crea una nueva solicitud.');
    if (change.elementType === 'Requirement') await remember(tx, current);
    await tx.changeRequest.update({ where: { id }, data: { status: 'APPROVED' } });
    const updated = await tx[d.delegates[change.elementType]].update({ where: { id: current.id }, data: { ...change.proposedState, ...(change.elementType==='Requirement'&&change.type==='DELETE'?{isDeleted:true}:{}), ...(change.elementType==='Requirement'&&change.type==='RESTORE'?{isDeleted:false}:{}), revision: { increment: 1 } } });
    if (change.elementType === 'Requirement') await remember(tx, updated, id, change.basedOnVersionId);
    if (change.sourceCandidateId && change.elementType === 'Requirement') {
      const c = await tx.requirementCandidate.findFirst({ where: { id: change.sourceCandidateId, projectId, status: 'PENDING_REVIEW' } });
      if (!c) d.fail('VERSION_CONFLICT', 'El candidato de cambio ya fue revisado.');
      await tx.requirementCandidate.update({ where: { id: c.id }, data: { status: 'APPROVED', evidence: { ...c.evidence, changeRequestId: id, changedRequirementId: current.id } } });
      for (const [kind, value] of [['Source', c.sourceId], ['SourceVersion', c.sourceVersionId], ['AudioSegment', c.sourceSegmentId]]) if (value) await d.link(tx, projectId, kind, value, 'Requirement', current.id, 'EVIDENCE');
    }
    await impactService.invalidate(tx, impact);
    return tx.changeRequest.update({ where: { id }, data: { status: 'APPLIED' } });
  });
}
function diff(a, b, path = '') {
  if (a !== undefined && b !== undefined && d.hash(a) === d.hash(b)) return [{ path: path || '/', status: 'UNCHANGED', before: a, after: b }];
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().flatMap(k => diff(a[k], b[k], `${path}/${k}`));
  return [{ path: path || '/', status: a === undefined ? 'ADDED' : b === undefined ? 'REMOVED' : 'MODIFIED', before: a, after: b }];
}
module.exports = { propose, review, remember, requirementData, diff };
