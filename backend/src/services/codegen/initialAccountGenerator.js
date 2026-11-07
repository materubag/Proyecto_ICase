const { deriveUserFieldMapping } = require('./authGenerator');

function generateInitialAccountScript(spec) {
  const entity = spec.entities.find(e => /^(usuario|user|account|cuenta)$/i.test(e.name));
  const mapping = deriveUserFieldMapping(entity);
  const roleEntity = spec.entities.find(e => /^(rol|role)$/i.test(e.name));
  const roleName = roleEntity?.attributes.find(a => /^(nombre|name|rol|role)$/i.test(a.fieldName))?.fieldName;
  const rolePk = roleEntity?.primaryKey?.fieldName;
  return `require('dotenv').config();
const models = require('./models');
const bcrypt = require('bcryptjs');
const mapping = ${JSON.stringify(mapping)};
const roles = ${JSON.stringify(spec.security?.roles || [])};
async function provision() {
  const { BOOTSTRAP_IDENTIFIER: identifier, BOOTSTRAP_PASSWORD: password, BOOTSTRAP_ROLE: role } = process.env;
  if (!identifier || !password || !roles.includes(role)) throw new Error('Defina BOOTSTRAP_IDENTIFIER, BOOTSTRAP_PASSWORD y un BOOTSTRAP_ROLE aprobado.');
  const profile = JSON.parse(process.env.BOOTSTRAP_PROFILE_JSON || '{}');
  await models.sequelize.transaction(async transaction => {
    const Model = models[mapping.modelName];
    const field = mapping.identifierField || mapping.emailField || mapping.usernameField;
    if (await Model.findOne({ where: { [field]: identifier }, transaction })) throw new Error('La cuenta ya existe; no se modificó.');
    const data = { ...profile, [field]: identifier, [mapping.passwordField]: await bcrypt.hash(password, 12) };
    if (mapping.nameField !== field && !data[mapping.nameField]) data[mapping.nameField] = identifier;
    ${mapping.isRoleFk && roleEntity && roleName && rolePk ? `const [record] = await models[${JSON.stringify(roleEntity.modelName)}].findOrCreate({ where: { [${JSON.stringify(roleName)}]: role }, transaction });
    data[mapping.roleField] = record[${JSON.stringify(rolePk)}];` : mapping.isRoleFk ? `throw new Error('UNRESOLVED: falta el contrato de la entidad de roles.');` : 'data[mapping.roleField] = role;'}
    await Model.create(data, { transaction });
  });
  console.log('Cuenta inicial creada. No se registraron credenciales.');
}
provision().catch(error => { console.error(error.code || error.name, 'No se pudo crear la cuenta; revise los parámetros y el contrato.'); process.exitCode = 1; }).finally(() => models.sequelize.close());
`;
}
module.exports = { generateInitialAccountScript };
