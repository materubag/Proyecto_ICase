const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function loadExtension(projectId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error('INVALID_PROJECT_ID');
  const filename = path.resolve(__dirname, '../../specifications/projects', projectId + '.json');
  if (!fs.existsSync(filename)) return null;
  const bytes = fs.readFileSync(filename);
  const contract = JSON.parse(bytes);
  if (contract.projectId !== projectId || !Array.isArray(contract.requirementCodes)) throw new Error('INVALID_PROJECT_EXTENSION');
  return { contract, hash: crypto.createHash('sha256').update(bytes).digest('hex') };
}

function applyExtension(extension, requirements, operations, screens, options = {}) {
  if (!extension) return;
  for (const code of extension.contract.requirementCodes) if (!requirements.some(r => r.code === code)) throw new Error('EXTENSION_REQUIREMENT_NOT_APPROVED: ' + code);
  for (const patch of extension.contract.operations || []) {
    const operation = operations.find(o => o.operationId === patch.operationId);
    if (!operation && options.reviewedGroups?.some(group => group.parentOperationId === patch.operationId)) continue;
    if (!operation) throw new Error('EXTENSION_OPERATION_NOT_FOUND: ' + patch.operationId);
    Object.assign(operation, patch);
  }
  for (const patch of extension.contract.screens || []) {
    const screen = screens.find(s => s.route === patch.route);
    if (!screen) throw new Error('EXTENSION_SCREEN_NOT_FOUND: ' + patch.route);
    if (patch.htmlHash && crypto.createHash('sha256').update(screen.html || '').digest('hex') !== patch.htmlHash) throw new Error('STALE_MOCKUP_BINDING: ' + patch.route);
    screen.contract = { ...screen.contract, ...patch.contract };
    if (patch.roles) screen.roles = patch.roles;
    if (patch.targetEntity) screen.targetEntity = patch.targetEntity;
  }
}
module.exports = { loadExtension, applyExtension };
