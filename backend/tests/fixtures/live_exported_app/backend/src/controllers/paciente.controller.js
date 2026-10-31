/**
 * Controlador REST para Paciente
 * Generado automáticamente por ICASE Studio
 */

const { Paciente } = require('../models');

/**
 * Obtener todos los registros de Paciente
 * GET /api/pacientes
 */
exports.getAll = async (req, res) => {
  try {
    let items;
    try {
      items = await Paciente.findAll({ include: { all: true, nested: false } });
    } catch (e) {
      items = await Paciente.findAll();
    }
    return res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    console.error('Error al obtener Paciente:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al consultar Paciente',
      error: error.message
    });
  }
};

/**
 * Obtener un registro de Paciente por su ID
 * GET /api/pacientes/:id
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    let item;
    try {
      item = await Paciente.findByPk(id, { include: { all: true, nested: false } });
    } catch (e) {
      item = await Paciente.findByPk(id);
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Paciente con ID ${id} no encontrado`
      });
    }

    return res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Error al obtener Paciente por ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al consultar registro',
      error: error.message
    });
  }
};

/**
 * Crear un nuevo registro de Paciente
 * POST /api/pacientes
 */
exports.create = async (req, res) => {
  try {
    // Sanitización: Permitir únicamente campos declarados en la entidad
    const allowed = ["nombreCompleto","documento","activo"];
    const dataToCreate = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        dataToCreate[key] = req.body[key];
      }
    }

    const newItem = await Paciente.create(dataToCreate);
    return res.status(201).json({
      success: true,
      message: 'Paciente creado exitosamente',
      data: newItem
    });
  } catch (error) {
    console.error('Error al crear Paciente:', error);
    return res.status(400).json({
      success: false,
      message: 'Error de validación al crear Paciente',
      error: error.message
    });
  }
};

/**
 * Actualizar un registro existente de Paciente
 * PUT /api/pacientes/:id
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Paciente.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Paciente con ID ${id} no encontrado para actualizar`
      });
    }

    // Sanitización: Permitir únicamente campos declarados en la entidad
    const allowed = ["nombreCompleto","documento","activo"];
    const dataToUpdate = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        dataToUpdate[key] = req.body[key];
      }
    }

    await item.update(dataToUpdate);

    return res.status(200).json({
      success: true,
      message: 'Paciente actualizado exitosamente',
      data: item
    });
  } catch (error) {
    console.error('Error al actualizar Paciente:', error);
    return res.status(400).json({
      success: false,
      message: 'Error al actualizar registro',
      error: error.message
    });
  }
};

/**
 * Eliminar un registro de Paciente
 * DELETE /api/pacientes/:id
 */
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Paciente.findByPk(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Paciente con ID ${id} no encontrado para eliminar`
      });
    }

    await item.destroy();

    return res.status(200).json({
      success: true,
      message: 'Paciente eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar Paciente:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al eliminar registro',
      error: error.message
    });
  }
};
