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

function operationDependencies(operation, catalog) {
  return { operation, entities: catalog.entities || [], requirements: catalog.requirements || [], rules: catalog.rules || [], relationships: catalog.relationships || [], roles: catalog.roles || [] };
}

function bindingDependencies(screen, catalog) {
  return { screenId: screen.id, route: screen.route, htmlHash: crypto.createHash('sha256').update(screen.html || '').digest('hex'),
    ...(screen.confirmedDecisionContextHash ? { confirmedDecisionContextHash: screen.confirmedDecisionContextHash } : {}),
    screenContract: screen.contract || null, ...(screen.generationDecisions ? { generationDecisions: screen.generationDecisions } : {}), entities: catalog.entities || [], operations: catalog.operations || [],
    requirements: catalog.requirements || [], rules: catalog.rules || [], relationships: catalog.relationships || [], roles: catalog.roles || [] };
}

function getStorageDir() {
  if (fs.existsSync(path.join(process.cwd(), '.cache', 'codegen_proposals'))) {
    return path.join(process.cwd(), '.cache', 'codegen_proposals');
  }
  if (fs.existsSync(path.join(process.cwd(), 'backend', '.cache', 'codegen_proposals'))) {
    return path.join(process.cwd(), 'backend', '.cache', 'codegen_proposals');
  }
  const root = (process.cwd().endsWith('backend') || !fs.existsSync(path.join(process.cwd(), 'backend'))) ? process.cwd() : path.join(process.cwd(), 'backend');
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
  const canonical = value => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const serialized = JSON.stringify(canonical(dependencies || {}));
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
function saveOperationProposal(projectId, operationId, proposal, dependencies = {}, providerMetadata = {}) {
  const data = loadProjectProposals(projectId);
  const depHash = computeDependencyHash(dependencies);

  const existing = data.operations[operationId];
  const version = existing ? (existing.version || 1) + 1 : 1;

  const entry = {
    id: `prop_op_${operationId}_v${version}`,
    operationId,
    type: 'OPERATION_STEPS',
    providerMetadata,
    version,
    status: 'PENDING_REVIEW', // PENDING_REVIEW, APPROVED, REJECTED, INVALIDATED
    proposal,
    dependencyHash: depHash,
    sourceDependencies: dependencies,
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
function saveBindingProposal(projectId, screenId, proposal, dependencies = {}, providerMetadata = {}) {
  const data = loadProjectProposals(projectId);
  const depHash = computeDependencyHash(dependencies);

  const existing = data.bindings[screenId];
  const version = existing ? (existing.version || 1) + 1 : 1;

  const entry = {
    id: `prop_bind_${screenId}_v${version}`,
    screenId,
    type: 'MOCKUP_BINDING',
    providerMetadata,
    version,
    status: 'PENDING_REVIEW',
    proposal,
    dependencyHash: depHash,
    sourceDependencies: dependencies,
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
  const catalog = { entities: spec.entities, operations: spec.operations, requirements: spec.requirements, rules: spec.businessRules || spec.rules, relationships: spec.relationships, roles: spec.security?.roles || spec.roles };
  const dependencies = Object.fromEntries([
    ...(spec.operations || []).map(op => [op.operationId, operationDependencies(op, catalog)]),
    ...(spec.screens || []).map(screen => [screen.id, bindingDependencies(screen, catalog)])
  ]);
  const data = checkAndInvalidateDependencies(projectId, dependencies);
  const updatedSpec = JSON.parse(JSON.stringify(spec));
  let appliedCount = 0;
  const applications = [];
  for (const entry of [...Object.values(data.operations), ...Object.values(data.bindings)]) if (entry.status === 'INVALIDATED') applications.push({ proposalId: entry.id, applied: false, reason: 'STALE_DEPENDENCIES', validation: 'REJECTED' });

  // 1. Apply approved operation steps
  for (const [opId, entry] of Object.entries(data.operations)) {
    if (entry.status === 'APPROVED' && entry.proposal) {
      const op = (updatedSpec.operations || []).find(o => o.operationId === opId);
      if (op) {
        const catalog = { entities: spec.entities, operations: spec.operations, screens: spec.screens, requirements: spec.requirements, rules: spec.businessRules || spec.rules, relationships: spec.relationships, roles: spec.security?.roles || spec.roles };
        const currentHash = computeDependencyHash(operationDependencies(op, catalog));
        const candidate = { ...op, ...entry.proposal, operationId: op.operationId, route: op.route, method: op.method, authorizedRoles: op.authorizedRoles };
        const errors = [...require('./contractSchema').validateOperationContract(candidate, catalog).errors, ...require('./executableContract').executionProblems(candidate, spec.entities || [])];
        if (entry.reviewedBy === 'CODEGEN_TECHNICAL_VALIDATION') errors.push(...require('./aiGenerationPolicy').validateGeneratedOperation(op, entry.proposal, catalog));
        if (entry.dependencyHash !== currentHash || errors.length) {
          if (entry.dependencyHash !== currentHash) { entry.status = 'INVALIDATED'; entry.invalidationReason = 'STALE_DEPENDENCIES'; persistProjectProposals(projectId, data); }
          applications.push({ proposalId: entry.id, applied: false, reason: entry.dependencyHash !== currentHash ? 'STALE_DEPENDENCIES' : 'INVALID_CONTRACT', validation: 'REJECTED' });
          continue;
        }
        for (const key of ['bindingVersion', 'input', 'resultStep', 'preconditions', 'acceptanceCriteria', 'acceptanceScenarios', 'errors', 'recordAccess', 'businessRules', 'unresolved']) if (entry.proposal[key] !== undefined) op[key] = entry.proposal[key];
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
          const currentRoles = op.authorizedRoles || [];
          const backed = entry.proposal.authorizedRoles.filter(role => currentRoles.includes(role));
          op.authorizedRoles = backed.length ? backed : currentRoles;
        }
        appliedCount++;
        applications.push({ proposalId: entry.id, applied: true, validation: 'PASSED' });
      }
    }
  }

  // 2. Apply approved mockup bindings
  for (const [scrId, entry] of Object.entries(data.bindings)) {
    if (entry.status === 'APPROVED' && entry.proposal) {
      const scr = (updatedSpec.screens || []).find(s => s.id === scrId || s.name === scrId || s.route === scrId);
      if (scr) {
        const expected = entry.sourceDependencies;
        const currentHash = computeDependencyHash(bindingDependencies(scr, { entities: spec.entities, operations: spec.operations, requirements: spec.requirements, rules: spec.businessRules || spec.rules, relationships: spec.relationships, roles: spec.security?.roles || spec.roles }));
        const validation = require('./contractSchema').validateBindingContract(entry.proposal, { operations: spec.operations || [] });
        if (!expected || entry.dependencyHash !== currentHash || !validation.valid) {
          if (entry.dependencyHash !== currentHash) { entry.status = 'INVALIDATED'; entry.invalidationReason = 'STALE_DEPENDENCIES'; persistProjectProposals(projectId, data); }
          applications.push({ proposalId: entry.id, applied: false, reason: !validation.valid ? 'INVALID_CONTRACT' : 'STALE_DEPENDENCIES', validation: 'REJECTED' });
          continue;
        }
        scr.mockupBinding = entry.proposal;
        if (!entry.proposal.controlBindings) {
          applications.push({ proposalId: entry.id, applied: false, reason: 'NO_EXECUTABLE_BINDING', validation: 'REJECTED' });
          continue;
        }
        scr.contract = { ...scr.contract, ...(entry.proposal.screenContract || {}), controlBindings: entry.proposal.controlBindings };
        if (entry.proposal.connectedOperationId && !scr.connectedOperationId) {
          scr.connectedOperationId = entry.proposal.connectedOperationId;
        }
        if (entry.proposal.actions && Array.isArray(entry.proposal.actions)) {
          scr.actions = entry.proposal.actions;
        }
        appliedCount++;
        applications.push({ proposalId: entry.id, applied: true, validation: 'PASSED' });
      }
    }
  }

  if (appliedCount && updatedSpec.hash) {
    updatedSpec.derivedFromHash = updatedSpec.hash;
    delete updatedSpec.hash;
    delete updatedSpec.approvedAt;
  }
  return { spec: updatedSpec, appliedCount, applications };
}

module.exports = {
  saveOperationProposal,
  saveBindingProposal,
  reviewProposal,
  checkAndInvalidateDependencies,
  getProposals,
  loadProjectProposals,
  persistProjectProposals,
  applyApprovedProposals,
  computeDependencyHash
  , operationDependencies
  , bindingDependencies
};
