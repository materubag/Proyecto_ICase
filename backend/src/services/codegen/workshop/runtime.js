"use strict";
// Emitted verbatim into the generated backend. All state is stored in PostgreSQL.
const db = require("../models");
const config = require("./workshop.profile.json");
const { Op } = require("sequelize");
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("node:fs");
const path = require("node:path");
const { validateInput } = require("./operation.runtime");
const { sanitize } = require("./crud.runtime");
const M = Object.fromEntries(
  Object.entries(config.models).map(([name, model]) => [name, db[model]]),
);
const clean = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
const is = (user, role) => clean(user?.role) === clean(config.roles[role]);
const fail = (message, statusCode = 422, code = "VALIDATION_ERROR") => {
  throw Object.assign(new Error(message), { statusCode, code });
};
const plain = (row) => (row?.toJSON ? row.toJSON() : row);
const lockOptions = (t) => ({
  transaction: t,
  ...(t ? { lock: t.LOCK.UPDATE } : {}),
});
const tx = (fn) => db.sequelize.transaction(fn);
const cents = (value, label = "importe") => {
  const number = Number(value);
  if (
    !Number.isFinite(number) ||
    number < 0 ||
    Math.abs(number) > 1e10 ||
    Math.abs(number * 100 - Math.round(number * 100)) > 1e-5
  )
    fail("Valor inválido para " + label);
  return BigInt(Math.round(number * 100));
};
const amount = (value) => Number(value) / 100;
const qty = (value) => {
  const n = Number(value);
  if (
    !Number.isFinite(n) ||
    n <= 0 ||
    n > 1e9 ||
    Math.abs(n * 100 - Math.round(n * 100)) > 1e-5
  )
    fail("Cantidad inválida");
  return n;
};
const productTotal = (price, quantity) =>
  amount((cents(price) * cents(quantity) + 50n) / 100n);
const chooseId = (payload, ...keys) => {
  const key = keys.find((key) => payload[key] != null);
  return key ? Number(payload[key]) : null;
};
const assertStaff = (user) => {
  if (!["admin", "reception", "mechanic"].some((role) => is(user, role)))
    fail("Operación de personal del taller", 403, "FORBIDDEN");
};
const assertRole = (user, ...roles) => {
  if (!roles.some((role) => is(user, role)))
    fail("Operación no autorizada para su rol", 403, "FORBIDDEN");
};
async function guardLock(t, key) {
  await db.sequelize.query("SELECT pg_advisory_xact_lock(hashtext(:key))", {
    replacements: { key },
    transaction: t,
  });
}
async function find(name, id, t, lock = false) {
  if (!Number.isInteger(Number(id)) || Number(id) < 1)
    fail("Identificador obligatorio: " + name, 400);
  const row = await M[name].findByPk(
    id,
    lock ? lockOptions(t) : { transaction: t },
  );
  if (!row) fail(name + " no encontrado", 404, "NOT_FOUND");
  return row;
}
async function audit(user, entity, id, operation, t, result = "SUCCESS") {
  if (entity === "AUDITORIA") return;
  await M.AUDITORIA.create(
    {
      usuarioId: user?.id || null,
      entidad: entity,
      entidadId: id || null,
      operacion: operation,
      resultado: result,
      fechaHora: new Date(),
    },
    { transaction: t },
  );
}
async function create(name, data, user, t) {
  const row = await M[name].create(data, { transaction: t });
  if (config.resources[name]) await audit(user, name, row.id, "CREATE", t);
  return row;
}
async function update(name, row, data, user, t) {
  await row.update(data, { transaction: t });
  if (config.resources[name]) await audit(user, name, row.id, "UPDATE", t);
  return row;
}
async function owners(user, t) {
  return (
    await M.CLIENTE.findAll({ where: { usuarioId: user.id }, transaction: t })
  ).map((row) => row.id);
}
async function scope(name, user, t) {
  if (is(user, "client")) {
    const ids = await owners(user, t);
    if (name === "CLIENTE") return { id: { [Op.in]: ids } };
    if (["VEHICULO", "CITA", "COTIZACION", "ORDENTRABAJO"].includes(name))
      return { clienteId: { [Op.in]: ids } };
    const vehicles = (
      await M.VEHICULO.findAll({
        where: { clienteId: { [Op.in]: ids } },
        transaction: t,
      })
    ).map((row) => row.id);
    if (["RECEPCION", "DIAGNOSTICO", "AVISOMANTENIMIENTO"].includes(name))
      return { vehiculoId: { [Op.in]: vehicles } };
    if (["COTIZACIONDETALLE", "COTIZACIONDECISION"].includes(name)) {
      const quotes = await M.COTIZACION.findAll({
        where: { clienteId: { [Op.in]: ids } },
        transaction: t,
      });
      return { cotizacionId: { [Op.in]: quotes.map((row) => row.id) } };
    }
    if (name === "ORDENTRABAJODETALLE") {
      const orders = await M.ORDENTRABAJO.findAll({
        where: { clienteId: { [Op.in]: ids } },
        transaction: t,
      });
      return { ordenTrabajoId: { [Op.in]: orders.map((row) => row.id) } };
    }
    if (["FALLA", "ZONADIAGNOSTICO", "EVIDENCIAMULTIMEDIA"].includes(name)) {
      const diagnoses = await M.DIAGNOSTICO.findAll({
        where: { vehiculoId: { [Op.in]: vehicles } },
        transaction: t,
      });
      return { diagnosticoId: { [Op.in]: diagnoses.map((row) => row.id) } };
    }
    fail("Recurso no habilitado para cliente", 403, "FORBIDDEN");
  }
  if (
    is(user, "mechanic") &&
    ["ORDENTRABAJO", "ORDENTRABAJODETALLE", "ASIGNACIONMECANICO"].includes(name)
  ) {
    const assigned = await M.ASIGNACIONMECANICO.findAll({
      where: { usuarioId: user.id },
      transaction: t,
    });
    return name === "ORDENTRABAJO"
      ? { id: { [Op.in]: assigned.map((row) => row.ordenTrabajoId) } }
      : {
          ordenTrabajoId: {
            [Op.in]: assigned.map((row) => row.ordenTrabajoId),
          },
        };
  }
  return {};
}
async function accessible(name, id, user, t, lock = false) {
  const filter = await scope(name, user, t);
  const row = await M[name].findOne({
    where: { [Op.and]: [filter, { id: Number(id) }] },
    ...(lock ? lockOptions(t) : { transaction: t }),
  });
  if (!row) fail("Registro no encontrado", 404, "NOT_FOUND");
  return row;
}
async function requireAssigned(order, user, t) {
  if (
    is(user, "mechanic") &&
    !(await M.ASIGNACIONMECANICO.findOne({
      where: { ordenTrabajoId: order.id, usuarioId: user.id },
      transaction: t,
    }))
  )
    fail("Orden no asignada al mecánico", 404, "NOT_FOUND");
}
async function requireSameVehicle(data, t) {
  if (data.vehiculoId) {
    const vehicle = await find("VEHICULO", data.vehiculoId, t);
    if (
      data.clienteId != null &&
      Number(data.clienteId) !== Number(vehicle.clienteId)
    )
      fail("El vehículo no pertenece al cliente", 409, "OWNER_MISMATCH");
  }
  if (data.recepcionId) {
    const intake = await find("RECEPCION", data.recepcionId, t);
    if (
      data.vehiculoId != null &&
      Number(intake.vehiculoId) !== Number(data.vehiculoId)
    )
      fail("Recepción y vehículo no coinciden", 409);
  }
  if (data.cotizacionId && data.vehiculoId) {
    const quote = await find("COTIZACION", data.cotizacionId, t);
    if (
      Number(quote.vehiculoId) !== Number(data.vehiculoId) ||
      Number(quote.clienteId) !== Number(data.clienteId)
    )
      fail("Cotización, vehículo y cliente no coinciden", 409);
  }
}
async function ensureOwner(user, t) {
  await find("USUARIO", user.id, t, true);
  let row = await M.CLIENTE.findOne({
    where: { usuarioId: user.id },
    transaction: t,
  });
  if (!row) {
    const account = await find("USUARIO", user.id, t);
    row = await create(
      "CLIENTE",
      {
        usuarioId: user.id,
        nombre: account.nombre,
        correo: account.correo,
        fechaCreacion: new Date(),
      },
      user,
      t,
    );
  }
  return row;
}
const inputAliases = {
  PRODUCTO: { stock: "existencias" },
  SERVICIO: { duracionEstimadaMinutos: "duracionEstimada" },
  VEHICULO: { vin: "numeroSerie" },
  CLIENTE: { documento: "identificacion" },
};
function normalizeInput(name, input) {
  const data = { ...input };
  // Aliases are explicit and validated; contradictory duplicate values are rejected.
  for (const [from, to] of Object.entries(inputAliases[name] || {}))
    if (Object.hasOwn(data, from)) {
      if (Object.hasOwn(data, to) && data[to] !== data[from])
        fail("Valores contradictorios: " + to);
      data[to] = data[from];
      delete data[from];
    }
  if (name === "OBDCONOCIMIENTO" && typeof data.casoResuelto === "boolean")
    data.casoResuelto = data.casoResuelto ? "SI" : "NO";
  if (data.placa) data.placa = String(data.placa).trim().toUpperCase();
  if (data.correo) data.correo = String(data.correo).trim().toLowerCase();
  if (data.estado) data.estado = clean(data.estado);
  if (name === "ZONADIAGNOSTICO" && data.estado) {
    const aliases = {
      NORMAL: "NORMAL",
      REVISION: "REVISION",
      REVIEW: "REVISION",
      FALLA: "FALLA",
      FAULT: "FALLA",
      FALLACRITICA: "FALLA_CRITICA",
      CRITICAL: "FALLA_CRITICA",
    };
    data.estado = aliases[data.estado.replace(/[ _-]/g, "")] || data.estado;
  }
  return data;
}
function validate(name, data, updating) {
  const schema = config.resources[name].schema;
  for (const [key, value] of Object.entries(data))
    if (value instanceof Date) data[key] = value.toISOString();
  validateInput(data, { ...schema, required: updating ? [] : schema.required });
  if (!Object.keys(data).length) fail("No hay datos para guardar", 400);
  for (const field of [
    "precio",
    "costo",
    "precioManoObra",
    "existencias",
    "stockMinimo",
    "cantidad",
    "precioUnitario",
    "costoUnitario",
    "impuesto",
    "impuestos",
    "subtotal",
    "total",
    "totalLinea",
  ])
    if (data[field] != null) cents(data[field], field);
  for (const field of [
    "kilometrajeActual",
    "kilometraje",
    "intervaloDias",
    "intervaloKilometros",
    "anticipacionDias",
    "anticipacionKilometros",
  ])
    if (
      data[field] != null &&
      (!Number.isInteger(Number(data[field])) || Number(data[field]) < 0)
    )
      fail("Valor inválido: " + field);
  if (
    name === "ZONADIAGNOSTICO" &&
    data.estado !== undefined &&
    !["NORMAL", "REVISION", "FALLA", "FALLA_CRITICA"].includes(data.estado)
  )
    fail("Estado de zona inválido");
  if (
    name === "FALLA" &&
    data.severidad &&
    !["BAJA", "MEDIA", "ALTA", "CRITICA"].includes(clean(data.severidad))
  )
    fail("Severidad inválida");
  if (data.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.correo))
    fail("Correo inválido");
}
async function alertStock(product, user, t) {
  await guardLock(t, "stock-alert:" + product.id);
  const existing = await M.ALERTASTOCK.findOne({
    where: { productoId: product.id },
    transaction: t,
  });
  const attrs = M.ALERTASTOCK.rawAttributes;
  if (Number(product.existencias || 0) <= Number(product.stockMinimo || 0)) {
    const data = {
      productoId: product.id,
      estado: "ACTIVA",
      fechaGeneracion: new Date(),
      existenciasActuales: product.existencias,
      stockMinimo: product.stockMinimo,
    };
    const projected = Object.fromEntries(
      Object.entries(data).filter(([key]) => attrs[key]),
    );
    if (existing) await existing.update(projected, { transaction: t });
    else await M.ALERTASTOCK.create(projected, { transaction: t });
  } else if (existing && attrs.estado)
    await existing.update({ estado: "RESUELTA" }, { transaction: t });
}
async function adjustStock(productId, delta, user, t, refs = {}, kind) {
  const product = await find("PRODUCTO", productId, t, true);
  const change = Number(delta);
  if (!Number.isFinite(change) || change === 0 || Math.abs(change) > 1e9)
    fail("Variación inválida");
  const next =
    Math.round(Number(product.existencias || 0) * 100) +
    Math.round(change * 100);
  if (next < 0) fail("Existencias insuficientes", 409, "INSUFFICIENT_STOCK");
  await update("PRODUCTO", product, { existencias: next / 100 }, user, t);
  const movement = await create(
    "MOVIMIENTOINVENTARIO",
    {
      ...refs,
      productoId: product.id,
      usuarioId: user.id,
      tipoMovimiento: kind || (change > 0 ? "ENTRADA" : "SALIDA"),
      cantidad: Math.abs(change),
      existenciasResultantes: next / 100,
      fechaMovimiento: new Date(),
    },
    user,
    t,
  );
  await alertStock(product, user, t);
  return { producto: plain(product), movimiento: plain(movement) };
}
async function recalculate(name, id, user, t) {
  const definitions = {
    COTIZACION: ["COTIZACIONDETALLE", "cotizacionId"],
    VENTA: ["VENTADETALLE", "ventaId"],
    COMPRA: ["COMPRADETALLE", "compraId"],
  };
  const [detail, fk] = definitions[name];
  const row = await find(name, id, t, true);
  const items = await M[detail].findAll({
    where: { [fk]: id },
    transaction: t,
  });
  let subtotal = 0n,
    tax = 0n;
  for (const item of items) {
    subtotal += cents(
      productTotal(
        item.precioUnitario ?? item.costoUnitario ?? 0,
        item.cantidad || 0,
      ),
    );
    tax += cents(item.impuesto || 0);
  }
  const data =
    name === "COMPRA"
      ? { total: amount(subtotal + tax) }
      : {
          subtotal: amount(subtotal),
          impuestos: amount(tax),
          total: amount(subtotal + tax),
        };
  await update(name, row, data, user, t);
  return row;
}

