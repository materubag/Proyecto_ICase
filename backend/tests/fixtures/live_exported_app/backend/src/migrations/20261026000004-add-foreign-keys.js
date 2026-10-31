'use strict';

/**
 * Migración para claves foráneas y restricciones relacionales
 * Ejecutada tras la creación de todas las tablas base para admitir dependencias circulares.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar y asegurar columna foránea 'rol_id' con tipo coincidente en 'usuarios'
    const desc_1 = await queryInterface.describeTable('usuarios');
    if (!desc_1['rol_id']) {
      await queryInterface.addColumn('usuarios', 'rol_id', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    }
    await queryInterface.addConstraint('usuarios', {
      fields: ['rol_id'],
      type: 'foreign key',
      name: 'fk_usuarios_rol_rol_id',
      references: {
        table: 'roles',
        field: 'id_rol'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('usuarios', 'fk_usuarios_rol_rol_id');
  }
};
