const d = require('./domain');
const diagrams = require('../diagrams/DiagramService');
const mockupService = require('../mockup/mockup.service');
async function generate(projectId, prompt, artifactId, navigationNodeIds) {
  const project = await d.project(d.prisma, projectId);
  project.requirements = await d.prisma.requirement.findMany({ where: { projectId, status: 'APPROVED' } });
  project.actors = await d.prisma.actor.findMany({ where: { projectId, status: 'APPROVED' } });
  project.useCases = await d.prisma.useCase.findMany({ where: { projectId, status: 'APPROVED' } });
  project.navigationNodes = await d.prisma.navigationNode.findMany({ where: { projectId, status: 'APPROVED' } });
  if (!project.requirements.length) d.fail('APPROVED_REQUIREMENTS_REQUIRED', undefined, 400);
  if (!project.navigationNodes.length) d.fail('APPROVED_MODELS_REQUIRED', 'Define navegación aprobada para generar pantallas con evidencia.', 400);
  if (project.platform === 'UNKNOWN' && project.navigationNodes.some(n => n.platform === 'UNKNOWN')) d.fail('PLATFORM_REQUIRED', 'Confirma la plataforma del proyecto o de cada pantalla.', 400);
  if(navigationNodeIds !== undefined) {
    if(!Array.isArray(navigationNodeIds)||!navigationNodeIds.length||navigationNodeIds.some(id=>typeof id!=='string')) d.fail('SCREENS_SELECTION_REQUIRED','Selecciona al menos una pantalla aprobada.',400);
    const chosen=new Set(navigationNodeIds);
    if([...chosen].some(id=>!project.navigationNodes.some(n=>n.id===id))) d.fail('INVALID_SCREEN_SELECTION','La seleccion incluye pantallas ajenas o no aprobadas.',400);
    project.navigationNodes=project.navigationNodes.filter(n=>chosen.has(n.id));
  }
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
async function list(projectId) {
  await d.project(d.prisma,projectId);
  const artifacts=await d.prisma.artifact.findMany({where:{projectId,type:'MOCKUP'},include:{versions:{orderBy:{version:'desc'},take:1}}});
  return {screens:artifacts.flatMap(artifact=>{
    const version=artifact.versions[0],screen=version?.structuredContent?.screen;
    if(!screen||['ERROR','REJECTED'].includes(version.status))return [];
    return [{...screen,id:screen.id||artifact.name,artifactId:artifact.id,versionId:version.id,version:version.version,reviewStatus:version.status}];
  })};
}
module.exports = { generate, list };
