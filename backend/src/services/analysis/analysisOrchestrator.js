const pdfExtractor = require('../document/PdfExtractor');
const textNormalizer = require('../document/textNormalizer');
const duplicateDetector = require('../document/duplicateDetector');
const sectionDetector = require('../document/SectionDetector');

const requirementDetector = require('./requirementDetector');
const actorDetector = require('./actorDetector');
const entityDetector = require('./entityDetector');
const technologyDetector = require('./technologyDetector');
const architectureDetector = require('./architectureDetector');
const ambiguityDetector = require('./ambiguityDetector');

const erDiagramGenerator = require('../diagrams/erDiagramGenerator');
const navigationGenerator = require('../diagrams/navigationGenerator');
const architectureGenerator = require('../diagrams/architectureGenerator');
const useCaseGenerator = require('../diagrams/useCaseGenerator');

const { createAIProvider } = require('../ai/AIService');
const env = require('../../config/env');

/**
 * Orquestador central del Pipeline Híbrido Determinista + IA para ICASE.
 * Coordina todo el ciclo:
 * PDF -> Extracción -> Normalización -> Detección de secciones -> Deduplicación ->
 * Extracción determinista -> Catálogos -> Aislamiento de ambigüedades ->
 * Invocación controlada a Ollama (solo si hay ambigüedades) -> Fusión -> Generación de diagramas.
 */
