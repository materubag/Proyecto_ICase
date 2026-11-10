const AIProvider = require('./AIProvider');
const env = require('../../config/env');
class HybridPipelineRouter extends AIProvider {
  constructor() {
    super();
    this.fastProvider = new (require('./OpenAIProvider'))();
    this.reasoningProvider = new (require('./AnthropicProvider'))();
  }
  modelFor(task) { return task === 'review' ? env.DOCUMENT_REVIEW_MODEL : env.DOCUMENT_PREPARATION_MODEL; }
  async documentTask(task, payload, { system, images = [] } = {}) {
    const model = this.modelFor(task);
    if (!model) throw new Error(`Configure ${task === 'review' ? 'DOCUMENT_REVIEW_MODEL (Sonnet 5.5)' : 'DOCUMENT_PREPARATION_MODEL (Luna)'} con el ID disponible en su cuenta`);
    if (task === 'review') return this.reasoningProvider.executePrompt({ system, prompt: payload, model, maxTokens: 8192, images });
    return this.fastProvider.executePrompt({ system, prompt: payload, model, maxTokens: 8192 });
  }
  async extractDocumentBatch(input, options = {}) {
    return this.fastProvider.executePrompt({ system: options.prompt || require('../analysis/extractionContract').prompt,
      prompt: input, model: options.model || this.modelFor('prepare'), maxTokens: options.max_tokens || 8192 });
  }
  async analyzeProject(input) { return this.fastProvider.analyzeProject(input); }
  async analyze(description, context = {}) { return this.analyzeProject({ description, context }); }
  async executePhase(phase, payload, options = {}) {
    if (['context', 'actors', 'requirements'].includes(phase)) return this.documentTask(options.task || 'prepare', { stage: phase, ...payload }, options);
    throw new Error('La nueva generación de código por etapas queda fuera del flujo documental');
  }
}
module.exports = HybridPipelineRouter;
