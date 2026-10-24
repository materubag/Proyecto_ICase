/**
 * Code Generation API Routes
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const codegenController = require('../controllers/codegen.controller');

// GET /api/projects/:projectId/codegen/preview
router.get('/preview', codegenController.getPreview);

// GET /api/projects/:projectId/codegen/download
router.get('/download', codegenController.downloadZip);

module.exports = router;
