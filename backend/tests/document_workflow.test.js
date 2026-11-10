const { test } = require('node:test');
const assert = require('node:assert/strict');
const c = require('../src/services/analysis/workflowContext');
const { DocumentWorkflow, assertCatalog, assertLegacyApproval } = require('../src/services/analysis/documentWorkflow');

test('context selects literal units and validates version, page and section', () => {
  const units = [{ id: 'a', sourceVersionId: 'v1', text: 'La operadora registra pedidos.', page: 1, section: 'Ventas' }, { id: 'b', text: 'Otros datos' }];
  const state = { units, decisions: [], dependencies: {} };
  const item = { id: 'i', origin: 'EXPLICIT', evidence: [{ unitId: 'a', sourceVersionId: 'v1', quote: 'registra pedidos.', page: 1, section: 'Ventas' }] };
  c.validateEvidence(item, state);
  assert.equal(c.build({ task: 'review', state, unit: units[0], items: [item] }).evidence.length, 1);
  for (const change of [{ quote: 'ADMIN' }, { sourceVersionId: 'v2' }, { page: 2 }, { section: 'Compras' }]) assert.throws(() => c.validateEvidence({ ...item, evidence: [{ ...item.evidence[0], ...change }] }, state));
  assert.throws(() => c.validateEvidence({ ...item, evidence: [] }, state));
});
test('multiple participation roles and actor-free automatic requirements', () => {
  c.validateParticipants([{ participants: [{ actorId: 'a', role: 'EXECUTES' }, { actorId: 'b', role: 'APPROVES' }] }, { participants: [] }], [{ id: 'a' }, { id: 'b' }]);
  assert.throws(() => c.validateParticipants([{ participants: [{ actorId: 'unknown', role: 'EXECUTES' }] }], []));
  assert.throws(() => c.validateParticipants([{ participants: [{ actorId: 'a', role: 'ADMIN' }] }], [{ id: 'a' }]));
});

