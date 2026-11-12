const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const p = require('../src/services/codegen/deliveryPolicy');
const { DeliveryWorkflow } = require('../src/services/codegen/deliveryWorkflow');
const { DeliveryRuntime, manifest } = require('../src/services/codegen/deliveryRuntime');
const { applyCommandScreens } = require('../src/services/codegen/commandContracts');
const { answerWithProviders } = require('../src/services/engineering/workspaceChatProviders');

function artifact(content = {}, approved = true) {
  const hash = p.hash(content);
  return { version: 1, content, validation: { passed: true, executedAt: '2026-11-11T00:00:00Z', manifest: content.fileHashes || {},
    tests: [{ check: 'TEST_DOUBLE', passed: true, executedAt: '2026-11-11T00:00:00Z' }], containerBehaviorPassed: true },
    review: { status: 'SUCCEEDED', contentHash: hash }, approval: approved ? { contentHash: hash, manualReview: { confirmed: true }, version: 1 } : null };
}

function fixture(t, count = 1) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'icase-delivery-regression-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, 'app.js'), 'original');
  const files = manifest(directory);
  const input = { project: { id: 'isolated-review', name: 'Review' }, graph: { version: 1 }, documentApproved: true,
    spec: { operations: [], entities: [] }, entities: [], prerequisites: { models: [] } };
  const runtime = new DeliveryRuntime();
  runtime.directory = () => directory;
  let row;
  const db = {
    $transaction: async callback => callback(db),
    deliveryWorkflow: {
      findUnique: async () => structuredClone(row),
      update: async ({ data }) => {
        row = { ...row, ...structuredClone(data), revision: row.revision + (data.revision?.increment || 0) };
        return structuredClone(row);
      }
    }, deliveryJob: { findMany: async () => [] }, deliveryCall: { findMany: async () => [] }
  };
  const workflow = new DeliveryWorkflow(db, { inputs: async () => structuredClone(input), runtime });
  const state = { ...workflow.initial(input), workspace: 'version-1', files, runtime: { database: 'isolated' } };
  for (let n = 1; n <= count; n++) state.stages[n] = artifact({ fileHashes: files, executionScope: 'TEST_DOUBLE' });
  row = { projectId: input.project.id, revision: 1, state };
  return { workflow, state, input, directory, getRow: () => row };
}

test('legacy optimistic approvals are revoked; a parallel approval list cannot unlock delivery', async t => {
  const f = fixture(t, 7);
  f.state.approvedStageIds = [1, 2, 3, 4, 5, 6, 7];
  f.state.stages[1].approval.source = 'CODEGEN_PROGRESSIVE_GATE';
  const result = await f.workflow.get('isolated-review');
  assert.deepEqual(result.approvedStages, []);
  assert.equal(result.stages[1].approval, null);
  assert.equal(Object.hasOwn(f.getRow().state, 'approvedStageIds'), false);
  await assert.rejects(f.workflow.archive('isolated-review'), /siete etapas/);
});

test('approval requires executed tests, the current revision, and explicit manual review; it writes no files', async t => {
  const f = fixture(t);
  f.state.stages[2] = artifact({ fileHashes: f.state.files, executionScope: 'TEST_DOUBLE' }, false);
  const before = manifest(f.directory);
  const options = { manualReview: { confirmed: true, notes: 'Prueba de revisión' } };
  await assert.rejects(f.workflow.approve('isolated-review', '2', 99, options), /desactualizada/);
  await assert.rejects(f.workflow.approve('isolated-review', '2', 1, {}), /Confirme/);
  f.state.stages[2].validation.tests = [];
  await assert.rejects(f.workflow.approve('isolated-review', '2', 1, options), /evidencia/);
  f.state.stages[2].validation.tests = [{ passed: true, executedAt: new Date().toISOString() }];
  await f.workflow.approve('isolated-review', '2', 1, options);
  assert.deepEqual(manifest(f.directory), before);
  assert.deepEqual((await f.workflow.get('isolated-review')).approvedStages, [1, 2]);
  f.workflow.invalidate(f.getRow().state, 2, 'Changed source');
  assert.deepEqual(p.stageStatus(f.getRow().state).approvedStages, [1]);
});

