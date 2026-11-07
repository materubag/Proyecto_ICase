const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

test('explicit navigation approval synchronizes both states; rejection creates no node', async () => {
  const filename = path.resolve(__dirname, '../src/services/engineering/model.service.js');
  const actual = createRequire(filename);
  const created = [];
  const candidate = { id: 'candidate', status: 'PENDING_REVIEW', kind: 'NavigationNode', content: { name: 'Dashboard', route: '/dashboard', platform: 'WEB' }, requirementIds: ['r'], evidence: [{ requirementId: 'r', revision: 1 }] };
  const tx = {
    modelCandidate: { findFirst: async () => candidate, update: async ({ data }) => data },
    navigationNode: { findFirst: async () => null, create: async ({ data }) => { created.push(data); return { id: 'node', ...data }; } }
  };
  const domain = { transaction: fn => fn(tx), delegates: { NavigationNode: 'navigationNode' }, approvedRequirements: async () => [{ id: 'r', revision: 1 }], link: async () => {}, fail: code => { throw new Error(code); } };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, require: key => key === './domain' ? domain : actual(key) }, { filename });
  await module.exports.review('project', 'candidate', { status: 'APPROVED' });
  assert.equal(created.length, 1);
  assert.equal(created[0].status, 'APPROVED');
  assert.equal(created[0].reviewStatus, 'APPROVED');
  const { checkApproval } = require('../src/services/codegen/projectSpecBuilder');
  assert.equal(checkApproval(created[0]).approved, true);
  await module.exports.review('project', 'candidate', { status: 'REJECTED' });
  assert.equal(created.length, 1);
});
