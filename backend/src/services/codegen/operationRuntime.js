// This module is also copied verbatim into exported applications.
// References are data paths, never JavaScript expressions.
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);

function failure(message, statusCode = 422, code = 'VALIDATION_FAILED') {
  return Object.assign(new Error(message), { statusCode, code });
}

function resolve(value, context) {
  if (Array.isArray(value)) return value.map(v => resolve(v, context));
  if (!value || typeof value !== 'object') return value;
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
  if (schema.enum && !schema.enum.includes(value)) throw failure(`${path}: opción inválida`);
  if (schema.minimum !== undefined && value < schema.minimum) throw failure(`${path}: valor inferior al mínimo`);
  if (schema.maximum !== undefined && value > schema.maximum) throw failure(`${path}: valor superior al máximo`);
  if (schema.minLength !== undefined && String(value).trim().length < schema.minLength) throw failure(`${path}: valor requerido`);
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) throw failure(`${path}: faltan elementos`);
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
  validateInput(payload, contract.input?.bodySchema);
  payload = { ...payload };
  for (const field of contract.uploadFields || []) {
    const { readUpload } = require('./upload.storage');
    payload[field] = (payload[field] || []).map(item => ({ ...readUpload(item.token, user), observaciones: item.observaciones }));
  }
  const context = { payload, user, steps: Object.create(null), now: new Date(), item: null };
  for (const step of contract.steps || []) {
    if (step.when && resolve(step.when, context) == null) continue;
    const model = models[step.entity];
    if (!model) throw failure(`Entidad inexistente: ${step.entity}`, 500, 'INVALID_CONTRACT');
    const run = async item => {
      context.item = item;
      const fields = resolve(step.fields || {}, context);
      const where = resolve(step.where || {}, context);
      if (step.action === 'CREATE') return model.create(fields, { transaction });
      if (step.action === 'UPDATE') {
        if (!Object.keys(where).length) throw failure('UPDATE requiere filtro explícito', 500, 'INVALID_CONTRACT');
        const record = await model.findOne({ where, transaction });
        if (!record) throw failure('Registro relacionado no encontrado', 404, 'RELATED_RECORD_NOT_FOUND');
        return record.update(fields, { transaction });
      }
      if (step.action === 'QUERY') {
        const records = await model.findAll({ where, transaction });
        if (step.requireMatch && !records.length) throw failure('Registro relacionado no encontrado', 422, 'RELATED_RECORD_NOT_FOUND');
        return records;
      }
      throw failure(`Acción no soportada: ${step.action}`, 500, 'INVALID_CONTRACT');
    };
    let result;
    if (step.forEach) {
      const items = resolve(step.forEach, context) ?? [];
      if (!Array.isArray(items)) throw failure('Se esperaba una colección', 400);
      result = [];
      for (const item of items) result.push(await run(item));
    } else result = await run(null);
    context.steps[step.id || String(step.step)] = result;
  }
  return context.steps[contract.resultStep] ?? context.steps[String(contract.steps?.length)];
}

module.exports = { resolve, validateInput, executeSteps };
