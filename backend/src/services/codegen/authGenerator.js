/**
 * Authentication and Authorization Generator
 * Produces real JWT authentication, bcryptjs password hashing,
 * and role-based access control (RBAC) middleware for Express + Sequelize.
 */

const { deriveNaming } = require('./typeMapper');

function generateAuthMiddlewareFile() {
  return `/**
 * Middleware de Autenticación y Autorización JWT
 * Generado automáticamente por ICASE Studio
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: La variable de entorno JWT_SECRET no está definida. Es obligatoria para la seguridad de la aplicación.');
}

/**
 * Verifica la validez del token JWT en el encabezado Authorization: Bearer <token>
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHENTICATED',
      message: 'Acceso denegado: Token de autenticación no proporcionado en encabezado Authorization.'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          code: 'TOKEN_EXPIRED',
          message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
        });
      }
      return res.status(401).json({
        success: false,
        code: 'INVALID_TOKEN',
        message: 'Acceso denegado: Token inválido o corrupto.'
      });
    }

    req.user = user;
    next();
  });
}

/**
 * Control de Acceso Basado en Roles (RBAC)
 * Requiere que el usuario autenticado posea al menos uno de los roles autorizados
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 'UNAUTHENTICATED',
        message: 'Acceso denegado: Sesión no autenticada.'
      });
    }

    if (allowedRoles.length === 0) {
      return next();
    }

    const norm = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim();
    const userRole = req.user.role || req.user.rol;
    if (!userRole || !allowedRoles.some((role) => norm(role) === norm(userRole))) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: \`Acceso prohibido: Su rol '\${userRole || 'sin rol'}' no cuenta con permisos para este recurso. Roles requeridos: [\${allowedRoles.join(', ')}].\`
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles,
  JWT_SECRET
};
`;
}

/**
 * Resolves model attribute mapping for authentication against approved domain entities
 */
function deriveUserFieldMapping(userEntity) {
  if (!userEntity || !userEntity.attributes) {
    return {
      modelName: 'AuthUser',
      tableName: 'auth_users',
      idField: 'id',
      usernameField: 'username',
      emailField: 'email',
      passwordField: 'password',
      nameField: 'username',
      roleField: 'role',
      isGeneric: true,
      hasPasswordField: true,
      hasIdentifierField: true
    };
  }

  const attrs = userEntity.attributes || [];
  const naming = deriveNaming(userEntity.name);

  // 1. Primary key
  const pkAttr = attrs.find(a => a.isPk) || attrs[0];
  const idField = pkAttr ? (pkAttr.fieldName || pkAttr.name) : 'id';

  // 2. Password field
  const passAttr = attrs.find(a => /^(password_?hash|passwordhash|password|contrasena|contrase[ñn]a|clave|hash|secret)$/i.test(a.fieldName || a.name || ''));
  const passwordField = passAttr ? (passAttr.fieldName || passAttr.name) : 'password';

  // 3. Email field
  const emailAttr = attrs.find(a => /^(email|correo|correo_?electronico|mail)$/i.test(a.fieldName || a.name || ''));
  const emailField = emailAttr ? (emailAttr.fieldName || emailAttr.name) : null;

  // 4. Username / Login field
  const userAttr = attrs.find(a => /^(username|usuario|login|nombre_?usuario|user_?name|identificador|nick)$/i.test(a.fieldName || a.name || ''));
  const usernameField = userAttr ? (userAttr.fieldName || userAttr.name) : (emailField || 'username');

  // 5. Name / Display field
  const nameAttr = attrs.find(a => /^(name|nombre|nombre_?completo|full_?name|nombres)$/i.test(a.fieldName || a.name || ''));
  const nameField = nameAttr ? (nameAttr.fieldName || nameAttr.name) : (usernameField || 'nombre');

  // 6. Role field
  const roleAttr = attrs.find(a => /^(role|rol|perfil|tipo|tipo_?usuario|rol_?nombre|rol_?id|role_?id|id_?rol|id_?role)$/i.test(a.fieldName || a.name || ''));
  const roleField = roleAttr ? (roleAttr.fieldName || roleAttr.name) : 'role';
  const isRoleFk = /(_id|Id)$/i.test(roleField) || /^(id_rol|id_role)$/i.test(roleField) || /INTEGER|INT|BIGINT|UUID/i.test(roleAttr?.type || roleAttr?.dataType || '');

  return {
    modelName: naming.modelName,
    tableName: naming.tableName,
    idField,
    identifierField: usernameField || emailField || 'identifier',
    usernameField,
    emailField,
    passwordField,
    nameField,
    roleField,
    isGeneric: false,
    hasPasswordField: !!passAttr,
    hasIdentifierField: !!(userAttr || emailAttr || nameAttr),
    isRoleFk
  };
}

