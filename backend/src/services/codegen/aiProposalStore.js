/**
 * AI Proposal Store & Lifecycle Manager
 * Stores, caches, validates, and manages review states (PENDING_REVIEW, APPROVED, REJECTED, INVALIDATED)
 * for AI-generated operation steps and mockup bindings.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// In-memory registry with file backing
const proposalCache = new Map();

function getStorageDir() {
  const root = process.cwd().endsWith('backend') ? process.cwd() : path.join(process.cwd(), 'backend');
  const dir = path.join(root, '.cache', 'codegen_proposals');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (_) {}
  }
  return dir;
}

function getFilePath(projectId) {
  return path.join(getStorageDir(), `${projectId}.json`);
}

function computeDependencyHash(dependencies) {
  const serialized = JSON.stringify(dependencies, Object.keys(dependencies || {}).sort());
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function loadProjectProposals(projectId) {
  if (proposalCache.has(projectId)) {
    return proposalCache.get(projectId);
  }
  const filePath = getFilePath(projectId);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      proposalCache.set(projectId, data);
      return data;
    } catch (_) {}
  }
  const initial = { projectId, operations: {}, bindings: {}, updatedAt: new Date().toISOString() };
  proposalCache.set(projectId, initial);
  return initial;
}

function persistProjectProposals(projectId, data) {
  data.updatedAt = new Date().toISOString();
  proposalCache.set(projectId, data);
  const filePath = getFilePath(projectId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (_) {}
}

/**
 * Saves or updates an AI proposal for an operation
 */
function saveOperationProposal(projectId, operationId, proposal, dependencies = {}) {
  const data = loadProjectProposals(projectId);
  const depHash = computeDependencyHash(dependencies);

  const existing = data.operations[operationId];
  const version = existing ? (existing.version || 1) + 1 : 1;

  const entry = {
    id: `prop_op_${operationId}_v${version}`,
    operationId,
    type: 'OPERATION_STEPS',
    version,
    status: 'PENDING_REVIEW', // PENDING_REVIEW, APPROVED, REJECTED, INVALIDATED
    proposal,
    dependencyHash: depHash,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    reviewNotes: null
  };

  data.operations[operationId] = entry;
  persistProjectProposals(projectId, data);
  return entry;
}

/**
 * Saves or updates an AI proposal for a mockup binding
 */
function saveBindingProposal(projectId, screenId, proposal, dependencies = {}) {
  const data = loadProjectProposals(projectId);
  const depHash = computeDependencyHash(dependencies);

  const existing = data.bindings[screenId];
  const version = existing ? (existing.version || 1) + 1 : 1;

  const entry = {
    id: `prop_bind_${screenId}_v${version}`,
    screenId,
    type: 'MOCKUP_BINDING',
    version,
    status: 'PENDING_REVIEW',
    proposal,
    dependencyHash: depHash,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    reviewNotes: null
  };

  data.bindings[screenId] = entry;
  persistProjectProposals(projectId, data);
  return entry;
}

/**
 * Reviews a proposal (Approve or Reject)
 */
