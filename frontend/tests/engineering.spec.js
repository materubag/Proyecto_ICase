import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const registry = require('../../backend/src/services/diagrams/DiagramRegistry.js');
test('all five generators parse and render in a real browser, including hostile labels', async ({ page }) => {
  await page.goto('/');
  const models = {
    ER_DIAGRAM: { entities: [{ id: 'a', name: '1 Libro-á', attributes: [{ name: 'título []', type: 'String', isPk: false }] }, { id: 'b', name: '1 Libro a', attributes: [] }], relationships: [{ source: 'a', target: 'b', cardinality: 'ONE_TO_MANY', description: 'posee " >' }] },
    USE_CASE_DIAGRAM: { actors: [{ id: 'a', name: 'Bibliotecario "<script>' }], useCases: [{ id: 'u', code: 'CU-01', name: 'Registrar préstamo', actorIds: ['a'], relations: [{ type: 'include', targetId: 'v', evidence: 'explicit fixture' }] }, { id: 'v', code: 'CU-02', name: 'Validar datos', actorIds: [] }] },
    NAVIGATION_DIAGRAM: { navigationNodes: [{ id: 'n', name: 'Inicio', route: '/', platform: 'MOBILE' }, { id: 'm', name: 'Préstamos', route: '/prestamos', platform: 'MOBILE', parentId: 'n' }] },
    SOFTWARE_ARCHITECTURE: { architecture: { components: [{ name: 'Cliente' }, { name: 'API' }], connections: [{ from: 'Cliente', to: 'API', evidence: 'fixture', type: 'HTTP' }] } },
    SYSTEM_ARCHITECTURE: { architecture: { components: [{ name: 'Dispositivo confirmado' }, { name: 'Servidor confirmado' }], connections: [{ from: 'Dispositivo confirmado', to: 'Servidor confirmado', evidence: 'fixture', type: 'HTTPS' }] } }
  };
  for (const [type, model] of Object.entries(models)) {
    const code = registry.get(type)(model);
    const result = await page.evaluate(async ({ code, type }) => {
      const { default: mermaid } = await import('/node_modules/mermaid/dist/mermaid.esm.min.mjs');
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
      await mermaid.parse(code); const { svg } = await mermaid.render('test_' + type, code);
      return { rendered: svg.startsWith('<svg'), scripts: /<script/i.test(svg) };
    }, { code, type });
    expect(result.rendered, type).toBe(true); expect(result.scripts).toBe(false);
  }
});
test('UI renders candidate diagram before approval and uses impact modal for requirement edit', async ({ page, request }) => {
  const api = async (path, body, method = 'POST') => {
    const response = await request.fetch('http://127.0.0.1:8080/api' + path, { method, ...(body ? { data: body } : {}) });
    const json = await response.json(); expect(response.ok(), JSON.stringify(json)).toBeTruthy(); return json.data;
  };
  let project;
  try {
    project = await api('/projects', { name: 'UI fixture ' + Date.now() });
    const req = await api(`/projects/${project.id}/requirements`, { code: 'RF-01', name: 'Registrar Libro', description: 'El bibliotecario debe registrar Libro mediante web.', status: 'APPROVED' });
    const base = `/projects/${project.id}/engineering`;
    const candidate = await api(base + '/models', { kind: 'Entity', content: { name: 'Libro', description: 'Evidencia de prueba' }, requirementIds: [req.id] });
    await api(base + `/models/${candidate.id}`, { status: 'APPROVED' }, 'PATCH');
    await api(base + '/diagrams', { type: 'ER_DIAGRAM' });
    await page.goto('/');
    await page.getByText(project.name, { exact: true }).click();
    await page.locator('.sidebar').getByRole('button', { name: 'Modelado', exact: false }).click();
    await page.getByRole('button', { name: 'Crear candidato manual' }).click();
    await page.locator('.modal-card').getByLabel('Nombre', { exact: true }).fill('Bibliotecario manual');
    await page.locator('.modal-card').getByLabel('Descripción', { exact: true }).fill('Rol confirmado por el requisito de prueba.');
    await page.locator('.modal-card').getByLabel('Requisitos aprobados (selección múltiple)').selectOption(req.id);
    await page.getByRole('button', { name: 'Guardar propuesta', exact: true }).click();
    await expect(page.locator('.modal-card')).toHaveCount(0);
    await page.getByRole('button', { name: 'Aprobar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Modelo registrado' })).toBeVisible();
    await page.locator('.sidebar').getByRole('button', { name: 'Diagramas', exact: false }).click();
    await page.getByRole('button', { name: 'v1 · PENDING_REVIEW', exact: true }).click();
    await expect(page.locator('.modal-card .mermaid-diagram-viewer svg')).toBeVisible();
    const approve = page.locator('.modal-card').getByRole('button', { name: 'Aprobar', exact: true });
    await expect(approve).toBeEnabled(); await approve.click();
    await expect(page.locator('.modal-card')).toHaveCount(0);
    await expect(page.getByText('Versión oficial: 1')).toBeVisible();
    await page.locator('.sidebar').getByRole('button', { name: 'Requisitos', exact: false }).click();
    await page.locator('section').getByText('Registrar Libro', { exact: true }).click();
    await page.getByRole('button', { name: 'Editar', exact: false }).click();
    await page.locator('.modal-card textarea').fill('El bibliotecario debe registrar Libro y validar su título.');
    await page.getByRole('button', { name: 'Guardar Requisito', exact: true }).click();
    await expect(page.getByText('Revisar impacto del cambio')).toBeVisible();
    await expect(page.locator('.modal-card').getByText(/Entity: Libro/)).toBeVisible();
    await page.getByRole('button', { name: 'Continuar y aprobar' }).click();
    await expect(page.locator('.modal-card')).toHaveCount(0);
    const current = await api(base, null, 'GET');
    expect(current.Requirement[0].revision).toBe(2); expect(current.Artifact[0].status).toBe('OUTDATED');
    expect(current.Artifact[0].versions[0].status).toBe('APPROVED');
  } finally { if (project) await api('/projects/' + project.id, { status: 'ARCHIVED' }, 'PUT'); }
});
