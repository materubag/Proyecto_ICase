/**
 * Base AI Provider Class
 * Common conceptual base interface for all AI Providers in ICASE.
 * All concrete providers must expose the analyzeProject(input) operation.
 */
class AIProvider {
  /**
   * Analyzes project input and produces canonical structured JSON.
   * @param {Object} input - Input payload
   * @param {string} input.projectId - Project ID
   * @param {string} input.name - Project Name
   * @param {string} input.description - Project Description
   * @param {Object} [input.context] - Additional metadata/context
   * @returns {Promise<Object>} Canonical ICASE Structured JSON
   */
  async analyzeProject(input) {
    throw new Error('Method analyzeProject(input) must be implemented by concrete AI provider');
  }
}

module.exports = AIProvider;
