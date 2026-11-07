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
  const properties = Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => [key, { ...value, ...declared.properties?.[key] }]));
  const data = inputFor(req.body, { ...schema, ...declared, properties, additionalProperties: false, required: [...new Set([...(schema.required || []), ...(declared.required || [])])] }, scope, updating);
  if (passwordField && Object.hasOwn(data, passwordField)) {
    if (typeof data[passwordField] !== 'string' || /^\\$2[aby]\\$/.test(data[passwordField])) throw Object.assign(new Error('INVALID_PASSWORD'), { statusCode: 400 });
    data[passwordField] = await require('bcryptjs').hash(data[passwordField], 12);
  }
  return data;
}
exports.getAll = async (req, res) => {
  try {
    const scope = await scopeFor(models, req.crudContract, req.user);
    const rows = await model.findAll({ where: scopedWhere(scope) });
    return res.json({ success: true, count: rows.length, data: sanitize(rows, [passwordField]) });
  } catch (error) { return respondError(res, error); }
};
exports.getById = async (req, res) => {
  try {
    const scope = await scopeFor(models, req.crudContract, req.user);
    const row = await model.findOne({ where: scopedWhere(scope, pk, req.params.id) });
    if (!row) return res.status(404).json({ code: 'RECORD_NOT_FOUND' });
    return res.json({ success: true, data: sanitize(row, [passwordField]) });
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
