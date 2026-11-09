const AIProvider = require('./AIProvider');
const env = require('../../config/env');

class OllamaProvider extends AIProvider {
  /**
   * Structure prepared for local Ollama API (e.g. llama3, mistral).
   * @param {Object} input - { projectId, name, description, context, customPrompt }
   */
  async analyzeProject(input) {
    const baseUrl = process.env.OLLAMA_BASE_URL || env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || env.OLLAMA_MODEL || 'llama3';
    const timeout = parseInt(process.env.OLLAMA_TIMEOUT, 10) || env.OLLAMA_TIMEOUT || 120000;
    const endpoint = `${baseUrl}/api/generate`;

    if (!model || model.trim() === '') {
      throw new Error('El modelo de Ollama no está configurado. Configure OLLAMA_MODEL en las variables de entorno.');
    }

    const prompt = input.customPrompt || `Devuelve exclusivamente un JSON estricto con el análisis ICASE para este sistema:
Nombre: ${input.name}
Descripción: ${input.description}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      console.log(`[AI] modelo: ${model}`);
      console.log(`[AI] inicio de generación`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          format: 'json',
          stream: false,
          options: {
            temperature: 0.1
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`El servidor de Ollama respondió con código HTTP ${response.status}`);
      }

      console.log(`[AI] respuesta recibida`);

      const resJson = await response.json();
      const rawText = resJson.response;

      try {
        return typeof rawText === 'string' ? JSON.parse(rawText) : rawText;
      } catch (parseErr) {
        // Retornar el texto crudo para que el normalizador/parser extraiga el JSON
        return rawText;
      }
    } catch (err) {
      console.error('[OllamaProvider] Error de comunicación con Ollama:', err.message);
      const error = new Error(`Ollama no está disponible o el modelo no está descargado (${err.message}). Ejecute 'docker exec icase_ollama ollama pull ${model}'`);
      error.statusCode = 503;
      throw error;
    }
  }

  // Alias para compatibilidad
  async analyze(description, context = {}) {
    return this.analyzeProject({
      name: context.name,
      description,
      context
    });
  }
}

module.exports = OllamaProvider;
