/**
 * Code Generation API Routes
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const codegenController = require('../controllers/codegen.controller');
router.use('/workflow', require('./delivery.routes'));

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

// Persistent Generation Jobs (ANALYZING -> WAITING_FOR_INPUT -> GENERATING -> VALIDATING -> REPAIRING -> COMPLETED)
// POST /api/projects/:projectId/codegen/jobs/start
router.post('/jobs/start', (_req,res)=>res.status(409).json({success:false,error:{message:'La generación se realiza en las siete etapas con aprobación individual. Use /codegen/workflow/tasks.'}}));

// GET /api/projects/:projectId/codegen/jobs/active
router.get('/jobs/active', codegenController.getActiveGenerationJob);

// GET /api/projects/:projectId/codegen/jobs/:jobId
router.get('/jobs/:jobId', codegenController.getGenerationJobStatus);

// POST /api/projects/:projectId/codegen/jobs/:jobId/input
router.post('/jobs/:jobId/input', codegenController.submitJobInput);

// POST /api/projects/:projectId/codegen/jobs/:jobId/cancel
router.post('/jobs/:jobId/cancel', codegenController.cancelGenerationJob);

// POST /api/projects/:projectId/codegen/jobs/:jobId/resume
router.post('/jobs/:jobId/resume', codegenController.resumeGenerationJob);

// Decisions & Clarifications
// GET /api/projects/:projectId/codegen/decisions
router.get('/decisions', codegenController.getPendingDecisions);

// POST /api/projects/:projectId/codegen/decisions
router.post('/decisions', codegenController.submitDecision);

module.exports = router;
