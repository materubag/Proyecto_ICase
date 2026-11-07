/**
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
