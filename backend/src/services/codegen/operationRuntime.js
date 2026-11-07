// This module is also copied verbatim into exported applications.
// References are data paths, never JavaScript expressions.
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
const systemKey = Symbol('TRUSTED_SYSTEM_INVOCATION');
const systemIdentity = () => ({ [systemKey]: true });

function failure(message, statusCode = 422, code = 'VALIDATION_FAILED') {
  return Object.assign(new Error(message), { statusCode, code });
}

function resolve(value, context) {
  if (Array.isArray(value)) return value.map(v => resolve(v, context));
  if (!value || typeof value !== 'object') return value;
  if (Object.hasOwn(value, '$op')) return calculate(value, context);
  if (Object.hasOwn(value, '$ref')) {
    const parts = String(value.$ref).split('.');
    if (!['payload', 'user', 'steps', 'item', 'now'].includes(parts[0]) || parts.some(p => forbidden.has(p))) {
      throw failure('Referencia de contrato inválida', 400, 'INVALID_CONTRACT_REFERENCE');
    }
    return parts.reduce((node, key) => node == null ? undefined : node[key], context);
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (forbidden.has(key)) throw failure('Campo de contrato inválido');
    return [key, resolve(item, context)];
  }));
}

function decimal(value) {
  const text = String(value);
  if (!/^-?\d{1,24}(\.\d{1,12})?$/.test(text)) throw failure('Valor decimal inválido', 422, 'INVALID_DECIMAL');
  const [whole, fraction = ''] = text.split('.');
  return { n: BigInt(whole + fraction), d: 10n ** BigInt(fraction.length) };
}

function rounded(value, scale) {
  if (!Number.isInteger(scale) || scale < 0 || scale > 6) throw failure('Precisión decimal inválida', 500, 'INVALID_CONTRACT');
  const unit = 10n ** BigInt(scale), sign = value.n < 0n ? -1n : 1n;
  const magnitude = value.n * sign * unit;
  const integer = (magnitude / value.d + (magnitude % value.d * 2n >= value.d ? 1n : 0n)) * sign;
  const digits = String(integer < 0n ? -integer : integer).padStart(scale + 1, '0');
  return (integer < 0n ? '-' : '') + (scale ? digits.slice(0, -scale) + '.' + digits.slice(-scale) : digits);
}

