const fs = require('node:fs');
const path = require('node:path');
const { decisionHash } = require('../src/services/codegen/commandContracts');
const b = require('./workflows-reviewed-autron-contracts.cjs');
const { doc, spec, latest, parent, command, R, P, S, E, N, C, all, any, choose, count, q, a, create, update, calc, ret, each, schema, integer, text, ownVehicle, assigned, audit } = b;
const commands = () => doc.groups.flatMap(group => group.commands);
const hasAudit = steps => (steps || []).some(step => step.entity === 'AUDITORIA' || hasAudit(step.steps));
for (const operation of commands()) operation.auditWrites = !hasAudit(operation.steps);
function append(id, operation, permissionSource) {
  const group = doc.groups.find(group => group.parentOperationId === id);
  operation.roleEvidence = spec.confirmedDecisions[group.decisionQuestionId].customAnswer;
  operation.requirementIds = parent(id)?.requirementIds || group.commands[0].requirementIds;
  if (permissionSource) operation.permissionSourceOperationId = permissionSource;
  group.commands = group.commands.filter(existing => existing.operationId !== operation.operationId);
  group.commands.push(operation);
}
append('UC-25', command('UC-25', 'crear', 'Añadir servicio', ['Administrador'], { nombre: text, descripcion: { type: 'string' }, precioManoObra: { type: 'number', minimum: 0 }, duracionEstimadaMinutos: integer }, ['nombre', 'precioManoObra', 'duracionEstimadaMinutos'], [a('name', C('not_empty', E('trim', P('nombre'))), 400), create('service', 'SERVICIO', { nombre: E('trim', P('nombre')), descripcion: P('descripcion'), precioManoObra: P('precioManoObra'), duracionEstimadaMinutos: P('duracionEstimadaMinutos'), activo: true }), ret('response', S('service'))]), 'op_servicios_create');
append('UC-14', command('UC-14', 'mis-citas', 'Consultar mis citas', ['Cliente'], {}, [], [q('clients', 'CLIENTE', { usuarioId: R('user.id') }), q('appointments', 'CITA', {}, { filters: [{ field: 'clienteId', operator: 'in', value: E('pluck', S('clients'), { field: 'id' }) }] }), ret('response', S('appointments'))]), 'UC-14');
append('UC-14', command('UC-14', 'solicitudes', 'Consultar solicitudes de reprogramación', ['Recepción'], {}, [], [q('requests', 'SOLICITUDREPROGRAMACION'), ret('response', S('requests'))]));
append('UC-23', command('UC-23', 'propuestas', 'Consultar propuestas OBD', ['Administrador', 'Mecánico'], {}, [], [q('own', 'PROPUESTAOBDCODIGO', { usuarioPropuestaId: R('user.id') }, { when: C('eq', R('user.role'), 'Mecánico') }), q('all', 'PROPUESTAOBDCODIGO', {}, { when: C('eq', R('user.role'), 'Administrador') }), ret('response', choose(C('eq', R('user.role'), 'Administrador'), S('all'), S('own')))]), 'UC-23');
append('UC-22', command('UC-22', 'asociaciones', 'Consultar asociaciones de permisos', ['Administrador'], {}, [], [q('pairs', 'ROLPERMISO'), ret('response', S('pairs'))]), 'UC-22');
append('UC-22', command('UC-22', 'permisos', 'Consultar permisos aprobados', ['Administrador'], {}, [], [q('permissions', 'PERMISO'), ret('response', S('permissions'))]), 'UC-22');
append('UC-12', command('UC-12', 'roles', 'Consultar roles existentes', ['Administrador'], {}, [], [q('roles', 'ROL'), ret('response', S('roles'))]), 'UC-12');
append('UC-06', command('UC-06', 'expediente', 'Consultar expediente del vehículo', ['Recepción', 'Mecánico'], { vehiculoId: integer }, undefined, [q('vehicle', 'VEHICULO', { id: P('vehiculoId') }, { requireMatch: true }), q('diagnostics', 'DIAGNOSTICO', { vehiculoId: P('vehiculoId') }), q('failures', 'DIAGNOSTICOFALLA', {}, { filters: [{ field: 'diagnosticoId', operator: 'in', value: E('pluck', S('diagnostics'), { field: 'id' }) }] }), q('orders', 'ORDENTRABAJO', { vehiculoId: P('vehiculoId') }), ret('response', { vehiculo: S('vehicle', '0'), diagnosticos: S('diagnostics'), fallas: S('failures'), ordenes: S('orders') })]), 'op_vehiculos_list');
append('UC-08', command('UC-08', 'galeria', 'Consultar fotografías del diagnóstico', ['Mecánico'], { diagnosticoId: integer }, undefined, [...assigned(P('diagnosticoId')), q('evidence', 'EVIDENCIAMULTIMEDIA', { diagnosticoId: P('diagnosticoId') }), ret('response', S('evidence'))]), 'UC-08');
append('UC-21', command('UC-21', 'mis-notificaciones', 'Consultar mis notificaciones', ['Administrador', 'Recepción', 'Mecánico', 'Cliente'], {}, [], [q('notifications', 'NOTIFICACION', { usuarioId: R('user.id') }), ret('response', S('notifications'))]));
append('UC-01', command('UC-01', 'enviar-cotizacion', 'Enviar cotización al cliente', ['Recepción'], { cotizacionId: integer }, undefined, [q('quotation', 'COTIZACION', { id: P('cotizacionId') }, { requireMatch: true, lock: true }), a('draft', C('eq', S('quotation', '0.estado'), 'BORRADOR'), 409), q('lines', 'COTIZACIONITEM', { cotizacionId: P('cotizacionId') }), a('notEmpty', C('gt', count(S('lines')), 0), 422), each('complete', S('lines'), [a('quantity', C('gt', R('item.cantidad'), 0), 422), a('price', C('gte', R('item.precioUnitario'), 0), 422), a('total', C('gte', R('item.total'), 0), 422)]), update('sent', 'COTIZACION', { id: P('cotizacionId') }, { estado: 'ENVIADA' }), audit('COTIZACION', P('cotizacionId'), 'ENVIAR', { anterior: 'BORRADOR', nuevo: 'ENVIADA' }), ret('response', S('sent'))]));
commands().find(command => command.operationId === 'UC-16-registrar').uploadContext = 'recepcion';