class AnalysisOrchestrator {
  /**
   * Ejecuta el pipeline completo a partir de un buffer PDF o texto de entrada.
   * @param {Buffer|Object} input - Buffer del archivo PDF o datos de extracción previa
   * @param {string} [fileName='documento.pdf']
   * @param {Object} [options={}]
   * @param {string} [options.providerOverride]
   * @returns {Promise<Object>} Análisis canónico enriquecido con diagramas y estadísticas
   */
  async process(input, fileName = 'documento.pdf', options = {}) {
    console.log(`\n[ICASE] Documento recibido: ${fileName}`);

    // 1. EXTRACCIÓN DE TEXTO
    let rawExtractedText = '';
    let pageCount = 1;

    if (Buffer.isBuffer(input)) {
      const extraction = await pdfExtractor.extractFromBuffer(input, fileName);
      rawExtractedText = extraction.extractedText || '';
      pageCount = extraction.pageCount || 1;
    } else if (typeof input === 'object' && input !== null) {
      rawExtractedText = input.rawText || input.extractedText || input.text || '';
      pageCount = input.pageCount || input.document?.pageCount || 1;
      if (input.fileName) fileName = input.fileName;
    } else if (typeof input === 'string') {
      rawExtractedText = input;
    }

    console.log(`[ICASE] Texto extraído: ${rawExtractedText.length.toLocaleString('es-ES')} caracteres`);

    // 2. NORMALIZACIÓN Y LIMPIEZA
    const { rawText, normalizedText, lines, paragraphs } = textNormalizer.normalize(rawExtractedText);
    console.log('[ICASE] Texto normalizado');

    // 3. DETECCIÓN DE SECCIONES
    const sections = sectionDetector.detectSections(rawText);

    // 4. ELIMINACIÓN DE DUPLICADOS (Fragmentos / Párrafos)
    const { uniqueFragments, possibleDuplicates, statistics } = duplicateDetector.deduplicateFragments(paragraphs);
    console.log(`[ICASE] Duplicados eliminados: ${statistics.duplicatesRemoved}`);

    // 5. EXTRACCIÓN DETERMINISTA POR PATRONES
    const { functionalRequirements, nonFunctionalRequirements, businessRules } = requirementDetector.detect(rawText, sections);
    const actors = actorDetector.detect(rawText, sections);
    const { entities, relationships } = entityDetector.detect(rawText, sections);

    console.log(`[ICASE] RF detectados: ${functionalRequirements.length}`);
    console.log(`[ICASE] RNF detectados: ${nonFunctionalRequirements.length}`);
    console.log(`[ICASE] Actores detectados: ${actors.length}`);
    console.log(`[ICASE] Entidades detectadas: ${entities.length}`);

    // 6. CATÁLOGOS CONOCIDOS: TECNOLOGÍAS Y ARQUITECTURA
    const technologies = technologyDetector.detect(rawText);
    const techCount = (technologies.frontend?.length || 0) +
                      (technologies.backend?.length || 0) +
                      (technologies.database?.length || 0) +
                      (technologies.infrastructure?.length || 0);
    console.log(`[ICASE] Tecnologías detectadas: ${techCount}`);

    const architecture = architectureDetector.detect(rawText, technologies);
    console.log(`[ICASE] Arquitectura detectada: ${architecture.name} (Origen: ${architecture.source === 'explicit' ? 'Explícita' : 'Predeterminada'})`);

    // 7. EVALUACIÓN Y AISLAMIENTO DE AMBIGÜEDADES
    const deterministicData = {
      functionalRequirements,
      nonFunctionalRequirements,
      businessRules,
      actors,
      entities,
      technologies,
      architecture
    };

    const ambiguityResult = ambiguityDetector.detectAmbiguities(uniqueFragments, deterministicData);
    const ambiguousFragments = ambiguityResult.ambiguousFragments;

    // Logs de demostración de control de prompt (Requisito 10)
    console.log(`[AnalysisPipeline] Texto original: ${ambiguityResult.stats.originalTokens} tokens`);
    console.log(`[AnalysisPipeline] Texto estructurado: ${ambiguityResult.stats.structuredTokens} tokens`);
    console.log(`[AnalysisPipeline] Fragmentos enviados a Ollama: ${ambiguityResult.stats.sentFragments}`);
    console.log(`[AnalysisPipeline] Tokens aproximados enviados a Ollama: ${ambiguityResult.stats.sentTokens}`);

    let aiInferences = {
      requirements: [],
      actors: [],
      entities: [],
      relationships: []
    };

    let aiFragmentsSent = 0;

    // 8. OLLAMA COMO ÚLTIMO RECURSO (SOLO SI EXISTEN FRAGMENTOS AMBIGUOS)
    if (!ambiguityResult.hasAmbiguity || ambiguousFragments.length === 0) {
      console.log('[ICASE] Fragmentos ambiguos: 0');
      console.log('[ICASE] Omitiendo llamada a Ollama (0 fragmentos ambiguos). Pipeline 100% determinista.');
    } else {
      aiFragmentsSent = ambiguousFragments.length;
      console.log(`[ICASE] Fragmentos ambiguos: ${ambiguousFragments.length}`);
      console.log(`[ICASE] Enviando solamente ${ambiguousFragments.length} fragmentos a Ollama`);

      try {
        const providerName = options.providerOverride || env.AI_PROVIDER || 'mock';
        const aiProvider = createAIProvider(providerName);

        const promptText = this.buildAmbiguityPrompt(ambiguousFragments);
        const rawAiResult = await aiProvider.analyzeProject({
          name: fileName.replace(/\.pdf$/i, ''),
          description: 'Análisis de fragmentos ambiguos',
          customPrompt: promptText,
          context: { ambiguousFragments }
        });

        const parsed = this.parseAIResponse(rawAiResult);
        if (parsed.isValid && parsed.data) {
          console.log('[ICASE] Ollama respondió correctamente');
          aiInferences = parsed.data;
        } else {
          console.warn('[ICASE] Ollama devolvió formato no estructurable. Continuando con datos deterministas.');
        }
      } catch (aiErr) {
        console.warn(`[ICASE] Advertencia: Error en proveedor de IA (${aiErr.message}). Continuando con datos deterministas sin interrupción.`);
      }
    }

    console.log('[ICASE] Análisis estructurado completado');

    // 9. COMBINAR RESULTADOS DETERMINISTAS + IA (evitando duplicados)
    const mergedResult = this.mergeResults(deterministicData, aiInferences, {
      fileName,
      pageCount,
      rawText,
      normalizedText,
      statistics: {
        totalFragments: statistics.totalFragments,
        duplicatesRemoved: statistics.duplicatesRemoved,
        aiFragments: aiFragmentsSent,
        possibleDuplicates: possibleDuplicates.length
      },
      ambiguousFragments
    });

    // 10. GENERACIÓN DETERMINISTA DE ARTEFACTOS MERMAID
    console.log('[ICASE] Generando diagrama ER');
    const erDiagram = erDiagramGenerator.generate(mergedResult.entities, mergedResult.relationships);

    console.log('[ICASE] Generando diagrama de navegación');
    const navigationDiagram = navigationGenerator.generate(mergedResult.screens, mergedResult.navigation, mergedResult.entities);

    console.log('[ICASE] Generando diagrama de arquitectura');
    const architectureDiagram = architectureGenerator.generate(mergedResult.architecture, mergedResult.technologies);

    const useCaseDiagram = useCaseGenerator.generate(mergedResult.actors, mergedResult.functionalRequirements);

    mergedResult.diagrams = {
      erDiagram,
      navigationDiagram,
      architectureDiagram,
      useCaseDiagram
    };

    return mergedResult;
  }

