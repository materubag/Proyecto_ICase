/**
 * Controller Generator for Express + Sequelize
 * Produces functional, production-ready CRUD controllers with error handling
 */

const { toPascalCase, toCamelCase } = require('./typeMapper');

function generateControllerFile(entity) {
  const modelName = toPascalCase(entity.name);
  const varName = toCamelCase(entity.name);

  return `/**
 * Controlador REST para ${modelName}
 * Generado automáticamente por ICASE Studio
 */

const { ${modelName} } = require('../models');

/**
 * Obtener todos los registros de ${modelName}
 * GET /api/${varName}s
 */
exports.getAll = async (req, res) => {
  try {
    const items = await ${modelName}.findAll();
    return res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    console.error('Error al obtener ${modelName}:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al consultar ${modelName}',
      error: error.message
    });
  }
};

/**
 * Obtener un registro de ${modelName} por su ID
 * GET /api/${varName}s/:id
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await ${modelName}.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: \`${modelName} con ID \${id} no encontrado\`
      });
    }

    return res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Error al obtener ${modelName} por ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al consultar registro',
      error: error.message
    });
  }
};

/**
 * Crear un nuevo registro de ${modelName}
 * POST /api/${varName}s
 */
exports.create = async (req, res) => {
  try {
    const newItem = await ${modelName}.create(req.body);
    return res.status(201).json({
      success: true,
      message: '${modelName} creado exitosamente',
      data: newItem
    });
  } catch (error) {
    console.error('Error al crear ${modelName}:', error);
    return res.status(400).json({
      success: false,
      message: 'Error de validación al crear ${modelName}',
      error: error.message
    });
  }
};

/**
 * Actualizar un registro existente de ${modelName}
 * PUT /api/${varName}s/:id
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await ${modelName}.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: \`${modelName} con ID \${id} no encontrado para actualizar\`
      });
    }

    await item.update(req.body);

    return res.status(200).json({
      success: true,
      message: '${modelName} actualizado exitosamente',
      data: item
    });
  } catch (error) {
    console.error('Error al actualizar ${modelName}:', error);
    return res.status(400).json({
      success: false,
      message: 'Error al actualizar registro',
      error: error.message
    });
  }
};

/**
 * Eliminar un registro de ${modelName}
 * DELETE /api/${varName}s/:id
 */
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await ${modelName}.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: \`${modelName} con ID \${id} no encontrado para eliminar\`
      });
    }

    await item.destroy();

    return res.status(200).json({
      success: true,
      message: '${modelName} eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar ${modelName}:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al eliminar registro',
      error: error.message
    });
  }
};
`;
}

module.exports = {
  generateControllerFile
};
