const token = (value = '') => String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');

const SAMPLE = {
  cliente: 'Ana Pérez',
  placa: 'ABC-123',
  orden: 'ORD-001',
  cita: 'CIT-014',
  dtc: 'P0301'
};

const SCREEN_CATALOG = [
  { key: 'login', name: 'Inicio de Sesión y Acceso al Sistema', route: '/login', actorName: 'Público', archetype: 'A', primaryAction: 'Ingresar',
    description: 'Portal de autenticación: correo, contraseña y acceso según rol.',
    fields: ['Correo', 'Contraseña'], nav: [] },
  { key: 'recepcion', name: 'Recepción e Inspección de Vehículos', route: '/recepcion', actorName: 'Recepción', archetype: 'B', primaryAction: 'Registrar ingreso',
    description: 'Registro de ingreso del vehículo: cliente, placa, kilometraje, combustible, motivo e inspección visual con fotos.',
    fields: ['Cliente', 'Placa', 'Kilometraje', 'Nivel de combustible', 'Motivo de ingreso', 'Fotografías'],
    tableHeaders: ['Ingreso', 'Placa', 'Cliente', 'Estado'],
    sampleRows: [[SAMPLE.orden, SAMPLE.placa, SAMPLE.cliente, 'En recepción']] },
  { key: 'citas', name: 'Agenda y Gestión de Citas de Taller', route: '/citas', actorName: 'Recepción', archetype: 'B', primaryAction: 'Agendar cita',
    description: 'Agenda de citas, bahías disponibles y confirmación de turnos.',
    fields: ['Cliente', 'Vehículo', 'Fecha', 'Hora', 'Bahía', 'Servicio'],
    tableHeaders: ['Cita', 'Cliente', 'Placa', 'Fecha', 'Estado'],
    sampleRows: [[SAMPLE.cita, SAMPLE.cliente, SAMPLE.placa, '2026-11-04 09:00', 'Confirmada']] },
  { key: 'clientes', name: 'Directorio y Fichas de Clientes', route: '/clientes', actorName: 'Recepción', archetype: 'C', primaryAction: 'Guardar cliente',
    description: 'Fichas de clientes, contacto e historial de visitas.',
    fields: ['Nombre', 'Documento', 'Teléfono', 'Correo'],
    tableHeaders: ['Cliente', 'Documento', 'Teléfono', 'Visitas'],
    sampleRows: [[SAMPLE.cliente, '1020', '3001234567', '3']] },
  { key: 'vehiculos', name: 'Expediente Digital de Vehículos', route: '/vehiculos', actorName: 'Recepción', archetype: 'C', primaryAction: 'Actualizar expediente',
    description: 'Hoja de vida del vehículo: datos técnicos, cliente asociado e historial.',
    fields: ['Placa', 'Marca', 'Modelo', 'Año', 'Cliente'],
    tableHeaders: ['Placa', 'Cliente', 'Último servicio', 'Estado'],
    sampleRows: [[SAMPLE.placa, SAMPLE.cliente, SAMPLE.orden, 'Activo']] },
  { key: 'citas_cliente', name: 'Portal Cliente: Solicitud de Citas', route: '/citas-cliente', actorName: 'Cliente', archetype: 'B', primaryAction: 'Solicitar cita',
    description: 'El cliente solicita, consulta o cancela citas según disponibilidad.',
    fields: ['Vehículo', 'Fecha preferida', 'Servicio', 'Comentario'] },
  { key: 'vehiculos_cliente', name: 'Portal Cliente: Mis Vehículos', route: '/mis-vehiculos', actorName: 'Cliente', archetype: 'C', primaryAction: 'Ver detalle',
    description: 'Vehículos del cliente, alertas de mantenimiento e historial.',
    tableHeaders: ['Placa', 'Próximo mantenimiento', 'Estado'],
    sampleRows: [[SAMPLE.placa, 'Cambio de aceite', 'Al día']] },
  { key: 'cotizaciones_cliente', name: 'Portal Cliente: Aprobación de Presupuestos', route: '/cotizaciones-cliente', actorName: 'Cliente', archetype: 'B', primaryAction: 'Aprobar presupuesto',
    description: 'El cliente ve la cotización (repuestos y mano de obra) y aprueba, aprueba en parte o rechaza.',
    fields: ['Decisión', 'Observación'] },
  { key: 'progreso_reparacion', name: 'Portal Cliente: Seguimiento de Avance', route: '/progreso-reparacion', actorName: 'Cliente', archetype: 'C', primaryAction: 'Consultar avance',
    description: 'Estado y porcentaje de avance de la orden de reparación.',
    tableHeaders: ['Orden', 'Placa', 'Avance', 'Estado'],
    sampleRows: [[SAMPLE.orden, SAMPLE.placa, '40%', 'En reparación']] },
  { key: 'diagnosticos', name: 'Diagnóstico Técnico y Averías OBD', route: '/diagnosticos', actorName: 'Mecánico', archetype: 'B', primaryAction: 'Guardar diagnóstico',
    description: 'Diagnóstico por vehículo: códigos OBD, severidad, observaciones y evidencias.',
    fields: ['Vehículo', 'Código OBD', 'Severidad', 'Observación', 'Fotografías'],
    tableHeaders: ['Orden', 'Placa', 'DTC', 'Severidad'],
    sampleRows: [[SAMPLE.orden, SAMPLE.placa, SAMPLE.dtc, 'Alta']] },
  { key: 'reparaciones', name: 'Órdenes de Trabajo y Bitácora de Taller', route: '/reparaciones', actorName: 'Mecánico', archetype: 'B', primaryAction: 'Registrar actividad',
    description: 'Bitácora de la orden: actividades, mecánicos, repuestos y pruebas.',
    fields: ['Orden', 'Actividad', 'Repuesto', 'Cantidad', 'Resultado de prueba'],
    tableHeaders: ['Orden', 'Placa', 'Mecánico', 'Estado'],
    sampleRows: [[SAMPLE.orden, SAMPLE.placa, 'Luis Mora', 'En bahía']] },
  { key: 'conocimiento', name: 'Base de Conocimiento Técnico OBD', route: '/conocimiento', actorName: 'Mecánico', archetype: 'C', primaryAction: 'Buscar',
    description: 'Búsqueda de códigos OBD, causas y soluciones comprobadas.',
    fields: ['Código OBD', 'Síntoma'] },
  { key: 'reportes', name: 'Tablero de Control, Indicadores y Reportes', route: '/reportes', actorName: 'Administrador', archetype: 'C', primaryAction: 'Filtrar período',
    description: 'Indicadores de órdenes, ingresos y servicios más demandados.',
    tableHeaders: ['Indicador', 'Valor', 'Período'] },
  { key: 'usuarios', name: 'Gestión de Usuarios, Roles y Auditoría', route: '/usuarios', actorName: 'Administrador', archetype: 'B', primaryAction: 'Guardar usuario',
    description: 'Usuarios, roles (Cliente, Mecánico, Recepción, Administrador) y auditoría.',
    fields: ['Nombre', 'Correo', 'Contraseña', 'Rol'] },
  { key: 'inventario', name: 'Inventario de Repuestos y Alertas de Stock', route: '/inventario', actorName: 'Administrador', archetype: 'C', primaryAction: 'Registrar movimiento',
    description: 'Existencias, costos, movimientos y alertas de bajo stock.',
    fields: ['Repuesto', 'Cantidad', 'Tipo de movimiento'],
    tableHeaders: ['Código', 'Repuesto', 'Stock', 'Alerta'],
    sampleRows: [['FIL-001', 'Filtro de aceite', '4', 'Bajo']] },
  { key: 'servicios', name: 'Catálogo Maestro de Servicios y Tarifas', route: '/servicios', actorName: 'Administrador', archetype: 'B', primaryAction: 'Guardar servicio',
    description: 'Servicios de mano de obra, tarifa y tiempo estimado.',
    fields: ['Servicio', 'Tarifa', 'Duración estimada'] },
  { key: 'compras', name: 'Proveedores y Órdenes de Compra', route: '/compras', actorName: 'Administrador', archetype: 'B', primaryAction: 'Registrar compra',
    description: 'Proveedores y compras de insumos para bodega.',
    fields: ['Proveedor', 'Insumo', 'Cantidad', 'Costo'] },
  { key: 'ventas', name: 'Venta Directa de Repuestos en Mostrador', route: '/ventas', actorName: 'Administrador', archetype: 'B', primaryAction: 'Cobrar venta',
    description: 'Venta de mostrador sin orden de trabajo.',
    fields: ['Cliente', 'Repuesto', 'Cantidad', 'Precio'] }
];

