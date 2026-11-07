const fs = require('node:fs');
const crypto = require('node:crypto');

const projectId = '6ba45264-e3e6-4819-a0dd-18909f1fb674';
const suiteId = 'autron-reviewed-v1';
function source() { return fs.readFileSync(require.resolve('./reviewedAcceptance'), 'utf8'); }
function descriptor(id, declaration) {
  if (id !== projectId || declaration?.id !== suiteId) return undefined;
  return { id: suiteId, sha256: crypto.createHash('sha256').update(source()).digest('hex') };
}
function resolve(spec) {
  const expected = descriptor(spec.project?.id, spec.reviewedAcceptance);
  if (!expected || expected.sha256 !== spec.reviewedAcceptance.sha256) return undefined;
  return require('./reviewedAcceptance');
}
module.exports = { descriptor, resolve, source };
