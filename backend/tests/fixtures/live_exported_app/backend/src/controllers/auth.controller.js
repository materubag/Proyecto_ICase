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
      const defaultRoleName = "Recepcionista";
      let requestedRole = role;

      if (requestedRole && requestedRole !== defaultRoleName) {
        return res.status(403).json({
          success: false,
          code: 'ROLE_ASSIGNMENT_FORBIDDEN',
          message: 'No está permitido autoasignarse un rol privilegiado en el registro público.'
        });
      }

      // Comprobar si ya existe
      const existing = await models.Usuario.findOne({
        where: {
          [Op.or]: [
            ...(rawIdentifier ? [{ email: rawIdentifier }] : []),
            ...(email || correo ? [{ email: email || correo }] : [])
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
      if (models.Rol) {
        const roleAttrs = Object.keys(models.Rol.rawAttributes || {});
        const roleQueryWhere = {};
        if (roleAttrs.includes('nombre')) roleQueryWhere.nombre = defaultRoleName;
        else if (roleAttrs.includes('name')) roleQueryWhere.name = defaultRoleName;
        else if (roleAttrs.includes('titulo')) roleQueryWhere.titulo = defaultRoleName;

        const foundRole = await models.Rol.findOne({
          where: Object.keys(roleQueryWhere).length > 0 ? roleQueryWhere : undefined
        });
        if (foundRole) {
          defaultRoleId = foundRole[models.Rol.primaryKeyAttribute] || foundRole.id || foundRole.id_rol || foundRole.rol_id || 1;
        }
      }
      roleValue = defaultRoleId;
      

      const createData = {
        password: hashedPassword,
        rolId: roleValue
      };
      if ('email' && 'email' !== 'password') createData.email = rawIdentifier;
      if ('email' && 'email' !== 'email' && 'email' !== 'password') createData.email = email || correo || rawIdentifier;
      if ('email' && 'email' !== 'email' && 'email' !== 'email') createData.email = nombre || rawIdentifier;

      const user = await models.Usuario.create(createData);

      // Generar token JWT con expiración de 8 horas
      const token = jwt.sign(
        { id: user.idUsuario, username: user.email || rawIdentifier, role: defaultRoleName },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      // Respuesta pública excluyendo estrictamente contraseñas y hashes
      const userResponse = {
        id: user.idUsuario,
        username: user.email || rawIdentifier,
        email: user.email || rawIdentifier,
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
      const hasScope = typeof models.Usuario.options?.scopes?.withPassword !== 'undefined';
      const userQuery = hasScope ? models.Usuario.scope('withPassword') : models.Usuario;

      // Incluir asociación de rol si existe en el modelo
      const roleAssoc = models.Usuario.associations && (models.Usuario.associations.Rol || models.Usuario.associations.Rol || models.Usuario.associations.Role || models.Usuario.associations.role);
      const queryOptions = {
        where: {
          [Op.or]: [
            { email: identifier },
            { email: identifier }
          ]
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
      const storedHash = user.password;
      if (!storedHash) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Credenciales inválidas.'
        });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Credenciales inválidas: contraseña incorrecta.'
        });
      }

      // Resolver nombre de rol efectivo según el modelo aprobado
      let userRole = "Recepcionista";
      if (user.Rol?.nombre || user.Rol?.name || user.Rol?.nombre || user.Role?.name || user.role?.name) {
        userRole = user.Rol?.nombre || user.Rol?.name || user.Rol?.nombre || user.Role?.name || user.role?.name;
      } else if (user.rolId && typeof user.rolId === 'string') {
        userRole = user.rolId;
      } else if (user.rolId && typeof user.rolId === 'number') {
        userRole = "Recepcionista";
      }

      const token = jwt.sign(
        { id: user.idUsuario, username: user.email || identifier, role: userRole },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      // Exclusión estricta de hash de contraseña en la respuesta pública
      const userResponse = {
        id: user.idUsuario,
        username: user.email || identifier,
        email: user.email || identifier,
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
      const roleAssoc = models.Usuario.associations && (models.Usuario.associations.Rol || models.Usuario.associations.Rol || models.Usuario.associations.Role || models.Usuario.associations.role);
      const queryOptions = {};
      if (roleAssoc) {
        queryOptions.include = [{ association: roleAssoc }];
      }

      const user = await models.Usuario.findByPk(req.user.id, queryOptions);

      if (!user) {
        return res.status(404).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado en la base de datos.'
        });
      }

      let userRole = req.user.role || "Recepcionista";
      if (user.Rol?.nombre || user.Rol?.name || user.Rol?.nombre || user.Role?.name || user.role?.name) {
        userRole = user.Rol?.nombre || user.Rol?.name || user.Rol?.nombre || user.Role?.name || user.role?.name;
      } else if (user.rolId && typeof user.rolId === 'string') {
        userRole = user.rolId;
      }

      const userResponse = {
        id: user.idUsuario,
        username: user.email || req.user.username,
        email: user.email || null,
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
