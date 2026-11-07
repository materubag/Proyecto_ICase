const fs = require('node:fs');
const path = require('node:path');
const b = require('./complete-reviewed-autron-contracts.cjs');
const { doc, spec, latest, parent, group, command, R, P, S, E, N, C, all, any, choose, count, q, a, create, update, calc, ret, each, schema, integer, text, money, array, field, entity, index, ownVehicle, assigned, audit, idempotent, alias } = b;

function slotSteps(slotRef, prefix = 'slot') {
  return [q(prefix, 'ESPACIOCITA', { id: slotRef, habilitado: true }, { lock: true, requireMatch: true }), a(prefix + 'future', C('gt', { $op: 'date_diff_days', from: R('now'), to: S(prefix, '0.inicio') }, 0), 409, 'El espacio ya comenzó'), q(prefix + 'reservations', 'RESERVACITA', { espacioId: slotRef }), a(prefix + 'free', C('eq', count(S(prefix + 'reservations')), 0), 409, 'El espacio ya está reservado')];
}
function ownAppointment(idRef) {
  return [q('appointment', 'CITA', { id: idRef }, { lock: true, requireMatch: true, errorStatus: 404 }), q('client', 'CLIENTE', { id: S('appointment', '0.clienteId'), usuarioId: R('user.id') }), a('appointmentOwner', C('not_empty', S('client', '0.id')), 404, 'Cita no encontrada')];
}
function cutoff() {
  return [a('beforeAttention', C('in', S('appointment', '0.estado'), ['SOLICITADA', 'CONFIRMADA', 'REPROGRAMADA']), 409), a('twoHours', C('gte', { $op: 'date_diff_days', from: R('now'), to: S('appointment', '0.fechaHora') }, 2 / 24), 409, 'El cambio requiere al menos dos horas antes de la cita')];
}
const slotCommand = command('UC-14', 'definir-espacio', 'Definir espacio de agenda', ['Administrador', 'Recepción'], { inicio: { type: 'string', format: 'date-time' }, fin: { type: 'string', format: 'date-time' } }, undefined, [a('ordered', C('gt', { $op: 'date_diff_days', from: P('inicio'), to: P('fin') }, 0), 400), create('slot', 'ESPACIOCITA', { inicio: P('inicio'), fin: P('fin'), habilitado: true, capacidad: 1 }), ret('response', S('slot'))]);
const availability = command('UC-14', 'disponibilidad', 'Consultar disponibilidad para vehículo propio', ['Cliente'], { vehiculoId: integer, fechaDesde: { type: 'string', format: 'date-time' }, fechaHasta: { type: 'string', format: 'date-time' } }, undefined, [...ownVehicle(P('vehiculoId')), q('slots', 'ESPACIOCITA', { habilitado: true }, { filters: [{ field: 'inicio', operator: 'gte', value: P('fechaDesde') }, { field: 'inicio', operator: 'lt', value: P('fechaHasta') }, { field: 'inicio', operator: 'gt', value: R('now') }] }), q('reservations', 'RESERVACITA'), calc('available', E('filter', S('slots'), { condition: C('not_in', R('item.id'), E('pluck', S('reservations'), { field: 'espacioId' })) })), ret('response', S('available'))]);
const request = command('UC-14', 'solicitar', 'Solicitar cita propia', ['Cliente'], { vehiculoId: integer, espacioId: integer, motivo: text, claveOperacion: text }, undefined, idempotent('appointment-request', [...ownVehicle(P('vehiculoId')), ...slotSteps(P('espacioId')), create('appointmentCreated', 'CITA', { clienteId: S('ownershipvehicle', '0.clienteId'), vehiculoId: P('vehiculoId'), espacioId: P('espacioId'), fechaHora: S('slot', '0.inicio'), motivo: E('trim', P('motivo')), estado: 'SOLICITADA', fechaCreacion: R('now') }), create('reservation', 'RESERVACITA', { espacioId: P('espacioId'), citaId: S('appointmentCreated', 'id') }), audit('CITA', S('appointmentCreated', 'id'), 'SOLICITAR')], S('appointmentCreated')));
const requestChange = command('UC-14', 'solicitar-reprogramacion', 'Solicitar reprogramación propia', ['Cliente'], { citaId: integer, nuevoEspacioId: integer, motivo: text, claveOperacion: text }, undefined, idempotent('appointment-change-request', [...ownAppointment(P('citaId')), ...cutoff(), ...slotSteps(P('nuevoEspacioId')), create('request', 'SOLICITUDREPROGRAMACION', { citaId: P('citaId'), nuevoEspacioId: P('nuevoEspacioId'), motivo: E('trim', P('motivo')), estado: 'PENDIENTE', solicitanteUsuarioId: R('user.id') }), ret('created', S('request'))], S('request')));
const cancel = command('UC-14', 'cancelar', 'Cancelar cita propia', ['Cliente'], { citaId: integer, motivo: text, claveOperacion: text }, undefined, idempotent('appointment-cancel', [...ownAppointment(P('citaId')), ...cutoff(), a('reason', C('not_empty', E('trim', P('motivo'))), 400), update('cancelled', 'CITA', { id: P('citaId') }, { estado: 'CANCELADA', motivo: E('trim', P('motivo')) }), update('released', 'RESERVACITA', { citaId: P('citaId') }, { espacioId: null }), audit('CITA', P('citaId'), 'CANCELAR', { anterior: S('appointment', '0.estado'), nuevo: 'CANCELADA', motivo: P('motivo') })], S('cancelled')));
const resolve = command('UC-14', 'resolver-reprogramacion', 'Resolver reprogramación', ['Recepción'], { solicitudId: integer, decision: { type: 'string', enum: ['APROBAR', 'RECHAZAR'] }, claveOperacion: text }, undefined, idempotent('appointment-change-resolve', [q('request', 'SOLICITUDREPROGRAMACION', { id: P('solicitudId') }, { lock: true, requireMatch: true }), a('pending', C('eq', S('request', '0.estado'), 'PENDIENTE'), 409), q('appointment', 'CITA', { id: S('request', '0.citaId') }, { lock: true, requireMatch: true }), a('notStarted', C('in', S('appointment', '0.estado'), ['SOLICITADA', 'CONFIRMADA', 'REPROGRAMADA']), 409), each('approve', choose(C('eq', P('decision'), 'APROBAR'), [{}], []), [...slotSteps(S('request', '0.nuevoEspacioId')), update('reservation', 'RESERVACITA', { citaId: S('request', '0.citaId') }, { espacioId: S('request', '0.nuevoEspacioId') }), update('reprogrammed', 'CITA', { id: S('request', '0.citaId') }, { espacioId: S('request', '0.nuevoEspacioId'), fechaHora: S('slot', '0.inicio'), estado: 'REPROGRAMADA' }), audit('CITA', S('request', '0.citaId'), 'REPROGRAMAR', { anterior: S('appointment', '0.estado'), nuevo: 'REPROGRAMADA' })]), update('resolved', 'SOLICITUDREPROGRAMACION', { id: P('solicitudId') }, { estado: choose(C('eq', P('decision'), 'APROBAR'), 'APROBADA', 'RECHAZADA'), resueltoPorUsuarioId: R('user.id'), fechaResolucion: R('now') })], S('resolved')));
const confirm = command('UC-14', 'confirmar', 'Confirmar cita', ['Recepción'], { citaId: integer }, undefined, [q('appointment', 'CITA', { id: P('citaId') }, { lock: true, requireMatch: true }), a('status', C('in', S('appointment', '0.estado'), ['SOLICITADA', 'REPROGRAMADA']), 409), update('confirmed', 'CITA', { id: P('citaId') }, { estado: 'CONFIRMADA' }), audit('CITA', P('citaId'), 'CONFIRMAR', { anterior: S('appointment', '0.estado'), nuevo: 'CONFIRMADA' }), ret('response', S('confirmed'))]);
group('UC-14', [slotCommand, availability, request, requestChange, cancel, resolve, confirm]);

