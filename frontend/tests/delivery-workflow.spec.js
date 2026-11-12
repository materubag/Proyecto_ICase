import { test, expect } from '@playwright/test';

function fixture() {
  const artifact = { version: 1, content: { files: ['app.js'] }, validation: { passed: true, tests: [{ check: 'HTTP', passed: true }] },
    review: { status: 'SUCCEEDED', contentHash: 'test', observations: [{ reason: 'Revisar validación del teléfono' }], corrections: [{ reason: 'Añadir longitud máxima', before: 5, after: 20 }] }, approval: null };
  return { revision: 3, documentApproved: true, approvedStages: [1], stages: { 1: { ...artifact, approval: { version: 1 } }, 2: artifact },
    files: { 'app.js': 'hash' }, availableOperations: [], mockups: {}, changes: [],
    prerequisites: { context: true, actors: true, requirements: true }, activeJobId: null,
    jobs: [{ id: 'failed-job', target: '2', task: 'execute', status: 'FAILED', attempts: 1, error: 'Migración rechazada', logs: [{ at: 'now', message: 'Error al crear tabla' }] }],
    calls: [{ id: 'call', provider: 'anthropic', model: 'test-double', target: '2', task: 'review', status: 'SUCCEEDED', usage: { input_tokens: 30 } }] };
}

test('delivery approval requires manual review, surfaces failures and preserves recovery evidence', async ({ page }) => {
  const state = fixture();
  let reject = true, approval, resumed;
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/api/projects/delivery-ui-test/codegen/workflow**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/approve')) {
      approval = route.request().postDataJSON();
      if (reject) return route.fulfill({ status: 409, json: { success: false, error: { message: 'Las pruebas requieren repetición' } } });
      state.stages[2].approval = { version: 1 };
      state.approvedStages = [1, 2]; state.revision++;
      return route.fulfill({ json: { success: true, data: { state } } });
    }
    if (url.pathname.endsWith('/control')) resumed = route.request().postDataJSON();
    await route.fulfill({ json: { success: true, data: state } });
  });
  await page.goto('/tests/fixtures/delivery-workflow.html');
  await page.getByRole('button').filter({ hasText: 'Estructura del proyecto' }).click();
  const approve = page.getByRole('button', { name: /Aprobar esta versión y continuar/ });
  await expect(approve).toBeDisabled();
  await page.getByLabel('Resolución de observaciones y motivo de la aprobación').fill('Validación confirmada con un teléfono válido e inválido');
  await page.getByLabel('Resultado de mi revisión y pruebas').fill('Probé instalación y arranque');
  await page.getByRole('checkbox').check();
  await approve.click();
  await expect(page.getByRole('alert').filter({ hasText: 'Las pruebas requieren repetición' })).toBeVisible();
  expect(approval.manualReview.confirmed).toBe(true);
  expect(approval.manualReview.notes).toContain('instalación');
  expect(state.approvedStages).toEqual([1]);
  await expect(page.getByText('Migración rechazada', { exact: true })).toBeVisible();
  await expect(page.getByText('now Error al crear tabla', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reanudar este trabajo', exact: true }).click();
  expect(resumed.jobId).toBe('failed-job');
  await page.getByText('Observaciones de Sonnet y correcciones propuestas').click();
  await expect(page.getByText('Añadir longitud máxima', { exact: true })).toBeVisible();
  reject = false;
  await approve.click();
  await expect.poll(() => state.approvedStages).toEqual([1, 2]);
  expect(pageErrors).toEqual([]);
});

