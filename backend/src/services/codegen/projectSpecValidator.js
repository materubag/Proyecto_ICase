/**
 * Project Specification Validator
 * Enforces quality gates and generates detailed diagnostics prior to code generation.
 * Output format:
 * {
 *   ready: boolean,
 *   errors: [{ code, element, message, action }],
 *   warnings: [{ code, element, message }],
 *   coverage: { ... }
 * }
 */

const { isReservedWord } = require('./typeMapper');
const { normalizeCardinality } = require('./modelGenerator');
const { deriveUserFieldMapping } = require('./authGenerator');
const { SUPPORTED_STEP_ACTIONS } = require('./contractSchema');

function describeOperationBehavior(op) {
  const hasTarget = op.targetEntity || op.entity;
  const methodAction = hasTarget && op.method ? (op.method === 'POST' ? 'CREATE' : op.method === 'DELETE' ? 'DELETE' : (op.method === 'PUT' || op.method === 'PATCH') ? 'UPDATE' : null) : null;
  const effectiveAction = (op.action || methodAction || '').toUpperCase();
  const hasExecutableSteps = Array.isArray(op.steps) && op.steps.some(step => step && typeof step === 'object' && SUPPORTED_STEP_ACTIONS.includes(String(step.action || '').toUpperCase()));
  const hasExplicitAction = SUPPORTED_STEP_ACTIONS.includes(effectiveAction);
  return { hasTarget, hasExecutableSteps, hasExplicitAction, effectiveAction };
}

function operationNeedsExecutableBehavior(op) {
  if (!op || op.type !== 'BUSINESS_LOGIC') return false;
  const { hasExecutableSteps, hasExplicitAction, hasTarget } = describeOperationBehavior(op);
  return (!hasExecutableSteps && !hasExplicitAction) || (!hasTarget && !hasExecutableSteps);
}