function calculate(expression, context) {
  if (expression.$op === 'local_date') {
    const date = new Date(resolve(expression.date, context));
    if (!Number.isFinite(date.getTime()) || typeof expression.timeZone !== 'string') throw failure('Fecha o zona horaria inválida', 400);
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: expression.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(part => [part.type, part.value]));
    return parts.year + '-' + parts.month + '-' + parts.day;
  }
  if (expression.$op === 'password_verify') return require('bcryptjs').compareSync(String(resolve(expression.password, context)), String(resolve(expression.hash, context)));
  if (['trim', 'upper', 'nullable_trim', 'json', 'hash', 'template', 'pluck', 'filter', 'first', 'object', 'random_secret', 'password_hash'].includes(expression.$op)) {
    const value = resolve(expression.value, context);
    if (expression.$op === 'trim') return String(value ?? '').trim();
    if (expression.$op === 'upper') return String(value ?? '').trim().toUpperCase();
    if (expression.$op === 'nullable_trim') return value == null || String(value).trim() === '' ? null : String(value).trim();
    if (expression.$op === 'json') return JSON.stringify(value);
    if (expression.$op === 'object') { try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { throw failure('JSON inválido', 400); } }
    if (expression.$op === 'hash') {
      const canonical = item => typeof item?.toJSON === 'function' ? canonical(item.toJSON()) : Array.isArray(item) ? item.map(canonical) : item && typeof item === 'object' && !(item instanceof Date) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])])) : item;
      return require('crypto').createHash('sha256').update(JSON.stringify(canonical(value ?? null))).digest('hex');
    }
    if (expression.$op === 'random_secret') return require('crypto').randomBytes(24).toString('base64url');
    if (expression.$op === 'password_hash') return require('bcryptjs').hashSync(String(value), 12);
    if (expression.$op === 'template') return (expression.parts || []).map(part => String(resolve(part, context) ?? '')).join('');
    if (expression.$op === 'first') return Array.isArray(value) ? value[0] ?? null : null;
    if (!Array.isArray(value)) throw failure('Colección requerida', 400);
    if (expression.$op === 'pluck') {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expression.field || '') || forbidden.has(expression.field)) throw failure('Campo inválido');
      return value.map(row => row[expression.field]);
    }
    return value.filter(item => evaluatePredicate(expression.condition, { ...context, item }));
  }
  if (expression.$op === 'date_start') {
    const date = resolve(expression.date, context);
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof expression.timeZone !== 'string') throw failure('Fecha o zona horaria inválida', 400, 'INVALID_INPUT');
    const wanted = Date.parse(date + 'T00:00:00Z');
    if (!Number.isFinite(wanted) || new Date(wanted).toISOString().slice(0, 10) !== date) throw failure('Fecha inválida', 400, 'INVALID_INPUT');
    try {
      const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: expression.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
      let instant = wanted;
      for (let i = 0; i < 3; i++) {
        const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
        const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
        if (wall === wanted) return new Date(instant).toISOString();
        instant += wanted - wall;
      }
    } catch (_) { /* Invalid zone or date becomes an explicit input error. */ }
    throw failure('No se puede convertir el límite de fecha', 400, 'INVALID_INPUT');
  }
  if (['count', 'group_count'].includes(expression.$op)) {
    const rows = resolve(expression.items, context);
    if (!Array.isArray(rows)) throw failure('Colección de conteo inválida');
    if (expression.$op === 'count') return rows.length;
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expression.field || '') || forbidden.has(expression.field) || expression.field === 'count') throw failure('Campo de agrupación inválido');
    const groups = new Map();
    for (const row of rows) {
      const value = row[expression.field] ?? null;
      if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) throw failure('Valor de agrupación inválido');
      const key = JSON.stringify(value);
      const group = groups.get(key) || { [expression.field]: value, count: 0 };
      group.count++; groups.set(key, group);
    }
    return [...groups.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, group]) => group);
  }
  if (expression.$op === 'choose') return resolve(evaluatePredicate(expression.condition, context) ? expression.then : expression.else, context);
  if (expression.$op === 'date_add_minutes') {
    const date = new Date(resolve(expression.date, context)), minutes = Number(resolve(expression.minutes, context));
    if (!Number.isFinite(date.getTime()) || !Number.isSafeInteger(minutes)) throw failure('Fecha o intervalo inválido');
    return new Date(date.getTime() + minutes * 60000).toISOString();
  }
  if (expression.$op === 'date_add_days') {
    const input = resolve(expression.date, context);
    const date = new Date(expression.timeZone && typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input) ? calculate({ $op: 'date_start', date: input, timeZone: expression.timeZone }, context) : input), days = Number(resolve(expression.days, context));
    if (!Number.isFinite(date.getTime()) || !Number.isSafeInteger(days)) throw failure('Fecha o intervalo inválido');
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString();
  }
  if (expression.$op === 'date_diff_days') {
    const from = new Date(resolve(expression.from, context)), to = new Date(resolve(expression.to, context));
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) throw failure('Fecha inválida');
    return (to.getTime() - from.getTime()) / 86400000;
  }
  let values;
  if (expression.$op === 'all') {
    const rows = resolve(expression.items, context);
    if (!Array.isArray(rows) || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expression.field || '') || forbidden.has(expression.field)) throw failure('Colección booleana inválida');
    return rows.every(row => row[expression.field] === true);
  }
  if (expression.$op === 'sum') {
    const rows = resolve(expression.items, context);
    if (!Array.isArray(rows) || (expression.field && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expression.field)) || forbidden.has(expression.field)) throw failure('Colección de suma inválida');
    values = rows.map(row => decimal(expression.field ? row[expression.field] : row));
  } else values = (expression.args || []).map(value => decimal(resolve(value, context)));
  if (!['add', 'subtract', 'multiply', 'divide', 'sum'].includes(expression.$op) || (!values.length && expression.$op !== 'sum')) throw failure('Cálculo no soportado', 500, 'INVALID_CONTRACT');
  let result = values[0] || { n: 0n, d: 1n };
  for (const value of values.slice(1)) {
    if (['add', 'sum'].includes(expression.$op)) result = { n: result.n * value.d + value.n * result.d, d: result.d * value.d };
    if (expression.$op === 'subtract') result = { n: result.n * value.d - value.n * result.d, d: result.d * value.d };
    if (expression.$op === 'multiply') result = { n: result.n * value.n, d: result.d * value.d };
    if (expression.$op === 'divide') {
      if (value.n === 0n) throw failure('División por cero', 422, 'DIVISION_BY_ZERO');
      result = { n: result.n * value.d * (value.n < 0n ? -1n : 1n), d: result.d * (value.n < 0n ? -value.n : value.n) };
    }
    // Reduce at each operation so long invoices do not grow denominators exponentially.
    let a = result.n < 0n ? -result.n : result.n, b = result.d;
    while (b) { const remainder = a % b; a = b; b = remainder; }
    result = { n: result.n / a, d: result.d / a };
  }
  return rounded(result, expression.scale);
}

