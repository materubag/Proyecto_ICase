/**
 * Code Generation Controller
 * Handles preview, ZIP download, specification diagnostics and baseline approval.
 */

const codeGeneratorService = require('../services/codegen/codeGenerator.service');
const projectSpecService = require('../services/codegen/projectSpec.service');
const { validateProjectSpec, operationNeedsExecutableBehavior } = require('../services/codegen/projectSpecValidator');
const { buildProjectSpec } = require('../services/codegen/projectSpecBuilder');
const { planOperationSteps } = require('../services/codegen/aiOperationPlanner');
const { synthesizeMockupBindings } = require('../services/codegen/aiMockupSynthesizer');
const aiProposalStore = require('../services/codegen/aiProposalStore');
const codegenJobService = require('../services/codegen/codegenJob.service');
const codegenDecisionService = require('../services/codegen/codegenDecision.service');
const prisma = require('../config/prisma');

exports.getPreview = async (req, res) => {
  try {
    const { projectId } = req.params;
    const includeDocker = req.query.includeDocker !== 'false';
    // For preview, allowUnapproved defaults to true so diagnostics and candidate files can be inspected
    const allowUnapproved = req.query.allowUnapproved !== 'false';
    const allowPartialScope = req.query.allowPartialScope === 'true';
    const reviewOnly = req.query.reviewOnly !== 'false';

    const result = await codeGeneratorService.generateProjectFiles(projectId, {
      includeDocker,
      allowUnapproved,
      allowPartialScope,
      reviewOnly
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error en codegen.getPreview:', error);
    const isNotFound = error.message?.includes('no encontrado') || error.code === 'PROJECT_NOT_FOUND';
    const isDbUnavailable = error.message?.includes("Can't reach database") || error.code === 'P1001';
    const status = isNotFound ? 404 : isDbUnavailable ? 503 : 400;
    const userMessage = isDbUnavailable
      ? 'No se puede conectar a la base de datos PostgreSQL (puerto 5433). Verifique que el servicio o contenedor de Docker esté iniciado.'
      : error.message;

    return res.status(status).json({
      success: false,
      error: { message: userMessage, code: error.code || (isDbUnavailable ? 'DATABASE_UNAVAILABLE' : undefined), details: error.details }
    });
  }
};

exports.downloadZip = async (req, res) => {
  try {
    const { projectId } = req.params;
    let jobId = req.query.jobId;
    if (!jobId) {
      const active = codegenJobService.getActiveJob(projectId);
      if (active && ['COMPLETED', 'BLOCKED'].includes(active.status) && active.zipPath && active.zipSha256) {
        jobId = active.id;
      }
    }
    if (jobId) {
      const job = codegenJobService.getJob(jobId);
      if (!job || job.projectId !== projectId) return res.status(404).json({ success: false, error: { message: 'Trabajo no encontrado.' } });
      if (!['COMPLETED', 'BLOCKED'].includes(job.status) || !job.zipPath || !job.zipSha256) return res.status(409).json({ success: false, error: { message: 'El trabajo todavía no tiene un ZIP sellado.' } });
      const fs = require('fs'), path = require('path');
      const appRoot = process.cwd().endsWith('backend') ? process.cwd() : path.join(process.cwd(), 'backend');
      const root = path.resolve(appRoot, '.verification');
      const baseFilename = path.basename(String(job.zipPath || '').replace(/\\/g, '/'));
      let target = path.resolve(root, baseFilename);
      if (!fs.existsSync(target)) {
        target = path.resolve(job.zipPath);
      }
      if (!fs.existsSync(target) || !fs.realpathSync(target).startsWith(fs.realpathSync(root) + path.sep)) {
        throw new Error('INVALID_JOB_BUNDLE_PATH: El archivo ZIP no se encuentra en el directorio de verificación.');
      }
      const buffer = fs.readFileSync(target);
      if (require('../services/codegen/exportIntegrity').sha256(buffer) !== job.zipSha256) throw new Error('JOB_BUNDLE_INTEGRITY_FAILED');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${job.id}-${job.ready ? 'verificado' : 'revision'}.zip"`);
      res.setHeader('Content-Length', buffer.length);
      return res.end(buffer);
    }
    const includeDocker = req.query.includeDocker !== 'false';
    const allowPartialScope = req.query.allowPartialScope === 'true';

    // Download prioritizes approved baseline, but allows valid candidate spec when ready
    const allowUnapproved = req.query.allowUnapproved !== 'false';

    const { filename, buffer, size, diagnostics } = await codeGeneratorService.generateZipArchive(projectId, {
      includeDocker,
      useApprovedSpec: true,
      allowUnapproved,
      allowPartialScope,
      reviewOnly: req.query.reviewOnly === 'true'
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', size);

    return res.end(buffer);
  } catch (error) {
    console.error('Error en codegen.downloadZip:', error);
    return res.status(400).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
        diagnostics: error.diagnostics
      }
    });
  }
};

exports.getSpecification = async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await projectSpecService.getSpecificationDiagnostics(projectId);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error en codegen.getSpecification:', error);
    return res.status(error.message.includes('no encontrado') ? 404 : 400).json({
      success: false,
      error: { message: error.message, code: error.code }
    });
  }
};

