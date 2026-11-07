const test = require('node:test');
const assert = require('node:assert/strict');
const { executionProblems } = require('../src/services/codegen/executableContract');

test('structured unresolved issues remain blocking and become readable strings', () => {
  const errors = executionProblems({ bindingVersion: 2, action: 'CREATE', unresolved: [{ item: 'Placa y VIN', reason: 'Falta normalización' }, 'Missing constraint'] });
  assert.deepEqual(errors, ['Placa y VIN: Falta normalización', 'Missing constraint']);
});

test('diagnostic text handles legacy objects without passing objects to React', async () => {
  const { diagnosticText } = await import('../../frontend/src/utils/codegenQualityGroups.js');
  assert.equal(diagnosticText({ item: 'Placa y VIN', reason: 'Falta normalización' }), 'Placa y VIN: Falta normalización');
  assert.equal(diagnosticText('Error'), 'Error');
  assert.equal(diagnosticText(null), '');
  assert.equal(diagnosticText({ message: 'Mensaje' }), 'Mensaje');
  assert.equal(diagnosticText([{ item: 'A', reason: 'B' }, 'C']), 'A: B; C');
  assert.equal(typeof diagnosticText({ unknown: { nested: true } }), 'string');
});
