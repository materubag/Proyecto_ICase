/**
 * Controller Generator for Express + Sequelize
 * Produces functional, production-ready REST controllers with input sanitization,
 * explicit field projection and standard JSON envelopes.
 */

const { toPascalCase, toCamelCase, deriveNaming, normalizeAttributes } = require('./typeMapper');

function generateControllerFile(entity) {
  const naming = deriveNaming(entity.name);
  const modelName = naming.modelName;
  const varName = naming.paramName;
  const normalizedAttrs = normalizeAttributes(entity.attributes || []);
  const allowedFields = normalizedAttrs.filter(a => !a.isPk).map(a => a.fieldName);

  return `/**
 * Controlador REST para ${modelName}
 * Generado automáticamente por ICASE Studio
 */

const { ${modelName} } = require('../models');

/**
 * Obtener todos los registros de ${modelName}
 * GET /api/${naming.endpoint}
 */
exports.getAll = async (req, res) => {
  try {
    let items;
    try {
      items = await ${modelName}.findAll({ include: { all: true, nested: false } });
    } catch (e) {
      items = await ${modelName}.findAll();
    }
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
 * GET /api/${naming.endpoint}/:id
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    let item;
    try {
      item = await ${modelName}.findByPk(id, { include: { all: true, nested: false } });
    } catch (e) {
      item = await ${modelName}.findByPk(id);
    }

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
 * POST /api/${naming.endpoint}
 */
exports.create = async (req, res) => {
  try {
    // Sanitización: Permitir únicamente campos declarados en la entidad
    const allowed = ${JSON.stringify(allowedFields)};
    const dataToCreate = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        dataToCreate[key] = req.body[key];
      }
    }

    const newItem = await ${modelName}.create(dataToCreate);
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
 * PUT /api/${naming.endpoint}/:id
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

    // Sanitización: Permitir únicamente campos declarados en la entidad
    const allowed = ${JSON.stringify(allowedFields)};
    const dataToUpdate = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        dataToUpdate[key] = req.body[key];
      }
    }

    await item.update(dataToUpdate);

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
 * DELETE /api/${naming.endpoint}/:id
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
