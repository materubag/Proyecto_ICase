const prisma = require('../../config/prisma');
const env = require('../../config/env');
const MockAIProvider = require('./MockAIProvider');
const GeminiProvider = require('./GeminiProvider');
const OllamaProvider = require('./OllamaProvider');
const OpenAIProvider = require('./OpenAIProvider');
const N8nProvider = require('./N8nProvider');
const { validateAIResponse } = require('./ai.contract.validator');

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

    // 1. Obtener proyecto y verificar existencia
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) {
      const err = new Error(`Proyecto con ID ${projectId} no encontrado`);
      err.statusCode = 404;
      throw err;
    }

    // 2. Validar que tenga descripción
    const finalDescription = (description || project.systemDescription || project.description || '').trim();
    if (!finalDescription) {
      const err = new Error('El proyecto debe contar con una descripción general para ser analizado.');
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

    // 3. Crear el proveedor seleccionado
    let provider = createAIProvider(providerOverride || env.AI_PROVIDER);
    console.log(`[AIService] Ejecutando análisis para proyecto '${project.name}' utilizando proveedor: [${provider.constructor.name}]`);

    // 4. Invocar analyzeProject(input) con fallback resiliente a MockAIProvider si el proveedor externo falla
    let rawResult;
    try {
      rawResult = await provider.analyzeProject({
        projectId,
        name: project.name,
        description: finalDescription,
        context: input.context || {}
      });
    } catch (providerErr) {
      if (provider.constructor.name !== 'MockAIProvider') {
        console.warn(`[AIService] Proveedor ${provider.constructor.name} no pudo completar el análisis (${providerErr.message}). Aplicando fallback automático a MockAIProvider.`);
        const fallback = new MockAIProvider();
        rawResult = await fallback.analyzeProject({
          projectId,
          name: project.name,
          description: finalDescription,
          context: input.context || {}
        });
      } else {
        throw providerErr;
      }
    }

    // 5. Validar contrato de respuesta estricto
    let validation = validateAIResponse(rawResult);
    if (!validation.isValid && provider.constructor.name !== 'MockAIProvider') {
      console.warn('[AIService] Respuesta de proveedor externo no cumplió contrato. Fallback a MockAIProvider.');
      const fallback = new MockAIProvider();
      rawResult = await fallback.analyzeProject({
        projectId,
        name: project.name,
        description: finalDescription,
        context: input.context || {}
      });
      validation = validateAIResponse(rawResult);
    }

    if (!validation.isValid) {
      console.error('[AIService] Error de validación de contrato:', validation.error);
      const err = new Error(validation.error || 'La respuesta del proveedor de IA no cumple el contrato esperado.');
      err.statusCode = 422;
      throw err;
    }

    // 6. Persistencia transaccional en PostgreSQL (reemplazo limpio sin duplicados)
    await this.persistProjectAnalysis(projectId, rawResult);

    // 7. Devolver el JSON estructurado canónico
    return {
      project: rawResult.project,
      actors: rawResult.actors,
      requirements: rawResult.requirements,
      entities: rawResult.entities,
      relationships: rawResult.relationships,
      screens: rawResult.screens,
      navigation: rawResult.navigation,
      architecture: rawResult.architecture
    };
  }

  /**
   * Persiste transaccionalmente un análisis validado en PostgreSQL para un proyecto.
   * @param {string} projectId
   * @param {Object} rawResult
   */
  async persistProjectAnalysis(projectId, rawResult) {
    await prisma.$transaction(async (tx) => {
      // Eliminar resultados anteriores generados
      await tx.requirement.deleteMany({ where: { projectId } });
      await tx.actor.deleteMany({ where: { projectId } });
      await tx.entityRelationship.deleteMany({ where: { projectId } });
      await tx.entity.deleteMany({ where: { projectId } });
      await tx.screen.deleteMany({ where: { projectId } });
      await tx.navigationNode.deleteMany({ where: { projectId } });
      await tx.architecture.deleteMany({ where: { projectId } });

function cleanUtf8(str) {
  if (!str || typeof str !== 'string') return str;
  return str.normalize('NFC').trim();
}

      // Guardar Actores
      if (rawResult.actors && rawResult.actors.length > 0) {
        for (const actor of rawResult.actors) {
          await tx.actor.create({
            data: {
              projectId,
              codeId: actor.id || null,
              name: cleanUtf8(actor.name),
              description: actor.description ? cleanUtf8(actor.description) : null
            }
          });
        }
      }

      // Guardar Requisitos
      if (rawResult.requirements && rawResult.requirements.length > 0) {
        for (const req of rawResult.requirements) {
          await tx.requirement.create({
            data: {
              projectId,
              code: req.code.trim().toUpperCase(),
              name: cleanUtf8(req.name),
              description: req.description ? cleanUtf8(req.description) : '',
              type: req.type === 'NO_FUNCIONAL' ? 'NON_FUNCTIONAL' : 'FUNCTIONAL',
              priority: req.priority === 'ALTA' ? 'HIGH' : req.priority === 'BAJA' ? 'LOW' : 'MEDIUM',
              status: 'APPROVED',
              actorIds: req.actorIds || [],
              dependencies: req.dependencies || []
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
              purpose: scr.purpose ? cleanUtf8(scr.purpose) : null
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

      // Guardar Arquitectura con Componentes
      if (rawResult.architecture) {
        const arch = rawResult.architecture;
        const createdArch = await tx.architecture.create({
          data: {
            projectId,
            style: arch.style || 'Clean Architecture',
            frontend: arch.frontend || 'React',
            backend: arch.backend || 'Node.js Express',
            database: arch.database || 'PostgreSQL',
            connections: arch.connections || []
          }
        });

        if (arch.components && Array.isArray(arch.components)) {
          for (const comp of arch.components) {
            await tx.architectureComponent.create({
              data: {
                architectureId: createdArch.id,
                name: comp.name,
                layer: comp.layer || 'Application',
                type: comp.type || 'Component'
              }
            });
          }
        }
      }
    });

    return true;
  }
}

module.exports = {
  AIService: new AIService(),
  createAIProvider
};
