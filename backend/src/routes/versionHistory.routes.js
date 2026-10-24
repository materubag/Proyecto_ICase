const express = require('express');
const router = express.Router();
const versionHistoryController = require('../controllers/versionHistory.controller');

router.post('/:historyId/restore', (req, res, next) => versionHistoryController.restore(req, res, next));

module.exports = router;