function validateProjectSpec(spec, options = {}) {
  const errors = [];
  const warnings = [];

  if (!spec || typeof spec !== 'object') {
    return {
      ready: false,
      errors: [{
        code: 'SPEC_NULL_OR_INVALID',
        element: 'spec',
        message: 'La especificación no fue generada o está vacía.',
        action: 'Construir la especificación común antes de validar.'
      }],
      warnings: [],
      coverage: { requirementsCovered: 0, requirementsTotal: 0, percentage: 0 }
    };
  }

  for (const point of spec.unresolved || []) errors.push({ code: 'UNRESOLVED_PROJECT_CONTRACT', element: 'spec', message: point, action: 'Resolver la decisi?n pendiente.' });

  // 1. Entities Check
  const entities = spec.entities || [];
  if (entities.length === 0) {
    errors.push({
      code: 'NO_APPROVED_ENTITIES',
      element: 'entities',
      message: 'No existen entidades aprobadas para generar el modelo de datos.',
      action: 'Aprobar al menos una entidad en el módulo de Modelos.'
    });
  }

  const entityNames = new Set();
  const entityIdMap = new Map();

  for (const ent of entities) {
    if (entityNames.has(ent.modelName)) {
      errors.push({
        code: 'ENTITY_NAME_COLLISION',
        element: `Entity:${ent.name}`,
        message: `Colisión de nombre de entidad: '${ent.modelName}' ya existe.`,
        action: 'Renombrar una de las entidades en conflicto.'
      });
    }
    entityNames.add(ent.modelName);
    entityIdMap.set(ent.id, ent);

    if (isReservedWord(ent.modelName)) {
      warnings.push({
        code: 'RESERVED_WORD_WARNING',
        element: `Entity:${ent.modelName}`,
        message: `El nombre '${ent.modelName}' es una palabra reservada en SQL o JavaScript. Se utilizará sanitización.`
      });
    }

    if (!ent.primaryKey || !ent.primaryKey.fieldName) {
      errors.push({
        code: 'MISSING_PRIMARY_KEY',
        element: `Entity:${ent.modelName}`,
        message: `La entidad '${ent.modelName}' no tiene una clave primaria válida.`,
        action: 'Definir un atributo con isPk=true o permitir id autoincremental.'
      });
    }

    // Check attributes
    const fieldNames = new Set();
    for (const attr of ent.attributes || []) {
      if (fieldNames.has(attr.fieldName)) {
        errors.push({
          code: 'FIELD_NAME_COLLISION',
          element: `Entity:${ent.modelName}.${attr.fieldName}`,
          message: `El campo '${attr.fieldName}' está duplicado en la entidad '${ent.modelName}'.`,
          action: 'Renombrar o consolidar atributos redundantes.'
        });
      }
      fieldNames.add(attr.fieldName);
    }
  }

  // 2. Relationships Check
  const relationships = spec.relationships || [];
  for (const rel of relationships) {
    const src = entityIdMap.get(rel.sourceEntityId) || entities.find(e => e.modelName === rel.sourceEntity || e.id === rel.sourceEntityId);
    const tgt = entityIdMap.get(rel.targetEntityId) || entities.find(e => e.modelName === rel.targetEntity || e.id === rel.targetEntityId);

    if (!src || !tgt) {
      errors.push({
        code: 'UNRESOLVED_RELATIONSHIP_ENDPOINT',
        element: `Relationship:${rel.id || rel.sourceEntity}`,
        message: `La relación conecta con una entidad inexistente o no aprobada ('${!src ? rel.sourceEntity : rel.targetEntity}').`,
        action: 'Aprobar la entidad destino o retirar la relación obsoleta.'
      });
    }

    try {
      normalizeCardinality(rel.cardinality);
    } catch {
      errors.push({
        code: 'INVALID_CARDINALITY',
        element: `Relationship:${rel.id || rel.sourceEntity}`,
        message: `La relación entre '${rel.sourceEntity}' y '${rel.targetEntity}' tiene una cardinalidad no válida ('${rel.cardinality}').`,
        action: 'Corregir la cardinalidad a 1:1, 1:N, N:1 o N:M.'
      });
    }
  }

  // 3. Operations & Route Collisions & Completeness
  const operations = spec.operations || [];
  const routeMethodMap = new Set();

  for (const op of operations) {
    if (!op.operationId || !op.route || !op.method || !op.output || !op.output.successStatus) {
      errors.push({
        code: 'INCOMPLETE_OPERATION_BEHAVIOR',
        element: `Operation:${op.operationId || op.name}`,
        message: `La operación '${op.name || 'desconocida'}' tiene un contrato o comportamiento incompleto.`,
        action: 'Completar ruta, método HTTP y contrato de respuesta.'
      });
    }

    const routeKey = `${(op.method || 'GET').toUpperCase()} ${(op.route || '').toLowerCase()}`;
    if (routeMethodMap.has(routeKey)) {
      errors.push({
        code: 'ROUTE_COLLISION',
        element: `Operation:${op.operationId}`,
        message: `Colisión de endpoint: La ruta '${routeKey}' ya fue registrada por otra operación.`,
        action: 'Modificar el endpoint o el método HTTP de la operación.'
      });
    }
    routeMethodMap.add(routeKey);

    if (op.permissionSource === 'UNRESOLVED' && spec.security?.authType === 'JWT') {
      const crud = op.type === 'READ' || op.type === 'WRITE';
      (crud ? warnings : errors).push({
        code: 'UNRESOLVED_OPERATION_PERMISSION',
        element: 'Operation:' + op.operationId,
        message: crud
          ? 'CRUD secundario sin permiso explícito: se formaliza con el rol administrador al generar.'
          : 'UNRESOLVED: autorización de operación de negocio sin fuente explícita.',
        action: crud ? 'Los permisos se toman de la pantalla del rol o del administrador.' : 'Definir permisos con respaldo en requisitos y actores.'
      });
    }
    if (!op.authorizedRoles || op.authorizedRoles.length === 0) {
      warnings.push({
        code: 'OPERATION_NO_ROLES',
        element: `Operation:${op.operationId}`,
        message: `La operación '${op.name}' no tiene roles de acceso asignados.`
      });
    }

    for (const message of op.unresolved || []) errors.push({ code: 'UNRESOLVED_OPERATION_CONTRACT', element: 'Operation:' + op.operationId, message, action: 'Completar el contrato ejecutable.' });
    if (op.type === 'BUSINESS_LOGIC') {
      const hasTarget = op.targetEntity || op.entity;
      const { hasExecutableSteps, hasExplicitAction } = describeOperationBehavior(op);

      if (!hasExecutableSteps && !hasExplicitAction) {
        errors.push({
          code: 'UNDEFINED_OPERATION_BEHAVIOR',
          element: `Operation:${op.operationId || op.name}`,
          message: `La operación de negocio '${op.name}' (${op.operationId}) no define una acción ejecutable ni pasos estructurados soportados (${SUPPORTED_STEP_ACTIONS.join(', ')}).`,
          action: 'Definir una acción explícita o estructurar los pasos ejecutables en el caso de uso.'
        });
      } else if (!hasTarget && !hasExecutableSteps) {
        errors.push({
          code: 'UNDEFINED_OPERATION_BEHAVIOR',
          element: `Operation:${op.operationId || op.name}`,
          message: `La operación de negocio '${op.name}' no tiene una entidad objetivo (targetEntity) asignada.`,
          action: 'Asignar targetEntity en la operación.'
        });
      }

      if (op.steps && Array.isArray(op.steps)) {
        for (const step of op.steps) {
          if (typeof step === 'string') {
            errors.push({
              code: 'UNRESOLVED_OPERATION_STEPS',
              element: `Operation:${op.operationId || op.name}`,
              message: `La operación '${op.name}' contiene pasos en texto no estructurados que carecen de comportamiento ejecutable ('${step}').`,
              action: 'Estructurar los pasos con acción (' + SUPPORTED_STEP_ACTIONS.join(', ') + ') y entidad objetivo.'
            });
          } else if (typeof step === 'object' && step !== null) {
            const act = (step.action || '').toUpperCase();
            if (op.bindingVersion === 2 && !['CREATE', 'UPDATE', 'QUERY'].includes(act)) errors.push({ code: 'UNSUPPORTED_BINDING_ACTION', element: `Operation:${op.operationId}`, message: `La versión de referencias 2 no implementa ${act}.`, action: 'Implementar y probar la acción antes de exportarla.' });
            if (!SUPPORTED_STEP_ACTIONS.includes(act)) {
              errors.push({
                code: 'UNRESOLVED_OPERATION_STEPS',
                element: `Operation:${op.operationId || op.name}`,
                message: `La operación '${op.name}' contiene un paso con acción no soportada ('${step.action || 'desconocida'}').`,
                action: 'Usar acciones soportadas: ' + SUPPORTED_STEP_ACTIONS.join(', ') + '.'
              });
            }
            if (!step.entity && !op.targetEntity && !op.entity && act !== 'CALCULATION' && act !== 'VALIDATION') {
              errors.push({
                code: 'MISSING_STEP_ENTITY',
                element: `Operation:${op.operationId || op.name}.Step:${step.step || 1}`,
                message: `El paso '${step.step || 1}' de la operación '${op.name}' no especifica una entidad objetivo válida.`,
                action: 'Definir la entidad objetivo en el paso estructurado o en la operación.'
              });
            }
          }
        }
      }

      for (const rule of (op.businessRules || [])) {
        const isExecutable = rule.condition || rule.structuredCondition || (rule.field && (rule.operator || rule.min !== undefined || rule.max !== undefined || rule.enum));
        if (!isExecutable) {
          errors.push({
            code: 'UNEXECUTABLE_BUSINESS_RULE',
            element: `BusinessRule:${rule.code || rule.id || rule.name}`,
            message: `La regla de negocio '${rule.name || rule.description}' carece de una condición ejecutable (falta campo, operador o valor).`,
            action: 'Definir una condición ejecutable estructurada para la regla de negocio.'
          });
        }
      }
    }
  }

  // 4. Screens, Controls & Actions Check
  const screens = spec.screens || [];
  const screenRoutes = new Set();
  const opIds = new Set(operations.map(o => o.operationId));

  for (const scr of screens) {
    for (const message of scr.contract?.unresolved || []) {
      errors.push({ code: 'UNRESOLVED_SCREEN_CONTRACT', element: 'Screen:' + scr.name, message,
        action: 'Completar el contrato expl?cito en evidence.screenContract o structuredContent.screen.contract.' });
    }

    if (screenRoutes.has(scr.route.toLowerCase())) {
      errors.push({
        code: 'SCREEN_ROUTE_COLLISION',
        element: `Screen:${scr.name}`,
        message: `Ruta de pantalla duplicada: '${scr.route}'.`,
        action: 'Asignar una ruta URL única para cada pantalla.'
      });
    }
    screenRoutes.add(scr.route.toLowerCase());

    // Validar presencia y vigencia de mockup aprobado
    if (scr.requiresMockup && (!scr.html || scr.hasApprovedMockup === false)) {
      if (!options.allowMissingMockups && !options.allowPartialScope) {
        errors.push({
          code: 'MISSING_APPROVED_MOCKUP',
          element: `Screen:${scr.name}`,
          message: `La pantalla '${scr.name}' (${scr.route}) no cuenta con un mockup aprobado y vigente de Google Stitch.`,
          action: 'Aprobar la versión correspondiente del mockup en el módulo de Mockups o activar alcance parcial.'
        });
      } else {
        warnings.push({
          code: 'MISSING_MOCKUP_WARNING',
          element: `Screen:${scr.name}`,
          message: `La pantalla '${scr.name}' (${scr.route}) carece de mockup aprobado; se utilizará plantilla base.`
        });
      }
    }

    if (scr.connectedOperationId && !opIds.has(scr.connectedOperationId)) {
      errors.push({
        code: 'UNCONNECTED_SCREEN_OPERATION',
        element: `Screen:${scr.name}`,
        message: `La pantalla '${scr.name}' referencia la operación '${scr.connectedOperationId}' pero no está registrada en el contrato.`,
        action: 'Vincular la pantalla a una operación válida o generar el endpoint correspondiente.'
      });
    }

    for (const act of (scr.actions || [])) {
      if (act.operationId && !opIds.has(act.operationId)) {
        errors.push({
          code: 'UNCONNECTED_SCREEN_ACTION',
          element: `Screen:${scr.name}.Action:${act.name || act.actionId || act.id}`,
          message: `La acción '${act.name || act.actionId || act.id}' en la pantalla '${scr.name}' no tiene una operación de backend vinculada ('${act.operationId}').`,
          action: 'Asignar un operationId válido a la acción o implementar la operación.'
        });
      }
    }

    // Validar controles interactivos definidos en la pantalla
    for (const comp of (scr.components || [])) {
      const isActionControl = ['BUTTON', 'SUBMIT', 'FORM_SUBMIT', 'ACTION'].includes(String(comp.type).toUpperCase());
      if (isActionControl) {
        const targetOpId = comp.operationId || comp.actionId || comp.connectedOperationId;
        if (targetOpId && !opIds.has(targetOpId)) {
          errors.push({
            code: 'UNCONNECTED_SCREEN_CONTROL',
            element: `Screen:${scr.name}.Control:${comp.id || comp.label || 'button'}`,
            message: `El control interactivo '${comp.label || comp.id}' en la pantalla '${scr.name}' está vinculado a una operación inexistente ('${targetOpId}').`,
            action: 'Vincular el control a una operación aprobada existente o definir el endpoint correspondiente.'
          });
        }
      }
    }
  }

  // 4.5 Security and Auth Model Mapping Check
  if (spec.security && spec.security.authType === 'JWT') {
    const userEntity = entities.find(e => /user|usuario|cuenta|account/i.test(e.name));
    if (userEntity) {
      const mapping = deriveUserFieldMapping(userEntity);
      if (!mapping.hasPasswordField) {
        errors.push({
          code: 'MISSING_AUTH_MODEL_FIELDS',
          element: `Entity:${userEntity.modelName}`,
          message: `La entidad de usuario '${userEntity.modelName}' carece de campo para contraseña hasheada (ej. passwordHash o contrasena).`,
          action: 'Agregar un atributo de tipo string para la contraseña en el modelo de usuario.'
        });
      }
      if (!mapping.hasIdentifierField) {
        errors.push({
          code: 'MISSING_AUTH_MODEL_FIELDS',
          element: `Entity:${userEntity.modelName}`,
          message: `La entidad de usuario '${userEntity.modelName}' carece de campo identificador (correo, username o nombre).`,
          action: 'Agregar un atributo identificador en el modelo de usuario.'
        });
      }
    }
  }

  // 5. Requirements Functional Coverage & Implementation Validation
  const requirements = spec.requirements || [];
  const functionalReqs = requirements.filter(r => r.type === 'FUNCTIONAL');

  const coverageDetails = functionalReqs.map(r => {
    const text = `${r.name} ${r.description || ''}`.toLowerCase();
    
    // Determine requirement nature accurately with word boundaries
    let nature = 'BUSINESS_LOGIC';
    if (/\b(autentic\w*|login|sesi[óo]n|tokens?|jwt|roles?|permisos?|credencial\w*|identidad)\b/i.test(text)) {
      nature = 'SECURITY';
    } else if (/\b(pantallas?|vistas?|interfa\w*|formularios?|modales?|dashboards?|botones?|dise[ñn]os?)\b/i.test(text)) {
      nature = 'PRESENTATION';
    } else if (/\b(cat[áa]logos?|almacen\w*|persist\w*|entidades?|tablas?|campos?|atributos?|datos?)\b/i.test(text)) {
      nature = 'DATA';
    }

    const linkedEntities = entities.filter(e => {
      const explicit = (e.requirementIds || []).includes(r.id);
      if (explicit) return true;
      const entName = (e.name || e.modelName || '').toLowerCase();
      return entName.length >= 3 && text.includes(entName);
    });
    const linkedOps = operations.filter(o => {
      const explicit = (o.requirementIds || []).includes(r.id);
      if (explicit) return true;
      const opName = (o.name || '').toLowerCase();
      return opName.length >= 4 && (text.includes(opName) || opName.includes(r.name.toLowerCase()));
    });
    const linkedScreens = screens.filter(s => (s.requirementIds || []).includes(r.id));

    const isTraced = linkedEntities.length > 0 || linkedOps.length > 0 || linkedScreens.length > 0;

    let isImplemented = false;
    let incompleteReason = null;
    let resolutionAction = null;

    if (!isTraced) {
      incompleteReason = 'UNTRACED';
      resolutionAction = 'Vincular el requisito a una entidad, caso de uso u operación aprobada.';
    } else {
      switch (nature) {
        case 'DATA': {
          const hasCompleteEntity = linkedEntities.some(e => e.primaryKey && (e.attributes || []).length > 0);
          if (hasCompleteEntity) {
            isImplemented = true;
          } else {
            incompleteReason = 'MISSING_DATA_MODEL';
            resolutionAction = 'Definir una entidad completa con clave primaria y atributos aprobados.';
          }
          break;
        }
        case 'PRESENTATION': {
          const hasScreenWithOp = linkedScreens.some(s => s.route && (s.connectedOperationId || (s.components && s.components.length > 0)));
          if (hasScreenWithOp) {
            isImplemented = true;
          } else {
            incompleteReason = 'UNCONNECTED_SCREEN';
            resolutionAction = 'Vincular la pantalla a una operación o componentes interactivos.';
          }
          break;
        }
        case 'SECURITY': {
          const hasSecurity = spec.security && spec.security.authType === 'JWT';
          if (hasSecurity) {
            isImplemented = true;
          } else {
            incompleteReason = 'MISSING_SECURITY_SPEC';
            resolutionAction = 'Habilitar autenticación JWT y roles en la configuración del proyecto.';
          }
          break;
        }
        case 'BUSINESS_LOGIC':
        default: {
          const hasOperation = linkedOps.some(o => o.route && o.method && o.output && o.output.successStatus);
          const hasEntity = linkedEntities.length > 0;
          if (hasOperation || (hasEntity && linkedOps.length > 0)) {
            isImplemented = true;
          } else if (hasEntity && linkedOps.length === 0) {
            // Data linked but missing business operation / behavioral logic
            incompleteReason = 'MISSING_BEHAVIOR_OPERATION';
            resolutionAction = 'Implementar la operación de negocio o caso de uso para ejecutar el comportamiento requerido.';
          } else {
            incompleteReason = 'MISSING_BEHAVIOR';
            resolutionAction = 'Implementar la lógica o caso de uso correspondiente al requisito.';
          }
          break;
        }
      }
    }

    // Check if test-validated
    const validatedReqIds = options.validatedRequirementIds || [];
    const isValidated = validatedReqIds.includes(r.id) || (spec.testCases && spec.testCases.some(t => (t.requirementIds || []).includes(r.id)));

    return {
      requirementId: r.id,
      code: r.code,
      name: r.name,
      nature,
      traced: isTraced,
      implemented: isImplemented,
      validated: isValidated,
      covered: isImplemented,
      reason: incompleteReason,
      action: resolutionAction
    };
  });

  const tracedCount = coverageDetails.filter(c => c.traced).length;
  const implementedCount = coverageDetails.filter(c => c.implemented).length;
  const validatedCount = coverageDetails.filter(c => c.validated).length;
  const coveragePercentage = functionalReqs.length > 0 ? Math.round((implementedCount / functionalReqs.length) * 100) : 100;
  
  const incompleteReqs = coverageDetails.filter(c => !c.implemented);

  if (incompleteReqs.length > 0) {
    if (options.allowPartialScope) {
      warnings.push({
        code: 'PARTIAL_SCOPE_EXCLUSION',
        element: 'requirements',
        message: `Alcance parcial activado: ${incompleteReqs.length} requisitos funcionales aprobados fueron excluidos de la generación (${incompleteReqs.map(u => `${u.code || u.name} [${u.reason}]`).join(', ')}).`
      });
    } else {
      for (const u of incompleteReqs) {
        errors.push({
          code: 'UNIMPLEMENTED_REQUIREMENT_BEHAVIOR',
          element: `Requirement:${u.code || u.name}`,
          message: `El requisito funcional '${u.code || u.name}' carece de comportamiento implementado (${u.reason}).`,
          action: u.action || 'Implementar el modelo de datos, caso de uso o pantalla correspondiente, o activar la opción de alcance parcial.'
        });
      }
    }
  }

  return {
    ready: errors.length === 0,
    errors,
    warnings,
    coverage: {
      requirementsTotal: functionalReqs.length,
      requirementsTraced: tracedCount,
      requirementsImplemented: implementedCount,
      requirementsValidated: validatedCount,
      requirementsCovered: implementedCount,
      coveragePercentage,
      details: coverageDetails,
      incomplete: incompleteReqs,
      excluded: options.allowPartialScope ? incompleteReqs : []
    }
  };
}

module.exports = {
  validateProjectSpec,
  describeOperationBehavior,
  operationNeedsExecutableBehavior
};
