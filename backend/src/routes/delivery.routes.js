const router = require('express').Router({ mergeParams: true });
const { service } = require('../services/codegen/deliveryWorkflow');
const p = require('../services/codegen/deliveryPolicy');
const { safeFile, filesIn } = require('../services/codegen/deliveryRuntime');
const fs = require('node:fs');
const route = fn => async (req, res, next) => { try { res.json({ success: true, data: await fn(req) }); } catch (e) { next(e); } };
router.get('/', route(req => service().get(req.params.projectId)));
router.post('/tasks', async (req, res, next) => { try { res.status(202).json({ success: true, data: await service().start(req.params.projectId, String(req.body.target), req.body.task, req.body.options) }); } catch (e) { next(e); } });
router.put('/artifacts', route(req => service().edit(req.params.projectId, String(req.body.target), req.body.content, req.body.revision, req.body.reason)));
router.post('/approve', route(req => service().approve(req.params.projectId, String(req.body.target), req.body.revision, req.body)));
router.post('/changes', route(req => service().change(req.params.projectId, req.body, req.body.revision)));
router.post('/control', route(req => service().control(req.params.projectId, req.body.action, req.body.jobId, req.body)));
router.get('/files', route(async req => {
  const state = await service().get(req.params.projectId), directory = service().runtime.directory(req.params.projectId, state.workspace);
  if (req.query.path) {
    const name = String(req.query.path);
    if (/(^|\/)\.env(?:$|\.(?!example$))|secret|node_modules/.test(name)) p.fail('Archivo de entorno privado', 403);
    if (!Object.hasOwn(state.files, name)) p.fail('Archivo ajeno a la versión de trabajo', 404);
    return { path: name, content: fs.readFileSync(safeFile(directory, name), 'utf8') };
  }
  return Object.entries(state.files).filter(([name]) => !/(^|\/)\.env$|secret/.test(name)).map(([name, hash]) => ({ path: name, hash }));
}));
router.post('/preview/start', route(req => service().preview(req.params.projectId)));
router.get('/mockups/:screenId/html', async (req, res, next) => {
  try { const state = await service().get(req.params.projectId), value = state.mockups[req.params.screenId]; if (!value?.content?.html) p.fail('Mockup no disponible', 404);
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline' https:; img-src data: https:; font-src https:; form-action 'none'"); res.type('html').send(value.content.html);
  } catch (e) { next(e); }
});
router.get('/openapi.json', async (req, res, next) => {
  try {
    const codeGenService = require('../services/codegen/codeGenerator.service');
    let fullContract = null;
    try {
      const result = await codeGenService.generateProjectFiles(req.params.projectId, {
        allowUnapproved: true,
        allowPartialScope: true,
        reviewOnly: true,
        includeDocker: true
      });
      const openapiFile = (result.files || []).find(f => f.path === 'openapi.json');
      if (openapiFile && openapiFile.content) {
        fullContract = typeof openapiFile.content === 'string' ? JSON.parse(openapiFile.content) : openapiFile.content;
      }
    } catch (e) {
      console.warn('Fallback al state de entrega:', e.message);
    }

    if (fullContract) {
      fullContract.servers = [{ url: req.baseUrl + '/runtime' }];
      fullContract.paths = fullContract.paths || {};

      if (!fullContract.paths['/api/health'] && !fullContract.paths['/health']) {
        fullContract.paths['/api/health'] = {
          get: {
            tags: ['Sistema'],
            summary: 'Salud del servidor',
            security: [],
            responses: { 200: { description: 'Servidor activo' } }
          }
        };
      }
      if (!fullContract.paths['/api/auth/login'] && !fullContract.paths['/auth/login']) {
        fullContract.paths['/api/auth/login'] = {
          post: {
            tags: ['Autenticación'],
            operationId: 'login',
            summary: 'Obtener token JWT',
            security: [],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['identifier', 'password'],
                    properties: {
                      identifier: { type: 'string', description: 'Usuario o correo registrado' },
                      password: { type: 'string', format: 'password' }
                    }
                  }
                }
              }
            },
            responses: {
              200: { description: 'Token JWT. Cópielo en Authorize para probar los endpoints.' },
              401: { description: 'Credenciales inválidas' }
            }
          }
        };
      }
      if (!fullContract.paths['/api/upload'] && !fullContract.paths['/upload']) {
        fullContract.paths['/api/upload'] = {
          post: {
            tags: ['Archivos & Multimedia'],
            summary: 'Subir fotografía o evidencia (Multer)',
            description: 'Sube un archivo de evidencia multimedia (PNG, JPG, WebP) hacia el volumen persistente /uploads',
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    required: ['file'],
                    properties: {
                      file: { type: 'string', format: 'binary', description: 'Archivo de imagen o documento' }
                    }
                  }
                }
              }
            },
            responses: {
              201: {
                description: 'Archivo subido con éxito',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean', example: true },
                        url: { type: 'string', example: '/uploads/evidencia_123.jpg' },
                        filename: { type: 'string' },
                        mimetype: { type: 'string' },
                        size: { type: 'number' }
                      }
                    }
                  }
                }
              },
              400: { description: 'No se subió ningún archivo' }
            }
          }
        };
      }
      return res.json(fullContract);
    }

    const state = await service().get(req.params.projectId);
    if (state.contractError) p.fail('Contrato no disponible: ' + state.contractError);
    const contract = service().runtime.openapi(state);
    contract.servers = [{ url: req.baseUrl + '/runtime' }];
    res.json(contract);
  } catch (error) { next(error); }
});
router.get('/swagger', (req, res) => {
  res.type('html').send(`<!doctype html><html><head><title>Swagger · backend real de pruebas</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head><body><p>Las solicitudes se envían al backend aislado realmente levantado. Los ejemplos de OpenAPI no son evidencias de ejecución.</p><div id="swagger"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url: ${JSON.stringify(`/api/projects/${req.params.projectId}/codegen/workflow/openapi.json`)},dom_id:'#swagger',persistAuthorization:false});</script></body></html>`);
});
router.get('/frontend-preview', async (req, res, next) => {
  try {
    const { buildProjectSpec } = require('../services/codegen/projectSpecBuilder');
    const { renderFrontendPreviewHtml } = require('../services/codegen/frontendPreviewRenderer');
    const spec = await buildProjectSpec(req.params.projectId, { allowUnapproved: true });
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.type('html').send(renderFrontendPreviewHtml(req.params.projectId, spec, req.query || {}));
  } catch (error) {
    next(error);
  }
});

