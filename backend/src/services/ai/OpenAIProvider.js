const AIProvider = require('./AIProvider');
const env = require('../../config/env');

class OpenAIProvider extends AIProvider {
  /**
   * Structure prepared for OpenAI chat completions API with JSON Mode.
   * @param {Object} input - { projectId, name, description, context }
   */
  async analyzeProject(input) {
    if (!env.OPENAI_API_KEY) {
      throw new Error('El proveedor OpenAI no está configurado (OPENAI_API_KEY no definida en el archivo .env).');
    }

    const model = env.OPENAI_MODEL || 'gpt-4o';
    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const systemPrompt = `Eres un arquitecto de software experto en metodologías ICASE. 
Analiza la especificación de sistema y responde ÚNICAMENTE con un JSON válido estructurado con los campos: project, actors, requirements, entities, relationships, screens, navigation, architecture.`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Nombre: ${input.name}\nDescripción: ${input.description}` }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API respondió con código de estado HTTP ${response.status}`);
      }

      const resJson = await response.json();
      const content = resJson.choices?.[0]?.message?.content;
      return JSON.parse(content);
    } catch (err) {
      throw new Error(`Error en el proveedor OpenAI: ${err.message}`);
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

module.exports = OpenAIProvider;
