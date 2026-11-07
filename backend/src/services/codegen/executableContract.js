// Shared quality gate: validation and generation must reject the same contract.
function executionProblems(operation, entities = []) {
  const problems = [];
  if ((operation.unresolved || []).length) problems.push(...operation.unresolved.map(issue => {
    if (typeof issue === 'string') return issue;
    if (!issue || typeof issue !== 'object') return String(issue);
    return [issue.item, issue.reason || issue.message || issue.description].filter(Boolean).map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(': ') || JSON.stringify(issue);
  }));
  const steps = operation.steps || [];
  if (operation.bindingVersion !== 2 && ['UPDATE', 'DELETE', 'STATUS_CHANGE', 'ASSOCIATE', 'QUERY'].includes(String(operation.action || '').toUpperCase())) problems.push('La acción requiere un contrato de referencias, filtros y permisos bindingVersion=2.');
  for (const rule of operation.businessRules || []) {
    if (typeof rule.condition === 'string') problems.push('Las condiciones de texto deben convertirse a predicados declarativos antes de ejecutarse.');
    if (rule.field && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(rule.field)) problems.push('Campo de regla inválido.');
  }
  const created = new Set(steps.filter(s => s?.action === 'CREATE').map(s => s.entity));
  if (steps.some(s => s?.action === 'DELETE' && created.has(s.entity))) problems.push('Crear y eliminar la misma entidad requiere separar los comandos alternativos.');
  if (!steps.length && !operation.action) problems.push('¿Qué pasos ejecuta la operación? El método HTTP no define el proceso.');
  let seen = new Set();
  const checkFields = (entity, object, path) => {
    for (const key of Object.keys(object || {})) if (!entity?.attributes?.some(a => a.fieldName === key)) problems.push(`${path}: campo ${key} ajeno a la entidad.`);
  };
  const inspectRefs = (value, path) => {
    if (!value || typeof value !== 'object') return;
    if (value.$op) {
      const extraOperators = ['date_add_minutes', 'password_verify', 'local_date'];
      if (extraOperators.includes(value.$op)) {
        for (const [key, item] of Object.entries(value)) inspectRefs(item, `${path}.${key}`);
        return;
      }
      if (!['trim', 'upper', 'nullable_trim', 'json', 'hash', 'template', 'pluck', 'filter', 'first', 'object', 'random_secret', 'password_hash', 'choose', 'date_start', 'count', 'group_count', 'date_add_days', 'date_diff_days', 'all', 'add', 'subtract', 'multiply', 'divide', 'sum'].includes(value.$op)) problems.push(`${path}: cálculo no soportado.`);
      if (value.$op === 'date_start') { try { new Intl.DateTimeFormat('en', { timeZone: value.timeZone || 'INVALID' }); } catch (_) { problems.push(`${path}: zona horaria explícita válida requerida.`); } }
      if (value.$op === 'group_count' && (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value.field || '') || ['__proto__', 'constructor', 'prototype', 'count'].includes(value.field))) problems.push(`${path}: campo de agrupación inválido.`);
      if (['add', 'subtract', 'multiply', 'divide', 'sum'].includes(value.$op) && (!Number.isInteger(value.scale) || value.scale < 0 || value.scale > 6)) problems.push(`${path}: precisión decimal explícita requerida.`);
    }
    if (value.$ref) {
      if (operation.bindingVersion !== 2) problems.push(`${path}: las referencias requieren bindingVersion=2; no se exportan como valores literales.`);
      const parts = String(value.$ref).split('.');
      if (!['payload', 'user', 'steps', 'item', 'now'].includes(parts[0]) || parts.some(p => ['__proto__', 'constructor', 'prototype'].includes(p))) problems.push(`${path}: referencia no permitida.`);
      if (parts[0] === 'steps' && !seen.has(parts[1])) problems.push(`${path}: referencia a paso inexistente o posterior ${parts[1]}.`);
      if (parts[0] === 'payload' && parts.length > 1 && !Object.hasOwn(operation.input?.bodySchema?.properties || {}, parts[1])) problems.push(`${path}: entrada ${parts[1]} no declarada.`);
    }
    for (const [key, item] of Object.entries(value)) if (key !== '$ref') inspectRefs(item, `${path}.${key}`);
  };
  const inspectSteps = steps => {
  for (const [index, step] of steps.entries()) {
    if (!step || typeof step !== 'object') { problems.push(`Paso ${index + 1}: narrativa sin contrato.`); continue; }
    const entity = entities.find(e => [e.id, e.name, e.modelName].includes(step.entity || operation.targetEntity));
    const id = step.id || String(step.step || index + 1);
    if (seen.has(id)) problems.push(`Paso ${id}: identificador duplicado.`);
    const action = String(step.action || '').toUpperCase();
    if (action === 'FOR_EACH') {
      inspectRefs(step.collection, `Paso ${id}.collection`);
      if (!step.collection || !Array.isArray(step.steps) || !step.steps.length) problems.push(`Paso ${id}: colección y pasos internos requeridos.`);
      const outer = seen;
      seen = new Set(outer);
      inspectSteps(step.steps || []);
      inspectRefs(step.result, `Paso ${id}.result`);
      if (step.resultStep && !seen.has(step.resultStep)) problems.push(`Paso ${id}: resultado interno inexistente.`);
      seen = outer;
      seen.add(id);
      continue;
    }
    if (operation.bindingVersion !== 2 && ['UPDATE', 'DELETE', 'STATUS_CHANGE', 'ASSOCIATE', 'QUERY'].includes(action)) problems.push(`Paso ${id}: falta contrato bindingVersion=2 con filtros explícitos; no se ejecutan estados ni consultas inferidas.`);
    if (typeof step.condition === 'string' || typeof step.formula === 'string') problems.push(`Paso ${id}: expresión de texto no ejecutable; use un contrato declarativo.`);
    if (action === 'CALCULATION' && (!step.expression || typeof step.expression !== 'object' || !step.expression.$op)) problems.push(`Paso ${id}: cálculo pendiente de contrato numérico y política de precisión.`);
    if (operation.bindingVersion !== 2 && ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ASSOCIATE'].includes(action) && steps.length > 1) problems.push(`Paso ${id}: migre la secuencia a referencias explícitas bindingVersion=2.`);
    if (!entity && !['VALIDATION', 'CALCULATION', 'ASSERT', 'RETURN'].includes(action)) problems.push(`Paso ${id}: entidad inexistente.`);
    if (['CREATE', 'UPDATE'].includes(action)) {
      if (!step.fields && !step.data) problems.push(`Paso ${id}: ¿Qué campos y referencias recibe ${step.entity}? No se permite reutilizar el payload completo.`);
      const attrs = entity?.attributes || [];
      for (const key of Object.keys(step.fields || step.data || {})) {
        if (!attrs.some(a => a.fieldName === key)) problems.push(`Paso ${id}: campo ${key} ajeno a ${step.entity}.`);
      }
    }
    if (operation.bindingVersion === 2) {
      if (!['CREATE', 'UPDATE', 'QUERY', 'CALCULATION', 'ASSERT', 'RETURN'].includes(action)) problems.push(`Paso ${id}: acción ${action} no soportada por el runtime de referencias.`);
      if (action === 'RETURN' && !Object.hasOwn(step, 'value')) problems.push(`Paso ${id}: valor de respuesta requerido.`);
      if (action === 'ASSERT' && (!step.condition || typeof step.condition !== 'object')) problems.push(`Paso ${id}: condición declarativa requerida.`);
      if (['UPDATE'].includes(action) && !Object.keys(step.where || {}).length) problems.push(`Paso ${id}: falta filtro explícito.`);
      if (step.data && !step.fields) problems.push(`Paso ${id}: bindingVersion=2 requiere fields; data no se ejecuta.`);
      checkFields(entity, step.where, `Paso ${id}.where`);
      for (const filter of step.filters || []) {
        checkFields(entity, { [filter.field]: true }, `Paso ${id}.filters`);
        if (Object.hasOwn(filter, 'valueField')) checkFields(entity, { [filter.valueField]: true }, `Paso ${id}.filters.valueField`);
        if (action !== 'QUERY' || !['eq', 'ne', 'in', 'gte', 'gt', 'lte', 'lt'].includes(filter.operator) || Object.hasOwn(filter, 'value') === Object.hasOwn(filter, 'valueField')) problems.push(`Paso ${id}: filtro declarativo inválido.`);
      }
      if (action === 'CREATE') for (const attribute of entity?.attributes || []) {
        if (attribute.allowNull === false && !attribute.isPk && !attribute.autoIncrement && attribute.defaultValue == null && !Object.hasOwn(step.fields || {}, attribute.fieldName)) problems.push(`Paso ${id}: CREATE requiere el campo obligatorio ${attribute.fieldName}; una validación de entrada se expresa en bodySchema, nunca mediante una escritura adicional.`);
      }
      for (const field of step.attributes || []) if (!entity?.attributes?.some(a => a.fieldName === field)) problems.push(`Paso ${id}: atributo de consulta inexistente ${field}.`);
      if (typeof step.when === 'string' || typeof step.when === 'number') problems.push(`Paso ${id}: condición when no declarativa.`);
    }
    inspectRefs(step, `Paso ${id}`);
    seen.add(id);
  }
  };
  inspectSteps(steps);
  if (operation.bindingVersion === 2 && operation.resultStep && !seen.has(operation.resultStep)) problems.push('El resultado referencia un paso inexistente: ' + operation.resultStep + '; use uno de: ' + [...seen].join(', '));
  return problems;
}

module.exports = { executionProblems };
