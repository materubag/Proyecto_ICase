const pdfExtractor = require('./PdfExtractor');
const pdfTextCleaner = require('./PdfTextCleaner');
const sectionDetector = require('./SectionDetector');
const ruleBasedExtractor = require('./RuleBasedExtractor');
const { buildAIContext, buildDocumentPrompt } = require('./documentPrompt');
const { createAIProvider } = require('../ai/AIService');
const { validateAIResponse } = require('../ai/ai.contract.validator');
const env = require('../../config/env');

class DocumentAnalyzer {
  /**
   * Extrae y procesa texto desde un buffer PDF sin llamar a IA.
   * Devuelve la estructura intermedia canónica enriquecida mediante reglas deterministas.
   * @param {Buffer} buffer
   * @param {string} fileName
   * @returns {Promise<Object>} Estructura intermedia canónica
   */
  async extractDocument(buffer, fileName = 'documento.pdf') {
    // 1. Extracción con pdf-parse
    const extracted = await pdfExtractor.extractFromBuffer(buffer, fileName);

    // 2. Limpieza determinística
    const cleanedText = pdfTextCleaner.clean(extracted.extractedText);

    // 3. Detección de secciones
    const sections = sectionDetector.detectSections(cleanedText);

    // 4. Extracción basada en reglas deterministas (RF, RNF, Actores, Reglas, Entidades, etc.)
    const rules = ruleBasedExtractor.extract(cleanedText, sections, {
      fileName: extracted.fileName || fileName,
      pageCount: extracted.pageCount
    });

    const textNormalizer = require('./textNormalizer');
    const technologyDetector = require('../analysis/technologyDetector');
    const architectureDetector = require('../analysis/architectureDetector');

    const norm = textNormalizer.normalize(cleanedText);
    const techCatalog = technologyDetector.detect(cleanedText);
    const archCatalog = architectureDetector.detect(cleanedText, techCatalog);

    // 5. Logs requeridos de depuración
    console.log(`[PDF] páginas extraídas: ${extracted.pageCount}`);
    console.log(`[PDF] caracteres extraídos: ${cleanedText.length}`);
    console.log(`[PDF] requisitos funcionales encontrados: ${rules.functionalRequirements.length}`);
    console.log(`[PDF] requisitos no funcionales encontrados: ${rules.nonFunctionalRequirements.length}`);
    console.log(`[PDF] actores encontrados: ${rules.actors.length}`);
    console.log(`[PDF] entidades encontradas: ${rules.entities.length}`);
    console.log(`[PDF] reglas encontradas: ${rules.businessRules.length}`);
    console.log(`[PDF] tecnologías encontradas: ${(techCatalog.detected || []).length}`);
    console.log(`[PDF] arquitectura: ${archCatalog.name} [${archCatalog.source}]`);

    return {
      document: {
        name: extracted.fileName || fileName,
        pageCount: extracted.pageCount
      },
      sections: sections.map(s => ({
        title: s.title,
        category: s.category,
        start: s.start,
        end: s.end
      })),
      actors: rules.actors,
      functionalRequirements: rules.functionalRequirements,
      nonFunctionalRequirements: rules.nonFunctionalRequirements,
      businessRules: rules.businessRules,
      entities: rules.entities,
      processes: rules.processes,
      technologies: rules.technologies,
      constraints: rules.constraints,
      dependencies: rules.dependencies,
      architecture: rules.architecture,
      contextSections: rules.contextSections,
      rawText: cleanedText,
      normalizedText: norm.normalizedText,
      technologyCatalog: techCatalog,
      architectureCatalog: archCatalog,
      // Propiedades para retrocompatibilidad con interfaces previas
      fileName: extracted.fileName || fileName,
      pageCount: extracted.pageCount,
      textLength: cleanedText.length,
      extractedText: cleanedText,
      detectedSections: sections.map(s => ({
        title: s.title,
        category: s.category,
        start: s.start,
        end: s.end
      })),
      ruleRequirements: rules.requirements,
      ruleActors: rules.actors,
      architectureHints: rules.architecture
    };
  }

