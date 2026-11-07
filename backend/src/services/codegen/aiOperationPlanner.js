/**
 * AI Business Operation Planner
 * Analyzes incomplete use cases and requirements against approved entities and business rules
 * to synthesize valid, structured, executable steps conforming to icase.operation.contract.v1.
 */

const env = require('../../config/env');
const {
  OPERATION_CONTRACT_VERSION,
  SUPPORTED_STEP_ACTIONS,
  validateOperationContract
} = require('./contractSchema');
const { saveOperationProposal } = require('./aiProposalStore');

function acceptanceExample(operation, catalog) {
  const example = JSON.parse(JSON.stringify(require('./contractAcceptanceRunner').scenarioSchema));
  const entity = (catalog.entities || []).find(entity => [entity.id, entity.name, entity.modelName].includes(operation.targetEntity));
  const field = Object.keys(operation.input?.bodySchema?.properties || {})[0] || entity?.attributes?.find(a => !a.isPk && !/Id$/.test(a.fieldName))?.fieldName;
  const definition = operation.input?.bodySchema?.properties?.[field] || {};
  const sample = definition.enum?.[0] ?? (['integer', 'number'].includes(definition.type) ? definition.minimum ?? 1 : definition.type === 'boolean' ? true : 'Ejemplo API');
  const screen = (catalog.screens || []).find(screen => screen.contract?.actions?.some(action => action.operationId === operation.operationId)) || (catalog.screens || []).find(screen => screen.requirementIds?.some(id => operation.requirementIds?.includes(id)));
  example.requirementIds = operation.requirementIds || [];
  example.users[0].role = operation.authorizedRoles?.[0] || '';
  example.requests[0] = { id: 'created', operationId: operation.operationId, as: 'actorA', body: { [field || 'DECLARED_FIELD']: sample }, status: operation.output?.successStatus || 200, equals: [{ path: 'data.data.' + field, value: sample }] };
  example.persistence[0] = { entity: entity?.modelName, where: { [entity?.primaryKey?.fieldName || 'id']: { $ref: 'responses.created.data.data.' + (entity?.primaryKey?.fieldName || 'id') } }, count: 1, fields: { [field || 'DECLARED_FIELD']: sample } };
  example.browser = screen ? [{ as: 'actorA', screenId: screen.id, steps: [{ action: 'fill', field, value: 'Ejemplo navegador' }, { action: 'click', actionId: screen.contract?.primaryActionId || 'confirmar' }, { action: 'text', value: 'Ejemplo navegador' }, { action: 'reload' }, { action: 'text', value: 'Ejemplo navegador' }] }] : [];
  return example;
}

/**
 * System prompt instructing the AI planner with strict boundaries
 */
