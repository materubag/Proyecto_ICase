const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
// Isolate configuration: these tests cannot load keys or call a paid API.
const envPath = require.resolve('../src/config/env');
require.cache[envPath] = { id: envPath, filename: envPath, loaded: true, exports: {
  AI_PROVIDER: 'gemini', OPENAI_API_KEY: 'test', GEMINI_API_KEY: 'test',
  OPENAI_MODEL: 'selected-openai', GEMINI_MODEL: 'selected-gemini' } };
const { extract, segmentText } = require('../src/services/analysis/documentExtraction');
const rules = require('../src/services/document/RuleBasedExtractor');
const contract = require('../src/services/analysis/extractionContract');
const response = (segments, requirements = [], actors = [], other = []) => ({ coveredSegmentIds: segments.map(s => s.id), requirements, actors, other });
const req = (s, statement = s.text.trim(), type = 'FUNCTIONAL') => ({ segmentIds: [s.id], statement, type, quote: s.text.trim(), explicit: true, associations: [], pending: [] });
const options = providerInstance => ({ providerInstance, providerOverride: 'openai', modelOverride: 'chosen', cache: false });

test('multiline RF/RNF, original codes and evidence', () => {
  const text = '[PÁGINA 2]\nRF-01\nRegistrar pedidos\ncon sus líneas.\n\nRNF 02:\nResponder en menos de 2 segundos.\n';
  const rf = rules.extractFunctionalRequirements(text), rnf = rules.extractNonFunctionalRequirements(text);
  assert.equal(rf.length, 1); assert.equal(rnf.length, 1);
  assert.match(rf[0].text, /con sus líneas/); assert.equal(rf[0].page, 2);
  assert.equal(rnf[0].originalCode, 'RNF 02'); assert.match(rnf[0].sourceText, /RNF 02:\nResponder/);
});

test('all 27 segments, stable IDs and selected model per batch', async () => {
  const text = Array.from({ length: 27 }, (_, i) => `- Registrar operación ${i}.`).join('\n');
  const calls = [];
  const provider = { async extractDocumentBatch(input, opt) {
    calls.push(opt); return { data: response(input.segments, input.segments.map(s => req(s))), usage: { total_tokens: 10 } };
  } };
  const result = await extract(text, options(provider));
  assert.equal(result.requirements.length, 27); assert.equal(result.coverage.length, 27);
  assert.ok(result.coverage.every(c => c.status === 'ANALYZED')); assert.equal(calls.length, 4);
  assert.ok(calls.every(c => c.model === 'chosen')); assert.equal(result.metrics.usage.length, 4);
  const again = await extract(text, options(provider));
  assert.deepEqual(result.requirements.map(r => r.id), again.requirements.map(r => r.id));
});

test('long text retained byte for byte', () => {
  const text = 'Una especificación extensa '.repeat(1400);
  const segments = segmentText(text);
  assert.equal(segments.map(s => s.text).join(''), text);
  assert.ok(segments.every(s => s.text.length <= 3000));
});

