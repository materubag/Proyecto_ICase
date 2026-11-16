const test = require('node:test');
const assert = require('node:assert/strict');
const generator = require('../src/services/codegen/codeGenerator.service');
const delivery = require('../src/services/codegen/deliveryWorkflow');
const controller = require('../src/controllers/codegen.controller');
const { readZip } = require('../src/services/codegen/exportIntegrity');

function response() {
  return {
    headers: {}, statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; return this; },
    set(name, value) { return this.setHeader(name, value); },
    type(value) { this.contentType = value; return this; },
    attachment(value) { this.filename = value; return this; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; }
  };
}

test('both download endpoints explicitly request review files when verified delivery is unavailable', async () => {
  const previous = { service: delivery.service, archive: generator.generateZipArchive };
  const bytes = Buffer.from('review archive');
  try {
    delivery.service = () => ({ archive: async () => { throw new Error('Unverified stages'); } });
    generator.generateZipArchive = async (id, options) => {
      assert.equal(id, 'review-project');
      assert.equal(options.reviewOnly, true);
      assert.equal(options.allowUnapproved, true);
      return { filename: 'project-revision.zip', buffer: bytes };
    };
    const router = require('../src/routes/delivery.routes');
    const handler = router.stack.find(layer => layer.route?.path === '/download').route.stack[0].handle;
    for (const download of [handler, controller.downloadZip]) {
      const res = response();
      await download({ params: { projectId: 'review-project' }, query: {} }, res, error => { throw error; });
      assert.equal(res.body, bytes);
      assert.equal(res.headers['X-ICASE-Verification'], 'NOT_RUN');
      assert.match(res.headers['Content-Disposition'], /project-revision.zip/);
    }
  } finally {
    delivery.service = previous.service;
    generator.generateZipArchive = previous.archive;
  }
});

test('review ZIP retains blocking diagnostics and an unverified manifest', async () => {
  const previous = generator.generateProjectFiles;
  const diagnostics = { ready: false, errors: [{ code: 'UNDEFINED_OPERATION_BEHAVIOR' }] };
  try {
    generator.generateProjectFiles = async () => ({ projectName: 'Review', ready: false, reviewOnly: true, diagnostics,
      files: [{ path: 'REVIEW_STATUS.json', content: JSON.stringify({ ready: false, notForDeployment: true, diagnostics }) }] });
    const result = await generator.generateZipArchive('review-project', { reviewOnly: true });
    assert.equal(result.filename, 'review-revision.zip');
    assert.equal(result.verification, 'NOT_RUN');
    assert.equal(result.contractReady, false);
    const files = readZip(result.buffer);
    const report = JSON.parse(files.find(file => file.path === 'REVIEW_STATUS.json').content);
    assert.deepEqual(report.diagnostics, diagnostics);
    const manifest = JSON.parse(files.find(file => file.path === 'BUNDLE_MANIFEST.json').content);
    assert.equal(manifest.verification.tested, false);
    assert.equal(manifest.verification.contractReady, false);
  } finally { generator.generateProjectFiles = previous; }
});

test('review mode still rejects structural specification errors', async () => {
  const previous = generator.getProjectArtifacts;
  try {
    generator.getProjectArtifacts = async () => ({ spec: { project: { id: 'empty' }, entities: [] },
      diagnostics: { ready: false, errors: [{ code: 'NO_APPROVED_ENTITIES' }] } });
    const result = await generator.generateProjectFiles('empty', { reviewOnly: true });
    assert.equal(result.ready, false);
    assert.deepEqual(result.files, []);
  } finally { generator.getProjectArtifacts = previous; }
});

test('unimplemented audit repairs cannot report that changes were applied', async () => {
  const prisma = require('../src/config/prisma');
  const previous = prisma.project.findUnique;
  try {
    prisma.project.findUnique = async () => ({ id: 'review-project' });
    const res = response();
    await controller.applyStageAuditFixes({ params: { projectId: 'review-project', stageId: '6' } }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'AUDIT_FIXES_NOT_IMPLEMENTED');
  } finally { prisma.project.findUnique = previous; }
});
