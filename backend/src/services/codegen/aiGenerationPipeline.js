const store = require('./aiProposalStore');
const { executionProblems } = require('./executableContract');
const { validateGeneratedOperation } = require('./aiGenerationPolicy');
const planner = require('./aiOperationPlanner');
const screens = require('./aiScreenPlanner');
const { questionFor, splitAmbiguities } = require('./generationClarifications');

function cachedQuestions(projectId, spec, catalog) {
  const proposals = store.getProposals(projectId);
  const questions = [];
  for (const operation of (spec.operations || []).filter(op => op.type === 'BUSINESS_LOGIC')) {
    const entry = proposals.operations[operation.operationId];
    if (!entry || ['FAILED', 'SKIPPED', 'INVALID_RESPONSE'].includes(entry.providerMetadata?.outcome) || ['REJECTED', 'APPROVED'].includes(entry.status) ||
        entry.dependencyHash !== store.computeDependencyHash(store.operationDependencies(operation, catalog))) continue;
    const question = questionFor(operation, entry.proposal?.ambiguities);
    if (question) questions.push(question);
  }
  for (const screen of spec.screens || []) {
    const entry = proposals.bindings[screen.id];
    if (!entry || ['REJECTED', 'APPROVED'].includes(entry.status) ||
        entry.dependencyHash !== store.computeDependencyHash(store.bindingDependencies(screen, catalog))) continue;
    const question = questionFor(screen, entry.proposal?.candidate?.ambiguities, 'SCREEN');
    if (question) questions.push(question);
  }
  return questions;
}