test('manually reviewed narrative: independent capabilities, RNF, external actors, entities and unknown owner', async () => {
  const lines = [
    'La operadora registra pedidos y cancela pedidos pendientes.',
    'La pasarela de pago externa confirma los cobros al sistema.',
    'Las búsquedas responden en menos de 2 segundos.',
    'Los datos deben viajar cifrados.',
    'Se necesita exportar informes.',
    'Pedido y Factura son entidades de datos. Ana participó en la reunión.'
  ];
  const text = lines.map(l => `- ${l}`).join('\n');
  const provider = { async extractDocumentBatch({ segments }) {
    const actor = { key: 'operator', name: 'Operadora', kind: 'HUMAN', segmentIds: [segments[0].id], quote: lines[0], explicit: true };
    const external = { key: 'gateway', name: 'Pasarela de pago', kind: 'EXTERNAL_SYSTEM', segmentIds: [segments[1].id], quote: lines[1], explicit: true };
    const a = req(segments[0], 'Registrar pedidos'), b = req(segments[0], 'Cancelar pedidos pendientes');
    for (const r of [a, b]) r.associations = [{ actorKey: 'operator', role: 'EXECUTOR', segmentIds: [segments[0].id], quote: lines[0] }];
    const c = req(segments[1], 'Confirmar cobros'); c.associations = [{ actorKey: 'gateway', role: 'PARTICIPANT', segmentIds: [segments[1].id], quote: lines[1] }];
    return { data: response(segments, [a, b, c, req(segments[2], lines[2], 'NON_FUNCTIONAL'), req(segments[3], lines[3], 'NON_FUNCTIONAL'), req(segments[4], 'Exportar informes')], [actor, external], [{ segmentIds: [segments[5].id], type: 'CONTEXT', quote: lines[5], reason: 'Datos y persona mencionada' }]) };
  } };
  const result = await extract(text, options(provider));
  assert.equal(result.functionalRequirements.length, 4); assert.equal(result.nonFunctionalRequirements.length, 2);
  assert.deepEqual(result.actors.map(a => a.name), ['Operadora', 'Pasarela de pago']);
  assert.ok(result.nonFunctionalRequirements.every(r => r.actorIds.length === 0));
  assert.equal(result.requirements[0].actorIds[0], result.actors[0].id);
  assert.equal(result.requirements[2].actorIds[0], result.actors[1].id);
  assert.equal(result.requirements[5].actorIds.length, 0); assert.ok(result.requirements[5].pending.length);
});

test('incomplete batch retains local candidates and later batches continue', async () => {
  let calls = 0;
  const text = Array.from({ length: 25 }, (_, i) => `RF-${String(i+1).padStart(2, '0')} Registrar dato ${i}.`).join('\n');
  const provider = { async extractDocumentBatch({ segments }) {
    if (++calls === 2) return { data: { requirements: [] } };
    return { data: response(segments, segments.map(s => req(s))) };
  } };
  const result = await extract(text, options(provider));
  assert.equal(calls, 4); assert.equal(result.partial, true); assert.equal(result.failures.length, 1);
  assert.equal(result.requirements.length, 25); assert.equal(result.coverage.filter(c => c.status === 'FAILED').length, 8);
});

test('reject missing types, fabricated evidence, absent actors and missing coverage', () => {
  const s = { id: 's', text: 'Registrar pedidos' };
  for (const change of [r => delete r.type, r => r.quote = 'Inventado', r => r.associations.push({ actorKey: 'absent', role: 'EXECUTOR', segmentIds: ['s'], quote: s.text })]) {
    const r = req(s); change(r); assert.throws(() => contract.validate(response([s], [r]), [s]));
  }
  assert.throws(() => contract.validate(response([], []), [s]));
});

test('exact duplicates combine evidence; similar requirements survive', async () => {
  const text = '- Registrar pedidos\n- Registrar pedidos\n- Registrar pedidos pendientes';
  const result = await extract(text, options({ async extractDocumentBatch({ segments }) { return { data: response(segments, segments.map(s => req(s, s.text.trim().replace(/^- /, '')))) }; } }));
  assert.equal(result.requirements.length, 2); assert.equal(result.requirements[0].evidence.length, 2);
});

test('content/provider/model/prompt cache and partial retry', async () => {
  const cacheDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'icase-test-'));
  let calls = 0;
  const opt = { ...options({ async extractDocumentBatch({ segments }) { calls++; return { data: response(segments, segments.map(s => req(s))) }; } }), cache: true, cacheDir };
  try {
    await extract('Registrar pedidos', opt); const cached = await extract('Registrar pedidos', opt);
    assert.equal(calls, 1); assert.equal(cached.metrics.cacheHits, 1);
    await extract('Registrar pedidos', { ...opt, modelOverride: 'another' }); assert.equal(calls, 2);
    await extract('Registrar pedidos', { ...opt, providerOverride: 'gemini' }); assert.equal(calls, 3);
    await extract('Cancelar pedidos', opt); assert.equal(calls, 4);
  } finally { fs.rmSync(cacheDir, { recursive: true }); }
});

