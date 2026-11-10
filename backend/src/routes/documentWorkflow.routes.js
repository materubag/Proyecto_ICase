const router = require('express').Router({ mergeParams: true });
const { service } = require('../services/analysis/documentWorkflow');
const endpoint = fn => async (req, res, next) => { try { res.json({ success: true, data: await fn(req) }); } catch (e) { next(e); } };
router.get('/', endpoint(req => service().get(req.params.projectId)));
router.post('/:stage/:task(prepare|review)', async (req, res, next) => {
  try {
    const snapshot = await service().get(req.params.projectId);
    service().gate(snapshot, req.params.stage);
    service().run(req.params.projectId, req.params.stage, req.params.task).catch(e => console.warn('[DocumentWorkflow]', e.message));
    res.status(202).json({ success: true, data: { status: 'STARTED' } });
  } catch (e) { next(e); }
});
router.put('/:stage', endpoint(req => service().edit(req.params.projectId, req.params.stage, req.body.content, req.body.revision, req.body.reason)));
router.post('/:stage/approve', endpoint(req => service().approve(req.params.projectId, req.params.stage, req.body.revision, req.body.resolution)));
router.post('/calls/:callId/retry', endpoint(req => service().retry(req.params.projectId, req.params.callId)));
module.exports = router;