// Enforce exactly the approved role/permission pairs; never infer a grant.
const matrixDecision = Object.values(spec.confirmedDecisions).find(d => d.data?.targetId === 'UC-22' && d.customAnswer?.includes('USUARIOS_REGISTRAR'));
if (!matrixDecision) throw new Error('Approved permission matrix missing');
const codes = {};
for (const line of matrixDecision.customAnswer.split('\n')) {
  const match = line.match(/\|\s*([A-Z][A-Z_]+)\s*\|\s*([^|]+)\|/) || line.match(/^([A-Z][A-Z_]+)\t+(.+)$/);
  if (match) codes[match[1]] = match[2].split(',').map(role => role.trim());
}
if (!Object.keys(codes).length) throw new Error('Cannot parse approved permission matrix');
doc.permissionMatrix = codes;
const allowedPairs = Object.entries(codes).map(([code, roles]) => all(C('eq', S('permission', '0.codigo'), code), C('in', S('role', '0.nombre'), roles)));
const grant = command('UC-22', 'asignar-permiso', 'Asignar permiso aprobado', ['Administrador'], { rolId: integer, permisoId: integer }, undefined, [q('role', 'ROL', { id: P('rolId') }, { lock: true, requireMatch: true }), q('permission', 'PERMISO', { id: P('permisoId') }, { requireMatch: true }), a('pairApproved', any(...allowedPairs), 403, 'La asociación no está aprobada en la matriz'), q('previous', 'ROLPERMISO', { rolId: P('rolId'), permisoId: P('permisoId') }), create('association', 'ROLPERMISO', { rolId: P('rolId'), permisoId: P('permisoId') }, { when: C('eq', count(S('previous')), 0) }), audit('ROLPERMISO', choose(C('gt', count(S('previous')), 0), S('previous', '0.id'), S('association', 'id')), 'ASIGNAR_PERMISO', { rolId: P('rolId'), permisoId: P('permisoId') }), ret('response', choose(C('gt', count(S('previous')), 0), S('previous', '0'), S('association')))]);
group('UC-22', [grant]);

