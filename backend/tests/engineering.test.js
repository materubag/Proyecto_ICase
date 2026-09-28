const test = require('node:test');
const assert = require('node:assert/strict');
const impact = require('../src/services/engineering/ImpactAnalysisService');
const { diff } = require('../src/services/engineering/change.service');
const registry = require('../src/services/diagrams/DiagramRegistry');
const { platform } = require('../src/services/engineering/model.service');
test('impact walks cycles once, separates direct/indirect and isolates unrelated artifacts', () => {
  const edge = (fromType, fromId, toType, toId) => ({ fromType, fromId, toType, toId });
  const result = impact.traverse([edge('Requirement', 'r', 'UseCase', 'u'), edge('UseCase', 'u', 'Artifact', 'a'), edge('Artifact', 'a', 'Requirement', 'r'), edge('Requirement', 'other', 'Artifact', 'untouched')], 'Requirement', 'r');
  assert.deepEqual(result.directImpacts.map(x => x.id), ['u']);
  assert.deepEqual(result.indirectImpacts.map(x => x.id), ['a']);
  assert.deepEqual(result.artifactsToRegenerate.map(x => x.id), ['a']);
});
test('structural diff preserves all four change states', () => {
  const rows = diff({ same: 1, gone: 2, changed: 'a' }, { same: 1, added: 3, changed: 'b' });
  assert.deepEqual(new Set(rows.map(r => r.status)), new Set(['ADDED', 'REMOVED', 'MODIFIED', 'UNCHANGED']));
});
test('Mermaid generators never infer actors, navigation edges, attributes or infrastructure', () => {
  assert.equal(registry.get('USE_CASE_DIAGRAM')({ actors: [], useCases: [] }), 'flowchart LR');
  assert.equal(registry.get('NAVIGATION_DIAGRAM')({ navigationNodes: [] }), 'flowchart TD');
  assert.equal(registry.get('SYSTEM_ARCHITECTURE')({ architecture: {} }), 'flowchart TD');
  const er = registry.get('ER_DIAGRAM')({ entities: [{ id: 'a', name: 'A-B', attributes: [] }, { id: 'b', name: 'A B', attributes: [] }], relationships: [] });
  assert(!er.includes('PK')); assert(!er.includes('--')); assert.equal(new Set(er.split('\n').slice(1)).size, 2);
});
test('unknown cardinalities fail and malicious labels cannot inject directives', () => {
  assert.throws(() => registry.get('ER_DIAGRAM')({ entities: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], relationships: [{ source: 'a', target: 'b', cardinality: '?' }] }));
  const code = registry.get('USE_CASE_DIAGRAM')({ actors: [{ id: 'x', name: '"]\nclick x "javascript:alert(1)"<script>' }], useCases: [] });
  assert.equal(code.split('\n').length, 2); assert(!code.includes('<script>'));
});
test('platform is UNKNOWN without evidence, and distinguishes web/mobile/both', () => {
  assert.equal(platform('Registrar pedidos'), 'UNKNOWN'); assert.equal(platform('Aplicación móvil Android'), 'MOBILE'); assert.equal(platform('web y móvil'), 'BOTH');
});
