function hardenReviewedAuth(source, middleware, routes, spec) {
  if (!spec.credentialChangeContract) return { source, middleware, routes };
  source = source.replaceAll('role: userRole\n', 'role: userRole, cambioObligatorio: user.cambioObligatorio === true\n');
  source = source.replace('const storedHash =', `if (user.activo === false || (user.cambioObligatorio && (!user.temporalVence || new Date(user.temporalVence) <= new Date()))) return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' });\n      const storedHash =`);
  source = source.replaceAll('role: userRole },', 'role: userRole, version: Number(user.versionSesion || 0), mustChange: user.cambioObligatorio === true },');
  source += `\nmodule.exports.changePassword = async (req, res) => {
    try {
      await models.sequelize.transaction(transaction => require('../services/operation.runtime').executeSteps(models, ${JSON.stringify(spec.credentialChangeContract)}, req.body, req.user, transaction));
      res.json({ success: true, message: 'Contraseña actualizada. Inicia sesión nuevamente.' });
    } catch (error) { res.status(error.statusCode || 400).json({ success: false, code: error.code || 'INVALID_INPUT', message: error.message }); }
  };\n`;
  middleware = middleware.replace('(err, user) => {', 'async (err, user) => {');
  middleware = middleware.replace('    req.user = user;', `    try {
      const account = await require('../models').USUARIO.findByPk(user.id);
      if (!account || account.activo === false || Number(user.version || 0) !== Number(account.versionSesion || 0)) return res.status(401).json({ code: 'SESSION_REVOKED' });
      if (account.cambioObligatorio && (!account.temporalVence || new Date(account.temporalVence) <= new Date())) return res.status(401).json({ code: 'TEMPORARY_PASSWORD_EXPIRED' });
      if (account.cambioObligatorio && !req.originalUrl.split('?')[0].endsWith('/auth/change-password')) return res.status(403).json({ code: 'PASSWORD_CHANGE_REQUIRED', message: 'Debes cambiar la contraseña temporal.' });
    } catch (_) { return res.status(503).json({ code: 'AUTH_UNAVAILABLE' }); }
    req.user = user;`);
  routes = routes.replace("router.post('/register', authController.register);", "router.post('/register', (_req, res) => res.status(403).json({ code: 'ADMIN_REGISTRATION_REQUIRED', message: 'Usa el registro de usuarios autorizado para Administrador.' }));");
  routes = routes.replace("router.get('/me', authenticateToken, authController.me);", "router.get('/me', authenticateToken, authController.me);\nrouter.post('/change-password', authenticateToken, authController.changePassword);");
  return { source, middleware, routes };
}
module.exports = { hardenReviewedAuth };
