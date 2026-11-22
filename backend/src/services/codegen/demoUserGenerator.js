'use strict';

const { deriveUserFieldMapping } = require('./authGenerator');

function generateDemoUserSeedScript(spec = {}) {
  const entity = (spec.entities || []).find(e => /^(usuario|user|account|cuenta)$/i.test(e.name));
  const mapping = deriveUserFieldMapping(entity);
  const roleEntity = (spec.entities || []).find(e => /^(rol|role)$/i.test(e.name));
  const roleNameField = roleEntity?.attributes?.find(a => /^(nombre|name|rol|role|titulo)$/i.test(a.fieldName))?.fieldName || 'nombre';
  const rolePk = roleEntity?.primaryKey?.fieldName || 'id';

  const actors = Array.isArray(spec.actors) && spec.actors.length > 0
    ? spec.actors.map(a => a.name || a)
    : (spec.security?.roles || ['Administrador', 'Cliente']);

  const demoAccounts = [];
  for (const roleName of actors) {
    const slug = String(roleName)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    demoAccounts.push({
      role: roleName,
      email: slug.includes('admin') ? 'admin@nexora.ec' : `${slug}@nexora.ec`,
      name: `${roleName} Nexora`,
      password: 'Password123!'
    });

    demoAccounts.push({
      role: roleName,
      email: slug.includes('admin') ? 'administrador@tienda.com' : `${slug}@tienda.com`,
      name: `${roleName} Tienda`,
      password: 'Password123!'
    });
  }

  return `require('dotenv').config();
const bcrypt = require('bcryptjs');
const models = require('./models');

const DEMO_ACCOUNTS = ${JSON.stringify(demoAccounts, null, 2)};
const ROLE_ENTITY = ${JSON.stringify(roleEntity?.modelName || 'ROL')};
const ROLE_NAME_FIELD = ${JSON.stringify(roleNameField)};
const ROLE_PK_FIELD = ${JSON.stringify(rolePk)};
const USER_ENTITY = ${JSON.stringify(mapping.modelName || 'USUARIO')};
const EMAIL_FIELD = ${JSON.stringify(mapping.emailField || mapping.identifierField || 'correo')};
const NAME_FIELD = ${JSON.stringify(mapping.nameField || 'nombre')};
const PASS_FIELD = ${JSON.stringify(mapping.passwordField || 'hashContrasena')};
const ROLE_FK_FIELD = ${JSON.stringify(mapping.roleField || 'rolId')};

async function seedDemoUsers() {
  console.log('🌱 Inicializando roles y cuentas demo del sistema...');
  await models.sequelize.authenticate();

  const hashedPassword = await bcrypt.hash('Password123!', 10);

  for (const acc of DEMO_ACCOUNTS) {
    let roleId = null;
    if (models[ROLE_ENTITY]) {
      const [roleRec] = await models[ROLE_ENTITY].findOrCreate({
        where: { [ROLE_NAME_FIELD]: acc.role },
        defaults: { [ROLE_NAME_FIELD]: acc.role, descripcion: 'Rol ' + acc.role }
      });
      roleId = roleRec[ROLE_PK_FIELD] || roleRec.id;
    }

    if (models[USER_ENTITY]) {
      const userDefaults = {
        [EMAIL_FIELD]: acc.email,
        [NAME_FIELD]: acc.name,
        [PASS_FIELD]: hashedPassword,
        contrasenaHash: hashedPassword,
        password: hashedPassword,
        activo: true,
        estado: 'ACTIVO'
      };
      if (roleId) userDefaults[ROLE_FK_FIELD] = roleId;

      const [userRec, created] = await models[USER_ENTITY].findOrCreate({
        where: { [EMAIL_FIELD]: acc.email },
        defaults: userDefaults
      });
      if (created) {
        console.log('✅ Cuenta demo creada: ' + acc.email + ' (' + acc.role + ')');
      } else {
        await userRec.update({
          [PASS_FIELD]: hashedPassword,
          contrasenaHash: hashedPassword,
          password: hashedPassword,
          activo: true,
          estado: 'ACTIVO',
          ...(roleId ? { [ROLE_FK_FIELD]: roleId } : {})
        }).catch(() => {});
        console.log('🔄 Cuenta demo actualizada con credenciales válidas: ' + acc.email);
      }
    }
  }

  console.log('✅ Roles y usuarios demo listos para iniciar sesión.');
}

seedDemoUsers()
  .catch(err => {
    console.error('⚠️ No se pudieron aprovisionar cuentas demo:', err.message);
  })
  .finally(() => models.sequelize.close());
`;
}

module.exports = { generateDemoUserSeedScript };