function reviewProposal(projectId, proposalId, { status, reviewer = 'User', notes = '' }) {
  const data = loadProjectProposals(projectId);
  const validStatuses = ['APPROVED', 'REJECTED', 'PENDING_REVIEW'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Estado de revisión inválido: '${status}'. Permitidos: ${validStatuses.join(', ')}`);
  }

  let found = null;
  // Search in operations
  for (const opId of Object.keys(data.operations)) {
    if (data.operations[opId].id === proposalId) {
      data.operations[opId].status = status;
      data.operations[opId].reviewedAt = new Date().toISOString();
      data.operations[opId].reviewedBy = reviewer;
      data.operations[opId].reviewNotes = notes;
      found = data.operations[opId];
      break;
    }
  }

  // Search in bindings
  if (!found) {
    for (const scrId of Object.keys(data.bindings)) {
      if (data.bindings[scrId].id === proposalId) {
        data.bindings[scrId].status = status;
        data.bindings[scrId].reviewedAt = new Date().toISOString();
        data.bindings[scrId].reviewedBy = reviewer;
        data.bindings[scrId].reviewNotes = notes;
        found = data.bindings[scrId];
        break;
      }
    }
  }

  if (!found) {
    throw new Error(`Propuesta no encontrada con ID '${proposalId}'.`);
  }

  persistProjectProposals(projectId, data);
  return found;
}

/**
 * Checks dependency freshness and invalidates proposals whose source dependencies changed
 */
function checkAndInvalidateDependencies(projectId, currentDependenciesMap = {}) {
  const data = loadProjectProposals(projectId);
  let changed = false;

  for (const [opId, entry] of Object.entries(data.operations)) {
    if (entry.status !== 'REJECTED' && currentDependenciesMap[opId]) {
      const currentHash = computeDependencyHash(currentDependenciesMap[opId]);
      if (entry.dependencyHash && entry.dependencyHash !== currentHash) {
        entry.status = 'INVALIDATED';
        entry.invalidatedAt = new Date().toISOString();
        entry.invalidationReason = 'Dependencias de requerimientos o entidades modificadas.';
        changed = true;
      }
    }
  }

  for (const [scrId, entry] of Object.entries(data.bindings)) {
    if (entry.status !== 'REJECTED' && currentDependenciesMap[scrId]) {
      const currentHash = computeDependencyHash(currentDependenciesMap[scrId]);
      if (entry.dependencyHash && entry.dependencyHash !== currentHash) {
        entry.status = 'INVALIDATED';
        entry.invalidatedAt = new Date().toISOString();
        entry.invalidationReason = 'Estructura de pantalla o entidades modificadas.';
        changed = true;
      }
    }
  }

  if (changed) {
    persistProjectProposals(projectId, data);
  }
  return data;
}

/**
 * Gets all proposals for a project
 */
function getProposals(projectId) {
  return loadProjectProposals(projectId);
}

/**
 * Applies approved proposals into a project specification object
 */
function applyApprovedProposals(projectId, spec) {
  const data = loadProjectProposals(projectId);
  const updatedSpec = JSON.parse(JSON.stringify(spec));
  let appliedCount = 0;

  // 1. Apply approved operation steps
  for (const [opId, entry] of Object.entries(data.operations)) {
    if (entry.status === 'APPROVED' && entry.proposal) {
      const op = (updatedSpec.operations || []).find(o => o.operationId === opId);
      if (op) {
        if (entry.proposal.steps && entry.proposal.steps.length > 0) {
          op.steps = entry.proposal.steps;
        }
        if (entry.proposal.targetEntity && !op.targetEntity) {
          op.targetEntity = entry.proposal.targetEntity;
        }
        if (entry.proposal.action && !op.action) {
          op.action = entry.proposal.action;
        }
        if (entry.proposal.transaction !== undefined) {
          op.transaction = entry.proposal.transaction;
        }
        if (entry.proposal.authorizedRoles && entry.proposal.authorizedRoles.length > 0) {
          op.authorizedRoles = entry.proposal.authorizedRoles;
        }
        appliedCount++;
      }
    }
  }

  // 2. Apply approved mockup bindings
  for (const [scrId, entry] of Object.entries(data.bindings)) {
    if (entry.status === 'APPROVED' && entry.proposal) {
      const scr = (updatedSpec.screens || []).find(s => s.id === scrId || s.name === scrId || s.route === scrId);
      if (scr) {
        scr.mockupBinding = entry.proposal;
        if (entry.proposal.connectedOperationId && !scr.connectedOperationId) {
          scr.connectedOperationId = entry.proposal.connectedOperationId;
        }
        if (entry.proposal.actions && Array.isArray(entry.proposal.actions)) {
          scr.actions = entry.proposal.actions;
        }
        appliedCount++;
      }
    }
  }

  return { spec: updatedSpec, appliedCount };
}

module.exports = {
  saveOperationProposal,
  saveBindingProposal,
  reviewProposal,
  checkAndInvalidateDependencies,
  getProposals,
  applyApprovedProposals,
  computeDependencyHash
};
