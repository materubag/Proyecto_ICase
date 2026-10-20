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
      return new MockAIProvider();
    default:
      throw new Error(`Proveedor de IA desconocido: ${providerName}`);
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
    const documents = (project.sources || []).filter(s => s.type==='PDF' && s.currentVersion?.extractedText);
    if (!documents.length) throw Object.assign(new Error('Carga una fuente PDF antes de analizar el proyecto.'), { statusCode: 415, code:'PDF_SOURCE_REQUIRED' });
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
      additionalCandidates: identity.consolidate(results.flatMap(r => r.additionalCandidates || [])),
      metrics: { ...results.at(-1).metrics, requestsUsed: results.reduce((n,r) => n + r.metrics.requestsUsed, 0),
        reusedSources: results.filter(r => r.metrics.reusedSource).length,
        usage: results.flatMap(r => r.metrics.usage || []) } };
    result.documentAnalysis = { ...result.documentAnalysis, totalRequirements: requirements.length, totalActors: actors.length };
    require('../analysis/catalogIntegrity').analyze(result);
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
    if (rawResult.extractionVersion) return this.persistDocumentExtraction(projectId, rawResult);
    const text = rawResult.rawText || rawResult.extractedText;
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw Object.assign(new Error('La importación antigua requiere el texto fuente para conservar evidencia. Vuelve a analizar el documento.'), { statusCode: 422, code: 'SOURCE_EVIDENCE_REQUIRED' });
    }
    const result = await require('../analysis/documentExtraction').extract(text, { mode: 'local', fileName: rawResult.project?.name });
    return this.persistDocumentExtraction(projectId, result);
  }
}

module.exports = { AIService: new AIService(), createAIProvider };
