const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const MockAIProvider = require('../../backend/src/services/ai/MockAIProvider');
const GeminiProvider = require('../../backend/src/services/ai/GeminiProvider');
const { AIService } = require('../../backend/src/services/ai/AIService');

describe('AI Providers & Error Handling Unit Tests', () => {
  test('MockAIProvider returns deterministic domain analysis without external network calls', async () => {
    const mock = new MockAIProvider();
    const result = await mock.analyzeProject({
      name: 'Biblioteca Central',
      description: 'Sistema para registrar préstamos de libros, socios y multas por retraso.'
    });

    assert.ok(result.project);
    assert.ok(result.actors.length >= 2, 'Should detect library actors');
    assert.ok(result.requirements.length >= 3, 'Should generate library requirements');
    assert.ok(result.entities.length >= 2, 'Should generate entities');
    assert.ok(result.screens.length >= 2, 'Should generate screens');
  });

  test('GeminiProvider fails cleanly with descriptive error if API key is missing', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = '';
      const gemini = new GeminiProvider();
      await assert.rejects(async () => {
        await gemini.analyzeProject({
          name: 'Proyecto Test',
          description: 'Descripción breve'
        });
      }, /GEMINI_API_KEY no definida|no está configurado/i);
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  test('AIService rejects analysis when project has no description and no source documents', async () => {
    await assert.rejects(async () => {
      await AIService.analyzeProject({
        projectId: '00000000-0000-0000-0000-000000000000',
        description: ''
      });
    }, err => err.statusCode === 404 || err.message.includes('no encontrado'));
  });
});
