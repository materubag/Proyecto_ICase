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
    const { projectId, description, providerOverride } = input;

    // 1. Obtener proyecto y verificar existencia con sus fuentes
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        sources: {
          include: { currentVersion: true }
        }
      }
    });

    if (!project) {
      const err = new Error(`Proyecto con ID ${projectId} no encontrado`);
      err.statusCode = 404;
      throw err;
    }

    // 1.1 Si el proyecto tiene fuentes documentales (PDFs, audios), ejecutar el pipeline exhaustivo
    const analysisPipeline = require('../analysis/analysisPipeline');
    const textNormalizer = require('../document/textNormalizer');
    const sectionDetector = require('../document/SectionDetector');
    const requirementDetector = require('../analysis/requirementDetector');
    const actorDetector = require('../analysis/actorDetector');
    const entityDetector = require('../analysis/entityDetector');
    const technologyDetector = require('../analysis/technologyDetector');
    const architectureDetector = require('../analysis/architectureDetector');
    const screenDetector = require('../analysis/screenDetector');
    const processDetector = require('../analysis/processDetector');

    let sourcesTextCombined = '';
    if (project.sources && project.sources.length > 0) {
      console.log(`[AIService] Proyecto cuenta con ${project.sources.length} fuente(s). Ejecutando pipeline exhaustivo de análisis...`);
      for (const source of project.sources) {
        try {
          await analysisPipeline.run({ sourceId: source.id, force: true });
          const ver = source.currentVersion || (source.versions && source.versions[0]);
          if (ver?.extractedText) {
            sourcesTextCombined += '\n' + ver.extractedText;
          }
        } catch (sErr) {
          console.warn(`[AIService] Error en pipeline para fuente ${source.name}:`, sErr.message);
        }
      }
    }

    // 2. Validar que tenga descripción o fuentes
    const baseDesc = (description || project.systemDescription || project.description || '').trim();
    const finalDescription = baseDesc || (sourcesTextCombined.slice(0, 500) ? `Sistema basado en documentos analizados (${project.sources?.map(s => s.name).join(', ')})` : '');
    
    if (!finalDescription && !sourcesTextCombined) {
      const err = new Error('El proyecto debe contar con una descripción general o documentos cargados para ser analizado.');
      err.statusCode = 400;
      throw err;
    }

    // Actualizar systemDescription en el proyecto si ha variado
    if (description && description.trim() !== project.systemDescription) {
      await prisma.project.update({
        where: { id: projectId },
        data: {
          description: description.trim(),
          systemDescription: description.trim()
        }
      });
    }

    // 2.1 Extraer información determinista exhaustiva del texto de fuentes y de la descripción
    const combinedAnalysisText = (sourcesTextCombined + '\n' + finalDescription).trim();
    const norm = textNormalizer.normalize(combinedAnalysisText);
    const sections = sectionDetector.detectSections(norm.rawText);
    const detReqs = requirementDetector.detect(norm.rawText, sections);
    const detActors = actorDetector.detect(norm.rawText, sections);
    const detEntities = entityDetector.detect(norm.rawText, sections);
    const detTech = technologyDetector.detect(norm.rawText);
    const detArch = architectureDetector.detect(norm.rawText, detTech);
    const detScreens = screenDetector.detect(norm.rawText, sections);
    const detProcesses = processDetector.detect(norm.rawText, sections);

    // 3. Crear el proveedor seleccionado
    let provider = createAIProvider(providerOverride || env.AI_PROVIDER);
    console.log(`[AIService] Ejecutando análisis para proyecto '${project.name}' utilizando proveedor: [${provider.constructor.name}]`);

    // 4. Invocar analyzeProject(input) con contexto sintetizado
    let rawResult = null;
    try {
      rawResult = await provider.analyzeProject({
        projectId,
        name: project.name,
        description: finalDescription.slice(0, 2000),
        context: {
          ...input.context,
          knownRequirementsCount: (detReqs.functionalRequirements?.length || 0) + (detReqs.nonFunctionalRequirements?.length || 0),
          knownActors: detActors.map(a => a.name)
        }
      });
    } catch (aiErr) {
      console.warn(`[AIService] Proveedor IA no disponible (${aiErr.message}). Utilizando extracción determinista canónica.`);
      rawResult = {
        project: { name: project.name, description: finalDescription },
        requirements: [],
        actors: [],
        entities: [],
        screens: [],
        architecture: {}
      };
    }

    // 5. Normalizar datos y enriquecer con las extracciones deterministas de las fuentes
    const normalizedResult = normalizeAIResponse(rawResult || {});

    // Fusionar requisitos deterministas prioritarios (RF-XX, RNF-XX) sin duplicar
    const existingReqCodes = new Set((normalizedResult.requirements || []).map(r => r.code?.toUpperCase()));
    for (const rf of (detReqs.functionalRequirements || [])) {
      const code = (rf.code || rf.id || '').toUpperCase();
      if (code && !existingReqCodes.has(code)) {
        existingReqCodes.add(code);
        normalizedResult.requirements.push({
          id: code,
          code,
          name: rf.name || rf.text || 'Requisito funcional',
          description: rf.description || rf.name || '',
          type: 'FUNCTIONAL',
          priority: rf.priority || 'HIGH',
          actorIds: [],
          source: 'pdf'
        });
      }
    }
    for (const rnf of (detReqs.nonFunctionalRequirements || [])) {
      const code = (rnf.code || rnf.id || '').toUpperCase();
      if (code && !existingReqCodes.has(code)) {
        existingReqCodes.add(code);
        normalizedResult.requirements.push({
          id: code,
          code,
          name: rnf.name || rnf.text || 'Requisito no funcional',
          description: rnf.description || rnf.name || '',
          type: 'NON_FUNCTIONAL',
          priority: rnf.priority || 'MEDIUM',
          actorIds: [],
          source: 'pdf'
        });
      }
    }

    // Fusionar actores deterministas
    const existingActorNames = new Set((normalizedResult.actors || []).map(a => a.name?.toLowerCase().trim()));
    for (const act of (detActors || [])) {
      const aName = act.name?.trim();
      if (aName && !existingActorNames.has(aName.toLowerCase())) {
        existingActorNames.add(aName.toLowerCase());
        normalizedResult.actors.push({
          name: aName,
          description: act.description || `Rol ${aName} identificado en la documentación`,
          source: 'pdf'
        });
      }
    }

    // Fusionar entidades deterministas
    const existingEntityNames = new Set((normalizedResult.entities || []).map(e => e.name?.toLowerCase().trim()));
    for (const ent of (detEntities.entities || [])) {
      const eName = ent.name?.trim();
      if (eName && !existingEntityNames.has(eName.toLowerCase())) {
        existingEntityNames.add(eName.toLowerCase());
        normalizedResult.entities.push({
          name: eName,
          description: ent.description || `Entidad ${eName}`,
          attributes: ent.attributes || [{ name: 'id', type: 'String', isPk: true }],
          source: 'pdf'
        });
      }
    }

    // Fusionar pantallas deterministas
    const existingScreenNames = new Set((normalizedResult.screens || []).map(s => s.name?.toLowerCase().trim()));
    for (const scr of (detScreens || [])) {
      const sName = scr.name?.trim();
      if (sName && !existingScreenNames.has(sName.toLowerCase())) {
        existingScreenNames.add(sName.toLowerCase());
        normalizedResult.screens.push({
          name: sName,
          route: scr.route || `/${sName.toLowerCase().replace(/\s+/g, '-')}`,
          purpose: scr.description || `Vista de ${sName}`,
          components: scr.components || []
        });
      }
    }

    // Re-indexar y limpiar IDs de actores para garantizar unicidad estricta
    normalizedResult.actors = normalizedResult.actors.map((act, idx) => ({
      ...act,
      id: `ACT-${String(idx + 1).padStart(2, '0')}`
    }));
    const validActorIds = new Set(normalizedResult.actors.map(a => a.id));
    const defaultActorId = normalizedResult.actors[0]?.id || 'ACT-01';

    // Asegurar que cada requisito tenga actorIds válidos
    normalizedResult.requirements = normalizedResult.requirements.map(req => {
      const validAssigned = Array.isArray(req.actorIds)
        ? req.actorIds.filter(id => validActorIds.has(id))
        : [];
      return {
        ...req,
        actorIds: validAssigned.length > 0 ? validAssigned : [defaultActorId]
      };
    });

    // Re-indexar entidades
    normalizedResult.entities = normalizedResult.entities.map((ent, idx) => ({
      ...ent,
      id: `ENT-${String(idx + 1).padStart(2, '0')}`
    }));

    // Re-indexar pantallas
    normalizedResult.screens = normalizedResult.screens.map((scr, idx) => ({
      ...scr,
      id: `SCR-${String(idx + 1).padStart(2, '0')}`
    }));

    // Enriquecer arquitectura
    if (detArch && detArch.name) {
      normalizedResult.architecture = {
        style: detArch.name,
        frontend: detArch.frontend || normalizedResult.architecture?.frontend || 'React',
        backend: detArch.backend || normalizedResult.architecture?.backend || 'Node.js Express',
        database: detArch.database || normalizedResult.architecture?.database || 'PostgreSQL',
        connections: detArch.connections || ['React -> Node.js Express (API REST)', 'Node.js Express -> PostgreSQL'],
        components: detArch.components || [
          { name: 'Portal Web', layer: 'Presentation', type: 'React' },
          { name: 'API REST', layer: 'Business', type: 'Node.js Express' },
          { name: 'Base de Datos', layer: 'Data', type: 'PostgreSQL' }
        ],
        source: 'pdf'
      };
    }

    // 6. Validar contrato de respuesta estricto
    const validation = validateAIResponse(normalizedResult);
    if (!validation.isValid) {
      console.error('[AIService] Error de validación de contrato:', validation.error);
      const err = new Error(validation.error || 'La respuesta del proveedor de IA no cumple el contrato esperado.');
      err.statusCode = 422;
      throw err;
    }

    // 7. Persistencia transaccional en PostgreSQL (reemplazo limpio sin duplicados)
    await this.persistProjectAnalysis(projectId, normalizedResult);

    // 8. Devolver el JSON estructurado canónico enriquecido
    return {
      project: normalizedResult.project,
      actors: normalizedResult.actors,
      requirements: normalizedResult.requirements,
      entities: normalizedResult.entities,
      relationships: normalizedResult.relationships,
      screens: normalizedResult.screens,
      navigation: normalizedResult.navigation,
      architecture: normalizedResult.architecture
    };
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

