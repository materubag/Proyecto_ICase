const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

function isolated(name, stubs = {}) {
  const filename = path.resolve(__dirname, '../src/services/codegen', name);
  const module = { exports: {} }, actual = createRequire(filename);
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, process, console, Buffer, __dirname: path.dirname(filename), setImmediate: () => { throw new Error('AI must not be scheduled'); }, require: key => Object.hasOwn(stubs, key) ? stubs[key] : actual(key) });
  return module.exports;
}

test('project hold survives module reload and does not affect other projects', () => {
  const files = new Map();
  const disk = { existsSync: file => files.has(file), mkdirSync: () => {}, writeFileSync: (file, value) => files.set(file, value), readFileSync: file => files.get(file) };
  const hold = isolated('codegenAiHold.js', { 'node:fs': disk });
  hold.assertAllowed('project');
  hold.holdProject('project', 'Technical work pending');
  const afterRestart = isolated('codegenAiHold.js', { 'node:fs': disk });
  assert.throws(() => afterRestart.assertAllowed('project'), error => error.code === 'AI_GENERATION_HELD' && error.statusCode === 409);
  afterRestart.assertAllowed('other-project');
  assert.throws(() => afterRestart.assertAllowed('../escape'), /INVALID_PROJECT_ID/);
});

test('held AI jobs cannot start, resume or execute a queued pipeline', async () => {
  const hold = { assertAllowed: () => { throw Object.assign(new Error('AI disabled for this project'), { code: 'AI_GENERATION_HELD' }); } };
  const service = isolated('codegenJob.service.js', { './codegenAiHold': hold });
  service.getJob = () => ({ id: 'job', projectId: 'project', enableAI: true, status: 'BLOCKED', planningBlockers: [] });
  await assert.rejects(service.startJob('project', { enableAI: true }), error => error.code === 'AI_GENERATION_HELD');
  await assert.rejects(service.resumeJob('job', { batchReview: true }), error => error.code === 'AI_GENERATION_HELD');
  await assert.rejects(service.executePipeline('job'), error => error.code === 'AI_GENERATION_HELD');
});

test('operation and screen planners reject held projects before any provider work', async () => {
  const hold = { assertAllowed: () => { throw Object.assign(new Error('No provider calls'), { code: 'AI_GENERATION_HELD' }); } };
  const operations = isolated('aiOperationPlanner.js', { './codegenAiHold': hold });
  const screens = isolated('aiScreenPlanner.js', { './codegenAiHold': hold });
  await assert.rejects(operations.planOperationSteps('project', {}, {}), error => error.code === 'AI_GENERATION_HELD');
  await assert.rejects(screens.planScreen('project', {}, {}), error => error.code === 'AI_GENERATION_HELD');
});

test('a cancelled active pointer never resurrects an older blocked AI job', () => {
  const service = isolated('codegenJob.service.js', {
    fs: { existsSync: () => true, readdirSync: () => [], readFileSync: () => JSON.stringify({ activeJobId: 'new' }) }
  });
  service.memoryJobs.set('old', { id: 'old', projectId: 'project', status: 'BLOCKED', enableAI: true, updatedAt: '2026-11-04' });
  service.memoryJobs.set('new', { id: 'new', projectId: 'project', status: 'CANCELLED', updatedAt: '2026-11-05' });
  assert.equal(service.getActiveJob('project'), null);
});

test('reviewed acceptance resolves only the registered project and exact trusted suite hash', () => {
  const registry = require('../src/services/codegen/reviewedAcceptanceRegistry');
  const project = { id: '6ba45264-e3e6-4819-a0dd-18909f1fb674' };
  const reviewedAcceptance = registry.descriptor(project.id, { id: 'autron-reviewed-v1' });
  assert.equal(typeof registry.resolve({ project, reviewedAcceptance }), 'function');
  assert.equal(registry.resolve({ project, reviewedAcceptance: { ...reviewedAcceptance, sha256: 'tampered' } }), undefined);
  assert.equal(registry.resolve({ project: { id: 'another-project' }, reviewedAcceptance }), undefined);
});
