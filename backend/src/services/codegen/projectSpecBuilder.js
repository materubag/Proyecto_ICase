/**
 * Project Specification Builder (icase.spec.json)
 * Compiles a deterministic, approved specification from the ICASE domain model.
 * Bridges Requirements, Actors, Use Cases, Entities, Relationships, Screens and Mockups into a single source of truth.
 */

const crypto = require('crypto');
const { buildScreenContract, inferScreenRoles, inferScreenEntity } = require('./screenContract');
const prisma = require('../../config/prisma');
const {
  toPascalCase,
  toCamelCase,
  toSnakeCasePlural,
  deriveNaming,
  normalizeAttributes,
  toOpenApiType
} = require('./typeMapper');
const { normalizeCardinality } = require('./modelGenerator');
const { SUPPORTED_STEP_ACTIONS } = require('./contractSchema');
const designSystemService = require('../mockup/designSystemService');

/**
 * Validates whether an element has a valid APPROVED status, detecting contradictions.
 */
function checkApproval(item) {
  if (!item || item.isDeleted) return { approved: false, reason: 'DELETED' };
  const s = item.status || null;
  const r = item.reviewStatus || null;

  // Detect explicit contradictions between status and reviewStatus
  if (s && r && s !== r) {
    const isNegS = ['REJECTED', 'DISCARDED', 'DEPRECATED', 'OUTDATED', 'NEEDS_REVIEW'].includes(s);
    const isNegR = ['REJECTED', 'DISCARDED', 'DEPRECATED', 'OUTDATED', 'NEEDS_REVIEW'].includes(r);
    const isPosS = s === 'APPROVED';
    const isPosR = r === 'APPROVED';

    if ((isPosS && isNegR) || (isPosR && isNegS) || (isPosS && r === 'PENDING') || (isPosR && s === 'PENDING')) {
      return { approved: false, contradictory: true, reason: 'CONTRADICTORY_STATUS' };
    }
  }

  const isApproved = s === 'APPROVED' || r === 'APPROVED';
  if (isApproved) {
    return { approved: true, contradictory: false };
  }

  return { approved: false, reason: 'PENDING_APPROVAL' };
}

/**
 * Produces a deterministic SHA-256 hash of an object, strictly excluding the root 'hash' property.
 * Serializes keys deterministically in sorted alphabetical order.
 */
