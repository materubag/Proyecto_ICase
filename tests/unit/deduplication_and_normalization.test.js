const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const deduplicationService = require('../../backend/src/services/analysis/deduplicationService');

describe('Deduplication & Requirement Normalization Unit Tests', () => {
  test('normalizeText strips accents, lowercase and normalizes whitespaces', () => {
    const raw = '  ¡El SISTEMA DEBERÁ Registrar   Préstamos de Libros!  ';
    const normalized = deduplicationService.normalizeText(raw);
    assert.equal(normalized, 'el sistema debera registrar prestamos de libros');
  });

  test('stem correctly reduces Spanish inflectional variants', () => {
    assert.equal(deduplicationService.stem('prestamos'), 'prestam');
    assert.equal(deduplicationService.stem('prestando'), 'prest');
    assert.equal(deduplicationService.stem('usuarios'), 'usuari');
  });

  test('calculateSimilarity scores 1.0 for identical sentences and lower for divergent ones', () => {
    const s1 = 'El bibliotecario registra el prestamo de un libro';
    const s2 = 'El bibliotecario registra el prestamo de un libro';
    const s3 = 'La recepcionista cancela la cita medica';

    const simExact = deduplicationService.calculateSimilarity(s1, s2);
    const simDiff = deduplicationService.calculateSimilarity(s1, s3);

    assert.equal(simExact, 1.0);
    assert.ok(simDiff < 0.2, `Expected low similarity between unrelated texts, got ${simDiff}`);
  });

  test('getActorCanonicalKey normalizes plural and case variants to single canonical key', () => {
    const key1 = deduplicationService.getActorCanonicalKey('Bibliotecario');
    const key2 = deduplicationService.getActorCanonicalKey('bibliotecarios');
    assert.equal(key1, key2, 'Singular and plural should yield the exact same canonical key');
  });

  test('consolidateActors collapses duplicate actors into single canonical record', () => {
    const actors = [
      { id: 'a1', name: 'Bibliotecario', description: 'Administra libros' },
      { id: 'a2', name: 'bibliotecarios', description: 'Atiende prestamos' },
      { id: 'a3', name: 'Socio', description: 'Usuario que pide prestamos' }
    ];

    const consolidated = deduplicationService.consolidateActors(actors);
    assert.equal(consolidated.length, 2, 'Should collapse singular and plural into 2 distinct actors');
    const biblio = consolidated.find(a => a.canonicalKey === 'bibliotecario');
    assert.ok(biblio, 'Must contain canonical bibliotecario');
    assert.ok(biblio.aliases.includes('bibliotecarios') || biblio.aliases.includes('Bibliotecario'));
  });

  test('groupAndConsolidateRequirements detects semantic equivalents', () => {
    const candidates = [
      { id: 'c1', originalCode: 'RF-01', statement: 'El bibliotecario debe registrar los prestamos de libros.' },
      { id: 'c2', originalCode: 'RF-02', statement: 'El bibliotecario debe registrar los prestamos de libros.' },
      { id: 'c3', originalCode: 'RF-03', statement: 'Generar reporte contable mensual en formato PDF.' }
    ];

    const result = deduplicationService.groupAndConsolidateRequirements(candidates);
    assert.ok(result.canonicalRequirements, 'Should contain canonical requirements list');
    assert.equal(result.canonicalRequirements.length, 2, 'Should consolidate exact statement duplicates');
    assert.equal(result.extractionStats.duplicatesGrouped, 1);
  });

  test('auditRequirements identifies duplicate code or statement issues', () => {
    const requirements = [
      { id: 'r1', code: 'RF-01', statement: 'Registrar prestamos de libros' },
      { id: 'r2', code: 'RF-02', statement: 'Registrar prestamos de libros' },
      { id: 'r3', code: 'RF-03', statement: 'Consultar disponibilidad de libros' }
    ];
    const audit = deduplicationService.auditRequirements(requirements);
    assert.equal(audit.exactDuplicates.length, 1, 'Should detect 1 exact duplicate pair');
    assert.equal(audit.exactDuplicates[0].statement, 'Registrar prestamos de libros');
  });
});
