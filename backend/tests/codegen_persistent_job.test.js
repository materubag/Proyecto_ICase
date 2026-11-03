const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const codegenJobService = require('../src/services/codegen/codegenJob.service');

test('Codegen Persistent Job: 1. Creates persistent job and returns 202-ready job descriptor', async () => {
  const projectId = 'test_proj_job_1';
  const job = await codegenJobService.startJob(projectId, {
    scope: 'Cliente → Vehículo → Recepción',
    maxTokens: 30000,
    maxRepairAttempts: 2
  });

  assert.ok(job.id.startsWith('job_'), 'Job ID has prefix');
  assert.equal(job.projectId, projectId);
  assert.ok(['ANALYZING', 'WAITING_FOR_INPUT', 'GENERATING'].includes(job.status));
  assert.ok(job.budget.maxTokens === 30000);
  assert.ok(job.budget.maxRepairAttempts === 2);
  assert.ok(Array.isArray(job.logs), 'Logs array initialized');

  // Verify file exists on disk
  const jobFilePath = path.join(__dirname, '../.cache/codegen_jobs', `${job.id}.json`);
  assert.ok(fs.existsSync(jobFilePath), 'Job persisted to disk');
});

test('Codegen Persistent Job: 2. Prevents duplicate active jobs for the same project', async () => {
  const projectId = 'test_proj_job_2';
  const job1 = await codegenJobService.startJob(projectId);
  const job2 = await codegenJobService.startJob(projectId);

  assert.equal(job1.id, job2.id, 'Returns existing active job without creating a duplicate');
});

test('Codegen Persistent Job: 3. Recovers job from disk after clearing memory cache', async () => {
  const projectId = 'test_proj_job_3';
  const job = await codegenJobService.startJob(projectId);

  // Clear in-memory cache
  codegenJobService.memoryJobs.clear();
  assert.equal(codegenJobService.memoryJobs.size, 0);

  // Retrieve active job from disk
  const recovered = codegenJobService.getActiveJob(projectId);
  assert.ok(recovered, 'Job successfully recovered from disk');
  assert.equal(recovered.id, job.id);
  assert.equal(recovered.projectId, projectId);
});

test('Codegen Persistent Job: 4. Handles job cancellation gracefully', async () => {
  const projectId = 'test_proj_job_4';
  const job = await codegenJobService.startJob(projectId);
  const cancelled = await codegenJobService.cancelJob(job.id);

  assert.equal(cancelled.status, 'CANCELLED');
  assert.ok(cancelled.stageMessage.includes('cancelada'));

  const checked = codegenJobService.getJob(job.id);
  assert.equal(checked.status, 'CANCELLED');
});