// Persistent private-upload references are scoped to caller and context.
entity('ARCHIVOPRIVADO', { archivoId: { type: 'DataTypes.STRING', unique: true, allowNull: false }, usuarioId: 'DataTypes.INTEGER', diagnosticoId: 'DataTypes.INTEGER', recepcionId: 'DataTypes.INTEGER', filename: { type: 'DataTypes.STRING', unique: true }, formatoMime: 'DataTypes.STRING', pesoBytes: 'DataTypes.INTEGER', fechaCarga: { type: 'DataTypes.DATE', defaultValue: 'NOW' } });
const attach = command('UC-08', 'adjuntar-evidencia', 'Adjuntar evidencia a diagnóstico', ['Mecánico'], { diagnosticoId: integer, archivoId: text, observaciones: { type: 'string' } }, ['diagnosticoId', 'archivoId'], [...assigned(P('diagnosticoId')), q('file', 'ARCHIVOPRIVADO', { archivoId: P('archivoId'), usuarioId: R('user.id'), diagnosticoId: P('diagnosticoId') }, { lock: true, requireMatch: true }), q('previous', 'EVIDENCIAMULTIMEDIA', { archivoId: P('archivoId') }), a('sameDiagnostic', any(C('eq', count(S('previous')), 0), C('eq', S('previous', '0.diagnosticoId'), P('diagnosticoId'))), 409), create('evidence', 'EVIDENCIAMULTIMEDIA', { archivoId: P('archivoId'), diagnosticoId: P('diagnosticoId'), usuarioId: R('user.id'), observaciones: P('observaciones'), urlOriginal: { $op: 'template', parts: ['/api/upload/files/', S('file', '0.filename')] }, pesoBytes: S('file', '0.pesoBytes'), formatoMime: S('file', '0.formatoMime') }, { when: C('eq', count(S('previous')), 0) }), ret('response', choose(C('gt', count(S('previous')), 0), S('previous', '0'), S('evidence')))]);
group('UC-08', [attach]);
alias('UC-33', ['UC-08-adjuntar-evidencia', 'UC-06-registrar-fallas']);

// Cycle identity is stable for the approved date/km occurrence; DB enforces uniqueness.
const evaluate = doc.groups.flatMap(group => group.commands).find(op => op.operationId === 'UC-01-evaluar-avisos');
function cycleSteps(steps) {
  for (const step of steps || []) {
    if (step.action === 'CREATE' && step.entity === 'ALERTA' && step.fields.programacionId) step.fields.cicloId = E('hash', { programacionId: step.fields.programacionId, fechaProxima: step.fields.fechaProxima, kilometrajeProximo: step.fields.kilometrajeProximo });
    cycleSteps(step.steps);
  }
}
cycleSteps(evaluate.steps);
// Mandatory customer in direct sale supersedes the earlier optional contract.
const sale = doc.groups.flatMap(group => group.commands).find(op => op.operationId === 'UC-01-crear-venta');
sale.input.bodySchema.required = [...new Set([...sale.input.bodySchema.required, 'clienteId'])];

if (require.main === module && process.argv.includes('--write')) fs.writeFileSync(path.resolve(__dirname, '../src/specifications/projects', spec.project.id + '.commands.json'), JSON.stringify(doc, null, 2) + '\n');
module.exports = b;
