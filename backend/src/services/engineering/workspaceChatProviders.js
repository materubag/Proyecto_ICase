const env = require('../../config/env');

// Provider orchestration only. No project mutation is permitted in a chat answer.
async function answerWithProviders(provider, question, context, factory = name => require('../ai/AIService').createAIProvider(name)) {
  const selected = provider === 'hibrido' ? 'hybrid' : provider === 'claude' ? 'anthropic' : provider;
  if (!['hybrid', 'openai', 'anthropic', 'ollama', 'local'].includes(selected)) {
    throw Object.assign(new Error('Proveedor de chat no válido'), { statusCode: 400 });
  }
  if (selected === 'local') return { answer: null, providerStatus: 'LOCAL', calls: [] };
  const calls = [];
  const boundedContext = Array.isArray(context) ? context.slice(0, 12) : [];
  while (boundedContext.length && JSON.stringify(boundedContext).length > 14000) boundedContext.pop();
  let answer = null;
  const system = 'Responde en español exclusivamente JSON {"answer":"respuesta"}. Eres el Asistente de Ingeniería y Arquitectura de iCASE. Responde de forma concisa, técnica y directa basándote en la evidencia, los requisitos y la arquitectura de endpoints y código provista en el contexto. Si preguntan si algo está implementado o en qué archivo se encuentra, confírmalo claramente indicando las rutas de archivo y detalles técnicos correspondientes.';
  for (const name of selected === 'hybrid' ? ['openai', 'anthropic'] : [selected]) {
    try {
      const client = factory(name);
      const payload = { question, context: boundedContext, ...(answer ? { draft: answer, task: 'Revisa y corrige el borrador contra la evidencia antes de responder' } : {}) };
      const result = typeof client.executePrompt === 'function'
        ? await client.executePrompt({ system, prompt: payload, model: name === 'openai' ? env.DOCUMENT_PREPARATION_MODEL : name === 'anthropic' ? env.DOCUMENT_REVIEW_MODEL : client.model, maxTokens: 2048 })
        : await client.analyzeProject({ name: 'Consulta contextual', description: JSON.stringify(context), customPrompt: system + '\n' + JSON.stringify(payload) });
      const data = result?.data || result;
      if (typeof data?.answer !== 'string' || !data.answer.trim()) throw new Error('El proveedor no devolvió una respuesta válida');
      answer = data.answer;
      calls.push({ provider: name, model: result.model || client.model || null, status: 'SUCCEEDED', usage: result.usage || null });
    } catch (error) {
      calls.push({ provider: name, status: 'FAILED', error: error.message, usage: error.usage || null });
      break;
    }
  }
  return { answer, providerStatus: calls.some(call => call.status === 'FAILED') ? (answer ? 'PARTIAL' : 'FAILED') : 'SUCCEEDED', calls };
}

module.exports = { answerWithProviders };
