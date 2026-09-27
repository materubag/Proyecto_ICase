const registry = require('./DiagramRegistry');
const d = require('../engineering/domain');
async function snapshot(tx, projectId, type) {
  const where = { projectId, status: 'APPROVED' };
  let model;
  const dependencies = [];
  const add = (kind, rows) => rows.forEach(r => dependencies.push({ type: kind, id: r.id, revision: r.revision }));
  if (type === 'ER_DIAGRAM') {
    const entities = await tx.entity.findMany({ where, include: { attributes: { where: { status: 'APPROVED' }, orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } });
    const relationships = await tx.entityRelationship.findMany({ where, orderBy: { id: 'asc' } });
    if (!entities.length) d.fail('APPROVED_MODELS_REQUIRED', 'Aprueba entidades primero.', 400);
    model = { entities, relationships }; add('Entity', entities); add('EntityRelationship', relationships); entities.forEach(e => add('EntityAttribute', e.attributes));
  } else if (type === 'USE_CASE_DIAGRAM') {
    const actors = await tx.actor.findMany({ where, orderBy: { id: 'asc' } });
    const useCases = await tx.useCase.findMany({ where, orderBy: { id: 'asc' } });
    if (!useCases.length) d.fail('APPROVED_MODELS_REQUIRED', 'Aprueba casos de uso primero.', 400);
    model = { actors, useCases }; add('Actor', actors); add('UseCase', useCases);
  } else if (type === 'NAVIGATION_DIAGRAM') {
    const navigationNodes = await tx.navigationNode.findMany({ where, orderBy: { id: 'asc' } });
    if (!navigationNodes.length) d.fail('APPROVED_MODELS_REQUIRED', 'Define y aprueba navegación primero.', 400);
    model = { navigationNodes }; add('NavigationNode', navigationNodes);
  } else {
    const architecture = await tx.architecture.findFirst({ where: { ...where, kind: type }, include: { components: { orderBy: { id: 'asc' } } }, orderBy: { createdAt: 'desc' } });
    if (!architecture) d.fail('APPROVED_MODELS_REQUIRED', 'Define y aprueba esta arquitectura. La infraestructura desconocida no se infiere.', 400);
    model = { architecture }; add('Architecture', [architecture]);
  }
  return d.json({ ...model, dependencies });
}
async function append(tx, artifact, structuredContent, renderedContent, options = {}) {
  const version = artifact.revision + 1;
  const row = await tx.artifactVersion.create({ data: { artifactId: artifact.id, version, structuredContent: d.json(structuredContent), renderedContent, basedOnVersionId: options.basedOnVersionId || artifact.approvedVersionId, changeRequestId: options.changeRequestId || null, ...(options.error ? { status: 'ERROR', technicalError: options.error, validationStatus: 'ERROR' } : {}) } });
  await tx.artifact.update({ where: { id: artifact.id }, data: { revision: version, ...(!artifact.approvedVersionId ? { status: row.status } : {}) } });
  for (const dep of structuredContent.dependencies || []) await d.link(tx, artifact.projectId, dep.type, dep.id, 'Artifact', artifact.id);
  return row;
}
async function generate(projectId, type, artifactId) {
  if (!registry.has(type)) d.fail('INVALID_ARTIFACT_TYPE', undefined, 400);
  return d.transaction(async tx => {
    await d.project(tx, projectId);
    const content = await snapshot(tx, projectId, type);
    const artifact = artifactId ? await d.element(tx, projectId, 'Artifact', artifactId) : await tx.artifact.upsert({ where: { projectId_type_name: { projectId, type, name: type } }, update: {}, create: { projectId, type, name: type } });
    if (artifact.type !== type) d.fail('INVALID_ARTIFACT_TYPE', undefined, 400);
    let code, error;
    try { code = registry.get(type)(content); } catch (e) { error = e.message; }
    return append(tx, artifact, content, code || null, { error });
  });
}
async function review(projectId, id, input) {
  return d.transaction(async tx => {
    const v = await tx.artifactVersion.findUnique({ where: { id }, include: { artifact: true } });
    if (!v || v.artifact.projectId !== projectId) d.fail('ARTIFACT_NOT_FOUND', undefined, 404);
    if (v.status !== 'PENDING_REVIEW') d.fail('VERSION_CONFLICT', 'La versión ya fue revisada o tiene un error. Regenera para crear otra.');
    if (input.status === 'REJECTED') return tx.artifactVersion.update({ where: { id }, data: { status: 'REJECTED' } });
    if (input.status === 'ERROR') return tx.artifactVersion.update({ where: { id }, data: { status: 'ERROR', validationStatus: 'ERROR', technicalError: String(input.error || 'INVALID_MERMAID').slice(0, 2000) } });
    if (input.status !== 'APPROVED') d.fail('INVALID_STATUS', undefined, 400);
    if (v.artifact.revision !== v.version) d.fail('VERSION_CONFLICT', 'Solo puede aprobarse la última versión candidata.');
    if (v.renderedContent && input.renderedSuccessfully !== true) d.fail('INVALID_MERMAID', 'Valida y renderiza el diagrama antes de aprobarlo.', 400);
    for (const dep of v.structuredContent.dependencies || []) {
      const current = await d.element(tx, projectId, dep.type, dep.id);
      if (current.status !== 'APPROVED' || current.revision !== dep.revision) d.fail('VERSION_CONFLICT', 'El modelo cambió desde la generación. Regenera el artefacto.');
    }
    await tx.artifact.update({ where: { id: v.artifactId }, data: { approvedVersionId: id, status: 'APPROVED' } });
    return tx.artifactVersion.update({ where: { id }, data: { status: 'APPROVED', validationStatus: v.renderedContent ? 'RENDERED' : 'REVIEWED' } });
  });
}
async function restore(projectId, id) {
  return d.transaction(async tx => {
    const v = await tx.artifactVersion.findUnique({ where: { id }, include: { artifact: true } });
    if (!v || v.artifact.projectId !== projectId) d.fail('ARTIFACT_NOT_FOUND', undefined, 404);
    return append(tx, v.artifact, v.structuredContent, v.renderedContent, { basedOnVersionId: id });
  });
}
module.exports = { snapshot, append, generate, review, restore };
