const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { executionProblems } = require('./executableContract');
const { validateOperationContract } = require('./contractSchema');

const decisionHash = decision => createHash('sha256').update(JSON.stringify({ questionId: decision.questionId, answer: decision.customAnswer, revision: decision.revision })).digest('hex');

function applyCommandContracts(projectId, operations, entities, requirements, roles, decisions, document) {
  let hash = null;
  if (!document) {
    if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error('INVALID_PROJECT_ID');
    const filename = path.resolve(__dirname, '../../specifications/projects', projectId + '.commands.json');
    if (!fs.existsSync(filename)) return { groups: [], blockers: [], relationships: [], hash };
    const bytes = fs.readFileSync(filename);
    document = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
    hash = createHash('sha256').update(bytes).digest('hex');
  }
  if (document.projectId !== projectId || !Array.isArray(document.groups)) throw new Error('INVALID_COMMAND_DOCUMENT');
  for (const approval of document.policyApprovals || []) {
    if (!decisions[approval.questionId] || decisionHash(decisions[approval.questionId]) !== approval.hash) throw new Error('STALE_POLICY_APPROVAL: ' + approval.questionId);
  }
  for (const group of document.groups) {
    const decision = decisions[group.decisionQuestionId];
    if (!operations.some(op => op.operationId === group.parentOperationId) || !decision ||
        decision.data?.targetId !== group.parentOperationId || decisionHash(decision) !== group.decisionHash) throw new Error('STALE_COMMAND_APPROVAL: ' + group.parentOperationId);
  }
  const reviewedEntities = JSON.parse(JSON.stringify(entities));
  for (const entity of document.entities || []) {
    if (!entity.modelName || reviewedEntities.some(e => e.modelName === entity.modelName)) throw new Error('COMMAND_ENTITY_COLLISION');
    reviewedEntities.push(entity);
  }
  for (const change of document.entityFields || []) {
    const entity = reviewedEntities.find(e => e.modelName === change.entity);
    if (!entity || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(change.attribute?.fieldName || '') || ['__proto__', 'constructor', 'prototype'].includes(change.attribute.fieldName)) throw new Error('INVALID_COMMAND_FIELD');
    const previous = entity.attributes.find(a => a.fieldName === change.attribute.fieldName);
    if (previous?.isPk) throw new Error('COMMAND_PRIMARY_KEY_CHANGE');
    if (previous) Object.assign(previous, change.attribute);
    else entity.attributes.push({ isPk: false, autoIncrement: false, allowNull: true, ...change.attribute });
  }
  for (const change of document.entityIndexes || []) {
    const entity = reviewedEntities.find(item => item.modelName === change.entity);
    if (!entity || !Array.isArray(change.fields) || !change.fields.length || change.fields.some(field => !entity.attributes.some(attribute => attribute.fieldName === field))) throw new Error('INVALID_COMMAND_INDEX');
    entity.indexes ||= [];
    if (!entity.indexes.some(index => JSON.stringify(index.fields) === JSON.stringify(change.fields))) entity.indexes.push({ unique: true, fields: change.fields });
  }
  const groups = [], blockers = [], changes = [];
  const ids = new Set(operations.map(op => op.operationId));
  const routes = new Set(operations.map(op => op.method + ' ' + op.route));
  for (const group of document.groups) {
    const parent = operations.find(op => op.operationId === group.parentOperationId);
    const decision = decisions[group.decisionQuestionId];
    if (!parent || !decision || decision.data?.targetId !== parent.operationId || decisionHash(decision) !== group.decisionHash) throw new Error('STALE_COMMAND_APPROVAL: ' + group.parentOperationId);
    const commands = [];
    for (const definition of group.commands || []) {
      if (!definition.operationId.startsWith(parent.operationId + '-') || ids.has(definition.operationId) || routes.has(definition.method + ' ' + definition.route)) throw new Error('COMMAND_COLLISION');
      const permissionSource = definition.permissionSourceOperationId && operations.find(op => op.operationId === definition.permissionSourceOperationId);
      const allowedRoles = permissionSource?.authorizedRoles || (definition.roleEvidence && decision.customAnswer.includes(definition.roleEvidence) ? roles.filter(role => definition.roleEvidence.includes(role)) : []);
      const approvedSystem = definition.invocation === 'SYSTEM' && /Sistema automático|operación interna|proceso interno|ejecución interna|identidad técnica del sistema/i.test(definition.roleEvidence || '') && decision.customAnswer.includes(definition.roleEvidence);
      if (!approvedSystem && (!definition.authorizedRoles?.length || definition.authorizedRoles.some(role => !roles.includes(role) || !allowedRoles.includes(role)))) throw new Error('UNAPPROVED_COMMAND_PERMISSION: ' + definition.operationId);
      const linked = definition.requirementIds || [];
      if (!linked.length || linked.some(id => !parent.requirementIds.includes(id) || !requirements.some(r => r.id === id))) throw new Error('UNAPPROVED_COMMAND_REQUIREMENT');
      const command = { ...definition, type: 'BUSINESS_LOGIC', useCaseId: parent.useCaseId, parentOperationId: parent.operationId,
        permissionSource: approvedSystem ? 'SYSTEM_DECISION' : 'CONFIRMED_DECISION', approval: { questionId: decision.questionId, revision: decision.revision, hash: group.decisionHash },
        businessRules: parent.businessRules || [], unresolved: [] };
      const problems = [...validateOperationContract(command, { entities: reviewedEntities, roles }).errors, ...executionProblems(command, reviewedEntities)];
      if (problems.length) throw new Error('INVALID_COMMAND_CONTRACT: ' + command.operationId + ': ' + problems.join('; '));
      commands.push(command); ids.add(command.operationId); routes.add(command.method + ' ' + command.route);
    }
    if (!commands.length) throw new Error('EMPTY_COMMAND_GROUP');
    changes.push({ parent, commands });
    groups.push({ parentOperationId: parent.operationId, name: parent.name, commandIds: commands.map(op => op.operationId), approval: { questionId: decision.questionId, revision: decision.revision } });
    blockers.push(...(group.pendingDependencies || []).map(message => parent.operationId + ': ' + message));
  }
  // Validate every group before replacing any operation.
  entities.splice(0, entities.length, ...reviewedEntities);
  for (const { parent, commands } of changes) operations.splice(operations.indexOf(parent), 1, ...commands);
  for (const alias of document.aliases || []) {
    const source = operations.find(op => op.operationId === alias.parentOperationId);
    const decision = decisions[alias.decisionQuestionId];
    const targets = (alias.commandIds || []).map(id => operations.find(op => op.operationId === id));
    if (!source || !decision || decision.data?.targetId !== source.operationId || decisionHash(decision) !== alias.decisionHash || !alias.approvalEvidence || !decision.customAnswer.includes(alias.approvalEvidence) || !targets.length || targets.some(op => !op?.approval)) throw new Error('UNAPPROVED_COMMAND_ALIAS');
    for (const target of targets) target.requirementIds = [...new Set([...target.requirementIds, ...source.requirementIds])];
    operations.splice(operations.indexOf(source), 1);
    groups.push({ parentOperationId: source.operationId, name: source.name, commandIds: alias.commandIds, approval: { questionId: decision.questionId, revision: decision.revision } });
  }
  return { groups, blockers, relationships: document.relationships || [], screenActions: document.screenActions || [], screenDefinitions: document.screenDefinitions || [],
    reviewedAcceptance: blockers.length ? undefined : require('./reviewedAcceptanceRegistry').descriptor(projectId, document.acceptanceSuite),
    workspaces: document.workspaces || [], credentialChangeContract: document.credentialChangeContract, permissionMatrix: document.permissionMatrix,
    recordScopes: document.groups.flatMap(group => (group.recordScopes || []).map(scope => ({ ...scope, decisionQuestionId: group.decisionQuestionId, decisionHash: group.decisionHash }))), hash };
}

