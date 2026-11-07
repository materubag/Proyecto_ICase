// Seal the exact tested tree; never regenerate or repair files during packaging.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const integrity = require('../src/services/codegen/exportIntegrity');
const root = path.resolve(__dirname, '../..');
const pointer = path.join(root, '.verification/autron5-last-export.json');
const meta = JSON.parse(fs.readFileSync(pointer));
const directory = path.resolve(meta.directory);
assert.ok(directory.startsWith(path.join(root, '.verification') + path.sep));
const report = JSON.parse(fs.readFileSync(path.join(directory, 'acceptance-results.json')));
assert.equal(report.passed, true, 'Real acceptance must pass before packaging');
assert.equal(report.browserPassed, true, 'Real browser acceptance required');
const tested = integrity.snapshotFiles(directory, report.testedFiles.map(f => f.path));
assert.equal(integrity.fingerprint(tested), report.testedSourceHash, 'Files differ from the tested tree');
for (const file of tested) assert.equal(integrity.sha256(file.content), report.testedFiles.find(f => f.path === file.path).sha256);
const spec = JSON.parse(fs.readFileSync(path.join(directory, 'icase.spec.json')));
const provenance = JSON.parse(fs.readFileSync(path.join(directory, 'GENERATOR_PROVENANCE.json')));
assert.equal(provenance.generatorHash, integrity.generatorProvenance(spec).generatorHash, 'Generator changed after regeneration');
assert.equal(provenance.specHash, require('../src/services/codegen/projectSpecBuilder').computeCanonicalHash(spec));
const auxiliary = ['acceptance-results.json', 'visual-review-results.json', 'AUDITORIA_24_HALLAZGOS_2026-11-03.md', 'CODEGEN_REQUIREMENTS_2026-11-03.md', 'CODEGEN_AI_2026-11-04.md', 'unit-regressions.log', 'icase-frontend-build.log'];
const visuals = JSON.parse(fs.readFileSync(path.join(directory, 'visual-review-results.json')));
assert.equal(visuals.screenshots.length, 72);
assert.equal(visuals.errors.length, 0);
assert.equal(visuals.consoleErrors.length, 0);
const images = [...report.screenshots, ...visuals.screenshots].map(f => path.relative(directory, f));
const paths = [...new Set([...tested.map(f => f.path), ...auxiliary, ...images])];
const files = integrity.snapshotFiles(directory, paths);
const sealed = integrity.bundleVerifiedFiles(files, { tested: true, ready: false, scope: report.scope, realPostgres: true, realBrowser: true,
  aiProvider: 'NOT_INVOKED_FOR_AUTRON_EXPORT', testedSourceHash: report.testedSourceHash, generatorHash: provenance.generatorHash,
  testedFiles: report.testedFiles, visualFixtures: { behaviorAcceptance: false, screenshots: visuals.screenshots.length }, fixtureLimitations: report.fixtureLimitations });
const zip = path.join(root, '.verification/AUTRON-auditoria-reparada.zip');
fs.writeFileSync(zip, sealed.buffer);
// Independently read the ZIP payload and compare every entry to the tested disk.
const entries = integrity.readZip(fs.readFileSync(zip));
assert.equal(entries.length, files.length + 1);
for (const file of files) assert.deepEqual(entries.find(e => e.path === file.path)?.content, file.content, file.path);
const verification = { zip, sha256: sealed.sha256, entries: sealed.entries, payloadFiles: files.length, testedSourceFiles: tested.length,
  testedSourceHash: report.testedSourceHash, exactBytesVerified: true, generatorMatchesRegeneration: true, ready: false };
fs.writeFileSync(zip + '.verification.json', JSON.stringify(verification, null, 2));
fs.writeFileSync(pointer, JSON.stringify({ ...meta, zip, zipSha256: sealed.sha256, verification }, null, 2));
console.log(JSON.stringify(verification));
