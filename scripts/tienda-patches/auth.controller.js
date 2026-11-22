/**
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
      const defaultRoleName = "Vendedor";
      let requestedRole = role;

      if (requestedRole && requestedRole !== defaultRoleName) {
        return res.status(403).json({
          success: false,
          code: 'ROLE_ASSIGNMENT_FORBIDDEN',
          message: 'No está permitido autoasignarse un rol privilegiado en el registro público.'
        });
      }

      // Comprobar si ya existe
      const existing = await models.USUARIO.findOne({
        where: {
          [Op.or]: [
            ...(rawIdentifier ? [{ nombreUsuario: rawIdentifier }] : []),
            ...(email || correo ? [{ nombreUsuario: email || correo }] : [])
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
      
      let defaultRoleId = 1;
      if (models.ROL) {
        const roleAttrs = Object.keys(models.ROL.rawAttributes || {});
        const roleQueryWhere = {};
        if (roleAttrs.includes('nombre')) roleQueryWhere.nombre = defaultRoleName;
        else if (roleAttrs.includes('name')) roleQueryWhere.name = defaultRoleName;
        else if (roleAttrs.includes('titulo')) roleQueryWhere.titulo = defaultRoleName;

        let foundRole = await models.ROL.findOne({
          where: Object.keys(roleQueryWhere).length > 0 ? roleQueryWhere : undefined
        });
        if (!foundRole) {
          const roleCreateData = {};
          if (roleAttrs.includes('nombre')) roleCreateData.nombre = defaultRoleName;
          else if (roleAttrs.includes('name')) roleCreateData.name = defaultRoleName;
          else if (roleAttrs.includes('titulo')) roleCreateData.titulo = defaultRoleName;
          try {
            foundRole = await models.ROL.create(roleCreateData);
          } catch (_) {
            foundRole = await models.ROL.findOne();
          }
        }
        if (foundRole) {
          defaultRoleId = foundRole[models.ROL.primaryKeyAttribute] || foundRole.id || foundRole.id_rol || foundRole.rol_id || 1;
        }
      }
      roleValue = defaultRoleId;
      

      const createData = {
        password: hashedPassword,
        rolId: roleValue
      };
      if ('nombreUsuario' && 'nombreUsuario' !== 'password') createData.nombreUsuario = rawIdentifier;
      if ('null' && 'null' !== 'nombreUsuario' && 'null' !== 'password') createData.null = email || correo || rawIdentifier;
      if ('nombre' && 'nombre' !== 'nombreUsuario' && 'nombre' !== 'null') createData.nombre = nombre || rawIdentifier;

      const user = await models.USUARIO.create(createData);

      // Generar token JWT con expiración de 8 horas
      const token = jwt.sign(
        { id: user.id, username: user.nombreUsuario || rawIdentifier, role: defaultRoleName },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      // Respuesta pública excluyendo estrictamente contraseñas y hashes
      const userResponse = {
        id: user.id,
        username: user.nombreUsuario || rawIdentifier,
        email: user.nombreUsuario || rawIdentifier,
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
      const hasScope = typeof models.USUARIO.options?.scopes?.withPassword !== 'undefined';
      const userQuery = hasScope ? models.USUARIO.scope('withPassword') : models.USUARIO;

      // Incluir asociación de rol si existe en el modelo
      const roleAssoc = models.USUARIO.associations && (
        models.USUARIO.associations.ROL ||
        models.USUARIO.associations.Rol ||
        models.USUARIO.associations.Role ||
        models.USUARIO.associations.role ||
        Object.values(models.USUARIO.associations).find(a => (a.target?.name || '').toLowerCase() === 'ROL'.toLowerCase())
      );
      const searchConditions = [];
      if ('nombreUsuario') {
        searchConditions.push({ nombreUsuario: identifier });
      }
      if ('null' && 'null' !== 'nombreUsuario') {
        searchConditions.push({ null: identifier });
      }
      if ('nombre' && 'nombre' !== 'nombreUsuario' && 'nombre' !== 'null') {
        searchConditions.push({ nombre: identifier });
      }
      if ('null' && !identifier.includes('@')) {
        const likeOp = models.USUARIO.sequelize?.getDialect() === 'postgres' ? Op.iLike : Op.like;
        searchConditions.push({
          null: { [likeOp]: `${identifier}@%` }
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
      const storedHash = user.contrasenaHash || user.contrasena_hash || user.password || user.passwordHash || user.contrasena || user.clave;
      if (!storedHash) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Credenciales inválidas.'
        });
      }

      const isValid = (await bcrypt.compare(password, storedHash).catch(() => false)) || (storedHash === password);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Credenciales inválidas: contraseña incorrecta.'
        });
      }

      // Resolver nombre de rol efectivo según el modelo aprobado
      let userRole = "Vendedor";
      if (user.ROL?.nombre || user.ROL?.name || user.Rol?.nombre || user.Role?.name || user.role?.name) {
        userRole = user.ROL?.nombre || user.ROL?.name || user.Rol?.nombre || user.Role?.name || user.role?.name;
      } else if (user.rolId && typeof user.rolId === 'string' && isNaN(Number(user.rolId))) {
        userRole = user.rolId;
      } else if (user.rolId) {
        try {
          const roleModel = models.ROL || models.Rol || models.Role || models.roles;
          if (roleModel) {
            const rRecord = await roleModel.findByPk(user.rolId);
            if (rRecord) {
              userRole = rRecord.nombre || rRecord.name || rRecord.titulo || rRecord.title || rRecord.rol || userRole;
            }
          }
        } catch (_) {}
      }

      const token = jwt.sign(
        { id: user.id, username: user.nombreUsuario || identifier, role: userRole },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      // Exclusión estricta de hash de contraseña en la respuesta pública
      const userResponse = {
        id: user.id,
        username: user.nombreUsuario || identifier,
        email: user.nombreUsuario || identifier,
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
      const roleAssoc = models.USUARIO.associations && (
        models.USUARIO.associations.ROL ||
        models.USUARIO.associations.Rol ||
        models.USUARIO.associations.Role ||
        models.USUARIO.associations.role ||
        Object.values(models.USUARIO.associations).find(a => (a.target?.name || '').toLowerCase() === 'ROL'.toLowerCase())
      );
      const queryOptions = {};
      if (roleAssoc) {
        queryOptions.include = [{ association: roleAssoc }];
      }

      const user = await models.USUARIO.findByPk(req.user.id, queryOptions);

      if (!user) {
        return res.status(404).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado en la base de datos.'
        });
      }

      let userRole = req.user.role || "Vendedor";
      if (user.ROL?.nombre || user.ROL?.name || user.Rol?.nombre || user.Role?.name || user.role?.name) {
        userRole = user.ROL?.nombre || user.ROL?.name || user.Rol?.nombre || user.Role?.name || user.role?.name;
      } else if (user.rolId && typeof user.rolId === 'string' && isNaN(Number(user.rolId))) {
        userRole = user.rolId;
      } else if (user.rolId) {
        try {
          const roleModel = models.ROL || models.Rol || models.Role || models.roles;
          if (roleModel) {
            const rRecord = await roleModel.findByPk(user.rolId);
            if (rRecord) {
              userRole = rRecord.nombre || rRecord.name || rRecord.titulo || rRecord.title || rRecord.rol || userRole;
            }
          }
        } catch (_) {}
      }

      const userResponse = {
        id: user.id,
        username: user.nombreUsuario || req.user.username,
        email: user.nombreUsuario || null,
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
