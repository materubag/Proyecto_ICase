const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const changeService = require('../../backend/src/services/engineering/change.service');

describe('Version Logic, Quality & Structural Diff Unit Tests', () => {
  test('diff correctly detects UNCHANGED, ADDED, REMOVED, and MODIFIED fields', () => {
    const before = {
      code: 'RF-01',
      name: 'Registrar préstamo',
      priority: 'HIGH',
      extra: 'obsolete'
    };
    const after = {
      code: 'RF-01',
      name: 'Registrar préstamo de libro con validación',
      priority: 'HIGH',
      newField: 'fresh'
    };

    const diffs = changeService.diff(before, after);

    const codeDiff = diffs.find(d => d.path === '/code');
    assert.equal(codeDiff.status, 'UNCHANGED');

    const nameDiff = diffs.find(d => d.path === '/name');
    assert.equal(nameDiff.status, 'MODIFIED');
    assert.equal(nameDiff.before, 'Registrar préstamo');
    assert.equal(nameDiff.after, 'Registrar préstamo de libro con validación');

    const extraDiff = diffs.find(d => d.path === '/extra');
    assert.equal(extraDiff.status, 'REMOVED');

    const newDiff = diffs.find(d => d.path === '/newField');
    assert.equal(newDiff.status, 'ADDED');
  });

  test('requirementData enforces mandatory fields and valid enums', () => {
    const valid = changeService.requirementData({
      code: 'RF-10',
      name: 'Generar reporte',
      description: 'El sistema debe generar reporte de préstamos vencidos.',
      type: 'FUNCTIONAL',
      priority: 'HIGH',
      status: 'APPROVED',
      actorIds: ['act-1']
    });

    assert.equal(valid.code, 'RF-10');
    assert.equal(valid.priority, 'HIGH');
    assert.ok(valid.qualityReport, 'Should generate an ISO 29148 quality report');

    assert.throws(() => {
      changeService.requirementData({ priority: 'SUPER_URGENT' });
    }, err => err.code === 'INVALID_REQUIREMENT' && err.message === 'Prioridad inválida.');

    assert.throws(() => {
      changeService.requirementData({ type: 'INVALID_TYPE' });
    }, err => err.code === 'INVALID_REQUIREMENT' && err.message === 'Tipo inválido.');
  });
});
