/**
 * Catálogo y mapeo semántico de pantallas para generación de prototipos/mockups.
 * Consolida los requerimientos funcionales aprobados en pantallas operativas y coherentes,
 * evitando fragmentación o duplicados.
 */

export const SCREEN_CATEGORIES = [
  { id: 'workshop', label: 'Operación del Taller Core', icon: 'build_circle', color: '#2563eb' },
  { id: 'inventory', label: 'Almacén y Catálogos', icon: 'inventory_2', color: '#059669' },
  { id: 'crm', label: 'Clientes, Citas y Soporte', icon: 'people', color: '#d97706' },
  { id: 'admin', label: 'Analítica y Administración', icon: 'analytics', color: '#7c3aed' }
];

export const SCREEN_CATALOG = [
  {
    key: 'recepcion',
    name: 'Recepción e Inspección de Vehículos',
    route: '/recepcion',
    category: 'workshop',
    categoryName: 'Operación del Taller Core',
    icon: 'directions_car',
    isCore: true,
    description: 'Registro de ingreso del vehículo, kilometraje, nivel de combustible e inspección visual de carrocería con evidencias fotográficas.',
    match: /recepcion|combustible|motivo de ingreso|zonas del vehiculo/i
  },
  {
    key: 'diagnosticos',
    name: 'Diagnóstico Técnico y Averías OBD',
    route: '/diagnosticos',
    category: 'workshop',
    categoryName: 'Operación del Taller Core',
    icon: 'build',
    isCore: true,
    description: 'Diagnósticos técnicos periciales, lectura de códigos de avería OBD DTC, matriz de criticidad y notas técnicas.',
    match: /diagnostico|obd|averia|dtc|fallas|trazabilidad.*diagnostico|fotografias y observaciones al diagnostico/i
  },
  {
    key: 'cotizaciones',
    name: 'Cotizaciones y Aprobación',
    route: '/cotizaciones',
    category: 'workshop',
    categoryName: 'Operación del Taller Core',
    icon: 'request_quote',
    isCore: true,
    description: 'Presupuesto detallado con repuestos, mano de obra, cálculo de IVA y flujo de aprobación total o parcial por el cliente.',
    match: /cotizacion|items autorizados|costo adicional|aprobar.*cotizacion|autorizacion del cliente/i
  },
  {
    key: 'reparaciones',
    name: 'Órdenes de Trabajo y Taller',
    route: '/reparaciones',
    category: 'workshop',
    categoryName: 'Operación del Taller Core',
    icon: 'engineering',
    isCore: true,
    description: 'Asignación de mecánicos, bitácora de reparación, consumo de repuestos de bodega y control de progreso porcentual.',
    match: /orden.*trabajo|reparacion|mecanico|progreso.*reparacion|avance.*reparacion|actividades.*repuestos/i
  },
  {
    key: 'vehiculos',
    name: 'Expediente Digital de Vehículos',
    route: '/vehiculos',
    category: 'workshop',
    categoryName: 'Operación del Taller Core',
    icon: 'folder_shared',
    isCore: true,
    description: 'Ficha técnica y hoja de vida con historial cronológico de servicios, mantenimientos, diagnósticos y repuestos.',
    match: /expediente digital|historial de reparaciones|asociar.*vehiculo.*cliente|vehiculos por cliente/i
  },
  {
    key: 'inventario',
    name: 'Inventario y Repuestos',
    route: '/inventario',
    category: 'inventory',
    categoryName: 'Almacén y Catálogos',
    icon: 'inventory_2',
    isCore: false,
    description: 'Catálogo de repuestos e insumos, control de stock, movimientos de almacén y alertas automáticas de bajo stock.',
    match: /inventario|stock|repuestos con codigo|entradas, salidas|alertas de bajo stock/i
  },
  {
    key: 'servicios',
    name: 'Catálogo de Servicios y Tarifas',
    route: '/servicios',
    category: 'inventory',
    categoryName: 'Almacén y Catálogos',
    icon: 'list_alt',
    isCore: false,
    description: 'Tarifario de servicios estándar del taller con duración estimada y precio de mano de obra.',
    match: /catalogo de servicios|precio de mano de obra/i
  },
  {
    key: 'compras',
    name: 'Proveedores y Compras',
    route: '/compras',
    category: 'inventory',
    categoryName: 'Almacén y Catálogos',
    icon: 'local_shipping',
    isCore: false,
    description: 'Gestión de proveedores de repuestos y registro de órdenes de compras para reabastecimiento.',
    match: /proveedores|compras basicas/i
  },
  {
    key: 'ventas',
    name: 'Venta Directa de Repuestos',
    route: '/ventas',
    category: 'inventory',
    categoryName: 'Almacén y Catálogos',
    icon: 'point_of_sale',
    isCore: false,
    description: 'Punto de venta directo en mostrador para comercialización de repuestos sin requerir orden de reparación.',
    match: /ventas directas/i
  },
  {
    key: 'citas',
    name: 'Agenda y Reserva de Citas',
    route: '/citas',
    category: 'crm',
    categoryName: 'Clientes, Citas y Soporte',
    icon: 'event',
    isCore: false,
    description: 'Calendario de citas para solicitud, consulta, reprogramación o cancelación según disponibilidad de bahías.',
    match: /citas|agendar|disponibilidad/i
  },
  {
    key: 'clientes',
    name: 'Directorio de Clientes',
    route: '/clientes',
    category: 'crm',
    categoryName: 'Clientes, Citas y Soporte',
    icon: 'people',
    isCore: false,
    description: 'Administración de la información de contacto y perfiles de los clientes del taller.',
    match: /informacion de los clientes|actualizar.*clientes/i
  },
  {
    key: 'mantenimiento',
    name: 'Mantenimientos Preventivos',
    route: '/mantenimiento',
    category: 'crm',
    categoryName: 'Clientes, Citas y Soporte',
    icon: 'alarm',
    isCore: false,
    description: 'Configuración de planes preventivos por kilometraje o tiempo, y alertas de mantenimientos próximos.',
    match: /mantenimientos preventivos|avisos de mantenimientos/i
  },
  {
    key: 'conocimiento',
    name: 'Base de Conocimiento OBD',
    route: '/conocimiento',
    category: 'crm',
    categoryName: 'Clientes, Citas y Soporte',
    icon: 'menu_book',
    isCore: false,
    description: 'Repositorio de síntomas, causas, soluciones comprobadas y buscador técnico para mecánicos.',
    match: /base de conocimiento|casos resueltos/i
  },
  {
    key: 'reportes',
    name: 'Tablero de Control y Reportes',
    route: '/reportes',
    category: 'admin',
    categoryName: 'Analítica y Administración',
    icon: 'analytics',
    isCore: false,
    description: 'Métricas gerenciales de facturación, órdenes activas, inventario crítico e indicadores filtrables.',
    match: /reportes|indicadores|dashboard|tablero de control/i
  },
  {
    key: 'usuarios',
    name: 'Usuarios, Roles y Auditoría',
    route: '/usuarios',
    category: 'admin',
    categoryName: 'Analítica y Administración',
    icon: 'admin_panel_settings',
    isCore: false,
    description: 'Gestión de cuentas de usuarios, roles de acceso, registro de auditoría y notificaciones internas.',
    match: /roles y permisos|autenticar|auditoria|notificaciones internas/i
  }
];

