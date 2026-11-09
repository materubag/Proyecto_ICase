/**
 * SemanticAnalyzer
 * Coordina el análisis semántico de fragmentos ambiguos utilizando la abstracción polimórfica createAIProvider().
 *
 * Principios de diseño (Fase Gemini & Multi-PDF):
 * - Cumple AI_PROVIDER (gemini | ollama | openai | mock).
 * - CERO acoplamiento a OpenAI como fallback rígido.
 * - Procesamiento en LOTES (batching), nunca una solicitud por fragmento.
 * - Respeta GEMINI_MAX_ITEMS_PER_BATCH (20) y GEMINI_MAX_INPUT_CHARS (16000).
 * - En caso de falla o 429 de IA, preserva los fragmentos como deterministas / revisión manual.
 */

const env = require('../../config/env');
const { createAIProvider } = require('../ai/AIService');

class SemanticAnalyzer {
  constructor() {
    this.ollamaProvider = new (require('../ai/OllamaProvider'))();
    this.geminiProvider = new (require('../ai/GeminiProvider'))();
    this.openAIProvider = new (require('../ai/OpenAIProvider'))();
    this.mockProvider = new (require('../ai/MockAIProvider'))();
  }

  /**
   * Obtiene la instancia activa del proveedor de IA según configuración o sobrescritura.
   */
  getProvider(providerOverride) {
    const providerName = (providerOverride || env.AI_PROVIDER || 'gemini').toLowerCase();
    if (providerName === 'gemini') return this.geminiProvider;
    if (providerName === 'ollama') return this.ollamaProvider;
    if (providerName === 'openai') return this.openAIProvider;
    if (providerName === 'mock') return this.mockProvider;
    return createAIProvider(providerName);
  }

