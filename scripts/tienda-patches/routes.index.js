/**
 * Enrutador Central de la API
 * Generado automáticamente por ICASE Studio
 */

const express = require('express');
const router = express.Router();

// Importación de rutas por entidad y seguridad
const authRoutes = require('./auth.routes');
const uploadRoutes = require('./upload.routes');
const detalleVENTARoutes = require('./detalleVENTA.routes');
const movimientoINVENTARIORoutes = require('./movimientoINVENTARIO.routes');
const productoRoutes = require('./producto.routes');
const rolRoutes = require('./rol.routes');
const sesionRoutes = require('./sesion.routes');
const tipoMOVIMIENTOINVENTARIORoutes = require('./tipoMOVIMIENTOINVENTARIO.routes');
const usuarioRoutes = require('./usuario.routes');
const ventaRoutes = require('./venta.routes');
const operationRoutes = require('./operation.routes');
const workshopFlowRoutes = require('./workshopFlow.routes');
const vendedorRoutes = require('./vendedor.routes');
const { handleWorkshopRuntimeRequest } = require('../services/workshopFlowRuntime');

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
router.use('/upload', uploadRoutes);
router.use('/detalle-ventas', detalleVENTARoutes);
router.use('/movimiento-inventarios', movimientoINVENTARIORoutes);
router.use('/productos', productoRoutes);
router.use('/roles', rolRoutes);
router.use('/sesiones', sesionRoutes);
router.use('/tipo-movimiento-inventarios', tipoMOVIMIENTOINVENTARIORoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/vendedores', vendedorRoutes);
router.use('/ventas', ventaRoutes);
router.use('/operations', operationRoutes);
router.use('/workshop-flow', workshopFlowRoutes);
router.all('/diagnostico-fallas*', async (req, res, next) => {
  try {
    return await handleWorkshopRuntimeRequest('autron', req, res);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
