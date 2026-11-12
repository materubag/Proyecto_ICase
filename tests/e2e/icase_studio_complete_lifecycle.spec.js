import { test, expect } from '@playwright/test';

test.describe('ICASE Studio - Complete 13-Flow Functional E2E Lifecycle', () => {
  let projectName;
  let testId;

  test.beforeEach(async () => {
    testId = Date.now();
    projectName = `QA Project E2E ${testId}`;
  });

  test('Flows 1 to 13: Project creation, sources, requirements, deduplication, diagrams, versions, and export', async ({ page, request }) => {
    const api = async (path, body, method = 'POST') => {
      const response = await request.fetch('http://127.0.0.1:8080/api' + path, {
        method,
        ...(body ? { data: body, headers: { 'Content-Type': 'application/json' } } : {})
      });
      const json = await response.json();
      expect(response.ok(), `API request ${method} ${path} failed: ${JSON.stringify(json)}`).toBeTruthy();
      return json.data;
    };

    let createdProjectId = null;

    try {
      // =========================================================================
      // FLUJO 1: Registro y creación de proyectos
      // =========================================================================
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Proyectos' })).toBeVisible();

      // Click "+ Nuevo proyecto" button
      await page.getByRole('button', { name: 'Nuevo proyecto' }).click();
      await expect(page.locator('.modal-card')).toBeVisible();

      // Fill form
      await page.locator('.modal-card input[placeholder*="Ej: Sistema"]').fill(projectName);
      await page.locator('.modal-card textarea').fill('Sistema integral de automatización para validación QA.');
      await page.locator('.modal-card').getByRole('button', { name: 'Crear Proyecto' }).click();

      // Verify redirection into project workspace
      await expect(page.locator('.modal-card')).toHaveCount(0);
      await expect(page.locator('.page-subheader')).toContainText(projectName);

      // Grab created project ID from API
      const allProjects = await api('/projects', null, 'GET');
      const currentProj = allProjects.find(p => p.name === projectName);
      expect(currentProj).toBeTruthy();
      createdProjectId = currentProj.id;

      // =========================================================================
      // FLUJO 2 & 3: Carga de documentos y Análisis de información
      // =========================================================================
      await page.locator('.sidebar').getByRole('button', { name: 'Fuentes & Entrevistas' }).click();
      await expect(page.locator('.main-area')).toContainText(/fuentes|sube un documento/i);

      // Ingest a source document via backend endpoint
      const textSource = await api(`/projects/${createdProjectId}/engineering/sources/text`, {
        name: 'Entrevista_Inicial.txt',
        text: 'RF-01 El bibliotecario debe registrar préstamos de libros con carnet activo.\nRF-02 El socio consulta el catálogo en línea.'
      });
      expect(textSource.id).toBeTruthy();

      // Toggle between sidebar views to refresh workspace data
      await page.locator('.sidebar').getByRole('button', { name: 'Resumen' }).click();
      await page.locator('.sidebar').getByRole('button', { name: 'Fuentes & Entrevistas' }).click();
      await expect(page.locator('.main-area')).toContainText(/Entrevista_Inicial\.txt|Extraído|Subido/i);

      // =========================================================================
      // FLUJO 4: Revisión, aprobación, edición y eliminación de requerimientos
      // =========================================================================
      await page.locator('.sidebar').getByRole('button', { name: 'Requerimientos' }).click();
      // Switch subtab to 'Requisitos'
      const reqTabBtn = page.getByRole('button', { name: /Requisitos \(\d+\)/i });
      if (await reqTabBtn.count() > 0) {
        await reqTabBtn.click();
      }

      // Create requirement through UI modal
      await page.getByRole('button', { name: 'Nuevo requisito' }).click();
      await expect(page.locator('.modal-card')).toBeVisible();
      await page.locator('.modal-card input').first().fill('RF-01');
      await page.locator('.modal-card input').nth(1).fill('Registrar préstamo de libros');
      await page.locator('.modal-card textarea').first().fill('El bibliotecario registra el préstamo con carnet activo.');
      await page.locator('.modal-card').getByRole('button', { name: 'Guardar Requisito' }).click();

      await expect(page.locator('.modal-card')).toHaveCount(0);
      await expect(page.locator('.main-area')).toContainText('Registrar préstamo de libros');

      // Fetch created requirement from API
      const projReqs = await api(`/projects/${createdProjectId}/requirements`, null, 'GET');
      const req1 = projReqs.find(r => r.code === 'RF-01');
      expect(req1).toBeTruthy();

      // Approve requirement via API
      await api(`/requirements/${req1.id}/status`, {
        status: 'APPROVED'
      }, 'PATCH');

      // Propose requirement edit through engineering change workflow
      const changeProp = await api(`/projects/${createdProjectId}/engineering/changes`, {
        elementType: 'Requirement',
        elementId: req1.id,
        type: 'UPDATE',
        reason: 'Actualización de alcance para incluir fecha límite',
        proposedState: {
          name: 'Registrar préstamo con fecha límite',
          description: 'El bibliotecario registra el préstamo indicando fecha límite de devolución.'
        }
      });
      expect(changeProp.id).toBeTruthy();

      // Review and apply change
      await api(`/projects/${createdProjectId}/engineering/changes/${changeProp.id}`, {
        status: 'APPROVED',
        confirmImpact: true
      }, 'PATCH');

      // Verify requirement updated revision
      const projReqsAfter = await api(`/projects/${createdProjectId}/requirements`, null, 'GET');
      const updatedReq = projReqsAfter.find(r => r.id === req1.id);
      expect(updatedReq.revision).toBe(2);
      expect(updatedReq.name).toBe('Registrar préstamo con fecha límite');

      // =========================================================================
      // FLUJO 5: Detección de duplicados
      // =========================================================================
      // Attempt to create duplicate code RF-01 -> expect duplicate code prevention/conflict
      const dupAttempt = await request.post(`http://127.0.0.1:8080/api/projects/${createdProjectId}/requirements`, {
        data: {
          code: 'RF-01',
          name: 'Duplicado de código',
          description: 'Intento de registro con el mismo código existente.',
          status: 'PENDING'
        },
        headers: { 'Content-Type': 'application/json' }
      });
      const dupJson = await dupAttempt.json();
      expect([400, 409, 500]).toContain(dupAttempt.status());
      expect(dupJson.success).toBe(false);
      const errMsg = JSON.stringify(dupJson);
      expect(errMsg).toMatch(/unique|duplicad|already exists|P2002/i);

      // =========================================================================
      // FLUJO 6, 7 & 8: Generación de diagramas E/R, Clases POO y Casos de Uso
      // =========================================================================
      // Seed entity and model candidates to generate models
      const entityCandidate = await api(`/projects/${createdProjectId}/engineering/models`, {
        kind: 'Entity',
        content: {
          name: 'Libro',
          description: 'Catálogo de libros disponibles',
          attributes: [{ name: 'isbn', type: 'string', isPk: true }, { name: 'titulo', type: 'string' }]
        },
        requirementIds: [req1.id]
      });
      await api(`/projects/${createdProjectId}/engineering/models/${entityCandidate.id}`, { status: 'APPROVED' }, 'PATCH');

      // Generate ER Diagram via engineering diagrams endpoint
      const erArtifact = await api(`/projects/${createdProjectId}/engineering/diagrams`, { type: 'ER_DIAGRAM' });
      expect(erArtifact.artifact || erArtifact.id).toBeTruthy();

      // Navigate to Modelado in UI
      await page.locator('.sidebar').getByRole('button', { name: 'Modelado' }).click();
      await expect(page.locator('.main-area')).toContainText(/Modelado del Sistema|Diagrama/i);

      // Verify ER tab
      await page.getByRole('button', { name: 'Diagrama Entidad–Relación' }).click();
      await expect(page.locator('.main-area')).toBeVisible();

      // Verify Casos de Uso tab
      await page.getByRole('button', { name: 'Casos de Uso' }).click();
      await expect(page.locator('.view-toggle-btn').filter({ hasText: 'Casos de Uso' }).first()).toHaveClass(/active/);

      // Verify Clases UML tab
      await page.getByRole('button', { name: 'Diagrama de Clases (UML)' }).click();
      await expect(page.locator('.view-toggle-btn').filter({ hasText: 'Diagrama de Clases' }).first()).toHaveClass(/active/);

      // =========================================================================
      // FLUJO 9: Generación del árbol de navegación
      // =========================================================================
      await page.locator('.sidebar').getByRole('button', { name: 'Árbol de Navegación' }).click();
      await expect(page.locator('.main-area')).toContainText(/Árbol de Navegación|Navegación/i);

      // =========================================================================
      // FLUJO 10: Generación de arquitectura y mockups
      // =========================================================================
      await page.locator('.sidebar').getByRole('button', { name: 'Arquitectura' }).click();
      await expect(page.locator('.main-area')).toContainText(/Arquitectura/i);

      await page.locator('.sidebar').getByRole('button', { name: 'Mockups' }).click();
      await expect(page.locator('.main-area')).toContainText(/Mockups|Prototipos/i);

      // =========================================================================
      // FLUJO 11: Edición y almacenamiento de artefactos
      // =========================================================================
      // In Architecture view, check edit architecture modal or save
      await page.locator('.sidebar').getByRole('button', { name: 'Arquitectura' }).click();
      const editBtn = page.getByRole('button', { name: 'Editar Arquitectura', exact: false });
      if (await editBtn.count() > 0) {
        await editBtn.click();
        await page.locator('.modal-card select, .modal-card input').first().fill('Microservicios Modulares');
        await page.locator('.modal-card').getByRole('button', { name: 'Guardar', exact: false }).click();
        await expect(page.locator('.modal-card')).toHaveCount(0);
      }

      // =========================================================================
      // FLUJO 12: Consulta de versiones y trazabilidad
      // =========================================================================
      await page.locator('.sidebar').getByRole('button', { name: 'Trazabilidad' }).click();
      await expect(page.locator('.main-area')).toContainText(/Trazabilidad|Matriz/i);

      await page.locator('.sidebar').getByRole('button', { name: 'Versiones' }).click();
      await expect(page.locator('.main-area')).toContainText(/Versiones|Historial/i);

      // =========================================================================
      // FLUJO 13: Exportación de artefactos
      // =========================================================================
      // Verify export endpoint returns full project artifact workspace
      const exportedWorkspace = await api(`/projects/${createdProjectId}/engineering/export`, null, 'GET');
      expect(exportedWorkspace).toBeTruthy();
      expect(exportedWorkspace.Requirement.length).toBeGreaterThanOrEqual(1);

      // Check Generación de Código tab in sidebar
      await page.locator('.sidebar').getByRole('button', { name: 'Generación de Código' }).click();
      await expect(page.locator('.main-area')).toContainText(/Generación de Código|Exportar/i);

    } finally {
      // Cleanup: Delete test project to keep database pristine
      if (createdProjectId) {
        await api(`/projects/${createdProjectId}`, null, 'DELETE');
      }
    }
  });
});
