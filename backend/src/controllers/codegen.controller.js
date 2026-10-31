/**
 * Code Generation Controller
 * Handles preview, ZIP download, specification diagnostics and baseline approval.
 */

const codeGeneratorService = require('../services/codegen/codeGenerator.service');
const projectSpecService = require('../services/codegen/projectSpec.service');
const { validateProjectSpec } = require('../services/codegen/projectSpecValidator');
const { buildProjectSpec } = require('../services/codegen/projectSpecBuilder');
const { planOperationSteps } = require('../services/codegen/aiOperationPlanner');
const { synthesizeMockupBindings } = require('../services/codegen/aiMockupSynthesizer');
const aiProposalStore = require('../services/codegen/aiProposalStore');

exports.getPreview = async (req, res) => {
  try {
    const { projectId } = req.params;
    const includeDocker = req.query.includeDocker !== 'false';
    // For preview, allowUnapproved defaults to true so diagnostics and candidate files can be inspected
    const allowUnapproved = req.query.allowUnapproved !== 'false';
    const allowPartialScope = req.query.allowPartialScope === 'true';

    const result = await codeGeneratorService.generateProjectFiles(projectId, {
      includeDocker,
      allowUnapproved,
      allowPartialScope
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error en codegen.getPreview:', error);
    return res.status(error.message.includes('no encontrado') ? 404 : 400).json({
      success: false,
      error: { message: error.message, code: error.code, details: error.details }
    });
  }
};

exports.downloadZip = async (req, res) => {
  try {
    const { projectId } = req.params;
    const includeDocker = req.query.includeDocker !== 'false';
    const allowPartialScope = req.query.allowPartialScope === 'true';

    // Download prioritizes approved baseline, but allows valid candidate spec when ready
    const allowUnapproved = req.query.allowUnapproved !== 'false';

    const { filename, buffer, size, diagnostics } = await codeGeneratorService.generateZipArchive(projectId, {
      includeDocker,
      useApprovedSpec: true,
      allowUnapproved,
      allowPartialScope
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

    // Incomplete operations: business logic without executable steps or targetEntity
    const incompleteOperations = (spec.operations || []).filter(op => {
      if (op.type !== 'BUSINESS_LOGIC') return false;
      const hasSteps = Array.isArray(op.steps) && op.steps.length > 0;
      return !hasSteps && !op.targetEntity;
    }).map(op => ({
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
    return res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

/**
 * Generates AI structured step proposals for incomplete operations
 */
exports.proposeOperationSteps = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { operationIds } = req.body || {};
    const spec = await buildProjectSpec(projectId, { allowUnapproved: true });

    const catalog = {
      entities: spec.entities || [],
      rules: spec.businessRules || [],
      roles: spec.roles || spec.security?.roles || [],
      requirements: spec.requirements || [],
      existingOperations: spec.operations || []
    };

    let targetOps = (spec.operations || []).filter(op => op.type === 'BUSINESS_LOGIC');
    if (Array.isArray(operationIds) && operationIds.length > 0) {
      targetOps = targetOps.filter(op => operationIds.includes(op.operationId));
    } else {
      targetOps = targetOps.filter(op => (!op.steps || op.steps.length === 0) && !op.targetEntity);
    }

    const results = [];
    for (const op of targetOps) {
      const planResult = await planOperationSteps(projectId, op, catalog, {
        providerOverride: req.body?.providerOverride
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
    const { screenIds } = req.body || {};
    const spec = await buildProjectSpec(projectId, { allowUnapproved: true });

    const catalog = {
      entities: spec.entities || [],
      operations: spec.operations || [],
      roles: spec.roles || spec.security?.roles || []
    };

    let targetScreens = (spec.screens || []).filter(s => s.html);
    if (Array.isArray(screenIds) && screenIds.length > 0) {
      targetScreens = targetScreens.filter(s => screenIds.includes(s.id) || screenIds.includes(s.name));
    }

    const results = [];
    for (const scr of targetScreens) {
      const bindingResult = synthesizeMockupBindings(projectId, scr, catalog);
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
    const diagnostics = validateProjectSpec(updatedSpec);

    return res.status(200).json({
      success: true,
      message: `Se aplicaron ${appliedCount} propuestas aprobadas a la especificación.`,
      appliedCount,
      diagnostics
    });
  } catch (error) {
    console.error('Error en codegen.applyApprovedProposals:', error);
    return res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};
