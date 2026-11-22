const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const models = require('../models');

// GET /api/vendedores - Listar cuentas de vendedores
router.get('/', async (req, res) => {
  try {
    const list = await models.USUARIO.findAll({
      order: [['id', 'DESC']]
    });

    const vendors = list
      .filter(u => u.rolId === 2 || (u.nombreUsuario || '').toLowerCase().includes('vendedor'))
      .map(u => ({
        id: u.id,
        nombre: u.nombre || 'Vendedor',
        username: u.nombreUsuario || `vendedor${u.id}`,
        rol: 'Vendedor',
        fechaAlta: new Date(u.createdAt || Date.now()).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
        activo: u.activo !== false
      }));

    // Si aún no hay vendedores en BD, incluir al menos el vendedor por defecto
    if (vendors.length === 0) {
      vendors.push({
        id: 2,
        nombre: 'Carlos Mendoza',
        username: 'vendedor@tienda.com',
        rol: 'Vendedor',
        fechaAlta: 'Reciente',
        activo: true
      });
    }

    return res.json(vendors);
  } catch (error) {
    console.error('Error listando vendedores:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/vendedores - Crear cuenta de vendedor
router.post('/', async (req, res) => {
  try {
    const { nombre, username, password } = req.body;
    const rawUser = username || req.body.nombreUsuario || 'vendedor_' + Date.now();
    const cleanUser = rawUser.replace(/^@/, '').trim();
    const cleanNombre = nombre || cleanUser;
    const cleanPass = password || req.body.contrasena || 'Password123!';

    const hashedPassword = await bcrypt.hash(cleanPass, 10);

    // Asegurar rol Vendedor (id 2)
    let roleId = 2;
    if (models.ROL) {
      const [roleRec] = await models.ROL.findOrCreate({
        where: { nombre: 'Vendedor' },
        defaults: { id: 2, nombre: 'Vendedor', descripcion: 'Rol Vendedor' }
      }).catch(() => [null]);
      if (roleRec) roleId = roleRec.id;
    }

    // Crear o actualizar en USUARIO
    const [user, created] = await models.USUARIO.findOrCreate({
      where: { nombreUsuario: cleanUser },
      defaults: {
        nombre: cleanNombre,
        nombreUsuario: cleanUser,
        contrasenaHash: hashedPassword,
        rolId: roleId,
        activo: true
      }
    });

    if (!created) {
      await user.update({
        nombre: cleanNombre,
        contrasenaHash: hashedPassword,
        rolId: roleId,
        activo: true
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Cuenta de vendedor creada exitosamente',
      data: {
        id: user.id,
        nombre: user.nombre,
        username: user.nombreUsuario,
        rol: 'Vendedor',
        activo: user.activo
      }
    });
  } catch (error) {
    console.error('Error creando vendedor:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/vendedores/:id - Actualizar estado de vendedor
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await models.USUARIO.findByPk(id);
    if (!user) return res.status(404).json({ success: false, message: 'Vendedor no encontrado' });

    if (req.body.activo !== undefined) {
      await user.update({ activo: req.body.activo });
    }
    return res.json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
