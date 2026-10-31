/**
 * Executable Contract Schema for ICASE Code Generator
 * Versioned schemas for business operations and Stitch mockup UI bindings.
 * Separates narrative requirements from structured, verifiable instructions.
 */

const OPERATION_CONTRACT_VERSION = 'icase.operation.contract.v1';
const BINDING_CONTRACT_VERSION = 'icase.binding.contract.v1';

const SUPPORTED_STEP_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'STATUS_CHANGE',
  'ASSOCIATE',
  'QUERY',
  'CALCULATION',
  'VALIDATION'
];

const SUPPORTED_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Validates an Operation contract according to icase.operation.contract.v1
 * @param {Object} op - Operation definition
 * @param {Object} [catalog] - Validated system catalog { entities, roles, businessRules, operations }
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateOperationContract(op, catalog = {}) {
  const errors = [];
  const warnings = [];

  if (!op || typeof op !== 'object') {
    return { valid: false, errors: ['Operación nula o indefinida.'], warnings: [] };
  }

  // Version check
  if (op.contractVersion && op.contractVersion !== OPERATION_CONTRACT_VERSION) {
    warnings.push(`Versión de contrato no coincide: '${op.contractVersion}'. Se esperaba '${OPERATION_CONTRACT_VERSION}'.`);
  }

  if (!op.operationId || typeof op.operationId !== 'string') {
    errors.push("Campo obligatorio 'operationId' ausente o inválido.");
  }

  if (!op.name || typeof op.name !== 'string') {
    errors.push("Campo obligatorio 'name' ausente o inválido.");
  }

  if (!op.route || !op.route.startsWith('/api/')) {
    errors.push(`Ruta de API inválida: '${op.route}'. Debe comenzar con '/api/'.`);
  }

  const method = (op.method || '').toUpperCase();
  if (!SUPPORTED_HTTP_METHODS.includes(method)) {
    errors.push(`Método HTTP inválido: '${op.method}'. Permitidos: ${SUPPORTED_HTTP_METHODS.join(', ')}.`);
  }

  // Entities catalog check
  const entityMap = new Map((catalog.entities || []).map(e => [e.modelName || e.name, e]));
  const roleSet = new Set((catalog.roles || []).map(r => typeof r === 'string' ? r : r.name));

  if (op.targetEntity) {
    if (entityMap.size > 0 && !entityMap.has(op.targetEntity)) {
      errors.push(`Entidad objetivo '${op.targetEntity}' no existe en el catálogo de entidades aprobadas.`);
    }
  }

  // RBAC checks
  if (Array.isArray(op.authorizedRoles)) {
    for (const r of op.authorizedRoles) {
      if (roleSet.size > 0 && !roleSet.has(r)) {
        warnings.push(`Rol '${r}' en operación '${op.name}' no está registrado en el catálogo de actores aprobados.`);
      }
    }
  }

  // Steps validation
  const hasSteps = Array.isArray(op.steps) && op.steps.length > 0;
  const isBusinessLogic = op.type === 'BUSINESS_LOGIC';

  if (isBusinessLogic && !hasSteps && !op.targetEntity) {
    errors.push(`La operación de negocio '${op.name}' requiere 'targetEntity' o 'steps' estructurados.`);
  }

  if (hasSteps) {
    op.steps.forEach((step, idx) => {
      const stepNum = step.step || (idx + 1);
      if (!step.action || typeof step.action !== 'string') {
        errors.push(`Paso ${stepNum}: Falta la acción ejecutable ('action').`);
        return;
      }
      const act = step.action.toUpperCase().trim();
      if (!SUPPORTED_STEP_ACTIONS.includes(act)) {
        errors.push(`Paso ${stepNum}: Acción '${step.action}' no soportada. Permitidas: ${SUPPORTED_STEP_ACTIONS.join(', ')}.`);
      }

      const stepEntity = step.entity || op.targetEntity;
      if (!stepEntity && act !== 'CALCULATION' && act !== 'VALIDATION') {
        errors.push(`Paso ${stepNum}: Falta 'entity' objetivo para la acción '${act}'.`);
      } else if (stepEntity && entityMap.size > 0 && !entityMap.has(stepEntity)) {
        errors.push(`Paso ${stepNum}: Entidad '${stepEntity}' no existe en el catálogo.`);
      }

      // Action-specific validations
      if (act === 'STATUS_CHANGE') {
        if (!step.statusField && !step.field) {
          warnings.push(`Paso ${stepNum}: No se especificó 'statusField'; se usará 'estado' por defecto.`);
        }
        if (step.newStatus === undefined) {
          errors.push(`Paso ${stepNum}: Acción STATUS_CHANGE requiere 'newStatus'.`);
        }
      }

      if (act === 'ASSOCIATE') {
        if (!step.withEntity && !step.targetEntity) {
          errors.push(`Paso ${stepNum}: Acción ASSOCIATE requiere 'withEntity'.`);
        }
      }

      if (act === 'CALCULATION') {
        if (!step.targetField || !step.formula) {
          errors.push(`Paso ${stepNum}: Acción CALCULATION requiere 'targetField' y 'formula'.`);
        }
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates a Mockup UI Binding contract according to icase.binding.contract.v1
 * @param {Object} binding - Screen binding definition
 * @param {Object} [catalog] - Validated system catalog { entities, operations, roles }
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateBindingContract(binding, catalog = {}) {
  const errors = [];
  const warnings = [];

  if (!binding || typeof binding !== 'object') {
    return { valid: false, errors: ['Definición de vinculación nula o inválida.'], warnings: [] };
  }

  if (binding.contractVersion && binding.contractVersion !== BINDING_CONTRACT_VERSION) {
    warnings.push(`Versión de contrato de binding: '${binding.contractVersion}'. Se esperaba '${BINDING_CONTRACT_VERSION}'.`);
  }

  if (!binding.screenId && !binding.screenRoute) {
    errors.push("Debe especificar 'screenId' o 'screenRoute'.");
  }

  const opSet = new Set((catalog.operations || []).map(o => o.operationId));

  // Table bindings check
  if (Array.isArray(binding.tableBindings)) {
    for (const tbl of binding.tableBindings) {
      if (!tbl.selector && !tbl.tableId) {
        errors.push("Tabla vinculada carece de 'selector' o 'tableId'.");
      }
      if (tbl.operationId && opSet.size > 0 && !opSet.has(tbl.operationId)) {
        errors.push(`Tabla '${tbl.selector || tbl.tableId}' vincula a operationId inexistente: '${tbl.operationId}'.`);
      }
    }
  }

  // Form bindings check
  if (Array.isArray(binding.formBindings)) {
    for (const form of binding.formBindings) {
      if (!form.selector && !form.formId) {
        errors.push("Formulario vinculado carece de 'selector' o 'formId'.");
      }
      if (form.targetOperationId && opSet.size > 0 && !opSet.has(form.targetOperationId)) {
        errors.push(`Formulario '${form.selector || form.formId}' vincula a operación inexistente: '${form.targetOperationId}'.`);
      }
    }
  }

  // Action buttons check
  if (Array.isArray(binding.actionButtons)) {
    for (const btn of binding.actionButtons) {
      if (!btn.selector && !btn.buttonId && !btn.label) {
        errors.push("Botón de acción carece de selector, ID o etiqueta.");
      }
      if (btn.operationId && opSet.size > 0 && !opSet.has(btn.operationId)) {
        errors.push(`Botón '${btn.label || btn.selector}' vincula a operationId inexistente: '${btn.operationId}'.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

module.exports = {
  OPERATION_CONTRACT_VERSION,
  BINDING_CONTRACT_VERSION,
  SUPPORTED_STEP_ACTIONS,
  SUPPORTED_HTTP_METHODS,
  validateOperationContract,
  validateBindingContract
};