const SYSTEM_PROMPT = `Eres el Planificador de Operaciones de Negocio de ICASE Studio.
Tu tarea es convertir casos de uso y requerimientos aprobados en pasos ejecutables estructurados para un backend Express + Sequelize + PostgreSQL.

REGLAS ESTRICTAS:
1. NUNCA inventes entidades, campos, reglas de negocio ni roles que no existan en el catálogo proporcionado.
2. Usa bindingVersion=2 y transaction=true. Acciones implementadas: CREATE, UPDATE, QUERY, ASSERT, CALCULATION, FOR_EACH y RETURN. DELETE y STATUS_CHANGE dedicadas no están implementadas; los estados se cambian con UPDATE solo cuando su transición y campo están aprobados. Una asociación solo puede usar CREATE sobre una tabla intermedia explícita si están aprobados el modelo y sus claves foráneas; nunca deduzcas escrituras desde una relación o narrativa ambigua.
3. Referencia exactamente los nombres de modelo ('modelName') y atributos ('fieldName') de las entidades aprobadas.
4. Si falta información o algún paso narrativo es ambiguo, documéntalo en el arreglo 'ambiguities' con una recomendación.
5. Explica tus decisiones en 'rationale'.
6. La salida debe ser estrictamente un objeto JSON con el esquema solicitado.
7. Usa bodySchema cerrado (additionalProperties=false), tipos, required y restricciones. Conserva recordAccess, businessRules, preconditions y acceptanceCriteria existentes; nunca reduzcas permisos por registro ni cambies roles.
8. Los filtros y fields usan referencias {$ref:'payload.campo'}, {$ref:'user.id'}, {$ref:'steps.paso.0.id'} o valores JSON. QUERY devuelve un array; admite filters:[{field:'fecha',operator:'gte',value:{$ref:'steps.desde'}}] (eq,gte,gt,lte,lt). UPDATE exige where explícito. RETURN usa value con un objeto de referencias para combinar resultados y su id puede ser resultStep. Cada paso tiene id. No escribas JavaScript, SQL, expresiones ni fórmulas.
9. No conviertas alternativas de un caso de uso (crear, editar, eliminar) en una secuencia de escrituras. Devuelve la ambigüedad cuando se requieran comandos separados.
10. Genera acceptanceScenarios declarativos para probar el comportamiento: id, requirementIds, users [{id,role}], fixtures [{id,entity,fields}], requests [{id,operationId,as,body,status,equals:[{path,value}]}], persistence [{entity,where,count,fields}], browser [{as,screenId,steps:[{action:'fill',field,value}|{action:'click',actionId}|{action:'reload'}|{action:'text',value}]}]. Referencias de pruebas: {$ref:'users.id.id'}, {$ref:'fixtures.id.id'}, {$ref:'responses.id.data.data.id'}. Incluye éxito, validación y rechazo de otro usuario cuando corresponde. No inventes una regla para obtener un resultado exitoso.
11. Orden de ejecución de CADA escenario: crea usuarios, fixtures, ejecuta TODOS los requests, después TODOS los pasos browser, y AL FINAL comprueba persistence en otra conexión. Los requests y el navegador hacen escrituras independientes: utiliza valores distintos (ejemplo API y Navegador) y filtra por el id de la respuesta API para comprobar count=1; no esperes count=1 por título si has creado dos filas con ese mismo título. El navegador debe comprobar los datos DESPUÉS de reload.
12. El runtime ya valida bodySchema ANTES de ejecutar steps. No crees pasos de escritura para validar entradas ni para devolver resultados. Una creación de un libro necesita UN único CREATE con TODOS los campos obligatorios sin default ni autoincremento; un campo automático de propietario puede tomar {$ref:'user.id'}. No crees primero una fila parcial para validar y después otra fila completa.
13. CALCULATION usa {id,action:'CALCULATION',expression:{$op:'multiply',args:[{$ref:'payload.cantidad'},{$ref:'steps.precio.0.valor'}],scale:2}}. Operadores: add,subtract,multiply,divide,sum,choose,date_add_days,date_diff_days,all,count,group_count,date_start. sum usa items,field,scale; count usa items; group_count usa items,field y devuelve [{campo:valor,count:n}]; date_start usa date (YYYY-MM-DD),timeZone (IANA explícita) y devuelve el instante UTC de medianoche local. choose usa condition,then,else. La precisión y fórmulas deben proceder de decisiones aprobadas, nunca de JavaScript o SQL.
14. FOR_EACH usa {id,action:'FOR_EACH',collection:{$ref:'payload.items'},steps:[...],result:{campo:{$ref:'steps.interno.id'}}}. item es el elemento actual; steps internos conservan acceso a los pasos anteriores del padre. ASSERT usa condition:{operator,left,right}, errorCode y errorMessage. Predicados: eq,neq,gt,gte,lt,lte,in,not_in,not_empty,is_empty,and,or (and/or usan conditions).
15. QUERY permite comparar columnas de la misma entidad: filters:[{field:'stock',operator:'lte',valueField:'stockMinimo'}]. valueField y value son alternativas excluyentes. Ambos campos deben existir en el modelo. Una alerta de bajo stock definida como consulta NO crea ALERTA ni NOTIFICACION.
16. Cada paso admite when con un predicado declarativo. Dentro de FOR_EACH, un CREATE con when:{operator:'or',conditions:[...]} se omite si ningún umbral aplica y el bucle continúa sin escribir. No uses ASSERT para saltar elementos, porque aborta la operación. Referencia el reloj del servidor con {$ref:'now'}; no declares estas capacidades existentes como preguntas de negocio.
15. confirmedGenerationDecisions y confirmedProjectDecisions contienen decisiones del usuario ya guardadas. Usa ambas para completar el contrato; pregunta solo lo que siga faltando. Una decisión detallada posterior que sustituye explícitamente una opción anterior es la vigente; no vuelvas a preguntar por esa opción anterior. No deduzcas una sustitución entre reglas diferentes ni amplíes permisos. Las limitaciones del binding y los fallos de validación son problemas técnicos: intenta corregirlos con las capacidades implementadas y el validationFeedback, sin presentarlos como decisiones del usuario.`;

/**
 * Builds deterministic proposal based on semantic analysis when offline or as robust baseline
 */
function synthesizeSemanticSteps(operation, catalog) {
  const { executionProblems } = require('./executableContract');
  const problems = executionProblems(operation, catalog.entities || []);
  return {
    ...operation,
    contractVersion: OPERATION_CONTRACT_VERSION,
    steps: problems.length ? [] : (operation.steps || []),
    authorizedRoles: operation.authorizedRoles || [],
    unresolved: problems,
    ambiguities: problems,
    rationale: 'Etapa determinista: conserva contratos expl?citos; no deduce escrituras, estados ni c?lculos desde narrativa o relaciones.'
  };
}

