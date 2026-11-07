const env = require('../../config/env');
const { stripRolePreviewChrome } = require('./mockupConverter');
const { executionProblems } = require('./executableContract');
const { buildScreenContract } = require('./screenContract');
const store = require('./aiProposalStore');

function screenOperationProblems(operation, spec) {
  // Entity controllers implement approved READ operations directly. They do
  // not use the business-step interpreter and do not require a steps array.
  if (operation.type === 'READ' && operation.method === 'GET') {
    const errors = [...(operation.unresolved || [])];
    if (!spec.entities?.some(entity => [entity.id, entity.name, entity.modelName].includes(operation.entity))) errors.push('Entidad de consulta inexistente');
    if (!operation.route?.startsWith('/api/')) errors.push('Ruta de consulta inválida');
    return errors;
  }
  return executionProblems(operation, spec.entities);
}

function screenChoices(screen, spec) {
  if (!screen.roles?.length) return [];
  const declared = (screen.contract?.actions || []).map(a => a.operationId);
  return (spec.operations || []).filter(op => !screenOperationProblems(op, spec).length &&
    op.authorizedRoles?.length && (screen.roles || []).every(r => op.authorizedRoles.includes(r)) &&
    (declared.includes(op.operationId) || (screen.requirementIds || screen.contract?.requirementIds || []).some(id => op.requirementIds?.includes(id))));
}