async function planGeneration(projectId, spec, options = {}) {
  const trace = options.onTrace || (() => {});
  const catalog = { entities: spec.entities, operations: spec.operations, requirements: spec.requirements, rules: spec.businessRules || [], relationships: spec.relationships, roles: spec.security?.roles || [], screens: spec.screens, confirmedDecisions: spec.confirmedDecisions };
  const pendingQuestions = options.enableAI ? cachedQuestions(projectId, spec, catalog) : [];
  if (pendingQuestions.length && !options.batchMode) return { tokensUsed: 0, questions: pendingQuestions };
  const questions = [...(options.seedQuestions || [])];
  const blockers = [];
  const addQuestion = question => { if (question && !questions.some(q => q.questionId === question.questionId)) questions.push(question); };
  const checkpoint = data => options.onCheckpoint?.({ ...data, questions: [...questions], blockers: [...blockers] });
  let tokens = 0;
  const budgetAvailable = () => !options.isCancelled?.() && tokens < (options.maxTokens ?? Infinity) && Date.now() < (options.deadline ?? Infinity);
  const operations = (spec.operations || []).filter(op => op.type === 'BUSINESS_LOGIC');
  for (const [index, operation] of operations.entries()) {
    if (options.isCancelled?.()) break;
    if (options.batchMode) checkpoint({ phase: 'OPERATIONS', completed: index, total: operations.length });
    const systemTested = operation.invocation === 'SYSTEM' && (spec.operations || []).some(op => op.acceptanceScenarios?.some(scenario => scenario.systemInvocations?.some(call => call.operationId === operation.operationId)));
    if (!executionProblems(operation, spec.entities).length && (operation.acceptanceScenarios?.length || systemTested)) continue;
    if (options.batchMode && !operation.authorizedRoles?.length && operation.invocation !== 'SYSTEM') {
      addQuestion(questionFor(operation, ['¿Qué roles aprobados pueden ejecutar este caso de uso? El contrato no tiene roles autorizados.']));
      continue;
    }
    const cachedQuestion = pendingQuestions.find(q => q.targetKind === 'OPERATION' && q.targetId === operation.operationId);
    if (options.batchMode && cachedQuestion) {
      const split = splitAmbiguities(cachedQuestion.details);
      if (split.business.length) { addQuestion(questionFor(operation, split.business)); continue; }
    }
    if (!options.enableAI || !budgetAvailable()) {
      trace({ stage: 'OPERATION_PLANNING', operationId: operation.operationId, outcome: 'SKIPPED', reason: options.enableAI ? 'GENERATION_BUDGET_OR_CANCELLED' : 'AI_NOT_REQUESTED', applied: false }); continue;
    }
    const cached = store.getProposals(projectId).operations[operation.operationId];
    const fresh = cached?.dependencyHash === store.computeDependencyHash(store.operationDependencies(operation, catalog));
    // Never silently retry a user rejection; allow retry of failed/local/stale proposals.
    const repairing = fresh && cached?.reviewedBy === 'CODEGEN_TECHNICAL_VALIDATION' && cached.status === 'APPROVED' && options.repairFeedback;
    if (fresh && (cached.status === 'REJECTED' || (cached.status === 'APPROVED' && cached.proposal?.acceptanceScenarios?.length)) && !repairing) {
      trace({ stage: 'OPERATION_PLANNING', operationId: operation.operationId, proposalId: cached.id, outcome: 'SKIPPED', reason: 'CACHED_' + cached.status, applied: false }); continue;
    }
    let feedback = options.repairFeedback || options.validationFeedback || [];
    const lockedScenarios = repairing && cached.proposal.acceptanceScenarios?.length ? cached.proposal.acceptanceScenarios : undefined;
    const validationSource = repairing ? { ...operation, input: cached.proposal.input, recordAccess: cached.proposal.recordAccess || operation.recordAccess } : operation;
    let unresolved = null;
    for (let attempt = 0; attempt < 3 && budgetAvailable(); attempt++) {
      options.onProgress?.(`Generando operación ${index + 1}/${operations.length}: ${operation.name || operation.operationId} (intento ${attempt + 1}/3)...`);
      let result;
      try { result = await planner.planOperationSteps(projectId, operation, catalog, { skipLiveAi: false, validationFeedback: feedback, lockedScenarios }); }
      catch (error) {
        if (!options.batchMode) throw error;
        result = { valid: false, proposal: {}, providerMetadata: { mode: 'AI', outcome: 'FAILED', reason: error.code || error.message || 'PLANNER_FAILED' } };
      }
      tokens += result.providerMetadata?.usage?.totalTokens || 0;
      const errors = validateGeneratedOperation(validationSource, result.proposal, catalog);
      if (lockedScenarios && store.computeDependencyHash(lockedScenarios) !== store.computeDependencyHash(result.proposal.acceptanceScenarios)) errors.push('AI_CHANGED_LOCKED_ACCEPTANCE_SCENARIOS');
      const accepted = result.valid && !errors.length && result.providerMetadata?.mode === 'AI' && result.providerMetadata.outcome === 'SUCCEEDED';
      if (accepted) store.reviewProposal(projectId, result.proposalId, { status: 'APPROVED', reviewer: 'CODEGEN_TECHNICAL_VALIDATION', notes: 'Contrato seleccionado para generación y pruebas; no acredita aprobación de negocio ni funcionamiento.' });
      trace({ stage: 'OPERATION_PLANNING', operationId: operation.operationId, ...result.providerMetadata, proposalId: result.proposalId, validation: accepted ? 'PASSED' : 'REJECTED', reason: errors.join('; ') || result.applicationReason, applied: false });
      if (options.batchMode && result.providerMetadata?.outcome !== 'SUCCEEDED') {
        unresolved = { operationId: operation.operationId, name: operation.name, errors: [result.providerMetadata?.reason || 'PROVIDER_FAILED', ...(result.providerMetadata?.errorMessage ? [result.providerMetadata.errorMessage] : [])] };
        break;
      }
      const split = options.batchMode ? splitAmbiguities(result.proposal?.ambiguities) : { business: result.proposal?.ambiguities || [], technical: [] };
      const question = !accepted && questionFor(operation, split.business);
      if (question) {
        if (!options.batchMode) return { tokensUsed: tokens, questions: [question] };
        addQuestion(question);
        if (split.technical.length) blockers.push({ operationId: operation.operationId, name: operation.name, errors: split.technical });
        unresolved = null;
        break;
      }
      unresolved = accepted ? null : { operationId: operation.operationId, name: operation.name,
        errors: errors.length ? errors : [result.providerMetadata?.reason || result.applicationReason || 'INVALID_CONTRACT'] };
      if (accepted || (!options.batchMode && result.proposal?.ambiguities?.length) || result.providerMetadata?.outcome !== 'SUCCEEDED') break;
      feedback = [...errors, ...(result.validationErrors || []), ...split.technical];
    }
    if (unresolved && !options.isCancelled?.()) {
      if (!options.batchMode) return { tokensUsed: tokens, blockers: [unresolved] };
      blockers.push(unresolved);
    }
  }
  if (options.batchMode) checkpoint({ phase: 'OPERATIONS', completed: operations.length, total: operations.length });
  const effective = store.applyApprovedProposals(projectId, spec).spec;
  for (const [index, screen] of (spec.screens || []).entries()) {
    if (options.isCancelled?.()) break;
    if (options.batchMode) checkpoint({ phase: 'SCREENS', completed: index, total: spec.screens.length });
    if (!options.enableAI || !budgetAvailable() || !screen.html || require('./screenContract').isAuthScreen(screen)) continue;
    const audit = require('./screenBindingAudit').auditScreenBindings(screen);
    if (!screen.contract?.unresolved?.length && !audit.missingFields.length && !audit.missingPrimaryAction && !audit.unboundControls) continue;
    const cached = store.getProposals(projectId).bindings[screen.id];
    const cachedQuestion = pendingQuestions.find(q => q.targetKind === 'SCREEN' && q.targetId === screen.id);
    if (options.batchMode && cachedQuestion) {
      const split = splitAmbiguities(cachedQuestion.details);
      if (split.business.length) { addQuestion(questionFor(screen, split.business, 'SCREEN')); continue; }
    }
    if (cached && ['REJECTED', 'APPROVED'].includes(cached.status) && (!options.repairFeedback || cached.reviewedBy !== 'CODEGEN_TECHNICAL_VALIDATION') && cached.dependencyHash === store.computeDependencyHash(store.bindingDependencies(screen, { ...spec, rules: spec.businessRules, roles: spec.security?.roles }))) continue;
    let feedback = options.repairFeedback || [];
    for (let attempt = 0; attempt < 2 && budgetAvailable(); attempt++) {
      options.onProgress?.(`Conectando pantalla ${index + 1}/${spec.screens.length}: ${screen.name || screen.id} (intento ${attempt + 1}/2)...`);
      let result;
      try { result = await screens.planScreen(projectId, screen, effective, spec, { validationFeedback: feedback }); }
      catch (error) {
        if (!options.batchMode) throw error;
        result = { valid: false, errors: [error.code || error.message || 'SCREEN_PLANNER_FAILED'], providerMetadata: { outcome: 'FAILED' } };
      }
      tokens += result.providerMetadata?.usage?.totalTokens || 0;
      if (result.valid) store.reviewProposal(projectId, result.proposalId, { status: 'APPROVED', reviewer: 'CODEGEN_TECHNICAL_VALIDATION', notes: 'Vinculación validada; conservar HTML original y ejecutar pruebas.' });
      trace({ stage: 'SCREEN_PLANNING', screenId: screen.id, ...result.providerMetadata, proposalId: result.proposalId, validation: result.valid ? 'PASSED' : 'REJECTED', reason: result.errors?.join('; '), applied: false });
      const split = options.batchMode ? splitAmbiguities(result.ambiguities) : { business: result.ambiguities || [], technical: [] };
      const question = !result.valid && questionFor(screen, split.business, 'SCREEN');
      if (question) {
        if (!options.batchMode) return { tokensUsed: tokens, questions: [question] };
        addQuestion(question);
        break;
      }
      if (result.valid) break;
      if (attempt === 1 || result.providerMetadata?.outcome !== 'SUCCEEDED') {
        if (options.batchMode) blockers.push({ operationId: screen.id, targetKind: 'SCREEN', name: screen.name, errors: [...(result.errors || []), ...split.technical, ...(result.providerMetadata?.reason ? [result.providerMetadata.reason] : []), ...(result.providerMetadata?.errorMessage ? [result.providerMetadata.errorMessage] : [])] });
        break;
      }
      if (!options.batchMode && result.errors?.includes('UNRESOLVED_SCREEN_QUESTIONS')) break;
      feedback = [...(result.errors || []), ...split.technical];
    }
  }
  if (options.batchMode) checkpoint({ phase: 'COMPLETE', completed: spec.screens?.length || 0, total: spec.screens?.length || 0 });
  return { tokensUsed: tokens, ...(questions.length ? { questions } : {}), ...(blockers.length ? { blockers } : {}) };
}
module.exports = { planGeneration, collectCachedQuestions: (projectId, spec) => cachedQuestions(projectId, spec, {
  entities: spec.entities, operations: spec.operations, requirements: spec.requirements, rules: spec.businessRules || [],
  relationships: spec.relationships, roles: spec.security?.roles || [], screens: spec.screens
}) };