function applyCommandScreens(declarations, screens, operations, decisions) {
  for (const declaration of declarations || []) {
    const decision = decisions[declaration.decisionQuestionId];
    const operation = operations.find(op => op.operationId === declaration.operationId);
    const screen = declaration.screen;
    if (!decision || decisionHash(decision) !== declaration.decisionHash || operation?.approval?.questionId !== decision.questionId ||
        !declaration.approvalEvidence || !decision.customAnswer.includes(declaration.approvalEvidence) ||
        !screen?.id || !screen.route?.startsWith('/') || screens.some(s => s.id === screen.id || s.route === screen.route) ||
        !screen.roles?.length || screen.roles.some(role => !operation.authorizedRoles.includes(role))) throw new Error('UNAPPROVED_COMMAND_SCREEN');
    if (screen.contract?.dashboard?.operationId !== operation.operationId ||
        screen.contract.actions.some(action => action.operationId !== operation.operationId) ||
        screen.contract.fields.some(field => !Object.hasOwn(operation.input.bodySchema.properties, field.fieldName))) throw new Error('INVALID_COMMAND_SCREEN_CONTRACT');
    screens.push({ ...JSON.parse(JSON.stringify(screen)), sourceApproval: { approved: true, questionId: decision.questionId, revision: decision.revision } });
  }
}

function applyCommandRecordScopes(scopes, operations, entities, decisions) {
  for (const scope of scopes || []) {
    const decision = decisions[scope.decisionQuestionId];
    const operation = operations.find(op => op.operationId === scope.operationId);
    if (!decision || decisionHash(decision) !== scope.decisionHash || !operation || operation.method !== 'GET') throw new Error('UNAPPROVED_RECORD_SCOPE');
    for (const policy of scope.recordScope || []) {
      if (policy.roles.some(role => !operation.authorizedRoles.includes(role))) throw new Error('UNAPPROVED_RECORD_SCOPE_ROLE');
      const entity = entities.find(e => e.modelName === operation.entity);
      if (!policy.whereIn || !entity?.attributes.some(a => a.fieldName === policy.whereIn.field)) throw new Error('INVALID_RECORD_SCOPE_FIELD');
      const lookup = policy.lookups.find(item => item.id === policy.whereIn.lookup && item.many === true);
      const target = entities.find(e => e.modelName === lookup?.entity);
      if (!target?.attributes.some(a => a.fieldName === policy.whereIn.valueField)) throw new Error('INVALID_RECORD_SCOPE_LOOKUP');
      for (const field of Object.keys(lookup.where || {})) if (!target.attributes.some(a => a.fieldName === field)) throw new Error('INVALID_RECORD_SCOPE_FIELD');
    }
    operation.recordScope = scope.recordScope;
  }
}