function cleanUtf8(str) {
  if (!str || typeof str !== 'string') return str;
  return str.normalize('NFC').trim();
}

      // Guardar Actores (sin sobrescribir existentes aprobados)
      if (rawResult.actors && rawResult.actors.length > 0) {
        for (const actor of rawResult.actors) {
          const actorName = cleanUtf8(actor.name);
          const existingActor = await tx.actor.findFirst({ where: { projectId, name: actorName } });
          if (!existingActor) {
            await tx.actor.create({
              data: {
                projectId,
                codeId: actor.id || null,
                name: actorName,
                description: actor.description ? cleanUtf8(actor.description) : null
              }
            });
          }
        }
      }

      // Guardar Requisitos ISO/IEC/IEEE 29148:2018 (respetando los ya aprobados)
      if (rawResult.requirements && rawResult.requirements.length > 0) {
        for (const req of rawResult.requirements) {
          const code = req.code.trim().toUpperCase();
          const existingApproved = await tx.requirement.findFirst({ where: { projectId, code, status: 'APPROVED' } });
          if (existingApproved) {
            // No sobrescribir requisitos oficiales aprobados por el usuario
            continue;
          }

          await tx.requirement.create({
            data: {
              projectId,
              code,
              name: cleanUtf8(req.name),
              description: req.description ? cleanUtf8(req.description) : '',
              type: (req.type === 'NON_FUNCTIONAL' || req.type === 'NO_FUNCIONAL' || req.type === 'RNF' || code.startsWith('RNF'))
                ? 'NON_FUNCTIONAL'
                : 'FUNCTIONAL',
              priority: (req.priority === 'ALTA' || req.priority === 'HIGH')
                ? 'HIGH'
                : (req.priority === 'BAJA' || req.priority === 'LOW')
                  ? 'LOW'
                  : 'MEDIUM',
              status: 'PENDING',
              actorIds: req.actorIds || [],
              dependencies: req.dependencies || [],
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