// The URL is explicit, and this suite refuses all non-test databases.
const url = process.env.WORKFLOW_TEST_DATABASE_URL;
test('persistent workflow with real PostgreSQL and simulated models', { skip: !url }, async t => {
  if (!/localhost:55439\/workflow_test(?:\?|$)/.test(url) && !/^postgresql:\/\/delivery_test:[^@]+@127\.0\.0\.1:\d+\/delivery_test(?:\?|$)/.test(url)) throw new Error('Use only an isolated workflow_test or delivery_test database');
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url } } });
  const project = await db.project.create({ data: { name: 'Workflow isolated test' } });
  const source = await db.source.create({ data: { projectId: project.id, name: 'test.pdf', type: 'PDF', fileHash: 'test-hash' } });
  const version = await db.sourceVersion.create({ data: { sourceId: source.id, version: 1, extractedText: '[PÁGINA 1]\nLa operadora registra pedidos.\n\nRF-01 Registrar pedidos.\n\nRNF-01 Conservar los datos.', fileHash: 'test-hash' } });
  await db.source.update({ where: { id: source.id }, data: { currentVersionId: version.id } });
  let failure = false, delay, calls = 0;
  const router = { modelFor: task => task === 'review' ? 'sonnet-test' : 'luna-test', async documentTask(task, payload) {
    calls++;
    if (delay) await delay;
    if (failure) throw new Error('Sonnet unavailable');
    if (task === 'review') return { data: { observations: [], corrections: [], questions: [] }, usage: { input_tokens: 11, output_tokens: 5, cache_read_input_tokens: 2 } };
    if (payload.stage === 'context') return { data: { summary: 'Registro de pedidos', questions: [] }, usage: { input_tokens: 20, output_tokens: 4 } };
    const u = payload.evidence[0];
    return { data: { items: [{ name: payload.stage === 'actors' ? 'Operadora' : 'Registrar pedidos', description: 'Registrar pedidos', type: 'FUNCTIONAL', origin: 'EXPLICIT',
      evidence: [{ unitId: u.id, sourceVersionId: u.sourceVersionId, quote: u.text, page: u.page, section: u.section }],
      participants: payload.stage === 'requirements' ? [{ actorId: payload.approvedActors[0].id, role: 'EXECUTES' }] : [], questions: [] }], questions: [] }, usage: { input_tokens: 12, output_tokens: 8 } };
  } };
  let workflow = new DocumentWorkflow(db, router);
  async function approve(stage) { const snapshot = await workflow.get(project.id); return workflow.approve(project.id, stage, snapshot.revision, 'Decisión de prueba'); }
  try {
    await t.test('requirements cannot proceed without current approved catalog', async () => {
      await assert.rejects(workflow.run(project.id, 'requirements', 'prepare'), /primero|aprobado/);
      await assert.rejects(assertLegacyApproval(project.id, [], db), /catálogo/);
    });
    await workflow.run(project.id, 'context', 'prepare');
    await t.test('Sonnet failure remains failed, with unknown usage and no approval', async () => {
      failure = true;
      await assert.rejects(workflow.run(project.id, 'context', 'review'), /Sonnet/);
      let snapshot = await workflow.get(project.id);
      assert.equal(snapshot.context.review.status, 'FAILED');
      assert.equal(snapshot.calls.at(-1).usage, null);
      await assert.rejects(approve('context'), /Sonnet/);
      failure = false;
      await workflow.retry(project.id, snapshot.calls.at(-1).id);
    });
    await workflow.run(project.id, 'context', 'review'); await approve('context');
    await workflow.run(project.id, 'actors', 'prepare');
    {
      const snapshot = await workflow.get(project.id), content = structuredClone(snapshot.actors.content);
      content.items.push({ id: 'reviewer-' + project.id, name: 'Revisor', description: 'Rol decidido por el usuario', origin: 'USER', evidence: [], questions: [], status: 'PENDING_REVIEW' });
      await workflow.edit(project.id, 'actors', content, snapshot.revision, 'Agregar rol confirmado por el usuario');
    }
    await workflow.run(project.id, 'actors', 'review'); await approve('actors');
    await t.test('backend rejects unknown actors and accepts approved actor IDs', async () => {
      const snapshot = await workflow.get(project.id);
      await assert.rejects(assertCatalog(project.id, ['missing'], db), /Participante/);
      await assertCatalog(project.id, [snapshot.actors.content.items[0].id], db);
    });
    await workflow.run(project.id, 'requirements', 'prepare');
    await t.test('manual decisions survive preparation and reinitializing the service', async () => {
      let snapshot = await workflow.get(project.id);
      const content = structuredClone(snapshot.requirements.content);
      content.items[0].description = 'Texto decidido por la persona';
      content.items[0].participants.push({ actorId: snapshot.actors.content.items[1].id, role: 'APPROVES' });
      content.items.push({ id: 'automatic-' + project.id, name: 'Conservar datos', description: 'Conservar los datos', type: 'NON_FUNCTIONAL', origin: 'USER', evidence: [], participants: [], questions: [], status: 'PENDING_REVIEW' });
      await workflow.edit(project.id, 'requirements', content, snapshot.revision, 'Corregir redacción');
      workflow = new DocumentWorkflow(db, router);
      await workflow.run(project.id, 'requirements', 'prepare');
      snapshot = await workflow.get(project.id);
      assert.equal(snapshot.requirements.content.items[0].description, 'Texto decidido por la persona');
      assert.ok(snapshot.decisions.some(d => d.reason === 'Corregir redacción'));
    });
    await workflow.run(project.id, 'requirements', 'review'); await approve('requirements');
    await t.test('approved requirements retain legacy consumer interfaces and traceability', async () => {
      const rows = await db.requirement.findMany({ where: { projectId: project.id } });
      const functional = rows.find(r => r.type === 'FUNCTIONAL'), automatic = rows.find(r => r.type === 'NON_FUNCTIONAL');
      assert.equal(functional.status, 'APPROVED'); assert.equal(functional.actorIds.length, 2);
      assert.ok(functional.sources.approval); assert.equal(functional.sources.participants.length, 2);
      assert.equal(automatic.status, 'APPROVED'); assert.deepEqual(automatic.actorIds, []);
    });
    await t.test('actor changes invalidate dependencies without deleting data/history', async () => {
      const snapshot = await workflow.get(project.id);
      const actor = snapshot.actors.content.items[0];
      await db.actor.update({ where: { id: actor.id }, data: { name: 'Operadora principal' } });
      const changed = await workflow.get(project.id);
      assert.equal(changed.actors.approval, null); assert.equal(changed.requirements.review.status, 'STALE');
      assert.ok(changed.history.length); assert.ok(await db.project.findUnique({ where: { id: project.id } }));
      assert.ok(await db.requirement.count({ where: { projectId: project.id } }));
    });
    await t.test('actor merges preserve history and update both published and proposed references', async () => {
      const snapshot = await workflow.get(project.id), content = structuredClone(snapshot.actors.content);
      const sourceActor = content.items[0], targetActor = content.items[1];
      sourceActor.mergedInto = targetActor.id;
      await workflow.edit(project.id, 'actors', content, snapshot.revision, 'Fusionar roles equivalentes por decisión humana');
      await workflow.run(project.id, 'actors', 'review'); await approve('actors');
      const merged = await workflow.get(project.id);
      const requirement = await db.requirement.findFirst({ where: { projectId: project.id, type: 'FUNCTIONAL' } });
      assert.deepEqual(requirement.actorIds, [targetActor.id]);
      assert.ok(merged.requirements.content.items[0].participants.every(p => p.actorId === targetActor.id));
      assert.ok(merged.history.some(h => h.reason === 'ACTOR_MERGE'));
      assert.equal((await db.actor.findUnique({ where: { id: sourceActor.id } })).reviewStatus, 'REJECTED');
      await workflow.run(project.id, 'requirements', 'prepare');
      const reanalyzed = await workflow.get(project.id);
      assert.equal(reanalyzed.requirements.validation, 'VALID');
      assert.ok(reanalyzed.requirements.content.items.find(r => r.type === 'FUNCTIONAL').participants.every(p => p.actorId === targetActor.id));
    });
    await t.test('obsolete AI responses are stored but never applied', async () => {
      let release; delay = new Promise(resolve => release = resolve);
      const pending = workflow.run(project.id, 'context', 'prepare');
      await new Promise(resolve => setTimeout(resolve, 80));
      const snapshot = await workflow.get(project.id);
      await workflow.edit(project.id, 'context', { summary: 'Contexto humano', questions: [] }, snapshot.revision, 'Nueva decisión');
      release(); delay = null;
      await assert.rejects(pending, /obsoleto/);
      assert.equal((await workflow.get(project.id)).context.content.summary, 'Contexto humano');
    });
    await t.test('cache prevents duplicate requests and preserves real reported usage', async () => {
      const payload = { task: 'test', evidence: [] }, versions = { test: true };
      const first = await workflow.call(project.id, 'context', 'review', payload, versions);
      const count = calls;
      assert.deepEqual(await workflow.call(project.id, 'context', 'review', payload, versions), first);
      assert.equal(calls, count);
      const snapshot = await workflow.get(project.id);
      assert.equal(snapshot.calls.at(-1).usage.cache_read_input_tokens, 2);
    });
    await t.test('concurrent duplicate calls execute once', async () => {
      const count = calls;
      const results = await Promise.allSettled([1, 2].map(() => workflow.call(project.id, 'context', 'review', { concurrent: true }, { v: 1 })));
      assert.ok(results.some(r => r.status === 'fulfilled')); assert.equal(calls, count + 1);
    });
    await t.test('interrupted calls remain pending after restarting and require explicit retry', async () => {
      const record = await db.documentWorkflowCall.create({ data: { projectId: project.id, cacheKey: 'interrupted-' + project.id, stage: 'context', task: 'review', provider: 'anthropic', model: 'sonnet-test', inputVersions: {}, updatedAt: new Date(Date.now() - 200000) } });
      workflow = new DocumentWorkflow(db, router);
      const snapshot = await workflow.get(project.id), call = snapshot.calls.find(c => c.id === record.id);
      assert.equal(call.status, 'INTERRUPTED'); assert.equal(call.usage, null);
      assert.equal((await new DocumentWorkflow(db, router).get(project.id)).calls.find(c => c.id === record.id).status, 'INTERRUPTED');
      await workflow.retry(project.id, record.id);
    });
    await t.test('bounded explicit retries preserve failures and stop after three attempts', async () => {
      failure = true;
      for (let n = 1; n <= 3; n++) {
        await assert.rejects(workflow.call(project.id, 'context', 'review', { retryTest: true }, { v: 1 }), /Sonnet/);
        const call = await db.documentWorkflowCall.findFirst({ where: { projectId: project.id, status: 'FAILED' }, orderBy: { createdAt: 'desc' } });
        assert.equal(call.attempts, n);
        if (n < 3) await workflow.retry(project.id, call.id); else await assert.rejects(workflow.retry(project.id, call.id), /agotados/);
      }
      failure = false;
    });
    await t.test('legacy data survives adoption with no invented Sonnet review', async () => {
      const legacy = await db.project.create({ data: { name: 'Legacy' } });
      await db.actor.create({ data: { projectId: legacy.id, name: 'Supervisor', status: 'APPROVED' } });
      const adopted = await workflow.get(legacy.id);
      assert.equal(adopted.actors.content.items[0].name, 'Supervisor');
      assert.equal(adopted.actors.review.status, 'PENDING'); assert.equal(adopted.actors.approval, null);
      await db.documentWorkflow.delete({ where: { projectId: legacy.id } }); await db.project.delete({ where: { id: legacy.id } });
    });
  } finally {
    await db.documentWorkflowCall.deleteMany({ where: { projectId: project.id } });
    await db.documentWorkflow.deleteMany({ where: { projectId: project.id } });
    await db.project.delete({ where: { id: project.id } });
    await db.$disconnect();
  }
});
