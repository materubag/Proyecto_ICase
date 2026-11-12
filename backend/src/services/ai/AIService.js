const prisma = require('../../config/prisma');
const env = require('../../config/env');
const MockAIProvider = require('./MockAIProvider');
const GeminiProvider = require('./GeminiProvider');
const OllamaProvider = require('./OllamaProvider');
const OpenAIProvider = require('./OpenAIProvider');
const AnthropicProvider = require('./AnthropicProvider');
const HybridPipelineRouter = require('./HybridPipelineRouter');
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
    case 'anthropic':
    case 'claude':
      return new AnthropicProvider();
    case 'hybrid':
    case 'hibrido':
      return new HybridPipelineRouter();
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
    if (!input.providerInstance) return require('../analysis/documentWorkflow').service().run(input.projectId, 'context', 'prepare');
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
    throw Object.assign(new Error('Importe candidatos documentales y apruebe sus versiones desde el flujo documental'), { statusCode: 409 });
  }
}
module.exports = { AIService: new AIService(), createAIProvider };
