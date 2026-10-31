/**
 * Rutas de Operaciones de Negocio
 * Generado automáticamente por ICASE Studio
 */

const express = require('express');
const router = express.Router();
const operationController = require('../controllers/operation.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');

// Registrar Paciente (op_registrar_paciente)
router.post('/registrar-paciente', authenticateToken, authorizeRoles('Recepcionista', 'Director'), operationController.registrarPaciente);

module.exports = router;
