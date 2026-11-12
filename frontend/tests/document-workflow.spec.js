import { test, expect } from '@playwright/test';
test('document workflow shows failure, evidence, participants and saves manual decisions', async ({ page }) => {
  const state = { revision: 3, units: [{ id: 'u', text: 'La operadora registra pedidos.', page: 1, section: 'Ventas', sourceVersionId: 'v1' }], calls: [],
    context: { approval: { version: 1 }, content: { summary: 'Pedidos' } }, actors: { approval: { version: 1 }, content: { items: [{ id: 'a', name: 'Operadora' }, { id: 'b', name: 'Cliente' }] } },
    requirements: { version: 1, validation: 'VALID', approval: null, review: { status: 'FAILED', error: 'Sonnet no disponible' }, content: { questions: [], items: [{ id: 'r', name: 'Registrar pedidos', description: 'Registrar pedidos', type: 'FUNCTIONAL', origin: 'EXPLICIT', status: 'PENDING_REVIEW', evidence: [{ unitId: 'u', sourceVersionId: 'v1', quote: 'registra pedidos.' }], participants: [{ actorId: 'a', role: 'EXECUTES' }], questions: [], acceptanceCriteria: [] }] } } };
  let saved;
  await page.route('**/api/projects/workflow-ui-test/document-workflow**', async route => {
    if (route.request().method() === 'PUT') { saved = route.request().postDataJSON(); state.requirements.content = saved.content; state.revision++; }
    await route.fulfill({ json: { success: true, data: state } });
  });
  await page.goto('/tests/fixtures/document-workflow.html');
  await expect(page.getByText('Sonnet no disponible', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aprobar requisitos y relaciones', exact: true })).toBeDisabled();
  await page.getByText('Evidencias originales (1)').click();
  await expect(page.getByLabel('Fragmento literal')).toHaveValue('registra pedidos.');
  await page.getByRole('button', { name: 'Agregar participante', exact: true }).click();
  await page.getByLabel('Participante', { exact: true }).nth(1).selectOption('b');
  await page.getByLabel('Participación', { exact: true }).nth(1).selectOption('RECEIVES_INFORMATION');
  await page.getByRole('textbox', { name: 'Descripción', exact: true }).fill('Texto revisado por la persona');
  await page.getByLabel('Motivo del cambio / resolución de observaciones').fill('Aclaración confirmada');
  await page.getByRole('button', { name: 'Guardar cambios y solicitar nueva revisión' }).click();
  await expect.poll(() => saved?.content.items[0].description).toBe('Texto revisado por la persona');
  expect(saved.revision).toBe(3); expect(saved.content.items[0].participants).toHaveLength(2);
  expect(saved.reason).toBe('Aclaración confirmada');
});
