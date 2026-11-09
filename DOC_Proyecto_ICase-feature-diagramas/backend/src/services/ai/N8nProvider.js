const AIProvider = require('./AIProvider');
const env = require('../../config/env');

class N8nProvider extends AIProvider {
  /**
   * Delegates project analysis to an n8n webhook workflow.
   * @param {Object} input - { projectId, name, description, context }
   */
  async analyzeProject(input) {
    const webhookUrl = env.N8N_ANALYZE_WEBHOOK;

    if (!webhookUrl || webhookUrl.trim() === '') {
      throw new Error('El proveedor n8n no está configurado (N8N_ANALYZE_WEBHOOK no definida en variables de entorno).');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), env.N8N_TIMEOUT || 30000);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: input.projectId,
          name: input.name,
          description: input.description,
          context: input.context || {}
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`El webhook de n8n respondió con error de estado HTTP ${response.status}`);
      }

      const json = await response.json();
      if (json.data) {
        return json.data;
      }
      return json;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`Tiempo de espera agotado (${env.N8N_TIMEOUT || 30000}ms) al contactar al webhook de n8n.`);
      }
      throw new Error(`Error al comunicarse con el proveedor n8n: ${err.message}`);
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

module.exports = N8nProvider;