test('changed files block approval and verified ZIP; private environment files are excluded', async t => {
  const f = fixture(t, 7);
  fs.writeFileSync(path.join(f.directory, '.env'), 'DB_PASSWORD=private');
  const archive = await f.workflow.archive('isolated-review');
  const names = [];
  for (let at = 0; archive.readUInt32LE(at) === 0x04034b50;) {
    const length = archive.readUInt16LE(at + 26), extra = archive.readUInt16LE(at + 28), size = archive.readUInt32LE(at + 18);
    names.push(archive.toString('utf8', at + 30, at + 30 + length));
    at += 30 + length + extra + size;
  }
  assert.deepEqual(names, ['app.js']);
  fs.writeFileSync(path.join(f.directory, 'app.js'), 'manual edit');
  await assert.rejects(f.workflow.archive('isolated-review'), /archivos cambiaron/);
  assert.equal(fs.readFileSync(path.join(f.directory, 'app.js'), 'utf8'), 'manual edit');
});

test('editing an endpoint revokes the endpoint closure and delivery without discarding unrelated approvals', t => {
  const f = fixture(t, 7);
  f.state.endpoints.first = { definition: artifact({ operation: { operationId: 'first' } }), execution: artifact() };
  f.state.endpoints.other = { definition: artifact({ operation: { operationId: 'other' } }), execution: artifact() };
  f.workflow.replace(f.state, 'definition:first', { operation: { operationId: 'first', name: 'Changed' } });
  assert.deepEqual(p.stageStatus(f.state).approvedStages, [1, 2, 3]);
  assert.equal(f.state.endpoints.first.execution, null);
  assert.ok(p.approved(f.state.endpoints.other.definition));
  assert.ok(p.approved(f.state.endpoints.other.execution));
});

test('preview never boots when database evidence is absent or preparation fails', async t => {
  const f = fixture(t, 3);
  let boots = 0, closes = 0;
  f.workflow.runtime.boot = async () => { boots++; throw new Error('Database unavailable'); };
  f.workflow.runtime.close = async () => { closes++; };
  delete f.state.runtime;
  await assert.rejects(f.workflow.preview('isolated-review'), /base aislada/);
  assert.equal(boots, 0);
  f.state.runtime = { database: 'isolated' };
  await assert.rejects(f.workflow.preview('isolated-review'), /Database unavailable/);
  assert.equal(closes, 1);
});

test('Swagger documents JWT, login and path parameters and excludes unapproved definitions', () => {
  const op = { operationId: 'read', name: 'Read', method: 'GET', route: '/api/books/:id', input: {} };
  const state = { security: { authType: 'JWT' }, endpoints: { read: { definition: artifact({ operation: op }) },
    pending: { definition: artifact({ operation: { ...op, route: '/api/pending' } }, false) } } };
  const doc = new DeliveryRuntime().openapi(state);
  assert.equal(doc.components.securitySchemes.bearerAuth.scheme, 'bearer');
  assert.deepEqual(doc.paths['/api/books/{id}'].get.security, [{ bearerAuth: [] }]);
  assert.equal(doc.paths['/api/books/{id}'].get.parameters[0].name, 'id');
  assert.deepEqual(doc.paths['/api/auth/login'].post.security, []);
  assert.equal(doc.paths['/api/pending'], undefined);
});

test('a hanging verification command fails on timeout instead of leaving the job pending', async () => {
  const started = Date.now();
  await assert.rejects(new DeliveryRuntime().command(process.execPath, ['-e', 'setTimeout(()=>{},2000)'], process.cwd(), undefined, { timeout: 100 }),
    error => error.execution?.passed === false && /límite/.test(error.message));
  assert.ok(Date.now() - started < 5000);
});

test('preview flags cannot fabricate command screen approvals', () => {
  assert.throws(() => applyCommandScreens([{ decisionQuestionId: 'missing', decisionHash: 'stale', operationId: 'read',
    screen: { id: 'screen', route: '/screen', roles: ['Reader'] } }], [], [], {}, { allowUnapproved: true, ignoreStale: true }), /UNAPPROVED_COMMAND_SCREEN/);
});

test('hybrid chat actually calls two providers and reports partial failure with consumption', async () => {
  const called = [];
  const result = await answerWithProviders('hybrid', 'Question', [], name => ({ async executePrompt() {
    called.push(name);
    if (name === 'anthropic') throw new Error('Reviewer unavailable');
    return { data: { answer: 'Draft' }, usage: { input_tokens: 5 }, model: 'test-double' };
  } }));
  assert.deepEqual(called, ['openai', 'anthropic']);
  assert.equal(result.providerStatus, 'PARTIAL');
  assert.equal(result.calls[0].usage.input_tokens, 5);
  assert.equal(result.calls[1].status, 'FAILED');
  assert.equal((await answerWithProviders('local', 'Question', [], () => { throw new Error('Must not be called'); })).providerStatus, 'LOCAL');
});
