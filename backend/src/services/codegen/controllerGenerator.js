const { buildFieldContract, isPasswordField } = require('./screenContract');
const { deriveNaming, toOpenApiType } = require('./typeMapper');

function generateControllerFile(entity) {
  const naming = deriveNaming(entity.name);
  const fields = buildFieldContract(entity).filter(f => f.mode === 'editable');
  const properties = Object.fromEntries(fields.map(f => [f.fieldName, {
    ...toOpenApiType(f.dataType || f.type), nullable: f.allowNull === true,
    ...(f.required && /STRING|TEXT/.test(f.dataType || f.type) ? { minLength: 1 } : {}),
    ...Object.fromEntries(['minimum','maximum','minLength','maxLength','enum','format'].filter(k => f[k] !== undefined).map(k => [k, f[k]]))
  }]));
  const schema = { type: 'object', properties, additionalProperties: false, required: fields.filter(f => f.required).map(f => f.fieldName) };
  const password = fields.find(f => isPasswordField(f.fieldName))?.fieldName;
  const pk = entity.primaryKey?.fieldName || 'id';
  return 'const models = require("../models");\n'
    + 'const { scopeFor, scopedWhere, inputFor, sanitize } = require("../services/crud.runtime");\n'
    + 'const model = models[' + JSON.stringify(naming.modelName) + '];\n'
    + 'const schema = ' + JSON.stringify(schema) + ';\n'
    + 'const pk = ' + JSON.stringify(pk) + ';\n'
    + 'const passwordField = ' + JSON.stringify(password || null) + ';\n'
    + `
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
  if (incoming.precio !== undefined || incoming.precio_venta !== undefined || incoming.precioVenta !== undefined || incoming.costo !== undefined || incoming.precioUnitario !== undefined) {
    const pVal = parseFloat(incoming.precio ?? incoming.precio_venta ?? incoming.precioVenta ?? incoming.costo ?? incoming.precioUnitario) || 0;
    if (schema.properties.precioUnitarioVenta && incoming.precioUnitarioVenta === undefined) incoming.precioUnitarioVenta = pVal;
    if (schema.properties.precioVenta && incoming.precioVenta === undefined) incoming.precioVenta = pVal;
    if (schema.properties.precioUnitario && incoming.precioUnitario === undefined) incoming.precioUnitario = pVal;
    if (schema.properties.precio && incoming.precio === undefined) incoming.precio = pVal;
  }
  if (incoming.stock !== undefined || incoming.existencia !== undefined || incoming.existencia_actual !== undefined || incoming.existenciaActual !== undefined) {
    const sVal = parseInt(incoming.stock ?? incoming.existencia ?? incoming.existencia_actual ?? incoming.existenciaActual, 10) || 0;
    if (schema.properties.existenciaActual && incoming.existenciaActual === undefined) incoming.existenciaActual = sVal;
    if (schema.properties.existencia && incoming.existencia === undefined) incoming.existencia = sVal;
  }
  if (incoming.activo === undefined && schema.properties.activo) {
    incoming.activo = true;
  }
  if (incoming.creadoPorUsuarioId === undefined && schema.properties.creadoPorUsuarioId) {
    incoming.creadoPorUsuarioId = req.user?.id || 1;
  }
  if (incoming.creado_por_usuario_id === undefined && schema.properties.creado_por_usuario_id) {
    incoming.creado_por_usuario_id = req.user?.id || 1;
  }
  if (incoming.usuarioId === undefined && schema.properties.usuarioId) {
    incoming.usuarioId = req.user?.id || 1;
  }
  if (incoming.usuario_id === undefined && schema.properties.usuario_id) {
    incoming.usuario_id = req.user?.id || 1;
  }
  if (incoming.vendedorId === undefined && schema.properties.vendedorId) {
    incoming.vendedorId = req.user?.id || 1;
  }
  if (incoming.vendedor_id === undefined && schema.properties.vendedor_id) {
    incoming.vendedor_id = req.user?.id || 1;
  }
  if ((!incoming.codigo || String(incoming.codigo).trim() === '') && schema.properties.codigo) {
    incoming.codigo = 'PROD-' + Date.now().toString().slice(-6);
  }
  if ((!incoming.numeroFactura || String(incoming.numeroFactura).trim() === '') && schema.properties.numeroFactura) {
    incoming.numeroFactura = 'FAC-' + Date.now().toString().slice(-6);
  }
  const cleanBody = Object.fromEntries(Object.entries(incoming).filter(([k]) => Object.hasOwn(validProps, k)));
  const properties = Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => [key, { ...value, ...declared.properties?.[key] }]));
  const data = inputFor(cleanBody, { ...schema, ...declared, properties, additionalProperties: true, required: [...new Set([...(schema.required || []), ...(declared.required || [])])] }, scope, updating);
  if (passwordField && Object.hasOwn(data, passwordField)) {
    if (typeof data[passwordField] !== 'string' || /^\\$2[aby]\\$/.test(data[passwordField])) throw Object.assign(new Error('INVALID_PASSWORD'), { statusCode: 400 });
    data[passwordField] = await require('bcryptjs').hash(data[passwordField], 12);
  }
  return data;
}

function normalizeOutput(row) {
  if (!row) return row;
  const obj = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
  const p = obj.precioUnitarioVenta !== undefined ? Number(obj.precioUnitarioVenta) : (obj.precioVenta !== undefined ? Number(obj.precioVenta) : (obj.precio_venta !== undefined ? Number(obj.precio_venta) : (obj.precioUnitario !== undefined ? Number(obj.precioUnitario) : undefined)));
  if (p !== undefined) {
    obj.precio = p;
    obj.precio_venta = p;
    obj.precioVenta = p;
    obj.precioUnitarioVenta = p;
    obj.precioUnitario = p;
  }
  const s = obj.existenciaActual !== undefined ? Number(obj.existenciaActual) : (obj.existencia !== undefined ? Number(obj.existencia) : (obj.existencia_actual !== undefined ? Number(obj.existencia_actual) : undefined));
  if (s !== undefined) {
    obj.stock = s;
    obj.existencia = s;
    obj.existenciaActual = s;
    obj.existencia_actual = s;
  }
  if (obj.activo === undefined && ('activo' in obj || 'activo' in schema.properties)) obj.activo = true;
  return obj;
}

exports.getAll = async (req, res) => {
  try {
    const scope = await scopeFor(models, req.crudContract, req.user);
    const rows = await model.findAll({ where: scopedWhere(scope) });
    const mapped = rows.map(r => normalizeOutput(r));
    return res.json({ success: true, count: mapped.length, data: sanitize(mapped, [passwordField]) });
  } catch (error) { return respondError(res, error); }
};
exports.getById = async (req, res) => {
  try {
    const scope = await scopeFor(models, req.crudContract, req.user);
    const row = await model.findOne({ where: scopedWhere(scope, pk, req.params.id) });
    if (!row) return res.status(404).json({ code: 'RECORD_NOT_FOUND' });
    return res.json({ success: true, data: sanitize(normalizeOutput(row), [passwordField]) });
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
`;
}
module.exports = { generateControllerFile };
