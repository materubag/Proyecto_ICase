const { test } = require('node:test');
const assert = require('node:assert/strict');
const env = require('../src/config/env');
const OpenAIProvider = require('../src/services/ai/OpenAIProvider');
const AnthropicProvider = require('../src/services/ai/AnthropicProvider');
const Router = require('../src/services/ai/HybridPipelineRouter');

test('Luna uses Responses parameters and reports cached/reasoning usage', async () => {
  const fetchBefore = global.fetch, key = env.OPENAI_API_KEY;
  env.OPENAI_API_KEY = 'test-only';
  try {
    global.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(body.model, 'luna-account-model'); assert.equal(body.max_output_tokens, 1000);
      assert.equal(body.temperature, undefined); assert.equal(body.max_tokens, undefined); assert.equal(body.store, false);
      return { ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: '{"summary":"test"}' }] }], usage: { input_tokens: 12, output_tokens: 4, input_tokens_details: { cached_tokens: 3 }, output_tokens_details: { reasoning_tokens: 2 } } }) };
    };
    const result = await new OpenAIProvider().executePrompt({ system: 'JSON', prompt: {}, model: 'luna-account-model', maxTokens: 1000 });
    assert.equal(result.usage.input_tokens_details.cached_tokens, 3); assert.equal(result.usage.output_tokens_details.reasoning_tokens, 2);
  } finally { global.fetch = fetchBefore; env.OPENAI_API_KEY = key; }
});
test('non-reasoning OpenAI models never receive reasoning parameters', async () => {
  const previous = { fetch: global.fetch, key: env.OPENAI_API_KEY, effort: env.DOCUMENT_REASONING_EFFORT };
  env.OPENAI_API_KEY = 'test-only'; env.DOCUMENT_REASONING_EFFORT = 'low';
  try {
    global.fetch = async (_url, options) => {
      assert.equal(JSON.parse(options.body).reasoning, undefined);
      return { ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: '{}' }] }] }) };
    };
    await new OpenAIProvider().executePrompt({ system: 'JSON', prompt: {}, model: 'gpt-4o-mini' });
  } finally { global.fetch = previous.fetch; env.OPENAI_API_KEY = previous.key; env.DOCUMENT_REASONING_EFFORT = previous.effort; }
});

test('Sonnet Messages parameters reject truncation and preserve usage', async () => {
  const fetchBefore = global.fetch, key = env.ANTHROPIC_API_KEY;
  env.ANTHROPIC_API_KEY = 'test-only';
  try {
    global.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'sonnet-account-model'); assert.equal(body.max_tokens, 1000); assert.equal(body.temperature, undefined);
      assert.equal(body.system, 'JSON'); assert.equal(options.headers['anthropic-version'], '2023-06-01');
      return { ok: true, json: async () => ({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{}' }], usage: { input_tokens: 20, output_tokens: 1000 } }) };
    };
    await assert.rejects(new AnthropicProvider().executePrompt({ system: 'JSON', prompt: {}, model: 'sonnet-account-model', maxTokens: 1000 }), e => e.usage.output_tokens === 1000);
  } finally { global.fetch = fetchBefore; env.ANTHROPIC_API_KEY = key; }
});
test('Sonnet review never falls back to preparation provider', async () => {
  const router = new Router(); let preparationCalls = 0;
  const old = env.DOCUMENT_REVIEW_MODEL; env.DOCUMENT_REVIEW_MODEL = 'sonnet-test';
  router.reasoningProvider.executePrompt = async () => { throw new Error('Sonnet failed'); };
  router.fastProvider.executePrompt = async () => { preparationCalls++; return { data: {} }; };
  try { await assert.rejects(router.documentTask('review', {}), /Sonnet failed/); assert.equal(preparationCalls, 0); }
  finally { env.DOCUMENT_REVIEW_MODEL = old; }
});
test('hybrid extraction delegates to the configured Luna Responses adapter', async () => {
  const router = new Router(); let input;
  router.fastProvider.executePrompt = async value => { input = value; return { data: { requirements: [] } }; };
  await router.extractDocumentBatch({ text: 'Texto original' }, { model: 'luna-test', prompt: 'Contrato JSON' });
  assert.equal(input.model, 'luna-test'); assert.equal(input.system, 'Contrato JSON'); assert.equal(input.prompt.text, 'Texto original');
});