function compileScreenProposal(screen, response, spec) {
  const errors = [];
  if (response?.ambiguities?.length) errors.push('UNRESOLVED_SCREEN_QUESTIONS');
  const choices = screenChoices(screen, spec);
  const declaredPrimary = screen.contract?.actions?.find(action => action.actionId === screen.contract?.primaryActionId)?.operationId;
  const op = choices.find(op => op.operationId === (response?.primaryOperationId || declaredPrimary));
  if (!op) return { errors: [...errors, 'UNBACKED_SCREEN_OPERATION'] };
  const existing = screen.contract || {};
  // Existing record permissions, fields and navigation are authoritative.
  const properties = op.input?.bodySchema?.properties || {};
  const inputFields = Object.entries(properties).map(([fieldName, definition]) => ({
    fieldName, label: fieldName, mode: 'editable', required: op.input.bodySchema.required?.includes(fieldName) || false,
    dataType: ({ integer: 'INTEGER', number: 'DECIMAL', boolean: 'BOOLEAN' })[definition.type] || 'STRING',
    ...existing.fields?.find(field => field.fieldName === fieldName)
  }));
  const fields = [...(existing.fields || []), ...inputFields.filter(field => !existing.fields?.some(previous => previous.fieldName === field.fieldName))];
  const actionId = existing.actions?.find(a => a.operationId === op.operationId)?.actionId || 'confirmar';
  const actions = [...(existing.actions || [])];
  if (!actions.some(action => action.operationId === op.operationId)) actions.push({ actionId, name: op.name, operationId: op.operationId });
  const listOp = response.listOperationId && choices.find(op => op.operationId === response.listOperationId && op.method === 'GET' && !op.route.includes(':'));
  if (response.listOperationId && !listOp) errors.push('UNBACKED_LIST_OPERATION');
  let tableColumns = existing.tableColumns;
  if (!tableColumns && response.tableColumns) {
    const entity = spec.entities.find(entity => [entity.id, entity.modelName, entity.name].includes((listOp || op).entity || (listOp || op).targetEntity));
    const firstRow = (screen.html || '').match(/<table\b[^>]*>[\s\S]*?<tr\b[^>]*>([\s\S]*?)<\/tr>/i)?.[1] || '';
    const count = [...firstRow.matchAll(/<(?:th|td)\b/gi)].length;
    if (!Array.isArray(response.tableColumns) || response.tableColumns.some(column => !Number.isInteger(column.index) || column.index < 0 || column.index >= count || !entity?.attributes?.some(a => a.fieldName === column.field) || /password|hash|secret|clave|contrasena/i.test(column.field))) errors.push('INVALID_TABLE_COLUMNS');
    else tableColumns = response.tableColumns.map(({ index, field }) => ({ index, field }));
  }
  const html = stripRolePreviewChrome(screen.html || '');
  let controls = response.controlBindings || response.bindings || (response && Object.keys(response).every(key => ['input', 'select', 'textarea', 'button'].includes(key)) ? response : null);
  if (!controls || typeof controls !== 'object' || Array.isArray(controls)) return { errors: [...errors, 'MISSING_CONTROL_BINDINGS'] };
  for (const [tag, bindings] of Object.entries(controls)) {
    if (!['input', 'select', 'textarea', 'button'].includes(tag) || !Array.isArray(bindings)) { errors.push('INVALID_CONTROL_TAG'); continue; }
    const count = [...html.matchAll(new RegExp('<' + tag + '\\b', 'gi'))].length;
    const seen = new Set();
    for (const binding of bindings) {
      if (!Number.isInteger(binding.index) || binding.index < 0 || binding.index >= count || seen.has(binding.index)) errors.push('INVALID_CONTROL_INDEX: ' + tag + ' index=' + binding.index + '; allowed=' + Array.from({ length: count }, (_, i) => i).join(','));
      seen.add(binding.index);
      if (binding.field && !fields.some(field => field.fieldName === binding.field)) errors.push('UNKNOWN_CONTROL_FIELD');
      if (binding.actionId && !actions.some(action => action.actionId === binding.actionId)) errors.push('UNKNOWN_CONTROL_ACTION');
      if (binding.label && /[<>"'{}]/.test(binding.label)) errors.push('INVALID_CONTROL_LABEL');
      if (binding.value !== undefined && (tag !== 'button' || !Number.isFinite(binding.value))) errors.push('INVALID_CONTROL_VALUE');
      if (!binding.field && !binding.actionId) errors.push('EMPTY_CONTROL_BINDING');
    }
  }
  controls = Object.fromEntries([...new Set([...Object.keys(existing.controlBindings || {}), ...Object.keys(controls)])].map(tag => {
    const original = existing.controlBindings?.[tag] || [];
    for (const binding of controls[tag] || []) {
      const previous = original.find(item => item.index === binding.index);
      if (previous && ['field', 'actionId', 'value'].some(key => previous[key] !== binding[key])) errors.push('AI_CHANGED_EXISTING_CONTROL_BINDING: ' + tag + ':' + binding.index);
    }
    return [tag, [...original, ...(controls[tag] || []).filter(binding => !original.some(item => item.index === binding.index))]];
  }));
  // Do not remove declared business questions. Recompute derived binding errors
  // only on screens which did not already have an explicit executable action.
  if (existing.actions?.some(a => !a.unresolved) && existing.unresolved?.length) errors.push('EXISTING_SCREEN_DECISION_REQUIRED');
  const contract = buildScreenContract({ ...screen, targetEntity: null, contract: {
    ...existing, entityId: null, renderer: 'task', fields, actions, primaryActionId: actionId,
    dataSources: existing.dataSources?.length ? existing.dataSources : listOp ? [{ name: 'records', route: listOp.route, operationId: listOp.operationId }] : [],
    controlBindings: controls, tableColumns, unresolved: [], listSource: existing.listSource ?? (listOp ? 'records' : null)
  } }, spec);
  const audit = require('./screenBindingAudit').auditScreenBindings({ ...screen, contract });
  if (audit.missingFields.length || audit.missingPrimaryAction || audit.unboundDataRegions) errors.push('INCOMPLETE_SCREEN_BINDINGS');
  return { errors, contract };
}

async function planScreen(projectId, screen, spec, dependencySpec = spec, options = {}) {
  require('./codegenAiHold').assertAllowed(projectId);
  const provider = String(env.AI_PROVIDER || 'mock').toLowerCase();
  let metadata = { mode: 'AI', provider, outcome: 'SKIPPED', reason: 'PROVIDER_UNAVAILABLE' };
  const choices = screenChoices(screen, spec);
  if (!choices.length) {
    const declared = (screen.contract?.actions || []).map(action => action.operationId);
    const related = (spec.operations || []).filter(op => declared.includes(op.operationId) || (screen.requirementIds || screen.contract?.requirementIds || []).some(id => op.requirementIds?.includes(id)));
    const errors = related.length ? related.map(op => {
      const problems = screenOperationProblems(op, spec);
      if (!op.authorizedRoles?.length || !screen.roles?.length || !screen.roles.every(role => op.authorizedRoles.includes(role))) problems.push('Roles de pantalla y operación incompatibles o no declarados');
      return `${op.operationId}: ${problems.join('; ') || 'Contrato no disponible para esta pantalla'}`;
    }) : ['No hay operaciones vinculadas a los requisitos o acciones declaradas de esta pantalla'];
    return { valid: false, errors, providerMetadata: { ...metadata, reason: 'NO_EXECUTABLE_SCREEN_OPERATION' } };
  }
  if (!['openai', 'gemini'].includes(provider) || !env[provider.toUpperCase() + '_API_KEY']) return { valid: false, providerMetadata: metadata };
  try {
    const Provider = require(provider === 'openai' ? '../ai/OpenAIProvider' : '../ai/GeminiProvider');
    const model = env[provider.toUpperCase() + '_MODEL'];
    const result = await new Provider().extractDocumentBatch({
      screen: { ...screen, html: stripRolePreviewChrome(screen.html || '') },
      controls: Object.fromEntries(['input', 'select', 'textarea', 'button'].map(tag => [tag, [...stripRolePreviewChrome(screen.html || '').matchAll(new RegExp('<' + tag + '\\b[^>]*>(?:([^<]*))?', 'gi'))].map((match, index) => ({ index, html: match[0] }))])),
      operations: choices, requirements: spec.requirements, businessRules: spec.businessRules,
      confirmedProjectDecisions: spec.confirmedDecisions || {},
      entities: spec.entities, relationships: spec.relationships,
      validationFeedback: options.validationFeedback || [],
      output: { primaryOperationId: 'approved-operation-id', listOperationId: 'optional-approved-GET-operation-id', tableColumns: [{ index: 0, field: 'approvedDisplayField' }], controlBindings: { input: [{ index: 0, field: 'declaredInput' }], button: [{ index: 0, actionId: 'confirmar' }] }, ambiguities: [] }
    }, { model, prompt: 'Conecta los controles del HTML existente a UNA operación respaldada por los requisitos y roles de esta pantalla. Conserva el diseño íntegro: no devuelvas HTML ni CSS. Devuelve exactamente un objeto JSON con las claves primaryOperationId, controlBindings y ambiguities como en output. Copia índices EXACTOS del catálogo controls de cada etiqueta (input,select,textarea,button), contando desde cero para cada etiqueta, nunca un índice global. actionId es el existente de la operación o confirmar. Campos solo de bodySchema. No conectes cancelar, eliminar, navegación ni buscar al envío. No supongas reglas ni roles: documenta ambiguities. Cada campo requerido y botón principal debe quedar conectado.' });
    metadata = { mode: 'AI', provider, model: result.model || model, outcome: 'SUCCEEDED', usage: { totalTokens: result.usage?.total_tokens || result.usage?.totalTokenCount || 0 } };
    const compiled = compileScreenProposal(screen, result.data, spec);
    if (compiled.errors.length) {
      const entry = store.saveBindingProposal(projectId, screen.id, { screenId: screen.id, unresolved: compiled.errors, candidate: result.data }, store.bindingDependencies(screen, { ...dependencySpec, rules: dependencySpec.businessRules, roles: dependencySpec.security?.roles }), metadata);
      return { valid: false, proposalId: entry.id, errors: compiled.errors, ambiguities: result.data?.ambiguities, providerMetadata: metadata };
    }
    const proposal = { screenId: screen.id, screenRoute: screen.route, controlBindings: compiled.contract.controlBindings, screenContract: compiled.contract, unresolved: [] };
    const catalog = { ...dependencySpec, rules: dependencySpec.businessRules, roles: dependencySpec.security?.roles };
    const entry = store.saveBindingProposal(projectId, screen.id, proposal, store.bindingDependencies(screen, catalog), metadata);
    return { valid: true, proposalId: entry.id, providerMetadata: metadata };
  } catch (error) { return { valid: false, providerMetadata: { ...metadata, outcome: 'FAILED', reason: 'PROVIDER_ERROR', errorMessage: String(error.message || 'Proveedor no disponible').replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]').slice(0, 500) } }; }
}
module.exports = { planScreen, compileScreenProposal, screenChoices, screenOperationProblems };