  /**
   * Construye el contexto reducido para la IA a partir del documento extraído.
   * Evita enviar el rawText completo a Ollama.
   * @param {Object} extractedDocument
   * @returns {Object} Contexto reducido para IA
   */
  buildAIContext(extractedDocument) {
    return buildAIContext(extractedDocument);
  }

  /**
   * Normaliza y extrae un JSON válido de la respuesta de Ollama.
   * Maneja JSON puro, bloques con formato markdown ```json { ... } ```,
   * o JSON embebido entre texto narrativo.
   * @param {string|Object} rawResponse
   * @returns {{isValid: boolean, data: Object|null, error: string|null}}
   */
  parseAIResponse(rawResponse) {
    if (!rawResponse) {
      console.log('[AI] JSON válido: false');
      return { isValid: false, data: null, error: 'Respuesta de IA vacía' };
    }

    if (typeof rawResponse === 'object' && rawResponse !== null) {
      console.log('[AI] JSON válido: true');
      return { isValid: true, data: rawResponse, error: null };
    }

    let text = String(rawResponse).trim();

    // 1. Intentar JSON.parse directo
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        console.log('[AI] JSON válido: true');
        return { isValid: true, data: parsed, error: null };
      }
    } catch (e) {
      // Continuar con estrategias de extracción
    }

    // 2. Extraer bloques markdown ```json ... ``` o ``` ... ```
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1].trim());
        if (parsed && typeof parsed === 'object') {
          console.log('[AI] JSON válido: true');
          return { isValid: true, data: parsed, error: null };
        }
      } catch (e) {
        // Continuar
      }
    }

    // 3. Extraer contenido entre las llaves exteriores { ... }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = text.substring(firstBrace, lastBrace + 1);
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === 'object') {
          console.log('[AI] JSON válido: true');
          return { isValid: true, data: parsed, error: null };
        }
      } catch (e) {
        // Falló parse
      }
    }

    console.log('[AI] JSON válido: false');
    return {
      isValid: false,
      data: null,
      error: 'La respuesta devuelta por Ollama no contiene una estructura JSON válida.',
      rawText: text.slice(0, 1000)
    };
  }

  /**
   * Construye un metamodelo canónico completo y válido a partir de las reglas deterministas,
   * garantizando que el análisis NO dependa de la disponibilidad o éxito de la IA.
   * @param {Object} extractionData
   * @param {string} [note='Análisis determinista por reglas']
   * @returns {Object} Metamodelo canónico de ICASE
   */
  buildDeterministicMetamodel(extractionData, note = 'Extracción determinista sin IA') {
    const docName = extractionData.document?.name || extractionData.fileName || 'Sistema';
    const projectName = docName.replace(/\.pdf$/i, '').replace(/[_\-]+/g, ' ');

    const rawObj = extractionData.contextSections?.objetivos ||
                   extractionData.contextSections?.problemPrincipal ||
                   extractionData.contextSections?.alcance ||
                   '';
    const projectDescription = typeof rawObj === 'string' && rawObj.trim()
      ? rawObj.trim()
      : `Sistema estructurado a partir del documento ${docName}.`;

    // 1. Actores (source: 'pdf')
    const rawActors = extractionData.actors || extractionData.ruleActors || [];
    const actors = rawActors.length > 0
      ? rawActors.map((a, idx) => ({
          id: a.id || `ACT-${String(idx + 1).padStart(2, '0')}`,
          name: a.name.trim(),
          description: a.description ? a.description.trim() : `Rol ${a.name}`,
          source: 'pdf'
        }))
      : [
          {
            id: 'ACT-01',
            name: 'Usuario General',
            description: 'Usuario principal del sistema',
            source: 'pdf'
          }
        ];

    const defaultActorId = actors[0].id;

    // 2. Requisitos Funcionales y No Funcionales (source: 'pdf')
    const reqs = [];
    const rfList = extractionData.functionalRequirements ||
                   extractionData.ruleRequirements?.filter(r => r.type === 'FUNCTIONAL') ||
                   [];
    for (const rf of rfList) {
      const code = (rf.code || rf.id || 'RF-01').toUpperCase().trim();
      reqs.push({
        id: code,
        code,
        name: (rf.name || rf.text || 'Requisito').trim(),
        description: (rf.description || rf.name || rf.text || '').trim(),
        type: 'FUNCTIONAL',
        priority: rf.priority || 'HIGH',
        actorIds: [defaultActorId],
        dependencies: rf.dependencies || [],
        source: 'pdf',
        aiAnalysis: {
          ambiguities: [],
          inconsistencies: [],
          note
        }
      });
    }

    const rnfList = extractionData.nonFunctionalRequirements ||
                    extractionData.ruleRequirements?.filter(r => r.type === 'NON_FUNCTIONAL') ||
                    [];
    for (const rnf of rnfList) {
      const code = (rnf.code || rnf.id || 'RNF-01').toUpperCase().trim();
      reqs.push({
        id: code,
        code,
        name: (rnf.name || rnf.text || 'Requisito no funcional').trim(),
        description: (rnf.description || rnf.name || rnf.text || '').trim(),
        type: 'NON_FUNCTIONAL',
        priority: rnf.priority || 'MEDIUM',
        actorIds: [],
        dependencies: [],
        source: 'pdf',
        aiAnalysis: {
          ambiguities: [],
          inconsistencies: [],
          note
        }
      });
    }

    // 3. Entidades (source: 'pdf')
    const rawEntities = extractionData.entities || [];
    const entities = rawEntities.length > 0
      ? rawEntities.map((e, idx) => ({
          id: e.id || `ENT-${String(idx + 1).padStart(2, '0')}`,
          name: e.name.trim(),
          description: e.description ? e.description.trim() : `Entidad ${e.name}`,
          attributes: Array.isArray(e.attributes) && e.attributes.length > 0
            ? e.attributes
            : [
                { name: 'id', type: 'String', isPk: true },
                { name: 'nombre', type: 'String', isPk: false },
                { name: 'fechaCreacion', type: 'DateTime', isPk: false }
              ],
          source: 'pdf'
        }))
      : [
          {
            id: 'ENT-01',
            name: 'Usuario',
            description: 'Entidad de usuario del sistema',
            attributes: [
              { name: 'id', type: 'String', isPk: true },
              { name: 'nombre', type: 'String', isPk: false }
            ],
            source: 'pdf'
          }
        ];

    // 4. Relaciones básicas entre entidades detectadas
    const relationships = [];
    if (entities.length > 1) {
      for (let i = 0; i < entities.length - 1; i++) {
        relationships.push({
          id: `REL-${String(i + 1).padStart(2, '0')}`,
          source: entities[i].name,
          target: entities[i + 1].name,
          cardinality: '1:N',
          description: `Relación funcional entre ${entities[i].name} y ${entities[i + 1].name}`
        });
      }
    }

    // 5. Pantallas básicas por actor / entidad
    const screens = [
      {
        id: 'SCR-01',
        name: 'Inicio / Tablero',
        route: '/dashboard',
        purpose: 'Panel principal del sistema',
        description: 'Visualización general de actividades y métricas',
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

    // 6. Navegación
    const navigation = [];
    if (screens.length > 1) {
      navigation.push({
        from: screens[0].name,
        to: screens[1].name,
        action: 'Navegar a gestión'
      });
    }

    // 7. Arquitectura
    const arch = extractionData.architecture || {};
    const architecture = {
      style: arch.style || 'Arquitectura Web Modular Cliente-Servidor',
      frontend: arch.frontend || 'React',
      backend: arch.backend || 'Node.js Express',
      database: arch.database || 'PostgreSQL',
      connections: arch.connections || ['React -> Node.js Express (API REST)', 'Node.js Express -> PostgreSQL'],
      components: arch.components || [
        { name: 'Portal Web', layer: 'Presentation', type: 'React' },
        { name: 'API REST', layer: 'Business', type: 'Node.js Express' },
        { name: 'Base de Datos', layer: 'Data', type: 'PostgreSQL' }
      ],
      source: 'pdf'
    };

    return {
      project: {
        name: projectName,
        description: projectDescription
      },
      actors,
      requirements: reqs,
      entities,
      relationships,
      screens,
      navigation,
      architecture,
      documentAnalysis: {
        sourceFile: docName,
        pageCount: extractionData.document?.pageCount || extractionData.pageCount || 1,
        totalRequirements: reqs.length,
        ruleRequirementsCount: reqs.length,
        aiRequirementsCount: 0,
        totalActors: actors.length,
        businessRulesCount: (extractionData.businessRules || []).length,
        source: 'pdf',
        aiAnalysisStatus: note,
        confidence: 'high'
      }
    };
  }

  /**
   * Ejecuta el análisis estructurado del documento.
   * Utiliza el contexto reducido, llama a Ollama, normaliza la respuesta,
   * y en caso de que Ollama no esté disponible o responda con error/formato inválido,
   * aplica el fallback determinista para que el flujo SIEMPRE continúe y cumpla la estructura.
   * @param {Object} extractionData - Estructura intermedia de extracción
   * @param {string} [providerOverride]
   * @returns {Promise<Object>} Metamodelo estructurado canónico
   */
  async analyzeWithAI(extractionData, providerOverride) {
    const analysisOrchestrator = require('../analysis/analysisOrchestrator');
    const docName = extractionData.document?.name || extractionData.fileName || 'documento.pdf';
    const providerName = providerOverride || env.AI_PROVIDER || 'mock';

    console.log(`[DocumentAnalyzer] Ejecutando pipeline híbrido para '${docName}' con proveedor: [${providerName}]`);

    try {
      const orchestratorResult = await analysisOrchestrator.process(extractionData, docName, { providerOverride: providerName });
      const validation = validateAIResponse(orchestratorResult);
      if (!validation.isValid) {
        console.warn('[DocumentAnalyzer] Validación canónica no superada:', validation.error, 'Aplicando fallback.');
        return this.buildDeterministicMetamodel(extractionData, `Validación: ${validation.error}`);
      }
      return orchestratorResult;
    } catch (err) {
      console.warn(`[DocumentAnalyzer] Error en orchestrator (${err.message}). Activando fallback determinista.`);
      return this.buildDeterministicMetamodel(extractionData, `Error: ${err.message}`);
    }
  }

  /**
   * Fusiona los requisitos detectados determinísticamente (source: 'pdf')
   * con las inferencias y análisis de requisitos realizados por la IA (source: 'ai').
   * @param {Object} aiData - Salida parseada de Ollama
   * @param {Object} extractionData - Estructura intermedia de extracción
   * @returns {Object} Metamodelo canónico de ICASE
   */
  mergeAndEnrich(aiData, extractionData) {
    const baseModel = this.buildDeterministicMetamodel(extractionData, 'Completado con análisis IA');

    // 1. Actores: Mantener actores por reglas (source: 'pdf') y agregar actores de IA no duplicados
    const mergedActors = [...baseModel.actors];
    const seenActorNames = new Set(mergedActors.map(a => a.name.toLowerCase().trim()));

    const aiActors = aiData.actors || [];
    for (const actor of aiActors) {
      if (actor && actor.name) {
        const normName = actor.name.toLowerCase().trim();
        if (!seenActorNames.has(normName)) {
          seenActorNames.add(normName);
          mergedActors.push({
            id: actor.id || `ACT-${String(mergedActors.length + 1).padStart(2, '0')}`,
            name: actor.name.trim(),
            description: actor.description ? actor.description.trim() : `Rol ${actor.name}`,
            source: 'ai'
          });
        }
      }
    }

    const availableActorIds = new Set(mergedActors.map(a => a.id));
    const defaultActorId = mergedActors[0]?.id || 'ACT-01';

    // 2. Requisitos: Enriquecer requisitos deterministas con ambigüedades, inconsistencias y dependencias de la IA
    const aiReqList = [
      ...(aiData.functionalRequirements || []),
      ...(aiData.nonFunctionalRequirements || []),
      ...(aiData.requirements || [])
    ];

    const aiReqsByCode = new Map();
    for (const r of aiReqList) {
      const code = (r.id || r.code || '').toUpperCase().trim();
      if (code) {
        aiReqsByCode.set(code, r);
      }
    }

    const mergedRequirements = baseModel.requirements.map(req => {
      const aiReq = aiReqsByCode.get(req.code);
      if (aiReq) {
        const ambiguities = Array.isArray(aiReq.ambiguities) ? aiReq.ambiguities.filter(Boolean) : [];
        const inconsistencies = Array.isArray(aiReq.inconsistencies) ? aiReq.inconsistencies.filter(Boolean) : [];
        const actorIds = Array.isArray(aiReq.actors)
          ? aiReq.actors.filter(id => availableActorIds.has(id))
          : (Array.isArray(aiReq.actorIds) ? aiReq.actorIds.filter(id => availableActorIds.has(id)) : req.actorIds);

        return {
          ...req,
          priority: aiReq.priority || req.priority,
          actorIds: actorIds.length > 0 ? actorIds : [defaultActorId],
          dependencies: Array.isArray(aiReq.dependencies) ? aiReq.dependencies : req.dependencies,
          aiAnalysis: {
            ambiguities,
            inconsistencies,
            analyzedBy: 'llama3'
          }
        };
      }
      return req;
    });

    // Agregar posibles requisitos descubiertos exclusivamente por la IA
    for (const [code, aiReq] of aiReqsByCode.entries()) {
      if (!mergedRequirements.some(r => r.code === code)) {
        mergedRequirements.push({
          id: code,
          code,
          name: (aiReq.name || 'Requisito inferido').trim(),
          description: (aiReq.description || aiReq.name || '').trim(),
          type: code.startsWith('RNF') ? 'NON_FUNCTIONAL' : 'FUNCTIONAL',
          priority: aiReq.priority || 'MEDIUM',
          actorIds: [defaultActorId],
          dependencies: Array.isArray(aiReq.dependencies) ? aiReq.dependencies : [],
          source: 'ai',
          aiAnalysis: {
            ambiguities: aiReq.ambiguities || [],
            inconsistencies: aiReq.inconsistencies || [],
            analyzedBy: 'llama3'
          }
        });
      }
    }

    return {
      project: {
        name: aiData.projectName || baseModel.project.name,
        description: aiData.objective || baseModel.project.description
      },
      actors: mergedActors,
      requirements: mergedRequirements,
      entities: baseModel.entities,
      relationships: baseModel.relationships,
      screens: baseModel.screens,
      navigation: baseModel.navigation,
      architecture: baseModel.architecture,
      documentAnalysis: {
        ...baseModel.documentAnalysis,
        aiRequirementsCount: mergedRequirements.filter(r => r.source === 'ai').length,
        aiAnalysisStatus: 'completado_con_exito'
      }
    };
  }

  // Alias para mantener compatibilidad con DocumentController y pruebas existentes
  buildAnalysisInput(extractionData) {
    return extractionData;
  }

  mergeAndDeduplicate(aiResult, input) {
    return this.mergeAndEnrich(aiResult, input);
  }
}

module.exports = new DocumentAnalyzer();