function computeCanonicalHash(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const serialize = (val, isRoot = false) => {
    if (val === null || val === undefined) return null;
    if (Array.isArray(val)) return val.map(v => serialize(v, false));
    if (typeof val === 'object') {
      const sorted = {};
      for (const k of Object.keys(val).sort()) {
        if (isRoot && k === 'hash') continue; // Exclude root hash property
        if (val[k] !== undefined) {
          sorted[k] = serialize(val[k], false);
        }
      }
      return sorted;
    }
    return val;
  };
  const str = JSON.stringify(serialize(obj, true));
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Validates the cryptographic SHA-256 integrity of a spec object
 */
function verifySpecHash(spec) {
  if (!spec || !spec.hash || typeof spec.hash !== 'string') return false;
  const expectedHash = computeCanonicalHash(spec);
  return spec.hash === expectedHash;
}

/**
 * Builds the complete unified JSON specification for a project
 */
async function buildProjectSpec(projectId, options = {}) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      requirements: { where: { isDeleted: false }, orderBy: { code: 'asc' } },
      actors: { where: { isDeleted: false }, orderBy: { name: 'asc' } },
      useCases: { where: { isDeleted: false }, orderBy: { codeId: 'asc' } },
      entities: {
        where: { isDeleted: false },
        include: { attributes: true },
        orderBy: { name: 'asc' }
      },
      relationships: { orderBy: { createdAt: 'asc' } },
      screens: {
        where: { isDeleted: false },
        include: { components: { orderBy: { order: 'asc' } } },
        orderBy: { name: 'asc' }
      },
      navigationNodes: { where: { isDeleted: false }, orderBy: { name: 'asc' } },
      businessRules: { orderBy: { createdAt: 'asc' } },
      technologies: { orderBy: { name: 'asc' } },
      architectures: {
        include: { components: true },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!project) {
    const error = new Error(`Proyecto no encontrado con ID '${projectId}'.`);
    error.code = 'PROJECT_NOT_FOUND';
    throw error;
  }

  // 1. Filter strictly by approved elements
  const approvedRequirements = project.requirements.filter(r => checkApproval(r).approved);
  const approvedActors = project.actors.filter(a => checkApproval(a).approved);
  const approvedUseCases = project.useCases.filter(u => checkApproval(u).approved);
  let approvedEntities = project.entities.filter(e => checkApproval(e).approved);
  let approvedRelationships = project.relationships.filter(r => checkApproval(r).approved);
  const approvedScreens = project.screens.filter(s => checkApproval(s).approved);
  const approvedNavNodes = project.navigationNodes.filter(n => checkApproval(n).approved);
  const approvedRules = project.businessRules.filter(b => checkApproval(b).approved);

  // Fallback: If no entities are in the database table but an ER diagram artifact exists, parse them dynamically
  if (approvedEntities.length === 0) {
    const erArt = await prisma.artifact.findFirst({
      where: { projectId, type: 'ER' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
    });
    if (erArt?.versions?.[0]?.renderedContent) {
      const code = erArt.versions[0].renderedContent;
      const clean = code.trim();
      const entityRegex = /^\s*([A-Za-z0-9_]+)\s*\{([\s\S]*?)\}/gm;
      let match;
      const parsedEntities = [];
      while ((match = entityRegex.exec(clean)) !== null) {
        const entityName = match[1].trim();
        const rawBody = match[2].trim();
        const lines = rawBody.split('\n').map(l => l.trim()).filter(Boolean);
        const attrs = [];
        let hasPk = false;
        for (const line of lines) {
          const parts = line.split(/\s+/);
          const type = parts[0] || 'string';
          const name = parts[1] || '';
          const isPk = parts.slice(2).some(p => p.toUpperCase() === 'PK');
          if (isPk) hasPk = true;
          attrs.push({ id: `attr_${entityName}_${name}`, name, fieldName: name, dataType: type, isPk, allowNull: !isPk });
        }
        parsedEntities.push({
          id: `ent_${entityName}`,
          name: entityName,
          status: 'APPROVED',
          reviewStatus: 'APPROVED',
          attributes: attrs
        });
      }
      if (parsedEntities.length > 0) {
        approvedEntities = parsedEntities;
      }
    }
  }

  // 2. Fetch mockups from ArtifactVersion (approved versions prioritized, respecting approvedVersionId)
  const mockupArtifacts = await prisma.artifact.findMany({
    where: { projectId, type: 'MOCKUP' },
    include: {
      versions: {
        orderBy: { version: 'desc' }
      }
    }
  });

  // Entity map for resolution
  const entityIdMap = new Map();
  const entityNameMap = new Map();
  for (const ent of approvedEntities) {
    entityIdMap.set(ent.id, ent);
    const lower = ent.name.trim().toLowerCase();
    if (!entityNameMap.has(lower)) entityNameMap.set(lower, []);
    entityNameMap.get(lower).push(ent);
  }

  // 3. Normalize Entities
  const normalizedEntities = approvedEntities.map(ent => {
    const naming = deriveNaming(ent.name);
    const attrs = normalizeAttributes((ent.attributes || []).map(a => ({ ...a, ...a.evidence?.fieldContract })));
    const pkAttr = attrs.find(a => a.isPk) || attrs[0];

    return {
      id: ent.id,
      name: ent.name,
      modelName: naming.modelName,
      tableName: naming.tableName,
      endpoint: naming.endpoint,
      description: ent.description || '',
      crudPermissions: ent.evidence?.crudPermissions || null,
      requirementIds: ent.requirementIds || [],
      revision: ent.revision || 1,
      primaryKey: {
        fieldName: pkAttr.fieldName,
        type: pkAttr.dataType,
        autoIncrement: pkAttr.autoIncrement
      },
      attributes: attrs.map(a => ({
        fieldName: a.fieldName,
        originalName: a.originalName,
        type: a.dataType,
        allowNull: a.allowNull,
        unique: a.unique,
        isPk: a.isPk,
        autoIncrement: a.autoIncrement,
        readOnly: a.readOnly,
        defaultValue: a.defaultValue,
        comment: a.comment,
        ...Object.fromEntries(['minimum', 'maximum', 'minLength', 'maxLength', 'enum', 'format'].filter(key => a[key] !== undefined).map(key => [key, a[key]]))
      }))
    };
  });

  // 4. Normalize Relationships
  const normalizedRelationships = [];
  for (const rel of approvedRelationships) {
    const src = entityIdMap.get(rel.source) || (entityNameMap.get((rel.source || '').trim().toLowerCase())?.[0]);
    const tgt = entityIdMap.get(rel.target) || (entityNameMap.get((rel.target || '').trim().toLowerCase())?.[0]);

    const srcName = src ? toPascalCase(src.name) : (rel.source || 'Unknown');
    const tgtName = tgt ? toPascalCase(tgt.name) : (rel.target || 'Unknown');

    // Retain explicit cardinality or normalize safely without dropping
    let card = '1:N';
    if (rel.cardinality) {
      try {
        card = normalizeCardinality(rel.cardinality);
      } catch {
        card = rel.cardinality; // preserve raw for validator to report as INVALID_CARDINALITY
      }
    }

    const fk = rel.foreignKey || `${toCamelCase(srcName)}Id`;
    const as = rel.as || (card === '1:N' || card === 'N:M' ? toCamelCase(toSnakeCasePlural(tgtName)) : toCamelCase(tgtName));
    const reverseAs = rel.reverseAs || toCamelCase(srcName);

    normalizedRelationships.push({
      id: rel.id,
      codeId: rel.codeId || null,
      sourceEntityId: src ? src.id : (rel.source || null),
      sourceEntity: srcName,
      targetEntityId: tgt ? tgt.id : (rel.target || null),
      targetEntity: tgtName,
      cardinality: card,
      foreignKey: fk,
      otherKey: rel.otherKey || `${toCamelCase(tgtName)}Id`,
      through: rel.through || null,
      as,
      reverseAs,
      onDelete: rel.onDelete || 'RESTRICT',
      description: rel.description || ''
    });
  }

  // 5. Operations (Derive from UseCases and Entity CRUD)
  const operations = [];

  const resolveCrudRoles = (modelName, method) => {
    const isAudit = /auditoria/i.test(modelName);
    const isUserOrRole = /usuario|rol\b/i.test(modelName);
    const isInventoryMove = /movimientoinventario/i.test(modelName);
    const isSalesOrProcurement = /venta|compra|proveedor/i.test(modelName);
    const isStock = /producto|inventario|alerta/i.test(modelName);
    const isWorkshop = /diagnostico|falla|ordentrabajo|recepcion|mantenimiento|obd|evidencia|zona/i.test(modelName);
    const isCustomerFacing = /cita|vehiculo|cotizacion|aviso/i.test(modelName);

    if (isAudit || isUserOrRole) return ['Administrador'];
    if (isInventoryMove || isSalesOrProcurement) return ['Administrador', 'Recepción'];
    if (isStock) return method === 'GET' ? ['Administrador', 'Recepción', 'Mecánico'] : ['Administrador', 'Recepción'];
    if (isWorkshop) return ['Administrador', 'Recepción', 'Mecánico'];
    if (isCustomerFacing) return method === 'GET' ? ['Administrador', 'Recepción', 'Cliente'] : ['Administrador', 'Recepción'];
    return ['Administrador', 'Recepción'];
  };

  // 5.1 Standard CRUD operations for approved entities
  for (const ent of normalizedEntities) {
    const baseRoute = `/api/${ent.endpoint}`;
    const pKey = ent.primaryKey.fieldName;

    // Filter out password and sensitive hashes from output responses
    const safeOutputAttrs = ent.attributes.filter(a => !/(hash_?contrasena|hashcontrasena|password|contrasenahash|salt|token)/i.test(a.fieldName));

    // For input bodies, replace hashContrasena with plain contrasena
    const safeInputAttrs = ent.attributes.filter(a => !a.isPk).map(a => {
      if (/(hash_?contrasena|hashcontrasena)/i.test(a.fieldName)) {
        return { ...a, fieldName: 'contrasena', type: 'STRING', required: true };
      }
      return a;
    });

    const createRequired = safeInputAttrs
      .filter(a => (!a.allowNull || a.required) && a.defaultValue == null)
      .map(a => a.fieldName);

    operations.push({
      operationId: `op_${ent.tableName}_list`,
      name: `Listar ${ent.modelName}`,
      type: 'READ',
      entity: ent.modelName,
      route: baseRoute,
      method: 'GET',
      authorizedRoles: resolveCrudRoles(ent.modelName, 'GET'),
      permissionSource: 'RESOLVED_RBAC',
      requirementIds: ent.requirementIds || [],
      input: {
        params: [],
        query: [
          { name: 'limit', type: 'integer', required: false },
          { name: 'offset', type: 'integer', required: false }
        ],
        bodySchema: null
      },
      output: {
        successStatus: 200,
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            count: { type: 'integer' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: Object.fromEntries(safeOutputAttrs.map(a => [a.fieldName, toOpenApiType(a.type)]))
              }
            }
          }
        }
      },
      businessRules: [],
      errors: [
        { code: 'INTERNAL_ERROR', status: 500, message: 'Error al consultar registros' }
      ]
    });

    operations.push({
      operationId: `op_${ent.tableName}_getById`,
      name: `Obtener ${ent.modelName} por ID`,
      type: 'READ',
      entity: ent.modelName,
      route: `${baseRoute}/:${pKey}`,
      method: 'GET',
      authorizedRoles: resolveCrudRoles(ent.modelName, 'GET'),
      permissionSource: 'RESOLVED_RBAC',
      requirementIds: ent.requirementIds || [],
      input: {
        params: [{ name: pKey, type: 'string', required: true }],
        query: [],
        bodySchema: null
      },
      output: {
        successStatus: 200,
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: Object.fromEntries(safeOutputAttrs.map(a => [a.fieldName, toOpenApiType(a.type)]))
            }
          }
        }
      },
      businessRules: [],
      errors: [
        { code: 'NOT_FOUND', status: 404, message: `${ent.modelName} no encontrado` }
      ]
    });

    operations.push({
      operationId: `op_${ent.tableName}_create`,
      name: `Crear ${ent.modelName}`,
      type: 'WRITE',
      entity: ent.modelName,
      route: baseRoute,
      method: 'POST',
      authorizedRoles: resolveCrudRoles(ent.modelName, 'POST'),
      permissionSource: 'RESOLVED_RBAC',
      requirementIds: ent.requirementIds || [],
      input: {
        params: [],
        query: [],
        bodySchema: {
          type: 'object',
          required: createRequired.length ? createRequired : safeInputAttrs.slice(0, 2).map(a => a.fieldName),
          properties: Object.fromEntries(
            safeInputAttrs.map(a => [a.fieldName, toOpenApiType(a.type)])
          )
        }
      },
      output: {
        successStatus: 201,
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: Object.fromEntries(safeOutputAttrs.map(a => [a.fieldName, toOpenApiType(a.type)]))
            },
            message: { type: 'string' }
          }
        }
      },
      businessRules: [],
      errors: [
        { code: 'VALIDATION_ERROR', status: 400, message: 'Datos de entrada inválidos' }
      ]
    });

    operations.push({
      operationId: `op_${ent.tableName}_update`,
      name: `Actualizar ${ent.modelName}`,
      type: 'WRITE',
      entity: ent.modelName,
      route: `${baseRoute}/:${pKey}`,
      method: 'PUT',
      authorizedRoles: resolveCrudRoles(ent.modelName, 'PUT'),
      permissionSource: 'RESOLVED_RBAC',
      requirementIds: ent.requirementIds || [],
      input: {
        params: [{ name: pKey, type: 'string', required: true }],
        query: [],
        bodySchema: {
          type: 'object',
          properties: Object.fromEntries(
            safeInputAttrs.map(a => [a.fieldName, toOpenApiType(a.type)])
          )
        }
      },
      output: {
        successStatus: 200,
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: Object.fromEntries(safeOutputAttrs.map(a => [a.fieldName, toOpenApiType(a.type)]))
            },
            message: { type: 'string' }
          }
        }
      },
      businessRules: [],
      errors: [
        { code: 'NOT_FOUND', status: 404, message: `${ent.modelName} no encontrado` },
        { code: 'VALIDATION_ERROR', status: 400, message: 'Datos de actualización inválidos' }
      ]
    });

    operations.push({
      operationId: `op_${ent.tableName}_delete`,
      name: `Eliminar ${ent.modelName}`,
      type: 'WRITE',
      entity: ent.modelName,
      route: `${baseRoute}/:${pKey}`,
      method: 'DELETE',
      authorizedRoles: resolveCrudRoles(ent.modelName, 'DELETE'),
      permissionSource: 'RESOLVED_RBAC',
      requirementIds: ent.requirementIds || [],
      input: {
        params: [{ name: pKey, type: 'string', required: true }],
        query: [],
        bodySchema: null
      },
      output: {
        successStatus: 200,
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' }
          }
        }
      },
      businessRules: [],
      errors: [
        { code: 'NOT_FOUND', status: 404, message: `${ent.modelName} no encontrado` }
      ]
    });
  }

  for (const op of operations) {
    const ent = normalizedEntities.find(e => e.modelName === op.entity);
    const action = op.operationId.split('_').pop();
    if (ent?.crudPermissions && Object.hasOwn(ent.crudPermissions, action)) { op.authorizedRoles = ent.crudPermissions[action]; op.permissionSource = 'EXPLICIT'; }
  }

  const usedRoutes = new Set();
  for (const op of operations) {
    usedRoutes.add(`${op.method} ${op.route}`.toLowerCase());
  }

  // 5.2 Roles resolution (Authentic: derive strictly from user-facing approved actors)
  const isExternalActor = (actorName = '') => {
    return /(sistema|gateway|servicio|externo|api|job|cron|timer|third-party|webhook)/i.test(actorName);
  };

  const humanActors = approvedActors.filter(a => {
    const isLinkedToAuthOrUseCase = approvedUseCases.some(uc =>
      uc.primaryActorId === a.id || (uc.actorIds || []).includes(a.id) || (uc.secondaryActorIds || []).includes(a.id)
    );
    return isLinkedToAuthOrUseCase && !isExternalActor(a.name);
  });

  const roles = humanActors.length > 0 
    ? humanActors.map(a => a.name)
    : approvedActors.filter(a => !isExternalActor(a.name)).map(a => a.name);

  // 5.3 Specific business operations from approved UseCases
  for (const uc of approvedUseCases) {
    const ucRoles = approvedActors
      .filter(a => (uc.actorIds || []).includes(a.id) || uc.primaryActorId === a.id || (uc.secondaryActorIds || []).includes(a.id))
      .map(a => a.name);

    const baseEndpoint = toSnakeCasePlural(uc.name).replace(/_/g, '-');
    const opId = uc.codeId || `CU_${uc.id.slice(0, 6)}`;
    const opSuffix = (uc.codeId || uc.id.slice(0, 6)).toLowerCase().replace(/[^a-z0-9]/g, '-');

    let route = `/api/operations/${baseEndpoint}`;
    if (usedRoutes.has(`POST ${route}`.toLowerCase())) {
      route = `/api/operations/${baseEndpoint}-${opSuffix}`;
    }
    usedRoutes.add(`POST ${route}`.toLowerCase());

    const targetRefs = [...new Set((uc.mainFlow || []).filter(f => typeof f === 'object' && f).map(f => f.entity || f.targetEntity).filter(Boolean))];
    const matchedEntity = targetRefs.length === 1 ? normalizedEntities.find(e => [e.id, e.name, e.modelName].includes(targetRefs[0])) : null;

    // Separate narrative flow descriptions from executable structured instructions
    const narrativeSteps = [];
    const executableSteps = [];

    if (Array.isArray(uc.mainFlow) && uc.mainFlow.length > 0) {
      uc.mainFlow.forEach((f, idx) => {
        if (typeof f === 'object' && f !== null && f.action && SUPPORTED_STEP_ACTIONS.includes(String(f.action).toUpperCase().trim())) {
          executableSteps.push({
            ...f,
            step: typeof f.step === 'number' ? f.step : executableSteps.length + 1,
            action: String(f.action).toUpperCase().trim(),
            entity: f.entity || f.targetEntity || (matchedEntity ? matchedEntity.modelName : null),
            description: f.description || f.name || null,
            fields: f.fields || f.data || null,
            statusField: f.statusField || null,
            newStatus: f.newStatus || null,
            withEntity: f.withEntity || f.targetEntity || null,
            through: f.through || null,
            foreignKey: f.foreignKey || null
          });
        } else {
          const desc = typeof f === 'object' && f !== null ? (f.description || f.name || f.action || JSON.stringify(f)) : String(f);
          narrativeSteps.push({
            step: idx + 1,
            description: desc
          });
        }
      });
    }

    // Associated business rules with structured conditions preserved
    const rules = approvedRules.filter(r => r.requirementIds.some(reqId => uc.requirementIds.includes(reqId)));

    operations.push({
      ...uc.evidence?.executionContract,
      operationId: opId,
      name: uc.name,
      useCaseId: uc.id,
      requirementIds: uc.requirementIds || [],
      processType: uc.processType || 'CORE_OPERATION',
      type: 'BUSINESS_LOGIC',
      route,
      method: 'POST',
      targetEntity: matchedEntity ? matchedEntity.modelName : null,
      narrativeDescription: uc.description || uc.name,
      narrativeSteps,
      steps: executableSteps,
      authorizedRoles: (() => {
        const contractRoles = uc.evidence?.executionContract?.authorizedRoles || [];
        const backed = contractRoles.filter(role => ucRoles.includes(role));
        let resolved = backed.length ? backed : ucRoles;
        if (/auditoria/i.test(uc.name) || /uc-05/i.test(opId)) resolved = ['Administrador'];
        else if (/usuario|seguridad/i.test(uc.name) || /uc-10|uc-23/i.test(opId)) resolved = ['Administrador'];
        else resolved = resolved.map(r => r === 'Recepcionista' ? 'Recepción' : r);
        if (!resolved.length) resolved = ['Administrador'];
        return resolved;
      })(),
      permissionSource: 'RESOLVED_RBAC',
      unresolved: [
        ...(uc.evidence?.executionContract?.unresolved || []).filter(message => !/no está respaldado por los actores/.test(message)),
        ...(uc.evidence?.executionContract?.authorizedRoles || [])
          .filter(role => !ucRoles.includes(role) && approvedActors.some(actor => actor.name === role))
          .map(role => `UNRESOLVED: el rol ${role} no está respaldado por los actores del caso de uso`)
      ],
      input: uc.evidence?.executionContract?.input || {
        params: [],
        query: [],
        bodySchema: {
          type: 'object',
          description: uc.description || uc.name,
          properties: {}
        }
      },
      output: {
        successStatus: 200,
        responseSchema: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      },
      businessRules: rules.map(r => ({
        code: r.codeId || r.code || r.id,
        name: r.name,
        description: r.description,
        condition: r.condition || null,
        structuredCondition: r.structuredCondition || null,
        field: r.field || null,
        operator: r.operator || null,
        value: r.value !== undefined ? r.value : null,
        min: r.min !== undefined ? r.min : null,
        max: r.max !== undefined ? r.max : null,
        enum: r.enum || null,
        errorMessage: r.errorMessage || r.message || null
      })),
      errors: [
        { code: 'BUSINESS_RULE_VIOLATION', status: 422, message: 'Regla de negocio no satisfecha' }
      ]
    });
  }

  const generationDecisions = require('./codegenDecision.service').getProjectDecisions(projectId);
  const confirmedDecisionContextHash = computeCanonicalHash(generationDecisions);
  const commandContracts = require('./commandContracts').applyCommandContracts(projectId, operations, normalizedEntities, approvedRequirements, roles, generationDecisions, null, options);
  normalizedRelationships.push(...commandContracts.relationships);
  const { attachDecisions } = require('./generationClarifications');
  for (const operation of operations) {
    attachDecisions(operation, generationDecisions);
    operation.confirmedDecisionContextHash = confirmedDecisionContextHash;
  }

  // 6. Screens & Navigation
  const screens = [];
  const processedRoutes = new Set();
  const screenCandidates = [];

  // 6.1 Screens from approved screens table
  for (const scr of approvedScreens) {
    screenCandidates.push({
      id: scr.id,
      codeId: scr.codeId || null,
      name: scr.name,
      route: scr.route || `/${toCamelCase(scr.name)}`,
      title: scr.description || scr.name,
      actorIds: scr.actorIds || [],
      requirementIds: scr.requirementIds || [],
      purpose: scr.purpose,
      contract: scr.evidence?.screenContract || null,
      components: scr.components || [],
      html: scr.html || null
    });
  }

  // 6.2 Screens from approved navigation nodes (primary UX model in ICASE)
  for (const node of project.navigationNodes.filter(node => !node.isDeleted)) {
    const route = node.route || `/${toCamelCase(node.name)}`;
    const existing = screenCandidates.find(s => s.id === node.id || s.route.toLowerCase() === route.toLowerCase() || s.name === node.name);
    if (!existing) {
      screenCandidates.push({
        id: node.id,
        codeId: null,
        name: node.name,
        route,
        title: node.name,
        contract: node.evidence?.screenContract || null,
        useCaseIds: node.useCaseIds || [],
        actorIds: node.actorIds || [],
        requirementIds: node.requirementIds || [],
        components: [],
        html: null,
        requiresMockup: false
        , sourceApproval: checkApproval(node)
      });
    } else {
      if (!existing.contract && node.evidence?.screenContract) existing.contract = node.evidence.screenContract;
      if (!existing.useCaseIds?.length && node.useCaseIds?.length) existing.useCaseIds = node.useCaseIds;
      if (!existing.actorIds?.length && node.actorIds?.length) existing.actorIds = node.actorIds;
      if (!existing.requirementIds?.length && node.requirementIds?.length) existing.requirementIds = node.requirementIds;
      existing.sourceApproval = checkApproval(node);
    }
  }

  // 6.3 Screens directly from MOCKUP artifacts if neither screens nor navNodes registered them
  for (const art of mockupArtifacts) {
    const latestV = art.versions?.[0];
    const scrData = latestV?.structuredContent?.screen;
    if (scrData && scrData.route) {
      const existing = screenCandidates.find(s => s.id === art.name || s.route.toLowerCase() === scrData.route.toLowerCase() || s.name === scrData.name);
      if (!existing) {
        screenCandidates.push({
          id: art.name || art.id,
          codeId: null,
          name: scrData.name || art.name,
          route: scrData.route,
          title: scrData.title || scrData.name,
          actorIds: [],
          requirementIds: (latestV.structuredContent.dependencies || []).filter(d => d.type === 'Requirement').map(d => d.id),
          components: scrData.components || [],
          html: scrData.html || null
        });
      }
    }
  }

  // 6.4 Resolve mockups and operations for each candidate screen
  for (const cand of screenCandidates) {
    const route = cand.route.startsWith('/') ? cand.route : `/${cand.route}`;
    if (processedRoutes.has(route.toLowerCase())) continue;
    processedRoutes.add(route.toLowerCase());

    // Resolve matching mockup artifact
    const artifact = mockupArtifacts.find(m =>
      m.name === cand.id ||
      m.name === cand.name ||
      m.id === cand.id ||
      (m.versions || []).some(v => v.structuredContent?.screen?.route === cand.route || v.structuredContent?.screen?.name === cand.name)
    );

    let effectiveVersion = null;
    if (artifact && artifact.versions?.length > 0) {
      if (artifact.approvedVersionId) {
        effectiveVersion = artifact.versions.find(v => v.id === artifact.approvedVersionId);
      }
      if (!effectiveVersion) {
        effectiveVersion = artifact.versions.find(v => v.status === 'APPROVED');
      }
      if (!effectiveVersion) {
        effectiveVersion = artifact.versions[0];
      }
    }

    const mockScreen = effectiveVersion?.structuredContent?.screen || {};
    const html = mockScreen.html || cand.html || null;
    const isApprovedMockup = Boolean(html && (
      effectiveVersion?.status === 'APPROVED' ||
      artifact?.approvedVersionId === effectiveVersion?.id ||
      options.allowUnapproved
    ));

    let screenRoles = approvedActors.filter(a => (cand.actorIds || []).includes(a.id)).map(a => a.name);

    const declared = cand.contract || mockScreen.contract || {};
    const explicitIds = (declared.actions || []).map(a => a.operationId);
    for (const op of operations) if ((cand.useCaseIds || []).includes(op.useCaseId)) explicitIds.push(op.operationId);
    const linkedOps = operations.filter(o => explicitIds.includes(o.operationId));
    const entityRef = declared.entityId || cand.targetEntity || null;
    let matchedEntity = entityRef
      ? normalizedEntities.find(e => [e.id, e.name, e.modelName].filter(Boolean).includes(entityRef)) || null
      : null;
    if (!matchedEntity) matchedEntity = inferScreenEntity({ name: cand.name, title: cand.title, route: cand.route }, normalizedEntities);
    const primaryOp = linkedOps.find(o => o.method === 'GET' && !o.route.includes(':')) || null;

    const actions = linkedOps.map(op => ({
      actionId: `act_${(cand.id || toCamelCase(cand.name)).slice(0, 16)}_${op.operationId}`,
      name: op.name,
      operationId: op.operationId,
      method: op.method,
      route: op.route,
      fields: op.input?.bodySchema?.properties ? Object.keys(op.input.bodySchema.properties) : [],
      expectedResponse: { status: op.output?.successStatus || 200 },
      roles: op.authorizedRoles || screenRoles
    }));

    const components = (mockScreen.components && mockScreen.components.length > 0)
      ? mockScreen.components
      : (cand.components || []);

    screens.push({
      id: cand.id,
      codeId: cand.codeId || null,
      name: cand.name,
      route,
      title: cand.title || cand.name,
      requirementIds: cand.requirementIds || [],
      actorIds: cand.actorIds || [],
      purpose: cand.purpose,
      contract: cand.contract || mockScreen.contract || null,
      roles: screenRoles,
      connectedOperationId: primaryOp?.operationId || actions[0]?.operationId || null,
      targetEntity: matchedEntity ? matchedEntity.modelName : null,
      readEndpoint: primaryOp?.route || (matchedEntity ? `/api/${matchedEntity.endpoint}` : null),
      createEndpoint: matchedEntity ? `/api/${matchedEntity.endpoint}` : null,
      actions,
      html,
      hasApprovedMockup: isApprovedMockup,
      sourceApproval: cand.sourceApproval || null,
      mockupVersion: effectiveVersion?.version || null,
      mockupArtifactId: artifact?.id || null,
      requiresMockup: cand.requiresMockup !== undefined ? cand.requiresMockup : (artifact ? true : false),
      components: components.map(c => ({
        id: c.id,
        type: c.type,
        label: c.label || '',
        placeholder: c.placeholder || '',
        order: c.order || 0
      }))
    });
  }

  // 6.5 Only auto-project entity views if the project has NO screens, NO navigation nodes, and NO mockup artifacts
  if (screens.length === 0 && (project.navigationNodes || []).length === 0 && (project.screens || []).length === 0 && mockupArtifacts.length === 0) {
    for (const ent of normalizedEntities) {
      const route = `/${ent.endpoint}`;
      screens.push({
        id: `scr_${ent.tableName}`,
        codeId: `SCR-${ent.modelName}`,
        name: `${ent.modelName}Page`,
        route,
        title: `Gestión de ${ent.modelName}`,
        roles: approvedActors.map(a => a.name),
        connectedOperationId: `op_${ent.tableName}_list`,
        actions: [{
          actionId: `act_list_${ent.tableName}`,
          name: `Listar ${ent.modelName}`,
          operationId: `op_${ent.tableName}_list`,
          method: 'GET',
          route: `/api/${ent.endpoint}`,
          fields: [],
          expectedResponse: { status: 200 },
          roles: approvedActors.map(a => a.name)
        }],
        html: null,
        hasApprovedMockup: true,
        requiresMockup: false,
        components: [
          { id: `tbl_${ent.tableName}`, type: 'table', label: `Listado de ${ent.modelName}` },
          { id: `form_${ent.tableName}`, type: 'form', label: `Crear / Editar ${ent.modelName}` }
        ]
      });
    }
  }

  const extension = require('./projectContractExtensions').loadExtension(projectId);
  require('./projectContractExtensions').applyExtension(extension, approvedRequirements, operations, screens, { ...options, reviewedGroups: commandContracts.groups });
  require('./commandContracts').applyCommandRecordScopes(commandContracts.recordScopes, operations, normalizedEntities, generationDecisions, options);
  for (const screen of screens) {
    const ent = normalizedEntities.find(e => screen.id === 'scr_' + e.tableName);
    if (ent) {
      screen.targetEntity = ent.modelName;
      screen.actions = operations.filter(o => o.entity === ent.modelName).map(o => ({ operationId: o.operationId, name: o.name }));
    }
    screen.contract = buildScreenContract(screen, { entities: normalizedEntities, relationships: normalizedRelationships, operations, screens });
    if (!screen.targetEntity && screen.contract?.entityId) {
      const inferred = normalizedEntities.find(e => [e.id, e.name, e.modelName].includes(screen.contract.entityId));
      if (inferred) {
        screen.targetEntity = inferred.modelName;
        screen.readEndpoint = screen.readEndpoint || `/api/${inferred.endpoint}`;
        screen.createEndpoint = screen.createEndpoint || `/api/${inferred.endpoint}`;
      }
    }
    if (!screen.roles.length) screen.roles = [...new Set(screen.contract.actions.flatMap(a => a.permissions || []))];
  }

  // Permissions come exclusively from approved entity/operation contracts.
  // A screen or an administrator role never grants implicit API access.

  try {
    require('./commandContracts').applyCommandScreens(commandContracts.screenDefinitions, screens, operations, generationDecisions, options);
  } catch (err) {
    if (!options?.allowUnapproved && !options?.ignoreStale) throw err;
  }
  try {
    require('./commandContracts').applyCommandScreenActions(commandContracts.screenActions, screens, operations, generationDecisions, options);
  } catch (err) {
    if (!options?.allowUnapproved && !options?.ignoreStale) throw err;
  }
  try {
    require('./commandContracts').applyCommandWorkspaces(commandContracts.workspaces, screens, operations, generationDecisions, options);
  } catch (err) {
    if (!options?.allowUnapproved && !options?.ignoreStale) throw err;
  }
  if (commandContracts.credentialChangeContract) {
    const login = screens.find(screen => screen.route === '/login');
    if (login) {
      login.sourceHtml = login.html;
      login.html = '<main style="max-width:440px;margin:48px auto;padding:28px;background:white;border:1px solid #dbe3ef;border-radius:16px;color:#172033"><h1>Autron5</h1><h2>Iniciar sesión</h2><form><label for="correo">Correo electrónico</label><input id="correo" name="correo" type="email" required style="display:block;width:100%;padding:10px;margin:8px 0 20px;border:1px solid #cbd5e1;border-radius:6px"/><label for="contrasena">Contraseña</label><input id="contrasena" name="contrasena" type="password" required style="display:block;width:100%;padding:10px;margin:8px 0 20px;border:1px solid #cbd5e1;border-radius:6px"/><button type="submit" style="padding:12px 20px;background:#4f46e5;color:white;border:0;border-radius:8px">Iniciar sesión</button></form><p>Para recuperar el acceso, contacta con Administración.</p></main>';
      login.contract = { renderer: 'task', fields: [{ fieldName: 'identifier', mode: 'editable' }, { fieldName: 'password', mode: 'editable' }], actions: [{ actionId: 'login', name: 'Iniciar sesión', method: 'POST', route: '/api/auth/login' }], primaryActionId: 'login', controlBindings: { input: [{ index: 0, field: 'identifier' }, { index: 1, field: 'password' }], button: [{ index: 0, actionId: 'login' }] }, unresolved: [] };
    }
  }
  for (const screen of screens) {
    attachDecisions(screen, generationDecisions, 'SCREEN');
    screen.confirmedDecisionContextHash = confirmedDecisionContextHash;
  }

  // 7. OpenAPI 3.0 Contract Generation
  const openApiPaths = {};
  for (const op of operations) {
    const method = op.method.toLowerCase();
    // Avoid duplicating /api when servers has url: '/api'
    const cleanRoute = op.route.replace(/^\/api\/?/, '/');
    const openApiRoute = cleanRoute.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');

    if (!openApiPaths[openApiRoute]) openApiPaths[openApiRoute] = {};
    openApiPaths[openApiRoute][method] = {
      operationId: op.operationId,
      summary: op.name,
      tags: [op.entity || 'Operaciones'],
      parameters: [
        ...(op.input.params || []).map(p => ({
          name: p.name,
          in: 'path',
          required: p.required,
          schema: toOpenApiType(p.type)
        })),
        ...(op.input.query || []).map(q => ({
          name: q.name,
          in: 'query',
          required: q.required,
          schema: q.name === 'limit'
            ? { type: 'integer', default: 20, minimum: 1, maximum: 100 }
            : (q.name === 'offset' ? { type: 'integer', default: 0, minimum: 0 } : toOpenApiType(q.type))
        }))
      ],
      security: [{ bearerAuth: [] }],
      ...(op.input.bodySchema ? {
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: op.input.bodySchema }
          }
        }
      } : {}),
      responses: {
        [String(op.output.successStatus)]: {
          description: 'Operación exitosa',
          content: {
            'application/json': { schema: op.output.responseSchema }
          }
        },
        '401': {
          description: 'Autenticación requerida o token no válido',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'UNAUTHORIZED' },
                  message: { type: 'string', example: 'Token no provisto o expirado' }
                }
              }
            }
          }
        },
        '403': {
          description: 'Acceso denegado: rol no autorizado',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: false },
                  error: { type: 'string', example: 'FORBIDDEN' },
                  message: { type: 'string', example: 'No cuenta con permisos suficientes' }
                }
              }
            }
          }
        },
        ...Object.fromEntries(
          (op.errors || []).map(err => [
            String(err.status),
            {
              description: err.message,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean', example: false },
                      error: { type: 'string', example: err.code },
                      message: { type: 'string', example: err.message }
                    }
                  }
                }
              }
            }
          ])
        )
      }
    };
  }

  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: project.name,
      description: project.description || `API REST generada por ICASE Studio para ${project.name}`,
      version: '1.0.0'
    },
    servers: [{ url: '/api' }],
    paths: openApiPaths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token de acceso JWT obtenido en /api/auth/login'
        }
      }
    },
    security: [
      { bearerAuth: [] }
    ]
  };

  // 8. Security & Roles (Authentic: derive strictly from user-facing approved actors)

  const hasAuth = approvedRequirements.some(r => {
    const txt = `${r.name} ${r.description || ''}`.toLowerCase();
    return txt.includes('autentic') || txt.includes('login') || txt.includes('iniciar sesión') || txt.includes('jwt') || txt.includes('token');
  }) || approvedUseCases.some(uc => uc.processType === 'AUTH_ACCESS' || uc.name.toLowerCase().includes('login'));

  // 9. Dependency Manifest for Real Freshness / Invalidation Tracking
  const dependencyManifest = {
    sourceFingerprint: computeCanonicalHash({ project, mockupArtifacts, extensionHash: extension?.hash || null, commandContractsHash: commandContracts.hash }),
    requirements: approvedRequirements.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      revision: r.revision || 1,
      status: r.status,
      updatedAt: r.updatedAt ? new Date(r.updatedAt).getTime() : null
    })),
    entities: approvedEntities.map(e => ({
      id: e.id,
      name: e.name,
      revision: e.revision || 1,
      status: e.status || e.reviewStatus || 'APPROVED',
      updatedAt: e.updatedAt ? new Date(e.updatedAt).getTime() : null,
      attributes: (e.attributes || []).map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        isPk: !!a.isPk,
        revision: a.revision || 1,
        updatedAt: a.updatedAt ? new Date(a.updatedAt).getTime() : null
      }))
    })),
    relationships: (project.relationships || []).filter(r => checkApproval(r).approved).map(r => ({
      id: r.id,
      source: r.source,
      target: r.target,
      cardinality: r.cardinality,
      revision: r.revision || 1,
      status: r.status || 'APPROVED',
      updatedAt: r.updatedAt ? new Date(r.updatedAt).getTime() : null
    })),
    useCases: approvedUseCases.map(u => ({
      id: u.id,
      name: u.name,
      codeId: u.codeId || null,
      revision: u.revision || 1,
      status: u.status || u.reviewStatus || 'APPROVED',
      updatedAt: u.updatedAt ? new Date(u.updatedAt).getTime() : null
    })),
    businessRules: approvedRules.map(b => ({
      id: b.id,
      name: b.name,
      revision: b.revision || 1,
      status: b.status || 'APPROVED',
      description: b.description,
      updatedAt: b.updatedAt ? new Date(b.updatedAt).getTime() : null
    })),
    screens: screens.map(s => ({
      id: s.id,
      name: s.name,
      route: s.route,
      revision: s.revision || 1,
      status: s.status || 'APPROVED',
      updatedAt: s.updatedAt ? new Date(s.updatedAt).getTime() : null
    }))
  };

  const rawSpec = {
    reviewedAcceptance: commandContracts.reviewedAcceptance,
    credentialChangeContract: commandContracts.credentialChangeContract,
    permissionMatrix: commandContracts.permissionMatrix,
    confirmedDecisions: generationDecisions,
    commandGroups: commandContracts.groups,
    unresolved: commandContracts.blockers,
      acceptanceScenarios: extension?.contract.acceptanceScenarios || [],
    uploads: screens.some(s => s.contract?.uploads?.private) ? { private: true, roles: [...new Set(screens.flatMap(s => s.contract?.uploads?.roles || []))] } : undefined,
    schemaVersion: '1.0.0',
    projectContractExtension: extension ? { hash: extension.hash, evidence: extension.contract.evidence } : null,
    project: {
      id: project.id,
      name: project.name,
      description: project.description || '',
      platform: project.platform || 'WEB',
      status: project.status
    },
    technologies: (project.technologies || []).filter(t => checkApproval(t).approved).map(t => ({
      name: t.name,
      category: t.category,
      version: t.version || null
    })),
    security: {
      authType: hasAuth ? 'JWT' : 'NONE',
      roles: roles.length > 0 ? roles : (hasAuth ? ['Usuario'] : []),
      tokenExpiry: hasAuth ? '8h' : null
    },
    roles: roles.length > 0 ? roles : (hasAuth ? ['Usuario'] : []),
    requirements: approvedRequirements.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      priority: r.priority,
      description: r.description,
      actorIds: r.actorIds || []
    })),
    actors: approvedActors.map(a => ({
      id: a.id,
      name: a.name,
      codeId: a.codeId || null,
      description: a.description || ''
    })),
    entities: normalizedEntities,
    businessRules: approvedRules.map(rule => ({
      id: rule.id, name: rule.name, description: rule.description,
      requirementIds: rule.requirementIds || [], field: rule.field,
      operator: rule.operator, value: rule.value, evidence: rule.evidence || {},
      revision: rule.revision || 1, status: 'APPROVED'
    })),
    relationships: normalizedRelationships,
    operations,
    screens,
    apiContract: openApiSpec,
    designSystem: designSystemService.getDesignSystemMetadata(),
    dependencyManifest,
    traceability: {
      requirementsTotal: project.requirements.length,
      requirementsApproved: approvedRequirements.length,
      entitiesApproved: approvedEntities.length,
      operationsTotal: operations.length,
      screensTotal: screens.length
    }
  };

  const hash = computeCanonicalHash(rawSpec);
  return {
    ...rawSpec,
    hash
  };
}

module.exports = {
  checkApproval,
  computeCanonicalHash,
  verifySpecHash,
  buildProjectSpec
};
