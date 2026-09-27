/**
 * SemanticAnalyzer
 * Coordina el análisis semántico escalonado bajo la política AI_ANALYSIS_STRATEGY:
 * - deterministic-only: Omite llamadas a IA.
 * - ollama-only: Solo invoca a Ollama local.
 * - gpt-only: Invoca directamente a OpenAI / GPT con prompts mínimos.
 * - ollama-first: Invoca a Ollama primero; si falla, responde JSON inválido o baja confianza, escala a GPT.
 */

const env = require('../../config/env');
const OllamaProvider = require('../ai/OllamaProvider');
const OpenAIProvider = require('../ai/OpenAIProvider');
const MockAIProvider = require('../ai/MockAIProvider');

class SemanticAnalyzer {
  constructor() {
    this.ollamaProvider = new OllamaProvider();
    this.openAIProvider = new OpenAIProvider();
    this.mockProvider = new MockAIProvider();
  }

  /**
   * Genera el prompt conciso para extracción de necesidades y elementos.
   * @param {string} chunkText
   * @param {string} [sourceType='PDF']
   * @returns {string}
   */
  buildPrompt(chunkText, sourceType = 'PDF') {
    return [
      `Analiza el siguiente fragmento de ${sourceType} para ingeniería de requisitos de software:`,
      `"""`,
      chunkText,
      `"""`,
      `Extrae exclusivamente en formato JSON estricto sin explicaciones adicionales:`,
      `{`,
      `  "needs": [`,
      `    { "type": "FUNCTION|QUALITY|BUSINESS_RULE|CONSTRAINT", "description": "...", "evidence": "...", "confidence": 0.0-1.0 }`,
      `  ],`,
      `  "actors": [ { "name": "...", "evidence": "..." } ],`,
      `  "entities": [ { "name": "...", "evidence": "..." } ],`,
      `  "businessRules": [ { "statement": "...", "evidence": "..." } ],`,
      `  "constraints": [ { "statement": "...", "evidence": "..." } ],`,
      `  "platforms": "WEB|MOBILE|BOTH|UNKNOWN",`,
      `  "technologies": [ "..." ]`,
      `}`
    ].join('\n');
  }

