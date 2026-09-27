const d = require('./domain');
const diagrams = require('../diagrams/DiagramService');
const mockupService = require('../mockup/mockup.service');
async function generate(projectId, prompt, artifactId) {
  const project = await d.project(d.prisma, projectId);
  project.requirements = await d.prisma.requirement.findMany({ where: { projectId, status: 'APPROVED' } });
  project.actors = await d.prisma.actor.findMany({ where: { projectId, status: 'APPROVED' } });
  project.useCases = await d.prisma.useCase.findMany({ where: { projectId, status: 'APPROVED' } });
  project.navigationNodes = await d.prisma.navigationNode.findMany({ where: { projectId, status: 'APPROVED' } });
  if (!project.requirements.length) d.fail('APPROVED_REQUIREMENTS_REQUIRED', undefined, 400);
  if (!project.navigationNodes.length) d.fail('APPROVED_MODELS_REQUIRED', 'Define navegación aprobada para generar pantallas con evidencia.', 400);
  if (project.platform === 'UNKNOWN' && project.navigationNodes.some(n => n.platform === 'UNKNOWN')) d.fail('PLATFORM_REQUIRED', 'Confirma la plataforma del proyecto o de cada pantalla.', 400);
  let selectedArtifact;
  if (artifactId) {
    selectedArtifact = await d.element(d.prisma, projectId, 'Artifact', artifactId);
    if (selectedArtifact.type !== 'MOCKUP') d.fail('INVALID_ARTIFACT_TYPE', undefined, 400);
    const previous = await d.prisma.artifactVersion.findFirst({ where: { artifactId }, orderBy: { version: 'desc' } });
    const nodeIds = (previous?.structuredContent.dependencies || []).filter(x => x.type === 'NavigationNode').map(x => x.id);
    project.navigationNodes = project.navigationNodes.filter(n => nodeIds.includes(n.id));
    if (!project.navigationNodes.length) d.fail('DEPENDENCY_CONFLICT', 'La navegación afectada necesita revisión antes de regenerar.');
  }
  const requirementIds = new Set(project.navigationNodes.flatMap(n => n.requirementIds));
  project.requirements = project.requirements.filter(r => requirementIds.has(r.id));
  const actorIds = new Set(project.navigationNodes.flatMap(n => n.actorIds));
  const useCaseIds = new Set(project.navigationNodes.flatMap(n => n.useCaseIds));
  project.actors = project.actors.filter(a => actorIds.has(a.id));
  project.useCases = project.useCases.filter(c => useCaseIds.has(c.id));
  const result = await mockupService.generateMockup(project, prompt);
  return d.transaction(async tx => {
    const versions = [];
    for (const screen of result.screens || []) {
      const node = project.navigationNodes.find(n => n.route === screen.route || n.name === screen.name);
      if (!node) d.fail('MOCKUP_RESPONSE_INVALID', 'n8n devolvió una pantalla fuera de la navegación aprobada.', 422);
      const deps = [{ type: 'NavigationNode', id: node.id, revision: node.revision }, ...project.requirements.filter(r => node.requirementIds.includes(r.id)).map(r => ({ type: 'Requirement', id: r.id, revision: r.revision })), ...project.actors.filter(a => node.actorIds.includes(a.id)).map(a => ({ type: 'Actor', id: a.id, revision: a.revision })), ...project.useCases.filter(c => node.useCaseIds.includes(c.id)).map(c => ({ type: 'UseCase', id: c.id, revision: c.revision }))];
      for (const dep of deps) { const current = await d.element(tx, projectId, dep.type, dep.id); if (current.status !== 'APPROVED' || current.revision !== dep.revision) d.fail('VERSION_CONFLICT'); }
      const artifact = selectedArtifact ? await d.element(tx, projectId, 'Artifact', selectedArtifact.id) : await tx.artifact.upsert({ where: { projectId_type_name: { projectId, type: 'MOCKUP', name: node.id } }, create: { projectId, type: 'MOCKUP', name: node.id }, update: {} });
      versions.push(await diagrams.append(tx, artifact, { screen, platform: node.platform === 'UNKNOWN' ? project.platform : node.platform, provider: result.provider, dependencies: deps }, null));
    }
    if (!versions.length) d.fail('MOCKUP_RESPONSE_INVALID', 'n8n no devolvió pantallas.', 422);
    return { ...result, versions, status: 'PENDING_REVIEW' };
  });
}
module.exports = { generate };
