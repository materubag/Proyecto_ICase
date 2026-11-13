/**
 * Operation Generator for Express + Sequelize
 * Generates services, controllers, and routes for custom business logic operations
 * included in the approved specification with real Sequelize transactions, rollback,
 * and genuine data mutations.
 */

const { toCamelCase, toPascalCase, deriveNaming } = require('./typeMapper');
const { executionProblems } = require('./executableContract');

function evaluateSafeCondition(rule) {
  const code = rule.code || rule.id || 'RULE';
  if (!rule.field || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(rule.field) || typeof rule.condition === 'string') throw Object.assign(new Error('Regla declarativa requerida: ' + code), { code: 'UNEXECUTABLE_BUSINESS_RULE' });
  const operators = { '==':'eq', '===':'eq', '!=':'neq', '!==':'neq', '>':'gt', '>=':'gte', '<':'lt', '<=':'lte' };
  const predicates = rule.operator ? [{ left: { $ref: 'payload.' + rule.field }, operator: operators[rule.operator] || rule.operator, right: rule.value }]
    : [ ...(rule.min !== undefined ? [{ operator: 'gte', right: rule.min }] : []), ...(rule.max !== undefined ? [{ operator: 'lte', right: rule.max }] : []), ...(rule.enum ? [{ operator: 'in', right: rule.enum }] : []) ].map(p => ({ ...p, left: { $ref: 'payload.' + rule.field } }));
  if (!predicates.length) throw Object.assign(new Error('Regla sin predicado: ' + code), { code: 'UNEXECUTABLE_BUSINESS_RULE' });
  return predicates.map(p => '      if (!require("./operation.runtime").evaluatePredicate(' + JSON.stringify(p) + ', { payload, user })) throw Object.assign(new Error(' + JSON.stringify(rule.description || code) + '), { statusCode: 422, code: "BUSINESS_RULE_VIOLATION" });').join('\n');
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

function generateOperationServiceFile(operations = [], entities = [], options = {}) {
  const nameMap = buildOperationNameMap(operations);

  const opFunctions = operations.map((op, idx) => {
    const fnName = nameMap.get(op.operationId || idx);
    
    // Explicit target entity without defaulting to entities[0]
    const targetModel = op.targetEntity || op.entity || null;
    const problems = executionProblems(op, entities);
    if (problems.length) {
      if (!options.reviewOnly) throw Object.assign(new Error(problems.join(' ')), { code: 'UNRESOLVED_OPERATION_CONTRACT', operationId: op.operationId });
      return '  async ' + fnName + '() { throw Object.assign(new Error("Contrato pendiente de resolución"), { statusCode: 501, code: "UNRESOLVED_OPERATION" }); },';
    }

    if (options.reviewOnly && ((op.unresolved || []).length || (!targetModel && (!op.steps || op.steps.length === 0)))) {
      return '  async ' + fnName + '() { const err = new Error(' + JSON.stringify('UNRESOLVED: ' + op.operationId) + '); err.statusCode = 501; err.code = "UNRESOLVED_OPERATION"; throw err; },';
    }
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
    const effectiveAction = (op.action || '').toUpperCase();

    // Resolve primary key for target entity
    const targetPk = (entities.find(e => e.modelName === targetModel || e.name === targetModel)?.primaryKey?.fieldName) || 'id';
    const targetFields = (entities.find(e => e.modelName === targetModel || e.name === targetModel)?.attributes || []).filter(a => !a.isPk && !a.readOnly).map(a => a.fieldName);
    const projectedPayload = 'Object.fromEntries(' + JSON.stringify(targetFields) + '.filter(key => payload[key] !== undefined).map(key => [key, payload[key]]))';

    if (op.bindingVersion === 2) {
      mutationLogic = '      const { executeSteps } = require("./operation.runtime");\n      const record = await executeSteps(models, ' + JSON.stringify(op) + ', payload, user, t);';
    } else if (op.steps && Array.isArray(op.steps) && op.steps.length > 0) {
      const stepResults = [];
      const stepLines = op.steps.map((step, sIdx) => {
        const stepNum = sIdx + 1;
        const stepEntity = step.entity || targetModel;
        const action = (step.action || '').toUpperCase();
        const stepPk = (entities.find(e => e.modelName === stepEntity || e.name === stepEntity)?.primaryKey?.fieldName) || 'id';

        if (action === 'CREATE') {
          stepResults.push(`stepResult_${stepNum}`);
          const createData = JSON.stringify(step.fields || step.data || {});
          return `      // Paso ${stepNum}: Crear ${stepEntity}\n      const stepResult_${stepNum} = await models.${stepEntity}.create(${createData}, { transaction: t });`;
        }
        if (action === 'UPDATE') {
          stepResults.push(`stepResult_${stepNum}`);
          const updateData = JSON.stringify(step.fields || step.data || {});
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
        if (action === 'VALIDATION' && step.condition && typeof step.condition === 'object') {
          stepResults.push(`stepResult_${stepNum}`);
          return '      if (!require("./operation.runtime").evaluatePredicate(' + JSON.stringify(step.condition) + ', { payload, user })) throw Object.assign(new Error(' + JSON.stringify(step.errorMessage || 'Validaci?n no satisfecha') + '), { statusCode: 422, code: "VALIDATION_FAILED" });\n      const stepResult_' + stepNum + ' = true;';
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
      const record = await models.${targetModel}.create(${projectedPayload}, { transaction: t });`;
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
      await record.update(${projectedPayload}, { transaction: t });`;
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
      console.error('Error en operación ${fnName}:', error.code || error.name || 'OPERATION_ERROR');
      return res.status(error.statusCode || (error.name === 'SequelizeUniqueConstraintError' ? 409 : 400)).json({
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
    if (op.invocation === 'SYSTEM') return '';
    const fnName = nameMap.get(op.operationId || idx);
    const method = (op.method || 'POST').toLowerCase();
    const endpoint = op.route.replace(/^\/api\/operations\/?/, '/').replace(/^\/?/, '/');

    const middlewares = [];
    if (hasAuth) {
      let roles = [...(op.authorizedRoles || [])];
      if (/auditoria/i.test(op.name || op.route) || /uc-05/i.test(op.operationId || '')) {
        roles = ['Administrador'];
      } else if (/usuario|seguridad/i.test(op.name || op.route) || /uc-10|uc-23/i.test(op.operationId || '')) {
        roles = ['Administrador'];
      }
      roles = roles.map(r => r === 'Recepcionista' ? 'Recepción' : r);
      if (roles.length === 0) {
        roles = ['Administrador'];
      }
      const rolesList = roles.map(r => `'${r}'`).join(', ');
      middlewares.push(`authenticateToken`, `authorizeRoles(${rolesList})`);
    }

    const midArg = middlewares.length > 0 ? `${middlewares.join(', ')}, ` : '';
    const lines = [
      `// ${op.name} (${op.operationId})`,
      `router.${method}('${endpoint}', ${midArg}operationController.${fnName});`
    ];

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
