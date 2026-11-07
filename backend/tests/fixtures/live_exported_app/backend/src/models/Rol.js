/**
 * Modelo Sequelize para Rol
 * Generado automáticamente por ICASE Studio
 * 
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Rol = sequelize.define('Rol', {
    idRol: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'id_rol',
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'nombre',
      unique: true
    }
  }, {
    tableName: 'roles',
    timestamps: true,
    underscored: true
  });

  return Rol;
};
