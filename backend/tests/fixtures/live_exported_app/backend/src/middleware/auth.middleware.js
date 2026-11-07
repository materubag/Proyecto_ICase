/**
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

    const userRole = req.user.role || req.user.rol;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: `Acceso prohibido: Su rol '${userRole || 'sin rol'}' no cuenta con permisos para este recurso. Roles requeridos: [${allowedRoles.join(', ')}].`
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
