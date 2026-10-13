/**
 * Catálogo y mapeo semántico de pantallas para generación de prototipos/mockups.
 * Organiza las pantallas por ACTORES y proporciona una pantalla independiente de Login.
 */

export function getScreenCategories(project) {
  const actors = (project?.actors || []).filter(a => !a.isDeleted);
  const publicCategory = { id: 'public', label: 'Acceso y Login', icon: 'login', color: '#0284c7' };

  if (!actors.length) {
    return [
      publicCategory,
      { id: 'general', label: 'Operaciones del Sistema', icon: 'apps', color: '#2563eb' }
    ];
  }

  const palette = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#4b5563'];
  const actorCategories = actors.map((a, i) => {
    const key = (a.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    let icon = 'person';
    if (/admin|gerent/i.test(key)) icon = 'admin_panel_settings';
    else if (/recep|ingres/i.test(key)) icon = 'directions_car';
    else if (/mecanic|tecnic|operad/i.test(key)) icon = 'build';
    else if (/client|usuari|estudiant/i.test(key)) icon = 'person';

    return {
      id: a.id || key.replace(/[^a-z0-9]/g, '_'),
      actorId: a.id,
      label: a.name,
      icon,
      color: palette[i % palette.length]
    };
  });

  return [publicCategory, ...actorCategories];
}

export const SCREEN_CATEGORIES = [
  { id: 'public', label: 'Acceso y Login', icon: 'login', color: '#0284c7' },
  { id: 'recepcion', label: 'Recepción', icon: 'directions_car', color: '#2563eb' },
  { id: 'cliente', label: 'Cliente', icon: 'person', color: '#059669' },
  { id: 'mecanico', label: 'Mecánico', icon: 'build', color: '#d97706' },
  { id: 'admin', label: 'Administrador', icon: 'admin_panel_settings', color: '#7c3aed' }
];

export const SCREEN_CATALOG = [
  // --- ACCESO GLOBAL (SUELTO / PÚBLICO) ---
  {
    key: 'login',
    name: 'Inicio de Sesión y Acceso al Sistema',
    route: '/login',
    category: 'public',
    categoryName: 'Acceso y Login',
    actorName: 'Público / Todos los Usuarios',
    icon: 'login',
    isCore: true,
    description: 'Portal de autenticación transversal: ingreso mediante credenciales seguras, validación de roles y recuperación de acceso.',
    match: /autenticar|iniciar sesion|login|recuperar el acceso|recuperar contrasena|credencial|rf-01|rf-1\b/i
  },

  // --- ACTOR: RECEPCIÓN ---
  {
    key: 'recepcion',
    name: 'Recepción e Inspección de Vehículos',
    route: '/recepcion',
    category: 'recepcion',
    categoryName: 'Recepción',
    actorName: 'Recepción',
    icon: 'directions_car',
    isCore: true,
    description: 'Registro de ingreso de vehículos, kilometraje, combustible e inspección visual con evidencias fotográficas.',
    match: /recepcion|combustible|motivo de ingreso|zonas del vehiculo|rf-07|rf-7\b/i
  },
  {
    key: 'citas',
    name: 'Agenda y Gestión de Citas de Taller',
    route: '/citas',
    category: 'recepcion',
    categoryName: 'Recepción',
    actorName: 'Recepción',
    icon: 'event',
    isCore: true,
    description: 'Control de la agenda de citas del taller, disponibilidad de bahías y confirmación de turnos.',
    match: /citas.*disponibilidad|agenda|coordinar la agenda|disponibilidad de bahias/i
  },
  {
    key: 'clientes',
    name: 'Directorio y Fichas de Clientes',
    route: '/clientes',
    category: 'recepcion',
    categoryName: 'Recepción',
    actorName: 'Recepción',
    icon: 'people',
    isCore: false,
    description: 'Administración y actualización de perfiles de clientes, historial de visitas y datos de contacto.',
    match: /informacion de los clientes|actualizar.*clientes|directorio.*clientes|rf-03|rf-3\b/i
  },
  {
    key: 'vehiculos',
    name: 'Expediente Digital de Vehículos',
    route: '/vehiculos',
    category: 'recepcion',
    categoryName: 'Recepción',
    actorName: 'Recepción',
    icon: 'folder_shared',
    isCore: true,
    description: 'Hoja de vida digital del vehículo: datos técnicos, mantenimientos previos y trazabilidad histórica.',
    match: /expediente digital|historial de reparaciones|asociar.*vehiculo.*cliente|vehiculos por cliente|rf-04|rf-05/i
  },

  // --- ACTOR: CLIENTE (PORTAL DEL CLIENTE) ---
  {
    key: 'citas_cliente',
    name: 'Portal Cliente: Solicitud de Citas',
    route: '/citas-cliente',
    category: 'cliente',
    categoryName: 'Cliente',
    actorName: 'Cliente',
    icon: 'calendar_month',
    isCore: true,
    description: 'Interfaz de autogestión para que el cliente solicite, consulte, reprograme o cancele citas según disponibilidad.',
    match: /permitir al cliente solicitar.*citas|citas segun disponibilidad|solicitar, consultar, reprogramar|rf-06|rf-6\b/i
  },
  {
    key: 'vehiculos_cliente',
    name: 'Portal Cliente: Mis Vehículos',
    route: '/mis-vehiculos',
    category: 'cliente',
    categoryName: 'Cliente',
    actorName: 'Cliente',
    icon: 'car_repair',
    isCore: false,
    description: 'Consulta de vehículos registrados por el cliente, alertas de mantenimientos próximos e historial de servicios.',
    match: /avisos de mantenimientos proximos|mis vehiculos/i
  },
  {
    key: 'cotizaciones_cliente',
    name: 'Portal Cliente: Aprobación de Presupuestos',
    route: '/cotizaciones-cliente',
    category: 'cliente',
    categoryName: 'Cliente',
    actorName: 'Cliente',
    icon: 'check_circle',
    isCore: true,
    description: 'Visualización detallada de cotizaciones con repuestos y mano de obra, permitiendo aprobar, aprobar parcialmente o rechazar.',
    match: /permitir al cliente aprobar.*cotizacion|aprobar, aprobar parcialmente|decision sobre una cotizacion|rf-15/i
  },
  {
    key: 'progreso_reparacion',
    name: 'Portal Cliente: Seguimiento de Avance',
    route: '/progreso-reparacion',
    category: 'cliente',
    categoryName: 'Cliente',
    actorName: 'Cliente',
    icon: 'trending_up',
    isCore: true,
    description: 'Monitoreo en tiempo real del estado y avance porcentual de la orden de reparación del vehículo.',
    match: /consultar el progreso de la reparacion|avance.*reparacion|rf-20/i
  },

  // --- ACTOR: MECÁNICO ---
  {
    key: 'diagnosticos',
    name: 'Diagnóstico Técnico y Averías OBD',
    route: '/diagnosticos',
    category: 'mecanico',
    categoryName: 'Mecánico',
    actorName: 'Mecánico',
    icon: 'build',
    isCore: true,
    description: 'Registro de diagnóstico por vehículo, códigos de falla OBD DTC, severidad y fotografías/evidencias adjuntas.',
    match: /diagnostico|obd|averia|dtc|fallas|trazabilidad.*diagnostico|fotografias y observaciones al diagnostico|rf-08|rf-09|rf-11|rf-12/i
  },
  {
    key: 'reparaciones',
    name: 'Órdenes de Trabajo y Bitácora de Taller',
    route: '/reparaciones',
    category: 'mecanico',
    categoryName: 'Mecánico',
    actorName: 'Mecánico',
    icon: 'engineering',
    isCore: true,
    description: 'Bitácora técnica de reparación: registro de actividades, asignación de mecánicos, repuestos consumidos y pruebas.',
    match: /orden.*trabajo|reparacion|mecanico|actividades, repuestos utilizados|asignar.*mecanicos|rf-17|rf-18|rf-19/i
  },
  {
    key: 'conocimiento',
    name: 'Base de Conocimiento Técnico OBD',
    route: '/conocimiento',
    category: 'mecanico',
    categoryName: 'Mecánico',
    actorName: 'Mecánico',
    icon: 'menu_book',
    isCore: false,
    description: 'Buscador pericial de códigos OBD, síntomas, causas documentadas y soluciones técnicas comprobadas.',
    match: /base de conocimiento|casos resueltos|busquedas en la base de conocimiento|rf-30|rf-31/i
  },

  // --- ACTOR: ADMINISTRADOR ---
  {
    key: 'reportes',
    name: 'Tablero de Control, Indicadores y Reportes',
    route: '/reportes',
    category: 'admin',
    categoryName: 'Administrador',
    actorName: 'Administrador',
    icon: 'analytics',
    isCore: false,
    description: 'Dashboard gerencial: indicadores de órdenes, ingresos, servicios más demandados y reportes filtrables por período.',
    match: /reportes|indicadores|dashboard|tablero de control|reportes filtrables|rf-32|rf-33/i
  },
  {
    key: 'usuarios',
    name: 'Gestión de Usuarios, Roles y Auditoría',
    route: '/usuarios',
    category: 'admin',
    categoryName: 'Administrador',
    actorName: 'Administrador',
    icon: 'admin_panel_settings',
    isCore: false,
    description: 'Administración de perfiles y permisos por rol (Cliente, Mecánico, Recepción, Administrador) y bitácora de auditoría.',
    match: /roles y permisos|auditoria|operaciones criticas para auditoria|notificaciones internas|rf-02|rf-34/i
  },
  {
    key: 'inventario',
    name: 'Inventario de Repuestos y Alertas de Stock',
    route: '/inventario',
    category: 'admin',
    categoryName: 'Administrador',
    actorName: 'Administrador',
    icon: 'inventory_2',
    isCore: false,
    description: 'Catálogo de repuestos, costos, precios, control de existencias, movimientos de almacén y alertas de bajo stock.',
    match: /inventario|stock|repuestos con codigo|entradas, salidas|alertas de bajo stock|descontar automaticamente.*inventario|rf-21|rf-22|rf-23|rf-24/i
  },
  {
    key: 'servicios',
    name: 'Catálogo Maestro de Servicios y Tarifas',
    route: '/servicios',
    category: 'admin',
    categoryName: 'Administrador',
    actorName: 'Administrador',
    icon: 'list_alt',
    isCore: false,
    description: 'Catálogo oficial de servicios de mano de obra con tarifas horarias y tiempos estándar de intervención.',
    match: /catalogo de servicios|precio de mano de obra|duracion estimada|rf-13/i
  },
  {
    key: 'compras',
    name: 'Proveedores y Órdenes de Compra',
    route: '/compras',
    category: 'admin',
    categoryName: 'Administrador',
    actorName: 'Administrador',
    icon: 'local_shipping',
    isCore: false,
    description: 'Directorio de proveedores y registro de compras de insumos para reabastecimiento de bodega.',
    match: /proveedores|compras basicas|rf-26/i
  },
  {
    key: 'ventas',
    name: 'Venta Directa de Repuestos en Mostrador',
    route: '/ventas',
    category: 'admin',
    categoryName: 'Administrador',
    actorName: 'Administrador',
    icon: 'point_of_sale',
    isCore: false,
    description: 'Facturación directa de repuestos en mostrador sin requerir la apertura de una orden de trabajo.',
    match: /ventas directas|repuestos sin necesidad de una orden|rf-25/i
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

    // Unir requerimientos descubiertos
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
      category: (() => {
        if (def.category === 'public') return 'public';
        const projectActors = (project.actors || []).filter(a => !a.isDeleted);
        const matchingActor = projectActors.find(a => 
          (a.id && def.category === a.id) ||
          (a.name && (def.categoryName || '').toLowerCase().includes(a.name.toLowerCase())) ||
          (a.name && (def.actorName || '').toLowerCase().includes(a.name.toLowerCase()))
        );
        return matchingActor?.id || def.category;
      })(),
      categoryName: def.categoryName,
      actorName: def.actorName,
      icon: def.icon,
      isCore: def.isCore,
      description: def.description,
      proposed: !existingNode,
      requirementIds: combinedReqIds.length ? combinedReqIds : (functionalReqs[0] ? [functionalReqs[0].id] : []),
      functionalities
    };
  });

  // Requerimientos restantes se asignan al panel administrativo para evitar requerimientos huérfanos
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
