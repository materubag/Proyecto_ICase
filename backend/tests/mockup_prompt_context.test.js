const test = require('node:test');
const assert = require('node:assert/strict');
const mockupService = require('../src/services/mockup/mockup.service');
const googleStitchService = require('../src/services/mockup/GoogleStitchService');
const { generateHtmlMockup } = require('../src/services/mockup/mockupGenerator');

test('Reception mockup prompt uses catalog actor, fields, siblings and sample data', () => {
  const project = {
    name: 'Autron5',
    description: 'Taller mecánico',
    actors: [{ id: 'a1', name: 'Recepción' }, { id: 'a2', name: 'Mecánico' }],
    navigationNodes: [
      { id: 'n1', name: 'Recepción e Inspección de Vehículos', route: '/recepcion', platform: 'WEB', actorIds: [], requirementIds: [] },
      { id: 'n2', name: 'Agenda y Gestión de Citas de Taller', route: '/citas', platform: 'WEB', actorIds: [], requirementIds: [] }
    ]
  };
  const screens = mockupService.buildScreenPlan(project, []);
  const recepcion = screens[0];
  assert.deepEqual(recepcion.actors, ['Recepción']);
  assert.ok(recepcion.fields.includes('Kilometraje'));
  assert.ok(recepcion.nav.some(item => /cita/i.test(item)));
  const prompt = googleStitchService.buildScreenPrompt(recepcion, project, 2, 1, 'Generar un prototipo visual para: Autron5');
  assert.ok(prompt.includes('Recepción'));
  assert.ok(prompt.includes('Kilometraje'));
  assert.ok(prompt.includes('ABC-123'));
  assert.ok(!prompt.includes('Generar un prototipo visual para:'));
  assert.ok(!prompt.includes('Arquetipo C'));
});

test('Unrelated library screen does not inherit workshop catalog', () => {
  const screen = { name: 'Catálogo de Libros', route: '/libros', actors: ['Bibliotecario'] };
  const project = { name: 'Biblioteca Nacional', description: 'Sistema bibliotecario' };
  const prompt = googleStitchService.buildScreenPrompt(screen, project, 1, 1);
  assert.ok(prompt.includes('Catálogo de Libros'));
  assert.ok(prompt.includes('SISTEMA DE DISEÑO OFICIAL OBLIGATORIO'));
  assert.equal(prompt.includes('ABC-123'), false);
  assert.equal(prompt.includes('automotriz'), false);
});

test('Fallback HTML uses catalog fields instead of generic identifiers', () => {
  const html = generateHtmlMockup({
    name: 'Recepción e Inspección de Vehículos',
    purpose: 'Registro de ingreso',
    fields: ['Placa', 'Kilometraje'],
    primaryAction: 'Registrar ingreso',
    tableHeaders: ['Placa', 'Cliente'],
    sampleRows: [['ABC-123', 'Ana Pérez']],
    actors: ['Recepción']
  });
  assert.ok(html.includes('Kilometraje'));
  assert.ok(html.includes('Registrar ingreso'));
  assert.ok(html.includes('ABC-123'));
  assert.equal(html.includes('Código / Referencia'), false);
});
