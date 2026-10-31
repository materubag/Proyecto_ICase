/**
 * Modelo Sequelize para Paciente
 * Generado automáticamente por ICASE Studio
 * 
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Paciente = sequelize.define('Paciente', {
    codigoPaciente: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'codigo_paciente',
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    nombreCompleto: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'nombre_completo'
    },
    documento: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'documento',
      unique: true
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      field: 'activo',
      defaultValue: true
    }
  }, {
    tableName: 'pacientes',
    timestamps: true,
    underscored: true
  });

  return Paciente;
};
