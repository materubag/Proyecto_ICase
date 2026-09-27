const d = require('./domain');
const actorDetector = require('../analysis/actorDetector');
const entityDetector = require('../analysis/entityDetector');
const technologyDetector = require('../analysis/technologyDetector');
const kinds = ['Actor', 'UseCase', 'Entity', 'EntityAttribute', 'EntityRelationship', 'BusinessRule', 'NavigationNode', 'Architecture', 'Technology'];
const platforms = ['WEB', 'MOBILE', 'BOTH', 'UNKNOWN'];
function platform(text) {
  const web = /\b(web|navegador|browser)\b/i.test(text);
  const mobile = /\b(móvil|movil|mobile|android|ios)\b/i.test(text);
  return web && mobile ? 'BOTH' : web ? 'WEB' : mobile ? 'MOBILE' : 'UNKNOWN';
}
function text(value, label, required = true) {
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > 20000) d.fail('INVALID_MODEL', `Campo inválido: ${label}`, 400);
  return value.trim();
}
async function references(tx, projectId, kind, ids = []) {
  if (!Array.isArray(ids)) d.fail('INVALID_MODEL', 'Lista de referencias inválida.', 400);
  for (const id of ids) { const row = await d.element(tx, projectId, kind, id); if (row.status !== 'APPROVED') d.fail('DEPENDENCY_CONFLICT', `${kind} debe estar aprobado.`); }
  return ids;
}
async function contentData(tx, projectId, kind, c) {
  const base = { name: text(c.name, 'nombre'), ...(kind !== 'EntityAttribute' ? { projectId } : {}) };
  switch (kind) {
    case 'Actor': case 'Entity': case 'BusinessRule': return { ...base, description: text(c.description || '', 'descripción', false) };
    case 'UseCase': {
      const actorIds = await references(tx, projectId, 'Actor', c.actorIds || []);
      for (const name of c.actorNames || []) {
        const actor = await tx.actor.findFirst({ where: { projectId, status: 'APPROVED', name: { equals: name, mode: 'insensitive' } } });
        if (!actor) d.fail('DEPENDENCY_CONFLICT', `Aprueba primero el actor ${name} o edita la relación del candidato.`);
        if (!actorIds.includes(actor.id)) actorIds.push(actor.id);
      }
      const relations = c.relations || [];
      if (!Array.isArray(relations)) d.fail('INVALID_MODEL', undefined, 400);
      for (const r of relations) {
        if (!['include', 'extend', 'generalization'].includes(r.type) || !r.evidence) d.fail('EVIDENCE_REQUIRED', 'La relación UML necesita tipo y evidencia.', 400);
        await references(tx, projectId, 'UseCase', [r.targetId]);
      }
      return { ...base, code: text(c.code || `CU-${d.hash(c).slice(0, 8)}`, 'código'), description: text(c.description || c.name, 'descripción'), actorIds, relations };
    }
    case 'EntityAttribute': {
      await references(tx, projectId, 'Entity', [c.entityId]);
      return { ...base, entityId: c.entityId, type: text(c.type, 'tipo'), isPk: c.isPk === true };
    }
    case 'EntityRelationship': {
      await references(tx, projectId, 'Entity', [c.source, c.target]);
      if (!['ONE_TO_ONE', 'ONE_TO_MANY', 'MANY_TO_MANY', '1:1', '1:N', 'N:M'].includes(c.cardinality)) d.fail('INVALID_MODEL', 'Confirma la cardinalidad.', 400);
      return { projectId, source: c.source, target: c.target, cardinality: c.cardinality, description: text(c.description || c.name, 'descripción') };
    }
    case 'NavigationNode': {
      if (!platforms.includes(c.platform || 'UNKNOWN')) d.fail('INVALID_MODEL', 'Plataforma inválida.', 400);
      if (c.parentId) await references(tx, projectId, 'NavigationNode', [c.parentId]);
      return { ...base, from: c.from || c.name, to: c.to || c.name, action: c.action || null, route: c.route || null, parentId: c.parentId || null, platform: c.platform || 'UNKNOWN', actorIds: await references(tx, projectId, 'Actor', c.actorIds || []), useCaseIds: await references(tx, projectId, 'UseCase', c.useCaseIds || []) };
    }
    case 'Technology': {
      if (!['FRONTEND', 'BACKEND', 'DATABASE', 'INFRASTRUCTURE', 'AI', 'AUTOMATION', 'MOBILE', 'OTHER'].includes(c.category)) d.fail('INVALID_MODEL', 'Categoría inválida.', 400);
      return { ...base, category: c.category, version: c.version || null, source: c.source || 'Requisitos aprobados' };
    }
    case 'Architecture': {
      if (!['SOFTWARE_ARCHITECTURE', 'SYSTEM_ARCHITECTURE'].includes(c.kind)) d.fail('INVALID_MODEL', 'Tipo de arquitectura inválido.', 400);
      if (!Array.isArray(c.components) || !c.components.length) d.fail('INVALID_MODEL', 'Define componentes confirmados.', 400);
      const names = new Set(c.components.map(n => text(n.name, 'componente')));
      const connections = c.connections || [];
      if (!Array.isArray(connections)) d.fail('INVALID_MODEL', undefined, 400);
      for (const r of connections) if (!names.has(r.from) || !names.has(r.to) || !r.evidence) d.fail('EVIDENCE_REQUIRED', 'Conexión sin extremos o evidencia.', 400);
      return { projectId, kind: c.kind, style: c.name, frontend: c.frontend || 'UNKNOWN', backend: c.backend || 'UNKNOWN', database: c.database || 'UNKNOWN', connections, components: { create: c.components.map(n => ({ name: n.name, layer: n.layer || null, type: n.type || null })) } };
    }
    default: d.fail('INVALID_MODEL', undefined, 400);
  }
}
async function candidate(tx, projectId, input) {
  if (!kinds.includes(input.kind)) d.fail('INVALID_MODEL', undefined, 400);
  const reqs = await d.approvedRequirements(tx, projectId, input.requirementIds);
  const name = text(input.name || input.content?.name, 'nombre');
  const content = { ...input.content, name };
  const requirementIds = [...new Set(input.requirementIds)].sort();
  const evidence = reqs.map(r => ({ requirementId: r.id, code: r.code, revision: r.revision, statement: r.description }));
  if (input.targetId) {
    const target = await d.element(tx, projectId, input.kind, input.targetId);
    if (!['OUTDATED', 'PENDING_REVIEW'].includes(target.status)) d.fail('IMPACT_CONFIRMATION_REQUIRED', 'Usa Cambios para editar un modelo aprobado.');
    content.targetRevision = target.revision;
  }
  const fingerprint = d.hash({ kind: input.kind, content, evidence, targetId: input.targetId || null });
  return tx.modelCandidate.upsert({ where: { projectId_fingerprint: { projectId, fingerprint } }, update: {}, create: { projectId, kind: input.kind, name, content, requirementIds, evidence, fingerprint, promotedId: input.targetId || null, origin: input.origin || 'INFERRED' } });
}
async function generate(projectId, requirementIds) {
  return d.transaction(async tx => {
    await d.project(tx, projectId);
    const reqs = await tx.requirement.findMany({ where: { projectId, status: 'APPROVED', ...(requirementIds ? { id: { in: requirementIds } } : {}) }, orderBy: { code: 'asc' } });
    if (!reqs.length) d.fail('APPROVED_REQUIREMENTS_REQUIRED', 'Aprueba requisitos antes de generar modelos.', 400);
    const out = [];
    for (const r of reqs) {
      const body = `${r.name}\n${r.description}`;
      const add = (kind, content) => candidate(tx, projectId, { kind, content, requirementIds: [r.id] }).then(c => out.push(c));
      for (const a of actorDetector.detect(body)) await add('Actor', { name: a.name, description: a.description });
      if (r.type === 'FUNCTIONAL') await add('UseCase', { code: `CU-${r.code}`, name: r.name, description: r.description, actorNames: actorDetector.detect(body).map(a => a.name), actorIds: r.actorIds.filter(id => /^[0-9a-f-]{36}$/i.test(id)) });
      for (const e of entityDetector.detect(body).entities) await add('Entity', { name: e.name, description: e.description });
      const technologies = technologyDetector.detect(body).detected || [];
      for (const t of technologies) await add('Technology', { name: t.name, category: t.category.toUpperCase(), version: null });
      for (const kind of ['SOFTWARE_ARCHITECTURE', 'SYSTEM_ARCHITECTURE']) {
        const components = technologies.filter(t => kind === 'SYSTEM_ARCHITECTURE' ? t.category === 'infrastructure' : t.category !== 'infrastructure').map(t => ({ name: t.name, layer: t.category }));
        if (components.length) await add('Architecture', { name: `${r.code}: componentes confirmados (${kind === 'SYSTEM_ARCHITECTURE' ? 'sistema' : 'software'})`, kind, components, connections: [] });
      }
      for (const route of body.match(/\/[a-z][a-z0-9/_-]*/gi) || []) await add('NavigationNode', { name: route, route, platform: platform(body) });
      if (/\b(solo|únicamente|prohibido|obligatorio|regla de negocio)\b/i.test(body)) await add('BusinessRule', { name: r.name, description: r.description });
    }
    return [...new Map(out.map(c => [c.id, c])).values()];
  });
}
async function review(projectId, id, input) {
  return d.transaction(async tx => {
    const c = await tx.modelCandidate.findFirst({ where: { id, projectId } });
    if (!c) d.fail('CANDIDATE_NOT_FOUND', undefined, 404);
    if (c.status !== 'PENDING_REVIEW') d.fail('VERSION_CONFLICT', 'El candidato ya fue revisado.');
    if (input.status === 'REJECTED') return tx.modelCandidate.update({ where: { id }, data: { status: 'REJECTED' } });
    const content = input.content || c.content;
    if (input.status !== 'APPROVED') return tx.modelCandidate.update({ where: { id }, data: { content, name: text(content.name, 'nombre') } });
    const reqs = await d.approvedRequirements(tx, projectId, c.requirementIds);
    if (reqs.some(r => !c.evidence.some(e => e.requirementId === r.id && e.revision === r.revision))) d.fail('VERSION_CONFLICT', 'Cambió la evidencia. Genera un candidato actualizado.');
    const data = await contentData(tx, projectId, c.kind, content);
    // Reuse an approved named element only if its content is identical; otherwise require explicit change control.
    const delegate = d.delegates[c.kind];
    let promoted = null;
    if (c.promotedId) {
      const previous = await d.element(tx, projectId, c.kind, c.promotedId);
      if (!['OUTDATED', 'PENDING_REVIEW'].includes(previous.status)) d.fail('VERSION_CONFLICT');
      if (previous.revision !== c.content.targetRevision) d.fail('VERSION_CONFLICT', 'El modelo cambió desde que se propuso la revisión.');
      if (c.kind === 'Architecture') await tx.architectureComponent.deleteMany({ where: { architectureId: previous.id } });
      const impact = await require('./ImpactAnalysisService').analyze(projectId, c.kind, previous.id, tx);
      const proposed = { ...data, status: 'APPROVED', requirementIds: c.requirementIds, evidence: c.evidence };
      await tx.changeRequest.create({ data: { projectId, elementType: c.kind, elementId: previous.id, type: 'UPDATE', status: 'APPLIED', expectedRevision: previous.revision, previousState: d.json(previous), proposedState: d.json(content), reason: 'Revisión humana de modelo pendiente o desactualizado', impact: d.json(impact) } });
      promoted = await tx[delegate].update({ where: { id: previous.id }, data: { ...proposed, revision: { increment: 1 } } });
      await require('./ImpactAnalysisService').invalidate(tx, impact);
    }
    if (!promoted && ['Actor', 'Entity', 'Technology'].includes(c.kind)) {
      promoted = await tx[delegate].findFirst({ where: { projectId, name: { equals: data.name, mode: 'insensitive' }, status: 'APPROVED' } });
      if (promoted && c.kind === 'Technology' && (promoted.version !== data.version || promoted.category !== data.category)) d.fail('DEPENDENCY_CONFLICT', 'Existe otra tecnología con ese nombre. Revisa la diferencia.');
    }
    if (!promoted) {
      const staleWhere = c.kind === 'UseCase' ? { code: data.code } : ['Actor', 'Entity', 'BusinessRule', 'Technology', 'NavigationNode'].includes(c.kind) ? { name: data.name } : null;
      const stale = staleWhere && await tx[delegate].findFirst({ where: { projectId, ...staleWhere, status: 'OUTDATED' } });
      if (stale) {
        const impact = await require('./ImpactAnalysisService').analyze(projectId, c.kind, stale.id, tx);
        const proposed = { ...data, status: 'APPROVED', requirementIds: c.requirementIds, evidence: c.evidence };
        await tx.changeRequest.create({ data: { projectId, elementType: c.kind, elementId: stale.id, type: 'UPDATE', status: 'APPLIED', expectedRevision: stale.revision, previousState: d.json(stale), proposedState: d.json(proposed), reason: 'Aprobación humana de candidato regenerado', impact: d.json(impact) } });
        promoted = await tx[delegate].update({ where: { id: stale.id }, data: { ...proposed, revision: { increment: 1 } } });
        await require('./ImpactAnalysisService').invalidate(tx, impact);
      } else promoted = await tx[delegate].create({ data: { ...data, status: 'APPROVED', requirementIds: c.requirementIds, evidence: c.evidence } });
    }
    for (const id of c.requirementIds) await d.link(tx, projectId, 'Requirement', id, c.kind, promoted.id);
    for (const id of data.actorIds || []) await d.link(tx, projectId, 'Actor', id, c.kind, promoted.id);
    for (const id of content.useCaseIds || []) await d.link(tx, projectId, 'UseCase', id, c.kind, promoted.id);
    if (c.kind === 'EntityAttribute') await d.link(tx, projectId, 'Entity', content.entityId, c.kind, promoted.id);
    if (c.kind === 'EntityRelationship') for (const id of [content.source, content.target]) await d.link(tx, projectId, 'Entity', id, c.kind, promoted.id);
    if (content.parentId) await d.link(tx, projectId, 'NavigationNode', content.parentId, c.kind, promoted.id);
    for (const r of content.relations || []) await d.link(tx, projectId, 'UseCase', r.targetId, c.kind, promoted.id, r.type);
    return tx.modelCandidate.update({ where: { id }, data: { status: 'APPROVED', content, promotedId: promoted.id } });
  });
}
module.exports = { kinds, platforms, platform, contentData, generate, review, create: (projectId, input) => d.transaction(tx => candidate(tx, projectId, { ...input, origin: 'MANUAL' })) };
