/**
 * Base AI Provider Interface / Class
 * All concrete AI providers (Mock, Gemini, Ollama, OpenAI, n8n) must implement this interface.
 */
class AIProviderInterface {
  /**
   * Analyzes system description and project context to produce canonical structured JSON.
   * @param {string} systemDescription - Text describing the system to build
   * @param {Object} projectContext - Project metadata and existing entities
   * @returns {Promise<Object>} Canonical ICASE Structured JSON
   */
  async analyze(systemDescription, projectContext) {
    throw new Error('Method analyze() must be implemented by concrete AI provider');
  }
}

module.exports = AIProviderInterface;
