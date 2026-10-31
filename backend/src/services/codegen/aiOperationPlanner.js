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

/**
 * System prompt instructing the AI planner with strict boundaries
 */
const SYSTEM_PROMPT = `Eres el Planificador de Operaciones de Negocio de ICASE Studio.
Tu tarea es convertir casos de uso y requerimientos aprobados en pasos ejecutables estructurados para un backend Express + Sequelize + PostgreSQL.

REGLAS ESTRICTAS:
1. NUNCA inventes entidades, campos, reglas de negocio ni roles que no existan en el catálogo proporcionado.
2. Utiliza exclusivamente las acciones estructuradas soportadas: CREATE, UPDATE, DELETE, STATUS_CHANGE, ASSOCIATE, QUERY, CALCULATION, VALIDATION.
3. Referencia exactamente los nombres de modelo ('modelName') y atributos ('fieldName') de las entidades aprobadas.
4. Si falta información o algún paso narrativo es ambiguo, documéntalo en el arreglo 'ambiguities' con una recomendación.
5. Explica tus decisiones en 'rationale'.
6. La salida debe ser estrictamente un objeto JSON con el esquema solicitado.`;

/**
 * Builds deterministic proposal based on semantic analysis when offline or as robust baseline
 */
function synthesizeSemanticSteps(operation, catalog) {
  const entities = catalog.entities || [];
  const rules = catalog.rules || [];
  const roles = catalog.roles || [];
  const narrativeSteps = operation.narrativeSteps || [];
  const ambiguities = [];
  const executableSteps = [];

  const normalize = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const opNameNorm = normalize(operation.name);
  const opDescNorm = normalize(operation.narrativeDescription || '');

  // 1. Identify primary entity: prioritize operation name match first, then narrative description
  let primaryEntity = entities.find(e => {
    const eNorm = normalize(e.modelName || e.name);
    return eNorm && opNameNorm.includes(eNorm);
  });

  if (!primaryEntity) {
    primaryEntity = entities.find(e => {
      const eNorm = normalize(e.modelName || e.name);
      return eNorm && opDescNorm.includes(eNorm);
    });
  }

  if (!primaryEntity && entities.length > 0) {
    // Match significant words
    const words = (operation.name || '').toLowerCase().split(/[\s_]+/).filter(w => w.length >= 4);
    primaryEntity = entities.find(e => {
      const eNorm = normalize(e.modelName || e.name);
      return words.some(w => eNorm.includes(normalize(w)));
    });
  }

  if (!primaryEntity && operation.targetEntity) {
    primaryEntity = entities.find(e => (e.modelName || e.name) === operation.targetEntity);
  }

  if (!primaryEntity && entities.length > 0) {
    primaryEntity = entities[0];
    ambiguities.push(`No se pudo inferir con certeza la entidad principal. Se seleccionó '${primaryEntity.modelName}' como sugerencia.`);
  }

  // 2. Synthesize steps from narrative steps or operation purpose
  if (narrativeSteps.length > 0) {
    narrativeSteps.forEach((ns, idx) => {
      const text = typeof ns === 'string' ? ns : (ns.description || ns.name || '');
      const tNorm = normalize(text);

      // Detect action
      let action = 'CREATE';
      let stepEntity = primaryEntity ? primaryEntity.modelName : null;
      let statusField = null;
      let newStatus = null;
      let withEntity = null;
      let formula = null;
      let targetField = null;

      // Find matching entity mentioned in this step
      const matchedStepEntity = entities.find(e => tNorm.includes(normalize(e.modelName || e.name)));
      if (matchedStepEntity) {
        stepEntity = matchedStepEntity.modelName;
      }

      if (tNorm.includes('estado') || tNorm.includes('status') || tNorm.includes('aprobar') || tNorm.includes('cancelar') || tNorm.includes('completar') || tNorm.includes('cerrar')) {
        action = 'STATUS_CHANGE';
        statusField = 'estado';
        if (tNorm.includes('aprobar')) newStatus = 'APROBADO';
        else if (tNorm.includes('cancelar')) newStatus = 'CANCELADO';
        else if (tNorm.includes('completar') || tNorm.includes('cerrar')) newStatus = 'COMPLETADO';
        else newStatus = 'EN_PROCESO';
      } else if (tNorm.includes('eliminar') || tNorm.includes('borrar') || tNorm.includes('desactivar')) {
        action = 'DELETE';
      } else if (tNorm.includes('actualizar') || tNorm.includes('modificar') || tNorm.includes('editar')) {
        action = 'UPDATE';
      } else if (tNorm.includes('asociar') || tNorm.includes('vincular') || tNorm.includes('asignar')) {
        action = 'ASSOCIATE';
        const otherEntity = entities.find(e => e.modelName !== stepEntity && tNorm.includes(normalize(e.modelName || e.name)));
        withEntity = otherEntity ? otherEntity.modelName : null;
        if (!withEntity) {
          ambiguities.push(`Paso ${idx + 1}: Se indicó asociación pero no se identificó la entidad destino en el texto.`);
        }
      } else if (tNorm.includes('calcular') || tNorm.includes('total') || tNorm.includes('subtotal') || tNorm.includes('iva') || tNorm.includes('descuento')) {
        action = 'CALCULATION';
        targetField = 'total';
        formula = 'payload.subtotal || payload.monto || 0';
      } else if (tNorm.includes('consultar') || tNorm.includes('buscar') || tNorm.includes('verificar disponibilidad')) {
        action = 'QUERY';
      } else if (tNorm.includes('validar') || tNorm.includes('comprobar')) {
        action = 'VALIDATION';
      } else {
        action = 'CREATE';
      }

      const step = {
        step: idx + 1,
        action,
        entity: stepEntity,
        description: text
      };

      if (action === 'STATUS_CHANGE') {
        step.statusField = statusField || 'estado';
        step.newStatus = newStatus || 'ACTIVO';
      }
      if (action === 'ASSOCIATE' && withEntity) {
        step.withEntity = withEntity;
      }
      if (action === 'CALCULATION') {
        step.targetField = targetField;
        step.formula = formula;
      }

      executableSteps.push(step);
    });
  } else if (primaryEntity) {
    // Generate standard business action based on operation method and name
    const isDelete = opNameNorm.includes('eliminar') || opNameNorm.includes('borrar');
    const isUpdate = opNameNorm.includes('actualizar') || opNameNorm.includes('modificar');
    const isStatus = opNameNorm.includes('cambiar estado') || opNameNorm.includes('aprobar') || opNameNorm.includes('cancelar');

    if (isStatus) {
      executableSteps.push({
        step: 1,
        action: 'STATUS_CHANGE',
        entity: primaryEntity.modelName,
        statusField: 'estado',
        newStatus: opNameNorm.includes('aprobar') ? 'APROBADO' : opNameNorm.includes('cancelar') ? 'CANCELADO' : 'ACTIVO',
        description: `Cambiar estado de ${primaryEntity.modelName}`
      });
    } else if (isDelete) {
      executableSteps.push({
        step: 1,
        action: 'DELETE',
        entity: primaryEntity.modelName,
        description: `Eliminar registro de ${primaryEntity.modelName}`
      });
    } else if (isUpdate) {
      executableSteps.push({
        step: 1,
        action: 'UPDATE',
        entity: primaryEntity.modelName,
        description: `Actualizar datos de ${primaryEntity.modelName}`
      });
    } else {
      executableSteps.push({
        step: 1,
        action: 'CREATE',
        entity: primaryEntity.modelName,
        description: `Crear nuevo registro de ${primaryEntity.modelName}`
      });
    }
  }

  // 3. Resolve authorized roles
  const authorizedRoles = (operation.authorizedRoles && operation.authorizedRoles.length > 0)
    ? operation.authorizedRoles
    : (roles.length > 0 ? roles : ['Usuario']);

  return {
    contractVersion: OPERATION_CONTRACT_VERSION,
    operationId: operation.operationId,
    name: operation.name,
    route: operation.route || `/api/operations/${(operation.operationId || 'op').toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    method: (operation.method || 'POST').toUpperCase(),
    targetEntity: primaryEntity ? primaryEntity.modelName : null,
    action: executableSteps[0]?.action || 'CREATE',
    transaction: executableSteps.length > 1,
    steps: executableSteps,
    authorizedRoles,
    rationale: `Propuesta generada determinísticamente analizando la intención de '${operation.name}' frente al catálogo de entidades y atributos aprobados.`,
    ambiguities
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
  const dependencies = {
    operationId: operation.operationId,
    name: operation.name,
    narrativeSteps: operation.narrativeSteps || [],
    entities: (catalog.entities || []).map(e => ({ name: e.modelName, attrs: (e.attributes || []).map(a => a.fieldName) })),
    rules: (catalog.rules || []).map(r => r.code || r.id),
    roles: catalog.roles || []
  };

  let proposal = null;
  const provider = (options.providerOverride || env.AI_PROVIDER || 'mock').toLowerCase();

  // If live AI provider is configured and available (e.g. Gemini)
  if (provider === 'gemini' && env.GEMINI_API_KEY) {
    try {
      const GeminiProvider = require('../ai/GeminiProvider');
      const gemini = new GeminiProvider();

      const userPrompt = {
        task: 'Proponer pasos estructurados ejecutables para la operación.',
        operation: {
          operationId: operation.operationId,
          name: operation.name,
          narrativeDescription: operation.narrativeDescription || '',
          narrativeSteps: operation.narrativeSteps || []
        },
        relatedRequirements: (catalog.requirements || []).filter(r => (operation.requirementIds || []).includes(r.id)),
        approvedEntities: (catalog.entities || []).map(e => ({
          modelName: e.modelName,
          tableName: e.tableName,
          attributes: (e.attributes || []).map(a => ({ fieldName: a.fieldName, type: a.type, isPk: !!a.isPk }))
        })),
        approvedBusinessRules: (catalog.rules || []).map(r => ({
          code: r.code || r.id,
          name: r.name,
          description: r.description,
          field: r.field,
          operator: r.operator,
          value: r.value
        })),
        approvedRoles: catalog.roles || [],
        expectedOutputSchema: {
          contractVersion: OPERATION_CONTRACT_VERSION,
          operationId: operation.operationId,
          targetEntity: 'NombreModelo',
          action: 'CREATE|UPDATE|DELETE|STATUS_CHANGE|ASSOCIATE|QUERY|CALCULATION|VALIDATION',
          transaction: true,
          steps: [
            {
              step: 1,
              action: 'CREATE|UPDATE|DELETE|STATUS_CHANGE|ASSOCIATE|QUERY|CALCULATION|VALIDATION',
              entity: 'NombreModelo',
              description: 'Explicación del paso',
              statusField: 'estado (opcional)',
              newStatus: 'VALOR (opcional)',
              withEntity: 'NombreModeloAsociado (opcional)',
              targetField: 'campo (opcional)',
              formula: 'formula (opcional)'
            }
          ],
          authorizedRoles: ['Rol1'],
          rationale: 'Explicación técnica de la decisión',
          ambiguities: ['Lista de dudas o datos faltantes si aplica']
        }
      };

      const result = await gemini.extractDocumentBatch(userPrompt, {
        prompt: SYSTEM_PROMPT,
        model: options.modelOverride || env.GEMINI_MODEL
      });

      if (result?.data && Array.isArray(result.data.steps) && result.data.steps.length > 0) {
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
      console.warn(`[AIOperationPlanner] Falló llamada a proveedor '${provider}' (${aiErr.message}). Utilizando sintetizador semántico determinista.`);
    }
  }

  // Fallback to deterministic semantic synthesis if AI was unavailable or skipped
  if (!proposal) {
    proposal = synthesizeSemanticSteps(operation, catalog);
  }

  // Validate proposal against contract schema
  const validation = validateOperationContract(proposal, catalog);

  // Store proposal in review store
  const stored = saveOperationProposal(projectId, operation.operationId, proposal, dependencies);

  return {
    proposalId: stored.id,
    operationId: operation.operationId,
    status: stored.status,
    valid: validation.valid,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
    proposal,
    dependencyHash: stored.dependencyHash
  };
}

module.exports = {
  planOperationSteps,
  synthesizeSemanticSteps
};