export function screenOptions(project) {
  const functionalReqs = (project.requirements || []).filter(r => r.status === 'APPROVED' && r.type === 'FUNCTIONAL');
  const matchedReqIds = new Set();
  const existingNodes = project.navigationNodes || [];

  const screens = SCREEN_CATALOG.map(def => {
    const matched = functionalReqs.filter(r => {
      const text = ((r.description || r.name || '') + ' ' + (r.code || '')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return def.match.test(text);
    });

    matched.forEach(r => matchedReqIds.add(r.id));
    const existingNode = existingNodes.find(n => n.route === def.route || n.name === def.name);

    // Si el nodo existe pero tenía pocos requirementIds, unimos los requerimientos descubiertos
    const combinedReqIds = Array.from(new Set([
      ...(existingNode?.requirementIds || []),
      ...matched.map(r => r.id)
    ]));

    const functionalities = combinedReqIds
      .map(id => functionalReqs.find(r => r.id === id))
      .filter(Boolean)
      .map(r => ({ id: r.id, code: r.code, text: r.description || r.name }));

    return {
      id: existingNode?.id || ('proposal-' + def.key),
      name: existingNode?.name || def.name,
      route: existingNode?.route || def.route,
      platform: 'WEB',
      category: def.category,
      categoryName: def.categoryName,
      icon: def.icon,
      isCore: def.isCore,
      description: def.description,
      proposed: !existingNode,
      requirementIds: combinedReqIds.length ? combinedReqIds : (functionalReqs[0] ? [functionalReqs[0].id] : []),
      functionalities
    };
  });

  // Requerimientos restantes (si los hubiera) se asignan a la pantalla de usuarios/administración para evitar pantallas huérfanas
  const unmatched = functionalReqs.filter(r => !matchedReqIds.has(r.id));
  if (unmatched.length > 0 && screens.length > 0) {
    const adminScreen = screens.find(s => s.route === '/usuarios') || screens[screens.length - 1];
    unmatched.forEach(r => {
      if (!adminScreen.requirementIds.includes(r.id)) {
        adminScreen.requirementIds.push(r.id);
        adminScreen.functionalities.push({ id: r.id, code: r.code, text: r.description || r.name });
      }
    });
  }

  return screens;
}
