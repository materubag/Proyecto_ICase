const token = (value = '') => String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');

const SAMPLE = {
  cliente: 'Ana Pérez',
  placa: 'ABC-123',
  orden: 'ORD-001',
  cita: 'CIT-014',
  dtc: 'P0301'
};

const SCREEN_CATALOG = [
  // --- DOMINIO TIENDA / PUNTO DE VENTA ---
  { key: 'vendedores', name: 'Gestión de Cuentas de Vendedores', route: '/vendedores', actorName: 'Administrador', archetype: 'B', primaryAction: 'Crear vendedor',
    description: 'Creación y administración de cuentas de vendedores con nombre, usuario único y contraseña con rol Vendedor.',
    fields: ['Nombre completo', 'Nombre de usuario', 'Contraseña inicial'],
    tableHeaders: ['ID', 'Nombre', 'Usuario', 'Rol', 'Estado'],
    sampleRows: [['VEN-01', 'Carlos Gómez', 'cgomez', 'Vendedor', 'Activo'], ['VEN-02', 'Laura Torres', 'ltorres', 'Vendedor', 'Activo']] },
  { key: 'productos', name: 'Registro y Gestión de Inventario', route: '/productos', actorName: 'Administrador', archetype: 'C', primaryAction: 'Registrar producto',
    description: 'Alta de productos en inventario con código único, nombre, precio unitario de venta y cantidad inicial en stock.',
    fields: ['Código de producto', 'Nombre del producto', 'Precio unitario ($)', 'Stock inicial'],
    tableHeaders: ['Código', 'Producto', 'Precio Unitario', 'Stock', 'Estado'],
    sampleRows: [['PROD-001', 'Arroz Extra 1kg', '$1.80', '50', 'Disponible'], ['PROD-002', 'Aceite Vegetal 900ml', '$3.20', '35', 'Disponible'], ['PROD-003', 'Leche Entera 1L', '$1.50', '40', 'Disponible']] },
  { key: 'catalogo', name: 'Catálogo de Productos para Venta', route: '/catalogo', actorName: 'Vendedor', archetype: 'C', primaryAction: 'Añadir al carrito',
    description: 'Visualización de productos con existencias en tiempo real y precios para seleccionar y agregar al borrador de factura.',
    tableHeaders: ['Código', 'Producto', 'Precio Unitario', 'Existencias', 'Acción'],
    sampleRows: [['PROD-001', 'Arroz Extra 1kg', '$1.80', '50', 'Agregar al carrito'], ['PROD-002', 'Aceite Vegetal 900ml', '$3.20', '35', 'Agregar al carrito']] },
  { key: 'facturacion', name: 'Punto de Venta y Facturación', route: '/facturacion', actorName: 'Vendedor', archetype: 'B', primaryAction: 'Facturar y Descontar Stock',
    description: 'Mostrador de facturación interactivo: cálculo de líneas, subtotal, total general y emisión con descuento atómico de stock.',
    fields: ['Producto', 'Cantidad', 'Precio unitario'],
    tableHeaders: ['Ítem', 'Producto', 'Cantidad', 'P. Unitario', 'Subtotal'],
    sampleRows: [['1', 'Arroz Extra 1kg', '2', '$1.80', '$3.60'], ['2', 'Aceite Vegetal 900ml', '1', '$3.20', '$3.20']] },
  { key: 'ventas', name: 'Historial y Consulta de Ventas', route: '/ventas', actorName: 'Administrador', archetype: 'C', primaryAction: 'Ver Detalle',
    description: 'Consulta cronológica de ventas: número de factura, fecha, vendedor responsable, detalle de productos y monto total.',
    tableHeaders: ['Nº Factura', 'Fecha / Hora', 'Vendedor', 'Productos', 'Total ($)'],
    sampleRows: [['FAC-0001', '2026-11-21 14:30', 'Carlos Gómez', 'Arroz (2), Aceite (1)', '$6.80'], ['FAC-0002', '2026-11-21 15:10', 'Carlos Gómez', 'Leche Entera (3)', '$4.50']] },

  // --- DOMINIO PRÉSTAMO DE HERRAMIENTAS DEL TALLER ---
  { key: 'herramientas', name: 'Catálogo de Herramientas', route: '/herramientas', actorName: 'Encargado', archetype: 'C', primaryAction: 'Registrar herramienta',
    description: 'Catálogo de herramientas con existencias en tiempo real y registro de nuevas unidades (RF-01, RF-02).',
    fields: ['Nombre de herramienta', 'Categoría', 'Cantidad disponible'],
    tableHeaders: ['ID', 'Herramienta', 'Categoría', 'Cantidad Disponible', 'Estado'],
    sampleRows: [['HER-01', 'Taladro Percutor 1/2', 'Eléctrica', '5', 'Disponible'], ['HER-02', 'Juego Llaves Bristol', 'Manual', '8', 'Disponible'], ['HER-03', 'Multímetro Digital', 'Medición', '3', 'Disponible']] },
  { key: 'solicitar', name: 'Solicitud de Préstamo', route: '/solicitar', actorName: 'Estudiante', archetype: 'B', primaryAction: 'Confirmar Solicitud',
    description: 'Formulario de solicitud de préstamo de 1 unidad de herramienta por plazo de 1 a 3 días (RF-03, RN-01).',
    fields: ['Herramienta', 'Plazo en días (1, 2 o 3 días)', 'Observaciones'],
    tableHeaders: ['Herramienta', 'Plazo Solicitado', 'Disponibilidad Actual'],
    sampleRows: [['Taladro Percutor 1/2', '2 días', '5 disponibles']] },
  { key: 'solicitudes', name: 'Bandeja de Solicitudes', route: '/solicitudes', actorName: 'Encargado', archetype: 'C', primaryAction: 'Aprobar Solicitud',
    description: 'Bandeja para que el Encargado resuelva (apruebe o rechace) solicitudes de préstamo pendientes (RF-04).',
    tableHeaders: ['Solicitud', 'Estudiante', 'Herramienta', 'Plazo', 'Estado', 'Acción'],
    sampleRows: [['SOL-001', 'Juan Pérez', 'Taladro Percutor 1/2', '2 días', 'Pendiente', 'Aprobar / Rechazar'], ['SOL-002', 'María López', 'Multímetro Digital', '1 día', 'Pendiente', 'Aprobar / Rechazar']] },
  { key: 'entregas', name: 'Entregas y Devoluciones', route: '/entregas', actorName: 'Encargado', archetype: 'B', primaryAction: 'Confirmar Entrega',
    description: 'Control físico de entrega (descuento de stock) y devolución (reposición de stock) de herramientas (RF-05, RF-06, RN-04, RN-05).',
    fields: ['Préstamo', 'Fecha / Hora de Entrega', 'Fecha límite calculada'],
    tableHeaders: ['Préstamo', 'Estudiante', 'Herramienta', 'Fecha Entrega', 'Límite Devolución', 'Acción'],
    sampleRows: [['PRE-101', 'Juan Pérez', 'Taladro Percutor', '2026-11-24 10:00', '2026-11-26 10:00', 'Registrar Devolución']] },
  { key: 'mis_solicitudes', name: 'Mis Solicitudes', route: '/mis-solicitudes', actorName: 'Estudiante', archetype: 'C', primaryAction: 'Ver Estado',
    description: 'Consulta de solicitudes propias del estudiante con estados: Pendiente, Aprobada, Entregada, Devuelta o Vencida (RF-07).',
    tableHeaders: ['ID', 'Herramienta', 'Plazo', 'Fecha Solicitud', 'Estado', 'Límite'],
    sampleRows: [['SOL-001', 'Taladro Percutor', '2 días', '2026-11-24 09:30', 'Aprobada', 'Pendiente entrega'], ['SOL-002', 'Multímetro Digital', '1 día', '2026-11-22 14:00', 'Devuelta', 'Completado']] },
  { key: 'vencidos', name: 'Préstamos Vencidos', route: '/vencidos', actorName: 'Encargado', archetype: 'C', primaryAction: 'Recepcionar Devolución',
    description: 'Monitoreo de préstamos que superaron la fecha y hora límite sin registrar devolución (RF-08, RN-03, RN-04).',
    tableHeaders: ['Préstamo', 'Estudiante', 'Herramienta', 'Fecha Entrega', 'Límite Expirado', 'Tiempo Mora'],
    sampleRows: [['PRE-098', 'Pedro Ramírez', 'Amoladora Angular', '2026-11-21 08:00', '2026-11-22 08:00', '2 días vencido']] },

  // --- ACCESO GLOBAL (SUELTO / PÚBLICO) ---
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
