// Copied to exported applications. Only declared internal operations can run.
const jobs = require('./system-operations.json');
const service = require('./operation.service');
const { systemIdentity } = require('./operation.runtime');
let running = null, queued = false, timer = null;
async function run() {
  if (running) { queued = true; return running; }
  running = (async () => {
    for (const job of jobs) await service[job.functionName]({}, systemIdentity());
  })();
  try { await running; } finally {
    running = null;
    if (queued) { queued = false; requestRun(); }
  }
}
function requestRun() {
  setImmediate(() => run().catch(error => console.error('System operation failed:', error.code || error.name)));
}
function start() {
  if (timer || !jobs.length) return;
  requestRun();
  const interval = Math.min(...jobs.map(job => job.intervalMs));
  timer = setInterval(requestRun, interval);
  timer.unref();
}
module.exports = { start, requestRun, run };
