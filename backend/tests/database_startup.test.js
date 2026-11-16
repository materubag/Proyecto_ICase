const test = require('node:test');
const assert = require('node:assert/strict');
const { waitForDatabase } = require('../src/config/waitForDatabase');
const connectionString = 'postgresql://private-user:private-password@postgres:5432/icase_db';

function fixture(failures) {
  const state = { connects: 0, queries: 0, closed: 0, sleeps: 0, logs: [] };
  class Client {
    async connect() {
      state.connects++;
      if (failures[state.connects - 1]) throw Object.assign(new Error('private details'), { code: failures[state.connects - 1] });
    }
    async query(sql) { assert.equal(sql, 'SELECT 1'); state.queries++; }
    async end() { state.closed++; }
  }
  return { state, options: { connectionString, Client, attempts: 3, delayMs: 0,
    sleep: async () => { state.sleeps++; }, log: line => state.logs.push(line) } };
}
test('startup waits for authenticated TCP before allowing Prisma to proceed', async () => {
  const { state, options } = fixture(['ENOTFOUND', 'ECONNREFUSED']);
  await waitForDatabase(options);
  assert.equal(state.connects, 3); assert.equal(state.queries, 1);
  assert.equal(state.closed, 3); assert.equal(state.sleeps, 2);
  assert.ok(!state.logs.join('').includes('private-'));
});
test('a disconnected database stops startup after a bounded number of attempts', async () => {
  const { state, options } = fixture(['ENOTFOUND', 'ENOTFOUND', 'ENOTFOUND']);
  await assert.rejects(waitForDatabase(options), { code: 'DB_UNAVAILABLE' });
  assert.equal(state.queries, 0); assert.equal(state.closed, 3); assert.equal(state.sleeps, 2);
});
test('wrong credentials fail immediately without leaking connection secrets', async () => {
  const { state, options } = fixture(['28P01']);
  await assert.rejects(waitForDatabase(options), error => error.code === '28P01' && !error.message.includes('private'));
  assert.equal(state.connects, 1); assert.equal(state.closed, 1); assert.equal(state.sleeps, 0);
});
