/**
 * Servicio de Operaciones de Negocio Transaccionales
 * Generado automáticamente por ICASE Studio
 */

const models = require('../models');

const OperationService = {
  /**
   * Operación de Negocio: Registrar Paciente
   * ID: op_registrar_paciente
   * Modelo Objetivo: Paciente
   */
  async registrarPaciente(payload = {}, user = null, options = {}) {
    const { sequelize } = require('../models');
    
    // Iniciar transacción de base de datos para atomicidad y rollback
    const t = await sequelize.transaction();
    try {
      if (!payload || typeof payload !== 'object') {
        const err = new Error('Payload inválido para la operación Registrar Paciente');
        err.statusCode = 400;
        err.code = 'INVALID_PAYLOAD';
        throw err;
      }

      // Regla: El documento debe tener al menos 6 caracteres (BR_DOC_VALIDO)
      if (!(payload.documento && String(payload.documento).length >= 6)) {
        const err = new Error('Violación de regla de negocio: El documento debe tener al menos 6 caracteres');
        err.statusCode = 422;
        err.code = 'BUSINESS_RULE_VIOLATION';
        err.rule = 'BR_DOC_VALIDO';
        throw err;
      }

      // Creación explícita en modelo Paciente dentro de transacción
      const record = await models.Paciente.create(payload, { transaction: t });

      // Confirmar transacción de base de datos
      await t.commit();

      return {
        operationId: 'op_registrar_paciente',
        status: 'COMPLETED',
        timestamp: new Date().toISOString(),
        data: record
      };
    } catch (error) {
      // Revertir cualquier cambio parcial en la base de datos
      await t.rollback();
      throw error;
    }
  },
};

module.exports = OperationService;
