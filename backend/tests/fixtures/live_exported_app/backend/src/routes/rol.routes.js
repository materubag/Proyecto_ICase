/**
 * Rutas REST para Rol
 * Generado automáticamente por ICASE Studio
 */

const express = require('express');
const router = express.Router();
const rolController = require('../controllers/rol.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

router.get('/', authenticateToken, rolController.getAll);
router.get('/:id', authenticateToken, rolController.getById);
router.post('/', authenticateToken, rolController.create);
router.put('/:id', authenticateToken, rolController.update);
router.delete('/:id', authenticateToken, rolController.delete);

module.exports = router;
