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

// GET /api/projects/:projectId/codegen/spec
router.get('/spec', codegenController.getSpecification);

// POST /api/projects/:projectId/codegen/spec/validate
router.post('/spec/validate', codegenController.validateSpecification);

// POST /api/projects/:projectId/codegen/spec/approve
router.post('/spec/approve', codegenController.approveSpecification);

// AI Proposals & Mockup Wiring Endpoints
// GET /api/projects/:projectId/codegen/ai/status
router.get('/ai/status', codegenController.getAiProposalStatus);

// POST /api/projects/:projectId/codegen/ai/propose-operations
router.post('/ai/propose-operations', codegenController.proposeOperationSteps);

// POST /api/projects/:projectId/codegen/ai/propose-bindings
router.post('/ai/propose-bindings', codegenController.proposeMockupBindings);

// POST /api/projects/:projectId/codegen/ai/review-proposal
router.post('/ai/review-proposal', codegenController.reviewProposal);

// POST /api/projects/:projectId/codegen/ai/apply
router.post('/ai/apply', codegenController.applyApprovedProposals);

module.exports = router;