test('a rejected verified ZIP is visible and never falls back to the legacy download', async ({ page }) => {
  const state = fixture(); state.approvedStages = [1, 2, 3, 4, 5, 6, 7];
  state.stages[7] = { approval: { version: 1 }, validation: { containerBehaviorPassed: true } };
  let fallbackCalls = 0;
  await page.route('**/api/projects/delivery-ui-test/codegen/download**', async route => { fallbackCalls++; await route.abort(); });
  await page.route('**/api/projects/delivery-ui-test/codegen/workflow**', async route => {
    if (route.request().url().endsWith('/download')) return route.fulfill({ status: 409, json: { success: false, error: { message: 'Los archivos cambiaron después de verificarse' } } });
    await route.fulfill({ json: { success: true, data: state } });
  });
  await page.goto('/tests/fixtures/delivery-workflow.html');
  await page.getByRole('link', { name: /Descargar Entrega Verificada/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Los archivos cambiaron' })).toBeVisible();
  expect(fallbackCalls).toBe(0);
});

test('mockups expose the exact preview and allow resolution of review observations', async ({ page }) => {
  const state = fixture();
  state.catalog = { approval: { version: 1 }, content: { screens: [{ id: 'screen', name: 'Pedidos', route: '/pedidos' }] } };
  state.mockups.screen = { ...state.stages[2], content: { html: '<h1>Pedidos versión 1</h1>' } };
  await page.route('**/api/projects/delivery-ui-test/codegen/workflow**', async route => {
    if (route.request().url().endsWith('/html')) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<h1>Pedidos versión 1</h1>' });
    await route.fulfill({ json: { success: true, data: state } });
  });
  await page.goto('/tests/fixtures/delivery-workflow.html?mode=mockups');
  await page.getByRole('combobox', { name: /pantalla|Diseño/i }).selectOption('screen');
  await expect(page.frameLocator('iframe[title="Diseño generado por Stitch"]').getByRole('heading', { name: 'Pedidos versión 1' })).toBeVisible();
  await expect(page.getByLabel('Resolución de observaciones y motivo de la aprobación')).toBeVisible();
});

test('an asynchronous review remains queued and cannot claim approval', async ({ page }) => {
  const state = fixture();
  let submitted;
  await page.route('**/api/projects/delivery-ui-test/codegen/workflow**', async route => {
    if (route.request().url().endsWith('/tasks')) {
      submitted = route.request().postDataJSON();
      state.jobs = [{ id: 'queued-review', target: '2', task: 'review', status: 'QUEUED', logs: [] }];
      state.activeJobId = 'queued-review';
      return route.fulfill({ status: 202, json: { success: true, data: state.jobs[0] } });
    }
    await route.fulfill({ json: { success: true, data: state } });
  });
  await page.goto('/tests/fixtures/delivery-workflow.html');
  await page.getByRole('button').filter({ hasText: 'Estructura del proyecto' }).click();
  await page.getByRole('button', { name: /Solicitar Revisión Sonnet/ }).click();
  await expect(page.getByText('2 / review: QUEUED', { exact: true })).toBeVisible();
  expect(submitted.task).toBe('review');
  await expect(page.getByRole('button', { name: /Aprobar esta versión y continuar/ })).toBeDisabled();
  expect(state.approvedStages).toEqual([1]);
});

test('chat displays actual candidates and reports incomplete hybrid review', async ({ page }) => {
  const state = fixture();
  let calls = 0, submitted;
  await page.route('**/api/projects/delivery-ui-test/codegen/workflow**', route => route.fulfill({ json: { success: true, data: state } }));
  await page.route('**/api/projects/delivery-ui-test/engineering/chat', async route => {
    submitted = route.request().postDataJSON(); calls++;
    await route.fulfill({ json: { success: true, data: calls === 1
      ? { answer: 'Propuesta guardada', candidates: [{ id: 'candidate' }], sourceId: 'source' }
      : { answer: 'Respuesta sin revisión final', providerStatus: 'PARTIAL', calls: [{ provider: 'openai', status: 'SUCCEEDED', usage: { input_tokens: 8 } }, { provider: 'anthropic', status: 'FAILED', error: 'Revisor no disponible' }] } } });
  });
  await page.goto('/tests/fixtures/delivery-workflow.html');
  await page.getByRole('button', { name: /Chat IA/ }).click();
  await page.getByRole('combobox').selectOption('local');
  await page.getByRole('checkbox', { name: 'Registrar propuesta para revisión' }).check();
  const input = page.getByPlaceholder(/Escribe tu instrucción/);
  await input.fill('Agrega un campo teléfono'); await input.press('Enter');
  await expect(page.getByText('Propuesta de cambio registrada', { exact: true })).toBeVisible();
  expect(submitted.provider).toBe('local'); expect(submitted.proposeChange).toBe(true);
  await page.getByRole('checkbox', { name: 'Registrar propuesta para revisión' }).uncheck();
  await page.getByRole('combobox').selectOption('hybrid');
  await input.fill('Explica el proyecto'); await input.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'sin completar su revisión' })).toBeVisible();
  expect(submitted.provider).toBe('hybrid');
});
