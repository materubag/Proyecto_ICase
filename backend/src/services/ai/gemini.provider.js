const AIProviderInterface = require('./ai.provider.interface');
const env = require('../../config/env');

class GeminiProvider extends AIProviderInterface {
  async analyze(systemDescription, projectContext = {}) {
    if (!env.AI_API_KEY) {
      throw new Error('Gemini API key is not configured. Set AI_API_KEY in .env file.');
    }

    // Estructura preparada para llamar a la API de Google Gemini (v1beta/models/gemini-pro o gemini-1.5-pro)
    // const prompt = `Analiza la siguiente descripción y devuelve un JSON estructurado con actores, requisitos, entidades, navegación y arquitectura: ${systemDescription}`;
    // const response = await fetch(`${env.AI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent'}?key=${env.AI_API_KEY}`, ...);
    
    throw new Error('GeminiProvider integration is prepared for phase 2. Set AI_PROVIDER=mock for current MVP.');
  }
}

module.exports = GeminiProvider;
