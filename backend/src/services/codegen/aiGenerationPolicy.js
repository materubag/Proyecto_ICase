// Technical validation is not approval of new business rules. Never use a model
// response to expand permissions or to replace an existing executable contract.
const { validateOperationContract } = require('./contractSchema');
const { executionProblems } = require('./executableContract');
const equal = (a, b) => require('./aiProposalStore').computeDependencyHash(a) === require('./aiProposalStore').computeDependencyHash(b);

function validateGeneratedOperation(source, proposal, catalog) {
  const errors = [];
  if (!proposal || typeof proposal !== 'object') return ['EMPTY_AI_CONTRACT'];
  const candidate = { ...source, ...proposal, operationId: source.operationId, route: source.route, method: source.method };
  errors.push(...validateOperationContract(candidate, catalog).errors, ...executionProblems(candidate, catalog.entities));
  if (candidate.bindingVersion !== 2) errors.push('AI_REQUIRES_REFERENCE_CONTRACT');
  if (candidate.transaction !== true) errors.push('AI_REQUIRES_TRANSACTION');
  if ((proposal.ambiguities || []).length || (proposal.unresolved || []).length) errors.push('UNRESOLVED_AI_BUSINESS_QUESTIONS');
  const roles = source.authorizedRoles || [];
  if (!roles.length || !proposal.authorizedRoles?.length || proposal.authorizedRoles.some(r => !roles.includes(r)) || roles.some(r => !proposal.authorizedRoles.includes(r))) errors.push('AI_PERMISSION_CHANGE');
  if (source.targetEntity && proposal.targetEntity && source.targetEntity !== proposal.targetEntity) errors.push('AI_CHANGED_TARGET_ENTITY');
  if (source.action && proposal.action && source.action !== proposal.action) errors.push('AI_CHANGED_APPROVED_ACTION');
  for (const key of ['recordAccess', 'businessRules', 'preconditions', 'acceptanceCriteria']) {
    if (source[key]?.length && !equal(source[key], proposal[key] ?? source[key])) errors.push('AI_CHANGED_APPROVED_' + key);
  }
  const schema = candidate.input?.bodySchema;
  if (schema?.type !== 'object' || schema.additionalProperties !== false) errors.push('AI_REQUIRES_CLOSED_INPUT_SCHEMA');
  const previous = source.input?.bodySchema;
  if ((previous?.required || []).some(field => !schema?.required?.includes(field))) errors.push('AI_REMOVED_REQUIRED_INPUT');
  if (previous?.additionalProperties === false && Object.keys(previous.properties || {}).length && Object.keys(schema?.properties || {}).some(field => !Object.hasOwn(previous.properties, field))) errors.push('AI_ADDED_UNAPPROVED_INPUT');
  for (const [name, definition] of Object.entries(previous?.properties || {})) {
    if (!equal(definition, schema?.properties?.[name])) errors.push('AI_CHANGED_INPUT_CONSTRAINT: ' + name);
  }
  for (const step of candidate.steps || []) if (step.action === 'CREATE') {
    const entity = catalog.entities.find(entity => entity.modelName === step.entity);
    for (const attribute of entity?.attributes || []) {
      const reference = step.fields?.[attribute.fieldName]?.$ref;
      if (attribute.allowNull === false && attribute.defaultValue == null && reference?.startsWith('payload.') && !schema?.required?.includes(reference.split('.')[1])) errors.push('AI_MISSING_REQUIRED_INPUT: ' + reference.split('.')[1] + '; required debe ser un array en bodySchema');
    }
  }
  if (candidate.resultStep == null) errors.push('AI_REQUIRES_RESULT_STEP');
  if (!Array.isArray(proposal.acceptanceScenarios) || !proposal.acceptanceScenarios.length) errors.push('UNRESOLVED_ACCEPTANCE_SCENARIOS');
  for (const scenario of Array.isArray(proposal.acceptanceScenarios) ? proposal.acceptanceScenarios : []) errors.push(...require('./contractAcceptanceRunner').validateScenario(scenario, { entities: catalog.entities, operations: catalog.operations || [candidate], screens: catalog.screens, security: { roles: catalog.roles } }));
  return [...new Set(errors)];
}

module.exports = { validateGeneratedOperation };