function generateAuthControllerFile(userEntity = null, approvedRoles = [], entities = []) {
  const mapping = deriveUserFieldMapping(userEntity);
  const modelName = mapping.modelName;
  const passCol = mapping.passwordField;
  const emailCol = mapping.emailField;
  const userCol = mapping.usernameField;
  const nameCol = mapping.nameField;
  const roleCol = mapping.roleField;
  const idCol = mapping.idField;
  const isRoleFk = mapping.isRoleFk;

  const validRoles = Array.isArray(approvedRoles) && approvedRoles.length > 0
    ? approvedRoles
    : ['Usuario'];

  // Identify default unprivileged role strictly from approved project roles
  const nonPrivilegedRole = validRoles.find(r => !/admin|administrador|gerente|supervisor|jefe|root/i.test(r)) || validRoles[0];
  const roleEntity = (entities || []).find(e => /^(rol|role|perfil)$/i.test(e.name));
  const roleModelName = roleEntity ? deriveNaming(roleEntity.name).modelName : 'Rol';
  const compareTarget = passCol === 'password' ? 'user.password' : `(user.${passCol} || user.password)`;

  return `/**
 * Controlador de Autenticación
 * Generado automáticamente por ICASE Studio
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { JWT_SECRET } = require('../middleware/auth.middleware');
const models = require('../models');

const AuthController = {
  /**
   * Registro de nuevo usuario con hashing seguro mediante bcryptjs
   */
  async register(req, res) {
    try {
      let { username, email, password, role, nombre, correo, contrasena, clave, usuario } = req.body;
      const rawPassword = password || contrasena || clave;
      const rawIdentifier = username || usuario || email || correo || nombre;

      if (!rawPassword || !rawIdentifier) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Usuario/email y contraseña son obligatorios.'
        });
      }

      // Validar asignación de rol: impedir autoasignarse un rol privilegiado en registro público
      const defaultRoleName = ${JSON.stringify(nonPrivilegedRole)};
      let requestedRole = role;

      if (requestedRole && requestedRole !== defaultRoleName) {
        return res.status(403).json({
          success: false,
          code: 'ROLE_ASSIGNMENT_FORBIDDEN',
          message: 'No está permitido autoasignarse un rol privilegiado en el registro público.'
        });
      }

      // Comprobar si ya existe
      const existing = await models.${modelName}.findOne({
        where: {
          [Op.or]: [
            ...(rawIdentifier ? [{ ${userCol}: rawIdentifier }] : []),
            ...(email || correo ? [{ ${emailCol || userCol}: email || correo }] : [])
          ]
        }
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          code: 'USER_ALREADY_EXISTS',
          message: 'El nombre de usuario o correo ya se encuentra registrado.'
        });
      }

      // Hash seguro con salt rounds = 10 utilizando la contraseña normalizada
      password = rawPassword;
      const hashedPassword = await bcrypt.hash(password, 10);

      // Determinar valor para la columna de rol respetando claves foráneas numéricas
      let roleValue = defaultRoleName;
      ${isRoleFk ? `
      let defaultRoleId = 1;
      if (models.${roleModelName}) {
        const roleAttrs = Object.keys(models.${roleModelName}.rawAttributes || {});
        const roleQueryWhere = {};
        if (roleAttrs.includes('nombre')) roleQueryWhere.nombre = defaultRoleName;
        else if (roleAttrs.includes('name')) roleQueryWhere.name = defaultRoleName;
        else if (roleAttrs.includes('titulo')) roleQueryWhere.titulo = defaultRoleName;

        let foundRole = await models.${roleModelName}.findOne({
          where: Object.keys(roleQueryWhere).length > 0 ? roleQueryWhere : undefined
        });
        if (!foundRole) {
          const roleCreateData = {};
          if (roleAttrs.includes('nombre')) roleCreateData.nombre = defaultRoleName;
          else if (roleAttrs.includes('name')) roleCreateData.name = defaultRoleName;
          else if (roleAttrs.includes('titulo')) roleCreateData.titulo = defaultRoleName;
          try {
            foundRole = await models.${roleModelName}.create(roleCreateData);
          } catch (_) {
            foundRole = await models.${roleModelName}.findOne();
          }
        }
        if (foundRole) {
          defaultRoleId = foundRole[models.${roleModelName}.primaryKeyAttribute] || foundRole.id || foundRole.id_rol || foundRole.rol_id || 1;
        }
      }
      roleValue = defaultRoleId;
      ` : ''}

      const createData = {
        ${passCol}: hashedPassword,
        ${roleCol}: roleValue
      };
      if ('${userCol}' && '${userCol}' !== '${passCol}') createData.${userCol} = rawIdentifier;
      if ('${emailCol}' && '${emailCol}' !== '${userCol}' && '${emailCol}' !== '${passCol}') createData.${emailCol} = email || correo || rawIdentifier;
      if ('${nameCol}' && '${nameCol}' !== '${userCol}' && '${nameCol}' !== '${emailCol}') createData.${nameCol} = nombre || rawIdentifier;

      const user = await models.${modelName}.create(createData);

      // Generar token JWT con expiración de 8 horas
      const token = jwt.sign(
        { id: user.${idCol}, username: user.${userCol} || rawIdentifier, role: defaultRoleName },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      // Respuesta pública excluyendo estrictamente contraseñas y hashes
      const userResponse = {
        id: user.${idCol},
        username: user.${userCol} || rawIdentifier,
        email: user.${emailCol || userCol} || rawIdentifier,
        role: defaultRoleName
      };

      return res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        token,
        user: userResponse
      });
    } catch (error) {
      console.error('Error en registro:', error);
      return res.status(500).json({
        success: false,
        code: 'REGISTRATION_ERROR',
        message: error.message
      });
    }
  },

  /**
   * Inicio de sesión con validación de credenciales mediante bcrypt.compare
   */
  async login(req, res) {
    try {
      let { username, email, password, correo, usuario, contrasena, clave } = req.body;
      const identifier = req.body.identifier || username || usuario || email || correo;
      const rawPassword = password || contrasena || clave;

      if (!identifier || !rawPassword) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Identificador (usuario/email) y contraseña son obligatorios.'
        });
      }

      // Buscar usuario en base de datos; verificar si el modelo soporta scope 'withPassword'
      const hasScope = typeof models.${modelName}.options?.scopes?.withPassword !== 'undefined';
      const userQuery = hasScope ? models.${modelName}.scope('withPassword') : models.${modelName};

      // Incluir asociación de rol si existe en el modelo
      const roleAssoc = models.${modelName}.associations && (
        models.${modelName}.associations.${roleModelName} ||
        models.${modelName}.associations.Rol ||
        models.${modelName}.associations.Role ||
        models.${modelName}.associations.role ||
        Object.values(models.${modelName}.associations).find(a => (a.target?.name || '').toLowerCase() === '${roleModelName}'.toLowerCase())
      );
      const searchConditions = [];
      if ('${userCol}') {
        searchConditions.push({ ${userCol}: identifier });
      }
      if ('${emailCol}' && '${emailCol}' !== '${userCol}') {
        searchConditions.push({ ${emailCol}: identifier });
      }
      if ('${nameCol}' && '${nameCol}' !== '${userCol}' && '${nameCol}' !== '${emailCol}') {
        searchConditions.push({ ${nameCol}: identifier });
      }
      if ('${emailCol}' && !identifier.includes('@')) {
        const likeOp = models.${modelName}.sequelize?.getDialect() === 'postgres' ? Op.iLike : Op.like;
        searchConditions.push({
          ${emailCol}: { [likeOp]: \`\${identifier}@%\` }
        });
      }

      const queryOptions = {
        where: {
          [Op.or]: searchConditions.length > 0 ? searchConditions : [{ id: 0 }]
        }
      };
      if (roleAssoc) {
        queryOptions.include = [{ association: roleAssoc }];
      }

      const user = await userQuery.findOne(queryOptions);

      if (!user) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Credenciales inválidas: usuario no encontrado.'
        });
      }

      // Validar contraseña normalizada contra hash almacenado
      password = rawPassword;
      const storedHash = ${compareTarget};
      if (!storedHash) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Credenciales inválidas.'
        });
      }

      const isValid = await bcrypt.compare(password, ${compareTarget});
      if (!isValid) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Credenciales inválidas: contraseña incorrecta.'
        });
      }

      // Resolver nombre de rol efectivo según el modelo aprobado
      let userRole = ${JSON.stringify(nonPrivilegedRole)};
      if (user.${roleModelName}?.nombre || user.${roleModelName}?.name || user.Rol?.nombre || user.Role?.name || user.role?.name) {
        userRole = user.${roleModelName}?.nombre || user.${roleModelName}?.name || user.Rol?.nombre || user.Role?.name || user.role?.name;
      } else if (user.${roleCol} && typeof user.${roleCol} === 'string' && isNaN(Number(user.${roleCol}))) {
        userRole = user.${roleCol};
      } else if (user.${roleCol}) {
        try {
          const roleModel = models.${roleModelName} || models.Rol || models.Role || models.roles;
          if (roleModel) {
            const rRecord = await roleModel.findByPk(user.${roleCol});
            if (rRecord) {
              userRole = rRecord.nombre || rRecord.name || rRecord.titulo || rRecord.title || rRecord.rol || userRole;
            }
          }
        } catch (_) {}
      }

      const token = jwt.sign(
        { id: user.${idCol}, username: user.${userCol} || identifier, role: userRole },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      // Exclusión estricta de hash de contraseña en la respuesta pública
      const userResponse = {
        id: user.${idCol},
        username: user.${userCol} || identifier,
        email: user.${emailCol || userCol} || identifier,
        role: userRole
      };

      return res.status(200).json({
        success: true,
        message: 'Inicio de sesión exitoso',
        token,
        user: userResponse
      });
    } catch (error) {
      console.error('Error en login:', error);
      return res.status(500).json({
        success: false,
        code: 'LOGIN_ERROR',
        message: error.message
      });
    }
  },

  /**
   * Obtiene la información del usuario autenticado en la sesión actual
   */
  async me(req, res) {
    try {
      const roleAssoc = models.${modelName}.associations && (
        models.${modelName}.associations.${roleModelName} ||
        models.${modelName}.associations.Rol ||
        models.${modelName}.associations.Role ||
        models.${modelName}.associations.role ||
        Object.values(models.${modelName}.associations).find(a => (a.target?.name || '').toLowerCase() === '${roleModelName}'.toLowerCase())
      );
      const queryOptions = {};
      if (roleAssoc) {
        queryOptions.include = [{ association: roleAssoc }];
      }

      const user = await models.${modelName}.findByPk(req.user.id, queryOptions);

      if (!user) {
        return res.status(404).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado en la base de datos.'
        });
      }

      let userRole = req.user.role || ${JSON.stringify(nonPrivilegedRole)};
      if (user.${roleModelName}?.nombre || user.${roleModelName}?.name || user.Rol?.nombre || user.Role?.name || user.role?.name) {
        userRole = user.${roleModelName}?.nombre || user.${roleModelName}?.name || user.Rol?.nombre || user.Role?.name || user.role?.name;
      } else if (user.${roleCol} && typeof user.${roleCol} === 'string' && isNaN(Number(user.${roleCol}))) {
        userRole = user.${roleCol};
      } else if (user.${roleCol}) {
        try {
          const roleModel = models.${roleModelName} || models.Rol || models.Role || models.roles;
          if (roleModel) {
            const rRecord = await roleModel.findByPk(user.${roleCol});
            if (rRecord) {
              userRole = rRecord.nombre || rRecord.name || rRecord.titulo || rRecord.title || rRecord.rol || userRole;
            }
          }
        } catch (_) {}
      }

      const userResponse = {
        id: user.${idCol},
        username: user.${userCol} || req.user.username,
        email: user.${emailCol || userCol} || null,
        role: userRole
      };

      return res.status(200).json({
        success: true,
        user: userResponse
      });
    } catch (error) {
      console.error('Error en me:', error);
      return res.status(500).json({
        success: false,
        code: 'PROFILE_ERROR',
        message: error.message
      });
    }
  }
};

module.exports = AuthController;
`;
}

