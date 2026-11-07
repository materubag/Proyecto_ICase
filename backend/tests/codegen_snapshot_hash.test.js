const test = require('node:test');
const assert = require('node:assert/strict');
const { computeCanonicalHash, verifySpecHash } = require('../src/services/codegen/projectSpecBuilder');
const projectSpecService = require('../src/services/codegen/projectSpec.service');

test('Snapshot Hash: A newly approved spec passes cryptographic hash verification', () => {
  const spec = {
    schemaVersion: '1.0.0',
    specVersion: 1,
    approvedAt: '2026-10-26T12:00:00.000Z',
    project: { id: 'proj-1', name: 'Sistema Gestión' },
    entities: [{ id: 'ent-1', name: 'Producto', modelName: 'Producto' }],
    requirements: [{ id: 'rf-1', code: 'RF-01', name: 'Crear Producto' }],
    operations: [],
    screens: []
  };

  // Stamp hash canonically
  spec.hash = computeCanonicalHash(spec);

  assert.ok(spec.hash, 'Hash should be computed');
  assert.equal(typeof spec.hash, 'string');
  assert.equal(spec.hash.length, 64, 'SHA-256 hash must be 64 hex characters');

  // Verification must succeed
  assert.equal(verifySpecHash(spec), true, 'Newly approved spec must pass verification');
});

test('Snapshot Hash: Property order in JSON does not affect the canonical hash', () => {
  const spec1 = {
    schemaVersion: '1.0.0',
    project: { name: 'App', id: '123' },
    entities: [{ name: 'A', id: '1' }]
  };

  const spec2 = {
    entities: [{ id: '1', name: 'A' }],
    project: { id: '123', name: 'App' },
    schemaVersion: '1.0.0'
  };

  const hash1 = computeCanonicalHash(spec1);
  const hash2 = computeCanonicalHash(spec2);

  assert.equal(hash1, hash2, 'Hash must be strictly independent of JSON property ordering');
});

test('Snapshot Hash: The hash property is strictly excluded from its own calculation', () => {
  const specWithoutHash = {
    schemaVersion: '1.0.0',
    project: { name: 'App' },
    entities: []
  };

  const specWithHash = {
    ...specWithoutHash,
    hash: 'previous_or_dummy_hash_value'
  };

  const hashA = computeCanonicalHash(specWithoutHash);
  const hashB = computeCanonicalHash(specWithHash);

  assert.equal(hashA, hashB, 'computeCanonicalHash must exclude the root hash property so that verification is idempotent');
});

test('Snapshot Hash: Modifying any property in the snapshot produces SPEC_HASH_INTEGRITY_FAILED', async () => {
  const spec = {
    schemaVersion: '1.0.0',
    specVersion: 1,
    approvedAt: '2026-10-26T12:00:00.000Z',
    project: { id: 'proj-1', name: 'Sistema Clínico' },
    entities: [{ id: 'ent-1', name: 'Paciente', modelName: 'Paciente' }],
    requirements: []
  };

  spec.hash = computeCanonicalHash(spec);

  // Tamper with the snapshot content
  const tamperedSpec = JSON.parse(JSON.stringify(spec));
  tamperedSpec.entities[0].name = 'PacienteModificado';

  assert.equal(verifySpecHash(tamperedSpec), false, 'Tampered snapshot must fail verifySpecHash');

  const freshness = await projectSpecService.checkSpecFreshness('proj-1', tamperedSpec);
  assert.equal(freshness.upToDate, false);
  assert.equal(freshness.reason, 'SPEC_HASH_INTEGRITY_FAILED');
});