function validateInput(value, schema = {}, path = 'body') {
  if (value === undefined) return;
  if (value === null && schema.nullable) return;
  const type = schema.type;
  const valid = type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
    : type === 'array' ? Array.isArray(value)
      : type === 'integer' ? Number.isSafeInteger(value)
        : type === 'number' ? typeof value === 'number' && Number.isFinite(value)
          : !type || typeof value === type;
  if (!valid) throw failure(`${path}: tipo inválido`, 400, 'INVALID_INPUT');
  if (schema.enum && !schema.enum.includes(value)) throw failure(`${path}: opción inválida`, 400);
  if (schema.minimum !== undefined && value < schema.minimum) throw failure(`${path}: valor inferior al mínimo`);
  if (schema.maximum !== undefined && value > schema.maximum) throw failure(`${path}: valor superior al máximo`);
  if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) throw failure(`${path}: valor debe superar el mínimo`);
  if (schema.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw failure(`${path}: correo inválido`, 400);
  if (schema.minLength !== undefined && String(value).trim().length < schema.minLength) throw failure(`${path}: valor requerido`, 400);
  if (schema.maxLength !== undefined && String(value).length > schema.maxLength) throw failure(`${path}: texto demasiado largo`);
  if (schema.format === 'uuid' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw failure(`${path}: UUID inválido`, 400, 'INVALID_INPUT');
  if (['date', 'date-time'].includes(schema.format) && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(T|$)/.test(value) || !Number.isFinite(Date.parse(value)))) throw failure(`${path}: fecha inválida`, 400, 'INVALID_INPUT');
  if (Array.isArray(value)) {
    if (schema.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) throw failure(`${path}: elementos duplicados`, 400);
    if (schema.minItems !== undefined && value.length < schema.minItems) throw failure(`${path}: faltan elementos`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) throw failure(`${path}: demasiados elementos`);
    value.forEach((item, i) => validateInput(item, schema.items, `${path}[${i}]`));
  } else if (type === 'object') {
    for (const key of schema.required || []) {
      if (value[key] === undefined || value[key] === null || value[key] === '') throw failure(`${path}.${key}: requerido`, 400, 'REQUIRED_INPUT');
    }
    for (const [key, item] of Object.entries(value)) {
      if (forbidden.has(key) || (schema.additionalProperties === false && !Object.hasOwn(schema.properties || {}, key))) throw failure(`${path}.${key}: campo no permitido`, 400, 'UNKNOWN_INPUT');
      validateInput(item, schema.properties?.[key] || {}, `${path}.${key}`);
    }
  }
}

