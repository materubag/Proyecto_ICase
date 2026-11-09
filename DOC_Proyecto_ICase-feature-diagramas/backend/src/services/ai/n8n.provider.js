const AIProviderInterface = require('./ai.provider.interface');
const env = require('../../config/env');

class N8nAIProvider extends AIProviderInterface {
  async analyze(systemDescription, projectContext = {}) {
    const webhookUrl = env.N8N_BASE_URL ? `${env.N8N_BASE_URL}/webhook/analyze-system` : null;
    if (!webhookUrl) {
      throw new Error('n8n Webhook URL is not configured. Set N8N_BASE_URL in .env file.');
    }
    // Estructura preparada para enviar payload al flujo de n8n:
    // const response = await fetch(webhookUrl, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ systemDescription, projectContext })
    // });
    // return await response.json();
    throw new Error(`N8nAIProvider integration is prepared for phase 2 (webhook: ${webhookUrl}). Set AI_PROVIDER=mock for current MVP.`);
  }
}

module.exports = N8nAIProvider;
