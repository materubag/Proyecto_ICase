const env = require('../../config/env');
const MockMockupProvider = require('./mock.mockup.provider');

class MockupService {
  constructor() {
    this.mockProvider = new MockMockupProvider();
  }

  /**
   * Generates mockups either via n8n webhook (if configured) or via MockMockupProvider
   * @param {Object} project - Project data
   * @param {string} prompt - Optional prompt or focus for the mockup
   */
  async generateMockup(project, prompt = '') {
    // Si N8N_MOCKUP_WEBHOOK está definido, intentar delegar al flujo n8n
    if (env.N8N_MOCKUP_WEBHOOK && env.N8N_MOCKUP_WEBHOOK.trim().length > 0) {
      console.log(`[MockupService] Delegating mockup generation to n8n webhook: ${env.N8N_MOCKUP_WEBHOOK}`);
      try {
        const response = await fetch(env.N8N_MOCKUP_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            projectName: project.name,
            description: project.description,
            systemDescription: project.systemDescription,
            requirements: project.requirements || [],
            prompt
          })
        });

        if (response.ok) {
          const n8nResult = await response.json();
          return {
            provider: 'n8n-webhook',
            ...n8nResult
          };
        } else {
          console.warn(`[MockupService] n8n webhook responded with status ${response.status}. Falling back to mock.`);
        }
      } catch (err) {
        console.warn(`[MockupService] Error contacting n8n webhook: ${err.message}. Falling back to mock.`);
      }
    }

    // Default Mock Provider
    console.log('[MockupService] Generating mockups via MockMockupProvider.');
    return await this.mockProvider.generateMockup(project, prompt);
  }
}

module.exports = new MockupService();
