const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { extract } = require('../src/services/analysis/documentExtraction');
const { locate } = require('../src/services/analysis/extractionEvidence');
const provider = require('./fixtures/requirementFlowProvider.cjs');
const opts = () => ({ providerInstance: provider(), providerOverride: 'openai', modelOverride: 'fixture', cache: false });

test('enumerated: local-first, range headers excluded, actor detection independent', async () => {
  const options = opts();
  const result = await extract('RF-01 A RF-09\nRF-01 Registrar pedidos.\n\nLa operadora registra pedidos.', options);
  assert.equal(result.partial, false);
  assert.equal(result.requirements.length, 1);
  assert.equal(result.requirements[0].originalCode, 'RF-01');
  assert.equal(result.actors.length, 1);
  assert.equal(result.requirements[0].associations.length, 1);
  assert.ok(options.providerInstance.calls.flatMap(c => c.segments).some(s => s.mode === 'RELATIONSHIPS_ONLY'));
  assert.ok(result.requirements[0].evidence.some(e => e.quote.includes('RF-01 Registrar pedidos.')));
});

test('narrative and mixed documents retain additions and mark inference', async () => {
  for (const local of ['', 'RF-01 Registrar pedidos.\n\n']) {
    const result = await extract(local + 'La operadora registra pedidos.\n\nSe necesita exportar informes.\n\nPosiblemente convenga archivar pedidos.', opts());
    assert.equal(result.partial, false);
    const candidates = [...result.requirements, ...(result.additionalCandidates || [])];
    assert.equal(candidates.length, 3);
    assert.equal(candidates.filter(r => r.source === 'inferred').length, 1);
    if(local) assert.equal(result.requirements.length, 1);
    assert.ok(result.requirements.every(r => r.evidence.length));
    assert.equal(result.actors.length, 1);
  }
});

test('AUTRON: every original once, complete wrapped descriptions, RF-24 clean', async () => {
  const text = fs.readFileSync(path.resolve(__dirname, 'fixtures/autron-source.txt'), 'utf8');
  const result = await extract(text, opts());
  assert.equal(result.partial, false);
  const enumerated = result.requirements.filter(r => r.originalCode);
  // Expectations from this PDF's independently audited list, not an extraction quota.
  assert.equal(enumerated.length, 46);
  assert.equal(new Set(enumerated.map(r => r.originalCode)).size, 46);
  assert.equal(enumerated.filter(r => r.type === 'FUNCTIONAL').length, 34);
  assert.equal(enumerated.find(r => r.originalCode === 'RF-24').statement, 'Generar alertas de bajo stock.');
  assert.match(enumerated.find(r => r.originalCode === 'RF-07').statement, /evidencias/);
  assert.equal(result.requirements.filter(r => !r.originalCode).length, 0);
  assert.equal(result.additionalCandidates.length, 1);
  assert.equal(result.actors.length, 4);
  assert.equal(enumerated.find(r => r.originalCode === 'RF-06').actorIds.length, 2);
  assert.ok(result.segments.some(s => s.mode === 'UNRESOLVED' && s.text.includes('La autorización del cliente')));
  for (const r of enumerated) for (const e of r.evidence) {
    assert.equal(text.substring(e.quoteStart, e.quoteEnd), e.quote);
    assert.ok(result.segments.find(s => s.id === e.id).text.includes(e.quote));
  }
});

test('wrapped evidence maps to literal spans; invalid refs cannot borrow another segment', () => {
  const a = { id: 'a', text: 'Registrar\n', start: 0, end: 10 };
  const b = { id: 'b', text: 'pedidos.', start: 10, end: 18 };
  assert.equal(locate({ segmentIds: ['a','b'], quote: 'Registrar pedidos.' }, [a,b]).length, 2);
  assert.throws(() => locate({ segmentIds: ['a'], quote: 'pedidos.' }, [a,b]), /no literal/);
  assert.throws(() => locate({ segmentIds: ['absent'], quote: 'Registrar' }, [a,b]), /inválida/);
  assert.throws(() => locate({ segmentIds: ['a','b'], quote: 'Registrar' }, [a,b]), /sin evidencia/);
  assert.throws(() => locate({ segmentIds: ['a','b'], quote: 'Registrar pedidos.' },
    [{ ...a, documentHash: 'document1' }, { ...b, documentHash: 'document2' }]), /no literal/);
});

test('multi-sentence descriptions and large original codes remain complete', async () => {
  const result = await extract('RF-1001 Registrar pedidos.\nTambién debe permitir cancelarlos.\nRF-1002 Exportar informes.', opts());
  assert.equal(result.requirements.length, 2);
  assert.equal(result.requirements[0].originalCode, 'RF-1001');
  assert.equal(result.requirements[0].statement, 'Registrar pedidos. También debe permitir cancelarlos.');
});

test('unsupported providers still preserve local requirements and expose failed actor coverage', async () => {
  const result = await extract('RF-01 Registrar pedidos.', { providerOverride: 'unsupported', cache: false });
  assert.equal(result.requirements.length, 1);
  assert.equal(result.partial, true);
  assert.ok(result.coverage.every(c => c.requirementsStatus === 'LOCAL_RESOLVED' && c.relationshipsStatus === 'FAILED'));
});

test('classification suggestions preserve original code and record the proposed type for review', async () => {
  const result = await extract('RNF 06 Validar los datos antes de almacenarlos.', {
    ...opts(), providerInstance: { async extractDocumentBatch(input) {
      return { data: { coveredSegmentIds: input.segments.map(s => s.id), actors: [], other: [], requirements: [{
        segmentIds: [input.segments[0].id], quote: input.segments[0].text.trim(), code: 'RNF-06',
        statement: 'Validar los datos antes de almacenarlos.', type: 'FUNCTIONAL', explicit: true, associations: [], pending: []
      }] } };
    } }
  });
  assert.equal(result.requirements.length, 1);
  assert.equal(result.requirements[0].originalCode, 'RNF 06');
  assert.equal(result.requirements[0].type, 'NON_FUNCTIONAL');
  assert.equal(result.requirements[0].refinements[0].proposedType, 'FUNCTIONAL');
  assert.ok(result.requirements[0].pending.some(p => p.includes('clasificación')));
});
