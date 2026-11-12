const d = require('./domain');
const impact = require('./ImpactAnalysisService');
const models = require('./model.service');
async function get(projectId, tx = d.prisma) {
  const project = await d.project(tx, projectId);
  const output = { project };
  for (const [type, delegate] of Object.entries(d.delegates)) {
    if (type === 'EntityAttribute') continue;
    output[type] = await tx[delegate].findMany({ where: { projectId }, ...(type === 'Artifact' ? { include: { versions: { orderBy: { version: 'desc' } } } } : {}), ...(type === 'Entity' ? { include: { attributes: true } } : {}), ...(type === 'Architecture' ? { include: { components: true } } : {}), orderBy: { id: 'asc' } });
  }
  output.candidates = await tx.modelCandidate.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
  output.relations = await tx.artifactRelation.findMany({ where: { projectId } });
  output.changes = await tx.changeRequest.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
  output.baselines = await tx.projectBaseline.findMany({ where: { projectId }, select: { id: true, name: true, description: true, version: true, createdAt: true }, orderBy: { version: 'desc' } });
  output.sources = await tx.source.findMany({ where: { projectId }, include: { versions: { include: { segments: true }, orderBy: { version: 'desc' } } } });
  output.requirementCandidates = await tx.requirementCandidate.findMany({ where: { projectId } });
  output.requirementVersions = await tx.requirementVersion.findMany({ where: { requirement: { projectId } }, orderBy: { version: 'desc' } });
  output.matrix = output.Requirement.filter(r => r.status === 'APPROVED').map(r => {
    const graph = impact.traverse(output.relations, 'Requirement', r.id);
    const coverage = [...graph.directImpacts, ...graph.indirectImpacts];
    const evidence = output.requirementCandidates.find(c => c.promotedRequirementId === r.id);
    const evidenceLinks = output.relations.filter(e => e.toType === 'Requirement' && e.toId === r.id && e.relation === 'EVIDENCE');
    const missing = ['UseCase', 'Entity', 'NavigationNode'].filter(t => !coverage.some(x => x.type === t && output[t]?.some(row => row.id === x.id && row.status === 'APPROVED')));
    for (const [label, isType] of [['Mockup', t => t === 'MOCKUP'], ['Diagram', t => t !== 'MOCKUP']]) if (!coverage.some(x => x.type === 'Artifact' && output.Artifact.some(a => a.id === x.id && a.status === 'APPROVED' && isType(a.type)))) missing.push(label);
    return { requirement: r, evidence, evidenceLinks, coverage, missing };
  });
  output.detectedPlatform = models.platform(output.Requirement.filter(r => r.status === 'APPROVED').map(r => r.description).join('\n'));
  return output;
}
async function baseline(projectId, input) {
  if (typeof input.name !== 'string' || !input.name.trim()) d.fail('BASELINE_NAME_REQUIRED', undefined, 400);
  return d.transaction(async tx => {
    const snapshot = await get(projectId, tx);
    const last = await tx.projectBaseline.findFirst({ where: { projectId }, orderBy: { version: 'desc' } });
    delete snapshot.baselines;
    return tx.projectBaseline.create({ data: { projectId, name: input.name.trim(), description: input.description || null, version: (last?.version || 0) + 1, snapshot: d.json(snapshot) } });
  });
}
async function textSource(projectId, input) {
  if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 100000) d.fail('INVALID_SOURCE', 'Ingresa texto de hasta 100000 caracteres.', 400);
  const type = input.type === 'CHAT' ? 'CHAT' : 'MANUAL';
  return d.transaction(async tx => {
    await d.project(tx, projectId);
    const fileHash = d.hash([type, input.text]);
    const existing = await tx.source.findUnique({ where: { projectId_fileHash: { projectId, fileHash } } });
    if (existing) return existing;
    const source = await tx.source.create({ data: { projectId, name: input.name || `${type} ${new Date().toISOString()}`, type, fileHash, status: 'EXTRACTED' } });
    const version = await tx.sourceVersion.create({ data: { sourceId: source.id, version: 1, fileHash, extractedText: input.text, normalizedText: input.text } });
    return tx.source.update({ where: { id: source.id }, data: { currentVersionId: version.id } });
  });
}
async function chat(projectId, input) {
  const messageText = (typeof input?.message === 'string' ? input.message : (typeof input?.question === 'string' ? input.question : '')).trim();
  if (!messageText || messageText.length > 4000) d.fail('INVALID_MESSAGE', undefined, 400);

  const project = await d.prisma.project.findUnique({
    where: { id: projectId },
    include: {
      actors: { where: { isDeleted: false } },
      useCases: { where: { isDeleted: false }, take: 15 },
      entities: { where: { isDeleted: false }, take: 20 }
    }
  });

  if (!project) d.fail('PROJECT_NOT_FOUND', undefined, 404);

  // Retrieval stays local; bounded context may be passed to the existing provider explicitly.
  const terms = messageText.toLowerCase().match(/[\p{L}\p{N}-]{3,}/gu) || [];
  let requirements = await d.prisma.requirement.findMany({ where: { projectId, status: 'APPROVED', OR: terms.slice(0, 20).flatMap(term => [{ code: { contains: term, mode: 'insensitive' } }, { description: { contains: term, mode: 'insensitive' } }]) }, take: 12 });
  if (/(sin|no tienen|faltan).*caso[s]? de uso/i.test(messageText)) {
    const cases = await d.prisma.useCase.findMany({ where: { projectId, status: 'APPROVED' }, select: { id: true } });
    const covered = await d.prisma.artifactRelation.findMany({ where: { projectId, fromType: 'Requirement', toType: 'UseCase', toId: { in: cases.map(c => c.id) } }, select: { fromId: true } });
    requirements = await d.prisma.requirement.findMany({ where: { projectId, status: 'APPROVED', id: { notIn: covered.map(c => c.fromId) } }, take: 12 });
  }
  const context = [];
  for (const r of requirements) {
    const origin = await d.prisma.requirementCandidate.findFirst({ where: { promotedRequirementId: r.id }, include: { source: true, sourceSegment: true } });
    context.push({ code: r.code, id: r.id, description: r.description, source: origin?.source?.name, segment: origin?.sourceSegment, impact: await impact.analyze(projectId, 'Requirement', r.id) });
  }

  // Detección de intención de mutación (acciones de cambio prioritarias)
  const isMutationIntent = /(agrega|crea|modifica|cambia|elimina|anade|añade|borra|actualiza|inserta|asigna|renombra|nuevo|nueva|campo|tabla|columna|regla|entidad|permiso|rol|pantalla)/i.test(messageText);

  // Detección de consultas de contexto global o resumen del proyecto (solo si no es una orden de mutación)
  const isContextQuery = !isMutationIntent && /(contexto|resumen|de que trata|de qué trata|explica|objetivo|proposito|propósito|que hace|qué hace|aplicacion|aplicación|sistema|proyecto|módulos|modulos|cuáles son|como funciona|cómo funciona)/i.test(messageText);
  if (isContextQuery && project) {
    context.unshift({
      type: 'PROJECT_OVERVIEW',
      projectName: project.name,
      projectDescription: project.description || project.systemDescription || '',
      actors: (project.actors || []).map(a => `${a.name}: ${a.description || 'Actor'}`),
      modules: (project.useCases || []).map(u => u.name),
      coreEntities: (project.entities || []).map(e => e.name)
    });
  }

  // Detección contextual de errores de código, Sequelize o Docker
  const isCodeOrErrorQuery = /(error|sequelize|docker|tabla|columna|codigo|código|terminal|falla|exception|bug|crash|fail)/i.test(messageText);
  if (isCodeOrErrorQuery) {
    const entities = await d.prisma.entity.findMany({
      where: { projectId, isDeleted: false },
      include: { attributes: true },
      take: 20
    });
    const rels = await d.prisma.entityRelationship.findMany({
      where: { projectId, isDeleted: false },
      take: 20
    });
    context.push({
      type: 'CODE_DIAGNOSTIC_CONTEXT',
      entities: entities.map(e => ({ name: e.name, attributes: (e.attributes || []).map(a => `${a.name} (${a.type}${a.isPk ? ' PK' : ''})`) })),
      relationships: rels.map(r => `${r.source} -> ${r.target} (${r.cardinality})`)
    });
  }

  if (input.proposeChange === true && isMutationIntent) {
    const source = await textSource(projectId, { type: 'CHAT', text: messageText });
    const candidates = await d.transaction(async tx => {
      const existing = await tx.requirementCandidate.findMany({ where: { sourceVersionId: source.currentVersionId } });
      if (existing.length) return existing;
      const rel = require('../analysis/candidateConsolidator').detectRelationship({ statement: messageText }, requirements.map(r => ({ ...r, statement: r.description })));
      const need = await tx.needCandidate.create({ data: { projectId, sourceId: source.id, sourceVersionId: source.currentVersionId, description: messageText, origin: 'CHAT', evidence: { text: messageText } } });
      const c = { title: messageText.slice(0, 120), statement: messageText, type: 'FUNCTIONAL' };
      return [await tx.requirementCandidate.create({ data: { ...c, projectId, sourceId: source.id, sourceVersionId: source.currentVersionId, needCandidateId: need.id, temporaryCode: 'CHAT', origin: 'CHAT', evidence: { text: messageText, relationship: { relation: rel.relation, requirementId: rel.matchedItem?.id || null, target: rel.matchedItem?.code || null } }, qualityReport: require('../analysis/requirementQualityService').evaluate(c) } })];
    });
    return { answer: 'Se registró un posible cambio. Revisa los candidatos; no se modificó información oficial.', sourceId: source.id, context, candidates };
  }

  const activeProvider = (input.provider || 'hybrid').toLowerCase();
  const providerResult = await require('./workspaceChatProviders').answerWithProviders(activeProvider, messageText, context.map(item => ({ ...item, impact: undefined })).slice(0, 12)).catch(error => {
    if (error.statusCode) throw error;
    return { answer: null, providerStatus: 'FAILED', calls: [{ status: 'FAILED', error: error.message }] };
  });
  let aiAnswer = providerResult.answer;

  if (!aiAnswer && isContextQuery && project) {
    const actorList = (project.actors || []).map(a => `• **${a.name}**: ${a.description || 'Rol del sistema'}`).join('\n');
    const moduleList = (project.useCases || []).slice(0, 8).map(u => `• **${u.name}**`).join('\n');
    const entityList = (project.entities || []).slice(0, 10).map(e => `\`${e.name}\``).join(', ');

    aiAnswer = `### Contexto del Proyecto: ${project.name}\n\n${project.description || project.systemDescription || 'Aplicación web para gestión integral de procesos.'}\n\n#### 👥 Actores del Sistema\n${actorList || '• Sin actores definidos aún.'}\n\n#### ⚙️ Módulos Principales\n${moduleList || '• En definición de requerimientos.'}\n\n#### 🗄️ Entidades Clave de Datos\n${entityList || 'En proceso de modelado.'}`;
  }

  if (!aiAnswer) {
    aiAnswer = context.length
      ? `Se encontraron ${context.length} elementos de contexto relacionados con tu consulta. Puedes pedirme detalles sobre cualquier módulo, entidad o regla específica.`
      : 'No se encontraron requisitos aprobados relacionados. Puedes preguntarme sobre el contexto general, actores, arquitectura o pedir cambios en el modelo.';
  }

  return { ...providerResult, answer: aiAnswer, context };
}
module.exports = { get, baseline, textSource, chat };