function generateAuthRoutesFile() {
  return `/**
 * Rutas de Autenticación
 * Generado automáticamente por ICASE Studio
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// Registro y Login públicos
router.post('/register', authController.register);
router.post('/login', authController.login);

// Consulta de perfil protegido por token
router.get('/me', authenticateToken, authController.me);

module.exports = router;
`;
}

function generateAuthUserModelFile() {
  return `/**
 * Modelo AuthUser para autenticación y RBAC
 * Generado automáticamente por ICASE Studio
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AuthUser = sequelize.define('AuthUser', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Usuario'
    }
  }, {
    tableName: 'auth_users',
    timestamps: true,
    underscored: true,
    defaultScope: {
      attributes: { exclude: ['password'] }
    },
    scopes: {
      withPassword: {
        attributes: { include: ['password'] }
      }
    }
  });

  return AuthUser;
};
`;
}

function generateAuthUserMigrationFile(timestamp = '20261026000000') {
  return `'use strict';

/**
 * Migración para tabla auth_users
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auth_users', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      role: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Usuario'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("now")
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("now")
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('auth_users');
  }
};
`;
}

module.exports = {
  deriveUserFieldMapping,
  generateAuthMiddlewareFile,
  generateAuthControllerFile,
  generateAuthRoutesFile,
  generateAuthUserModelFile,
  generateAuthUserMigrationFile
};
