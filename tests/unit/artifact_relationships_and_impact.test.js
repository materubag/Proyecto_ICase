const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const impactService = require('../../backend/src/services/engineering/ImpactAnalysisService');

describe('Artifact Relationships & Impact Analysis Unit Tests', () => {
  test('traverse calculates direct and indirect impacts along dependency graph', () => {
    // Graph: Requirement:req-1 -> ModelCandidate:mod-1 -> Artifact:art-1
    const relations = [
      { fromType: 'Requirement', fromId: 'req-1', toType: 'ModelCandidate', toId: 'mod-1', relation: 'DERIVED_FROM' },
      { fromType: 'ModelCandidate', fromId: 'mod-1', toType: 'Artifact', toId: 'art-1', relation: 'INCORPORATES' }
    ];

    const impact = impactService.traverse(relations, 'Requirement', 'req-1');

    assert.equal(impact.directImpacts.length, 1);
    assert.deepEqual(impact.directImpacts[0], { type: 'ModelCandidate', id: 'mod-1', depth: 1 });

    assert.equal(impact.indirectImpacts.length, 1);
    assert.deepEqual(impact.indirectImpacts[0], { type: 'Artifact', id: 'art-1', depth: 2 });

    assert.equal(impact.artifactsToRegenerate.length, 1);
    assert.equal(impact.artifactsToRegenerate[0].id, 'art-1');
  });

  test('traverse avoids infinite loops in cyclic dependencies', () => {
    const cyclicRelations = [
      { fromType: 'ModelCandidate', fromId: 'mod-1', toType: 'ModelCandidate', toId: 'mod-2' },
      { fromType: 'ModelCandidate', fromId: 'mod-2', toType: 'ModelCandidate', toId: 'mod-1' }
    ];

    const impact = impactService.traverse(cyclicRelations, 'ModelCandidate', 'mod-1');
    assert.equal(impact.directImpacts.length, 1);
    assert.equal(impact.indirectImpacts.length, 0); // Stops cycle without infinite recursion
  });
});

