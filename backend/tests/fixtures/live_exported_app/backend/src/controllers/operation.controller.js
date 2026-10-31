/**
 * Controlador de Operaciones de Negocio
 * Generado automáticamente por ICASE Studio
 */

const operationService = require('../services/operation.service');

const OperationController = {
  async registrarPaciente(req, res) {
    try {
      const payload = req.body || {};
      const result = await operationService.registrarPaciente(payload, req.user);
      return res.status(201).json({
        success: true,
        data: result,
        message: 'Operación ejecutada exitosamente'
      });
    } catch (error) {
      console.error('Error en operación registrarPaciente:', error);
      return res.status(error.statusCode || 400).json({
        success: false,
        error: error.code || 'OPERATION_ERROR',
        code: error.code || 'OPERATION_ERROR',
        rule: error.rule || undefined,
        message: error.message
      });
    }
  },
};

module.exports = OperationController;
