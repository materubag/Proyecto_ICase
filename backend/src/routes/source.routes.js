const express = require('express');
const sourceController = require('../controllers/source.controller');
const { audioUpload } = require('../middleware/audioUpload.middleware');

const router = express.Router();

router.get('/:sourceId', (req, res, next) => sourceController.get(req, res, next));
router.get('/:sourceId/versions/:version', (req, res, next) => sourceController.getVersion(req, res, next));
router.post('/:sourceId/retry', audioUpload.single('file'), (req, res, next) => sourceController.retryAudio(req, res, next));
router.post('/:sourceId/analyze', (req, res, next) => sourceController.analyze(req, res, next));

module.exports = router;