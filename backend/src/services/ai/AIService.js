const prisma = require('../../config/prisma');
const env = require('../../config/env');
const MockAIProvider = require('./MockAIProvider');
const GeminiProvider = require('./GeminiProvider');
const OllamaProvider = require('./OllamaProvider');
const OpenAIProvider = require('./OpenAIProvider');
const N8nProvider = require('./N8nProvider');
const { validateAIResponse, normalizeAIResponse } = require('./ai.contract.validator');

/**
 * Factory function to instantiate the selected AI provider.
 * @param {string} [providerName]
 * @returns {AIProvider}
 */
function createAIProvider(providerName = env.AI_PROVIDER) {
  const key = (providerName || 'mock').toLowerCase();
  switch (key) {
    case 'gemini':
      return new GeminiProvider();
    case 'ollama':
      return new OllamaProvider();
    case 'openai':
      return new OpenAIProvider();
    case 'n8n':
      return new N8nProvider();
    case 'mock':
    default:
      if (key !== 'mock') {
        console.warn(`[AIService] Proveedor '${providerName}' no reconocido. Seleccionando 'mock' por defecto.`);
      }
      return new MockAIProvider();
  }
}

class AIService {
  /**
   * Main entrypoint for project analysis.
   * Obtains the provider, requests analysis, validates contract, and transactionally persists data into PostgreSQL.
   * @param {Object} input - { projectId, name, description, context, providerOverride }
   * @returns {Promise<Object>} Canonical Structured JSON
   */
  async analyzeProject(input) {
    const project = await prisma.project.findUnique({ where: { id: input.projectId },
      include: { actors: {where:{isDeleted:false}}, sources: { include: { currentVersion: true } } } });
    if (!project) throw Object.assign(new Error('Proyecto no encontrado'), { statusCode: 404 });
    const description = input.description || project.systemDescription || project.description || '';
    const documents = (project.sources || []).filter(s => s.currentVersion?.extractedText);
    if (!description.trim() && !documents.length) throw Object.assign(new Error('No hay texto para analizar'), { statusCode: 400 });
    const options = { knownActors: project.actors || [], providerOverride: input.providerOverride, modelOverride: input.modelOverride,
      providerInstance: input.providerInstance, cache: input.cache };
    const results = [];
    for (const source of documents) {
      const analysis = await require('../analysis/analysisPipeline').run({ ...options, projectId: project.id,
        sourceId: source.id, sourceVersionId: source.currentVersion.id });
      results.push({ ...analysis.extraction, metrics: analysis.metrics });
    }
    const identity = require('../analysis/requirementIdentity');
    const knownRequirements = identity.consolidate(results.flatMap(r => r.requirements));
    if (description.trim()) { const descriptionResult = await require('../analysis/documentExtraction').extract(description, {
      ...options, fileName: project.name, knownRequirements,
      contextSegments: identity.unique(results.flatMap(r => r.actors.flatMap(a => a.evidence.map(e => ({
        ...e, text: e.quote, originalText: e.quote, start: e.quoteStart, end: e.quoteEnd
      })))))
    });
      await require('../analysis/actorRelationshipResolver').resolve(descriptionResult,{...options,knownActors:project.actors?.length?project.actors:results.flatMap(r=>r.actors)});
      results.push(descriptionResult);
    }
    const actors = [];
    for (const actor of results.flatMap(r => r.actors)) {
      const existing = actors.find(a => a.id === actor.id);
      if (existing) existing.evidence = identity.unique([...existing.evidence, ...actor.evidence]);
      else actors.push({ ...actor });
    }
    const requirements = identity.consolidate(results.flatMap(r => r.requirements));
    const result = { ...results.at(-1), project: { name: project.name, description }, rawText: description,
      requirements, actors, partial: results.some(r => r.partial),
      functionalRequirements: requirements.filter(r => r.type === 'FUNCTIONAL'),
      nonFunctionalRequirements: requirements.filter(r => r.type === 'NON_FUNCTIONAL'),
      segments: identity.unique(results.flatMap(r => r.segments)), coverage: identity.unique(results.flatMap(r => r.coverage)),
      failures: results.flatMap(r => r.failures), other: results.flatMap(r => r.other),
      businessRules: results.flatMap(r => r.businessRules),
      metrics: { ...results.at(-1).metrics, requestsUsed: results.reduce((n,r) => n + r.metrics.requestsUsed, 0),
        reusedSources: results.filter(r => r.metrics.reusedSource).length,
        usage: results.flatMap(r => r.metrics.usage || []) } };
    result.documentAnalysis = { ...result.documentAnalysis, totalRequirements: requirements.length, totalActors: actors.length };
    await this.persistDocumentExtraction(project.id, result, { options,
      snapshotKey: require('../analysis/extractionStore').fingerprint({ projectId: project.id,
        text: JSON.stringify([description, documents.map(s => s.currentVersion.id)]), options }) });
    return result;
  }

  async persistDocumentExtraction(projectId, result, meta = {}) {
    return require('../analysis/extractionStore').persist(projectId, result, meta);
  }