function applyCommandScreenActions(declarations, screens, operations, decisions) {
  for (const declaration of declarations || []) {
    const decision = decisions[declaration.decisionQuestionId];
    const screen = screens.find(item => item.id === declaration.screenId);
    const operation = operations.find(item => item.operationId === declaration.operationId);
    if (!screen?.contract || !decision || decisionHash(decision) !== declaration.decisionHash ||
        operation?.approval?.questionId !== decision.questionId || !declaration.approvalEvidence ||
        !decision.customAnswer.includes(declaration.approvalEvidence)) throw new Error('UNAPPROVED_COMMAND_SCREEN_ACTION');
    const schema = operation.input.bodySchema;
    if ((declaration.fields || []).some(field => !Object.hasOwn(schema.properties, field.fieldName))) throw new Error('UNKNOWN_COMMAND_SCREEN_FIELD');
    for (const source of declaration.dataSources || []) {
      const reader = operations.find(item => item.method === 'GET' && item.route === source.route);
      if (!reader || operation.authorizedRoles.some(role => !reader.authorizedRoles?.includes(role))) throw new Error('UNAPPROVED_COMMAND_SCREEN_SOURCE');
    }
    screen.contract.actions.push({ actionId: declaration.actionId, name: declaration.name, operationId: operation.operationId,
      method: operation.method, route: operation.route, permissions: operation.authorizedRoles, parameters: operation.input, supplemental: true });
    screen.contract.actionForms = [...(screen.contract.actionForms || []), { ...declaration, route: operation.route,
      schema, permissions: operation.authorizedRoles, approval: operation.approval }];
  }
}

module.exports = { applyCommandContracts, applyCommandScreenActions, applyCommandRecordScopes, applyCommandScreens, decisionHash };

module.exports.applyCommandWorkspaces = function (declarations, screens, operations, decisions) {
  for (const declaration of declarations || []) {
    let screen = screens.find(item => item.id === declaration.screenId);
    if (!screen && declaration.create) { screen = { id: declaration.screenId, name: declaration.name, title: declaration.name, route: declaration.route, hasApprovedMockup: true, requiresMockup: false, sourceApproval: { approved: true } }; screens.push(screen); }
    if (!screen) throw new Error('WORKSPACE_SCREEN_NOT_FOUND');
    const approval = decisions[declaration.decisionQuestionId];
    if (!approval || decisionHash(approval) !== declaration.decisionHash) throw new Error('STALE_WORKSPACE_APPROVAL');
    const commands = declaration.commandIds.map(id => operations.find(op => op.operationId === id));
    const readers = declaration.readerIds.map(id => operations.find(op => op.operationId === id));
    if ([...commands, ...readers].some(op => !op || !op.authorizedRoles?.some(role => declaration.roles.includes(role)))) throw new Error('INVALID_WORKSPACE_OPERATION');
    const writes = steps => (steps || []).some(step => ['CREATE', 'UPDATE', 'DELETE', 'ASSOCIATE'].includes(step.action) || writes(step.steps));
    const forms = commands.map(op => ({ operationId: op.operationId, actionId: op.operationId, name: op.name, route: op.route, method: op.method, permissions: op.authorizedRoles, schema: op.input.bodySchema, readOnly: !writes(op.steps) }));
    const tables = readers.map(op => ({ operationId: op.operationId, name: op.name, route: op.route, method: op.method, permissions: op.authorizedRoles }));
    screen.roles = declaration.roles;
    screen.sourceHtml = screen.html;
    screen.targetEntity = null;
    screen.connectedOperationId = commands[0]?.operationId || readers[0]?.operationId;
    screen.actions = [...commands, ...readers].map(op => ({ operationId: op.operationId, name: op.name }));
    screen.components = [];
    screen.contract = { renderer: 'workspace', purpose: declaration.name || screen.name, workspace: { forms, tables, lookups: declaration.lookups || {}, clientOnly: declaration.roles.length === 1 && declaration.roles[0] === 'Cliente' }, uploads: forms.some(form => /UC-08|UC-16/.test(form.operationId)) ? { private: true, roles: [...new Set(forms.filter(form => /UC-08|UC-16/.test(form.operationId)).flatMap(form => form.permissions))] } : undefined, fields: [], actions: [...commands, ...readers].map(op => ({ actionId: op.operationId, operationId: op.operationId, method: op.method, route: op.route, permissions: op.authorizedRoles, parameters: op.input })), primaryActionId: commands[0]?.operationId || readers[0]?.operationId, dataSources: [], unresolved: [] };
  }
};