/**
 * Plans and proposes structured executable steps for an operation using AI with deterministic fallback
 * @param {string} projectId - Project identifier
 * @param {Object} operation - Incomplete operation object
 * @param {Object} catalog - Validated catalog { entities, rules, roles, reusableOperations, requirements }
 * @param {Object} [options] - Options (providerOverride, modelOverride)
 * @returns {Promise<Object>} Proposal result with validation status
 */
async function planOperationSteps(projectId, operation, catalog, options = {}) {
  require('./codegenAiHold').assertAllowed(projectId);
  const dependencies = require('./aiProposalStore').operationDependencies(operation, catalog);

  let proposal = null;
  let providerMetadata = { mode: 'DETERMINISTIC', provider: null, model: null, outcome: 'SKIPPED', reason: 'NOT_REQUESTED', tokensUsed: 0 };
  const provider = options.skipLiveAi ? 'mock' : (options.providerOverride || env.AI_PROVIDER || 'mock').toLowerCase();

  const userPrompt = {
    task: 'Proponer pasos estructurados ejecutables para la operación.',
    operation: {
      operationId: operation.operationId,
      name: operation.name,
      narrativeDescription: operation.narrativeDescription || '',
      narrativeSteps: operation.narrativeSteps || [],
      approvedContract: operation
    },
    relatedRequirements: (catalog.requirements || []).filter(r => (operation.requirementIds || []).includes(r.id)),
    approvedEntities: (catalog.entities || []).map(e => ({
      modelName: e.modelName,
      tableName: e.tableName,
      attributes: e.attributes || []
    })),
    approvedBusinessRules: (catalog.rules || []).map(r => ({
      ...r,
      code: r.code || r.id,
      name: r.name,
      description: r.description,
      field: r.field,
      operator: r.operator,
      value: r.value
    })),
    approvedRoles: operation.authorizedRoles || [],
    approvedRelationships: catalog.relationships || [],
    input: operation.input,
    preconditions: operation.preconditions || [],
    acceptanceCriteria: operation.acceptanceCriteria || [],
    validationFeedback: options.validationFeedback || [],
    confirmedGenerationDecisions: operation.generationDecisions || [],
    confirmedProjectDecisions: catalog.confirmedDecisions || require('./codegenDecision.service').getProjectDecisions(projectId),
    lockedAcceptanceScenarios: options.lockedScenarios,
    repairPolicy: 'Al reparar, devuelve lockedAcceptanceScenarios sin cambios. Corrige la implementación; no cambies expectativas de pruebas para simular que funciona.',
    acceptanceScenarioExample: acceptanceExample(operation, catalog),
    responseContract: { note: 'La respuesta HTTP es {success:true,data:{success:true,data:resultado}}. No cambia según la entidad. Use status=operation.approvedContract.output.successStatus o 200. QUERY devuelve array, CREATE objeto. Los escenarios son objetos completos con requests y persistence; no use nombres alternativos de claves. Use modelos exactos del catálogo y referencias de pruebas a responses, users o fixtures, nunca payload ni steps.', successStatus: operation.output?.successStatus || 200 },
    runtimeValidationHttp: { missingRequired: 400, unknownProperty: 400, incorrectType: 400, minimum: 422, maximum: 422, explanation: 'Convenciones ya implementadas por validateInput. No requieren otra decisión de negocio. Los ASSERT pueden declarar errorStatus explícito cuando exista una política aprobada.' },
    screens: (catalog.screens || []).map(({ id, route, requirementIds, roles, contract }) => ({ id, route, requirementIds, roles, contract })),
    expectedOutputSchema: {
      bindingVersion: 2,
      input: { bodySchema: { type: 'object', additionalProperties: false, properties: {} } },
      resultStep: 'step_1',
      contractVersion: OPERATION_CONTRACT_VERSION,
      operationId: operation.operationId,
      targetEntity: 'NombreModelo',
      action: 'CREATE|UPDATE|QUERY',
      transaction: true,
      steps: [
        {
          id: 'step_1', step: 1,
          action: 'CREATE|UPDATE|QUERY',
          entity: 'NombreModelo',
          description: 'Explicación del paso',
          statusField: 'estado (opcional)',
          newStatus: 'VALOR (opcional)',
          withEntity: 'NombreModeloAsociado (opcional)',
          targetField: 'campo (opcional)',
          fields: { campo: { $ref: 'payload.campo' } },
          where: { id: { $ref: 'payload.id' } }
        }
      ],
      authorizedRoles: ['Rol1'],
      rationale: 'Explicación técnica de la decisión',
      ambiguities: [],
      unresolved: [],
      acceptanceScenarios: []
    }
  };

  if (provider !== 'mock') providerMetadata = { mode: 'AI', provider, model: options.modelOverride || env[provider.toUpperCase() + '_MODEL'] || null, outcome: 'SKIPPED', reason: 'PROVIDER_UNAVAILABLE', tokensUsed: 0 };
  // If live AI provider is configured and available (OpenAI or Gemini)
  if (provider === 'openai' && env.OPENAI_API_KEY) {
    try {
      const OpenAIProvider = require('../ai/OpenAIProvider');
      const openai = new OpenAIProvider();
      const result = await openai.extractDocumentBatch(userPrompt, {
        prompt: SYSTEM_PROMPT,
        model: options.modelOverride || env.OPENAI_MODEL || 'gpt-4o-mini'
      });

      providerMetadata = { ...providerMetadata, outcome: 'INVALID_RESPONSE', reason: 'INVALID_OUTPUT', model: result?.model || providerMetadata.model, usage: { totalTokens: result?.usage?.total_tokens || result?.usage?.totalTokenCount || 0 } };
      if (result?.data && Array.isArray(result.data.steps)) {
        providerMetadata = {
          mode: 'AI', outcome: 'SUCCEEDED', provider: 'openai',
          model: result.model,
          usage: {
            promptTokens: result.usage?.prompt_tokens || 0,
            completionTokens: result.usage?.completion_tokens || 0,
            totalTokens: result.usage?.total_tokens || 0
          }
        };
        proposal = {
          ...result.data,
          contractVersion: OPERATION_CONTRACT_VERSION,
          operationId: operation.operationId,
          name: operation.name,
          route: operation.route || result.data.route || `/api/operations/${(operation.operationId || 'op').toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          method: (operation.method || result.data.method || 'POST').toUpperCase()
        };
      }
    } catch (aiErr) {
      providerMetadata = { ...providerMetadata, outcome: 'FAILED', reason: 'PROVIDER_ERROR', errorMessage: String(aiErr.message || 'Proveedor no disponible').replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]').slice(0, 500), usage: { totalTokens: aiErr.usage?.total_tokens || aiErr.usage?.totalTokenCount || 0 } };
    }
  } else if (provider === 'gemini' && env.GEMINI_API_KEY) {
    try {
      const GeminiProvider = require('../ai/GeminiProvider');
      const gemini = new GeminiProvider();
      const result = await gemini.extractDocumentBatch(userPrompt, {
        prompt: SYSTEM_PROMPT,
        model: options.modelOverride || env.GEMINI_MODEL
      });

      providerMetadata = { ...providerMetadata, outcome: 'INVALID_RESPONSE', reason: 'INVALID_OUTPUT', model: result?.model || providerMetadata.model, usage: { totalTokens: result?.usage?.total_tokens || result?.usage?.totalTokenCount || 0 } };
      if (result?.data && Array.isArray(result.data.steps)) {
        providerMetadata = {
          mode: 'AI', outcome: 'SUCCEEDED', provider: 'gemini',
          model: result.model,
          usage: {
            promptTokens: result.usage?.promptTokenCount || 0,
            completionTokens: result.usage?.candidatesTokenCount || 0,
            totalTokens: result.usage?.totalTokenCount || 0
          }
        };
        proposal = {
          ...result.data,
          contractVersion: OPERATION_CONTRACT_VERSION,
          operationId: operation.operationId,
          name: operation.name,
          route: operation.route || result.data.route || `/api/operations/${(operation.operationId || 'op').toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          method: (operation.method || result.data.method || 'POST').toUpperCase()
        };
      }
    } catch (aiErr) {
      providerMetadata = { ...providerMetadata, outcome: 'FAILED', reason: 'PROVIDER_ERROR', usage: { totalTokens: aiErr.usage?.total_tokens || aiErr.usage?.totalTokenCount || 0 } };
    }
  }

  // Fallback to deterministic semantic synthesis if AI was unavailable or skipped
  if (!proposal) {
    proposal = synthesizeSemanticSteps(operation, catalog);
  }

  // Validate proposal against contract schema
  const validation = validateOperationContract(proposal, catalog);
  const problems = require('./executableContract').executionProblems(proposal, catalog.entities || []);
  validation.errors.push(...problems);
  validation.valid = validation.errors.length === 0;

  // Store proposal in review store
  const stored = saveOperationProposal(projectId, operation.operationId, proposal, dependencies, { ...providerMetadata, validation: validation.valid ? 'PASSED' : 'REJECTED' });

  return {
    proposalId: stored.id,
    operationId: operation.operationId,
    status: stored.status,
    valid: validation.valid,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
    proposal,
    providerMetadata,
    applied: false,
    applicationReason: validation.valid ? 'PENDING_REVIEW' : 'INVALID_CONTRACT',
    dependencyHash: stored.dependencyHash
  };
}

module.exports = {
  planOperationSteps,
  synthesizeSemanticSteps
};