async function executeSteps(models, contract, payload, user, transaction) {
  if (contract.invocation === 'SYSTEM' && user?.[systemKey] !== true) throw failure('Operación interna del sistema', 403, 'SYSTEM_ONLY');
  if ((contract.authorizedRoles || []).length && !contract.authorizedRoles.includes(user?.role || user?.rol)) throw failure('Acceso no autorizado', 403, 'FORBIDDEN');
  validateInput(payload, contract.input?.bodySchema);
  payload = { ...payload };
  for (const field of contract.uploadFields || []) {
    const { readUpload } = require('./upload.storage');
    payload[field] = (payload[field] || []).map(item => ({ ...readUpload(item.token, user, contract.uploadContext), observaciones: item.observaciones }));
  }
  const context = { payload, user, steps: Object.create(null), now: new Date(), item: null, changes: [] };
  // Explicit ownership/assignment gates, evaluated before any write.
  for (const gate of contract.recordAccess || []) {
    const where = resolve(gate.where, context);
    if (!where || !Object.keys(where).length || Object.values(where).some(v => v === undefined)) throw failure('Filtro de autorización incompleto', 403, 'FORBIDDEN');
    const record = await models[gate.entity]?.findOne({ where, transaction, ...(gate.lock ? { lock: transaction.LOCK?.UPDATE } : {}) });
    if (!record) throw failure('Registro no autorizado', 403, 'FORBIDDEN_RECORD');
  }
  const runSteps = async (steps, scope) => {
  for (const step of steps || []) {
    if (step.when !== undefined) {
      const when = step.when?.operator ? evaluatePredicate(step.when, scope) : resolve(step.when, scope);
      if (when === false || when == null) continue;
    }
    const id = step.id || String(step.step);
    if (step.action === 'ASSERT') {
      if (!evaluatePredicate(step.condition, scope)) throw failure(step.errorMessage || 'Regla no satisfecha', step.errorStatus || 422, step.errorCode || 'BUSINESS_RULE_VIOLATION');
      scope.steps[id] = true;
      continue;
    }
    if (step.action === 'CALCULATION') { scope.steps[id] = resolve(step.expression, scope); continue; }
    if (step.action === 'RETURN') { scope.steps[id] = resolve(step.value, scope); continue; }
    if (step.action === 'FOR_EACH') {
      const collection = resolve(step.collection, scope);
      if (!Array.isArray(collection)) throw failure('Se esperaba una colección');
      scope.steps[id] = [];
      for (const item of collection) {
        const local = { ...scope, item, steps: Object.assign(Object.create(null), scope.steps) };
        await runSteps(step.steps, local);
        scope.steps[id].push(step.result ? resolve(step.result, local) : local.steps[step.resultStep]);
      }
      continue;
    }
    const model = models[step.entity];
    if (!model) throw failure(`Entidad inexistente: ${step.entity}`, 500, 'INVALID_CONTRACT');
    const run = async item => {
      const rowScope = { ...scope, item };
      const fields = Object.fromEntries(Object.entries(resolve(step.fields || {}, rowScope)).filter(([, value]) => value !== undefined));
      const where = resolve(step.where || {}, rowScope);
      if (step.action === 'CREATE') {
        const record = await model.create(fields, { transaction });
        if (contract.auditWrites && !['AUDITORIA', 'RESULTADOCOMANDO'].includes(step.entity)) scope.changes.push({ entity: step.entity, id: record.id, operation: 'CREATE', before: null, after: fields });
        return record;
      }
      if (step.action === 'UPDATE') {
        if (!Object.keys(where).length || Object.values(where).some(value => value === undefined)) throw failure('UPDATE requiere filtro explícito completo', 500, 'INVALID_CONTRACT');
        const record = await model.findOne({ where, transaction, ...(step.lock ? { lock: transaction?.LOCK?.UPDATE } : {}) });
        if (!record) throw failure('Registro relacionado no encontrado', 404, 'RELATED_RECORD_NOT_FOUND');
        const before = record.toJSON ? record.toJSON() : { ...record };
        const updated = await record.update(fields, { transaction });
        if (contract.auditWrites && !['AUDITORIA', 'RESULTADOCOMANDO'].includes(step.entity)) scope.changes.push({ entity: step.entity, id: record.id, operation: 'UPDATE', before, after: fields });
        return updated;
      }
      if (step.action === 'QUERY') {
        if (Object.values(where).some(value => value === undefined)) throw failure('Referencia de consulta incompleta', 400, 'INVALID_CONTRACT_REFERENCE');
        if (step.filters?.length) {
          const { Op, col } = require('sequelize');
          where[Op.and] = step.filters.map(filter => {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(filter.field || '') || forbidden.has(filter.field) || !['eq', 'ne', 'in', 'gte', 'gt', 'lte', 'lt'].includes(filter.operator)) throw failure('Filtro de consulta inválido', 500, 'INVALID_CONTRACT');
            const columnComparison = Object.hasOwn(filter, 'valueField');
            if (columnComparison && (Object.hasOwn(filter, 'value') || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(filter.valueField || '') || forbidden.has(filter.valueField) || !Object.hasOwn(model.rawAttributes || {}, filter.valueField) || !Object.hasOwn(model.rawAttributes || {}, filter.field))) throw failure('Columna de comparación inválida', 500, 'INVALID_CONTRACT');
            const value = columnComparison ? col(model.rawAttributes[filter.valueField].field || filter.valueField) : resolve(filter.value, rowScope);
            if (value == null) throw failure('Límite de consulta ausente', 400, 'INVALID_CONTRACT_REFERENCE');
            return { [filter.field]: { [Op[filter.operator]]: value } };
          });
        }
        const records = await model.findAll({ where, transaction, ...(step.attributes ? { attributes: step.attributes } : {}), ...(step.lock ? { lock: transaction.LOCK?.UPDATE } : {}) });
        if (step.requireMatch && !records.length) throw failure(step.errorMessage || 'Registro relacionado no encontrado', step.errorStatus || 422, step.errorCode || 'RELATED_RECORD_NOT_FOUND');
        return records;
      }
      throw failure(`Acción no soportada: ${step.action}`, 500, 'INVALID_CONTRACT');
    };
    let result;
    if (step.forEach) {
      const items = resolve(step.forEach, scope) ?? [];
      if (!Array.isArray(items)) throw failure('Se esperaba una colección', 400);
      result = [];
      for (const item of items) result.push(await run(item));
    } else result = await run(scope.item);
    scope.steps[id] = result;
  }
  };
  await runSteps(contract.steps, context);
  if (contract.auditWrites) {
    const clean = value => value && Object.fromEntries(Object.entries(value).filter(([field]) => !/password|hash|temporal|token|secret/i.test(field)));
    for (const change of context.changes) await models.AUDITORIA.create({ usuarioId: user?.id ?? null, entidad: change.entity, entidadId: change.id, operacion: change.operation, fechaEvento: context.now, detalle: JSON.stringify({ operationId: contract.operationId, anterior: clean(change.before), nuevo: clean(change.after) }) }, { transaction });
  }
  return context.steps[contract.resultStep] ?? context.steps[String(contract.steps?.length)];
}

