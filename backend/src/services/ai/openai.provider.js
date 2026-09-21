const AIProviderInterface = require('./ai.provider.interface');
const env = require('../../config/env');

class OpenAIProvider extends AIProviderInterface {
  async analyze(systemDescription, projectContext = {}) {
    if (!env.AI_API_KEY) {
      throw new Error('OpenAI API key is not configured. Set AI_API_KEY in .env file.');
    }
    // Estructura preparada para OpenAI chat completions con JSON Mode o function calling:
    // const response = await fetch('https://api.openai.com/v1/chat/completions', { ... });
    throw new Error('OpenAIProvider integration is prepared for phase 2. Set AI_PROVIDER=mock for current MVP.');
  }
}

module.exports = OpenAIProvider;
