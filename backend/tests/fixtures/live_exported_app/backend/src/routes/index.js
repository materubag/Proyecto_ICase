/**
 * Enrutador Central de la API
 * Generado automáticamente por ICASE Studio
 */

const express = require('express');
const router = express.Router();

// Importación de rutas por entidad y seguridad
const authRoutes = require('./auth.routes');
const rolRoutes = require('./rol.routes');
const usuarioRoutes = require('./usuario.routes');
const pacienteRoutes = require('./paciente.routes');
const operationRoutes = require('./operation.routes');

// Healthcheck de la API
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Montaje de rutas de autenticación, entidades y operaciones
router.use('/auth', authRoutes);
router.use('/roles', rolRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/pacientes', pacienteRoutes);
router.use('/operations', operationRoutes);

module.exports = router;
