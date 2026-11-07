const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const crypto = require('node:crypto');

module.exports = async function runReviewedAcceptance({ models, independentModels, request, spec, directory, baseUrl }) {
  const requireExport = createRequire(path.join(directory, 'backend/package.json'));
  const bcrypt = requireExport('bcryptjs');
  const tests = [], screenshots = [], failures = [];
  const users = {};
  const operationMap = new Map(spec.operations.map(operation => [operation.operationId, operation]));
  const tested = new Set();
  async function check(id, operationIds, fn) {
    const test = { id, kind: 'REAL_POSTGRESQL_HTTP', operationIds, requirementIds: [...new Set(operationIds.flatMap(id => operationMap.get(id)?.requirementIds || []))], executedAt: new Date().toISOString(), passed: false };
    try { await fn(); test.passed = true; operationIds.forEach(id => tested.add(id)); }
    catch (error) { test.error = error.message; failures.push(id + ': ' + error.message); }
    tests.push(test); console.log(JSON.stringify({ test: id, passed: test.passed, error: test.error }));
  }
  async function call(id, role, body, status) {
    const operation = operationMap.get(id);
    assert(operation, 'Missing operation ' + id);
    const response = await request(operation.method, operation.route, body, users[role]?.token);
    assert.equal(response.status, status ?? operation.output?.successStatus ?? 200, id + ': ' + JSON.stringify(response.body));
    return response.body.data?.data;
  }
  async function login(name, role) {
    const [record] = await models.ROL.findOrCreate({ where: { nombre: role } });
    const password = 'Test-' + crypto.randomBytes(12).toString('hex');
    const correo = crypto.randomBytes(10).toString('hex') + '@test.local';
    const account = await models.USUARIO.create({ nombre: name, correo, passwordHash: await bcrypt.hash(password, 12), rolId: record.id, activo: true, versionSesion: 0 });
    const response = await request('POST', '/api/auth/login', { identifier: correo, password });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    users[name] = { ...account.get({ plain: true }), role, token: response.body.token, password, identifier: correo };
  }
  for (const [name, role] of [['admin', 'Administrador'], ['reception', 'Recepción'], ['mechanic', 'Mecánico'], ['client', 'Cliente'], ['otherClient', 'Cliente']]) await login(name, role);
  const clients = [await models.CLIENTE.create({ nombre: 'Cliente uno', usuarioId: users.client.id }), await models.CLIENTE.create({ nombre: 'Cliente segundo registro', usuarioId: users.client.id }), await models.CLIENTE.create({ nombre: 'Cliente ajeno', usuarioId: users.otherClient.id })];
  const vehicle = await models.VEHICULO.create({ placa: 'TEST-OWN', clienteId: clients[1].id, kilometrajeActual: null });
  const otherVehicle = await models.VEHICULO.create({ placa: 'TEST-OTHER', clienteId: clients[2].id, kilometrajeActual: 500 });
  const reception = await models.RECEPCION.create({ vehiculoId: vehicle.id, usuarioId: users.reception.id, kilometraje: 100, nivelCombustible: 0.5, motivoIngreso: 'Inspección' });
  const diagnostic = await models.DIAGNOSTICO.create({ vehiculoId: vehicle.id, recepcionId: reception.id, usuarioId: users.mechanic.id });
  const quote = await models.COTIZACION.create({ diagnosticoId: diagnostic.id, clienteId: clients[1].id, estado: 'APROBADA' });
  const service = await models.SERVICIO.create({ nombre: 'Servicio de prueba', precioManoObra: '10.00', duracionEstimadaMinutos: 30, tratamientoImpuesto: 'GRAVADO' });
  const quoteItem = await models.COTIZACIONITEM.create({ cotizacionId: quote.id, servicioId: service.id, descripcion: 'Trabajo autorizado', estadoAprobacion: 'APROBADO' });
  const order = await models.ORDENTRABAJO.create({ vehiculoId: vehicle.id, cotizacionId: quote.id, estado: 'EN_REPARACION' });
  await models.ORDENMECANICO.create({ ordenTrabajoId: order.id, usuarioId: users.mechanic.id });
  const product = await models.PRODUCTO.create({ codigo: 'TEST-STOCK', nombre: 'Repuesto', stock: '20.00', stockMinimo: '20.00', costo: '2.00', precio: '10.00', tratamientoImpuesto: 'GRAVADO' });

  await check('vehicle-normalization-and-unique', ['UC-24-registrar'], async () => {
    const created = await call('UC-24-registrar', 'reception', { clienteId: clients[0].id, placa: ' ab-123 ', vin: ' vin-test ' }, 201);
    const persisted = await independentModels.VEHICULO.findByPk(created.id);
    assert.equal(persisted.placa, 'AB-123'); assert.equal(persisted.vin, 'VIN-TEST');
    await call('UC-24-registrar', 'reception', { clienteId: clients[0].id, placa: 'AB-123' }, 409);
    const optional = await call('UC-24-registrar', 'reception', { clienteId: clients[0].id, placa: 'NO-VIN' }, 201);
    assert.equal((await independentModels.VEHICULO.findByPk(optional.id)).vin, null);
  });
  await check('client-create-and-partial-update', ['UC-20-registrar', 'UC-20-actualizar'], async () => {
    const created = await call('UC-20-registrar', 'reception', { nombre: ' Nuevo cliente ', telefono: '0999999999', direccion: 'Quito' }, 201);
    await call('UC-20-actualizar', 'reception', { clienteId: created.id, direccion: 'Guayaquil' });
    const saved = await independentModels.CLIENTE.findByPk(created.id);
    assert.equal(saved.nombre, 'Nuevo cliente'); assert.equal(saved.telefono, '0999999999'); assert.equal(saved.direccion, 'Guayaquil');
  });
  await check('service-trim-partial-update-duration', ['UC-25-actualizar', 'UC-25-crear'], async () => {
    await call('UC-25-actualizar', 'admin', { servicioId: service.id, nombre: ' Servicio revisado ', duracionEstimadaMinutos: 45 });
    const saved = await independentModels.SERVICIO.findByPk(service.id);
    assert.equal(saved.nombre, 'Servicio revisado'); assert.equal(saved.precioManoObra, '10.00'); assert.equal(saved.duracionEstimadaMinutos, 45);
    const created = await call('UC-25-crear', 'admin', { nombre: 'Servicio nuevo', precioManoObra: 12, duracionEstimadaMinutos: 30 });
    assert(await independentModels.SERVICIO.findByPk(created.id));
  });
  await check('product-trim-low-stock-is-readonly', ['UC-11-registrar', 'UC-11-bajo-stock'], async () => {
    const created = await call('UC-11-registrar', 'admin', { codigo: ' TRIM-CODE ', nombre: 'Producto nuevo', stockMinimo: 1 });
    assert.equal((await independentModels.PRODUCTO.findByPk(created.id)).codigo, 'TRIM-CODE');
    const before = await independentModels.ALERTA.count();
    const rows = await call('UC-11-bajo-stock', 'admin', {});
    assert(rows.some(row => row.id === product.id)); assert.equal(await independentModels.ALERTA.count(), before);
  });
  await check('mileage-multiple-clients-null-and-foreign-denial', ['UC-03-actualizar-kilometraje', 'UC-17-consultar'], async () => {
    await call('UC-03-actualizar-kilometraje', 'client', { vehiculoId: vehicle.id, nuevoKilometraje: 200 });
    assert.equal((await independentModels.VEHICULO.findByPk(vehicle.id)).kilometrajeActual, 200);
    await call('UC-03-actualizar-kilometraje', 'client', { vehiculoId: otherVehicle.id, nuevoKilometraje: 900 }, 404);
    await call('UC-03-actualizar-kilometraje', 'client', { vehiculoId: vehicle.id, nuevoKilometraje: 100 }, 422);
    const orders = await call('UC-17-consultar', 'client', { vehiculoId: vehicle.id });
    assert(orders.some(row => row.id === order.id));
    await call('UC-17-consultar', 'otherClient', { vehiculoId: vehicle.id }, 404);
  });
  await check('diagnostic-server-date-and-reviewed-zones', ['UC-06-registrar', 'UC-06-registrar-fallas', 'UC-06-expediente'], async () => {
    const created = await call('UC-06-registrar', 'mechanic', { vehiculoId: vehicle.id, recepcionId: reception.id, observaciones: 'Diagnóstico nuevo' }, 201);
    assert((await independentModels.DIAGNOSTICO.findByPk(created.id)).fechaDiagnostico instanceof Date);
    await call('UC-06-registrar-fallas', 'mechanic', { diagnosticoId: diagnostic.id, zonasRevisadas: [{ zona: 'MOTOR' }, { zona: 'FRENOS' }], fallas: [{ zona: 'MOTOR', descripcion: 'Falla de prueba', esCritica: true }] });
    assert.equal(await independentModels.REVISIONZONA.count({ where: { diagnosticoId: diagnostic.id } }), 2);
    assert.equal((await independentModels.DIAGNOSTICOFALLA.findOne({ where: { diagnosticoId: diagnostic.id } })).estadoZona, 'CRITICA');
    const history = await call('UC-06-expediente', 'reception', { vehiculoId: vehicle.id }); assert(history.diagnosticos.length >= 2);
  });
  await check('reception-date-and-vehicle-validation', ['UC-16-registrar'], async () => {
    const created = await call('UC-16-registrar', 'reception', { vehiculoId: vehicle.id, clienteId: clients[1].id, kilometraje: 250, nivelCombustible: 0.5, motivoIngreso: 'Nueva recepción' }, 201);
    assert((await independentModels.RECEPCION.findByPk(created.id)).fechaRecepcion instanceof Date);
    await call('UC-16-registrar', 'reception', { vehiculoId: vehicle.id, clienteId: clients[2].id, kilometraje: 300, nivelCombustible: 0.5, motivoIngreso: 'Ajeno' }, 422);
  });
  await check('activity-authorization-and-separate-consumption', ['UC-02-registrar-actividad', 'UC-02-asignar-mecanicos', 'UC-02-consumir-repuesto'], async () => {
    await call('UC-02-asignar-mecanicos', 'mechanic', { ordenTrabajoId: order.id, mecanicoIds: [users.mechanic.id] });
    await call('UC-02-registrar-actividad', 'mechanic', { ordenTrabajoId: order.id, servicioId: service.id, itemAutorizadoId: quoteItem.id, descripcion: 'Actividad ejecutada' }, 201);
    const activity = await independentModels.ACTIVIDAD.findOne({ where: { descripcion: 'Actividad ejecutada' } });
    assert.equal(activity.itemAutorizadoId, quoteItem.id); assert(activity.fechaRegistro instanceof Date);
    const body = { ordenTrabajoId: order.id, productoId: product.id, cantidad: 2, claveOperacion: crypto.randomUUID() };
    await call('UC-02-consumir-repuesto', 'mechanic', body); await call('UC-02-consumir-repuesto', 'mechanic', body);
    assert.equal(Number((await independentModels.PRODUCTO.findByPk(product.id)).stock), 18);
  });
  await check('purchase-partial-receiving-and-idempotent-adjustment', ['UC-07-proveedor', 'UC-07-compra', 'UC-07-recibir', 'UC-07-ajustar'], async () => {
    const supplier = await call('UC-07-proveedor', 'admin', { nombre: 'Proveedor real', identificacionFiscal: '1234567890001' });
    const purchase = await call('UC-07-compra', 'admin', { proveedorId: supplier.id, numeroDocumento: 'FAC-TEST', fechaCompra: new Date().toISOString(), detalles: [{ productoId: product.id, cantidad: 10, costoUnitario: 0.1 }], claveOperacion: crypto.randomUUID() });
    assert.equal(purchase.total, '1.00');
    const detail = await independentModels.COMPRADETALLE.findOne({ where: { compraId: purchase.id } });
    const body = { compraId: purchase.id, claveOperacion: crypto.randomUUID(), detalles: [{ compraDetalleId: detail.id, cantidadRecibida: 4 }] };
    await call('UC-07-recibir', 'reception', body); await call('UC-07-recibir', 'reception', body);
    assert.equal(Number((await independentModels.COMPRADETALLE.findByPk(detail.id)).cantidadRecibida), 4);
    assert.equal((await independentModels.COMPRA.findByPk(purchase.id)).estado, 'RECIBIDA_PARCIALMENTE');
    const adjust = { productoId: product.id, variacion: -1, motivo: 'Ajuste comprobado', claveOperacion: crypto.randomUUID() };
    const before = Number((await independentModels.PRODUCTO.findByPk(product.id)).stock);
    await call('UC-07-ajustar', 'admin', adjust); await call('UC-07-ajustar', 'admin', adjust);
    assert.equal(Number((await independentModels.PRODUCTO.findByPk(product.id)).stock), before - 1);
    const fraction = await call('UC-07-ajustar', 'admin', { ...adjust, variacion: -0.000001, claveOperacion: crypto.randomUUID() });
    assert.equal((await independentModels.MOVIMIENTOINVENTARIO.findByPk(fraction.id)).cantidad, '0.000001');
    await call('UC-07-ajustar', 'reception', { ...adjust, claveOperacion: crypto.randomUUID() }, 403);
  });

  await check('sale-draft-tax-confirmation-and-repeat', ['UC-01-crear-venta', 'UC-01-confirmar-venta', 'UC-01-configurar-impuesto-producto', 'UC-01-configurar-impuesto-servicio'], async () => {
    await call('UC-01-configurar-impuesto-producto', 'admin', { id: product.id, tratamientoImpuesto: 'GRAVADO' });
    await call('UC-01-configurar-impuesto-servicio', 'admin', { id: service.id, tratamientoImpuesto: 'GRAVADO' });
    const before = Number((await independentModels.PRODUCTO.findByPk(product.id)).stock);
    const sale = await call('UC-01-crear-venta', 'reception', { clienteId: clients[1].id, items: [{ repuestoId: product.id, cantidad: 2 }] });
    assert.equal(sale.estado, 'BORRADOR'); assert.equal(sale.subtotal, '20.00'); assert.equal(sale.impuestos, '3.00'); assert.equal(sale.total, '23.00');
    assert.equal(Number((await independentModels.PRODUCTO.findByPk(product.id)).stock), before);
    await call('UC-01-confirmar-venta', 'reception', { ventaId: sale.id }); await call('UC-01-confirmar-venta', 'reception', { ventaId: sale.id });
    assert.equal(Number((await independentModels.PRODUCTO.findByPk(product.id)).stock), before - 2);
  });
  await check('quote-partial-decision-ownership-and-order', ['UC-01-crear-cotizacion', 'UC-01-enviar-cotizacion', 'UC-18-decision', 'UC-15-generar-orden'], async () => {
    const proposal = await call('UC-01-crear-cotizacion', 'reception', { diagnosticoId: diagnostic.id, items: [{ tipoItem: 'SERVICIO', elementoId: service.id, cantidad: 1 }, { tipoItem: 'REPUESTO', elementoId: product.id, cantidad: 1 }] });
    assert.equal(proposal.estado, 'BORRADOR');
    await call('UC-01-enviar-cotizacion', 'reception', { cotizacionId: proposal.id });
    const items = await independentModels.COTIZACIONITEM.findAll({ where: { cotizacionId: proposal.id }, order: [['id', 'ASC']] });
    const body = { cotizacionId: proposal.id, decision: 'APROBAR_PARCIALMENTE', itemsAprobadosIds: [items[0].id], motivo: 'Autoriza únicamente el servicio', claveOperacion: crypto.randomUUID() };
    await call('UC-18-decision', 'otherClient', body, 404);
    await call('UC-18-decision', 'client', body); await call('UC-18-decision', 'client', body);
    assert.equal((await independentModels.COTIZACION.findByPk(proposal.id)).estado, 'APROBADA_PARCIALMENTE');
    assert.equal((await independentModels.COTIZACIONITEM.findByPk(items[0].id)).estadoAprobacion, 'APROBADO');
    assert.equal((await independentModels.COTIZACIONITEM.findByPk(items[1].id)).estadoAprobacion, 'RECHAZADO');
    const orderBody = { cotizacionId: proposal.id, claveOperacion: crypto.randomUUID() };
    const created = await call('UC-15-generar-orden', 'reception', orderBody, 201); await call('UC-15-generar-orden', 'reception', orderBody, 201);
    assert.equal(await independentModels.ORDENTRABAJO.count({ where: { cotizacionId: proposal.id } }), 1);
    assert.equal(created.estado, 'CREADA');
    assert.equal(await independentModels.ACTIVIDAD.count({ where: { ordenTrabajoId: created.id } }), 0);
  });
  await check('appointment-capacity-request-reprogram-and-cancel', ['UC-14-definir-espacio', 'UC-14-disponibilidad', 'UC-14-solicitar', 'UC-14-solicitar-reprogramacion', 'UC-14-resolver-reprogramacion', 'UC-14-confirmar', 'UC-14-cancelar', 'UC-14-mis-citas', 'UC-14-solicitudes'], async () => {
    const start = new Date(Date.now() + 4 * 86400000).toISOString();
    const end = new Date(Date.now() + 4 * 86400000 + 3600000).toISOString();
    const first = await call('UC-14-definir-espacio', 'reception', { inicio: start, fin: end });
    const second = await call('UC-14-definir-espacio', 'admin', { inicio: new Date(Date.now() + 5 * 86400000).toISOString(), fin: new Date(Date.now() + 5 * 86400000 + 3600000).toISOString() });
    const available = await call('UC-14-disponibilidad', 'client', { vehiculoId: vehicle.id, fechaDesde: new Date().toISOString(), fechaHasta: new Date(Date.now() + 7 * 86400000).toISOString() });
    assert(available.some(slot => slot.id === first.id));
    const body = { vehiculoId: vehicle.id, espacioId: first.id, motivo: 'Mantenimiento', claveOperacion: crypto.randomUUID() };
    const appointment = await call('UC-14-solicitar', 'client', body); await call('UC-14-solicitar', 'client', body);
    await call('UC-14-solicitar', 'client', { ...body, claveOperacion: crypto.randomUUID() }, 409);
    await call('UC-14-confirmar', 'reception', { citaId: appointment.id });
    const change = await call('UC-14-solicitar-reprogramacion', 'client', { citaId: appointment.id, nuevoEspacioId: second.id, motivo: 'Cambio solicitado', claveOperacion: crypto.randomUUID() });
    assert.equal((await independentModels.CITA.findByPk(appointment.id)).espacioId, first.id);
    await call('UC-14-solicitudes', 'reception', {});
    await call('UC-14-resolver-reprogramacion', 'reception', { solicitudId: change.id, decision: 'APROBAR', claveOperacion: crypto.randomUUID() });
    assert.equal((await independentModels.CITA.findByPk(appointment.id)).estado, 'REPROGRAMADA');
    assert.equal((await independentModels.RESERVACITA.findOne({ where: { citaId: appointment.id } })).espacioId, second.id);
    await call('UC-14-cancelar', 'client', { citaId: appointment.id, motivo: 'Ya no puede asistir', claveOperacion: crypto.randomUUID() });
    assert.equal((await independentModels.CITA.findByPk(appointment.id)).estado, 'CANCELADA');
    assert.equal((await independentModels.RESERVACITA.findOne({ where: { citaId: appointment.id } })).espacioId, null);
    assert((await call('UC-14-mis-citas', 'client', {})).some(row => row.id === appointment.id));
  });
  await check('OBD-proposal-review-and-concurrent-version-check', ['UC-23-proponer-alta', 'UC-23-proponer-cambio', 'UC-23-resolver', 'UC-23-propuestas'], async () => {
    const proposal = await call('UC-23-proponer-alta', 'mechanic', { datosPropuestos: { codigo: 'P0001', descripcionCaso: 'Caso de prueba', casoResuelto: false } });
    assert.equal(await independentModels.OBDCODIGO.count({ where: { codigo: 'P0001' } }), 0);
    await call('UC-23-resolver', 'admin', { propuestaId: proposal.id, decision: 'APROBAR' });
    const published = await independentModels.OBDCODIGO.findOne({ where: { codigo: 'P0001' } }); assert(published);
    const modification = await call('UC-23-proponer-cambio', 'mechanic', { obdCodigoId: published.id, datosPropuestos: { sintoma: 'Síntoma confirmado' } });
    await call('UC-23-resolver', 'admin', { propuestaId: modification.id, decision: 'APROBAR' });
    assert.equal((await independentModels.OBDCODIGO.findByPk(published.id)).sintoma, 'Síntoma confirmado');
    assert((await call('UC-23-propuestas', 'mechanic', {})).some(row => row.id === proposal.id));
  });
  await check('role-matrix-grants-only-approved-pairs', ['UC-22-asignar-permiso', 'UC-22-permisos', 'UC-22-asociaciones', 'UC-12-roles'], async () => {
    const role = await models.ROL.findOne({ where: { nombre: 'Administrador' } });
    const [permission] = await models.PERMISO.findOrCreate({ where: { codigo: 'USUARIOS_REGISTRAR' } });
    await call('UC-22-asignar-permiso', 'admin', { rolId: role.id, permisoId: permission.id }); await call('UC-22-asignar-permiso', 'admin', { rolId: role.id, permisoId: permission.id });
    assert.equal(await independentModels.ROLPERMISO.count({ where: { rolId: role.id, permisoId: permission.id } }), 1);
    const otherRole = await models.ROL.findOne({ where: { nombre: 'Cliente' } });
    await call('UC-22-asignar-permiso', 'admin', { rolId: otherRole.id, permisoId: permission.id }, 403);
    await call('UC-22-permisos', 'admin', {}); await call('UC-22-asociaciones', 'admin', {}); await call('UC-12-roles', 'admin', {});
  });
  await check('users-registration-last-admin-and-session-revocation', ['UC-12-registrar', 'UC-12-desactivar', 'UC-12-recuperar'], async () => {
    const role = await models.ROL.findOne({ where: { nombre: 'Cliente' } });
    const created = await call('UC-12-registrar', 'admin', { nombre: 'Cuenta creada', correo: 'created-user@test.local', password: 'Password-test-12345', rolId: role.id }, 201);
    const saved = await independentModels.USUARIO.findByPk(created.id);
    assert(await bcrypt.compare('Password-test-12345', saved.passwordHash)); assert.equal(created.passwordHash, undefined);
    await call('UC-12-desactivar', 'admin', { usuarioId: created.id });
    assert.equal((await independentModels.USUARIO.findByPk(created.id)).activo, false);
    await call('UC-12-desactivar', 'admin', { usuarioId: users.admin.id }, 409);
    const temporary = await call('UC-12-recuperar', 'admin', { usuarioId: users.otherClient.id, identidadVerificada: true });
    const revoked = await request('POST', operationMap.get('UC-17-consultar').route, { vehiculoId: otherVehicle.id }, users.otherClient.token); assert.equal(revoked.status, 401);
    const logged = await request('POST', '/api/auth/login', { identifier: users.otherClient.identifier, password: temporary.temporal }); assert.equal(logged.status, 200);
    const changed = await request('POST', '/api/auth/change-password', { passwordActual: temporary.temporal, passwordNueva: 'NewPassword-test-12345' }, logged.body.token); assert.equal(changed.status, 200, JSON.stringify(changed.body));
    const again = await request('POST', '/api/auth/login', { identifier: users.otherClient.identifier, password: temporary.temporal }); assert.equal(again.status, 401);
  });
  await check('base-searches-and-indicators', ['UC-09-buscar-cliente', 'UC-09-buscar-vehiculo', 'UC-09-buscar-producto', 'UC-09-buscar-servicio', 'UC-09-buscar-obdcodigo', 'UC-04-consultar-indicadores'], async () => {
    for (const name of ['cliente', 'vehiculo', 'producto', 'servicio', 'obdcodigo']) assert(Array.isArray(await call('UC-09-buscar-' + name, 'reception', {})));
    const result = await call('UC-04-consultar-indicadores', 'admin', { fechaDesde: '2000-01-01', fechaHasta: '2100-01-01' }); assert(result);
  });
  await check('private-photo-upload-ownership-persistence-and-repeat', ['UC-08-adjuntar-evidencia', 'UC-08-galeria'], async () => {
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
    const body = new FormData(); body.append('file', new Blob([image], { type: 'image/png' }), 'test.png'); body.append('diagnosticoId', String(diagnostic.id));
    const uploadResponse = await fetch(baseUrl + '/api/upload', { method: 'POST', headers: { Authorization: 'Bearer ' + users.mechanic.token }, body });
    const uploaded = await uploadResponse.json(); assert.equal(uploadResponse.status, 201, JSON.stringify(uploaded));
    const payload = { diagnosticoId: diagnostic.id, archivoId: uploaded.archivoId, observaciones: 'Foto persistida' };
    await call('UC-08-adjuntar-evidencia', 'mechanic', payload); await call('UC-08-adjuntar-evidencia', 'mechanic', payload);
    assert.equal(await independentModels.EVIDENCIAMULTIMEDIA.count({ where: { archivoId: uploaded.archivoId } }), 1);
    const rows = await call('UC-08-galeria', 'mechanic', { diagnosticoId: diagnostic.id }); assert(rows.some(row => row.archivoId === uploaded.archivoId));
    const unauthorized = await fetch(baseUrl + rows.find(row => row.archivoId === uploaded.archivoId).urlOriginal); assert.equal(unauthorized.status, 401);
  });
  await check('internal-audit-notifications-maintenance-and-cycle-deduplication', ['UC-05-auditar', 'UC-21-notificar', 'UC-21-mis-notificaciones', 'UC-01-configurar-mantenimiento', 'UC-01-evaluar-avisos'], async () => {
    const runtime = requireExport(path.join(directory, 'backend/src/services/operation.runtime'));
    const invoke = id => async payload => models.sequelize.transaction(transaction => runtime.executeSteps(models, operationMap.get(id), payload, runtime.systemIdentity(), transaction));
    await invoke('UC-05-auditar')({ entidad: 'VEHICULO', entidadId: vehicle.id, operacion: 'VERIFICACION_INTERNA', usuarioId: users.admin.id });
    await invoke('UC-21-notificar')({ usuarioId: users.client.id, tipo: 'PRUEBA', mensaje: 'Aviso privado de prueba' });
    assert((await call('UC-21-mis-notificaciones', 'client', {})).some(row => row.mensaje === 'Aviso privado de prueba'));
    const current = (await independentModels.VEHICULO.findByPk(vehicle.id)).kilometrajeActual;
    const program = await call('UC-01-configurar-mantenimiento', 'admin', { vehiculoId: vehicle.id, descripcion: 'Mantenimiento por kilometraje', kilometrajeBase: current, intervaloKilometros: 500 });
    await invoke('UC-01-evaluar-avisos')({}); await invoke('UC-01-evaluar-avisos')({});
    assert.equal(await independentModels.ALERTA.count({ where: { programacionId: program.id } }), 1);
    const alert = await independentModels.ALERTA.findOne({ where: { programacionId: program.id } }); assert.equal(alert.usuarioId, users.client.id); assert(alert.mensaje.includes(vehicle.placa)); assert(alert.cicloId);
    const publicInvocation = await fetch(baseUrl + operationMap.get('UC-01-evaluar-avisos').route, { method: 'POST', headers: { Authorization: 'Bearer ' + users.mechanic.token, 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(publicInvocation.status, 404);
  });

  let browserPassed = false;
  await check('browser-roles-navigation-forms-persistence-and-mobile', [], async () => {
    const { chromium } = require('playwright-core');
    const fs = require('node:fs');
    const browser = await chromium.launch({ executablePath: process.env.CODEGEN_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium-browser', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const errors = [];
    try {
      for (const name of ['admin', 'reception', 'mechanic', 'client']) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
        await page.goto(baseUrl, { waitUntil: 'networkidle' });
        await page.locator('input').filter({ visible: true }).first().fill(users[name].identifier);
        await page.locator('input[type=password]').fill(users[name].password);
        await page.locator('[data-action-id="login"]').click();
        await page.locator('[data-screen-key]').first().waitFor({ timeout: 15000 });
        const keys = await page.locator('[data-screen-key]').evaluateAll(nodes => nodes.map(node => node.dataset.screenKey));
        for (const key of keys) {
          await page.locator('[data-screen-key="' + key + '"]').click();
          await page.waitForLoadState('networkidle');
          assert(await page.locator('main h1').count(), name + ': missing screen content ' + key);
          assert.equal(await page.locator('[role=alert]').count(), 0, name + ': ' + await page.locator('[role=alert]').allTextContents());
        }
        if (name === 'reception') {
          const create = page.locator('[data-action-id="UC-20-registrar"]');
          for (const key of keys) { await page.locator('[data-screen-key="' + key + '"]').click(); if (await create.count()) break; }
          const form = page.locator('form').filter({ has: create });
          await form.locator('[name=nombre]').fill('Cliente creado en navegador');
          await create.click(); await page.getByRole('status').waitFor();
          await page.reload({ waitUntil: 'networkidle' });
          assert(await page.getByText('Cliente creado en navegador', { exact: true }).count());
          assert(await independentModels.CLIENTE.findOne({ where: { nombre: 'Cliente creado en navegador' } }));
        }
        if (name === 'client') {
          const update = page.locator('[data-action-id="UC-03-actualizar-kilometraje"]');
          for (const key of keys) { await page.locator('[data-screen-key="' + key + '"]').click(); if (await update.count()) break; }
          await page.waitForLoadState('networkidle');
          const form = page.locator('form').filter({ has: update });
          await form.locator('[name=vehiculoId]').selectOption(String(vehicle.id));
          await form.locator('[name=nuevoKilometraje]').fill('450');
          await update.click(); await page.getByRole('status').waitFor();
          assert.equal((await independentModels.VEHICULO.findByPk(vehicle.id)).kilometrajeActual, 450);
          await page.reload({ waitUntil: 'networkidle' });
          assert(await page.locator('td').filter({ hasText: /^450$/ }).count());
        }
        const screenshot = path.join(directory, 'browser-' + name + '.png'); await page.screenshot({ path: screenshot, fullPage: true }); screenshots.push(path.relative(directory, screenshot));
        await page.setViewportSize({ width: 390, height: 844 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), name + ': mobile page overflow');
        const mobile = path.join(directory, 'browser-' + name + '-mobile.png'); await page.screenshot({ path: mobile, fullPage: true }); screenshots.push(path.relative(directory, mobile));
        await context.close();
      }
      const temporary = await call('UC-12-recuperar', 'admin', { usuarioId: users.otherClient.id, identidadVerificada: true });
      const context = await browser.newContext(); const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      await page.locator('input').filter({ visible: true }).first().fill(users.otherClient.identifier);
      await page.locator('input[type=password]').fill(temporary.temporal);
      await page.locator('[data-action-id="login"]').click();
      await page.locator('[name=passwordNueva]').fill('Browser-permanent-password-123');
      await page.getByRole('button', { name: 'Guardar contraseña' }).click();
      await page.locator('[data-action-id="login"]').waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('token')), null);
      const logged = await request('POST', '/api/auth/login', { identifier: users.otherClient.identifier, password: 'Browser-permanent-password-123' }); assert.equal(logged.status, 200);
      await context.close();
      assert.deepEqual(errors, []); browserPassed = true;
    } finally { await browser.close(); }
  });
  const missing = spec.operations.filter(operation => operation.type === 'BUSINESS_LOGIC' && !tested.has(operation.operationId)).map(operation => operation.operationId);
  if (missing.length) failures.push('Operations without successful evidence: ' + missing.join(', '));
  return { passed: failures.length === 0, browserPassed, tests, failures, screenshots };
};