// Foreign keys for new persisted references. Restrict deletion of referenced data.
doc.relationships ||= [];
for (const [host, key, target] of [
  ['ACTIVIDAD', 'itemAutorizadoId', 'COTIZACIONITEM'], ['CITA', 'espacioId', 'ESPACIOCITA'], ['RECEPCIONCOMPRA', 'compraId', 'COMPRA'], ['RECEPCIONCOMPRA', 'usuarioId', 'USUARIO'], ['RECEPCIONCOMPRADETALLE', 'recepcionCompraId', 'RECEPCIONCOMPRA'], ['RECEPCIONCOMPRADETALLE', 'compraDetalleId', 'COMPRADETALLE'], ['RESERVACITA', 'espacioId', 'ESPACIOCITA'], ['RESERVACITA', 'citaId', 'CITA'], ['SOLICITUDREPROGRAMACION', 'citaId', 'CITA'], ['SOLICITUDREPROGRAMACION', 'nuevoEspacioId', 'ESPACIOCITA'], ['PROPUESTAOBDCODIGO', 'obdCodigoId', 'OBDCODIGO'], ['REVISIONZONA', 'diagnosticoId', 'DIAGNOSTICO'], ['ARCHIVOPRIVADO', 'diagnosticoId', 'DIAGNOSTICO'], ['RESULTADOCOMANDO', 'usuarioId', 'USUARIO']
]) if (!doc.relationships.some(rel => rel.sourceEntity === host && rel.foreignKey === key)) doc.relationships.push({ id: 'reviewed_' + host + '_' + key, sourceEntity: host, targetEntity: target, cardinality: 'N:1', foreignKey: key, onDelete: 'RESTRICT' });