function evaluatePredicate(predicate, context) {
  if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate)) throw failure('Condición declarativa requerida', 500, 'INVALID_CONTRACT');
  if (['and', 'or'].includes(predicate.operator)) {
    if (!Array.isArray(predicate.conditions) || !predicate.conditions.length) throw failure('Condiciones requeridas', 500, 'INVALID_CONTRACT');
    return predicate.operator === 'and' ? predicate.conditions.every(condition => evaluatePredicate(condition, context)) : predicate.conditions.some(condition => evaluatePredicate(condition, context));
  }
  const left = resolve(predicate.left, context);
  const right = resolve(predicate.right, context);
  if (['eq', 'neq'].includes(predicate.operator) && typeof left !== typeof right && [left, right].every(value => ['string', 'number'].includes(typeof value) && /^-?\d{1,24}(\.\d{1,12})?$/.test(String(value)))) {
    const l = decimal(left), r = decimal(right), equal = l.n * r.d === r.n * l.d;
    return predicate.operator === 'eq' ? equal : !equal;
  }
  if (['gt', 'gte', 'lt', 'lte'].includes(predicate.operator) && [left, right].every(value => ['string', 'number'].includes(typeof value) && /^-?\d{1,24}(\.\d{1,12})?$/.test(String(value)))) {
    const l = decimal(left), r = decimal(right), delta = l.n * r.d - r.n * l.d;
    return predicate.operator === 'gt' ? delta > 0n : predicate.operator === 'gte' ? delta >= 0n : predicate.operator === 'lt' ? delta < 0n : delta <= 0n;
  }
  switch (predicate.operator) {
    case 'eq': return left === right;
    case 'neq': return left !== right;
    case 'gt': return left > right;
    case 'gte': return left >= right;
    case 'lt': return left < right;
    case 'lte': return left <= right;
    case 'in': return Array.isArray(right) && right.includes(left);
    case 'not_in': return Array.isArray(right) && !right.includes(left);
    case 'not_empty': return left !== undefined && left !== null && left !== '';
    case 'is_empty': return left === undefined || left === null || left === '';
    default: throw failure('Operador no soportado', 500, 'INVALID_CONTRACT');
  }
}

module.exports = { resolve, validateInput, executeSteps, evaluatePredicate, systemIdentity };
