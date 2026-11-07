const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function serviceFixture() {
  const scheduled = [];
  const module = { exports: {} };
  const filename = path.resolve(__dirname, '../src/services/codegen/codegenJob.service.js');
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, process, console,
    setImmediate: callback => scheduled.push(callback),
    require: name => {
      if (name === 'fs') return { existsSync: () => true, readdirSync: () => [] };
      if (name === 'path') return path;
      if (name === 'crypto') return require('node:crypto');
      return {};
    }
  }, { filename });
  const service = module.exports;
  service.saveJob = job => service.memoryJobs.set(job.id, job);
  service.getActiveJob = projectId => [...service.memoryJobs.values()].find(job => job.projectId === projectId);
  return { service, scheduled };
}

test('new jobs have no time/token cap, even with legacy client limits', async () => {
  const { service, scheduled } = serviceFixture();
  const job = await service.startJob('budget_test', { maxTokens: 50000, timeoutMs: 1, maxRepairAttempts: 3 });
  assert.equal(job.budget.maxTokens, null);
  assert.equal(job.budget.timeoutMs, null);
  assert.equal(job.budget.maxRepairAttempts, 3);
  assert.equal(scheduled.length, 1);
});

test('waiting for answers does not block legacy jobs after their old budget expires', async () => {
  const { service } = serviceFixture();
  const job = await service.startJob('legacy_budget');
  job.status = 'WAITING_FOR_INPUT';
  job.metrics.startedAt = '2000-01-01T00:00:00.000Z';
  job.metrics.totalTokens = 118214;
  job.budget = { maxTokens: 50000, timeoutMs: 1 };
  await service.runPipeline(job.id);
  assert.equal(job.status, 'WAITING_FOR_INPUT');
});

test('starting again resumes the same budget-blocked job and preserves decisions', async () => {
  const { service, scheduled } = serviceFixture();
  const job = await service.startJob('resume_budget');
  service.queuedJobs.clear();
  job.status = 'BLOCKED';
  job.stageMessage = 'Se alcanzó el presupuesto de tiempo o tokens. Revise los resultados antes de iniciar otro trabajo.';
  job.decisions = { customerAccess: { value: 'own-records' } };
  const resumed = await service.startJob('resume_budget');
  assert.equal(resumed.id, job.id);
  assert.equal(resumed.status, 'ANALYZING');
  assert.equal(resumed.decisions.customerAccess.value, 'own-records');
  assert.equal(resumed.budget.maxTokens, null);
  assert.equal(scheduled.length, 2);
  assert.equal((await service.startJob('resume_budget')).id, job.id);
  assert.equal(scheduled.length, 2, 'No duplicate execution when already resumed');
});

test('missing acceptance scenarios resume in repair without duplicating the job', async () => {
  const { service } = serviceFixture();
  const job = await service.startJob('resume_scenarios', { enableAI: true });
  service.queuedJobs.clear();
  job.status = 'BLOCKED';
  job.verificationReport = { errors: [{ stage: 'BEHAVIOR', code: 'UNRESOLVED_ACCEPTANCE_SCENARIOS' }] };
  const resumed = await service.startJob(job.projectId);
  assert.equal(resumed.id, job.id);
  assert.equal(resumed.status, 'REPAIRING');
  await service.runPipeline(job.id);
  assert.equal(job.status, 'GENERATING');
  assert.equal(job.metrics.repairAttempts, 1);
  assert.ok(job.repairFeedback.includes('UNRESOLVED_ACCEPTANCE_SCENARIOS'));
});

test('startup detects orphaned execution, preserves stage and decisions, and resumes once', async () => {
  const { service, scheduled } = serviceFixture();
  const job = await service.startJob('orphaned', { enableAI: true });
  service.queuedJobs.clear();
  job.status = 'GENERATING';
  job.decisions = { access: 'own-records' };
  const count = scheduled.length;
  assert.equal(service.recoverInterruptedJobs().length, 1);
  assert.equal(job.status, 'INTERRUPTED');
  assert.equal(job.resumeStage, 'GENERATING');
  assert.equal(scheduled.length, count, 'Startup does not silently launch AI requests');
  assert.equal((await service.startJob(job.projectId)).id, job.id);
  assert.equal(job.status, 'GENERATING');
  assert.equal(job.decisions.access, 'own-records');
  assert.equal((await service.resumeJob(job.id)).resumed, false);
  assert.equal(scheduled.length, count + 1, 'Duplicate resume cannot schedule a second worker');
  assert.equal(service.recoverInterruptedJobs().length, 0, 'Queued work is not marked interrupted');
});

test('one worker runs per job and async errors cannot leave a fake active status', async () => {
  const { service } = serviceFixture();
  const job = await service.startJob('worker');
  let calls = 0, release;
  service.executePipeline = async () => { calls++; await new Promise(resolve => { release = resolve; }); throw new Error('provider unavailable'); };
  const running = service.runPipeline(job.id);
  await service.runPipeline(job.id);
  assert.equal(calls, 1);
  release();
  await assert.rejects(running, /provider unavailable/);
  assert.equal(job.status, 'FAILED');
  assert.equal(service.runningJobs.has(job.id), false);
  assert.match(job.stageMessage, /provider unavailable/);
});

test('startup leaves unanswered clarifications and terminal jobs unchanged', async () => {
  const { service } = serviceFixture();
  for (const status of ['WAITING_FOR_INPUT', 'COMPLETED', 'BLOCKED', 'FAILED', 'CANCELLED']) {
    const job = await service.startJob('preserve_' + status);
    service.queuedJobs.clear();
    job.status = status;
  }
  assert.equal(service.recoverInterruptedJobs().length, 0);
});
