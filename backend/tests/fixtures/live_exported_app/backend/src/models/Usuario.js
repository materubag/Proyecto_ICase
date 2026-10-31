/**
 * Modelo Sequelize para Usuario
 * Generado automáticamente por ICASE Studio
 * 
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Usuario = sequelize.define('Usuario', {
    idUsuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'id_usuario',
      primaryKey: true,
      autoIncrement: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'email',
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'password'
    },
    rolId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'rol_id'
    }
  }, {
    tableName: 'usuarios',
    timestamps: true,
    underscored: true
  });

  return Usuario;
};
