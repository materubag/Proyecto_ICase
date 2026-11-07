const { normalizeAttributes, deriveNaming, toCamelCase } = require('./typeMapper');

const tokenNorm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const matches = (ref, e) => [e.id, e.name, e.modelName].filter(Boolean).includes(ref);

function isPasswordField(name = '') {
  return /^(passwordHash|password_hash|password|contrasena|contraseña|clave)$/i.test(String(name));
}

function pickLabelAttr(attrs) {
  return attrs.find(f => !f.isPk && /nombre|name|titulo|title|descripcion|description|placa|codigo|code/i.test(f.fieldName))
    || attrs.find(f => !f.isPk && /STRING|TEXT/.test(f.dataType || f.type || ''));
}

function relationFromTarget(target) {
  if (!target) return null;
  const targetAttrs = normalizeAttributes(target.attributes || []);
  const pk = targetAttrs.find(f => f.isPk);
  const label = pickLabelAttr(targetAttrs);
  const endpoint = `/api/${target.endpoint || deriveNaming(target.name).endpoint}`;
  const sourceName = target.endpoint || deriveNaming(target.name).endpoint;
  return {
    entityId: target.id || target.modelName,
    endpoint,
    dataSource: sourceName,
    valueField: pk?.fieldName || target.primaryKey?.fieldName || 'id',
    labelField: label?.fieldName || pk?.fieldName || 'id'
  };
}

function inferTargetFromFieldName(fieldName, entities = []) {
  if (!fieldName || fieldName === 'id' || !/Id$/i.test(fieldName)) return null;
  const base = tokenNorm(fieldName.replace(/Id$/i, ''));
  if (base.length < 2) return null;
  return entities.find(e => {
    const names = [e.modelName, e.name, deriveNaming(e.name).modelName, deriveNaming(e.name).paramName];
    return names.some(n => tokenNorm(n) === base);
  }) || null;
}

function buildFieldContract(entity, relationships = [], entities = []) {
  if (!entity) return [];
  return normalizeAttributes(entity.attributes || []).map(a => {
    const rel = relationships.find(r => toCamelCase(r.foreignKey || '') === a.fieldName && (
      (['N:1', '1:1'].includes(r.cardinality) && matches(r.sourceEntityId || r.sourceEntity || r.source, entity)) ||
      (r.cardinality === '1:N' && matches(r.targetEntityId || r.targetEntity || r.target, entity))));
    const ref = rel && (rel.cardinality === '1:N' ? rel.sourceEntityId || rel.sourceEntity || rel.source : rel.targetEntityId || rel.targetEntity || rel.target);
    const endpointRef = rel && (rel.cardinality === '1:N' ? rel.sourceEntity || rel.source : rel.targetEntity || rel.target) || ref;
    let target = entities.find(e => matches(ref, e));
    if (!target) target = inferTargetFromFieldName(a.fieldName, entities);
    const relation = relationFromTarget(target);
    if (relation && endpointRef && !target) {
      relation.endpoint = `/api/${deriveNaming(endpointRef).endpoint}`;
      relation.dataSource = deriveNaming(endpointRef).endpoint;
    }
    const isIdField = a.isPk || a.autoIncrement || a.fieldName === 'id';
    const secret = isPasswordField(a.fieldName);
    return {
      ...a,
      label: secret ? 'Contraseña' : (target?.name || a.originalName || a.fieldName.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/Id$/, '')),
      mode: isIdField || ['NOW', 'UUIDV4'].includes(a.defaultValue) ? 'automatic' : a.readOnly ? 'readonly' : 'editable',
      required: secret ? true : (!a.allowNull && a.defaultValue == null && !a.isPk),
      control: secret ? 'password' : undefined,
      list: secret ? false : undefined,
      relation
    };
  });
}

function listOperationFor(entity, operations = []) {
  if (!entity) return null;
  const endpoint = `/api/${entity.endpoint || deriveNaming(entity.name).endpoint}`;
  const names = [entity.modelName, entity.name].filter(Boolean);
  return operations.find(o => o.method === 'GET' && !String(o.route).includes(':') && (
    names.includes(o.entity) || o.route === endpoint || o.route === endpoint + '/'
  )) || null;
}

