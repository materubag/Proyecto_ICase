'use strict';

/**
 * Migración Sequelize para tabla: pacientes
 * Entidad: Paciente
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pacientes', {
      codigo_paciente: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      nombre_completo: {
        type: Sequelize.STRING,
        allowNull: false
      },
      documento: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      activo: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("now")
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("now")
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('pacientes');
  }
};