  /**
   * Persiste transaccionalmente un análisis validado en PostgreSQL para un proyecto.
   * @param {string} projectId
   * @param {Object} rawResult
   */
  async persistProjectAnalysis(projectId, rawResult) {
    await prisma.$transaction(async (tx) => {
      // Eliminar únicamente elementos NO aprobados; preservar siempre requisitos y modelos aprobados
      await tx.requirement.deleteMany({ where: { projectId, status: { notIn: ['APPROVED', 'IMPLEMENTED'] } } });
      await tx.actor.deleteMany({ where: { projectId, reviewStatus: { not: 'APPROVED' } } });
      await tx.entityRelationship.deleteMany({ where: { projectId, status: { not: 'APPROVED' } } });
      await tx.entity.deleteMany({ where: { projectId, reviewStatus: { not: 'APPROVED' } } });
      await tx.screen.deleteMany({ where: { projectId, reviewStatus: { not: 'APPROVED' } } });
      await tx.navigationNode.deleteMany({ where: { projectId, reviewStatus: { not: 'APPROVED' } } });
      await tx.architecture.deleteMany({ where: { projectId, reviewStatus: { not: 'APPROVED' } } });

      const deduplicationService = require('../analysis/deduplicationService');

      function cleanUtf8(str) {
        if (!str || typeof str !== 'string') return str;
        return str.normalize('NFC').trim();
      }

      // Guardar Actores Canónicos (evitando duplicados mediante canonicalKey y aliases)
      const actorReferenceMap = new Map();
      if (rawResult.actors && rawResult.actors.length > 0) {
        const existingActors = await tx.actor.findMany({ where: { projectId, isDeleted: false } });

        for (const actor of rawResult.actors) {
          const rawActorName = cleanUtf8(actor.name);
          if (!rawActorName) continue;

          const canonicalKey = deduplicationService.getActorCanonicalKey(rawActorName);
          const displayName = deduplicationService.getPreferredActorDisplayName(rawActorName, canonicalKey);

          const match = existingActors.find(a =>
            deduplicationService.getActorCanonicalKey(a.name) === canonicalKey ||
            (a.aliases && a.aliases.includes(rawActorName))
          );

          if (match) {
            actorReferenceMap.set(actor.id, match.id);
            const nextAliases = Array.from(new Set([...(match.aliases || []), rawActorName, displayName]));
            const nextDesc = match.description && actor.description && !match.description.includes(actor.description)
              ? `${match.description} · ${cleanUtf8(actor.description)}`.slice(0, 500)
              : (match.description || cleanUtf8(actor.description));

            await tx.actor.update({
              where: { id: match.id },
              data: {
                aliases: nextAliases,
                description: nextDesc,
                name: displayName
              }
            });
          } else {
            const count = existingActors.length + 1;
            const code = actor.id || `ACT-${String(count).padStart(2, '0')}`;
            const created = await tx.actor.create({
              data: {
                projectId,
                codeId: code,
                name: displayName,
                description: actor.description ? cleanUtf8(actor.description) : null,
                aliases: [rawActorName, displayName],
                status: 'PENDING_REVIEW',
                reviewStatus: /^personal$/i.test(rawActorName) ? 'NEEDS_REVIEW' : 'PENDING'
              }
            });
            actorReferenceMap.set(actor.id, created.id);
            existingActors.push(created);
          }
        }
      }

      // Guardar Requisitos Canónicos (Deduplicación y consolidación PREVIA)
      if (rawResult.requirements && rawResult.requirements.length > 0) {
        const existingApproved = await tx.requirement.findMany({
          where: { projectId, status: 'APPROVED', isDeleted: false }
        });

        const { canonicalRequirements } = deduplicationService.groupAndConsolidateRequirements(
          rawResult.requirements,
          existingApproved
        );

        for (const req of canonicalRequirements) {
          const code = req.code.trim().toUpperCase();

          // Verificar si ya existe aprobado por código o semántica
          const existingApprovedMatch = existingApproved.find(ea =>
            ea.code === code || deduplicationService.isSemanticEquivalent(ea, req)
          );
          if (existingApprovedMatch) {
            continue;
          }

          await tx.requirement.create({
            data: {
              projectId,
              code,
              name: cleanUtf8(req.name),
              description: req.description ? cleanUtf8(req.description) : cleanUtf8(req.statement || req.name),
              type: (req.type === 'NON_FUNCTIONAL' || req.type === 'NO_FUNCIONAL' || req.type === 'RNF' || code.startsWith('RNF'))
                ? 'NON_FUNCTIONAL'
                : 'FUNCTIONAL',
              priority: (req.priority === 'ALTA' || req.priority === 'HIGH')
                ? 'HIGH'
                : (req.priority === 'BAJA' || req.priority === 'LOW')
                  ? 'LOW'
                  : 'MEDIUM',
              status: 'PENDING',
              actorIds: [...new Set((req.actorIds || []).map(ref => actorReferenceMap.get(ref)).filter(Boolean))],
              dependencies: req.dependencies || [],
              sources: req.sources || [],
              preconditions: req.preconditions ? cleanUtf8(req.preconditions) : ((req.type === 'NON_FUNCTIONAL' || req.type === 'NO_FUNCIONAL' || code.startsWith('RNF')) ? 'Entorno operativo y conectividad estándar' : 'Usuario con sesión activa y permisos correspondientes'),
              postconditions: req.postconditions ? cleanUtf8(req.postconditions) : ((req.type === 'NON_FUNCTIONAL' || req.type === 'NO_FUNCIONAL' || code.startsWith('RNF')) ? 'Métricas de calidad y estabilidad verificadas' : 'Estado del sistema actualizado y transacción persistida con éxito')
            }
          });
        }
      }

      // Guardar Entidades con Atributos
      if (rawResult.entities && rawResult.entities.length > 0) {
        for (const ent of rawResult.entities) {
          const createdEntity = await tx.entity.create({
            data: {
              projectId,
              codeId: ent.id || null,
              name: cleanUtf8(ent.name),
              description: ent.description ? cleanUtf8(ent.description) : null
            }
          });

          if (ent.attributes && Array.isArray(ent.attributes)) {
            for (const attr of ent.attributes) {
              await tx.entityAttribute.create({
                data: {
                  entityId: createdEntity.id,
                  name: cleanUtf8(attr.name),
                  type: attr.type || 'String',
                  isPk: attr.name.toLowerCase() === 'id'
                }
              });
            }
          }
        }
      }

      // Guardar Relaciones
      if (rawResult.relationships && rawResult.relationships.length > 0) {
        for (const rel of rawResult.relationships) {
          await tx.entityRelationship.create({
            data: {
              projectId,
              codeId: rel.id || null,
              source: cleanUtf8(rel.source),
              target: cleanUtf8(rel.target),
              cardinality: rel.cardinality || '1:N',
              description: rel.description ? cleanUtf8(rel.description) : null
            }
          });
        }
      }

      // Guardar Pantallas con Componentes
      if (rawResult.screens && rawResult.screens.length > 0) {
        for (const scr of rawResult.screens) {
          const createdScreen = await tx.screen.create({
            data: {
              projectId,
              codeId: scr.id || null,
              name: cleanUtf8(scr.name),
              description: scr.description ? cleanUtf8(scr.description) : null,
              route: scr.route || '/',
              purpose: scr.purpose ? cleanUtf8(scr.purpose) : null,
              selectedForGeneration: true,
              requirementIds: scr.requirementIds || [],
              actorIds: scr.actorIds || []
            }
          });

          if (scr.components && Array.isArray(scr.components)) {
            for (let i = 0; i < scr.components.length; i++) {
              const comp = scr.components[i];
              await tx.screenComponent.create({
                data: {
                  screenId: createdScreen.id,
                  type: comp.type || 'card',
                  label: comp.label ? cleanUtf8(comp.label) : null,
                  placeholder: comp.placeholder ? cleanUtf8(comp.placeholder) : null,
                  order: i,
                  meta: comp.meta || null
                }
              });
            }
          }
        }
      }

      // Guardar Nodos de Navegación
      if (rawResult.navigation && rawResult.navigation.length > 0) {
        for (const nav of rawResult.navigation) {
          await tx.navigationNode.create({
            data: {
              projectId,
              from: cleanUtf8(nav.from),
              to: cleanUtf8(nav.to),
              action: nav.action ? cleanUtf8(nav.action) : null
            }
          });
        }
      }

      // Guardar Arquitectura con Componentes y Diagramas de Software y Despliegue
      const architectureGenerator = require('../diagrams/architectureGenerator');
      const arch = rawResult.architecture || {};
      const createdArch = await tx.architecture.create({
        data: {
          projectId,
          style: arch.style || 'Clean Architecture / 3 Capas',
          frontend: arch.frontend || 'React',
          backend: arch.backend || 'Node.js Express',
          database: arch.database || 'PostgreSQL',
          connections: arch.connections || [],
          softwareDiagram: architectureGenerator.generateSoftwareArchitecture(arch),
          deploymentDiagram: architectureGenerator.generateDeploymentArchitecture(rawResult.technologies || {})
        }
      });

      if (arch.components && Array.isArray(arch.components)) {
        for (const comp of arch.components) {
          const compName = typeof comp === 'string'
            ? comp.trim()
            : String(comp?.name || comp?.component || comp?.label || comp?.id || '').trim();
          if (!compName) continue;

          await tx.architectureComponent.create({
            data: {
              architectureId: createdArch.id,
              name: cleanUtf8(compName),
              layer: comp?.layer || 'Application',
              type: comp?.type || 'Component'
            }
          });
        }
      }
    });

    // Generar Casos de Uso Fundamentales y Diagrama de Clases
    try {
      const useCaseService = require('../useCase.service');
      const classModelService = require('../classModel.service');
      await useCaseService.generateFundamentalUseCases(projectId);
      await classModelService.generateClassesFromEntities(projectId);
    } catch (postErr) {
      console.warn('[AIService] Advertencia generando casos de uso o clases:', postErr.message);
    }

    return true;
  }
}

module.exports = {
  AIService: new AIService(),
  createAIProvider
};
