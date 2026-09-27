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
    const rawResult = await provider.analyzeProject({ projectId, name: project.name, description: finalDescription, context: input.context || {} });
    const validation = validateAIResponse(rawResult);
    if (!validation.isValid) throw Object.assign(new Error(validation.error || 'Respuesta IA inválida'), { statusCode: 422 });

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
    // Legacy imports now enter the same review queue and never overwrite official models.
    const quality = require('../analysis/requirementQualityService');
    await require('../engineering/domain').transaction(async tx => {
      for (const req of rawResult.requirements || []) {
        const statement = req.description || req.name;
        const duplicate = await tx.requirementCandidate.findFirst({ where: { projectId, statement } });
        if (duplicate) continue;
        const type = ['NO_FUNCIONAL', 'NON_FUNCTIONAL'].includes(req.type) ? 'NON_FUNCTIONAL' : 'FUNCTIONAL';
        await tx.requirementCandidate.create({ data: {
          projectId, temporaryCode: req.code || 'CANDIDATE', title: req.name, statement, type,
          priority: ['HIGH', 'ALTA'].includes(req.priority) ? 'HIGH' : ['LOW', 'BAJA'].includes(req.priority) ? 'LOW' : 'MEDIUM',
          status: 'PENDING_REVIEW', origin: 'INFERRED',
          qualityReport: quality.evaluate({ title: req.name, statement, type }),
          evidence: { origin: 'legacy-analysis', reviewRequired: true }
        } });
      }
    });

    return true;
  }
}

module.exports = {
  AIService: new AIService(),
  createAIProvider
};
