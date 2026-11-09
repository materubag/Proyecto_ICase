const test = require('node:test');
const assert = require('node:assert/strict');
const projectPath = require.resolve('../src/services/project.service');
const artifactPath = require.resolve('../src/services/engineering/mockup-artifact.service');
let received;
require.cache[projectPath] = { id: projectPath, filename: projectPath, loaded: true,
  exports: { getProjectById: async () => ({ id: 'p' }) } };
require.cache[artifactPath] = { id: artifactPath, filename: artifactPath, loaded: true,
  exports: { generate: async (...args) => { received = args; return { screens: [{ name: 'Citas' }], versions: ['v'], status: 'PENDING_REVIEW' }; } } };
const controller = require('../src/controllers/mockup.controller');

test('mockup controller returns versioned screens and forwards selection and mode', async () => {
  let response;
  const res = { status(code) { assert.equal(code, 200); return this; }, json(body) { response = body; } };
  await controller.generate({ params: { projectId: 'p' }, body: { mode: 'local', screenIds: ['s'] } }, res, error => { throw error; });
  assert.deepEqual(response.data.screens, [{ name: 'Citas' }]);
  assert.deepEqual(response.data.versions, ['v']);
  assert.equal(response.data.status, 'PENDING_REVIEW');
  assert.deepEqual(received[4], { mode: 'local', screenIds: ['s'] });
});

test('invalid generation mode fails before calling the artifact service', async () => {
  received = null;
  const res = { status(code) { assert.equal(code, 400); return this; }, json(body) { assert.equal(body.success, false); } };
  await controller.generate({ params: { projectId: 'p' }, body: { mode: 'unknown' } }, res, error => { throw error; });
  assert.equal(received, null);
});