async function save(name, action, input, user, t, id, options = {}) {
  let row =
    action === "create" ? null : await accessible(name, id, user, t, true);
  const old = row ? plain(row) : null;
  if (name === "AUDITORIA") fail("La auditoría es de solo lectura", 403);
  if (action === "delete") {
    if (name === "COTIZACIONDETALLE") {
      const quote = await accessible(
        "COTIZACION",
        row.cotizacionId,
        user,
        t,
        true,
      );
      if (quote.estado !== "PENDIENTE")
        fail("La cotización ya tiene decisión", 409);
      await row.destroy({ transaction: t });
      await audit(user, name, id, "DELETE", t);
      await recalculate("COTIZACION", quote.id, user, t);
      return null;
    }
    if (
      [
        "COTIZACIONDECISION",
        "MOVIMIENTOINVENTARIO",
        "VENTA",
        "VENTADETALLE",
        "COMPRA",
        "COMPRADETALLE",
        "ORDENTRABAJO",
        "ORDENTRABAJODETALLE",
      ].includes(name)
    )
      fail("Use una operación de cancelación o devolución auditada", 409);
    await row.destroy({ transaction: t });
    await audit(user, name, id, "DELETE", t);
    return null;
  }
  const data = normalizeInput(name, omit(input, []));
  validate(name, data, action === "update");
  if (name === "USUARIO") {
    if (data.correo) {
      await guardLock(t, "email:" + data.correo);
      const same = await M.USUARIO.findOne({
        where: { correo: data.correo },
        transaction: t,
      });
      if (same && same.id !== row?.id) fail("El correo ya existe", 409);
    }
    if (data.rolId) await find("ROL", data.rolId, t);
    if (data.contrasena) {
      data.hashContrasena = await bcrypt.hash(data.contrasena, 12);
      delete data.contrasena;
      data.versionSesion = Number(row?.versionSesion || 0) + (row ? 1 : 0);
    }
    if (data.estado && !["ACTIVO", "INACTIVO"].includes(data.estado))
      fail("Estado de cuenta inválido");
    if (action === "create") data.estado = data.estado || "ACTIVO";
  }
  if (name === "CLIENTE" && data.usuarioId)
    await find("USUARIO", data.usuarioId, t);
  if (
    data.clienteId &&
    !(await M.CLIENTE.findByPk(data.clienteId, { transaction: t }))
  )
    fail("Cliente inexistente");
  if (name === "VEHICULO") {
    if (is(user, "client")) {
      const owner = await ensureOwner(user, t);
      if (data.clienteId != null && Number(data.clienteId) !== owner.id)
        fail("No puede seleccionar otro propietario", 422);
      data.clienteId = owner.id;
    }
    if (data.clienteId) await find("CLIENTE", data.clienteId, t);
    if (
      data.kilometrajeActual != null &&
      row &&
      Number(data.kilometrajeActual) < Number(row.kilometrajeActual || 0)
    )
      fail("El odómetro no puede disminuir");
    if (data.placa) {
      await guardLock(t, "plate:" + data.placa);
      const same = await M.VEHICULO.findOne({
        where: { placa: data.placa },
        transaction: t,
      });
      if (same && same.id !== row?.id) fail("La placa ya está registrada", 409);
    }
    if (action === "create") {
      data.kilometrajeBaseMantenimiento = data.kilometrajeActual || 0;
      data.fechaBaseMantenimiento = new Date();
    }
  }
  await requireSameVehicle({ ...old, ...data }, t);
  if (name === "CITA") await prepareAppointment(data, row, user, t);
  if (name === "RECEPCION") {
    data.usuarioId = user.id;
    data.fechaRecepcion = row?.fechaRecepcion || new Date();
    if (data.citaId) {
      const appointment = await find("CITA", data.citaId, t);
      if (
        Number(appointment.vehiculoId) !==
        Number(data.vehiculoId || row?.vehiculoId)
      )
        fail("La cita pertenece a otro vehículo", 409);
    }
    if (data.nivelCombustible != null) {
      const level = Number(data.nivelCombustible);
      if (!Number.isFinite(level) || level < 0 || level > 100)
        fail("Combustible inválido");
      data.nivelCombustible = level > 1 ? level / 100 : level;
    }
    if (data.mecanicoId) await validMechanic(data.mecanicoId, t);
  }
  if (name === "DIAGNOSTICO") {
    data.usuarioId = user.id;
    data.fechaDiagnostico = row?.fechaDiagnostico || new Date();
    if (data.codigosObd) data.codigosObd = validateCodes(data.codigosObd);
  }
  if (["FALLA", "ZONADIAGNOSTICO"].includes(name))
    await accessible(
      "DIAGNOSTICO",
      data.diagnosticoId || row?.diagnosticoId,
      user,
      t,
    );
  if (name === "EVIDENCIAMULTIMEDIA") await attachEvidence(data, row, user, t);
  if (name === "COTIZACION") {
    if (action === "create") {
      data.usuarioId = user.id;
      data.estado = "PENDIENTE";
      data.subtotal = 0;
      data.impuestos = 0;
      data.total = 0;
      data.fechaCreacion = new Date();
    } else if (
      [
        "estado",
        "total",
        "subtotal",
        "impuestos",
        "clienteId",
        "vehiculoId",
      ].some((key) => Object.hasOwn(data, key))
    )
      fail(
        "Use las operaciones de ítems y decisión para modificar la cotización",
        409,
      );
  }
  if (name === "COTIZACIONDETALLE") {
    const quote = await accessible(
      "COTIZACION",
      data.cotizacionId || row?.cotizacionId,
      user,
      t,
      true,
    );
    if (quote.estado !== "PENDIENTE" && !options.internal)
      fail("La cotización ya tiene decisión; cree una nueva revisión", 409);
    if (data.servicioId) {
      const service = await find("SERVICIO", data.servicioId, t);
      if (service.activo === false) fail("Servicio inactivo", 409);
    }
    if (data.productoId) await find("PRODUCTO", data.productoId, t);
    data.cantidad = qty(data.cantidad ?? row?.cantidad ?? 1);
    data.precioUnitario = data.precioUnitario ?? row?.precioUnitario ?? 0;
    data.impuesto = data.impuesto ?? row?.impuesto ?? 0;
    data.totalLinea = amount(
      cents(productTotal(data.precioUnitario, data.cantidad)) +
        cents(data.impuesto),
    );
  }
  if (name === "COTIZACIONDECISION") {
    await accessible(
      "COTIZACION",
      data.cotizacionId || row?.cotizacionId,
      user,
      t,
      true,
    );
    data.usuarioId = user.id;
    data.fechaDecision = new Date();
  }
  if (name === "ORDENTRABAJO") {
    assertRole(user, "reception", "admin", "mechanic");
    if (action === "create") {
      assertRole(user, "reception");
      if (!data.cotizacionId)
        fail("Se requiere una cotización autorizada", 409);
      const quote = await find("COTIZACION", data.cotizacionId, t, true);
      if (!["APROBADA", "APROBADA_PARCIAL"].includes(quote.estado))
        fail("Los ítems aún no están autorizados", 409);
      const accepted = await M.COTIZACIONDETALLE.count({
        where: { cotizacionId: quote.id, aceptado: true },
        transaction: t,
      });
      if (!accepted) fail("No hay ítems autorizados", 409);
      if (
        await M.ORDENTRABAJO.findOne({
          where: { cotizacionId: quote.id },
          transaction: t,
        })
      )
        fail("Ya existe orden para esta autorización", 409);
      data.estado = "CREADA";
      data.fechaApertura = new Date();
    } else {
      await requireAssigned(row, user, t);
      if (
        ["clienteId", "vehiculoId", "cotizacionId", "recepcionId"].some(
          (key) => Object.hasOwn(data, key) && data[key] !== row[key],
        )
      )
        fail("No se cambian las referencias de una orden", 409);
      if (data.estado) fail("Use la operación de cambio de fase", 409);
    }
  }
  if (name === "ASIGNACIONMECANICO") {
    assertRole(user, "reception");
    await find("ORDENTRABAJO", data.ordenTrabajoId || row?.ordenTrabajoId, t);
    await validMechanic(data.usuarioId || row?.usuarioId, t);
    data.fechaAsignacion = row?.fechaAsignacion || new Date();
  }
  if (name === "ORDENTRABAJODETALLE") {
    const order = await find(
      "ORDENTRABAJO",
      data.ordenTrabajoId || row?.ordenTrabajoId,
      t,
      true,
    );
    await requireAssigned(order, user, t);
    if (["FINALIZADA", "ENTREGADA", "CANCELADA"].includes(order.estado))
      fail("La orden está cerrada", 409);
    if (
      row &&
      ["ordenTrabajoId", "productoId", "servicioId"].some(
        (key) => data[key] != null && data[key] !== row[key],
      )
    )
      fail("No se cambian referencias de un consumo", 409);
    data.usuarioId = user.id;
    data.fechaRegistro = new Date();
    data.cantidad = data.cantidad ?? row?.cantidad ?? 1;
    qty(data.cantidad);
  }
  if (name === "MOVIMIENTOINVENTARIO") {
    const sign = clean(data.tipoMovimiento) === "SALIDA" ? -1 : 1;
    const result = await adjustStock(
      data.productoId,
      sign * qty(data.cantidad),
      user,
      t,
      { motivo: data.motivo },
      clean(data.tipoMovimiento) || "AJUSTE",
    );
    return result.movimiento;
  }
  if (name === "VENTA" && action === "create") {
    data.usuarioId = user.id;
    data.fechaVenta = new Date();
    data.subtotal = 0;
    data.impuestos = 0;
    data.total = 0;
  }
  if (name === "VENTADETALLE") {
    if (
      row &&
      ["ventaId", "productoId"].some(
        (key) => data[key] != null && data[key] !== row[key],
      )
    )
      fail("No se cambian referencias de venta", 409);
    await find("VENTA", data.ventaId || row?.ventaId, t, true);
    await find("PRODUCTO", data.productoId || row?.productoId, t);
    data.cantidad = qty(data.cantidad ?? row?.cantidad);
    data.precioUnitario = data.precioUnitario ?? row?.precioUnitario ?? 0;
    data.impuesto = data.impuesto ?? row?.impuesto ?? 0;
    data.totalLinea = amount(
      cents(productTotal(data.precioUnitario, data.cantidad)) +
        cents(data.impuesto),
    );
  }
  if (name === "COMPRA" && action === "create") {
    await find("PROVEEDOR", data.proveedorId, t);
    data.usuarioId = user.id;
    data.estado = data.estado || "BORRADOR";
    data.inventarioAplicado = false;
    data.fechaCompra = new Date();
  }
  if (name === "COMPRADETALLE") {
    const purchase = await find(
      "COMPRA",
      data.compraId || row?.compraId,
      t,
      true,
    );
    if (purchase.inventarioAplicado)
      fail("No se modifican compras confirmadas", 409);
    await find("PRODUCTO", data.productoId || row?.productoId, t);
    data.cantidad = qty(data.cantidad ?? row?.cantidad);
    data.costoUnitario = data.costoUnitario ?? row?.costoUnitario ?? 0;
    data.totalLinea = productTotal(data.costoUnitario, data.cantidad);
  }
  if (name === "REGLAMANTENIMIENTO") {
    if (
      !data.vehiculoId &&
      !data.tipoVehiculo &&
      !row?.vehiculoId &&
      !row?.tipoVehiculo
    )
      fail("Seleccione vehículo o tipo");
    if (
      !(Number(data.intervaloDias ?? row?.intervaloDias) > 0) &&
      !(Number(data.intervaloKilometros ?? row?.intervaloKilometros) > 0)
    )
      fail("Configure un intervalo positivo");
  }
  if (name === "OBDCONOCIMIENTO") {
    if (data.codigoObd) data.codigoObd = validateCodes([data.codigoObd])[0];
    data.usuarioId = user.id;
    data.fechaActualizacion = new Date();
  }
  row =
    action === "create"
      ? await create(name, data, user, t)
      : await update(name, row, data, user, t);
  if (name === "PRODUCTO") {
    if (
      action === "update" &&
      data.existencias != null &&
      Number(data.existencias) !== Number(old.existencias)
    ) {
      await create(
        "MOVIMIENTOINVENTARIO",
        {
          productoId: row.id,
          usuarioId: user.id,
          tipoMovimiento: "AJUSTE",
          cantidad: Math.abs(
            Number(data.existencias) - Number(old.existencias),
          ),
          existenciasResultantes: row.existencias,
          motivo: "Ajuste de catálogo",
          fechaMovimiento: new Date(),
        },
        user,
        t,
      );
    }
    await alertStock(row, user, t);
  }
  if (name === "COTIZACIONDETALLE")
    await recalculate("COTIZACION", row.cotizacionId, user, t);
  if (name === "COTIZACIONDECISION") await applyDecision(row, user, t);
  if (name === "ORDENTRABAJO" && action === "create")
    await copyAuthorizedItems(row, user, t);
  if (name === "ORDENTRABAJODETALLE" && row.productoId) {
    const consumed = Number(old?.stockDescontado || 0),
      delta = Number(row.cantidad) - consumed;
    if (delta)
      await adjustStock(row.productoId, -delta, user, t, {
        ordenTrabajoDetalleId: row.id,
        motivo: "Consumo en orden",
      });
    await row.update({ stockDescontado: row.cantidad }, { transaction: t });
  }
  if (name === "VENTADETALLE") {
    const delta = Number(row.cantidad) - Number(old?.cantidad || 0);
    if (delta)
      await adjustStock(row.productoId, -delta, user, t, {
        ventaDetalleId: row.id,
        motivo: "Venta directa",
      });
    await recalculate("VENTA", row.ventaId, user, t);
  }
  if (name === "COMPRADETALLE")
    await recalculate("COMPRA", row.compraId, user, t);
  if (name === "COMPRA" && ["CONFIRMADA", "RECIBIDA"].includes(row.estado))
    await applyPurchase(row, user, t);
  if (
    name === "VEHICULO" &&
    (data.kilometrajeActual != null || action === "create")
  )
    await evaluateMaintenance(row, user, t);
  if (name === "REGLAMANTENIMIENTO")
    for (const vehicle of await M.VEHICULO.findAll({ transaction: t }))
      await evaluateMaintenance(vehicle, user, t);
  if (name === "RECEPCION" && data.kilometraje != null) {
    const vehicle = await find("VEHICULO", row.vehiculoId, t, true);
    if (Number(data.kilometraje) < Number(vehicle.kilometrajeActual || 0))
      fail("El odómetro no puede disminuir");
    await update(
      "VEHICULO",
      vehicle,
      { kilometrajeActual: data.kilometraje },
      user,
      t,
    );
    await evaluateMaintenance(vehicle, user, t);
  }
  return plain(row);
}
function controller(modelName) {
  const name = Object.keys(config.resources).find(
    (key) => config.models[key] === modelName,
  );
  if (!name) throw new Error("Unknown resource");
  const result = {};
  const error = (res, e) =>
    res
      .status(
        e.statusCode ||
          (/Sequelize.*(Constraint|Validation)/.test(e.name) ? 422 : 500),
      )
      .json({
        success: false,
        code: e.code || "INVALID_INPUT",
        message:
          e.statusCode || e.name?.includes("Constraint")
            ? e.message
            : "Error interno",
      });
  result.getAll = async (req, res) => {
    try {
      let where = await scope(name, req.user);
      if (name === "OBDCONOCIMIENTO") {
        const search =
          req.query.q ||
          req.query.codigoObd ||
          req.query.sintoma ||
          req.query.componente ||
          req.query.descripcion;
        if (search)
          where = {
            [Op.and]: [
              where,
              {
                [Op.or]: [
                  "codigoObd",
                  "sintoma",
                  "componente",
                  "descripcion",
                ].map((field) => ({
                  [field]: { [Op.iLike]: "%" + String(search) + "%" },
                })),
              },
            ],
          };
      }
      const rows = await M[name].findAll({ where, order: [["id", "ASC"]] });
      res.json({ success: true, data: sanitize(rows), count: rows.length });
    } catch (e) {
      error(res, e);
    }
  };
  result.getById = async (req, res) => {
    try {
      res.json({
        success: true,
        data: sanitize(await accessible(name, req.params.id, req.user)),
      });
    } catch (e) {
      error(res, e);
    }
  };
  for (const action of ["create", "update", "delete"])
    result[action] = async (req, res) => {
      try {
        const data = await tx((t) =>
          save(name, action, req.body, req.user, t, req.params.id),
        );
        res
          .status(action === "create" ? 201 : 200)
          .json({ success: true, data: sanitize(data) });
      } catch (e) {
        error(res, e);
      }
    };
  return result;
}