function compactNavLabel(title) {
  const raw = String(title || '').replace(/\s*[-–]\s*Autron5\s*$/i, '').replace(/^Portal Cliente:\s*/i, '').trim();
  if (/diagn[oó]stico/i.test(raw)) return 'Diagnóstico';
  if (/orden/i.test(raw) && /bit[aá]cora|trabajo/i.test(raw)) return 'Órdenes y Bitácora';
  if (/conocimiento/i.test(raw)) return 'Conocimiento';
  if (/recepci[oó]n/i.test(raw)) return 'Recepción';
  if (/cita/i.test(raw)) return 'Citas';
  if (/veh[ií]culo/i.test(raw)) return 'Vehículos';
  if (/mostrador|venta directa/i.test(raw)) return 'Venta Directa Mostrador';
  if (/inventario|repuesto/i.test(raw) && /stock|alerta|inventario/i.test(raw)) return 'Repuestos';
  if (/proveedor/i.test(raw)) return 'Proveedores';
  if (/servicio|tarifa/i.test(raw)) return 'Servicios';
  if (/usuario|auditor/i.test(raw)) return 'Usuarios';
  if (/tablero|reporte|indicador/i.test(raw)) return 'Reportes';
  if (/presupuesto|cotiz/i.test(raw)) return 'Presupuestos';
  if (/avance|progreso|seguimiento/i.test(raw)) return 'Seguimiento';
  if (/directorio|ficha/i.test(raw) && /cliente/i.test(raw)) return 'Clientes';
  return raw;
}

function isAuthScreen(screen = {}) {
  const text = tokenNorm((screen.name || '') + ' ' + (screen.title || '') + ' ' + (screen.route || '') + ' ' + (screen.key || ''));
  return /login|iniciodesesion|accesoalsistema|^auth$/.test(text);
}

function inferScreenEntity(screen, entities = []) {
  const text = tokenNorm((screen.name || '') + ' ' + (screen.title || '') + ' ' + (screen.route || ''));
  if (!text || isAuthScreen(screen) || !entities.length) return null;
  const ranked = entities.map(entity => {
    const names = [entity.modelName, entity.name, entity.tableName, entity.endpoint].filter(Boolean).map(tokenNorm);
    let score = 0;
    for (const name of names) {
      if (!name || name.length < 3) continue;
      if (text === name) score += 10;
      else if (text.includes(name)) score += 6;
    }
    return { entity, score };
  }).filter(item => item.score >= 5).sort((a, b) => b.score - a.score);
  return ranked[0]?.entity || null;
}

function inferScreenRoles(screen, actors = []) {
  return actors.filter(actor => (screen.actorIds || []).includes(actor.id)).map(actor => actor.name);
}

