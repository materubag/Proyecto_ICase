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
router.use('/runtime', async (req, res, next) => {
  try {
    const entry = service().runtime.servers.get(req.params.projectId); if (!entry || entry.child.exitCode != null) p.fail('Entorno detenido: abra la vista previa ejecutable', 503);
    const state = await service().get(req.params.projectId);
    if (entry.directory !== service().runtime.directory(req.params.projectId, state.workspace)) p.fail('Entorno desactualizado: vuelva a abrir la vista previa', 409);
    if (p.hash(require('../services/codegen/deliveryRuntime').manifest(entry.directory)) !== p.hash(state.files)) p.fail('Los archivos cambiaron; vuelva a verificar el entorno', 409);
    const headers = { ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}), ...(req.headers['content-type'] ? { 'Content-Type': req.headers['content-type'] } : {}) };
    const response = await fetch(`http://127.0.0.1:${entry.port}${req.url}`, { method: req.method, headers, ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: JSON.stringify(req.body) } : {}), redirect: 'manual' });
    res.status(response.status); const type=response.headers.get('content-type')||'application/octet-stream';res.setHeader('Content-Type',type);
    if(type.includes('text/html')){
      const prefix=`/api/projects/${req.params.projectId}/codegen/workflow/runtime`;
      let html=await response.text();
      html=html.replace(/((?:src|href)=["'])\/(assets\/)/g,`$1${prefix}/$2`).replace('</head>',`<script>window.__ICASE_PREVIEW_API_BASE__=${JSON.stringify(prefix+'/api')};</script></head>`);
      res.send(html);
    }else res.send(Buffer.from(await response.arrayBuffer()));
  } catch (e) { next(e); }
});
router.get('/download', async (req, res, next) => {
  try { res.type('application/zip').attachment('icase-delivery.zip').send(await service().archive(req.params.projectId)); }
  catch (error) { next(error); }
});
module.exports = router;
