const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validateAIResponse, normalizeAIResponse } = require('../../backend/src/services/ai/ai.contract.validator');
const domain = require('../../backend/src/services/engineering/domain');

describe('JSON Structures, Contracts & Domain Validations', () => {
  test('validateAIResponse accepts valid canonical payload and rejects malformed types', () => {
    const raw = {
      project: { name: 'Sistema Biblioteca', platform: 'WEB' },
      actors: [
        { id: 'ACT-01', name: 'Bibliotecario', description: 'Administrador de biblioteca' }
      ],
      requirements: [
        { code: 'RF-01', name: 'Registrar libro', description: 'El bibliotecario registra el libro.', actorIds: ['ACT-01'] }
      ],
      entities: [
        { id: 'ENT-01', name: 'Libro', attributes: [{ name: 'isbn', type: 'string' }] }
      ],
      relationships: [],
      screens: [],
      navigation: []
    };

    const normalized = normalizeAIResponse(raw);
    const res = validateAIResponse(normalized);
    assert.equal(res.isValid, true, `Expected valid response, got error: ${res.error}`);

    const invalid = {
      project: 'Not an object',
      requirements: 'Not an array'
    };
    const resInvalid = validateAIResponse(invalid);
    assert.equal(resInvalid.isValid, false);
    assert.ok(resInvalid.error);
  });

  test('normalizeAIResponse fills missing defaults and cleans requirement arrays', () => {
    const incomplete = {
      project: { name: 'Test' },
      requirements: [
        { statement: 'Registrar usuario sin codigo' }
      ]
    };

    const normalized = normalizeAIResponse(incomplete);
    assert.ok(Array.isArray(normalized.requirements));
    assert.ok(Array.isArray(normalized.actors));
    assert.ok(Array.isArray(normalized.entities));
    assert.ok(Array.isArray(normalized.relationships));
    assert.ok(Array.isArray(normalized.screens));
    assert.ok(Array.isArray(normalized.navigation));
    assert.ok(normalized.architecture);
    assert.equal(normalized.requirements.length, 1);
    assert.equal(normalized.requirements[0].code, 'RF-01');
  });

  test('domain defines valid platforms and supports error throwing with fail()', () => {
    const modelService = require('../../backend/src/services/engineering/model.service');
    assert.ok(Array.isArray(modelService.platforms));
    assert.ok(modelService.platforms.includes('WEB'));
    assert.ok(modelService.platforms.includes('MOBILE'));

    assert.throws(() => {
      domain.fail('TEST_CODE', 'Custom error message', 400);
    }, (err) => {
      return err.code === 'TEST_CODE' && err.message === 'Custom error message' && err.statusCode === 400;
    });
  });
});
