/**
 * AnalysisPipeline
 * Pipeline unificado de análisis inteligente de fuentes PDF y AUDIO para ICASE Studio.
 * Transforma SourceVersion.extractedText en:
 * - RequirementCandidate y NeedCandidate evaluados bajo ISO/IEC/IEEE 29148:2018
 * - ModelCandidate (Actores, Procesos, Reglas de Negocio, Tecnologías, Arquitectura,
 *   Entidades, Relaciones, Pantallas/Vistas, Fechas/Hitos, Supuestos/Restricciones, Objetivos y Alcance)
 * para revisión y aprobación humana antes de promoción oficial.
 */

const prisma = require('../../config/prisma');
const textNormalizer = require('../document/textNormalizer');
const duplicateDetector = require('../document/duplicateDetector');
const sectionDetector = require('../document/SectionDetector');
const structureDetector = require('./structureDetector');
const requirementDetector = require('./requirementDetector');
const technologyDetector = require('./technologyDetector');
const architectureDetector = require('./architectureDetector');
const actorDetector = require('./actorDetector');
const entityDetector = require('./entityDetector');
const processDetector = require('./processDetector');
const screenDetector = require('./screenDetector');
const datesDetector = require('./datesDetector');
const platformDetector = require('./platformDetector');
const constraintDetector = require('./constraintDetector');
const scopeObjectiveDetector = require('./scopeObjectiveDetector');
const candidateFragmentSelector = require('./candidateFragmentSelector');
const semanticAnalyzer = require('./semanticAnalyzer');
const candidateConsolidator = require('./candidateConsolidator');