// Correct multi-CLIENTE filtering for quotation reads; never pick the first.
const mileage = doc.groups.find(group => group.parentOperationId === 'UC-03');
const ownQuoteScope = { operationId: 'op_cotizaciones_list', recordScope: [{ roles: ['Cliente'], lookups: [{ id: 'clientes', entity: 'CLIENTE', many: true, where: { usuarioId: R('user.id') } }], whereIn: { field: 'clienteId', lookup: 'clientes', valueField: 'id' }, immutableFields: ['clienteId'] }] };
mileage.recordScopes = [...(mileage.recordScopes || []).filter(scope => scope.operationId !== ownQuoteScope.operationId), ownQuoteScope];
const diagnosisGroup = doc.groups.find(group => group.parentOperationId === 'UC-06');
const assignmentLookups = [
  { id: 'assignments', entity: 'ORDENMECANICO', many: true, where: { usuarioId: R('user.id') } },
  { id: 'orders', entity: 'ORDENTRABAJO', many: true, whereIn: { field: 'id', lookup: 'assignments', valueField: 'ordenTrabajoId' } },
  { id: 'quotes', entity: 'COTIZACION', many: true, whereIn: { field: 'id', lookup: 'orders', valueField: 'cotizacionId' } },
  { id: 'diagnostics', entity: 'DIAGNOSTICO', many: true, whereIn: { field: 'id', lookup: 'quotes', valueField: 'diagnosticoId' } }
];
diagnosisGroup.recordScopes = [];
for (const operation of spec.operations.filter(op => op.type === 'READ' && ['DIAGNOSTICO', 'EVIDENCIAMULTIMEDIA', 'ACTIVIDAD'].includes(op.entity) && op.authorizedRoles.includes('Mecánico'))) {
  diagnosisGroup.recordScopes.push({ operationId: operation.operationId, recordScope: [{ roles: ['Mecánico'], lookups: assignmentLookups, whereIn: { field: operation.entity === 'DIAGNOSTICO' ? 'id' : operation.entity === 'ACTIVIDAD' ? 'ordenTrabajoId' : 'diagnosticoId', lookup: operation.entity === 'ACTIVIDAD' ? 'orders' : 'diagnostics', valueField: 'id' }, immutableFields: [] }] });
}

const lookup = {
  clienteId: { operationId: 'op_clientes_list', label: ['nombre', 'correo'] },
  vehiculoId: { operationId: 'op_vehiculos_list', label: ['placa', 'marca', 'modelo'], filter: { field: 'clienteId', from: 'clienteId', optional: true } },
  rolId: { operationId: 'UC-12-roles', label: ['nombre'] },
  permisoId: { operationId: 'UC-22-permisos', label: ['codigo', 'descripcion'] },
  proveedorId: { operationId: 'op_proveedores_list', label: ['nombre'] },
  productoId: { operationId: 'op_productos_list', label: ['codigo', 'nombre'] },
  repuestoId: { operationId: 'op_productos_list', label: ['codigo', 'nombre'] },
  servicioId: { operationId: 'op_servicios_list', label: ['nombre'] },
  ordenTrabajoId: { operationId: 'op_orden_trabajos_list', label: ['id', 'estado', 'vehiculoId'] },
  cotizacionId: { operationId: 'op_cotizaciones_list', label: ['id', 'estado'] },
  diagnosticoId: { operationId: 'op_diagnosticos_list', label: ['id', 'vehiculoId', 'observaciones'] },
  recepcionId: { operationId: 'op_recepciones_list', label: ['id', 'vehiculoId'] },
  usuarioId: { operationId: 'op_usuarios_list', label: ['nombre', 'correo'] },
  compraId: { operationId: 'op_compras_list', label: ['id', 'numeroDocumento', 'estado'] },
  compraDetalleId: { operationId: 'op_compra_detalles_list', label: ['id', 'productoId', 'cantidad'] },
  citaId: { operationId: 'UC-14-mis-citas', label: ['id', 'fechaHora', 'estado'] },
  propuestaId: { operationId: 'UC-23-propuestas', label: ['id', 'tipo', 'estado'] },
  obdCodigoId: { operationId: 'op_obd_codigos_list', label: ['codigo', 'descripcionCaso'] },
  itemAutorizadoId: { operationId: 'op_cotizacion_items_list', label: ['id', 'descripcion', 'estadoAprobacion'] }
};
const rawOperations = new Map(spec.operations.map(op => [op.operationId, op]));
for (const operation of commands()) rawOperations.set(operation.operationId, operation);
for (const definition of Object.values(lookup)) {
  const operation = rawOperations.get(definition.operationId);
  if (operation) Object.assign(definition, { route: operation.route, method: operation.method, permissions: operation.authorizedRoles });
}

