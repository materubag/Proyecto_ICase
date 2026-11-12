const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const registry = require('../../backend/src/services/diagrams/DiagramRegistry');
const mermaidValidator = require('../../backend/src/services/diagrams/mermaidValidator');
const mermaidNormalizer = require('../../backend/src/services/diagrams/mermaidNormalizer');
const {
  SAMPLE_ER_MODEL,
  SAMPLE_USE_CASES,
  SAMPLE_NAVIGATION,
  SAMPLE_ARCHITECTURE
} = require('../fixtures/test_fixtures');

describe('Mermaid Syntax, Generators & Validation Unit Tests', () => {
  test('ER_DIAGRAM generator produces valid erDiagram block with entities and relations', () => {
    const generator = registry.get('ER_DIAGRAM');
    assert.ok(generator, 'ER_DIAGRAM generator must be registered');

    const code = generator(SAMPLE_ER_MODEL);
    assert.match(code, /erDiagram/i);
    assert.match(code, /Libro/);
    assert.match(code, /Prestamo/);

    const validation = mermaidValidator.validate(code, 'ER');
    assert.equal(validation.isValid, true, `Validation failed: ${validation.error || ''}`);
  });

  test('USE_CASE_DIAGRAM generator produces valid graph with actors and include relations', () => {
    const generator = registry.get('USE_CASE_DIAGRAM');
    assert.ok(generator, 'USE_CASE_DIAGRAM generator must be registered');

    const code = generator(SAMPLE_USE_CASES);
    assert.match(code, /(graph|flowchart)\s+(TD|TB|LR)/i);
    assert.match(code, /Bibliotecario/);
    assert.match(code, /Registrar Prestamo/);

    const validation = mermaidValidator.validate(code, 'USE_CASE');
    assert.equal(validation.isValid, true, `Validation failed: ${validation.error || ''}`);
  });

  test('NAVIGATION_DIAGRAM generator produces valid screen flow graph', () => {
    const generator = registry.get('NAVIGATION_DIAGRAM');
    assert.ok(generator, 'NAVIGATION_DIAGRAM generator must be registered');

    const code = generator(SAMPLE_NAVIGATION);
    assert.match(code, /(graph|flowchart)\s+(TD|TB|LR)/i);
    assert.match(code, /Login/);
    assert.match(code, /Dashboard Principal/);

    const validation = mermaidValidator.validate(code, 'NAVIGATION');
    assert.equal(validation.isValid, true, `Validation failed: ${validation.error || ''}`);
  });

  test('SOFTWARE_ARCHITECTURE generator renders architectural layers and connections', () => {
    const generator = registry.get('SOFTWARE_ARCHITECTURE');
    assert.ok(generator, 'SOFTWARE_ARCHITECTURE generator must be registered');

    const code = generator(SAMPLE_ARCHITECTURE);
    assert.match(code, /(graph|flowchart)/i);
    assert.match(code, /Frontend React SPA/);
    assert.match(code, /Base de Datos PostgreSQL/);

    const validation = mermaidValidator.validate(code, 'ARCHITECTURE');
    assert.equal(validation.isValid, true, `Validation failed: ${validation.error || ''}`);
  });

  test('mermaidValidator detects unclosed brackets and syntax mistakes', () => {
    const invalidCode = 'flowchart TD\n  A[Inicio --> B[Fin]'; // Missing closing bracket on A
    const result = mermaidValidator.validate(invalidCode, 'FLOWCHART');
    assert.equal(result.isValid, false, 'Should flag unclosed block');
    assert.ok(result.error, 'Must provide an error explanation');
  });

  test('mermaidNormalizer sanitizes accents and hostile node labels into safe identifiers', () => {
    const safeId = mermaidNormalizer.toSafeIdentifier('Código de Órden #1!');
    assert.equal(safeId, 'Codigo_de_Orden_1');

    const stripped = mermaidNormalizer.stripAccents('Préstamos y Devolución');
    assert.equal(stripped, 'Prestamos y Devolucion');

    const safeLabel = mermaidNormalizer.toSafeLabel('Acción: "Crear" <Nuevo>');
    assert.ok(!safeLabel.includes('"'), 'Quotes must be normalized or escaped in labels');
  });
});