function publicUser(account, role) {
  return {
    id: account.id,
    nombre: account.nombre,
    username: account.correo,
    email: account.correo,
    correo: account.correo,
    role,
    rol: role,
    cambioObligatorio: Boolean(account.cambioObligatorio),
  };
}
async function accountRole(account, t) {
  const role = await M.ROL.findByPk(account.rolId, { transaction: t });
  return role?.nombre;
}
function sign(account, role) {
  return jwt.sign(
    { id: account.id, role, version: Number(account.versionSesion || 0) },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRATION || "8h" },
  );
}
const auth = {
  async login(req, res) {
    try {
      const identifier = String(
          req.body.identifier ||
            req.body.email ||
            req.body.correo ||
            req.body.username ||
            "",
        )
          .trim()
          .toLowerCase(),
        password = req.body.password || req.body.contrasena || req.body.clave;
      if (!identifier || !password) fail("Credenciales obligatorias", 400);
      const account = await M.USUARIO.findOne({
        where: { correo: identifier },
      });
      if (
        !account ||
        !(await bcrypt.compare(String(password), account.hashContrasena || ""))
      )
        fail("Credenciales inválidas", 401, "INVALID_CREDENTIALS");
      if (clean(account.estado) === "INACTIVO")
        fail("Cuenta desactivada", 403, "ACCOUNT_DISABLED");
      if (account.temporalVence && new Date(account.temporalVence) < new Date())
        fail("La clave temporal venció", 401);
      const role = await accountRole(account);
      if (!role) fail("Cuenta sin rol válido", 403);
      res.json({
        success: true,
        token: sign(account, role),
        user: publicUser(account, role),
      });
    } catch (e) {
      res.status(e.statusCode || 500).json({
        success: false,
        code: e.code || "LOGIN_FAILED",
        message: e.statusCode ? e.message : "No se pudo iniciar sesión",
      });
    }
  },
  async me(req, res) {
    try {
      const account = await M.USUARIO.findByPk(req.user.id);
      const permissions = await M.RolePermission.findAll({
        where: { rolId: account.rolId },
        attributes: ["codigo", "permitido"],
      });
      res.json({
        success: true,
        user: { ...publicUser(account, req.user.role), permissions },
      });
    } catch {
      res
        .status(503)
        .json({ success: false, message: "No se pudo consultar la sesión." });
    }
  },
  async register(req, res) {
    try {
      assertRole(req.user, "admin");
      const role = await M.ROL.findOne({
        where: { nombre: req.body.role || config.roles.client },
      });
      if (!role) fail("Rol inválido");
      const data = await tx((t) =>
        save(
          "USUARIO",
          "create",
          {
            nombre: req.body.nombre || req.body.username || req.body.email,
            correo: req.body.email || req.body.correo,
            rolId: role.id,
            contrasena: req.body.password || req.body.contrasena,
            estado: "ACTIVO",
          },
          req.user,
          t,
        ),
      );
      res.status(201).json({ success: true, data: sanitize(data) });
    } catch (e) {
      res
        .status(e.statusCode || 400)
        .json({ success: false, message: e.message });
    }
  },
  async changePassword(req, res) {
    try {
      const old = req.body.claveActual || req.body.currentPassword,
        next = req.body.nuevaClave || req.body.newPassword;
      if (typeof next !== "string" || next.length < 8)
        fail("La nueva contraseña requiere al menos ocho caracteres");
      await tx(async (t) => {
        const account = await find("USUARIO", req.user.id, t, true);
        if (
          !(await bcrypt.compare(
            String(old || ""),
            account.hashContrasena || "",
          ))
        )
          fail("La contraseña actual no es correcta", 403);
        await update(
          "USUARIO",
          account,
          {
            hashContrasena: await bcrypt.hash(next, 12),
            versionSesion: Number(account.versionSesion || 0) + 1,
            cambioObligatorio: false,
            temporalVence: null,
          },
          req.user,
          t,
        );
      });
      res.json({
        success: true,
        message: "Contraseña actualizada. Inicie sesión nuevamente.",
      });
    } catch (e) {
      res
        .status(e.statusCode || 400)
        .json({ success: false, message: e.message });
    }
  },
};
function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;
  if (!token)
    return res.status(401).json({ success: false, code: "UNAUTHENTICATED" });
  jwt.verify(token, process.env.JWT_SECRET, async (error, claims) => {
    try {
      if (error)
        return res.status(401).json({
          success: false,
          code:
            error.name === "TokenExpiredError"
              ? "TOKEN_EXPIRED"
              : "INVALID_TOKEN",
        });
      const account = await M.USUARIO.findByPk(claims.id);
      if (!account || clean(account.estado) === "INACTIVO")
        return res
          .status(403)
          .json({ success: false, code: "ACCOUNT_DISABLED" });
      if (Number(claims.version || 0) !== Number(account.versionSesion || 0))
        return res
          .status(401)
          .json({ success: false, code: "SESSION_REVOKED" });
      if (
        account.cambioObligatorio &&
        !["/api/auth/me", "/api/auth/change-password"].includes(
          req.originalUrl.split("?")[0],
        )
      )
        return res.status(428).json({ code: "PASSWORD_CHANGE_REQUIRED" });
      const role = await accountRole(account);
      if (role !== claims.role)
        return res
          .status(401)
          .json({ success: false, code: "SESSION_REVOKED" });
      req.user = { ...claims, role };
      next();
    } catch (e) {
      res.status(503).json({ success: false, code: "AUTH_UNAVAILABLE" });
    }
  });
}
function permissionCode(req) {
  return (
    req.method +
    ":" +
    req.originalUrl
      .split("?")[0]
      .replace(/\/[0-9]+(?=\/|$)/g, "/:id")
      .replace(/\/$/, "")
  );
}
function authorizeRoles(...allowed) {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ code: "UNAUTHENTICATED" });
      const account = await M.USUARIO.findByPk(req.user.id),
        code = permissionCode(req);
      let override = await M.RolePermission.findOne({
        where: { rolId: account.rolId, codigo: code },
      });
      if (!override) {
        const group = Object.keys(config.permissionGroups || {}).find((key) =>
          config.permissionGroups[key].includes(code),
        );
        if (group)
          override = await M.RolePermission.findOne({
            where: { rolId: account.rolId, codigo: group },
          });
      }
      if (
        override
          ? override.permitido
          : allowed.some((role) => clean(role) === clean(req.user.role))
      )
        return next();
      res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "Su rol no tiene permiso para esta operación.",
      });
    } catch (e) {
      res.status(503).json({ code: "PERMISSION_UNAVAILABLE" });
    }
  };
}