exports.validateSpecification = async (req, res) => {
  try {
    const spec = req.body;
    const diagnostics = validateProjectSpec(spec);

    return res.status(200).json({
      success: true,
      data: diagnostics
    });
  } catch (error) {
    console.error('Error en codegen.validateSpecification:', error);
    return res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

exports.approveSpecification = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description } = req.body || {};

    const result = await projectSpecService.approveAndPersistSpec(projectId, {
      name,
      description
    });

    return res.status(201).json({
      success: true,
      message: 'Especificación aprobada y congelada exitosamente en ProjectBaseline.',
      data: result
    });
  } catch (error) {
    console.error('Error en codegen.approveSpecification:', error);
    return res.status(400).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
        details: error.details
      }
    });
  }
};

/**
 * Returns incomplete operations, unlinked screens, and proposal history
 */
exports.getAiProposalStatus = async (req, res) => {
  try {
    const { projectId } = req.params;
    const spec = await buildProjectSpec(projectId, { allowUnapproved: true });

    const incompleteOperations = (spec.operations || []).filter(op => operationNeedsExecutableBehavior(op, spec.entities)).map(op => ({
      operationId: op.operationId,
      name: op.name,
      type: op.type,
      route: op.route,
      narrativeStepsCount: (op.narrativeSteps || []).length,
      narrativeDescription: op.narrativeDescription || op.name
    }));

    // Screens with mockups lacking approved binding or connection
    const unconnectedScreens = (spec.screens || []).filter(s => s.html).map(s => ({
      id: s.id,
      name: s.name,
      route: s.route,
      hasApprovedMockup: s.hasApprovedMockup,
      connectedOperationId: s.connectedOperationId,
      actionsCount: (s.actions || []).length
    }));

    const proposals = aiProposalStore.getProposals(projectId);

    return res.status(200).json({
      success: true,
      data: {
        incompleteOperations,
        unconnectedScreens,
        proposals
      }
    });
  } catch (error) {
    console.error('Error en codegen.getAiProposalStatus:', error);
    const isDbUnavailable = error.message?.includes("Can't reach database") || error.code === 'P1001';
    return res.status(isDbUnavailable ? 503 : 400).json({
      success: false,
      error: {
        message: isDbUnavailable
          ? 'No se puede conectar a la base de datos PostgreSQL (puerto 5433). Verifique que el servicio o contenedor de Docker esté iniciado.'
          : error.message
      }
    });
  }
};

/**
 * Generates AI structured step proposals for incomplete operations
 */
