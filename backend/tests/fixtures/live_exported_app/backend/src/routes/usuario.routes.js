/**
 * Rutas REST para Usuario
 * Generado automáticamente por ICASE Studio
 */

const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuario.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.get('/', authenticateToken, usuarioController.getAll);
router.get('/:id', authenticateToken, usuarioController.getById);
router.post('/', authenticateToken, usuarioController.create);
router.put('/:id', authenticateToken, usuarioController.update);
router.delete('/:id', authenticateToken, usuarioController.delete);

module.exports = router;
