/**
 * Rutas REST para Paciente
 * Generado automáticamente por ICASE Studio
 */

const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/paciente.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.get('/', authenticateToken, pacienteController.getAll);
router.get('/:id', authenticateToken, pacienteController.getById);
router.post('/', authenticateToken, pacienteController.create);
router.put('/:id', authenticateToken, pacienteController.update);
router.delete('/:id', authenticateToken, pacienteController.delete);

module.exports = router;
