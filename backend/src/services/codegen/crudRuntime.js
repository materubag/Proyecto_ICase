// Copied into exports. Authorization filters are contract data, never client input.
const { Op } = require('sequelize');
const { resolve, validateInput } = require('./operationRuntime');
const fail = (code, statusCode = 403) => Object.assign(new Error(code), { code, statusCode });

async function scopeFor(models, contract = {}, user, transaction) {
  const policies = contract.recordScope || [];
  const role = String(user?.role || user?.rol || '').toLowerCase();
  const policy = policies.find(p => (p.roles || []).some(r => String(r).toLowerCase() === role));
  if (!policy) {
    if (policies.some(p => p.requiredForAllRoles)) throw fail('UNRESOLVED_RECORD_PERMISSION');
    return { where: {}, immutableFields: [] };
  }
  const context = { user, steps: Object.create(null) };
  const check = where => {
    if (!where || !Object.keys(where).length || Object.values(where).some(v => v === undefined || v === null)) throw fail('FORBIDDEN_RECORD');
    return where;
  };
  for (const lookup of policy.lookups || []) {
    const model = models[lookup.entity];
    if (!model) throw fail('INVALID_SCOPE_CONTRACT', 500);
    let lookupWhere = lookup.where ? resolve(lookup.where, context) : {};
    if (lookup.whereIn) {
      const { field, lookup: source, valueField } = lookup.whereIn;
      if (![field, valueField].every(key => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key)) || !Array.isArray(context.steps[source])) throw fail('INVALID_SCOPE_CONTRACT', 500);
      lookupWhere[field] = { [Op.in]: context.steps[source].map(row => row[valueField]).filter(value => value !== null && value !== undefined) };
    }
    const rows = await model.findAll({ where: check(lookupWhere), transaction });
    if (lookup.many === true) {
      context.steps[lookup.id] = rows.map(row => row.toJSON ? row.toJSON() : row);
      continue;
    }
    if (rows.length !== 1) throw fail('FORBIDDEN_RECORD');
    context.steps[lookup.id] = rows[0].toJSON ? rows[0].toJSON() : rows[0];
  }
  let where = policy.where ? check(resolve(policy.where, context)) : {};
  if (policy.whereIn) {
    const { field, lookup, valueField } = policy.whereIn;
    if (![field, valueField].every(key => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key))) throw fail('INVALID_SCOPE_CONTRACT', 500);
    const rows = context.steps[lookup];
    if (!Array.isArray(rows) || rows.some(row => row[valueField] == null)) throw fail('INVALID_SCOPE_CONTRACT', 500);
    where = { ...where, [field]: { [Op.in]: rows.map(row => row[valueField]) } };
  }
  return { where: check(where), immutableFields: policy.immutableFields || [] };
}

function scopedWhere(scope, pk, id) {
  return id === undefined ? scope.where : { [Op.and]: [scope.where, { [pk]: id }] };
}

function inputFor(body, schema, scope, updating) {
  validateInput(body, { ...schema, required: updating ? [] : schema.required });
  if (!body || !Object.keys(body).length) throw fail('EMPTY_INPUT', 400);
  for (const key of scope.immutableFields) {
    if (Object.hasOwn(body, key) && (updating || body[key] !== scope.where[key])) throw fail('IMMUTABLE_OWNER');
  }
  return { ...body };
}

function sanitize(value, secrets = []) {
  if (value?.toJSON) value = value.toJSON();
  if (Array.isArray(value)) return value.map(v => sanitize(v, secrets));
  if (value && typeof value === 'object' && !(value instanceof Date)) return Object.fromEntries(Object.entries(value)
    .filter(([key]) => ![...secrets, 'password', 'passwordHash', 'password_hash', 'contrasena', 'token', 'salt'].includes(key))
    .map(([key, item]) => [key, sanitize(item, secrets)]));
  return value;
}

module.exports = { scopeFor, scopedWhere, inputFor, sanitize };