function screenTabKey(screen) {
  const raw = String(screen.route || screen.name || screen.id || 'screen').replace(/^\//, '');
  return toCamelCase(raw.replace(/[^a-zA-Z0-9]+/g, ' ')) || 'screen';
}

function belongsToEntity(op, entity) {
  if (!op || !entity) return false;
  const names = [entity.modelName, entity.name].filter(Boolean);
  return names.includes(op.entity) || names.includes(op.targetEntity);
}

function isLiveFormField(field) {
  if (!field || field.mode !== 'editable' || field.isPk || field.control === 'hidden') return false;
  const name = field.fieldName || '';
  if (!name || name === 'id') return false;
  if (/Id$/i.test(name) && !field.relation && !field.options) return false;
  return true;
}

function buildScreenContract(screen, spec) {
  const declared = screen.contract || {};
  const requested = declared.actions || screen.actions || [];
  let actions = requested.map(a => {
    const op = spec.operations.find(o => o.operationId === a.operationId);
    return op ? { ...a, operationId: op.operationId, method: op.method, route: op.route,
      parameters: op.input, permissions: op.authorizedRoles || [], roles: op.authorizedRoles || [] } : { ...a, unresolved: 'UNRESOLVED_OPERATION' };
  });
  const entityRef = declared.entityId || screen.targetEntity || screen.entity || null;
  const entity = (entityRef
    ? spec.entities.find(e => [e.id, e.name, e.modelName].filter(Boolean).includes(entityRef))
    : null) || inferScreenEntity(screen, spec.entities || []);
  const declaredFields = declared.fields || [];
  const baseFields = entity ? buildFieldContract(entity, spec.relationships, spec.entities)
    : buildFieldContract({ attributes: declaredFields }, spec.relationships, spec.entities).filter(f => declaredFields.some(d => (d.fieldName || d.name) === f.fieldName));
  const fields = baseFields.map(f => {
    const override = declaredFields.find(d => (d.fieldName || d.name) === f.fieldName) || {};
    const merged = { ...f, ...override, mode: f.isPk || f.fieldName === 'id' ? 'automatic' : override.mode || f.mode };
    if (f.relation && override.relation !== null) {
      merged.relation = { ...f.relation, ...(override.relation || {}) };
    }
    return merged;
  });
  for (const extra of declaredFields) {
    if (!fields.some(f => f.fieldName === extra.fieldName)) fields.push(extra);
  }
  if (declaredFields.length) fields.sort((a, b) => declaredFields.findIndex(f => f.fieldName === a.fieldName) - declaredFields.findIndex(f => f.fieldName === b.fieldName));

  const listOp = listOperationFor(entity, spec.operations);
  if (listOp && !(declared.actions || []).length && !actions.some(a => a.operationId === listOp.operationId)) {
    actions = [{ actionId: 'consultar', name: 'Consultar ' + (entity.name || entity.modelName), operationId: listOp.operationId, method: 'GET', route: listOp.route, permissions: listOp.authorizedRoles || [], roles: listOp.authorizedRoles || [] }, ...actions];
  }
  const writeOp = actions.find(a => a.actionId === declared.primaryActionId)
    || actions.find(a => a.method === 'POST');
  if (writeOp && !actions.some(a => a.operationId === writeOp.operationId || a.actionId === writeOp.actionId)) {
    actions.push({ actionId: 'confirmar', name: writeOp.name || ('Guardar ' + (entity?.name || '')), operationId: writeOp.operationId, method: writeOp.method || 'POST', route: writeOp.route, permissions: writeOp.authorizedRoles || [], roles: writeOp.authorizedRoles || [] });
  }

  const sourcesByName = new Map();
  const addSource = (name, route, operationId) => {
    if (!name || !route || sourcesByName.has(name)) return;
    sourcesByName.set(name, { name, route, operationId: operationId || null });
  };
  for (const source of declared.dataSources || []) addSource(source.name, source.route, source.operationId);
  for (const action of actions.filter(a => a.method === 'GET' && a.route)) {
    const name = action.route.replace(/^\/api\//, '').replace(/^\//, '');
    addSource(name, action.route, action.operationId);
  }
  if (entity && !Object.hasOwn(declared, 'dataSources')) {
    const naming = deriveNaming(entity.name);
    const route = `/api/${entity.endpoint || naming.endpoint}`;
    addSource(entity.endpoint || naming.endpoint, route, listOp?.operationId);
  }
  for (const field of fields) {
    if (field.mode === 'editable' && field.relation?.endpoint) {
      const name = field.relation.dataSource || field.relation.endpoint.replace(/^\/api\//, '');
      field.relation.dataSource = name;
      addSource(name, field.relation.endpoint);
    }
  }

  const listSource = Object.hasOwn(declared, 'listSource') ? declared.listSource : (entity ? (entity.endpoint || deriveNaming(entity.name).endpoint) : [...sourcesByName.keys()][0]) || null;
  const editable = fields.filter(f => f.mode === 'editable' && !isPasswordField(f.fieldName) && f.list !== false);
  const columns = (declared.columns || editable.slice(0, 6).map(f => ({ field: f.fieldName, label: f.label || f.fieldName, relation: f.relation || null })))
    .filter(col => !isPasswordField(col.field));
  const confirmAction = actions.find(a => a.actionId === 'confirmar') || actions.find(a => a.method === 'POST');
  const unresolved = [...(declared.unresolved || [])];
  if (!isAuthScreen(screen) && fields.some(f => f.mode === 'editable') && !writeOp) {
    unresolved.push('UNRESOLVED: ¿Qué operación aprobada ejecuta el formulario? Sin esa decisión se bloquea el envío; no se sustituye por CRUD.');
  }
  if (isAuthScreen(screen)) {
    if (!actions.length) {
      actions = [{
        actionId: 'iniciar-sesion',
        name: 'Iniciar sesión',
        operationId: 'auth_login',
        method: 'POST',
        route: '/api/auth/login',
        permissions: [],
        roles: []
      }];
    }
    unresolved.length = 0;
  } else if (!actions.length) {
    unresolved.push('UNRESOLVED: definir operaciones explícitas para la pantalla');
  }
  for (const a of actions) if (a.unresolved) unresolved.push(`UNRESOLVED: operación ${a.operationId}`);
  for (const f of fields) if (f.relation && (!f.relation.endpoint || !f.relation.valueField || !f.relation.labelField)) unresolved.push(`UNRESOLVED: selector ${f.fieldName} requiere entidad, PK y etiqueta`);

  const screens = spec.screens || [];
  const withNavKey = item => ({ ...item, key: item.key || screenTabKey({ route: item.route, name: item.label }) });
  const navigation = ((declared.navigation || []).length ? declared.navigation : screens.filter(s => s.id !== screen.id && s.route && s.route !== screen.route).slice(0, 4).map(s => ({
    label: 'Continuar a ' + (s.title || s.name),
    route: s.route,
    key: screenTabKey(s)
  }))).map(withNavKey);

  return {
    ...declared,
    version: 1,
    renderer: declared.renderer || 'task',
    requirementIds: declared.requirementIds || screen.requirementIds || [],
    actorIds: declared.actorIds || screen.actorIds || [],
    purpose: declared.purpose || screen.purpose || screen.title || screen.name,
    entityId: entity?.id || declared.entityId || null,
    dataSources: [...sourcesByName.values()],
    listSource,
    listTitle: declared.listTitle || ((entity?.name || entity?.modelName || 'Registros') + ' registrados'),
    valueField: declared.valueField || 'id',
    columns,
    primaryActionId: declared.primaryActionId || confirmAction?.actionId || 'confirmar',
    navigation,
    fields,
    validations: fields.map(f => ({ field: f.fieldName, required: f.required, type: f.dataType })),
    actions,
    states: declared.states || { loading: 'Cargando', empty: 'Sin registros', error: 'No se pudo completar la operación', confirmation: 'Operación completada' },
    unresolved
  };
}

function renderFields(fields, options = {}) {
  const lookup = options.lookup || (f => 'relationOptions[' + JSON.stringify(f.fieldName) + ']');
  return fields.filter(isLiveFormField).map(f => {
    const key = JSON.stringify(f.fieldName), label = JSON.stringify(f.label || f.originalName || f.fieldName);
    const props = 'id={' + key + '} name={' + key + '} required={' + Boolean(f.required) + '}';
    const value = 'formData[' + key + ']';
    const change = 'onChange={e => setFormData(prev => ({ ...prev, [' + key + ']: e.target.';
    let input;
    if (f.control === 'password' || isPasswordField(f.fieldName)) {
      const requiredExpr = options.editingFlag ? '{!' + options.editingFlag + '}' : '{' + Boolean(f.required) + '}';
      input = '<input type="password" autoComplete="new-password" ' + props.replace(/required=\{Boolean\([^)]+\)\}/, 'required=' + requiredExpr) + ' value={' + value + ' ?? ""} placeholder="Contraseña" ' + change + 'value }))} />';
    } else if (f.relation) {
      const r = f.relation;
      input = '<select ' + props + ' value={' + value + ' ?? ""} ' + change + 'value }))}><option value="">Seleccionar</option>{(' + lookup(f) + ' || []).map(opt => <option key={opt[' + JSON.stringify(r.valueField) + ']} value={opt[' + JSON.stringify(r.valueField) + ']}>{opt[' + JSON.stringify(r.labelField) + '] ?? "Etiqueta pendiente"}</option>)}</select>';
    } else {
      const type = /BOOLEAN/.test(f.dataType) ? 'checkbox' : /INTEGER|DECIMAL|FLOAT|BIGINT|DOUBLE/.test(f.dataType) ? 'number' : /DATEONLY/.test(f.dataType) ? 'date' : /DATE/.test(f.dataType) ? 'datetime-local' : 'text';
      input = '<input type="' + type + '" ' + props + (type === 'number' ? ' step="any"' : '') + (type === 'checkbox' ? ' checked={Boolean(' + value + ')} ' + change + 'checked }))}' : ' value={' + value + ' ?? ""} ' + (type === 'number' ? 'onChange={e => setFormData(prev => ({ ...prev, [' + key + ']: e.target.value === "" ? "" : Number(e.target.value) }))}' : change + 'value }))}')) + ' />';
    }
    return '<div className="form-group"><label htmlFor={' + key + '}>{' + label + '}</label>' + input + '</div>';
  }).join('\n');
}

module.exports = { buildFieldContract, buildScreenContract, renderFields, inferTargetFromFieldName, screenTabKey, isLiveFormField, isPasswordField, inferScreenRoles, inferScreenEntity, isAuthScreen, compactNavLabel };
