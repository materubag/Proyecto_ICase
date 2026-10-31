// Runs exclusively in a newly created random schema; paid APIs are disabled.
require('./fixtures/offline.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const base = process.env.FLOW_TEST_DATABASE_URL;
if (!base) throw new Error('Set FLOW_TEST_DATABASE_URL. Production schemas are never used for these tests.');
const schema = 'icase_flow_test_' + crypto.randomBytes(8).toString('hex');
const url = new URL(base); url.searchParams.set('schema', schema);
process.env.DATABASE_URL = url.toString();
const admin = new PrismaClient({ datasources: { db: { url: base } } });
const prisma = require('../src/config/prisma');
const pipeline = require('../src/services/analysis/analysisPipeline');
const { AIService: ai } = require('../src/services/ai/AIService');
const candidates = require('../src/services/analysis/candidate.service');
const fixtureProvider = require('./fixtures/requirementFlowProvider.cjs');
const evidenceRows = [];
async function verifyPartialRecovery() {
  const project = await prisma.project.create({ data: { name: 'Partial retry fixture' } });
  const source = await sourceFor(project, Array.from({ length: 17 }, () => '- Se necesita exportar informes.').join('\n'));
  let first = true, calls = 0;
  const fixture = fixtureProvider();
  const providerInstance = { async extractDocumentBatch(input, options) {
    calls++; if (first && options.batchIndex === 2) throw new Error('Fixture outage');
    return fixture.extractDocumentBatch(input, options);
  } };
  const options = { sourceId: source.id, providerInstance, providerOverride: 'openai', modelOverride: 'fixture', cache: false };
  const partial = await pipeline.run(options);
  assert.equal(partial.partial, true); assert.equal(calls, 3);
  first = false;
  const completed = await pipeline.run(options);
  assert.equal(completed.partial, false); assert.equal(calls, 4);
  assert.equal(completed.metrics.reusedSemanticBatches, 2);
  assert.equal(await prisma.requirementCandidate.count({ where: { projectId: project.id } }), 1);
  assert.equal(completed.extraction.requirements[0].evidence.length, 17);
  return { firstRequests: 3, retryRequests: 1, successfulBatchesReused: 2, candidates: 1, evidenceOccurrences: 17 };
}
async function verifyCleanup() {
  const read = name => JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../docs/autron-audit', name), 'utf8').replace(/^\uFEFF/, ''));
  const plan = read('duplicate-cleanup-plan.json');
  await prisma.project.create({ data: { id: plan.projectId, name: 'Existing AUTRON snapshot (isolated copy)' } });
  const audit = read('audit-104.json');
  const originalText = fs.readFileSync(path.resolve(__dirname, '../../docs/autron-audit/autron-source.txt'), 'utf8');
  await prisma.source.create({ data: { id: audit.sourceId, projectId: plan.projectId, name: audit.sourceFile, type: 'PDF', fileHash: audit.sourceFileHash } });
  await prisma.sourceVersion.create({ data: { id: audit.sourceVersionId, sourceId: audit.sourceId, version: 1, fileHash: audit.sourceFileHash, extractedText: originalText } });
  await prisma.source.update({ where: { id: audit.sourceId }, data: { currentVersionId: audit.sourceVersionId } });
  const { Prisma } = require('@prisma/client');
  for (const row of read('requirements.json').data) {
    const data = { ...row, sources: row.sources || Prisma.JsonNull };
    await prisma.requirement.create({ data });
  }
  for (const c of read('candidates-all.json').data.filter(c => c.kind === 'REQUIREMENT')) {
    await prisma.requirementCandidate.create({ data: {
      id: c.id, projectId: c.projectId, temporaryCode: c.temporaryCode, title: c.title, statement: c.statement,
      originalStatement: c.originalStatement, type: c.type, category: c.category, priority: c.priority,
      origin: c.origin, confidence: c.confidence, status: c.status, rejectionReason: c.rejectionReason,
      evidence: c.evidence, qualityReport: c.qualityReport, promotedRequirementId: c.promotedId,
      sourceId: c.source?.id || null, sourceVersionId: c.sourceVersion?.id || null,
      createdAt: c.createdAt, updatedAt: c.updatedAt
    } });
  }
  const cleanup = require('../src/services/analysis/duplicateCleanup');
  const snapshot = async () => JSON.stringify({
    requirements: await prisma.requirement.findMany({ where: { projectId: plan.projectId }, orderBy: { id: 'asc' } }),
    candidates: await prisma.requirementCandidate.findMany({ where: { projectId: plan.projectId }, orderBy: { id: 'asc' } })
  });
  const before = await snapshot();
  await assert.rejects(cleanup.apply(prisma, plan, () => { throw new Error('Backup disk failure'); }), /Backup disk failure/);
  assert.equal(await snapshot(), before);
  const screen = await prisma.screen.create({ data: { projectId: plan.projectId, name: 'Reference blocker fixture', route: '/fixture',
    requirementIds: [plan.operations[0].duplicateRequirementIds[0]] } });
  await assert.rejects(cleanup.apply(prisma, plan), /Referencias activas en screen/);
  assert.equal(await snapshot(), before);
  await prisma.screen.delete({ where: { id: screen.id } });
  const receipt = await cleanup.apply(prisma, plan);
  const active = await prisma.requirement.count({ where: { projectId: plan.projectId, isDeleted: false } });
  assert.equal(active, 55);
  assert.equal(await prisma.requirement.count({ where: { projectId: plan.projectId } }), 104);
  const keeper = await prisma.requirementCandidate.findUnique({ where: { id: plan.operations[0].canonicalCandidateId } });
  assert.ok(keeper.evidence.legacyCandidateIds.length > 1);
  await cleanup.rollback(prisma, plan, receipt);
  assert.equal(await snapshot(), before); // Exact UUIDs, timestamps, evidence, status, and associations restored.
  const localOnly = { providerOverride: 'openai', modelOverride: 'fixture', cache: false,
    providerInstance: { async extractDocumentBatch(input) { return { data: { coveredSegmentIds: input.segments.map(s => s.id),
      requirements: [], actors: [], links: [], other: [] } }; } } };
  const counts = [];
  await pipeline.run({ ...localOnly, sourceId: audit.sourceId }); counts.push(await prisma.requirementCandidate.count({ where: { projectId: plan.projectId } }));
  await ai.analyzeProject({ ...localOnly, projectId: plan.projectId }); counts.push(await prisma.requirementCandidate.count({ where: { projectId: plan.projectId } }));
  await pipeline.run({ ...localOnly, sourceId: audit.sourceId, force: true }); counts.push(await prisma.requirementCandidate.count({ where: { projectId: plan.projectId } }));
  assert.deepEqual(counts, [104,104,104]);
  const corrected = await prisma.requirementCandidate.findFirst({ where: { projectId: plan.projectId,
    sourceVersionId: audit.sourceVersionId, evidence: { path: ['originalCode'], equals: 'RF-24' }, canonicalKey: { not: null } } });
  assert.equal(corrected.evidence.statementCorrection.proposed, 'Generar alertas de bajo stock.');
  assert.equal(corrected.statement, corrected.evidence.statementCorrection.previous);
  return { inputPromotedRows: 104, copiesSoftDeleted: 49, activeAfterExactCopyMerge: active,
    rollback: '104 rows and full before-state restored', blockedOnActiveScreenReference: true,
    rollbackOnBackupFailure: true, legacyReanalysisWithoutCleanup: counts,
    legacyRf24Correction: 'retained as review on existing UUID; approved text preserved', appliedToLiveDatabase: false };
}
async function sourceFor(project, text) {
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  const source = await prisma.source.create({ data: { projectId: project.id, name: project.name + '.txt', fileHash: hash, type: 'PDF' } });
  const version = await prisma.sourceVersion.create({ data: { sourceId: source.id, version: 1, fileHash: hash, extractedText: text } });
  await prisma.source.update({ where: { id: source.id }, data: { currentVersionId: version.id } });
  return source;
}
async function check(name, text, description, expected) {
  const project = await prisma.project.create({ data: { name, description } });
  const source = await sourceFor(project, text);
  const providerInstance = fixtureProvider();
  const options = { providerInstance, providerOverride: 'openai', modelOverride: 'fixture', cache: false };
  const count = () => prisma.requirementCandidate.count({ where: { projectId: project.id } });
  const steps = [];
  const first = await pipeline.run({ ...options, sourceId: source.id });
  assert.equal(first.partial, false); steps.push(await count());
  const ids = (await prisma.requirementCandidate.findMany({ where: { projectId: project.id } })).map(r => r.id).sort();
  const afterSourceCalls = providerInstance.calls.length;
  const projectResult = await ai.analyzeProject({ ...options, projectId: project.id });
  assert.equal(projectResult.partial, false); assert.equal(projectResult.metrics.reusedSources, 1);
  if (!description) assert.equal(providerInstance.calls.length, afterSourceCalls);
  steps.push(await count());
  await pipeline.run({ ...options, sourceId: source.id, force: true }); steps.push(await count());
  await ai.analyzeProject({ ...options, projectId: project.id }); steps.push(await count());
  await Promise.all([pipeline.run({ ...options, sourceId: source.id, force: true }), pipeline.run({ ...options, sourceId: source.id, force: true })]);
  steps.push(await count());
  assert.ok(steps.every(n => n === expected));
  const rows = await prisma.requirementCandidate.findMany({ where: { projectId: project.id } });
  assert.deepEqual(rows.map(r => r.id).sort(), ids);
  for (const row of rows) assert.ok(row.evidence.segments.length);
  const actorRows = await prisma.modelCandidate.findMany({ where: { projectId: project.id, kind: 'ACTOR' } });
  for (const actor of actorRows) await candidates.approve(actor.id);
  for (const row of rows) { await candidates.approve(row.id); await candidates.approve(row.id); }
  assert.equal(await prisma.requirement.count({ where: { projectId: project.id, isDeleted: false } }), expected);
  await pipeline.run({ ...options, sourceId: source.id, force: true });
  assert.equal(await count(), expected);
  assert.equal(await prisma.requirement.count({ where: { projectId: project.id, isDeleted: false } }), expected);
  if (actorRows.length) {
    const req = await prisma.requirement.findFirst({ where: { projectId: project.id, description: 'Registrar pedidos.' } });
    if (req) assert.equal(req.actorIds.length, 1);
    else assert.ok((await prisma.requirement.findMany({ where: { projectId: project.id } })).some(r => r.actorIds.length > 0));
  }
  evidenceRows.push({ document: name, steps: ['source','project','source force','project again','parallel reanalysis'], candidates: steps,
    promotedAfterRepeatedApproval: expected, actorCandidates: actorRows.length });
  return { project, rows, source, options };
}
(async () => {
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const pushed = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--skip-generate'], {
      cwd: path.resolve(__dirname, '..'), env: process.env, encoding: 'utf8' });
    if (pushed.status !== 0) throw new Error(pushed.stderr || pushed.stdout);
    // Validate the actual incremental SQL against the prior schema shape.
    await prisma.$executeRawUnsafe('ALTER TABLE "requirement_candidates" DROP COLUMN "canonicalKey"');
    await prisma.$executeRawUnsafe('ALTER TABLE "requirements" DROP COLUMN "canonicalKey"');
    await prisma.$executeRawUnsafe('DROP INDEX "requirement_candidates_promotedRequirementId_idx"');
    await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX "requirement_candidates_promotedRequirementId_key" ON "requirement_candidates"("promotedRequirementId")');
    const migration = fs.readFileSync(path.resolve(__dirname, '../prisma/migrations/202610040001_requirement_identity/migration.sql'), 'utf8');
    for (const sql of migration.split(';').filter(s => s.trim())) await prisma.$executeRawUnsafe(sql);
    await check('Enumerado', 'RF-01 Registrar pedidos.\n\nLa operadora registra pedidos.', '', 1);
    await check('Narrativo', 'La operadora registra pedidos.\n\nSe necesita exportar informes.', '', 2);
    await check('Mixto', 'RF-01 Registrar pedidos.\n\nLa operadora registra pedidos.\n\nSe necesita exportar informes.\n\nPosiblemente convenga archivar pedidos.', '', 3);
    const autronText = fs.readFileSync(path.resolve(__dirname, '../../docs/autron-audit/autron-source.txt'), 'utf8');
    const autron = await check('AUTRON (respuesta semántica controlada)', autronText, 'Dashboard y reportes básicos.', 47);
    const originals = autron.rows.filter(r => r.evidence.originalCode);
    assert.equal(originals.length, 46); assert.equal(new Set(originals.map(r => r.evidence.originalCode)).size, 46);
    assert.equal(originals.find(r => r.evidence.originalCode === 'RF-24').statement, 'Generar alertas de bajo stock.');
    // Identical original code is not a global identity across different documents.
    const second = await sourceFor(autron.project, 'RF-01 Gestionar devoluciones.');
    await pipeline.run({ ...autron.options, sourceId: second.id });
    assert.equal(await prisma.requirementCandidate.count({ where: { projectId: autron.project.id } }), 48);
    // Same content in another source merges provenance into the existing canonical row.
    const third = await sourceFor(autron.project, 'RF-88 Registrar las operaciones críticas para auditoría.');
    await pipeline.run({ ...autron.options, sourceId: third.id });
    assert.equal(await prisma.requirementCandidate.count({ where: { projectId: autron.project.id } }), 48);
    const merged = await prisma.requirementCandidate.findFirst({ where: { projectId: autron.project.id, statement: 'Registrar las operaciones críticas para auditoría.' } });
    assert.ok(merged.evidence.originalCodes.includes('RF-88'));
    assert.equal(new Set(merged.evidence.segments.map(e => e.sourceId)).size, 2);
    assert.equal(await prisma.artifactRelation.count({ where: { projectId: autron.project.id, fromType: 'Source',
      toType: 'Requirement', toId: merged.promotedRequirementId, relation: 'EVIDENCE' } }), 2);
    const cleanup = await verifyCleanup();
    const partialRecovery = await verifyPartialRecovery();
    const report = { database: 'PostgreSQL, isolated temporary schema', migrationSqlValidated: true, paidApiCalls: 0, cases: evidenceRows, cleanup, partialRecovery,
      crossDocumentCodeCollision: 'distinct requirement retained', crossSourceExactCopy: 'merged with both sources', cleanupAppliedToExistingAutron: false };
    fs.writeFileSync(path.resolve(__dirname, '../../docs/autron-audit/flow-verification.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
    if (!/^icase_flow_test_[a-f0-9]{16}$/.test(schema) || new URL(process.env.DATABASE_URL).searchParams.get('schema') !== schema) throw new Error('Unsafe cleanup target');
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