class AnalysisPipeline {
  /**
   * Ejecuta el pipeline completo para una versión de fuente.
   * @param {Object} params
   * @param {string} params.projectId
   * @param {string} params.sourceId
   * @param {string} [params.sourceVersionId]
   * @param {string} [params.text]
   * @param {'PDF'|'AUDIO'|'CHAT'|'MANUAL'} [params.sourceType='PDF']
   * @param {boolean} [params.force=false]
   * @returns {Promise<Object>}
   */
  async run({
    projectId,
    sourceId,
    sourceVersionId = null,
    text = '',
    sourceType = 'PDF',
    segments = [],
    persist = true,
    force = false
  }) {
    const startTime = Date.now();

    let source = null;
    let version = null;
    let effectiveText = (text || '').trim();

    if (persist) {
      // 1. Obtener la fuente y versión si no vienen completas
      source = await prisma.source.findUnique({
        where: { id: sourceId },
        include: {
          currentVersion: {
            include: { segments: { orderBy: { startTime: 'asc' } } }
          }
        }
      });

      if (!source) {
        const err = new Error(`Fuente ${sourceId} no encontrada.`);
        err.statusCode = 404;
        throw err;
      }
      if (projectId && projectId !== source.projectId) {
        throw Object.assign(new Error('La fuente pertenece a otro proyecto.'), { statusCode: 409, code: 'DEPENDENCY_CONFLICT' });
      }
      projectId = source.projectId;

      version = sourceVersionId
        ? await prisma.sourceVersion.findUnique({
            where: { id: sourceVersionId },
            include: { segments: { orderBy: { startTime: 'asc' } } }
          })
        : source.currentVersion;

      if (!version) {
        const err = new Error(`Versión de fuente para ${sourceId} no encontrada.`);
        err.statusCode = 404;
        throw err;
      }
      if (version.sourceId !== source.id) {
        throw Object.assign(new Error('La versión no pertenece a esta fuente.'), { statusCode: 409, code: 'DEPENDENCY_CONFLICT' });
      }

      effectiveText = (text || version.extractedText || '').trim();
      if (!effectiveText) {
        const err = new Error('La fuente no contiene texto extraído o transcrito para analizar.');
        err.statusCode = 400;
        throw err;
      }

      // Comprobar idempotencia si ya fue analizada y no se solicitó forzar
      if (version.analyzedAt && !force) {
        const existingReqs = await prisma.requirementCandidate.findMany({
          where: { sourceVersionId: version.id },
          include: { needCandidate: true },
          orderBy: { createdAt: 'asc' }
        });
        const existingModels = await prisma.modelCandidate.findMany({
          where: { projectId },
          orderBy: { createdAt: 'asc' }
        });

        if (existingReqs.length > 0 || existingModels.length > 0) {
          console.log(`[AnalysisPipeline] Versión ${version.id} ya analizada previamente. Retornando ${existingReqs.length} reqs y ${existingModels.length} modelos existentes.`);
          return {
            sourceId: source.id,
            sourceVersionId: version.id,
            cached: true,
            requirementCandidates: existingReqs,
            modelCandidates: existingModels,
            summary: {
              totalCandidates: existingReqs.length + existingModels.length,
              requirementsCount: existingReqs.length,
              totalPendingReview: existingReqs.filter(r => r.status === 'PENDING_REVIEW').length + existingModels.filter(m => m.status === 'PENDING_REVIEW').length,
              cached: true
            }
          };
        }
      }
    } else {
      source = { id: sourceId || 'in-memory-source', name: 'Fuente en Memoria', type: sourceType };
      version = { id: sourceVersionId || 'in-memory-version', segments: segments || [] };
      if (!effectiveText && segments && segments.length > 0) {
        effectiveText = segments.map(s => s.text).join(' ');
      }
    }

    console.log(`\n====================================================`);
    console.log(`[AnalysisPipeline] Iniciando análisis exhaustivo para: ${source.name} (${source.type})`);
    console.log(`[AnalysisPipeline] Longitud texto: ${effectiveText.length} caracteres`);

    // 2. Preprocesamiento y Normalización
    const { rawText, normalizedText, paragraphs } = textNormalizer.normalize(effectiveText);

    // 3. Deduplicación de párrafos
    const { uniqueFragments, statistics: dupStats } = duplicateDetector.deduplicateFragments(paragraphs);
    console.log(`[AnalysisPipeline] Párrafos únicos: ${uniqueFragments.length} (Duplicados removidos: ${dupStats.duplicatesRemoved})`);

    // 4. Detección de Secciones
    const sections = sectionDetector.detectSections(rawText);

    // 5. Detección de Estructura
    const structure = structureDetector.classify(uniqueFragments, sections);
    console.log(`[AnalysisPipeline] Estructura: ${structure.classification} (${structure.metrics.structuredCount} estructurados, ${structure.metrics.unstructuredCount} no estructurados)`);

    // 6. Extracción Determinista Multi-dimensión (Reglas y Catálogos sin IA)
    const explicitData = requirementDetector.detect(rawText, sections);
    const explicitRF = explicitData.functionalRequirements || [];
    const explicitRNF = explicitData.nonFunctionalRequirements || [];
    const explicitRules = explicitData.businessRules || [];
    const allExplicit = [...explicitRF, ...explicitRNF, ...explicitRules];

    // Detectores especializados
    const actors = actorDetector.detect(rawText, sections);
    const entityData = entityDetector.detect(rawText, sections);
    const processes = processDetector.detect(rawText, sections);
    const screens = screenDetector.detect(rawText, sections);
    const dates = datesDetector.detect(rawText, sections);
    const platforms = platformDetector.detect(rawText);
    const constraintData = constraintDetector.detect(rawText, sections);
    const scopeObjectives = scopeObjectiveDetector.detect(rawText, sections);
    const technologies = technologyDetector.detect(rawText);
    const architecture = architectureDetector.detect(rawText, technologies);

    console.log(`[AnalysisPipeline] Extracción determinista inicial:`);
    console.log(`   - ${explicitRF.length} RF, ${explicitRNF.length} RNF, ${explicitRules.length} reglas`);
    console.log(`   - ${actors.length} actores, ${entityData.entities.length} entidades, ${entityData.relationships.length} relaciones`);
    console.log(`   - ${processes.length} procesos, ${screens.length} pantallas, ${dates.length} fechas/hitos`);
    console.log(`   - ${(technologies.detected || []).length} tecnologías, ${(architecture.all || []).length} arquitecturas`);
    console.log(`   - ${(constraintData.all || []).length} supuestos/dependencias, ${scopeObjectives.objectives.specific.length} objetivos esp.`);

    // 7. Selección de Fragmentos Candidatos para IA
    // Solo se envían bloques no estructurados o ambiguos
    const unresolvedBlocks = [...structure.semiStructuredBlocks, ...structure.unstructuredBlocks];
    const candidateChunks = candidateFragmentSelector.selectCandidateFragments(unresolvedBlocks);

    // Si es audio, enriquecer con timestamps
    if (source.type === 'AUDIO' && version.segments && version.segments.length > 0) {
      candidateChunks.forEach(chunk => {
        const matchingSegment = version.segments.find(s =>
          s.text && (chunk.chunkText.includes(s.text.slice(0, 20)) || s.text.includes(chunk.chunkText.slice(0, 20)))
        ) || version.segments[0];
        if (matchingSegment) {
          chunk.metadata = {
            audioSegmentId: matchingSegment.id,
            startTime: matchingSegment.startTime,
            endTime: matchingSegment.endTime,
            speaker: matchingSegment.speaker
          };
        }
      });
    }

    // Filtrar duplicados antes de enviar a Gemini
    const crossDocumentDeduplicator = require('../document/crossDocumentDeduplicator');
    const { uniqueFragments: dedupedChunks, duplicatesRemoved } = crossDocumentDeduplicator.deduplicateAmbiguousFragments(candidateChunks);
    if (duplicatesRemoved > 0) {
      console.log(`[DEDUP] Duplicados ambiguos removidos localmente: ${duplicatesRemoved}. Chunks a IA: ${dedupedChunks.length}`);
    }

    // 8. Análisis Semántico con IA (Gemini / Ollama)
    let semanticResults = [];
    let aiMetrics = { provider: 'none', requestsUsed: 0, batches: 0 };
    if (dedupedChunks.length > 0) {
      const res = await semanticAnalyzer.analyzeChunks(dedupedChunks, {
        projectId,
        sourceType: source.type
      });
      semanticResults = res.results || [];
      aiMetrics = res.metrics || aiMetrics;
    }

    // 9. Cargar candidatos existentes para detectar duplicados y conflictos
    let existingCandidates = [];
    if (persist) {
      existingCandidates = await prisma.requirementCandidate.findMany({
        where: { projectId, status: { not: 'REJECTED' } },
        select: { id: true, temporaryCode: true, statement: true, promotedRequirementId: true }
      });
      const official = await prisma.requirement.findMany({ where: { projectId, status: 'APPROVED' } });
      existingCandidates.unshift(...official.map(r => ({ id: r.id, temporaryCode: r.code, statement: r.description, requirementId: r.id })));
    }

    // 10. Consolidación de Requisitos y Calidad ISO 29148
    const consolidation = candidateConsolidator.consolidate({
      explicitRequirements: allExplicit,
      semanticResults,
      existingCandidates,
      projectId,
      sourceId: source.id,
      sourceVersionId: version.id
    });

    if (source.type === 'AUDIO') {
      for (const candidate of consolidation.requirementCandidates) {
        const segment = (version.segments || []).find(s => s.text.includes(candidate.statement) || candidate.statement.includes(s.text));
        if (segment) {
          candidate.sourceSegmentId = segment.id;
          candidate.evidence = {
            ...candidate.evidence,
            audioSegmentId: segment.id,
            startTime: segment.startTime,
            endTime: segment.endTime,
            speaker: segment.speaker
          };
        }
      }
    }

    // 11. Consolidación de Model Candidates (Actores, Procesos, Reglas, Tecnologías, Arquitectura, etc.)
    const modelCandidates = candidateConsolidator.consolidateModelCandidates({
      actors,
      processes,
      businessRules: explicitRules,
      technologies: technologies.detected || [],
      architecture,
      entities: entityData.entities || [],
      relationships: entityData.relationships || [],
      screens,
      dates,
      constraints: constraintData.all || [],
      objectives: scopeObjectives.objectives,
      scope: scopeObjectives.scope,
      platforms,
      projectId,
      sourceId: source.id,
      sourceVersionId: version.id,
      sourceName: source.name
    });

    let savedCandidates = {
      needs: consolidation.needCandidates,
      requirements: consolidation.requirementCandidates,
      models: modelCandidates
    };

    if (persist) {
      // 12. Persistencia Transaccional e Idempotente en PostgreSQL
      savedCandidates = await prisma.$transaction(async (tx) => {
        // Limpiar candidatos PENDING_REVIEW anteriores de esta misma versión
        await tx.requirementCandidate.deleteMany({
          where: { sourceVersionId: version.id, status: 'PENDING_REVIEW' }
        });
        await tx.needCandidate.deleteMany({
          where: { sourceVersionId: version.id, status: 'PENDING_REVIEW' }
        });

        // Guardar NeedCandidates
        const createdNeeds = [];
        for (const need of consolidation.needCandidates) {
          const created = await tx.needCandidate.create({
            data: {
              projectId: need.projectId,
              sourceId: need.sourceId,
              sourceVersionId: need.sourceVersionId,
              sourceSegmentId: need.sourceSegmentId,
              type: need.type,
              description: need.description,
              evidence: need.evidence,
              confidence: need.confidence,
              origin: need.origin,
              status: need.status,
              metadata: need.metadata
            }
          });
          createdNeeds.push(created);
        }

        // Guardar RequirementCandidates
        const createdReqs = [];
        for (const req of consolidation.requirementCandidates) {
          const created = await tx.requirementCandidate.create({
            data: {
              projectId: req.projectId,
              sourceId: req.sourceId,
              sourceVersionId: req.sourceVersionId,
              sourceSegmentId: req.sourceSegmentId,
              temporaryCode: req.temporaryCode,
              title: req.title,
              statement: req.statement,
              originalStatement: req.originalStatement,
              type: req.type,
              category: req.category,
              priority: req.priority,
              origin: req.origin,
              confidence: req.confidence,
              status: req.status,
              evidence: req.evidence,
              qualityReport: req.qualityReport
            }
          });
          createdReqs.push(created);
        }

        // Guardar ModelCandidates con upsert para evitar colisiones de huella digital
        const createdModels = [];
        for (const mc of modelCandidates) {
          const created = await tx.modelCandidate.upsert({
            where: {
              projectId_fingerprint: {
                projectId: mc.projectId,
                fingerprint: mc.fingerprint
              }
            },
            update: {
              content: mc.content,
              evidence: mc.evidence,
              confidence: mc.confidence,
              origin: mc.origin,
              updatedAt: new Date()
            },
            create: {
              projectId: mc.projectId,
              kind: mc.kind,
              name: mc.name,
              content: mc.content,
              evidence: mc.evidence,
              origin: mc.origin,
              confidence: mc.confidence,
              status: 'PENDING_REVIEW',
              fingerprint: mc.fingerprint
            }
          });
          createdModels.push(created);
        }

        // Actualizar plataforma del proyecto si se detectó una web/mobile explícita
        if (platforms.length > 0 && platforms[0].type) {
          await tx.project.update({
            where: { id: projectId },
            data: { platform: platforms[0].type }
          });
        }

        // Actualizar SourceVersion y Source a ANALYZED
        await tx.sourceVersion.update({
          where: { id: version.id },
          data: { analyzedAt: new Date() }
        });

        await tx.source.update({
          where: { id: source.id },
          data: { status: 'ANALYZED' }
        });

        return {
          needs: createdNeeds,
          requirements: createdReqs,
          models: createdModels
        };
      });
    }

    const totalDuration = Date.now() - startTime;
    const totalPendingCount = savedCandidates.requirements.filter(r => r.status === 'PENDING_REVIEW').length +
      savedCandidates.models.filter(m => m.status === 'PENDING_REVIEW').length;

    console.log(`[AnalysisPipeline] Completado con éxito en ${totalDuration}ms.`);
    console.log(`[AnalysisPipeline] Total candidatos: ${savedCandidates.requirements.length} requisitos + ${savedCandidates.models.length} modelos. Pendientes: ${totalPendingCount}`);
    console.log(`====================================================\n`);

    return {
      success: true,
      sourceId: source.id,
      sourceVersionId: version.id,
      summary: {
        totalCandidates: savedCandidates.requirements.length + savedCandidates.models.length,
        requirementsCount: savedCandidates.requirements.length,
        actorsCount: actors.length,
        processesCount: processes.length,
        businessRulesCount: explicitRules.length,
        technologiesCount: (technologies.detected || []).length,
        entitiesCount: (entityData.entities || []).length,
        relationshipsCount: (entityData.relationships || []).length,
        screensCount: screens.length,
        datesCount: dates.length,
        architectureCount: (architecture.all || []).length,
        constraintsCount: (constraintData.all || []).length,
        objectivesCount: (scopeObjectives.objectives?.specific || []).length + (scopeObjectives.objectives?.general ? 1 : 0),
        scopeCount: (scopeObjectives.scope?.included || []).length + (scopeObjectives.scope?.excluded || []).length,
        totalPendingReview: totalPendingCount,
        explicitCount: consolidation.summary.explicit,
        inferredCount: consolidation.summary.inferred,
        duplicatesDetected: consolidation.summary.duplicates,
        conflictsDetected: consolidation.summary.conflicts,
        aiMetrics: {
          ...aiMetrics,
          totalDurationMs: totalDuration,
          deterministicExtractions: allExplicit.length + modelCandidates.length
        }
      },
      metrics: aiMetrics,
      explicitRequirements: allExplicit,
      technologies,
      architecture,
      needCandidates: savedCandidates.needs,
      requirementCandidates: savedCandidates.requirements,
      modelCandidates: savedCandidates.models
    };
  }

  async runPipeline(params) {
    return this.run(params);
  }
}

module.exports = new AnalysisPipeline();
