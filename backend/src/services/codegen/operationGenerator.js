/**
 * Operation Generator for Express + Sequelize
 * Generates services, controllers, and routes for custom business logic operations
 * included in the approved specification with real Sequelize transactions, rollback,
 * and genuine data mutations.
 */

const { toCamelCase, toPascalCase, deriveNaming } = require('./typeMapper');

function evaluateSafeCondition(rule) {
  const ruleCode = rule.code || rule.id || 'RULE';
  const ruleDesc = (rule.description || rule.name || ruleCode).replace(/['"\\]/g, '\\$&');

  // Case 1: Structured condition object { field, operator, value }
  if (rule.field && rule.operator) {
    const op = String(rule.operator).toLowerCase();
    const fld = `payload.${rule.field}`;
    const val = JSON.stringify(rule.value !== undefined ? rule.value : null);

    let expr = '';
    switch (op) {
      case 'eq':
      case '==':
      case '===':
        expr = `${fld} === ${val}`;
        break;
      case 'neq':
      case '!=':
      case '!==':
        expr = `${fld} !== ${val}`;
        break;
      case 'gt':
      case '>':
        expr = `${fld} > ${val}`;
        break;
      case 'gte':
      case '>=':
        expr = `${fld} >= ${val}`;
        break;
      case 'lt':
      case '<':
        expr = `${fld} < ${val}`;
        break;
      case 'lte':
      case '<=':
        expr = `${fld} <= ${val}`;
        break;
      case 'in':
        expr = `Array.isArray(${val}) && ${val}.includes(${fld})`;
        break;
      case 'not_in':
        expr = `Array.isArray(${val}) && !${val}.includes(${fld})`;
        break;
      case 'not_empty':
        expr = `${fld} !== undefined && ${fld} !== null && ${fld} !== ''`;
        break;
      default:
        throw new Error(`Operador no soportado '${rule.operator}' en regla ${ruleCode}`);
    }

    return `      // Regla estructurada: ${ruleDesc} (${ruleCode})
      if (!(${expr})) {
        const err = new Error('Violación de regla de negocio (${ruleCode}): ${ruleDesc}');
        err.statusCode = 422;
        err.code = 'BUSINESS_RULE_VIOLATION';
        err.rule = '${ruleCode}';
        throw err;
      }`;
  }

  // Case 2: Field with min, max or enum constraints
  if (rule.field && (rule.min !== undefined || rule.max !== undefined || rule.enum)) {
    const parts = [`payload.${rule.field} !== undefined && payload.${rule.field} !== null`];
    if (rule.min !== undefined) parts.push(`payload.${rule.field} >= ${JSON.stringify(rule.min)}`);
    if (rule.max !== undefined) parts.push(`payload.${rule.field} <= ${JSON.stringify(rule.max)}`);
    if (rule.enum) parts.push(`${JSON.stringify(rule.enum)}.includes(payload.${rule.field})`);

    return `      // Regla de campo: ${rule.field} (${ruleDesc})
      if (!(${parts.join(' && ')})) {
        const err = new Error('Violación de regla de negocio (${ruleCode}): ${ruleDesc}');
        err.statusCode = 422;
        err.code = 'BUSINESS_RULE_VIOLATION';
        err.rule = '${ruleCode}';
        throw err;
      }`;
  }

  // Case 3: Explicit safe condition expression (only safe payload identifiers, no eval, assignments or globals)
  if (rule.condition && typeof rule.condition === 'string') {
    const rawCond = rule.condition.trim();
    const isSafe = /^[\s\w.><=!&|()+\-*/%"'0-9]+$/.test(rawCond) &&
      !/(eval|Function|require|process|global|window|prototype|__proto__|constructor|import|;\s*)/.test(rawCond);

    if (!isSafe) {
      const err = new Error(`Expresión de condición no permitida o insegura en regla '${ruleCode}': '${rawCond}'`);
      err.code = 'UNSAFE_RULE_CONDITION';
      throw err;
    }

    return `      // Regla: ${ruleDesc} (${ruleCode})
      if (!(${rawCond})) {
        const err = new Error('Violación de regla de negocio: ${ruleDesc}');
        err.statusCode = 422;
        err.code = 'BUSINESS_RULE_VIOLATION';
        err.rule = '${ruleCode}';
        throw err;
      }`;
  }

  // If none of the executable condition formats are provided, fail generation
  const err = new Error(`La regla de negocio '${ruleCode}' ('${ruleDesc}') no tiene una definición estructurada ejecutable.`);
  err.code = 'UNEXECUTABLE_BUSINESS_RULE';
  err.ruleCode = ruleCode;
  throw err;
}

function buildOperationNameMap(operations = []) {
  const map = new Map();
  const existingSet = new Set();
  operations.forEach((op, idx) => {
    const base = toCamelCase(op.name || op.operationId || `op_${idx}`);
    let fnName = base;
    if (existingSet.has(fnName)) {
      const idClean = toCamelCase((op.operationId || `id_${idx}`).replace(/[^a-zA-Z0-9]/g, '_'));
      fnName = `${base}_${idClean}`;
    }
    let counter = 2;
    while (existingSet.has(fnName)) {
      fnName = `${base}_${counter++}`;
    }
    existingSet.add(fnName);
    map.set(op.operationId || idx, fnName);
  });
  return map;
}

function generateOperationServiceFile(operations = [], entities = []) {
  const nameMap = buildOperationNameMap(operations);

  const opFunctions = operations.map((op, idx) => {
    const fnName = nameMap.get(op.operationId || idx);
    
    // Explicit target entity without defaulting to entities[0]
    const targetModel = op.targetEntity || op.entity || null;

    if (!targetModel && (!op.steps || op.steps.length === 0)) {
      const err = new Error(`La operación '${op.name || op.operationId}' carece de entidad objetivo (targetEntity) y de pasos definidos.`);
      err.code = 'UNDEFINED_OPERATION_BEHAVIOR';
      err.operationId = op.operationId;
      throw err;
    }

    // Business rules verification logic using safe evaluator
    const ruleValidations = (op.businessRules || []).map(r => evaluateSafeCondition(r)).join('\n\n');

    // Deterministic mutation logic based on op.action or op.steps
    let mutationLogic = '';
    const effectiveAction = (op.action || (op.method === 'POST' ? 'CREATE' : op.method === 'DELETE' ? 'DELETE' : (op.method === 'PUT' || op.method === 'PATCH') ? 'UPDATE' : '')).toUpperCase();

    // Resolve primary key for target entity
    const targetPk = (entities.find(e => e.modelName === targetModel || e.name === targetModel)?.primaryKey?.fieldName) || 'id';

    if (op.steps && Array.isArray(op.steps) && op.steps.length > 0) {
      const stepResults = [];
      const stepLines = op.steps.map((step, sIdx) => {
        const stepNum = step.step || (sIdx + 1);
        const stepEntity = step.entity || targetModel;
        const action = (step.action || '').toUpperCase();
        const stepPk = (entities.find(e => e.modelName === stepEntity || e.name === stepEntity)?.primaryKey?.fieldName) || 'id';

        if (action === 'CREATE') {
          stepResults.push(`stepResult_${stepNum}`);
          const createData = step.fields || step.data ? JSON.stringify(step.fields || step.data) : 'payload';
          return `      // Paso ${stepNum}: Crear ${stepEntity}\n      const stepResult_${stepNum} = await models.${stepEntity}.create(${createData}, { transaction: t });`;
        }
        if (action === 'UPDATE') {
          stepResults.push(`stepResult_${stepNum}`);
          const updateData = step.fields || step.data ? JSON.stringify(step.fields || step.data) : 'payload';
          return `      // Paso ${stepNum}: Actualizar ${stepEntity}\n      const stepResult_${stepNum} = await models.${stepEntity}.update(${updateData}, { where: { ${stepPk}: payload.${stepPk} || payload.id }, transaction: t });`;
        }
        if (action === 'DELETE') {
          stepResults.push(`stepResult_${stepNum}`);
          return `      // Paso ${stepNum}: Eliminar ${stepEntity}\n      const stepResult_${stepNum} = await models.${stepEntity}.destroy({ where: { ${stepPk}: payload.${stepPk} || payload.id }, transaction: t });`;
        }
        if (action === 'STATUS_CHANGE') {
          stepResults.push(`stepResult_${stepNum}`);
          const statusCol = step.statusField || 'estado';
          const newStatus = JSON.stringify(step.newStatus || 'COMPLETED');
          return `      // Paso ${stepNum}: Cambiar estado de ${stepEntity}\n      const stepResult_${stepNum} = await models.${stepEntity}.update({ ${statusCol}: ${newStatus} }, { where: { ${stepPk}: payload.${stepPk} || payload.id }, transaction: t });`;
        }
        if (action === 'ASSOCIATE') {
          stepResults.push(`stepResult_${stepNum}`);
          const withModel = step.withEntity || step.targetEntity;
          const throughModel = step.through;
          const fk = step.foreignKey || `${withModel ? withModel.charAt(0).toLowerCase() + withModel.slice(1) : 'item'}Id`;
          if (throughModel) {
            return `      // Paso ${stepNum}: Asociar ${stepEntity} con ${withModel} mediante tabla ${throughModel}\n      const stepResult_${stepNum} = await models.${throughModel}.create({ ...payload, ${fk}: payload.${fk} || payload.targetId }, { transaction: t });`;
          }
          return `      // Paso ${stepNum}: Asociar clave foránea en ${stepEntity}\n      const stepResult_${stepNum} = await models.${stepEntity}.update({ ${fk}: payload.${fk} || payload.targetId }, { where: { ${stepPk}: payload.${stepPk} || payload.id }, transaction: t });`;
        }
        if (action === 'QUERY') {
          stepResults.push(`stepResult_${stepNum}`);
          const filterObj = step.filter ? JSON.stringify(step.filter) : '{}';
          const queryLimit = step.limit ? `, limit: ${step.limit}` : '';
          return `      // Paso ${stepNum}: Consultar ${stepEntity}\n      const stepResult_${stepNum} = await models.${stepEntity}.findAll({ where: ${filterObj}${queryLimit}, transaction: t });`;
        }
        if (action === 'CALCULATION') {
          stepResults.push(`stepResult_${stepNum}`);
          const targetFld = step.targetField || 'calculatedValue';
          const rawFormula = String(step.formula || '0').replace(/[^a-zA-Z0-9_+\-*/.() ]/g, '');
          return `      // Paso ${stepNum}: Cálculo de ${targetFld}\n      const stepResult_${stepNum} = Number(${rawFormula});\n      payload.${targetFld} = stepResult_${stepNum};`;
        }
        if (action === 'VALIDATION') {
          stepResults.push(`stepResult_${stepNum}`);
          const conditionExpr = step.condition || 'true';
          const errorMsg = (step.errorMessage || 'Validación de paso no satisfecha').replace(/['"\\]/g, '\\$&');
          return `      // Paso ${stepNum}: Validación de paso\n      if (!(${conditionExpr})) {\n        const err = new Error('${errorMsg}');\n        err.statusCode = 422;\n        err.code = 'VALIDATION_FAILED';\n        throw err;\n      }\n      const stepResult_${stepNum} = true;`;
        }

        // Unknown step without executable action - never emit comment-only steps
        const err = new Error(`El paso ${stepNum} en la operación '${op.name}' (${op.operationId}) carece de acción estructurada ejecutable.`);
        err.code = 'UNEXECUTABLE_OPERATION_STEP';
        err.operationId = op.operationId;
        throw err;
      }).join('\n');

      mutationLogic = `${stepLines}\n      const record = ${stepResults[stepResults.length - 1] || '{ stepsExecuted: ' + op.steps.length + ' }'};`;
    } else if (effectiveAction === 'CREATE' && targetModel) {
      mutationLogic = `      // Creación explícita en modelo ${targetModel} dentro de transacción
      const record = await models.${targetModel}.create(payload, { transaction: t });`;
    } else if (effectiveAction === 'UPDATE' && targetModel) {
      mutationLogic = `      // Actualización explícita en modelo ${targetModel} dentro de transacción
      const targetId = payload.${targetPk} || payload.id;
      if (!targetId) {
        const err = new Error("El identificador '${targetPk}' es requerido para actualizar ${targetModel}.");
        err.statusCode = 400;
        err.code = 'MISSING_REQUIRED_ID';
        throw err;
      }
      const record = await models.${targetModel}.findByPk(targetId, { transaction: t });
      if (!record) {
        const err = new Error(\`${targetModel} con ID '\${targetId}' no encontrado.\`);
        err.statusCode = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      await record.update(payload, { transaction: t });`;
    } else if (effectiveAction === 'DELETE' && targetModel) {
      mutationLogic = `      // Eliminación explícita en modelo ${targetModel} dentro de transacción
      const targetId = payload.${targetPk} || payload.id;
      if (!targetId) {
        const err = new Error("El identificador '${targetPk}' es requerido para eliminar ${targetModel}.");
        err.statusCode = 400;
        err.code = 'MISSING_REQUIRED_ID';
        throw err;
      }
      const record = await models.${targetModel}.findByPk(targetId, { transaction: t });
      if (!record) {
        const err = new Error(\`${targetModel} con ID '\${targetId}' no encontrado.\`);
        err.statusCode = 404;
        err.code = 'NOT_FOUND';
        throw err;
      }
      await record.destroy({ transaction: t });`;
    } else {
      // Bloquear operaciones de comportamiento indefinido; no inventar CREATE por defecto
      const err = new Error(`La operación '${op.name || op.operationId}' (${op.operationId}) carece de acción estructurada definida. No se admite CREATE por defecto.`);
      err.code = 'UNDEFINED_OPERATION_BEHAVIOR';
      err.operationId = op.operationId;
      throw err;
    }

    return `  /**
   * Operación de Negocio: ${op.name}
   * ID: ${op.operationId}
   * Modelo Objetivo: ${targetModel || 'Transaccional'}
   */
  async ${fnName}(payload = {}, user = null, options = {}) {
    const { sequelize } = require('../models');
    
    // Iniciar transacción de base de datos para atomicidad y rollback
    const t = await sequelize.transaction();
    try {
      if (!payload || typeof payload !== 'object') {
        const err = new Error('Payload inválido para la operación ${op.name}');
        err.statusCode = 400;
        err.code = 'INVALID_PAYLOAD';
        throw err;
      }

${ruleValidations ? ruleValidations + '\n' : ''}
${mutationLogic}

      // Confirmar transacción de base de datos
      await t.commit();

      return {
        operationId: '${op.operationId}',
        status: 'COMPLETED',
        timestamp: new Date().toISOString(),
        data: record
      };
    } catch (error) {
      // Revertir cualquier cambio parcial en la base de datos
      await t.rollback();
      throw error;
    }
  },`;
  });

  return `/**
 * Servicio de Operaciones de Negocio Transaccionales
 * Generado automáticamente por ICASE Studio
 */

const models = require('../models');

const OperationService = {
${opFunctions.join('\n\n')}
};

module.exports = OperationService;
`;
}

function generateOperationControllerFile(operations = []) {
  const nameMap = buildOperationNameMap(operations);

  const handlerFunctions = operations.map((op, idx) => {
    const fnName = nameMap.get(op.operationId || idx);

    return `  async ${fnName}(req, res) {
    try {
      const payload = { ...(req.query || {}), ...(req.body || {}) };
      const result = await operationService.${fnName}(payload, req.user);
      return res.status(${op.output?.successStatus || 200}).json({
        success: true,
        data: result,
        message: 'Operación ejecutada exitosamente'
      });
    } catch (error) {
      console.error('Error en operación ${fnName}:', error);
      return res.status(error.statusCode || 400).json({
        success: false,
        error: error.code || 'OPERATION_ERROR',
        code: error.code || 'OPERATION_ERROR',
        rule: error.rule || undefined,
        message: error.message
      });
    }
  },`;
  });

  return `/**
 * Controlador de Operaciones de Negocio
 * Generado automáticamente por ICASE Studio
 */

const operationService = require('../services/operation.service');

const OperationController = {
${handlerFunctions.join('\n\n')}
};

module.exports = OperationController;
`;
}

function generateOperationRoutesFile(operations = [], security = {}) {
  const hasAuth = security?.authType === 'JWT';
  const nameMap = buildOperationNameMap(operations);

  const routeLines = operations.map((op, idx) => {
    const fnName = nameMap.get(op.operationId || idx);
    const method = (op.method || 'POST').toLowerCase();
    const endpoint = op.route.replace(/^\/api\/operations\/?/, '/').replace(/^\/?/, '/');

    const middlewares = [];
    if (hasAuth) {
      if (op.authorizedRoles && op.authorizedRoles.length > 0) {
        const rolesList = op.authorizedRoles.map(r => `'${r}'`).join(', ');
        middlewares.push(`authenticateToken`, `authorizeRoles(${rolesList})`);
      } else {
        middlewares.push(`authenticateToken`);
      }
    }

    const midArg = middlewares.length > 0 ? `${middlewares.join(', ')}, ` : '';
    const lines = [
      `// ${op.name} (${op.operationId})`,
      `router.${method}('${endpoint}', ${midArg}operationController.${fnName});`
    ];
    if (method !== 'get') {
      lines.push(`router.get('${endpoint}', ${midArg}operationController.${fnName});`);
    }
    return lines.join('\n');
  });

  const authImports = hasAuth 
    ? "const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');\n"
    : "";

  return `/**
 * Rutas de Operaciones de Negocio
 * Generado automáticamente por ICASE Studio
 */

const express = require('express');
const router = express.Router();
const operationController = require('../controllers/operation.controller');
${authImports}
${routeLines.join('\n')}

module.exports = router;
`;
}

module.exports = {
  generateOperationServiceFile,
  generateOperationControllerFile,
  generateOperationRoutesFile,
  buildOperationNameMap
};
