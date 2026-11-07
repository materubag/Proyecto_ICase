/**
 * Controlador REST para Rol
 * Generado automáticamente por ICASE Studio
 */

const { Rol } = require('../models');

/**
 * Obtener todos los registros de Rol
 * GET /api/roles
 */
exports.getAll = async (req, res) => {
  try {
    let items;
    try {
      items = await Rol.findAll({ include: { all: true, nested: false } });
    } catch (e) {
      items = await Rol.findAll();
    }
    return res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    console.error('Error al obtener Rol:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al consultar Rol',
      error: error.message
    });
  }
};

/**
 * Obtener un registro de Rol por su ID
 * GET /api/roles/:id
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    let item;
    try {
      item = await Rol.findByPk(id, { include: { all: true, nested: false } });
    } catch (e) {
      item = await Rol.findByPk(id);
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Rol con ID ${id} no encontrado`
      });
    }

    return res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Error al obtener Rol por ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al consultar registro',
      error: error.message
    });
  }
};

/**
 * Crear un nuevo registro de Rol
 * POST /api/roles
 */
exports.create = async (req, res) => {
  try {
    // Sanitización: Permitir únicamente campos declarados en la entidad
    const allowed = ["nombre"];
    const dataToCreate = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        dataToCreate[key] = req.body[key];
      }
    }

    const newItem = await Rol.create(dataToCreate);
    return res.status(201).json({
      success: true,
      message: 'Rol creado exitosamente',
      data: newItem
    });
  } catch (error) {
    console.error('Error al crear Rol:', error);
    return res.status(400).json({
      success: false,
      message: 'Error de validación al crear Rol',
      error: error.message
    });
  }
};

/**
 * Actualizar un registro existente de Rol
 * PUT /api/roles/:id
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Rol.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Rol con ID ${id} no encontrado para actualizar`
      });
    }

    // Sanitización: Permitir únicamente campos declarados en la entidad
    const allowed = ["nombre"];
    const dataToUpdate = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        dataToUpdate[key] = req.body[key];
      }
    }

    await item.update(dataToUpdate);

    return res.status(200).json({
      success: true,
      message: 'Rol actualizado exitosamente',
      data: item
    });
  } catch (error) {
    console.error('Error al actualizar Rol:', error);
    return res.status(400).json({
      success: false,
      message: 'Error al actualizar registro',
      error: error.message
    });
  }
};

/**
 * Eliminar un registro de Rol
 * DELETE /api/roles/:id
 */
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Rol.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Rol con ID ${id} no encontrado para eliminar`
      });
    }

    await item.destroy();

    return res.status(200).json({
      success: true,
      message: 'Rol eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar Rol:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al eliminar registro',
      error: error.message
    });
  }
};