router.get('/frontend-preview/assets/live-bundle.js', async (req, res, next) => {
  try {
    const { buildLiveProjectFrontendBundle } = require('../services/codegen/liveFrontendBundler');
    const bundleCode = await buildLiveProjectFrontendBundle(req.params.projectId);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return res.send(bundleCode);
  } catch (error) {
    next(error);
  }
});

router.get('/frontend-preview/assets/:assetFile', (req, res, next) => {
  try {
    const path = require('node:path');
    const assetName = path.basename(String(req.params.assetFile || ''));
    const assetPath = path.join(__dirname, '..', 'services', 'codegen', 'runtimeAssets', assetName);
    if (!fs.existsSync(assetPath)) {
      return res.status(404).send('Asset no encontrado');
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (assetName.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    else if (assetName.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
    return res.send(fs.readFileSync(assetPath));
  } catch (error) {
    next(error);
  }
});

router.get('/frontend-preview/screen/:screenId', async (req, res, next) => {
  try {
    const { buildProjectSpec } = require('../services/codegen/projectSpecBuilder');
    const { renderScreenPreviewHtml } = require('../services/codegen/frontendPreviewRenderer');
    const spec = await buildProjectSpec(req.params.projectId, { allowUnapproved: true });
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.type('html').send(renderScreenPreviewHtml(req.params.projectId, spec, req.params.screenId, req.query || {}));
  } catch (error) {
    next(error);
  }
});

const { handleWorkshopRuntimeRequest } = require('../services/codegen/workshopFlowRuntime');

router.use('/runtime', async (req, res, next) => {
  try {
    return handleWorkshopRuntimeRequest(req.params.projectId, req, res);
  } catch (e) { next(e); }
});
router.get('/download', async (req, res, next) => {
  try {
    try {
      const buffer = await service().archive(req.params.projectId);
      return res.type('application/zip').attachment('icase-delivery.zip').send(buffer);
    } catch (archiveErr) {
      console.warn(`[delivery.routes/download] Fallback a generateZipArchive (${archiveErr.message})`);
      const codeGenService = require('../services/codegen/codeGenerator.service');
      const { filename, buffer } = await codeGenService.generateZipArchive(req.params.projectId, {
        includeDocker: true,
        allowUnapproved: true,
        ignoreOutdated: true
      });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename || 'icase-project.zip'}"`);
      return res.send(buffer);
    }
  } catch (error) { next(error); }
});
module.exports = router;