function findCatalogEntry(screen = {}) {
  const name = token(screen.name || screen.title);
  const route = String(screen.route || '').replace(/\/+$/, '') || '';
  return SCREEN_CATALOG.find(entry => {
    if (route && entry.route === route) return true;
    const entryName = token(entry.name);
    return name && (name === entryName || name.includes(token(entry.key)) || entryName.includes(name));
  }) || null;
}

function navForActor(actorName, currentRoute) {
  return SCREEN_CATALOG
    .filter(entry => entry.actorName === actorName && entry.route !== currentRoute && entry.key !== 'login')
    .map(entry => entry.name.replace(/^Portal Cliente:\s*/i, '').replace(/\s*[-–]\s*Autron5\s*$/i, ''));
}

function resolveActors(node, project, catalog) {
  const fromNode = (project.actors || []).filter(actor => (node.actorIds || []).includes(actor.id)).map(actor => actor.name);
  if (fromNode.length) return fromNode;
  if (!catalog?.actorName || catalog.actorName === 'Público') return [];
  const wanted = token(catalog.actorName);
  const hit = (project.actors || []).find(actor => {
    const name = token(actor.name);
    return name === wanted || name.includes(wanted) || wanted.includes(name);
  });
  return hit ? [hit.name] : [catalog.actorName];
}

module.exports = { SAMPLE, SCREEN_CATALOG, findCatalogEntry, navForActor, resolveActors, token };
