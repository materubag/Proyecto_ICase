const AIProviderInterface = require('./ai.provider.interface');
const env = require('../../config/env');

class OllamaProvider extends AIProviderInterface {
  async analyze(systemDescription, projectContext = {}) {
    const url = env.AI_API_URL || 'http://localhost:11434/api/generate';
    // Estructura preparada para Ollama local (e.g. llama3, mistral, qwen):
    // const response = await fetch(url, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ model: 'llama3', prompt: `...`, stream: false, format: 'json' })
    // });
    throw new Error(`OllamaProvider integration is prepared for phase 2 (target URL: ${url}). Set AI_PROVIDER=mock for current MVP.`);
  }
}

module.exports = OllamaProvider;