  /**
   * Construye el prompt hiper-enfocado para Ollama conteniendo únicamente los fragmentos ambiguos.
   * @param {string[]} ambiguousFragments
   * @returns {string}
   */
  buildAmbiguityPrompt(ambiguousFragments) {
    const list = ambiguousFragments.map((f, i) => `[Fragmento ${i + 1}]: "${f}"`).join('\n\n');
    return `Eres un analista de software para ICASE.
Se realizó la extracción determinista del documento, pero se aislaron los siguientes fragmentos ambiguos que requieren interpretación semántica:

${list}

INSTRUCCIÓN:
Analiza los fragmentos y extrae únicamente elementos válidos que complementen el sistema.
Devuelve EXCLUSIVAMENTE un objeto JSON sin comentarios, texto introductorio ni bloques decorativos:
{
  "requirements": [
    { "code": "RF-XX o RNF-XX", "name": "Nombre conciso", "description": "Detalle", "priority": "MEDIUM", "type": "FUNCTIONAL" }
  ],
  "actors": [
    { "name": "Rol", "description": "Descripción" }
  ],
  "entities": [
    { "name": "Entidad", "description": "Descripción" }
  ]
}`;
  }

  /**
   * Parsea la respuesta de la IA.
   * @param {*} rawResponse
   * @returns {{ isValid: boolean, data: Object|null }}
   */
  parseAIResponse(rawResponse) {
    if (!rawResponse) return { isValid: false, data: null };
    if (typeof rawResponse === 'object') return { isValid: true, data: rawResponse };

    const text = String(rawResponse).trim();
    try {
      return { isValid: true, data: JSON.parse(text) };
    } catch (e) {}

    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) {
      try {
        return { isValid: true, data: JSON.parse(codeBlockMatch[1].trim()) };
      } catch (e) {}
    }

    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return { isValid: true, data: JSON.parse(text.substring(firstBrace, lastBrace + 1)) };
      } catch (e) {}
    }

    return { isValid: false, data: null };
  }

  /**
   * Fusiona los datos deterministas con las inferencias de IA y construye el contrato canónico ICASE.
   * @param {Object} det - Datos deterministas
   * @param {Object} ai - Datos inferidos por IA
   * @param {Object} meta
   * @returns {Object}
   */
  mergeResults(det, ai = {}, meta = {}) {
    const projectName = (meta.fileName || 'Proyecto').replace(/\.pdf$/i, '').replace(/[_\-]+/g, ' ');

    // 1. Actores (explicit primero, luego inferred no duplicados)
    const actors = [...det.actors];
    const seenActorNames = new Set(actors.map(a => a.name.toLowerCase().trim()));

    for (const aiActor of (ai.actors || [])) {
      if (aiActor && aiActor.name) {
        const norm = aiActor.name.toLowerCase().trim();
        if (!seenActorNames.has(norm)) {
          seenActorNames.add(norm);
          actors.push({
            id: aiActor.id || `ACT-${String(actors.length + 1).padStart(2, '0')}`,
            name: aiActor.name.trim(),
            description: aiActor.description || `Rol ${aiActor.name}`,
            source: 'inferred'
          });
        }
      }
    }

    if (actors.length === 0) {
      actors.push({
        id: 'ACT-01',
        name: 'Usuario General',
        description: 'Usuario principal del sistema',
        source: 'default'
      });
    }

    const defaultActorId = actors[0].id;

    // 2. Requisitos Funcionales y No Funcionales
    const reqs = [];
    const seenCodes = new Set();

    // Deterministas (source: 'explicit')
    for (const rf of (det.functionalRequirements || [])) {
      const code = (rf.code || rf.id || 'RF-01').toUpperCase().trim();
      if (!seenCodes.has(code)) {
        seenCodes.add(code);
        reqs.push({
          id: code,
          code,
          name: rf.name || 'Requisito Funcional',
          description: rf.description || rf.name || '',
          type: 'FUNCTIONAL',
          priority: rf.priority || 'HIGH',
          actorIds: [defaultActorId],
          dependencies: [],
          source: 'explicit'
        });
      }
    }

    for (const rnf of (det.nonFunctionalRequirements || [])) {
      const code = (rnf.code || rnf.id || 'RNF-01').toUpperCase().trim();
      if (!seenCodes.has(code)) {
        seenCodes.add(code);
        reqs.push({
          id: code,
          code,
          name: rnf.name || 'Requisito No Funcional',
          description: rnf.description || rnf.name || '',
          type: 'NON_FUNCTIONAL',
          priority: rnf.priority || 'MEDIUM',
          actorIds: [],
          dependencies: [],
          source: 'explicit'
        });
      }
    }

    // Inferidos por IA (source: 'inferred')
    const aiReqList = [
      ...(ai.requirements || []),
      ...(ai.functionalRequirements || []),
      ...(ai.nonFunctionalRequirements || [])
    ];

    let aiCounter = 1;
    for (const aiReq of aiReqList) {
      if (!aiReq) continue;
      let code = (aiReq.code || aiReq.id || '').toUpperCase().trim();
      if (!code || seenCodes.has(code)) {
        code = `RF-INF-${String(aiCounter++).padStart(2, '0')}`;
      }
      if (!seenCodes.has(code)) {
        seenCodes.add(code);
        reqs.push({
          id: code,
          code,
          name: aiReq.name || 'Requisito inferido',
          description: aiReq.description || aiReq.name || '',
          type: (aiReq.type || (code.startsWith('RNF') ? 'NON_FUNCTIONAL' : 'FUNCTIONAL')).toUpperCase(),
          priority: aiReq.priority || 'MEDIUM',
          actorIds: [defaultActorId],
          dependencies: [],
          source: 'inferred'
        });
      }
    }

    // 3. Entidades
    const entities = [...det.entities];
    const seenEntityNames = new Set(entities.map(e => e.name.toLowerCase().trim()));

    for (const aiEnt of (ai.entities || [])) {
      if (aiEnt && aiEnt.name) {
        const norm = aiEnt.name.toLowerCase().trim();
        if (!seenEntityNames.has(norm)) {
          seenEntityNames.add(norm);
          entities.push({
            id: aiEnt.id || `ENT-${String(entities.length + 1).padStart(2, '0')}`,
            name: aiEnt.name.trim(),
            description: aiEnt.description || `Entidad ${aiEnt.name}`,
            attributes: Array.isArray(aiEnt.attributes) ? aiEnt.attributes : [],
            source: 'inferred'
          });
        }
      }
    }

    if (entities.length === 0) {
      entities.push({
        id: 'ENT-01',
        name: 'Sistema',
        description: 'Entidad principal del dominio',
        attributes: [
          { name: 'id', type: 'String', isPk: true },
          { name: 'fechaCreacion', type: 'DateTime', isPk: false }
        ],
        source: 'default'
      });
    }

    // 4. Relaciones
    const relationships = [...(det.relationships || [])];
    const seenRelKeys = new Set(relationships.map(r => `${r.source}->${r.target}`));

    for (const aiRel of (ai.relationships || [])) {
      if (aiRel && aiRel.source && aiRel.target) {
        const key = `${aiRel.source}->${aiRel.target}`;
        if (!seenRelKeys.has(key)) {
          seenRelKeys.add(key);
          relationships.push({
            id: aiRel.id || `REL-${String(relationships.length + 1).padStart(2, '0')}`,
            source: aiRel.source,
            target: aiRel.target,
            cardinality: aiRel.cardinality || '1:N',
            description: aiRel.description || `relaciona ${aiRel.source} con ${aiRel.target}`,
            source: 'inferred'
          });
        }
      }
    }

    // 5. Pantallas básicas por entidad / proceso
    const screens = [
      {
        id: 'SCR-01',
        name: 'Panel Principal',
        route: '/dashboard',
        purpose: 'Visualización general de actividades y métricas',
        description: 'Dashboard principal del sistema',
        components: [
          { type: 'card', label: 'Resumen Operativo', placeholder: 'Estadísticas del sistema' }
        ]
      }
    ];

    if (entities.length > 0) {
      screens.push({
        id: 'SCR-02',
        name: `Gestión de ${entities[0].name}`,
        route: `/${entities[0].name.toLowerCase()}s`,
        purpose: `Administración de ${entities[0].name}`,
        description: `Listado y formulario para ${entities[0].name}`,
        components: [
          { type: 'table', label: `Listado de ${entities[0].name}`, placeholder: 'Registros' }
        ]
      });
    }

    const navigation = [];
    if (screens.length > 1) {
      navigation.push({
        from: screens[0].name,
        to: screens[1].name,
        action: 'Navegar a gestión'
      });
    }

    return {
      project: {
        name: projectName,
        description: `Sistema estructurado a partir del documento ${meta.fileName || 'especificado'}.`
      },
      actors,
      requirements: reqs,
      functionalRequirements: reqs.filter(r => r.type === 'FUNCTIONAL'),
      nonFunctionalRequirements: reqs.filter(r => r.type === 'NON_FUNCTIONAL'),
      businessRules: det.businessRules || [],
      entities,
      relationships,
      screens,
      navigation,
      technologies: det.technologies,
      architecture: det.architecture,
      ambiguousFragments: meta.ambiguousFragments || [],
      statistics: meta.statistics || {
        totalFragments: 0,
        duplicatesRemoved: 0,
        aiFragments: 0
      },
      documentAnalysis: {
        sourceFile: meta.fileName || 'documento.pdf',
        pageCount: meta.pageCount || 1,
        totalRequirements: reqs.length,
        ruleRequirementsCount: reqs.filter(r => r.source === 'explicit').length,
        aiRequirementsCount: reqs.filter(r => r.source === 'inferred').length,
        totalActors: actors.length,
        businessRulesCount: (det.businessRules || []).length,
        architectureSource: det.architecture?.source || 'default',
        aiAnalysisStatus: 'completado_con_exito'
      },
      rawText: meta.rawText,
      normalizedText: meta.normalizedText
    };
  }
}

module.exports = new AnalysisOrchestrator();
