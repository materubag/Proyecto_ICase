const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { createZipBuffer } = require('./zipHelper');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function generatorProvenance(spec, options = {}) {
  const files = fs.readdirSync(__dirname).filter(name => /\.(js|jsx)$/.test(name)).sort();
  const sources = Object.fromEntries(files.map(name => [name, sha256(fs.readFileSync(path.join(__dirname, name)))]));
  return { format: 1, generatorHash: sha256(JSON.stringify(sources)), sources,
    specHash: require('./projectSpecBuilder').computeCanonicalHash(spec), sourceFingerprint: spec.dependencyManifest?.sourceFingerprint,
    projectExtension: spec.projectContractExtension || null, options: { reviewOnly: options.reviewOnly === true, includeDocker: options.includeDocker !== false } };
}

function snapshotFiles(directory, paths) {
  return paths.map(name => {
    const target = path.resolve(directory, name);
    if (!target.startsWith(path.resolve(directory) + path.sep) || !fs.realpathSync(target).startsWith(fs.realpathSync(directory) + path.sep)) throw new Error('INVALID_BUNDLE_PATH');
    return { path: name.replace(/\\/g, '/'), content: fs.readFileSync(target) };
  }).sort((a, b) => a.path.localeCompare(b.path));
}

function fingerprint(files) {
  return sha256(JSON.stringify(files.map(file => [file.path, sha256(file.content)]).sort((a, b) => a[0].localeCompare(b[0]))));
}

function readZip(buffer) {
  const entries = [];
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const size = buffer.readUInt32LE(offset + 18), names = buffer.readUInt16LE(offset + 26), extra = buffer.readUInt16LE(offset + 28);
    const name = buffer.subarray(offset + 30, offset + 30 + names).toString('utf8');
    const start = offset + 30 + names + extra;
    entries.push({ path: name, content: zlib.inflateRawSync(buffer.subarray(start, start + size)) });
    offset = start + size;
  }
  return entries;
}

function bundleVerifiedFiles(files, verification = {}) {
  const uniqueMap = new Map();
  for (const file of files) {
    uniqueMap.set(String(file.path).replace(/\\/g, '/').toLowerCase(), file);
  }
  const cleanFiles = Array.from(uniqueMap.values());
  const manifest = { format: 1, verification, payloadHash: fingerprint(cleanFiles), files: cleanFiles.map(f => ({ path: f.path, bytes: f.content.length, sha256: sha256(f.content) })) };
  const payload = [...cleanFiles, { path: 'BUNDLE_MANIFEST.json', content: Buffer.from(JSON.stringify(manifest, null, 2)) }];
  const buffer = createZipBuffer(payload);
  const entries = readZip(buffer);
  if (entries.length !== payload.length || fingerprint(entries) !== fingerprint(payload)) throw new Error('ZIP_CONTENT_MISMATCH');
  return { buffer, manifest, sha256: sha256(buffer), entries: entries.length };
}
module.exports = { sha256, generatorProvenance, snapshotFiles, fingerprint, bundleVerifiedFiles, readZip };
