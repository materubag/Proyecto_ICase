/**
 * Controlador REST para Usuario
 * Generado automáticamente por ICASE Studio
 */

const { Usuario } = require('../models');

/**
 * Obtener todos los registros de Usuario
 * GET /api/usuarios
 */
exports.getAll = async (req, res) => {
  try {
    let items;
    try {
      items = await Usuario.findAll({ include: { all: true, nested: false } });
    } catch (e) {
      items = await Usuario.findAll();
    }
    return res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    console.error('Error al obtener Usuario:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al consultar Usuario',
      error: error.message
    });
  }
};

/**
 * Obtener un registro de Usuario por su ID
 * GET /api/usuarios/:id
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    let item;
    try {
      item = await Usuario.findByPk(id, { include: { all: true, nested: false } });
    } catch (e) {
      item = await Usuario.findByPk(id);
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Usuario con ID ${id} no encontrado`
      });
    }

    return res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Error al obtener Usuario por ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al consultar registro',
      error: error.message
    });
  }
};

/**
 * Crear un nuevo registro de Usuario
 * POST /api/usuarios
 */
exports.create = async (req, res) => {
  try {
    // Sanitización: Permitir únicamente campos declarados en la entidad
    const allowed = ["email","password","rolId"];
    const dataToCreate = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        dataToCreate[key] = req.body[key];
      }
    }

    const newItem = await Usuario.create(dataToCreate);
    return res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: newItem
    });
  } catch (error) {
    console.error('Error al crear Usuario:', error);
    return res.status(400).json({
      success: false,
      message: 'Error de validación al crear Usuario',
      error: error.message
    });
  }
};

/**
 * Actualizar un registro existente de Usuario
 * PUT /api/usuarios/:id
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Usuario.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Usuario con ID ${id} no encontrado para actualizar`
      });
    }

    // Sanitización: Permitir únicamente campos declarados en la entidad
    const allowed = ["email","password","rolId"];
    const dataToUpdate = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        dataToUpdate[key] = req.body[key];
      }
    }

    await item.update(dataToUpdate);

    return res.status(200).json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: item
    });
  } catch (error) {
    console.error('Error al actualizar Usuario:', error);
    return res.status(400).json({
      success: false,
      message: 'Error al actualizar registro',
      error: error.message
    });
  }
};

/**
 * Eliminar un registro de Usuario
 * DELETE /api/usuarios/:id
 */
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Usuario.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Usuario con ID ${id} no encontrado para eliminar`
      });
    }

    await item.destroy();

    return res.status(200).json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar Usuario:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al eliminar registro',
      error: error.message
    });
  }
};