for (const [name, Provider, finish] of [
  ['OpenAI', require('../src/services/ai/OpenAIProvider'), 'length'],
  ['Gemini', require('../src/services/ai/GeminiProvider'), 'MAX_TOKENS']
]) test(`${name} selected model and truncation, no paid requests`, async () => {
  const previous = global.fetch; const provider = new Provider(); let request;
  global.fetch = async (url, opt) => { request = { url, body: JSON.parse(opt.body) }; return { ok: true, json: async () => name === 'OpenAI' ? { choices: [{ finish_reason: finish, message: { content: '{}' } }], usage: { total_tokens: 12 } } : { candidates: [{ finishReason: finish, content: { parts: [{ text: '{}' }] } }], usageMetadata: { totalTokenCount: 12 } } }; };
  try {
    await assert.rejects(provider.extractDocumentBatch({ segments: [] }, { model: 'my-model' }), /incompleta/);
    if (name === 'OpenAI') assert.equal(request.body.model, 'my-model'); else assert.match(request.url, /models\/my-model:/);
  } finally { global.fetch = previous; }
});

test('table, zero findings, inferred findings and compound original-code tracing', async () => {
  const text = '| RF-01 | Registrar y cancelar pedidos |\n\nAntecedentes del proyecto.';
  assert.equal(rules.extractFunctionalRequirements(text).length, 1);
  const provider = { async extractDocumentBatch({ segments }) {
    const r1 = req(segments[0], 'Registrar pedidos'), r2 = req(segments[0], 'Cancelar pedidos');
    r1.code = r2.code = 'RF-01'; r2.explicit = false;
    return { data: response(segments, [r1, r2]) };
  } };
  const result = await extract(text, options(provider));
  assert.equal(result.requirements.length, 1);
  assert.ok(result.requirements.every(r => r.originalCode === 'RF-01'));
  assert.equal(result.requirements[0].statement, 'Registrar y cancelar pedidos');
  assert.equal(result.requirements[0].refinements.length, 2);
  assert.equal(result.requirements[0].source, 'explicit');
  const zero = await extract('Un documento histórico.', options({ async extractDocumentBatch({ segments }) { return { data: response(segments) }; } }));
  assert.equal(zero.requirements.length, 0); assert.equal(zero.actors.length, 0); assert.equal(zero.partial, false);
});

test('source persistence preserves evidence and does not mark failed version as analyzed', async () => {
  const prismaPath = require.resolve('../src/config/prisma');
  const writes = { requirements: [], models: [], versions: [] };
  const tx = {
    requirementCandidate: { findMany: async () => [], create: async ({ data }) => { writes.requirements.push(data); return data; } },
    needCandidate: { deleteMany: async () => {} },
    modelCandidate: { findUnique: async () => null, upsert: async ({ create }) => { writes.models.push(create); return create; } },
    sourceVersion: { update: async arg => { writes.versions.push(arg); } },
    source: { update: async () => {} }
  };
  const prisma = { modelCandidate: { findFirst: async () => null }, source: { findUnique: async () => ({ id: 'source', name: 'Example', projectId: 'project', type: 'PDF', status: 'EXTRACTED', currentVersion: { id: 'version', sourceId: 'source', extractedText: 'RF-01\nRegistrar pedidos', segments: [] } }) }, $transaction: async callback => callback(tx) };
  require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
  const pipeline = require('../src/services/analysis/analysisPipeline');
  const result = await pipeline.run({ sourceId: 'source', ...options({ async extractDocumentBatch() { throw new Error('Incomplete'); } }) });
  assert.equal(result.partial, true); assert.equal(writes.requirements.length, 1);
  assert.equal(writes.requirements[0].evidence.originalCode, 'RF-01');
  assert.equal(writes.requirements[0].confidence, null); assert.deepEqual(writes.requirements[0].evidence.actorIds, []);
  assert.equal(writes.versions[0].data.analyzedAt, null);
  assert.ok(writes.models.some(m => m.kind === 'DOCUMENT_ANALYSIS' && m.content.partial));
});