  /**
   * Divide los fragmentos candidatos en lotes que respetan límites de elementos y de caracteres.
   * @param {Array<{ chunkText: string, metadata: any }>} candidateChunks
   * @returns {Array<Array<{ id: string, s: string, metadata: any }>>}
   */
  createBatches(candidateChunks) {
    const maxItems = env.GEMINI_MAX_ITEMS_PER_BATCH || 20;
    const maxChars = env.GEMINI_MAX_INPUT_CHARS || 16000;
    const batches = [];

    let currentBatch = [];
    let currentChars = 0;

    candidateChunks.forEach((chunk, index) => {
      const id = `a${index + 1}`;
      const text = (chunk.chunkText || '').trim().slice(0, env.AI_CHUNK_MAX_LENGTH || 350);
      const itemChars = text.length + 30; // estimación overhead JSON

      if (currentBatch.length >= maxItems || (currentChars + itemChars > maxChars && currentBatch.length > 0)) {
        batches.push(currentBatch);
        currentBatch = [];
        currentChars = 0;
      }

      currentBatch.push({ id, s: text, originalChunk: chunk.chunkText, metadata: chunk.metadata });
      currentChars += itemChars;
    });

    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * Normaliza un resultado clasificado de IA a la estructura interna estándar de ICASE.
   */
  mapClassifiedItem(item, originalItem) {
    const type = item.t || 'FUNCTIONAL';
    const statement = item.s || originalItem.s || originalItem.originalChunk;
    const confidence = typeof item.c === 'number' ? item.c : 0.85;

    if (type === 'IGNORE') return null;

    let needType = 'FUNCTION';
    if (type === 'NON_FUNCTIONAL') needType = 'QUALITY';
    else if (type === 'BUSINESS_RULE') needType = 'BUSINESS_RULE';
    else if (type === 'CONSTRAINT') needType = 'CONSTRAINT';
    else if (type === 'ACTOR') needType = 'ACTOR';
    else if (type === 'ENTITY') needType = 'DATA';

    const needs = [{
      type: needType,
      description: statement,
      evidence: originalItem.originalChunk || statement,
      confidence
    }];

    const actors = type === 'ACTOR' ? [statement] : [];
    const entities = type === 'ENTITY' ? [statement] : [];
    const businessRules = type === 'BUSINESS_RULE' ? [statement] : [];
    const constraints = type === 'CONSTRAINT' ? [statement] : [];

    return {
      needs,
      actors,
      entities,
      businessRules,
      constraints,
      technologies: [],
      platforms: 'UNKNOWN',
      sourceChunk: originalItem.originalChunk || statement,
      metadata: originalItem.metadata
    };
  }

  /**
   * Analiza fragmentos candidatos en lotes optimizados sin sobrecargar APIs.
   * @param {Array<{ chunkText: string, metadata: any }>} candidateChunks
   * @param {Object} [options]
   * @returns {Promise<{
   *   results: Array<Object>,
   *   metrics: { provider: string, totalChunks: number, batches: number, requestsUsed: number, durationMs: number }
   * }>}
   */
  async analyzeChunks(candidateChunks = [], options = {}) {
    let providerName = options.providerOverride;
    if (!providerName) {
      const strategy = options.strategy || env.AI_ANALYSIS_STRATEGY;
      if (strategy === 'ollama-only' || strategy === 'ollama-first') {
        providerName = 'ollama';
      } else if (strategy === 'gpt-only') {
        providerName = 'openai';
      } else {
        providerName = (env.AI_PROVIDER || 'gemini').toLowerCase();
      }
    }
    const startTime = Date.now();

    const metrics = {
      provider: providerName,
      strategy: options.strategy || env.AI_ANALYSIS_STRATEGY || 'batch-hybrid',
      totalChunks: candidateChunks.length,
      batches: 0,
      requestsUsed: 0,
      geminiCalls: 0,
      geminiFailures: 0,
      ollamaCalls: 0,
      ollamaFailures: 0,
      gptCalls: 0,
      gptFailures: 0,
      durationMs: 0
    };

    if (!candidateChunks || candidateChunks.length === 0) {
      metrics.durationMs = Date.now() - startTime;
      return { results: [], metrics };
    }

    const batches = this.createBatches(candidateChunks);
    metrics.batches = batches.length;

    const provider = this.getProvider(providerName);
    const results = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const itemsForAi = batch.map(b => ({ id: b.id, s: b.s }));
      let batchSuccess = false;

      // 1. Si el proveedor soporta clasificación por lotes (GeminiProvider)
      if (typeof provider.classifyAmbiguousBatches === 'function') {
        try {
          const classifications = await provider.classifyAmbiguousBatches(itemsForAi, { batchIndex: i + 1 });
          metrics.requestsUsed++;
          metrics.geminiCalls++;
          const resultMap = new Map(classifications.map(c => [c.id, c]));

          batch.forEach(original => {
            const classified = resultMap.get(original.id) || { id: original.id, t: 'FUNCTIONAL', s: original.s, c: 0.75 };
            const mapped = this.mapClassifiedItem(classified, original);
            if (mapped) results.push({ ...mapped, provider: providerName });
          });
          batchSuccess = true;
        } catch (geminiErr) {
          metrics.geminiFailures++;
          console.warn(`[SemanticAnalyzer] Proveedor ${providerName} falló en lote ${i + 1}: ${geminiErr.message}.`);
        }
      } else {
        // 2. Proveedor tradicional (Ollama / Mock / OpenAI vía analyzeProject)
        try {
          const prompt = `Analiza solo estos fragmentos. Clasifica y devuelve JSON compacto [{ "id": "...", "t": "FUNCTIONAL|NON_FUNCTIONAL|BUSINESS_RULE", "s": "...", "c": 0.8 }]:\n${JSON.stringify({ items: itemsForAi })}`;
          const rawResponse = await provider.analyzeProject({
            projectId: options.projectId || 'temp',
            name: 'Análisis de fragmentos ambiguos',
            description: JSON.stringify(itemsForAi),
            customPrompt: prompt
          });
          metrics.requestsUsed++;
          if (providerName === 'ollama') metrics.ollamaCalls++;
          else if (providerName === 'openai') metrics.gptCalls++;

          let parsed = [];
          if (Array.isArray(rawResponse)) parsed = rawResponse;
          else if (rawResponse && typeof rawResponse === 'object') {
            parsed = rawResponse.items || rawResponse.needs || rawResponse.requirements || [];
          }

          if (parsed && parsed.length > 0) {
            const resultMap = new Map(parsed.map((p, idx) => [p.id || `a${idx + 1}`, p]));
            batch.forEach(original => {
              const item = resultMap.get(original.id);
              const mapped = item
                ? this.mapClassifiedItem(item, original)
                : this.mapClassifiedItem({ id: original.id, t: 'FUNCTIONAL', s: original.s, c: 0.75 }, original);
              if (mapped) results.push({ ...mapped, provider: providerName });
            });
            batchSuccess = true;
          } else {
            if (providerName === 'ollama') metrics.ollamaFailures++;
            else if (providerName === 'openai') metrics.gptFailures++;
          }
        } catch (provErr) {
          if (providerName === 'ollama') metrics.ollamaFailures++;
          else if (providerName === 'openai') metrics.gptFailures++;
          else metrics.geminiFailures++;
          console.warn(`[SemanticAnalyzer] Proveedor ${providerName} falló en lote ${i + 1}: ${provErr.message}.`);
        }
      }

      // Si falla la IA, no inventamos candidatos adicionales para no contaminar los requisitos aprobados/deterministas
      if (!batchSuccess) {
        console.warn(`[SemanticAnalyzer] Lote ${i + 1} omitido por indisponibilidad de IA (${providerName}). Conservando exclusivamente extracciones deterministas.`);
      }
    }

    metrics.durationMs = Date.now() - startTime;
    return { results, metrics };
  }
}

module.exports = new SemanticAnalyzer();