async function validMechanic(id, t) {
  const account = await find("USUARIO", id, t);
  if (
    clean(await accountRole(account)) !== clean(config.roles.mechanic) ||
    clean(account.estado) === "INACTIVO"
  )
    fail("La cuenta no es un mecánico activo");
  return account;
}
function validateCodes(codes) {
  if (!Array.isArray(codes)) fail("Los códigos OBD deben ser una lista");
  return [
    ...new Set(
      codes.map((code) => {
        const value = clean(code);
        if (!/^[PBCU][0-3][0-9A-F]{3}$/.test(value))
          fail("Código OBD inválido");
        return value;
      }),
    ),
  ];
}
async function slots(date, t) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || ""))
    fail("Fecha obligatoria YYYY-MM-DD", 400);
  await guardLock(t, "slots:" + date);
  let rows = await M.Slot.findAll({
    where: { fecha: date },
    transaction: t,
    order: [["horaInicio", "ASC"]],
  });
  if (!rows.length) {
    for (let hour = 8; hour < 17; hour++)
      await M.Slot.create(
        {
          fecha: date,
          horaInicio: String(hour).padStart(2, "0") + ":00",
          horaFin: String(hour + 1).padStart(2, "0") + ":00",
          capacidad: config.settings.capacity,
          activo: true,
        },
        { transaction: t },
      );
    rows = await M.Slot.findAll({
      where: { fecha: date },
      transaction: t,
      order: [["horaInicio", "ASC"]],
    });
  }
  return rows;
}
async function prepareAppointment(data, row, user, t) {
  const merged = { ...plain(row), ...data };
  const vehicle = await accessible("VEHICULO", merged.vehiculoId, user, t);
  if (merged.clienteId && Number(merged.clienteId) !== vehicle.clienteId)
    fail("Propietario incorrecto", 409);
  data.clienteId = vehicle.clienteId;
  data.usuarioId = user.id;
  if (merged.espacioId) {
    const slot = await find("Slot", merged.espacioId, t, true);
    if (!slot.activo) fail("Espacio inactivo", 409);
    data.fechaHora = new Date(slot.fecha + "T" + slot.horaInicio + ":00Z");
  } else data.fechaHora = new Date(merged.fechaHora);
  if (
    !Number.isFinite(data.fechaHora.getTime()) ||
    data.fechaHora <= new Date()
  )
    fail("Seleccione una fecha futura");
  await guardLock(t, "appointment:" + data.fechaHora.toISOString());
  const occupied = await M.CITA.findAll({
    where: {
      fechaHora: data.fechaHora,
      estado: { [Op.notIn]: ["CANCELADA", "RECHAZADA"] },
    },
    transaction: t,
  });
  const count = occupied.filter((item) => item.id !== row?.id).length;
  const capacity = merged.espacioId
    ? (await find("Slot", merged.espacioId, t)).capacidad
    : 1;
  if (
    !["CANCELADA", "RECHAZADA"].includes(clean(merged.estado)) &&
    count >= capacity
  )
    fail("Horario sin disponibilidad", 409, "SLOT_FULL");
  data.estado = data.estado || row?.estado || "SOLICITADA";
}
async function applyDecision(decision, user, t) {
  const quote = await accessible(
    "COTIZACION",
    decision.cotizacionId,
    user,
    t,
    true,
  );
  if (quote.fechaVencimiento && new Date(quote.fechaVencimiento) < new Date())
    fail("La cotización ha vencido", 409);
  if (
    await M.ORDENTRABAJO.count({
      where: { cotizacionId: quote.id },
      transaction: t,
    })
  )
    fail("La autorización ya generó una orden", 409);
  const state = clean(decision.estadoResultante);
  if (!["APROBADA", "APROBADA_PARCIAL", "RECHAZADA"].includes(state))
    fail("Decisión inválida");
  const lines = await M.COTIZACIONDETALLE.findAll({
    where: { cotizacionId: quote.id },
    transaction: t,
  });
  const ids = decision.itemsAceptados || [];
  if (
    state === "APROBADA_PARCIAL" &&
    (!ids.length ||
      ids.some((id) => !lines.some((line) => line.id === Number(id))))
  )
    fail("Seleccione ítems de esta cotización");
  for (const line of lines)
    await update(
      "COTIZACIONDETALLE",
      line,
      {
        aceptado:
          state === "APROBADA" ||
          (state === "APROBADA_PARCIAL" && ids.map(Number).includes(line.id)),
      },
      user,
      t,
    );
  await update("COTIZACION", quote, { estado: state }, user, t);
}
async function copyAuthorizedItems(order, user, t) {
  for (const line of await M.COTIZACIONDETALLE.findAll({
    where: { cotizacionId: order.cotizacionId, aceptado: true },
    transaction: t,
  }))
    await create(
      "ORDENTRABAJODETALLE",
      {
        ordenTrabajoId: order.id,
        servicioId: line.servicioId,
        productoId: line.productoId,
        descripcion: line.descripcion,
        cantidad: line.cantidad,
        precioUnitario: line.precioUnitario,
        estadoReparacion: "PENDIENTE",
        stockDescontado: 0,
      },
      user,
      t,
    );
}
async function applyPurchase(purchase, user, t) {
  if (purchase.inventarioAplicado) return;
  const details = await M.COMPRADETALLE.findAll({
    where: { compraId: purchase.id },
    transaction: t,
    order: [["productoId", "ASC"]],
  });
  if (!details.length) fail("La compra no tiene ítems", 409);
  for (const line of details)
    await adjustStock(
      line.productoId,
      qty(line.cantidad),
      user,
      t,
      { compraId: purchase.id },
      "ENTRADA",
    );
  await update(
    "COMPRA",
    purchase,
    { inventarioAplicado: true, fechaConfirmacion: new Date() },
    user,
    t,
  );
}
async function evaluateMaintenance(vehicle, user, t) {
  const rules = await M.REGLAMANTENIMIENTO.findAll({
    where: { activo: { [Op.ne]: false } },
    transaction: t,
  });
  for (const rule of rules) {
    if (
      rule.vehiculoId
        ? Number(rule.vehiculoId) !== vehicle.id
        : clean(rule.tipoVehiculo) !== clean(vehicle.tipoVehiculo)
    )
      continue;
    const km =
        Number(vehicle.kilometrajeActual || 0) -
        Number(vehicle.kilometrajeBaseMantenimiento || 0),
      days =
        (Date.now() -
          new Date(
            vehicle.fechaBaseMantenimiento || vehicle.createdAt || Date.now(),
          ).getTime()) /
        86400000;
    if (
      !(
        Number(rule.intervaloKilometros) > 0 &&
        km >=
          Number(rule.intervaloKilometros) -
            Number(rule.anticipacionKilometros || 0)
      ) &&
      !(
        Number(rule.intervaloDias) > 0 &&
        days >= Number(rule.intervaloDias) - Number(rule.anticipacionDias || 0)
      )
    )
      continue;
    await guardLock(t, "maintenance:" + vehicle.id + ":" + rule.id);
    if (
      await M.AVISOMANTENIMIENTO.count({
        where: { vehiculoId: vehicle.id, reglaMantenimientoId: rule.id },
        transaction: t,
      })
    )
      continue;
    await create(
      "AVISOMANTENIMIENTO",
      {
        vehiculoId: vehicle.id,
        reglaMantenimientoId: rule.id,
        fechaGeneracion: new Date(),
        estado: "PENDIENTE",
        mensaje: rule.nombre,
      },
      user,
      t,
    );
    const owner = await find("CLIENTE", vehicle.clienteId, t);
    if (owner.usuarioId)
      await M.Notice.create(
        {
          usuarioId: owner.usuarioId,
          vehiculoId: vehicle.id,
          tipo: "MANTENIMIENTO",
          mensaje: rule.nombre,
          leida: false,
          fecha: new Date(),
        },
        { transaction: t },
      );
  }
}
async function attachEvidence(data, row, user, t) {
  const url = data.urlOriginal || row?.urlOriginal;
  if (!url) fail("Archivo obligatorio");
  const filename = path.basename(url);
  const file = await M.File.findOne({
    where: { nombre: filename },
    ...lockOptions(t),
  });
  if (!file) fail("El archivo no pertenece al almacenamiento privado", 422);
  if (file.usuarioId !== user.id && !is(user, "admin"))
    fail("Archivo de otro usuario", 403);
  let vehicleId;
  if (data.recepcionId) {
    const reception = await accessible("RECEPCION", data.recepcionId, user, t);
    vehicleId = reception.vehiculoId;
  }
  if (data.diagnosticoId) {
    const diagnosis = await accessible(
      "DIAGNOSTICO",
      data.diagnosticoId,
      user,
      t,
    );
    if (vehicleId && vehicleId !== diagnosis.vehiculoId)
      fail("La evidencia corresponde a otro vehículo", 409);
    vehicleId = diagnosis.vehiculoId;
  }
  if (!vehicleId) fail("Asocie la evidencia a recepción o diagnóstico");
  await file.update(
    {
      vehiculoId: vehicleId,
      recepcionId: data.recepcionId,
      diagnosticoId: data.diagnosticoId,
    },
    { transaction: t },
  );
  data.urlOriginal = "/api/upload/files/" + file.nombre;
  data.urlOptimizada = "/api/upload/files/" + file.optimizado;
  data.urlThumbnail = "/api/upload/files/" + file.miniatura;
  data.estadoOptimizacion = "OPTIMIZADA";
  data.usuarioId = user.id;
  data.pesoBytes = file.peso;
  data.formatoMime = file.mime;
}
async function history(payload, user, t) {
  const vehicle = await accessible("VEHICULO", payload.vehiculoId, user, t);
  const recepciones = await M.RECEPCION.findAll({
      where: { vehiculoId: vehicle.id },
      transaction: t,
    }),
    diagnosticos = await M.DIAGNOSTICO.findAll({
      where: { vehiculoId: vehicle.id },
      transaction: t,
    }),
    ordenes = await M.ORDENTRABAJO.findAll({
      where: { vehiculoId: vehicle.id },
      transaction: t,
    });
  return {
    vehiculo: vehicle,
    recepciones,
    diagnosticos,
    ordenes,
    fallas: await M.FALLA.findAll({
      where: { diagnosticoId: { [Op.in]: diagnosticos.map((row) => row.id) } },
      transaction: t,
    }),
    zonas: await M.ZONADIAGNOSTICO.findAll({
      where: { diagnosticoId: { [Op.in]: diagnosticos.map((row) => row.id) } },
      transaction: t,
    }),
    actividades: await M.ORDENTRABAJODETALLE.findAll({
      where: { ordenTrabajoId: { [Op.in]: ordenes.map((row) => row.id) } },
      transaction: t,
    }),
    evidencias: await M.EVIDENCIAMULTIMEDIA.findAll({
      where: {
        [Op.or]: [
          { recepcionId: { [Op.in]: recepciones.map((row) => row.id) } },
          { diagnosticoId: { [Op.in]: diagnosticos.map((row) => row.id) } },
        ],
      },
      transaction: t,
    }),
    historial: [
      ...recepciones.map((row) => ({
        fecha: row.fechaRecepcion,
        kilometraje: row.kilometraje,
        tipo: "RECEPCION",
        detalle: row.motivoIngreso,
        recepcionId: row.id,
      })),
      ...diagnosticos.map((row) => ({
        fecha: row.fechaDiagnostico,
        kilometraje: row.kilometraje,
        tipo: "DIAGNOSTICO",
        detalle: row.observaciones,
        diagnosticoId: row.id,
      })),
      ...(await M.History.findAll({
        where: { vehiculoId: vehicle.id },
        transaction: t,
      })),
    ],
    mantenimientos: await M.AVISOMANTENIMIENTO.findAll({
      where: { vehiculoId: vehicle.id },
      transaction: t,
    }),
  };
}
async function progress(user, t) {
  const rows = await M.ORDENTRABAJO.findAll({
    where: await scope("ORDENTRABAJO", user, t),
    transaction: t,
  });
  const result = [];
  for (const row of rows) {
    const vehicle = await find("VEHICULO", row.vehiculoId, t),
      intake = row.recepcionId
        ? await find("RECEPCION", row.recepcionId, t)
        : null,
      details = await M.ORDENTRABAJODETALLE.findAll({
        where: { ordenTrabajoId: row.id },
        transaction: t,
      });
    result.push({
      ...plain(vehicle),
      ...plain(row),
      id: row.id,
      ordenId: row.id,
      kilometraje: vehicle.kilometrajeActual,
      ingreso: intake
        ? { fecha: intake.fechaRecepcion, motivo: intake.motivoIngreso }
        : null,
      repuestos: details.filter((line) => line.productoId),
      actividades: details,
      evidencias: await M.EVIDENCIAMULTIMEDIA.findAll({
        where: {
          diagnosticoId: {
            [Op.in]: (
              await M.DIAGNOSTICO.findAll({
                where: { vehiculoId: vehicle.id },
                transaction: t,
              })
            ).map((d) => d.id),
          },
        },
        transaction: t,
      }),
    });
  }
  return result;
}
async function available(date, t) {
  const result = [];
  for (const slot of await slots(date, t)) {
    const count = await M.CITA.count({
      where: {
        fechaHora: new Date(slot.fecha + "T" + slot.horaInicio + ":00Z"),
        estado: { [Op.notIn]: ["CANCELADA", "RECHAZADA"] },
      },
      transaction: t,
    });
    result.push({
      ...plain(slot),
      ocupados: count,
      disponible: Boolean(slot.activo) && count < slot.capacidad,
    });
  }
  return result.sort(
    (a, b) =>
      Number(b.disponible) - Number(a.disponible) ||
      a.horaInicio.localeCompare(b.horaInicio),
  );
}
async function quotes(user, t) {
  const result = [];
  for (const quote of await M.COTIZACION.findAll({
    where: await scope("COTIZACION", user, t),
    transaction: t,
  })) {
    const items = await M.COTIZACIONDETALLE.findAll({
      where: { cotizacionId: quote.id },
      transaction: t,
    });
    result.push({
      ...plain(quote),
      estado:
        quote.estado === "APROBADA_PARCIAL"
          ? "APROBADA_PARCIALMENTE"
          : quote.estado,
      items: items.map((item) => ({
        ...plain(item),
        tipoItem: item.productoId ? "REPUESTO" : "SERVICIO",
        subtotal: productTotal(item.precioUnitario, item.cantidad),
        estadoAprobacion: item.aceptado
          ? "APROBADO"
          : quote.estado === "PENDIENTE"
            ? "PENDIENTE"
            : "RECHAZADO",
      })),
    });
  }
  return result;
}
async function command(handler, p, user, t) {
  if (
    p.claveOperacion &&
    ["sale", "inventory", "consume", "createOrder", "decision"].includes(
      handler,
    )
  ) {
    if (typeof p.claveOperacion !== "string" || p.claveOperacion.length > 160)
      fail("Clave de operación inválida");
    const key = user.id + ":" + handler + ":" + p.claveOperacion,
      hash = crypto
        .createHash("sha256")
        .update(JSON.stringify(p))
        .digest("hex");
    await guardLock(t, "request:" + key);
    const previous = await M.Request.findOne({
      where: { clave: key },
      transaction: t,
    });
    if (previous) {
      if (previous.huella !== hash)
        fail("Clave reutilizada con otros datos", 409);
      return previous.resultado;
    }
    const result = plain(await domainCommand(handler, p, user, t));
    const normalized = JSON.parse(JSON.stringify(result));
    await M.Request.create(
      { clave: key, usuarioId: user.id, huella: hash, resultado: normalized },
      { transaction: t },
    );
    return result;
  }
  return domainCommand(handler, p, user, t);
}
async function domainCommand(handler, p, user, t) {
  switch (handler) {
    case "accounts":
      assertRole(user, "admin");
      return save(
        "USUARIO",
        p.id ? "update" : "create",
        p.id ? omit(p, ["id"]) : p,
        user,
        t,
        p.id,
      );
    case "customers":
      assertRole(user, "admin", "reception");
      return save(
        "CLIENTE",
        p.id ? "update" : "create",
        omit(p, ["id"]),
        user,
        t,
        p.id,
      );
    case "vehicles":
      return save(
        "VEHICULO",
        p.id ? "update" : "create",
        omit(p, ["id"]),
        user,
        t,
        p.id,
      );
    case "products":
      assertRole(user, "admin");
      return save(
        "PRODUCTO",
        p.id ? "update" : "create",
        omit(p, ["id"]),
        user,
        t,
        p.id,
      );
    case "history":
      return history(p, user, t);
    case "appointments": {
      if (p.citaId) {
        const row = await accessible("CITA", p.citaId, user, t, true);
        if (p.action === "cancelar") {
          await update("CITA", row, { estado: "CANCELADA" }, user, t);
          return row;
        }
        const data = { ...plain(row), ...p };
        if (p.action === "confirmar") data.estado = "CONFIRMADA";
        return save("CITA", "update", project("CITA", data), user, t, row.id);
      }
      const vehicle = await accessible("VEHICULO", p.vehiculoId, user, t);
      if (p.fecha) await slots(p.fecha, t);
      let slot;
      if (p.espacioId) {
        slot = await find("Slot", p.espacioId, t);
      } else {
        slot = (await slots(p.fecha, t))[0];
      }
      return save(
        "CITA",
        "create",
        {
          vehiculoId: vehicle.id,
          clienteId: vehicle.clienteId,
          espacioId: slot.id,
          fechaHora: slot.fecha + "T" + slot.horaInicio + ":00Z",
          motivo: p.motivo || "",
          estado: "SOLICITADA",
        },
        user,
        t,
      );
    }
    case "intake": {
      await accessible("VEHICULO", p.vehiculoId, user, t);
      const data = await save(
        "RECEPCION",
        "create",
        project("RECEPCION", p),
        user,
        t,
      );
      for (const fileId of p.archivoIds || []) {
        const file = await find("File", fileId, t);
        await save(
          "EVIDENCIAMULTIMEDIA",
          "create",
          {
            recepcionId: data.id,
            urlOriginal: "/api/upload/files/" + file.nombre,
          },
          user,
          t,
        );
      }
      for (const url of p.fotos || [])
        await save(
          "EVIDENCIAMULTIMEDIA",
          "create",
          {
            recepcionId: data.id,
            urlOriginal: typeof url === "string" ? url : url.url,
          },
          user,
          t,
        );
      return { ...data, recepcionId: data.id };
    }
    case "diagnose": {
      assertStaff(user);
      const diagnosis = await save(
        "DIAGNOSTICO",
        p.diagnosticoId ? "update" : "create",
        project("DIAGNOSTICO", p),
        user,
        t,
        p.diagnosticoId,
      );
      for (const fault of p.fallas || [])
        await save(
          "FALLA",
          "create",
          {
            ...omit(fault, ["zona", "codigoObd"]),
            diagnosticoId: diagnosis.id,
          },
          user,
          t,
        );
      const codes = (p.fallas || [])
        .map((fault) => fault.codigoObd)
        .filter(Boolean);
      if (codes.length)
        await update(
          "DIAGNOSTICO",
          await find("DIAGNOSTICO", diagnosis.id, t),
          { codigosObd: validateCodes(codes) },
          user,
          t,
        );
      for (const zone of p.zonas || [])
        await save(
          "ZONADIAGNOSTICO",
          "create",
          { ...zone, diagnosticoId: diagnosis.id },
          user,
          t,
        );
      for (const id of p.archivoIds || []) {
        const file = await find("File", id, t);
        await save(
          "EVIDENCIAMULTIMEDIA",
          "create",
          {
            diagnosticoId: diagnosis.id,
            recepcionId: diagnosis.recepcionId,
            urlOriginal: "/api/upload/files/" + file.nombre,
          },
          user,
          t,
        );
      }
      let quote;
      if (p.items?.length)
        quote = await command(
          "quote",
          { vehiculoId: diagnosis.vehiculoId, items: p.items },
          user,
          t,
        );
      return {
        ...diagnosis,
        diagnosticoId: diagnosis.id,
        cotizacionId: quote?.id,
      };
    }
    case "zones":
      assertStaff(user);
      return save(
        "ZONADIAGNOSTICO",
        "create",
        project("ZONADIAGNOSTICO", p),
        user,
        t,
      );
    case "obdAttach": {
      assertStaff(user);
      const diagnosis = await accessible(
        "DIAGNOSTICO",
        p.diagnosticoId,
        user,
        t,
        true,
      );
      return update(
        "DIAGNOSTICO",
        diagnosis,
        { codigosObd: validateCodes(p.codigosObd) },
        user,
        t,
      );
    }
    case "maintenanceOrService":
      assertRole(user, "admin");
      return save(
        p.intervaloDias || p.intervaloKilometros
          ? "REGLAMANTENIMIENTO"
          : "SERVICIO",
        p.id ? "update" : "create",
        omit(p, ["id"]),
        user,
        t,
        p.id,
      );
    case "quote": {
      const vehicle = await accessible("VEHICULO", p.vehiculoId, user, t);
      const quote = await save(
        "COTIZACION",
        "create",
        {
          clienteId: p.clienteId || vehicle.clienteId,
          vehiculoId: vehicle.id,
          estado: "PENDIENTE",
        },
        user,
        t,
      );
      if (!Array.isArray(p.items) || !p.items.length) fail("Agregue ítems");
      for (const original of p.items) {
        const item = { ...original };
        if (item.elementoId) {
          if (clean(item.tipoItem) === "SERVICIO")
            item.servicioId = Number(item.elementoId);
          else if (
            ["REPUESTO", "PRODUCTO", "MATERIAL"].includes(clean(item.tipoItem))
          )
            item.productoId = Number(item.elementoId);
          else fail("Tipo de ítem inválido");
          delete item.elementoId;
          delete item.tipoItem;
        }
        const service = item.servicioId
          ? await find("SERVICIO", item.servicioId, t)
          : null;
        const product = item.productoId
          ? await find("PRODUCTO", item.productoId, t)
          : null;
        if (!service && !product) fail("Seleccione servicio o repuesto");
        await save(
          "COTIZACIONDETALLE",
          "create",
          {
            ...item,
            cotizacionId: quote.id,
            cantidad: item.cantidad ?? 1,
            precioUnitario:
              item.precioUnitario ??
              Number(service?.precioManoObra || 0) +
                Number(product?.precio || 0),
            impuesto: item.impuesto ?? 0,
            aceptado: false,
          },
          user,
          t,
        );
      }
      return plain(await find("COTIZACION", quote.id, t));
    }
    case "decision": {
      assertRole(user, "client", "reception", "admin");
      const states = {
        APROBAR: "APROBADA",
        APROBAR_PARCIAL: "APROBADA_PARCIAL",
        APROBAR_PARCIALMENTE: "APROBADA_PARCIAL",
        PARCIAL: "APROBADA_PARCIAL",
        RECHAZAR: "RECHAZADA",
      };
      const result = await save(
        "COTIZACIONDECISION",
        "create",
        omit(
          {
            cotizacionId: p.cotizacionId,
            estadoResultante: states[clean(p.decision)] || p.estadoResultante,
            itemsAceptados: p.itemsAceptados || p.itemsAprobadosIds || [],
            observaciones: p.observaciones,
          },
          [],
        ),
        user,
        t,
      );
      return { ...result, estado: result.estadoResultante };
    }
    case "createOrder": {
      assertRole(user, "reception");
      const quote = await find("COTIZACION", p.cotizacionId, t, true);
      return save(
        "ORDENTRABAJO",
        "create",
        {
          cotizacionId: quote.id,
          clienteId: quote.clienteId,
          vehiculoId: quote.vehiculoId,
          recepcionId: p.recepcionId,
        },
        user,
        t,
      );
    }
    case "assign": {
      assertRole(user, "reception");
      const order = await find(
        "ORDENTRABAJO",
        p.ordenId || p.ordenTrabajoId,
        t,
        true,
      );
      const ids = p.mecanicoIds || [p.usuarioId || p.mecanicoId];
      if (!ids.length) fail("Seleccione mecánicos");
      for (const id of ids) await validMechanic(id, t);
      await M.ASIGNACIONMECANICO.destroy({
        where: { ordenTrabajoId: order.id },
        transaction: t,
      });
      const rows = [];
      for (const id of [...new Set(ids.map(Number))])
        rows.push(
          await save(
            "ASIGNACIONMECANICO",
            "create",
            { ordenTrabajoId: order.id, usuarioId: id, estado: "ASIGNADO" },
            user,
            t,
          ),
        );
      return rows;
    }
    case "repair":
    case "consume": {
      assertStaff(user);
      const order = await accessible(
        "ORDENTRABAJO",
        p.ordenId || p.ordenTrabajoId,
        user,
        t,
        true,
      );
      if (["FINALIZADA", "ENTREGADA", "CANCELADA"].includes(order.estado))
        fail("Orden cerrada", 409);
      await requireAssigned(order, user, t);
      const records = [];
      for (const item of p.items || []) {
        const product = await find(
          "PRODUCTO",
          item.productoId || item.repuestoId,
          t,
        );
        await adjustStock(
          product.id,
          -qty(item.cantidad),
          user,
          t,
          { ordenTrabajoId: order.id },
          "SALIDA",
        );
        let remaining = qty(item.cantidad);
        const planned = await M.ORDENTRABAJODETALLE.findAll({
          where: { ordenTrabajoId: order.id, productoId: product.id },
          transaction: t,
          order: [["id", "ASC"]],
        });
        for (const line of planned) {
          const pending =
              Number(line.cantidad || 0) - Number(line.stockDescontado || 0),
            used = Math.min(Math.max(pending, 0), remaining);
          if (!used) continue;
          await update(
            "ORDENTRABAJODETALLE",
            line,
            {
              stockDescontado: Number(line.stockDescontado || 0) + used,
              usuarioId: user.id,
              actividadRealizada: p.actividadRealizada || p.descripcion,
              pruebasEfectuadas: p.pruebasEfectuadas || p.pruebas,
              fechaRegistro: new Date(),
            },
            user,
            t,
          );
          remaining = Math.round((remaining - used) * 100) / 100;
          records.push(line);
        }
        if (remaining)
          records.push(
            await create(
              "ORDENTRABAJODETALLE",
              {
                ordenTrabajoId: order.id,
                productoId: product.id,
                cantidad: remaining,
                stockDescontado: remaining,
                usuarioId: user.id,
                actividadRealizada: p.actividadRealizada || p.descripcion,
                pruebasEfectuadas: p.pruebasEfectuadas || p.pruebas,
                fechaRegistro: new Date(),
                estadoReparacion: "COMPLETADA",
              },
              user,
              t,
            ),
          );
      }
      if (!records.length) {
        if (!p.actividadRealizada && !p.descripcion)
          fail("Documente la actividad o consumo");
        records.push(
          await create(
            "ORDENTRABAJODETALLE",
            {
              ordenTrabajoId: order.id,
              usuarioId: user.id,
              actividadRealizada: p.actividadRealizada || p.descripcion,
              observaciones: p.observaciones,
              pruebasEfectuadas: p.pruebasEfectuadas || p.pruebas,
              fechaRegistro: new Date(),
            },
            user,
            t,
          ),
        );
      }
      return records;
    }
    case "progress":
      return progress(user, t);
    case "inventory":
      assertRole(user, "admin");
      return adjustStock(
        p.productoId,
        Number(
          p.variacion ??
            (clean(p.tipoMovimiento) === "SALIDA"
              ? -qty(p.cantidad)
              : qty(p.cantidad)),
        ),
        user,
        t,
        { motivo: p.motivo },
        "AJUSTE",
      );
    case "sale": {
      assertRole(user, "reception");
      if (!p.items?.length) fail("Agregue productos");
      const sale = await save(
        "VENTA",
        "create",
        omit(
          { clienteId: p.clienteId, numeroDocumento: p.numeroDocumento },
          [],
        ),
        user,
        t,
      );
      for (const item of [...p.items].sort(
        (a, b) =>
          (a.productoId || a.repuestoId) - (b.productoId || b.repuestoId),
      )) {
        const product = await find(
          "PRODUCTO",
          item.productoId || item.repuestoId,
          t,
        );
        await save(
          "VENTADETALLE",
          "create",
          {
            ventaId: sale.id,
            productoId: product.id,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario ?? Number(product.precio),
            impuesto: item.impuesto || 0,
          },
          user,
          t,
        );
      }
      return { ...plain(await find("VENTA", sale.id, t)), ventaId: sale.id };
    }
    case "maintenanceEvaluate":
      assertStaff(user);
      for (const v of await M.VEHICULO.findAll({ transaction: t }))
        await evaluateMaintenance(v, user, t);
      return M.AVISOMANTENIMIENTO.findAll({
        where: await scope("AVISOMANTENIMIENTO", user, t),
        transaction: t,
      });
    case "knowledge":
      assertRole(user, "admin", "mechanic");
      return save(
        "OBDCONOCIMIENTO",
        p.id ? "update" : "create",
        omit(p, ["id"]),
        user,
        t,
        p.id,
      );
    case "knowledgeSearch":
      assertStaff(user);
      return {
        resultados: await M.OBDCONOCIMIENTO.findAll({
          where: p.codigoObd ? { codigoObd: clean(p.codigoObd) } : {},
          transaction: t,
        }),
      };
    case "reports": {
      assertRole(user, "admin");
      const where = {};
      if (p.desde || p.hasta) {
        const from = new Date(p.desde || 0),
          to = new Date(p.hasta || Date.now());
        if (!Number.isFinite(+from) || !Number.isFinite(+to) || from > to)
          fail("Rango de fechas inválido");
        where.fechaVenta = { [Op.between]: [from, to] };
      }
      const sales = await M.VENTA.findAll({ where, transaction: t });
      return {
        indicadores: {
          vehiculos: await M.VEHICULO.count({ transaction: t }),
          ordenes: await M.ORDENTRABAJO.count({ transaction: t }),
          ventas: sales.length,
          ingresos: amount(
            sales.reduce((sum, sale) => sum + cents(sale.total || 0), 0n),
          ),
          stockBajo: await M.ALERTASTOCK.count({
            where: { estado: "ACTIVA" },
            transaction: t,
          }),
        },
      };
    }
    case "auditList":
      assertRole(user, "admin");
      return M.AUDITORIA.findAll({
        transaction: t,
        limit: 1000,
        order: [["id", "DESC"]],
      });
    case "permissions":
      assertRole(user, "admin");
      if (!p.rolId) fail("Seleccione un rol", 400);
      await find("ROL", p.rolId, t);
      return M.RolePermission.findAll({
        where: { rolId: p.rolId },
        transaction: t,
      });
    default:
      fail("Implementación no disponible", 501, "UNRESOLVED_OPERATION");
  }
}
const omit = (data, keys) =>
  Object.fromEntries(
    Object.entries(data).filter(
      ([key, value]) => !keys.includes(key) && value !== undefined,
    ),
  );