const screens = [
  ['/citas', ['Administrador', 'Recepción', 'Mecánico'], ['UC-14-definir-espacio', 'UC-14-confirmar', 'UC-14-resolver-reprogramacion'], ['op_citas_list', 'UC-14-solicitudes'], 'UC-14'],
  ['/conocimiento', ['Administrador', 'Mecánico', 'Recepción'], ['UC-23-proponer-alta', 'UC-23-proponer-cambio', 'UC-23-resolver'], ['op_obd_codigos_list', 'UC-23-propuestas'], 'UC-23'],
  ['/servicios', ['Administrador', 'Mecánico', 'Recepción'], ['UC-25-crear', 'UC-25-actualizar'], ['op_servicios_list'], 'UC-25'],
  ['/diagnosticos', ['Mecánico', 'Recepción', 'Administrador'], ['UC-06-registrar', 'UC-06-registrar-fallas', 'UC-08-adjuntar-evidencia', 'UC-08-galeria', 'UC-06-expediente'], ['op_diagnosticos_list'], 'UC-06'],
  ['/clientes', ['Recepción'], ['UC-20-registrar', 'UC-20-actualizar'], ['op_clientes_list'], 'UC-20'],
  ['/vehiculos', ['Recepción'], ['UC-24-registrar', 'UC-06-expediente'], ['op_vehiculos_list'], 'UC-24'],
  ['/usuarios', ['Administrador'], ['UC-12-registrar', 'UC-12-desactivar', 'UC-12-recuperar'], ['op_usuarios_list'], 'UC-12'],
  ['/inventario', ['Administrador', 'Recepción', 'Mecánico'], ['UC-11-registrar', 'UC-11-bajo-stock', 'UC-07-ajustar'], ['op_productos_list'], 'UC-11'],
  ['/cotizaciones-cliente', ['Cliente'], ['UC-18-decision'], ['op_cotizaciones_list'], 'UC-18'],
  ['/mis-vehiculos', ['Cliente'], ['UC-03-actualizar-kilometraje'], ['op_vehiculos_list'], 'UC-03'],
  ['/progreso-reparacion', ['Cliente'], ['UC-17-consultar'], ['op_vehiculos_list'], 'UC-17'],
  ['/citas-cliente', ['Cliente'], ['UC-14-disponibilidad', 'UC-14-solicitar', 'UC-14-solicitar-reprogramacion', 'UC-14-cancelar'], ['UC-14-mis-citas'], 'UC-14'],
  ['/compras', ['Administrador', 'Recepción'], ['UC-07-proveedor', 'UC-07-compra', 'UC-07-recibir'], ['op_compras_list', 'op_proveedores_list'], 'UC-07'],
  ['/recepcion', ['Recepción'], ['UC-16-registrar'], ['op_recepciones_list'], 'UC-16'],
  ['/reportes', ['Administrador'], [], ['op_auditorias_list'], 'UC-10'],
  ['/ventas', ['Administrador', 'Recepción'], ['UC-01-crear-venta', 'UC-01-confirmar-venta', 'UC-01-configurar-impuesto-producto', 'UC-01-configurar-impuesto-servicio'], ['op_ventas_list'], 'UC-01'],
  ['/reparaciones', ['Mecánico', 'Recepción', 'Administrador'], ['UC-15-generar-orden', 'UC-02-registrar-actividad', 'UC-02-asignar-mecanicos', 'UC-02-consumir-repuesto', 'UC-01-crear-cotizacion', 'UC-01-enviar-cotizacion', 'UC-01-configurar-mantenimiento'], ['op_orden_trabajos_list'], 'UC-15']
];
doc.workspaces = screens.map(([route, roles, commandIds, readerIds, approvalId]) => {
  const screen = spec.screens.find(screen => screen.route === route);
  if (!screen) throw new Error('Screen missing ' + route);
  const decision = latest(approvalId);
  return { screenId: screen.id, name: screen.name, route, roles, commandIds, readerIds, lookups: lookup, decisionQuestionId: decision.questionId, decisionHash: decisionHash(decision) };
});
const permissionDecision = latest('UC-22');
doc.workspaces.push({ screenId: 'reviewed_roles_permissions', create: true, name: 'Roles y permisos', route: '/seguridad/roles-permisos', roles: ['Administrador'], commandIds: ['UC-22-asignar-permiso'], readerIds: ['UC-22-asociaciones'], lookups: lookup, decisionQuestionId: permissionDecision.questionId, decisionHash: decisionHash(permissionDecision) });
const notificationDecision = Object.values(spec.confirmedDecisions).find(decision => decision.data?.targetId === 'UC-21' && decision.customAnswer?.includes('operación interna'));
doc.workspaces.push({ screenId: 'reviewed_notifications', create: true, name: 'Mis notificaciones', route: '/notificaciones', roles: ['Administrador', 'Recepción', 'Mecánico', 'Cliente'], commandIds: [], readerIds: ['UC-21-mis-notificaciones'], lookups: {}, decisionQuestionId: notificationDecision.questionId, decisionHash: decisionHash(notificationDecision) });
const output = path.resolve(__dirname, '../src/specifications/projects', spec.project.id + '.commands.json');
doc.acceptanceSuite = { id: 'autron-reviewed-v1' };
const auditDetail = doc.entityFields.find(change => change.entity === 'AUDITORIA' && change.attribute.fieldName === 'detalle');
if (auditDetail) auditDetail.attribute.type = 'DataTypes.TEXT';
else doc.entityFields.push({ entity: 'AUDITORIA', attribute: { ...spec.entities.find(entity => entity.modelName === 'AUDITORIA').attributes.find(attribute => attribute.fieldName === 'detalle'), type: 'DataTypes.TEXT' } });
for (const change of doc.entityFields) if (['cantidad', 'cantidadRecibida', 'stock', 'stockMinimo', 'stockResultante'].includes(change.attribute.fieldName)) change.attribute.type = 'DataTypes.DECIMAL(18, 6)';
for (const [model, names] of Object.entries({ COTIZACIONITEM: ['cantidad'], VENTADETALLE: ['cantidad'] })) for (const fieldName of names) {
  const existing = doc.entityFields.find(change => change.entity === model && change.attribute.fieldName === fieldName);
  if (existing) existing.attribute.type = 'DataTypes.DECIMAL(18, 6)';
  else doc.entityFields.push({ entity: model, attribute: { ...spec.entities.find(entity => entity.modelName === model).attributes.find(attribute => attribute.fieldName === fieldName), type: 'DataTypes.DECIMAL(18, 6)' } });
}
function quantityPrecision(steps) {
  for (const step of steps || []) {
    if (step.action === 'CALCULATION' && ['stock', 'received'].includes(step.id) && ['add', 'subtract'].includes(step.expression?.$op)) step.expression.scale = 6;
    quantityPrecision(step.steps);
  }
}
commands().forEach(operation => quantityPrecision(operation.steps));
for (const entity of doc.entities) for (const attribute of entity.attributes || []) if (['cantidad', 'cantidadRecibida', 'stock', 'stockMinimo', 'stockResultante'].includes(attribute.fieldName)) attribute.type = 'DataTypes.DECIMAL(18, 6)';
const adjustment = commands().find(operation => operation.operationId === 'UC-07-ajustar');
function adjustPrecision(steps) { for (const step of steps || []) { if (step.action === 'CREATE' && step.entity === 'MOVIMIENTOINVENTARIO') step.fields.cantidad.else.scale = 6; adjustPrecision(step.steps); } }
adjustPrecision(adjustment.steps);
const evaluation = commands().find(operation => operation.operationId === 'UC-01-evaluar-avisos');
const cycle = evaluation.steps.find(step => step.action === 'FOR_EACH');
cycle.steps = cycle.steps.filter(step => !['ownerClient', 'ownerAccount', 'notification'].includes(step.id));
const alert = cycle.steps.find(step => step.entity === 'ALERTA' && step.action === 'CREATE');
const day = date => ({ $op: 'date_start', date: { $op: 'local_date', date, timeZone: 'America/Guayaquil' }, timeZone: 'America/Guayaquil' });
const due = cycle.steps.find(step => step.id === 'dateDue');
due.expression = choose(C('not_empty', R('item.fechaProxima')), choose(C('lte', { $op: 'date_diff_days', from: day(R('now')), to: day(R('item.fechaProxima')) }, 7), true, false), false);
cycle.steps.splice(cycle.steps.indexOf(alert), 0, q('ownerClient', 'CLIENTE', { id: S('vehicle', '0.clienteId') }), q('ownerAccount', 'USUARIO', { id: S('ownerClient', '0.usuarioId'), activo: true }, { when: C('not_empty', S('ownerClient', '0.usuarioId')) }));
alert.when = all(any(C('eq', S('dateDue'), true), C('eq', S('kmDue'), true)), C('is_empty', S('existing', '0.id')), C('not_empty', S('ownerAccount', '0.id')));
alert.fields.usuarioId = S('ownerAccount', '0.id');
alert.fields.mensaje = { $op: 'template', parts: ['Vehículo ', S('vehicle', '0.placa'), ': mantenimiento próximo o vencido. Fecha: ', R('item.fechaProxima'), '; kilometraje: ', R('item.kilometrajeProximo'), '; criterio: ', alert.fields.criterio] };
cycle.steps.push(create('notification', 'NOTIFICACION', { usuarioId: S('ownerAccount', '0.id'), tipo: 'MANTENIMIENTO_PROXIMO', mensaje: S('alert', 'mensaje'), estado: 'PENDIENTE', fechaCreacion: R('now') }, { when: C('not_empty', S('alert', 'id')) }));
const maintenance = commands().find(operation => operation.operationId === 'UC-01-configurar-mantenimiento');
maintenance.steps.find(step => step.id === 'created').fields.fechaProxima.then.timeZone = 'America/Guayaquil';
const quotation = commands().find(operation => operation.operationId === 'UC-01-crear-cotizacion');
quotation.steps = quotation.steps.filter(step => step.id !== 'quoteVehicle');
quotation.steps.splice(1, 0, q('quoteVehicle', 'VEHICULO', { id: S('diagnostic', '0.vehiculoId') }, { requireMatch: true }));
quotation.steps.find(step => step.id === 'header').fields.clienteId = S('quoteVehicle', '0.clienteId');
if (process.argv.includes('--write')) fs.writeFileSync(output, JSON.stringify(doc, null, 2) + '\n');
module.exports = b;
