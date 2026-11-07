/**
 * Inicializador y Asociaciones de Modelos Sequelize
 * Generado automáticamente por ICASE Studio
 */

const sequelize = require('../config/database');

// Importación de definiciones de modelos
const defineRol = require('./Rol');
const defineUsuario = require('./Usuario');
const definePaciente = require('./Paciente');

// Instanciación de modelos
const Rol = defineRol(sequelize);
const Usuario = defineUsuario(sequelize);
const Paciente = definePaciente(sequelize);

// Definición de Asociaciones (Relaciones)
  // Relación Muchos a Uno: Usuario (N) -> Rol (1)
  Rol.hasMany(Usuario, { foreignKey: 'rolId', as: 'usuario', onDelete: 'RESTRICT' });
  Usuario.belongsTo(Rol, { foreignKey: 'rolId', as: 'rol' });


module.exports = {
  sequelize,
  Rol,
  Usuario,
  Paciente
};