const project = (name, data) =>
  Object.fromEntries(
    Object.entries(data).filter(
      ([key, value]) =>
        config.resources[name].schema.properties[key] && value !== undefined,
    ),
  );
async function execute(operationId, payload, user) {
  const operation = config.implementations[operationId];
  if (!operation) fail("Operación desconocida", 404);
  if (!operation.roles.some((role) => clean(role) === clean(user?.role)))
    fail("Sin permiso", 403);
  return tx((t) => command(operation.handler, payload, user, t));
}
function endpoint(fn, status = 200) {
  return async (req, res) => {
    try {
      const data = await fn(req);
      res.status(status).json({ success: true, data: sanitize(plain(data)) });
    } catch (error) {
      console.error("[workshop]", error.message);
      res
        .status(
          error.statusCode || (error.name?.startsWith("Sequelize") ? 422 : 500),
        )
        .json({
          success: false,
          code: error.code || "WORKSHOP_ERROR",
          message: error.statusCode
            ? error.message
            : "No se pudo completar la operación",
        });
    }
  };
}
function router() {
  const router = require("express").Router();
  router.use(authenticateToken);
  const mount = (method, url, roles, handler, status = 200) =>
    router[method](
      url,
      authorizeRoles(...roles.map((role) => config.roles[role])),
      endpoint(handler, status),
    );
  const cmd =
    (handler, extra = {}) =>
    (req) =>
      tx((t) => command(handler, { ...req.body, ...extra }, req.user, t));
  mount("get", "/mi/vehiculos", ["client"], (req) =>
    tx(async (t) => {
      await ensureOwner(req.user, t);
      return M.VEHICULO.findAll({
        where: await scope("VEHICULO", req.user, t),
        transaction: t,
      });
    }),
  );
  mount(
    "post",
    "/mi/vehiculos",
    ["client"],
    (req) =>
      tx(async (t) => {
        const owner = await ensureOwner(req.user, t);
        return save(
          "VEHICULO",
          "create",
          { ...req.body, clienteId: req.body.clienteId ?? owner.id },
          req.user,
          t,
        );
      }),
    201,
  );
  mount("put", "/mi/vehiculos/:id", ["client"], (req) =>
    tx((t) => save("VEHICULO", "update", req.body, req.user, t, req.params.id)),
  );
  mount(
    "get",
    "/workshop-flow/disponibilidad",
    ["client", "admin", "reception"],
    (req) =>
      tx((t) =>
        available(req.query.fecha || new Date().toISOString().slice(0, 10), t),
      ),
  );
  for (const [url, handler, roles] of [
    ["citas", "appointments", ["client", "admin", "reception"]],
    ["recepcion", "intake", ["admin", "reception"]],
    ["diagnostico", "diagnose", ["mechanic", "admin", "reception"]],
    ["decision", "decision", ["client", "admin", "reception"]],
    ["ordenes/mecanicos", "assign", ["reception"]],
    ["ordenes/consumo", "consume", ["mechanic", "admin", "reception"]],
    ["venta", "sale", ["reception"]],
    ["ajuste", "inventory", ["admin"]],
    ["productos", "products", ["admin"]],
    ["mantenimiento", "maintenanceOrService", ["admin"]],
    ["obd", "knowledge", ["admin", "mechanic"]],
  ])
    mount("post", "/workshop-flow/" + url, roles, cmd(handler), 201);
  for (const action of ["cancelar", "reprogramar"])
    mount(
      "post",
      "/workshop-flow/citas/" + action,
      ["client", "admin", "reception"],
      cmd("appointments", { action }),
    );
  mount(
    "post",
    "/operations/uc-14/confirmar",
    ["reception", "admin"],
    cmd("appointments", { action: "confirmar" }),
  );
  mount("post", "/inventario/movimientos", ["admin"], cmd("inventory"), 201);
  mount(
    "get",
    "/workshop-flow/expediente",
    ["admin", "reception", "mechanic", "client"],
    (req) => tx((t) => history(req.query, req.user, t)),
  );
  mount(
    "get",
    "/workshop-flow/progreso",
    ["client", "admin", "reception", "mechanic"],
    (req) => tx((t) => command("progress", {}, req.user, t)),
  );
  mount(
    "get",
    "/workshop-flow/ordenes",
    ["client", "admin", "reception", "mechanic"],
    (req) => tx((t) => command("progress", {}, req.user, t)),
  );
  mount(
    "get",
    "/workshop-flow/cotizaciones",
    ["client", "admin", "reception", "mechanic"],
    (req) => tx((t) => quotes(req.user, t)),
  );
  mount(
    "get",
    "/workshop-flow/mecanicos",
    ["admin", "reception", "mechanic"],
    async () => {
      const role = await M.ROL.findOne({
        where: { nombre: config.roles.mechanic },
      });
      return sanitize(
        await M.USUARIO.findAll({
          where: { rolId: role.id, estado: "ACTIVO" },
        }),
      );
    },
  );
  mount(
    "get",
    "/workshop-flow/asignaciones",
    ["admin", "reception", "mechanic"],
    (req) =>
      tx(async (t) =>
        M.ASIGNACIONMECANICO.findAll({
          where: await scope("ASIGNACIONMECANICO", req.user, t),
          transaction: t,
        }),
      ),
  );
  mount(
    "get",
    "/workshop-flow/conocimiento",
    ["admin", "mechanic", "reception"],
    (req) => tx((t) => command("knowledgeSearch", req.query, req.user, t)),
  );
  mount("get", "/workshop-flow/indicadores", ["admin"], (req) =>
    tx((t) => command("reports", req.query, req.user, t)),
  );
  mount(
    "get",
    "/workshop-flow/notificaciones",
    ["client", "admin", "reception", "mechanic"],
    (req) => M.Notice.findAll({ where: { usuarioId: req.user.id } }),
  );
  mount(
    "get",
    "/workshop-flow/alertas",
    ["admin", "reception", "mechanic"],
    () => M.ALERTASTOCK.findAll({ where: { estado: "ACTIVA" } }),
  );
  mount("get", "/roles/:id/permisos", ["admin"], (req) =>
    M.RolePermission.findAll({ where: { rolId: req.params.id } }),
  );
  mount("put", "/roles/:id/permisos", ["admin"], (req) =>
    tx(async (t) => {
      await find("ROL", req.params.id, t, true);
      if (!Array.isArray(req.body.permisos))
        fail("Lista de permisos obligatoria");
      await M.RolePermission.destroy({
        where: { rolId: req.params.id },
        transaction: t,
      });
      for (const item of req.body.permisos) {
        if (
          typeof item.codigo !== "string" ||
          !/^(GET|POST|PUT|DELETE):\/api\//.test(item.codigo) ||
          typeof item.permitido !== "boolean"
        )
          fail("Permiso inválido");
        await M.RolePermission.create(
          {
            rolId: req.params.id,
            codigo: item.codigo,
            permitido: item.permitido,
          },
          { transaction: t },
        );
      }
      await audit(req.user, "ROL", Number(req.params.id), "PERMISSIONS", t);
      return M.RolePermission.findAll({
        where: { rolId: req.params.id },
        transaction: t,
      });
    }),
  );
  for (const [url, name, idKey] of [
    ["uc-25", "SERVICIO", "servicioId"],
    ["uc-20", "CLIENTE", "clienteId"],
    ["uc-24", "VEHICULO", "vehiculoId"],
  ])
    for (const action of ["crear", "registrar", "actualizar"])
      mount(
        "post",
        "/operations/" + url + "/" + action,
        name === "SERVICIO" ? ["admin"] : ["admin", "reception"],
        (req) =>
          tx((t) =>
            save(
              name,
              action === "actualizar" ? "update" : "create",
              omit(req.body, [idKey, "claveOperacion"]),
              req.user,
              t,
              req.body[idKey],
            ),
          ),
        action === "actualizar" ? 200 : 201,
      );
  mount("post", "/operations/uc-07/ajustar", ["admin"], cmd("inventory"), 201);
  mount(
    "post",
    "/operations/uc-03/actualizar-kilometraje",
    ["admin", "reception", "client"],
    (req) =>
      tx((t) =>
        save(
          "VEHICULO",
          "update",
          {
            kilometrajeActual:
              req.body.kilometrajeActual ?? req.body.kilometraje,
          },
          req.user,
          t,
          req.body.vehiculoId,
        ),
      ),
  );
  mount(
    "post",
    "/workshop-flow/espacios",
    ["admin", "reception"],
    (req) =>
      tx(async (t) => {
        const p = req.body;
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(p.fecha || "") ||
          !/^\d{2}:\d{2}$/.test(p.horaInicio || "") ||
          !/^\d{2}:\d{2}$/.test(p.horaFin || "") ||
          p.horaInicio >= p.horaFin ||
          !Number.isInteger(Number(p.capacidad)) ||
          Number(p.capacidad) < 1
        )
          fail("Horario o capacidad inválidos");
        await guardLock(t, "slots:" + p.fecha);
        const overlap = await M.Slot.findOne({
          where: {
            fecha: p.fecha,
            horaInicio: { [Op.lt]: p.horaFin },
            horaFin: { [Op.gt]: p.horaInicio },
          },
          transaction: t,
        });
        if (overlap) fail("El espacio se solapa con otro horario", 409);
        return M.Slot.create(
          {
            fecha: p.fecha,
            horaInicio: p.horaInicio,
            horaFin: p.horaFin,
            capacidad: p.capacidad,
            activo: true,
          },
          { transaction: t },
        );
      }),
    201,
  );
  mount("post", "/workshop-flow/usuarios/:id/clave", ["admin"], (req) =>
    temporaryAccount(req, req.params.id),
  );
  // Account provisioning is explicit; a generated temporary secret is returned once to the administrator.
  mount(
    "post",
    "/workshop-flow/usuarios",
    ["admin"],
    (req) => temporaryAccount(req),
    201,
  );
  mount(
    "post",
    "/workshop-flow/clientes-acceso",
    ["admin", "reception"],
    (req) =>
      tx(async (t) => {
        const customer = await find("CLIENTE", req.body.clienteId, t, true);
        if (customer.usuarioId) fail("El cliente ya dispone de acceso", 409);
        if (!customer.correo) fail("Registre un correo del cliente");
        const role = await M.ROL.findOne({
          where: { nombre: config.roles.client },
          transaction: t,
        });
        const password = crypto.randomBytes(18).toString("base64url");
        const account = await createAccount(
          {
            nombre: customer.nombre,
            correo: customer.correo,
            rolId: role.id,
            contrasena: password,
          },
          req.user,
          t,
        );
        await update(
          "CLIENTE",
          customer,
          { usuarioId: account.id },
          req.user,
          t,
        );
        return {
          id: account.id,
          correo: account.correo,
          passwordTemporal: password,
        };
      }),
  );
  mount(
    "post",
    "/workshop-flow/proveedores",
    ["admin"],
    (req) => tx((t) => save("PROVEEDOR", "create", req.body, req.user, t)),
    201,
  );
  mount(
    "post",
    "/workshop-flow/compras",
    ["admin"],
    (req) =>
      tx(async (t) => {
        const p = req.body;
        if (!p.items?.length) fail("Agregue ítems de compra");
        const purchase = await save(
          "COMPRA",
          "create",
          {
            proveedorId: p.proveedorId,
            numeroDocumento: p.numeroDocumento,
            estado: "BORRADOR",
          },
          req.user,
          t,
        );
        for (const item of [...p.items].sort(
          (a, b) => a.productoId - b.productoId,
        ))
          await save(
            "COMPRADETALLE",
            "create",
            {
              compraId: purchase.id,
              productoId: item.productoId,
              cantidad: item.cantidad,
              costoUnitario: item.costoUnitario,
            },
            req.user,
            t,
          );
        await update(
          "COMPRA",
          await find("COMPRA", purchase.id, t, true),
          { estado: "CONFIRMADA" },
          req.user,
          t,
        );
        await applyPurchase(
          await find("COMPRA", purchase.id, t, true),
          req.user,
          t,
        );
        return find("COMPRA", purchase.id, t);
      }),
    201,
  );
  mount("post", "/workshop-flow/productos/:id/retirar", ["admin"], (req) =>
    tx((t) =>
      save("PRODUCTO", "update", { activo: false }, req.user, t, req.params.id),
    ),
  );
  mount(
    "post",
    "/workshop-flow/fase",
    ["admin", "reception", "mechanic"],
    (req) => tx((t) => changePhase(req.body, req.user, t)),
  );
  mount(
    "post",
    "/workshop-flow/notificaciones/:id/leida",
    ["admin", "reception", "mechanic", "client"],
    async (req) => {
      const row = await M.Notice.findOne({
        where: { id: req.params.id, usuarioId: req.user.id },
      });
      if (!row) fail("Aviso no encontrado", 404);
      return row.update({ leida: true });
    },
  );
  mount("get", "/workshop-flow/obd/propuestas", ["admin", "mechanic"], (req) =>
    M.KnowledgeProposal.findAll({
      where: is(req.user, "admin") ? {} : { usuarioId: req.user.id },
    }),
  );
  mount(
    "post",
    "/workshop-flow/obd/proponer",
    ["mechanic", "admin"],
    (req) =>
      tx(async (t) => {
        const data = project("OBDCONOCIMIENTO", req.body);
        validate("OBDCONOCIMIENTO", data, false);
        validateCodes([data.codigoObd]);
        const row = await M.KnowledgeProposal.create(
          { usuarioId: req.user.id, estado: "PENDIENTE", contenido: data },
          { transaction: t },
        );
        await audit(req.user, "OBDCONOCIMIENTO", row.id, "PROPOSE", t);
        return row;
      }),
    201,
  );
  mount(
    "post",
    "/workshop-flow/obd/propuestas/:id/resolver",
    ["admin"],
    (req) =>
      tx(async (t) => {
        const row = await find("KnowledgeProposal", req.params.id, t, true);
        if (row.estado !== "PENDIENTE")
          fail("La propuesta ya fue resuelta", 409);
        const decision = clean(req.body.decision);
        if (!["APROBAR", "RECHAZAR"].includes(decision))
          fail("Decisión inválida");
        if (decision === "APROBAR")
          await save("OBDCONOCIMIENTO", "create", row.contenido, req.user, t);
        return row.update(
          {
            estado: decision === "APROBAR" ? "APROBADA" : "RECHAZADA",
            resueltoPor: req.user.id,
          },
          { transaction: t },
        );
      }),
  );
  mount("post", "/workshop-flow/obd/:id/caso", ["admin", "mechanic"], (req) =>
    tx((t) =>
      save(
        "OBDCONOCIMIENTO",
        "update",
        { solucion: req.body.solucion, casoResuelto: "SI" },
        req.user,
        t,
        req.params.id,
      ),
    ),
  );
  mount("get", "/workshop-flow/permisos", ["admin"], async () => {
    const roles = await M.ROL.findAll(),
      stored = await M.RolePermission.findAll(),
      permisos = Object.keys(config.permissionGroups).map((codigo, i) => ({
        id: i + 1,
        codigo,
      })),
      asignaciones = [];
    for (const role of roles)
      for (const permission of permisos) {
        const override = stored.find(
          (row) => row.rolId === role.id && row.codigo === permission.codigo,
        );
        const endpoint = config.permissionGroups[permission.codigo][0],
          resource = Object.values(config.resources).find((r) =>
            endpoint.split(":").slice(1).join(":").startsWith(r.endpoint),
          );
        const defaults =
          config.adapterPermissions[endpoint] ||
          resource?.roles[endpoint.split(":")[0]] ||
          [];
        if (
          override?.permitido ||
          (!override && defaults.includes(role.nombre))
        )
          asignaciones.push({ rolId: role.id, permisoId: permission.id });
      }
    return { roles, permisos, asignaciones };
  });
  mount("post", "/workshop-flow/permisos", ["admin"], (req) =>
    tx(async (t) => {
      const role = await M.ROL.findOne({
        where: { nombre: req.body.rol },
        transaction: t,
      });
      if (
        !role ||
        !config.permissionGroups[req.body.codigo] ||
        typeof req.body.concedido !== "boolean"
      )
        fail("Rol o permiso inválido");
      await guardLock(t, "permission:" + role.id + ":" + req.body.codigo);
      const where = { rolId: role.id, codigo: req.body.codigo };
      const row = await M.RolePermission.findOne({ where, transaction: t });
      if (row)
        await row.update({ permitido: req.body.concedido }, { transaction: t });
      else
        await M.RolePermission.create(
          { ...where, permitido: req.body.concedido },
          { transaction: t },
        );
      await audit(req.user, "ROL", role.id, "PERMISSIONS", t);
      return { ...where, permitido: req.body.concedido };
    }),
  );
  mount(
    "post",
    "/operations/uc-14/resolver-reprogramacion",
    ["admin", "reception"],
    (req) =>
      tx((t) =>
        command(
          "appointments",
          {
            citaId: req.body.citaId || req.body.solicitudId,
            action: req.body.decision === "RECHAZAR" ? "cancelar" : "confirmar",
          },
          req.user,
          t,
        ),
      ),
  );
  mount(
    "post",
    "/workshop-flow/ordenes",
    ["reception"],
    cmd("createOrder"),
    201,
  );
  return router;
}
async function createAccount(data, user, t) {
  const account = await save("USUARIO", "create", data, user, t);
  await M.USUARIO.update(
    {
      cambioObligatorio: true,
      temporalVence: new Date(Date.now() + 24 * 3600000),
    },
    { where: { id: account.id }, transaction: t },
  );
  return account;
}
async function temporaryAccount(req, id) {
  return tx(async (t) => {
    const password = crypto.randomBytes(18).toString("base64url");
    let account;
    if (id) {
      account = await find("USUARIO", id, t, true);
      await update(
        "USUARIO",
        account,
        {
          hashContrasena: await bcrypt.hash(password, 12),
          versionSesion: Number(account.versionSesion || 0) + 1,
          cambioObligatorio: true,
          temporalVence: new Date(Date.now() + 24 * 3600000),
        },
        req.user,
        t,
      );
    } else {
      const role = await M.ROL.findOne({
        where: { nombre: req.body.rol },
        transaction: t,
      });
      if (!role) fail("Rol inválido");
      account = await createAccount(
        {
          nombre: req.body.nombre,
          correo: req.body.correo,
          rolId: role.id,
          contrasena: password,
        },
        req.user,
        t,
      );
    }
    return {
      id: account.id,
      nombre: account.nombre,
      correo: account.correo,
      rol: await accountRole(account, t),
      passwordTemporal: password,
      cambioObligatorio: true,
    };
  });
}
async function changePhase(p, user, t) {
  const order = await accessible(
    "ORDENTRABAJO",
    p.ordenTrabajoId || p.ordenId,
    user,
    t,
    true,
  );
  await requireAssigned(order, user, t);
  const next = clean(p.fase || p.estado);
  if (next === order.estado) return order;
  const transitions = {
    CREADA: ["EN_PROCESO", "EN_DIAGNOSTICO", "EN_REPARACION", "CANCELADA"],
    ABIERTA: ["EN_PROCESO", "EN_DIAGNOSTICO", "CANCELADA"],
    EN_DIAGNOSTICO: ["EN_REPARACION", "EN_PROCESO", "CANCELADA"],
    EN_PROCESO: ["EN_REPARACION", "EN_PRUEBAS", "FINALIZADA"],
    EN_REPARACION: ["EN_PRUEBAS", "FINALIZADA"],
    EN_PRUEBAS: ["EN_REPARACION", "LAVADO", "FINALIZADA"],
    LAVADO: ["FINALIZADA"],
    FINALIZADA: ["ENTREGADA"],
  };
  if (!transitions[order.estado]?.includes(next))
    fail("Transición de fase inválida", 409);
  if (["ENTREGADA", "CANCELADA"].includes(next))
    assertRole(user, "reception", "admin");
  if (next === "FINALIZADA") {
    const lines = await M.ORDENTRABAJODETALLE.findAll({
      where: { ordenTrabajoId: order.id },
      transaction: t,
      order: [["productoId", "ASC"]],
    });
    for (const line of lines) {
      if (line.productoId) {
        const delta =
          Number(line.cantidad || 0) - Number(line.stockDescontado || 0);
        if (delta > 0)
          await adjustStock(
            line.productoId,
            -delta,
            user,
            t,
            { ordenTrabajoDetalleId: line.id },
            "SALIDA",
          );
      }
      await update(
        "ORDENTRABAJODETALLE",
        line,
        {
          stockDescontado: line.cantidad || 0,
          estadoReparacion: "COMPLETADA",
          usuarioId: user.id,
        },
        user,
        t,
      );
    }
    await M.History.create(
      {
        vehiculoId: order.vehiculoId,
        usuarioId: user.id,
        tipo: "REPARACION",
        contenido: { ordenTrabajoId: order.id },
        fecha: new Date(),
      },
      { transaction: t },
    );
    const owner = await find("CLIENTE", order.clienteId, t);
    if (owner.usuarioId)
      await M.Notice.create(
        {
          usuarioId: owner.usuarioId,
          vehiculoId: order.vehiculoId,
          tipo: "ORDEN",
          mensaje: "Orden " + order.id + " finalizada",
          leida: false,
          fecha: new Date(),
        },
        { transaction: t },
      );
  }
  return update(
    "ORDENTRABAJO",
    order,
    {
      estado: next,
      ...(next === "FINALIZADA" ? { fechaCierre: new Date() } : {}),
    },
    user,
    t,
  );
}
function uploadRouter() {
  const router = require("express").Router(),
    multer = require("multer"),
    sharp = require("sharp");
  const directory = path.resolve(__dirname, "../../uploads");
  fs.mkdirSync(directory, { recursive: true });
  router.use(authenticateToken);
  router.post(
    "/",
    authorizeRoles(...Object.values(config.roles)),
    multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }).single("file"),
    endpoint(async (req) => {
      if (!req.file) fail("Seleccione una imagen", 400);
      let image;
      try {
        image = sharp(req.file.buffer, { limitInputPixels: 40000000 });
        await image.metadata();
      } catch {
        fail("Imagen inválida", 415);
      }
      const name = crypto.randomUUID() + ".webp",
        thumb = "thumb-" + name;
      const buffer = await image
        .rotate()
        .resize({
          width: 1920,
          height: 1920,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();
      await fs.promises.writeFile(path.join(directory, name), buffer);
      await sharp(buffer)
        .resize({ width: 240, height: 240, fit: "inside" })
        .webp({ quality: 70 })
        .toFile(path.join(directory, thumb));
      try {
        const record = await M.File.create({
          usuarioId: req.user.id,
          nombre: name,
          optimizado: name,
          miniatura: thumb,
          mime: "image/webp",
          peso: buffer.length,
        });
      } catch (e) {
        await Promise.all(
          [name, thumb].map((file) =>
            fs.promises.unlink(path.join(directory, file)).catch(() => {}),
          ),
        );
        throw e;
      }
      return {
        archivoId: (await M.File.findOne({ where: { nombre: name } })).id,
        urlThumbnail: "/api/upload/files/" + thumb,
        url: "/api/upload/files/" + name,
        urlOriginal: "/api/upload/files/" + name,
        urlOptimizada: "/api/upload/files/" + name,
        urlMiniatura: "/api/upload/files/" + thumb,
        filename: name,
        mimetype: "image/webp",
        size: buffer.length,
      };
    }, 201),
  );
  router.get("/files/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      if (filename !== path.basename(filename)) fail("Archivo inválido", 404);
      const file = await M.File.findOne({
        where: { [Op.or]: [{ nombre: filename }, { miniatura: filename }] },
      });
      if (!file) fail("Archivo no encontrado", 404);
      if (file.usuarioId !== req.user.id && !is(req.user, "admin")) {
        if (!file.vehiculoId) fail("Archivo privado", 404);
        await accessible("VEHICULO", file.vehiculoId, req.user);
      }
      res
        .type("image/webp")
        .set("X-Content-Type-Options", "nosniff")
        .sendFile(path.join(directory, filename));
    } catch (e) {
      res.status(e.statusCode || 404).json({ message: e.message });
    }
  });
  return router;
}
function authRouter() {
  const router = require("express").Router();
  router.post("/login", auth.login);
  router.post("/register", authenticateToken, auth.register);
  router.get("/me", authenticateToken, auth.me);
  router.post("/change-password", authenticateToken, auth.changePassword);
  router.post(
    "/recover",
    endpoint(async (req) => {
      const email = String(req.body.email || req.body.correo || "")
        .toLowerCase()
        .trim();
      if (!email) fail("Correo obligatorio", 400);
      if (!process.env.SMTP_HOST)
        fail(
          "Configure SMTP para recuperar cuentas",
          503,
          "MAIL_NOT_CONFIGURED",
        );
      const account = await M.USUARIO.findOne({ where: { correo: email } });
      if (account) {
        const token = crypto.randomBytes(32).toString("hex");
        const record = await M.Recovery.create({
          usuarioId: account.id,
          tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
          vence: new Date(Date.now() + 15 * 60000),
        });
        try {
          await require("nodemailer")
            .createTransport({
              host: process.env.SMTP_HOST,
              port: Number(process.env.SMTP_PORT || 587),
              secure: process.env.SMTP_SECURE === "true",
              auth: process.env.SMTP_USER
                ? {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD,
                  }
                : undefined,
            })
            .sendMail({
              from: process.env.SMTP_FROM,
              to: email,
              subject: "Recuperación de acceso",
              text: "Código de recuperación (válido 15 minutos): " + token,
            });
        } catch (error) {
          await record.destroy();
          fail("No se pudo entregar la recuperación", 503, "MAIL_UNAVAILABLE");
        }
      }
      return { message: "Si existe una cuenta, recibirá instrucciones." };
    }),
  );
  router.post(
    "/recover/confirm",
    endpoint(async (req) => {
      const password = req.body.password || req.body.nuevaClave;
      if (
        typeof password !== "string" ||
        password.length < 8 ||
        typeof req.body.token !== "string"
      )
        fail("Código y contraseña válidos obligatorios");
      return tx(async (t) => {
        const record = await M.Recovery.findOne({
          where: {
            tokenHash: crypto
              .createHash("sha256")
              .update(req.body.token)
              .digest("hex"),
          },
          ...lockOptions(t),
        });
        if (!record || record.usado || record.vence < new Date())
          fail("Código inválido o vencido", 400);
        const account = await find("USUARIO", record.usuarioId, t, true);
        await update(
          "USUARIO",
          account,
          {
            hashContrasena: await bcrypt.hash(password, 12),
            versionSesion: Number(account.versionSesion || 0) + 1,
            cambioObligatorio: false,
            temporalVence: null,
          },
          { id: account.id },
          t,
        );
        await record.update({ usado: new Date() }, { transaction: t });
        return { message: "Contraseña actualizada" };
      });
    }),
  );
  return router;
}
async function start() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET obligatorio");
  const run = () =>
    tx(async (t) => {
      for (const vehicle of await M.VEHICULO.findAll({ transaction: t }))
        await evaluateMaintenance(vehicle, null, t);
    }).catch((error) => console.error("[maintenance]", error.message));
  await run();
  setInterval(run, 3600000).unref();
}
module.exports = {
  controller,
  auth,
  authRouter,
  authenticateToken,
  authorizeRoles,
  execute,
  router,
  uploadRouter,
  start,
  save,
  command,
};
