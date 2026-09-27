/**
 * AnalysisPipeline
 * Pipeline unificado de análisis inteligente de requisitos para fuentes PDF y AUDIO.
 * Transforma SourceVersion.extractedText en NeedCandidate y RequirementCandidate
 * evaluados bajo criterios de calidad ISO/IEC/IEEE 29148:2018 para revisión humana.
 */

const prisma = require('../../config/prisma');
const textNormalizer = require('../document/textNormalizer');
const duplicateDetector = require('../document/duplicateDetector');
const sectionDetector = require('../document/SectionDetector');
const structureDetector = require('./structureDetector');
const requirementDetector = require('./requirementDetector');
const technologyDetector = require('./technologyDetector');
const architectureDetector = require('./architectureDetector');
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
      if (projectId && projectId !== source.projectId) throw Object.assign(new Error('La fuente pertenece a otro proyecto.'), { statusCode: 409, code: 'DEPENDENCY_CONFLICT' });
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
      if (version.sourceId !== source.id) throw Object.assign(new Error('La versión no pertenece a esta fuente.'), { statusCode: 409, code: 'DEPENDENCY_CONFLICT' });

      effectiveText = (text || version.extractedText || '').trim();
      if (!effectiveText) {
        const err = new Error('La fuente no contiene texto extraído o transcrito para analizar.');
        err.statusCode = 400;
        throw err;
      }

      // Comprobar idempotencia si ya fue analizada y no se solicitó forzar
      if (version.analyzedAt && !force) {
        const existingCandidates = await prisma.requirementCandidate.findMany({
          where: { sourceVersionId: version.id },
          include: { needCandidate: true },
          orderBy: { createdAt: 'asc' }
        });
        if (existingCandidates.length > 0) {
          console.log(`[AnalysisPipeline] Versión ${version.id} ya analizada previamente. Retornando ${existingCandidates.length} candidatos existentes.`);
          return {
            sourceId: source.id,
            sourceVersionId: version.id,
            cached: true,
            requirementCandidates: existingCandidates,
            summary: { total: existingCandidates.length, cached: true }
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
    console.log(`[AnalysisPipeline] Iniciando análisis para: ${source.name} (${source.type})`);
    console.log(`[AnalysisPipeline] Longitud texto: ${effectiveText.length} caracteres`);

    // 2. Preprocesamiento y Normalización (sin destruir original)
    const { rawText, normalizedText, paragraphs } = textNormalizer.normalize(effectiveText);

    // 3. Deduplicación
    const { uniqueFragments, statistics: dupStats } = duplicateDetector.deduplicateFragments(paragraphs);
    console.log(`[AnalysisPipeline] Párrafos únicos: ${uniqueFragments.length} (Duplicados removidos: ${dupStats.duplicatesRemoved})`);

    // 4. Detección de Secciones
    const sections = sectionDetector.detectSections(rawText);

    // 5. Detección de Estructura (STRUCTURED vs SEMI_STRUCTURED vs UNSTRUCTURED)
    const structure = structureDetector.classify(uniqueFragments, sections);
    console.log(`[AnalysisPipeline] Clasificación estructural: ${structure.classification} (${structure.metrics.structuredCount} estructurados, ${structure.metrics.unstructuredCount} no estructurados)`);

    // 6. Extracción Determinista (CÓDIGO - NIVEL 1: 0 llamadas a IA)
    const explicitData = requirementDetector.detect(rawText, sections);
    const explicitRF = explicitData.functionalRequirements || [];
    const explicitRNF = explicitData.nonFunctionalRequirements || [];
    const explicitRules = explicitData.businessRules || [];
    const allExplicit = [...explicitRF, ...explicitRNF, ...explicitRules];

    // Tecnologías y arquitecturas por catálogo determinista
    const technologies = technologyDetector.detect(rawText);
    const architecture = architectureDetector.detect(rawText, technologies);

    console.log(`[AnalysisPipeline] Extracción determinista: ${explicitRF.length} RF, ${explicitRNF.length} RNF, ${explicitRules.length} reglas.`);

    // 7. Selección de Fragmentos Candidatos para IA
    // Solo se envían bloques no estructurados o semi-estructurados con señales de requisitos
    const unresolvedBlocks = [...structure.semiStructuredBlocks, ...structure.unstructuredBlocks];
    const candidateChunks = candidateFragmentSelector.selectCandidateFragments(unresolvedBlocks);
    console.log(`[AnalysisPipeline] Fragmentos candidatos aislados para análisis semántico: ${candidateChunks.length}`);

    // Si es audio y tiene segmentos, enriquecer los chunks con timestamps del segmento más cercano
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

    // 8. Análisis Semántico Escalonado (Ollama-first -> GPT fallback)
    const { results: semanticResults, metrics: aiMetrics } = await semanticAnalyzer.analyzeChunks(candidateChunks, {
      projectId,
      sourceType: source.type
    });

    console.log(`[AnalysisPipeline] Métricas de IA: Ollama calls: ${aiMetrics.ollamaCalls} (${aiMetrics.ollamaFailures} fallos), GPT calls: ${aiMetrics.gptCalls}`);

    // 9. Cargar candidatos existentes del proyecto para detectar duplicados/conflictos entre fuentes
    let existingCandidates = [];
    if (persist) {
      existingCandidates = await prisma.requirementCandidate.findMany({
        where: { projectId, status: { not: 'REJECTED' } },
        select: { id: true, temporaryCode: true, statement: true, promotedRequirementId: true }
      });
      const official = await prisma.requirement.findMany({ where: { projectId, status: 'APPROVED' } });
      existingCandidates.unshift(...official.map(r => ({ id: r.id, temporaryCode: r.code, statement: r.description, requirementId: r.id })));
    }

    // 10. Consolidación de Candidatos y Validación de Calidad ISO 29148
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
        if (segment) { candidate.sourceSegmentId = segment.id; candidate.evidence = { ...candidate.evidence, audioSegmentId: segment.id, startTime: segment.startTime, endTime: segment.endTime, speaker: segment.speaker }; }
      }
    }

    let savedCandidates = {
      needs: consolidation.needCandidates,
      requirements: consolidation.requirementCandidates
    };

    if (persist) {
      // 11. Persistencia Idempotente en PostgreSQL
      savedCandidates = await prisma.$transaction(async (tx) => {
        // Si existían candidatos no aprobados de esta misma versión, limpiarlos antes de insertar los nuevos
        await tx.requirementCandidate.deleteMany({
          where: {
            sourceVersionId: version.id,
            status: 'PENDING_REVIEW'
          }
        });
        await tx.needCandidate.deleteMany({
          where: {
            sourceVersionId: version.id,
            status: 'PENDING_REVIEW'
          }
        });

        // Crear NeedCandidates
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

        // Crear RequirementCandidates
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
          requirements: createdReqs
        };
      });
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[AnalysisPipeline] Completado con éxito en ${totalDuration}ms.`);
    console.log(`[AnalysisPipeline] Total candidatos generados: ${savedCandidates.requirements.length}`);
    console.log(`====================================================\n`);

    return {
      success: true,
      sourceId: source.id,
      sourceVersionId: version.id,
      summary: {
        totalCandidates: savedCandidates.requirements.length,
        explicitCount: consolidation.summary.explicit,
        inferredCount: consolidation.summary.inferred,
        duplicatesDetected: consolidation.summary.duplicates,
        conflictsDetected: consolidation.summary.conflicts,
        aiMetrics: {
          ...aiMetrics,
          totalDurationMs: totalDuration,
          deterministicExtractions: allExplicit.length
        }
      },
      metrics: aiMetrics,
      explicitRequirements: allExplicit,
      technologies,
      architecture,
      needCandidates: savedCandidates.needs,
      requirementCandidates: savedCandidates.requirements
    };
  }

  async runPipeline(params) {
    return this.run(params);
  }
}

module.exports = new AnalysisPipeline();