for (const [name, Provider] of [ ['OpenAI', require('../src/services/ai/OpenAIProvider')], ['Gemini', require('../src/services/ai/GeminiProvider')] ]) {
  test(`${name} missing response and HTTP error cannot trigger model fallback`, async () => {
    const previous = global.fetch; const provider = new Provider(); provider.minRequestIntervalMs = 0;
    let calls = 0;
    try {
      global.fetch = async () => { calls++; return { ok: true, json: async () => ({}) }; };
      await assert.rejects(provider.extractDocumentBatch({}, { model: 'requested' }), /incompleta/);
      global.fetch = async () => { calls++; return { ok: false, status: 404 }; };
      await assert.rejects(provider.extractDocumentBatch({}, { model: 'requested' }), /requested/);
      assert.equal(calls, 2);
    } finally { global.fetch = previous; }
  });
}

test('enumerated proposal omitted by semantic response remains pending with original evidence', async () => {
  const result = await extract('RF-07\nRegistrar pedidos\n\nRNF-03\nCifrar los datos.', options({ async extractDocumentBatch({ segments }) { return { data: response(segments) }; } }));
  assert.equal(result.requirements.length, 2);
  assert.ok(result.requirements.every(r => r.extractionMethod === 'LOCAL' && r.confidence === null));
  assert.deepEqual(result.requirements.map(r => r.originalCode), ['RF-07', 'RNF-03']);
});

test('reanalysis retries failed batches only and reuses successful batch cache', async () => {
  const cacheDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'icase-retry-'));
  const text = Array.from({ length: 17 }, (_, i) => `- Registrar operación ${i}`).join('\n');
  let fail = true; const calls = [];
  const opt = { ...options({ async extractDocumentBatch({ segments }, { batchIndex }) {
    calls.push(batchIndex); if (batchIndex === 2 && fail) throw new Error('Test outage');
    return { data: response(segments, segments.map(s => req(s))) };
  } }), cache: true, cacheDir };
  try {
    const partial = await extract(text, opt); assert.equal(partial.partial, true);
    fail = false; const complete = await extract(text, opt);
    assert.deepEqual(calls, [1, 2, 3, 2]); assert.equal(complete.partial, false); assert.equal(complete.metrics.cacheHits, 2);
    assert.equal(complete.requirements.length, 17);
  } finally { fs.rmSync(cacheDir, { recursive: true }); }
});

test('wrapped library sentence retains literal span',()=>{const text='La aplicaci\u00f3n permite organizar los libros de la\nbiblioteca. Otra frase.';const r=rules.extractFunctionalRequirements(text);assert.equal(r.length,1);assert.ok(r[0].text.endsWith('biblioteca.'));assert.equal(text.substring(r[0].start,r[0].end),r[0].sourceText);});
test('one invalid finding cannot discard valid actor and requirement or trigger retries',async()=>{let calls=0;const provider={async extractDocumentBatch({segments}){calls++;const s=segments[0];return {data:response(segments,[req(s,'Registrar prestamos'),{...req(s,'Inventado'),quote:'inventado'}],[{key:'b',name:'Bibliotecario',kind:'HUMAN',explicit:true,segmentIds:[s.id],quote:s.text}])};}};const r=await extract('El bibliotecario registra prestamos.',options(provider));assert.equal(calls,1);assert.equal(r.requirements.length,1);assert.equal(r.actors.length,1);assert.equal(r.partial,true);assert.equal(r.coverage[0].status,'FAILED');assert.ok(r.failures[0].issues.length);});
test('surplus segment references narrowed only inside declared evidence',()=>{const {recover}=require('../src/services/analysis/extractionRecovery');const segs=[{id:'a',text:'Registrar libros.',start:0,end:17},{id:'b',text:'Otro texto.',start:17,end:28}];const r=recover(response(segs,[{...req(segs[0]),segmentIds:['a','b']}]),segs);assert.deepEqual(r.data.requirements[0].segmentIds,['a']);const invalid=recover(response(segs,[{...req(segs[0]),segmentIds:['b']}]),segs);assert.equal(invalid.data.requirements.length,0);});