exports.proposeOperationSteps = async (req, res) => {
  try {
    const { projectId } = req.params;
    require('../services/codegen/codegenAiHold').assertAllowed(projectId);
    const { operationIds } = req.body || {};
    const spec = await buildProjectSpec(projectId, { allowUnapproved: true });

    const catalog = {
      entities: spec.entities || [],
      relationships: spec.relationships || [],
      rules: spec.businessRules || [],
      roles: spec.roles || spec.security?.roles || [],
      requirements: spec.requirements || [],
      existingOperations: spec.operations || []
      , operations: spec.operations || [], screens: spec.screens || [], confirmedDecisions: spec.confirmedDecisions || {}
    };

    let targetOps = (spec.operations || []).filter(op => operationNeedsExecutableBehavior(op, spec.entities));
    if (Array.isArray(operationIds) && operationIds.length > 0) {
      targetOps = targetOps.filter(op => operationIds.includes(op.operationId));
    }

    const results = [];
    for (const op of targetOps) {
      const planResult = await planOperationSteps(projectId, op, catalog, {
        providerOverride: req.body?.providerOverride,
        skipLiveAi: req.body?.useLiveAi !== true
      });
      results.push(planResult);
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    console.error('Error en codegen.proposeOperationSteps:', error);
    return res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

/**
 * Generates AI bindings proposals for screen mockups
 */
exports.proposeMockupBindings = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { screenIds, useLiveAi } = req.body || {};
    if (useLiveAi) require('../services/codegen/codegenAiHold').assertAllowed(projectId);
    const spec = await buildProjectSpec(projectId, { allowUnapproved: true });

    const catalog = {
      entities: spec.entities || [],
      operations: spec.operations || [],
      requirements: spec.requirements || [],
      rules: spec.businessRules || [],
      relationships: spec.relationships || [],
      roles: spec.roles || spec.security?.roles || []
    };

    let targetScreens = (spec.screens || []).filter(s => s.html);
    if (Array.isArray(screenIds) && screenIds.length > 0) {
      targetScreens = targetScreens.filter(s => screenIds.includes(s.id) || screenIds.includes(s.name));
    }

    const results = [];
    const effective = useLiveAi === true ? aiProposalStore.applyApprovedProposals(projectId, spec).spec : spec;
    for (const scr of targetScreens) {
      if (require('../services/codegen/screenContract').isAuthScreen(scr)) continue;
      const bindingResult = useLiveAi === true
        ? await require('../services/codegen/aiScreenPlanner').planScreen(projectId, scr, effective, spec)
        : synthesizeMockupBindings(projectId, scr, catalog);
      results.push(bindingResult);
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    console.error('Error en codegen.proposeMockupBindings:', error);
    return res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

/**
 * Reviews a proposal (Approve or Reject)
 */
exports.reviewProposal = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { proposalId, status, notes } = req.body || {};

    if (!proposalId || !status) {
      return res.status(400).json({
        success: false,
        error: { message: "Campos 'proposalId' y 'status' ('APPROVED'|'REJECTED') son obligatorios." }
      });
    }

    const reviewed = aiProposalStore.reviewProposal(projectId, proposalId, {
      status,
      reviewer: 'ICASE User',
      notes: notes || ''
    });

    return res.status(200).json({
      success: true,
      message: `Propuesta '${proposalId}' actualizada a estado '${status}'.`,
      data: reviewed
    });
  } catch (error) {
    console.error('Error en codegen.reviewProposal:', error);
    return res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

/**
 * Applies approved proposals to project specification and re-validates
 */
exports.applyApprovedProposals = async (req, res) => {
  try {
    const { projectId } = req.params;
    const spec = await buildProjectSpec(projectId, { allowUnapproved: true });

    const { spec: updatedSpec, appliedCount } = aiProposalStore.applyApprovedProposals(projectId, spec);

    for (const op of updatedSpec.operations || []) {
      if (!op.useCaseId || !Array.isArray(op.steps) || op.steps.length === 0) continue;
      const previous = (spec.operations || []).find(item => item.operationId === op.operationId);
      if (previous && JSON.stringify(previous.steps || []) === JSON.stringify(op.steps)) continue;
      try {
        const useCase = await prisma.useCase.findUnique({ where: { id: op.useCaseId } });
        if (!useCase) continue;
        const evidence = (useCase.evidence && typeof useCase.evidence === 'object') ? { ...useCase.evidence } : {};
        const previousRoles = previous?.authorizedRoles || [];
        const nextRoles = (op.authorizedRoles || []).filter(role => previousRoles.includes(role));
        evidence.executionContract = {
          ...(evidence.executionContract || {}),
          action: op.action,
          targetEntity: op.targetEntity,
          steps: op.steps,
          authorizedRoles: nextRoles.length ? nextRoles : previousRoles,
          unresolved: []
        };
        await prisma.useCase.update({
          where: { id: op.useCaseId },
          data: { mainFlow: op.steps, evidence }
        });
      } catch (persistErr) {
        console.warn(`[codegen.apply] No se pudo persistir ${op.operationId}: ${persistErr.message}`);
      }
    }

    const diagnostics = validateProjectSpec(updatedSpec);

    return res.status(200).json({
      success: true,
      message: `Se aplicaron ${appliedCount} propuestas aprobadas a la especificación.`,
      data: { appliedCount, diagnostics }
    });
  } catch (error) {
    console.error('Error en codegen.applyApprovedProposals:', error);
    return res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

/**
 * Starts an asynchronous, persistent code generation job.
 * Non-blocking: returns 202 Accepted with job metadata immediately.
 */
exports.startGenerationJob = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { scope, maxTokens, maxRepairAttempts, timeoutMs, enableAI, includeDocker } = req.body || {};

    const job = await codegenJobService.startJob(projectId, {
      scope,
      enableAI: enableAI === true,
      includeDocker: includeDocker !== false,
      maxTokens,
      maxRepairAttempts,
      timeoutMs
    });

    return res.status(202).json({
      success: true,
      message: 'Trabajo de generación asistida iniciado correctamente.',
      data: job
    });
  } catch (error) {
    console.error('Error en codegen.startGenerationJob:', error);
    return res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

/**
 * Returns the currently active generation job for a project.
 */
exports.getActiveGenerationJob = async (req, res) => {
  try {
    const { projectId } = req.params;
    const job = codegenJobService.getActiveJob(projectId);

    return res.status(200).json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('Error en codegen.getActiveGenerationJob:', error);
    return res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

/**
 * Returns status and live logs for a specific generation job.
 */
exports.getGenerationJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = codegenJobService.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: { message: `Trabajo no encontrado con ID '${jobId}'.` }
      });
    }

    return res.status(200).json({
      success: true,
      data: job
    });
  } catch (error) {
    console.error('Error en codegen.getGenerationJobStatus:', error);
    return res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

/**
 * Submits user decision input to a job paused in WAITING_FOR_INPUT.
 */
exports.submitJobInput = async (req, res) => {
  try {
    const { jobId } = req.params;
    const submission = req.body || {};

    const result = await codegenJobService.submitInput(jobId, submission);

    return res.status(200).json({
      success: true,
      message: 'Aclaración recibida y registrada.',
      data: result
    });
  } catch (error) {
    console.error('Error en codegen.submitJobInput:', error);
    return res.status(400).json({
      success: false,
      error: { message: error.message, code: error.code, conflictingRequirement: error.conflictingRequirement }
    });
  }
};

/**
 * Resumes an interrupted job (e.g. after server restart).
 */
exports.resumeGenerationJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await codegenJobService.resumeJob(jobId, { batchReview: req.body?.batchReview === true });

    return res.status(200).json({
      success: true,
      message: result.message || 'Trabajo reanudado.',
      data: result
    });
  } catch (error) {
    console.error('Error en codegen.resumeGenerationJob:', error);
    return res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

/**
 * Cancels a running generation job.
 */
exports.cancelGenerationJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await codegenJobService.cancelJob(jobId);

    return res.status(200).json({
      success: true,
      message: 'Trabajo cancelado.',
      data: job
    });
  } catch (error) {
    console.error('Error en codegen.cancelGenerationJob:', error);
    return res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

/**
 * Retrieves pending business decisions for a project.
 */
exports.getPendingDecisions = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (req.query?.useLiveAi === 'true') require('../services/codegen/codegenAiHold').assertAllowed(projectId);
    const questions = await codegenDecisionService.getPendingDecisions(projectId, { skipLiveAi: req.query?.useLiveAi !== 'true' });

    return res.status(200).json({
      success: true,
      count: questions.length,
      analysis: questions.analysis,
      data: questions
    });
  } catch (error) {
    console.error('Error en codegen.getPendingDecisions:', error);
    return res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

/**
 * Direct endpoint to submit and persist a versioned decision.
 */
exports.submitDecision = async (req, res) => {
  try {
    const { projectId } = req.params;
    const submission = req.body || {};

    const result = await codegenDecisionService.submitDecision(projectId, submission);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error en codegen.submitDecision:', error);
    return res.status(400).json({
      success: false,
      error: { message: error.message, code: error.code, conflictingRequirement: error.conflictingRequirement }
    });
  }
};
