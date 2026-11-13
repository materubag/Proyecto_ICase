const prisma = require('../../config/prisma');
const { AnalysisJobs } = require('./analysisJobs');
const identity = require('./actorIdentity');
const unique = require('./requirementIdentity').unique;
const { segmentText, configuration } = require('./documentExtraction');
const fail = (message, statusCode = 422) => Object.assign(new Error(message), { statusCode });

async function prepare(projectId, db = prisma) {
  const config = configuration();
  const allowed = ['openai', 'gemini', 'hybrid', 'anthropic'];
  if (!allowed.includes(config.provider)) {
    throw fail('Selecciona OpenAI, Gemini o Híbrido para regenerar relaciones con IA.');
  }
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) throw fail('Proyecto no encontrado', 404);

  const [actors, requirements, sources, snapshots] = await Promise.all([
    db.actor.findMany({ where: { projectId, isDeleted: false } }),
    db.requirement.findMany({ where: { projectId, isDeleted: false, status: { not: 'REMOVED' } }, orderBy: { code: 'asc' } }),
    db.source.findMany({ where: { projectId }, include: { currentVersion: true } }),
    db.modelCandidate.findMany({ where: { projectId, kind: 'DOCUMENT_ANALYSIS' }, orderBy: { createdAt: 'desc' } })
  ]);

  if (!actors.length) throw fail('Aprueba o registra los actores antes de regenerar las relaciones.');
  if (!requirements.length) throw fail('No hay requerimientos para relacionar.');

  const segments = [];
  for (const source of sources) {
    const version = source.currentVersion;
    if (!version?.extractedText) continue;
    const snapshot = snapshots.find(s => s.content?.sourceVersionId === version.id);
    for (const s of snapshot?.content?.result?.segments || segmentText(version.extractedText)) {
      segments.push({
        ...s,
        originalId: s.id,
        id: version.id + ':' + s.id,
        sourceId: source.id,
        sourceVersionId: version.id,
        sourceFile: source.name
      });
    }
  }

  return { config, project, actors, requirements, segments };
}

async function semanticEnrichment(requirements, actors, config) {
  const chunks = [];
  const chunkSize = 16;
  for (let i = 0; i < requirements.length; i += chunkSize) {
    chunks.push(requirements.slice(i, i + chunkSize));
  }

  const OpenAIProvider = require('../ai/OpenAIProvider');
  const ai = new OpenAIProvider();

  const actorCatalog = actors.map(a => ({ id: a.id, name: a.name, description: a.description || '' }));
  const results = [];

  for (const chunk of chunks) {
    const payload = chunk.map(r => ({
      id: r.id,
      code: r.code,
      type: r.type,
      currentStatement: r.description || r.name
    }));

    const system = `Eres un arquitecto de software senior bajo ISO/IEC/IEEE 29148:2018 para el sistema AUTRON (taller mecánico automotriz).
Tu tarea es estructurar, profesionalizar y enlazar los requerimientos con el catálogo oficial de actores.

Catálogo de actores oficiales:
${JSON.stringify(actorCatalog, null, 2)}

Reglas obligatorias para cada requerimiento:
1. "name": Genera un título sintético, profesional y claro (máximo 4 a 6 palabras). NUNCA incluyas prefijos como "RF-01" o "RNF-02" en el título.
2. "description": Genera una especificación formal, técnica y completa que explique con precisión la funcionalidad del software (entre 1 y 3 oraciones completas).
3. "primaryActorId": ID exacto del actor principal del catálogo que ejecuta la funcionalidad. Para requisitos de seguridad/cifrado/RNF automáticos, asigna el Administrador o null si es netamente del sistema.
4. "secondaryActorIds": Lista con IDs de otros actores participantes si aplica (o array vacío []).
5. "preconditions": Precondición formal ISO 29148 clara (ej. "El usuario debe haber iniciado sesión con rol correspondiente").
6. "postconditions": Postcondición formal ISO 29148 clara (ej. "Los datos quedan registrados y auditados en el sistema").

Devuelve estrictamente un objeto JSON con la clave "items":
{
  "items": [
    {
      "id": "id del requerimiento",
      "name": "Título Limpio",
      "description": "Descripción técnica formal",
      "primaryActorId": "id de actor o null",
      "secondaryActorIds": [],
      "preconditions": "...",
      "postconditions": "..."
    }
  ]
}`;

    try {
      const response = await ai.executePrompt({
        system,
        prompt: `Procesa este lote de requerimientos en formato json:\n${JSON.stringify(payload)}`,
        model: config.model || 'gpt-6-luna'
      });
      const items = response.data?.items || response.data?.requirements || [];
      results.push(...items);
    } catch (err) {
      console.warn('[actorRelationRegeneration] Error en lote de enriquecimiento:', err.message);
    }
  }

  return results;
}