  /**
   * Extrae de forma segura un JSON de la respuesta de texto (por si viene envuelta en ```json).
   * @param {string|Object} rawResponse
   * @returns {Object|null}
   */
  extractJsonSafely(rawResponse) {
    if (!rawResponse) return null;
    if (typeof rawResponse === 'object') return rawResponse;

    try {
      return JSON.parse(rawResponse);
    } catch (e1) {
      // Intentar extraer bloque ```json ... ```
      const match = rawResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        try {
          return JSON.parse(match[1]);
        } catch (e2) {}
      }
      // Intentar extraer primer bloque entre { ... }
      const braceMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        try {
          return JSON.parse(braceMatch[0]);
        } catch (e3) {}
      }
    }
    return null;
  }

  /**
   * Normaliza la respuesta de IA al contrato estándar común.
   * @param {Object} raw
   * @param {string} originalChunk
   * @returns {Object}
   */
  normalizeResponse(raw, originalChunk) {
    const data = raw || {};
    const needs = Array.isArray(data.needs) ? data.needs.map(n => ({
      type: ['FUNCTION', 'QUALITY', 'BUSINESS_RULE', 'CONSTRAINT', 'ACTOR', 'DATA', 'PLATFORM', 'TECHNOLOGY', 'ARCHITECTURE', 'UNKNOWN'].includes(n.type)
        ? n.type
        : 'FUNCTION',
      description: String(n.description || n.need || n.text || '').trim(),
      evidence: String(n.evidence || originalChunk.slice(0, 150)).trim(),
      confidence: typeof n.confidence === 'number' ? Math.min(1, Math.max(0, n.confidence)) : 0.85
    })).filter(n => n.description) : [];

    const actors = Array.isArray(data.actors) ? data.actors.map(a => typeof a === 'string' ? a.trim() : String(a?.name || '').trim()).filter(Boolean) : [];
    const entities = Array.isArray(data.entities) ? data.entities.map(e => typeof e === 'string' ? e.trim() : String(e?.name || '').trim()).filter(Boolean) : [];
    const businessRules = Array.isArray(data.businessRules) ? data.businessRules.map(r => typeof r === 'string' ? r.trim() : String(r?.statement || r?.rule || '').trim()).filter(Boolean) : [];
    const constraints = Array.isArray(data.constraints) ? data.constraints.map(c => typeof c === 'string' ? c.trim() : String(c?.statement || c?.constraint || '').trim()).filter(Boolean) : [];
    const technologies = Array.isArray(data.technologies) ? data.technologies.map(t => String(t).trim()).filter(Boolean) : [];
    const platform = ['WEB', 'MOBILE', 'BOTH', 'UNKNOWN'].includes(data.platforms) ? data.platforms : 'UNKNOWN';

    return {
      needs,
      actors,
      entities,
      businessRules,
      constraints,
      technologies,
      platforms: platform
    };
  }

  /**
   * Ejecuta el análisis semántico sobre los fragmentos candidatos seleccionados.
   * @param {Array<{ chunkText: string, metadata: any }>} candidateChunks
   * @param {Object} options
   * @param {string} [options.sourceType='PDF']
   * @param {string} [options.strategy] - Sobrescritura de AI_ANALYSIS_STRATEGY
   * @returns {Promise<{
   *   results: Array<Object>,
   *   metrics: { ollamaCalls: number, gptCalls: number, ollamaFailures: number, gptFailures: number, durationMs: number }
   * }>}
   */
  async analyzeChunks(candidateChunks = [], options = {}) {
    const strategy = options.strategy || env.AI_ANALYSIS_STRATEGY || 'ollama-first';
    const confidenceThreshold = parseFloat(env.AI_FALLBACK_CONFIDENCE_THRESHOLD || '0.65');
    const sourceType = options.sourceType || 'PDF';

    const metrics = {
      strategy,
      ollamaCalls: 0,
      gptCalls: 0,
      ollamaFailures: 0,
      gptFailures: 0,
      durationMs: 0
    };

    const startTime = Date.now();
    const results = [];

    if (strategy === 'deterministic-only' || candidateChunks.length === 0) {
      metrics.durationMs = Date.now() - startTime;
      return { results, metrics };
    }

    for (const chunk of candidateChunks) {
      const prompt = this.buildPrompt(chunk.chunkText, sourceType);
      let parsed = null;
      let usedProvider = null;

      // 1. Intentar con Ollama si la estrategia lo contempla
      if (strategy === 'ollama-first' || strategy === 'ollama-only') {
        metrics.ollamaCalls++;
        try {
          const rawOllama = await this.ollamaProvider.analyzeProject({
            projectId: options.projectId || 'temp',
            name: 'Análisis de fragmento',
            description: chunk.chunkText,
            customPrompt: prompt
          });
          parsed = this.extractJsonSafely(rawOllama);
          if (parsed) {
            usedProvider = 'ollama';
          } else {
            metrics.ollamaFailures++;
          }
        } catch (ollamaErr) {
          metrics.ollamaFailures++;
          console.warn(`[SemanticAnalyzer] Ollama falló en fragmento: ${ollamaErr.message}`);
        }
      }

      // Evaluar si se requiere escalamiento a GPT
      const needsEscalation = !parsed ||
        (strategy === 'gpt-only') ||
        (strategy === 'ollama-first' && parsed?.needs?.some(n => (n.confidence || 0) < confidenceThreshold));

      if (needsEscalation && (strategy === 'ollama-first' || strategy === 'gpt-only')) {
        // 2. Escalamiento controlado a GPT
        if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0) {
          metrics.gptCalls++;
          try {
            console.log(`[SemanticAnalyzer] Escalando fragmento a GPT (OpenAI)...`);
            const rawGpt = await this.openAIProvider.analyzeProject({
              projectId: options.projectId || 'temp',
              name: 'Análisis de fragmento',
              description: chunk.chunkText,
              customPrompt: prompt
            });
            const gptParsed = this.extractJsonSafely(rawGpt);
            if (gptParsed) {
              parsed = gptParsed;
              usedProvider = 'openai';
            } else {
              metrics.gptFailures++;
            }
          } catch (gptErr) {
            metrics.gptFailures++;
            console.warn(`[SemanticAnalyzer] GPT falló en fragmento: ${gptErr.message}`);
          }
        } else {
          // Fallback a Mock si GPT no tiene API Key configurada
          console.log(`[SemanticAnalyzer] OPENAI_API_KEY no configurada. Utilizando MockProvider para fragmento.`);
          parsed = {
            needs: [
              {
                type: 'FUNCTION',
                description: `Gestionar operación mencionada en: "${chunk.chunkText.slice(0, 60)}..."`,
                evidence: chunk.chunkText.slice(0, 100),
                confidence: 0.8
              }
            ]
          };
          usedProvider = 'mock';
        }
      }

      if (parsed) {
        const normalized = this.normalizeResponse(parsed, chunk.chunkText);
        results.push({
          ...normalized,
          provider: usedProvider,
          sourceChunk: chunk.chunkText,
          metadata: chunk.metadata
        });
      }
    }

    metrics.durationMs = Date.now() - startTime;
    return { results, metrics };
  }
}

module.exports = new SemanticAnalyzer();
