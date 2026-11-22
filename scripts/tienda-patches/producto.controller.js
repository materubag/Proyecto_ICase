const models = require("../models");
const { scopeFor, scopedWhere, inputFor, sanitize } = require("../services/crud.runtime");
const model = models["PRODUCTO"];
const schema = {"type":"object","properties":{"codigo":{"type":"string","nullable":true},"nombre":{"type":"string","nullable":true},"precioUnitarioVenta":{"type":"number","nullable":true},"existenciaActual":{"type":"integer","nullable":true},"activo":{"type":"boolean","nullable":true}},"additionalProperties":false,"required":[]};
const pk = "id";
const passwordField = null;

function respondError(res, error) {
  const status = error.statusCode || (/Sequelize.*(Validation|Constraint)/.test(error.name) ? 422 : 500);
  return res.status(status).json({ success: false, code: error.code || (status === 500 ? 'INTERNAL_ERROR' : 'INVALID_INPUT'), message: status === 500 ? 'Error interno' : error.message });
}
async function prepare(req, scope, updating) {
  const declared = req.crudContract?.input?.bodySchema || {};
  const validProps = { ...schema.properties, ...(declared.properties || {}) };
  const incoming = { ...req.body };
  for (const key of Object.keys(schema.properties)) {
    const snake = key.replace(/[A-Z]/g, letter => '_' + letter.toLowerCase());
    if (incoming[snake] !== undefined && incoming[key] === undefined) {
      incoming[key] = incoming[snake];
    }
  }
  if (incoming.precio !== undefined && incoming.precioUnitarioVenta === undefined && schema.properties.precioUnitarioVenta) {
    incoming.precioUnitarioVenta = parseFloat(incoming.precio) || 0;
  }
  if (incoming.precio_venta !== undefined && incoming.precioUnitarioVenta === undefined && schema.properties.precioUnitarioVenta) {
    incoming.precioUnitarioVenta = parseFloat(incoming.precio_venta) || 0;
  }
  if (incoming.costo !== undefined && incoming.precioUnitarioVenta === undefined && schema.properties.precioUnitarioVenta) {
    incoming.precioUnitarioVenta = parseFloat(incoming.costo) || 0;
  }
  if (incoming.stock !== undefined && incoming.existenciaActual === undefined && schema.properties.existenciaActual) {
    incoming.existenciaActual = parseInt(incoming.stock, 10) || 0;
  }
  if (incoming.existencia_actual !== undefined && incoming.existenciaActual === undefined && schema.properties.existenciaActual) {
    incoming.existenciaActual = parseInt(incoming.existencia_actual, 10) || 0;
  }
  if (incoming.activo === undefined && schema.properties.activo) {
    incoming.activo = true;
  }
  const cleanBody = Object.fromEntries(Object.entries(incoming).filter(([k]) => Object.hasOwn(validProps, k)));
  const properties = Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => [key, { ...value, ...declared.properties?.[key] }]));
  const data = inputFor(cleanBody, { ...schema, ...declared, properties, additionalProperties: true, required: [...new Set([...(schema.required || []), ...(declared.required || [])])] }, scope, updating);
  if (passwordField && Object.hasOwn(data, passwordField)) {
    if (typeof data[passwordField] !== 'string' || /^\$2[aby]\$/.test(data[passwordField])) throw Object.assign(new Error('INVALID_PASSWORD'), { statusCode: 400 });
    data[passwordField] = await require('bcryptjs').hash(data[passwordField], 12);
  }
  return data;
}
function normalizeProductoOutput(row) {
  if (!row) return row;
  const obj = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
  const precio = obj.precioUnitarioVenta !== undefined ? Number(obj.precioUnitarioVenta) : (obj.precio_venta !== undefined ? Number(obj.precio_venta) : 0);
  const stock = obj.existenciaActual !== undefined ? Number(obj.existenciaActual) : (obj.existencia !== undefined ? Number(obj.existencia) : 0);
  obj.precioUnitarioVenta = precio;
  obj.precio_unitario_venta = precio;
  obj.precio_venta = precio;
  obj.precioVenta = precio;
  obj.precio = precio;
  obj.existenciaActual = stock;
  obj.existencia_actual = stock;
  obj.existencia = stock;
  obj.stock = stock;
  if (obj.activo === undefined) obj.activo = true;
  return obj;
}

exports.getAll = async (req, res) => {
  try {
    const scope = await scopeFor(models, req.crudContract, req.user);
    const rows = await model.findAll({ where: scopedWhere(scope) });
    const mapped = rows.map(r => normalizeProductoOutput(r));
    return res.json({ success: true, count: mapped.length, data: sanitize(mapped, [passwordField]) });
  } catch (error) { return respondError(res, error); }
};
exports.getById = async (req, res) => {
  try {
    const scope = await scopeFor(models, req.crudContract, req.user);
    const row = await model.findOne({ where: scopedWhere(scope, pk, req.params.id) });
    if (!row) return res.status(404).json({ code: 'RECORD_NOT_FOUND' });
    return res.json({ success: true, data: sanitize(normalizeProductoOutput(row), [passwordField]) });
  } catch (error) { return respondError(res, error); }
};
for (const action of ['create', 'update', 'delete']) exports[action] = async (req, res) => {
  try {
    const result = await models.sequelize.transaction(async transaction => {
      const scope = await scopeFor(models, req.crudContract, req.user, transaction);
      let row;
      if (action !== 'create') {
        row = await model.findOne({ where: scopedWhere(scope, pk, req.params.id), transaction, lock: transaction.LOCK.UPDATE });
        if (!row) throw Object.assign(new Error('RECORD_NOT_FOUND'), { statusCode: 404, code: 'RECORD_NOT_FOUND' });
      }
      if (action === 'delete') { await row.destroy({ transaction }); return null; }
      const data = await prepare(req, scope, action === 'update');
      return action === 'create' ? model.create(data, { transaction }) : row.update(data, { transaction });
    });
    return res.status(action === 'create' ? 201 : 200).json({ success: true, data: sanitize(result, [passwordField]) });
  } catch (error) { return respondError(res, error); }
};