async function run({ projectId }) {
  const data = await prepare(projectId, prisma);
  const { actors, requirements, config } = data;

  // Ejecutar enriquecimiento semántico con IA
  const enrichedItems = await semanticEnrichment(requirements, actors, config);
  const enrichedMap = new Map(enrichedItems.map(item => [item.id, item]));

  return prisma.$transaction(async tx => {
    await require('./extractionStore').lock(tx, projectId);
    const liveActors = await tx.actor.findMany({ where: { projectId, isDeleted: false } });
    const liveActorIds = new Set(liveActors.map(a => a.id));

    const changes = [];
    let linksAdded = 0;

    for (const req of requirements) {
      const live = await tx.requirement.findUnique({ where: { id: req.id } });
      if (!live || live.isDeleted || live.status === 'REMOVED' || live.projectId !== projectId) continue;

      const enriched = enrichedMap.get(req.id);
      if (!enriched) continue;

      const actorAdditions = [];
      if (enriched.primaryActorId && liveActorIds.has(enriched.primaryActorId)) {
        actorAdditions.push(enriched.primaryActorId);
      }
      if (Array.isArray(enriched.secondaryActorIds)) {
        for (const secId of enriched.secondaryActorIds) {
          if (liveActorIds.has(secId) && !actorAdditions.includes(secId)) {
            actorAdditions.push(secId);
          }
        }
      }

      const newActorIds = [...new Set([...(live.actorIds || []), ...actorAdditions])];
      const addedCount = newActorIds.filter(id => !(live.actorIds || []).includes(id)).length;

      const cleanName = enriched.name && enriched.name.trim() ? enriched.name.trim() : live.name;
      const cleanDesc = enriched.description && enriched.description.trim() ? enriched.description.trim() : live.description;
      const pre = enriched.preconditions || live.preconditions;
      const post = enriched.postconditions || live.postconditions;

      const updated = await tx.requirement.update({
        where: { id: live.id },
        data: {
          name: cleanName,
          description: cleanDesc,
          actorIds: newActorIds,
          preconditions: pre,
          postconditions: post,
          qualityReport: {
            ...(live.qualityReport || {}),
            preconditions: pre,
            postconditions: post,
            pending: []
          }
        }
      });

      // Sincronizar candidatos de requerimiento asociados
      await tx.requirementCandidate.updateMany({
        where: { projectId, promotedRequirementId: live.id },
        data: {
          title: cleanName,
          statement: cleanDesc
        }
      });

      changes.push({
        id: live.id,
        code: live.code,
        name: cleanName,
        actorIds: newActorIds
      });
      linksAdded += addedCount;
    }

    // Sincronizar con documentWorkflow si existe
    try {
      const wf = await tx.documentWorkflow.findUnique({ where: { projectId } });
      if (wf?.state?.requirements?.content?.items) {
        const state = wf.state;
        for (const item of state.requirements.content.items) {
          const match = changes.find(c => c.id === item.id || c.code === item.originalCode);
          if (match) {
            item.name = match.name;
            if (match.actorIds.length) {
              item.participants = match.actorIds.map(aid => ({ actorId: aid, role: 'EXECUTES' }));
            }
          }
        }
        await tx.documentWorkflow.update({ where: { projectId }, data: { state } });
      }
    } catch {}

    const summary = {
      requirementsReviewed: requirements.length,
      requirementsUpdated: changes.length,
      linksAdded,
      pending: []
    };

    await tx.modelCandidate.create({
      data: {
        projectId,
        kind: 'ACTOR_RELATION_REGENERATION',
        name: 'Regeneración y enriquecimiento de relaciones',
        fingerprint: 'actor-relations-' + require('node:crypto').randomUUID(),
        status: 'COMPLETED',
        origin: 'INFERRED',
        content: { summary, changes }
      }
    });

    return summary;
  }, { timeout: 60000 });
}

const jobs = new AnalysisJobs(run);
module.exports = { prepare, run, jobs };
