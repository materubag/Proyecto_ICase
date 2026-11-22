'use strict';

const fs = require('node:fs');
const path = require('node:path');

const STORE_DIR = path.join(__dirname, 'customizations');

const SCREEN_CATALOG = [
  {
    key: 'facturacion',
    label: 'Punto de Venta y Facturación',
    icon: 'point_of_sale',
    endpoint: '/facturacion',
    aliases: ['facturacion', 'punto de venta', 'punto de venta y facturacion', 'facturacion y cobro', 'caja', 'pos', 'cobro en caja', 'emitir factura']
  },
  {
    key: 'catalogo',
    label: 'Catálogo de Productos',
    icon: 'storefront',
    endpoint: '/catalogo',
    aliases: ['catalogo', 'catalogo de productos', 'catalogo de productos para venta', 'catalogo general', 'catalogo general de productos', 'ver catalogo', 'productos para venta']
  },
  {
    key: 'productos',
    label: 'Gestión de Inventario',
    icon: 'inventory_2',
    endpoint: '/productos',
    aliases: ['registro y gestion de inventario', 'gestion de inventario', 'inventario de productos', 'control de inventario', 'registro y actualizacion de productos', 'actualizacion de productos', 'inventario']
  },
  {
    key: 'vendedores',
    label: 'Gestión de Cuentas de Vendedores',
    icon: 'badge',
    endpoint: '/vendedores',
    aliases: ['vendedores', 'cuentas de vendedores', 'gestion de cuentas de vendedores', 'registro de vendedores', 'usuarios vendedores', 'vendedor']
  },
  {
    key: 'ventas',
    label: 'Historial y Consulta de Ventas',
    icon: 'receipt_long',
    endpoint: '/ventas',
    aliases: ['historial y consulta de ventas', 'consulta de ventas', 'historial de ventas', 'ventas registradas', 'reporte de ventas', 'ventas']
  },
  {
    key: 'reportes',
    label: 'Dashboard',
    icon: 'analytics',
    endpoint: '/ordenes-trabajo',
    aliases: ['dashboard', 'tablero', 'panel operativo', 'reportes', 'tablero e indicadores', 'tablero de control', 'tablero de control e indicadores operativos', 'panel de control', 'inicio']
  },
  {
    key: 'inventario',
    label: 'Repuestos',
    icon: 'inventory_2',
    endpoint: '/productos',
    aliases: ['repuestos', 'inventario', 'inventario de repuestos', 'inventario de repuestos y alertas de stock', 'inventario y repuestos', 'stock', 'productos', 'consulta de repuestos']
  },
  {
    key: 'compras',
    label: 'Proveedores y Compras',
    icon: 'local_shipping',
    endpoint: '/compras',
    aliases: ['compras', 'proveedores', 'proveedores y compras', 'proveedores y ordenes de compra', 'ordenes de compra']
  },
  {
    key: 'clientes',
    label: 'Directorio de Clientes',
    icon: 'group',
    endpoint: '/clientes',
    aliases: ['clientes', 'directorio de clientes', 'directorio y fichas de clientes', 'fichas de clientes']
  },
  {
    key: 'servicios',
    label: 'Catálogo de Servicios',
    icon: 'design_services',
    endpoint: '/servicios',
    aliases: ['servicios', 'catalogo de servicios', 'catalogo maestro de servicios', 'catalogo maestro de servicios y tarifas', 'tarifas', 'tarifario', 'tarifario de servicios']
  },
  {
    key: 'mantenimiento',
    label: 'Mantenimiento',
    icon: 'event_repeat',
    endpoint: '/programacion-mantenimientos',
    aliases: ['mantenimiento', 'mantenimiento preventivo', 'programacion mantenimiento']
  },
  {
    key: 'conocimiento',
    label: 'Base de Conocimiento',
    icon: 'menu_book',
    endpoint: '/obd-codigos',
    aliases: ['base de conocimiento', 'base de conocimiento tecnico obd ii', 'base tecnica obd', 'conocimiento', 'conocimiento obd', 'base de datos obd', 'obd ii', 'obd']
  },
  {
    key: 'usuarios',
    label: 'Usuarios y Auditoría',
    icon: 'manage_accounts',
    endpoint: '/usuarios',
    aliases: ['usuarios', 'usuarios y auditoria', 'gestion de usuarios roles y auditoria', 'gestion de usuarios', 'auditoria']
  },
  {
    key: 'seguridadRolesPermisos',
    label: 'Roles y Permisos',
    icon: 'security',
    endpoint: '/roles',
    aliases: ['roles y permisos', 'permisos', 'roles', 'seguridad', 'matriz de permisos', 'seguridad roles permisos']
  },
  {
    key: 'notificaciones',
    label: 'Notificaciones',
    icon: 'notifications',
    endpoint: '/notificaciones',
    aliases: ['notificaciones', 'mis notificaciones', 'avisos', 'mis avisos', 'alertas']
  },
  {
    key: 'recepcion',
    label: 'Recepción',
    icon: 'fact_check',
    endpoint: '/recepciones',
    aliases: ['recepcion', 'recepcion e inspeccion', 'recepcion e inspeccion de vehiculos', 'inspeccion', 'recepcion de vehiculos', 'ingreso vehicular']
  },
  {
    key: 'citas',
    label: 'Agenda',
    icon: 'calendar_month',
    endpoint: '/citas',
    aliases: ['agenda', 'citas', 'agenda de citas', 'gestion de citas', 'agenda y gestion de citas']
  },
  {
    key: 'vehiculos',
    label: 'Expediente Vehicular',
    icon: 'directions_car',
    endpoint: '/vehiculos',
    aliases: ['vehiculos', 'expediente vehicular', 'expediente digital', 'expediente digital de vehiculos']
  },
  {
    key: 'ventas',
    label: 'Venta en Mostrador',
    icon: 'point_of_sale',
    endpoint: '/ventas',
    aliases: ['ventas', 'venta en mostrador', 'venta directa', 'venta directa de repuestos en mostrador', 'mostrador', 'venta de repuestos']
  },
  {
    key: 'diagnosticos',
    label: 'Diagnóstico',
    icon: 'troubleshoot',
    endpoint: '/diagnosticos',
    aliases: ['diagnostico', 'diagnosticos', 'diagnostico obd', 'diagnostico tecnico', 'diagnostico tecnico y averias obd ii', 'mapa 2d', 'averias']
  },
  {
    key: 'reparaciones',
    label: 'Órdenes de Trabajo',
    icon: 'handyman',
    endpoint: '/orden-trabajos',
    aliases: ['ordenes de trabajo', 'ordenes de trabajo y bitacora de taller', 'reparaciones', 'bitacora de taller', 'ordenes', 'taller']
  },
  {
    key: 'misVehiculos',
    label: 'Mis Vehículos',
    icon: 'garage',
    endpoint: '/vehiculos',
    aliases: ['mis vehiculos', 'portal cliente mis vehiculos y odometro', 'mis vehiculos y odometro', 'odometro', 'vehiculos del cliente']
  },
  {
    key: 'citasCliente',
    label: 'Agendar Citas',
    icon: 'event_available',
    endpoint: '/citas',
    aliases: ['agendar citas', 'agendar cita', 'portal cliente solicitud de citas', 'solicitud de citas', 'citas cliente', 'reservar cita']
  },
  {
    key: 'cotizacionesCliente',
    label: 'Cotización',
    icon: 'request_quote',
    endpoint: '/cotizaciones',
    aliases: ['cotizacion', 'cotizaciones', 'portal cliente aprobacion de presupuestos', 'aprobar presupuesto', 'aprobacion de presupuestos', 'presupuesto', 'presupuestos']
  },
  {
    key: 'progresoReparacion',
    label: 'Seguimiento',
    icon: 'timelapse',
    endpoint: '/orden-trabajos',
    aliases: ['seguimiento', 'portal cliente seguimiento de avance', 'seguimiento de avance', 'mi reparacion en vivo', 'progreso', 'avance', 'progreso reparacion']
  }
];

const DEFAULT_SCREENS_BY_ROLE = {
  Administrador: [
    { key: 'productos', label: 'Gestión de Inventario', icon: 'inventory_2', endpoint: '/productos' },
    { key: 'vendedores', label: 'Gestión de Cuentas de Vendedores', icon: 'badge', endpoint: '/vendedores' },
    { key: 'ventas', label: 'Historial y Consulta de Ventas', icon: 'receipt_long', endpoint: '/ventas' },
    { key: 'catalogo', label: 'Catálogo de Productos', icon: 'storefront', endpoint: '/catalogo' },
    { key: 'facturacion', label: 'Punto de Venta y Facturación', icon: 'point_of_sale', endpoint: '/facturacion' }
  ],
  Vendedor: [
    { key: 'catalogo', label: 'Catálogo de Productos', icon: 'storefront', endpoint: '/catalogo' },
    { key: 'facturacion', label: 'Punto de Venta y Facturación', icon: 'point_of_sale', endpoint: '/facturacion' },
    { key: 'ventas', label: 'Historial y Consulta de Ventas', icon: 'receipt_long', endpoint: '/ventas' }
  ],
  Recepción: [
    { key: 'recepcion', label: 'Recepción', icon: 'fact_check', endpoint: '/recepciones' },
    { key: 'citas', label: 'Agenda', icon: 'calendar_month', endpoint: '/citas' },
    { key: 'clientes', label: 'Directorio de Clientes', icon: 'group', endpoint: '/clientes' },
    { key: 'vehiculos', label: 'Expediente Vehicular', icon: 'directions_car', endpoint: '/vehiculos' },
    { key: 'ventas', label: 'Venta en Mostrador', icon: 'point_of_sale', endpoint: '/ventas' }
  ],
  Mecánico: [
    { key: 'diagnosticos', label: 'Diagnóstico', icon: 'troubleshoot', endpoint: '/diagnosticos' },
    { key: 'reparaciones', label: 'Órdenes de Trabajo', icon: 'handyman', endpoint: '/orden-trabajos' },
    { key: 'conocimiento', label: 'Base de Conocimiento', icon: 'menu_book', endpoint: '/obd-codigos' },
    { key: 'inventario', label: 'Repuestos', icon: 'inventory_2', endpoint: '/productos' },
    { key: 'vehiculos', label: 'Expediente Vehicular', icon: 'directions_car', endpoint: '/vehiculos' }
  ],
  Cliente: [
    { key: 'misVehiculos', label: 'Mis Vehículos', icon: 'garage', endpoint: '/vehiculos' },
    { key: 'citasCliente', label: 'Agendar Citas', icon: 'event_available', endpoint: '/citas' },
    { key: 'cotizacionesCliente', label: 'Cotización', icon: 'request_quote', endpoint: '/cotizaciones' },
    { key: 'progresoReparacion', label: 'Seguimiento', icon: 'timelapse', endpoint: '/orden-trabajos' }
  ]
};

function normalizeText(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchMockupToCatalogEntry(mockup) {
  const normTitle = normalizeText(mockup?.title || mockup?.name || '');
  const normKey = normalizeText(mockup?.key || '');
  if (!normTitle && !normKey) return null;

  for (const entry of SCREEN_CATALOG) {
    if (normalizeText(entry.key) === normKey || normalizeText(entry.label) === normTitle) {
      return entry;
    }
    if (entry.aliases.some(a => normTitle === a || normKey === a.replace(/\s+/g, ' '))) {
      return entry;
    }
  }
  for (const entry of SCREEN_CATALOG) {
    if (entry.aliases.some(a => a.length >= 6 && (normTitle.includes(a) || a.includes(normTitle)))) {
      return entry;
    }
  }
  return null;
}

function inferIconForScreenTitle(title) {
  const t = normalizeText(title);
  if (/dashboard|tablero|indicador|reporte/.test(t)) return 'analytics';
  if (/inventario|repuesto|producto|stock/.test(t)) return 'inventory_2';
  if (/compra|proveedor/.test(t)) return 'local_shipping';
  if (/cliente|directorio|paciente|estudiante|socio/.test(t)) return 'group';
  if (/servicio|catalogo|tarifa|curso/.test(t)) return 'design_services';
  if (/conocimiento|obd|manual|guia/.test(t)) return 'menu_book';
  if (/usuario|rol|auditoria|seguridad|permiso/.test(t)) return 'manage_accounts';
  if (/recepcion|inspeccion|ingreso/.test(t)) return 'fact_check';
  if (/cita|agenda|reserva|calendario/.test(t)) return 'calendar_month';
  if (/vehiculo|auto|flota|expediente/.test(t)) return 'directions_car';
  if (/venta|mostrador|factura|caja|pago/.test(t)) return 'point_of_sale';
  if (/diagnostico|averia|falla|evaluacion/.test(t)) return 'troubleshoot';
  if (/orden|reparacion|taller|bitacora|tarea/.test(t)) return 'handyman';
  if (/cotizacion|presupuesto|aprobacion/.test(t)) return 'request_quote';
  if (/seguimiento|progreso|avance|estado/.test(t)) return 'timelapse';
  if (/notificacion|aviso|alerta/.test(t)) return 'notifications';
  return 'space_dashboard';
}

function compactScreenLabel(rawTitle) {
  const cat = matchMockupToCatalogEntry({ title: rawTitle });
  if (cat) return cat.label;
  return String(rawTitle || 'Módulo')
    .replace(/^Portal\s+Cliente:\s*/i, '')
    .replace(/\s+y\s+Alertas.*$/i, '')
    .replace(/\s+e\s+Indicadores.*$/i, '')
    .trim();
}

function cloneDefaultScreens() {
  const out = {};
  for (const [role, list] of Object.entries(DEFAULT_SCREENS_BY_ROLE)) {
    out[role] = list.map(item => ({ ...item }));
  }
  return out;
}

function getStorePath(projectId) {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
  const safeId = String(projectId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(STORE_DIR, `${safeId}.json`);
}

function readRawStore(projectId) {
  if (!projectId) return {};
  const filePath = getStorePath(projectId);
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) || {};
  } catch {
    return {};
  }
}

function getProjectCustomizations(projectId) {
  const raw = readRawStore(projectId);
  const screensByRole = cloneDefaultScreens();
  if (raw && raw.screensByRole && typeof raw.screensByRole === 'object') {
    for (const [role, list] of Object.entries(raw.screensByRole)) {
      if (Array.isArray(list) && list.length > 0) {
        screensByRole[role] = list;
      }
    }
  }
  return {
    ...raw,
    screensByRole,
    screenOverrides: raw.screenOverrides || {}
  };
}

function saveProjectCustomizations(projectId, data) {
  if (!projectId) return;
  const existing = readRawStore(projectId);
  const filePath = getStorePath(projectId);
  const payload = {
    ...existing,
    ...data,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function getProjectEnvConfig(projectId, projectName = 'app') {
  const raw = readRawStore(projectId);
  if (raw && raw.envConfig && typeof raw.envConfig === 'object') {
    return raw.envConfig;
  }
  const safe = (projectName || 'app').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '_');
  return {
    backendPort: '8087',
    backendContainerPort: '8080',
    frontendPort: '3010',
    frontendContainerPort: '80',
    dbHostPort: '5438',
    dbContainerPort: '5432',
    dbName: `${safe}_db`,
    dbUser: 'postgres',
    networkName: `${safe}_network`
  };
}

function saveProjectEnvConfig(projectId, envConfig) {
  if (!projectId || !envConfig) return null;
  return saveProjectCustomizations(projectId, { envConfig });
}

function getProjectScreenOverrides(projectId) {
  const raw = readRawStore(projectId);
  return (raw && raw.screenOverrides && typeof raw.screenOverrides === 'object') ? raw.screenOverrides : {};
}

function saveProjectScreenOverride(projectId, screenKey, overrideData) {
  if (!projectId || !screenKey) return;
  const raw = readRawStore(projectId);
  const screenOverrides = { ...(raw.screenOverrides || {}) };
  screenOverrides[screenKey] = {
    ...overrideData,
    updatedAt: new Date().toISOString()
  };
  return saveProjectCustomizations(projectId, { screenOverrides });
}

/**
 * Construye dinámicamente el mapa de pantallas por rol para CUALQUIER proyecto en ICASE
 * a partir de sus actores (`spec.actors`) y sus mockups aprobados (`operationalMockups`),
 * aplicando encima cualquier personalización en vivo hecha por el usuario con "✏️ Cambiar".
 */
function getEffectiveScreensByRoleForSpec(projectId, spec = {}, operationalMockups = []) {
  const rawStore = readRawStore(projectId);
  const savedRoles = (rawStore && rawStore.screensByRole && typeof rawStore.screensByRole === 'object')
    ? rawStore.screensByRole
    : {};

  const actorNames = (Array.isArray(spec.actors) ? spec.actors : [])
    .map(a => (typeof a === 'string' ? a : a?.name))
    .filter(Boolean);

  const rolesList = actorNames.length > 0
    ? actorNames
    : Object.keys(DEFAULT_SCREENS_BY_ROLE);

  // Construir catálogo de pantallas desde los mockups reales del proyecto
  const projectScreens = operationalMockups.map(m => {
    const cat = matchMockupToCatalogEntry(m);
    return {
      key: m.key,
      aliasKey: cat ? cat.key : m.key,
      label: cat ? cat.label : compactScreenLabel(m.title),
      icon: cat ? cat.icon : inferIconForScreenTitle(m.title),
      compName: m.compName,
      roles: Array.isArray(m.roles) ? m.roles : [],
      endpoint: cat?.endpoint || (m.route ? (m.route.startsWith('/') ? m.route : `/${m.route}`) : `/${m.key}`)
    };
  });

  const result = {};

  for (const role of rolesList) {
    const normRole = normalizeText(role);

    // 1. Si el usuario personalizó explícitamente este rol en este proyecto, respetar su lista exacta
    const customForRole = savedRoles[role];
    if (Array.isArray(customForRole) && customForRole.length > 0) {
      result[role] = customForRole.map(item => {
        // Vincular con el mockup real del proyecto si coincide por key, aliasKey o label
        const matchedMockup = projectScreens.find(ps =>
          ps.key === item.key ||
          ps.aliasKey === item.key ||
          normalizeText(ps.label) === normalizeText(item.label)
        );
        const cat = SCREEN_CATALOG.find(c => c.key === item.key || normalizeText(c.label) === normalizeText(item.label));
        return {
          key: matchedMockup ? matchedMockup.key : item.key,
          aliasKey: item.key,
          label: item.label,
          icon: item.icon || matchedMockup?.icon || cat?.icon || 'space_dashboard',
          endpoint: item.endpoint || matchedMockup?.endpoint || cat?.endpoint || `/${item.key}`
        };
      });
      continue;
    }

    // 2. Si el proyecto tiene mockups asignados a este rol en spec.screens, usarlos directamente
    if (projectScreens.length > 0) {
      const assigned = projectScreens.filter(ps =>
        ps.roles.some(r => normalizeText(r) === normRole || normalizeText(r).includes(normRole) || normRole.includes(normalizeText(r)))
      );
      if (assigned.length > 0) {
        result[role] = assigned.map(ps => ({
          key: ps.key,
          aliasKey: ps.aliasKey,
          label: ps.label,
          icon: ps.icon,
          endpoint: ps.endpoint
        }));
        continue;
      }
      // Si es el rol Administrador y ningún mockup tenía el tag exacto, mostrar las pantallas administrativas o todas
      if (/admin/.test(normRole)) {
        result[role] = projectScreens.slice(0, 8).map(ps => ({
          key: ps.key,
          aliasKey: ps.aliasKey,
          label: ps.label,
          icon: ps.icon,
          endpoint: ps.endpoint
        }));
        continue;
      }
    }

    // 3. Fallback a DEFAULT_SCREENS_BY_ROLE o Dashboard general
    if (DEFAULT_SCREENS_BY_ROLE[role]) {
      result[role] = DEFAULT_SCREENS_BY_ROLE[role].map(item => {
        const matchedMockup = projectScreens.find(ps => ps.aliasKey === item.key || ps.key === item.key);
        return {
          key: matchedMockup ? matchedMockup.key : item.key,
          aliasKey: item.key,
          label: item.label,
          icon: item.icon,
          endpoint: item.endpoint
        };
      });
    } else {
      result[role] = projectScreens.length > 0
        ? projectScreens.slice(0, 5).map(ps => ({
            key: ps.key,
            aliasKey: ps.aliasKey,
            label: ps.label,
            icon: ps.icon,
            endpoint: ps.endpoint
          }))
        : [{ key: 'dashboard', label: 'Dashboard', icon: 'analytics', endpoint: '/health' }];
    }
  }

  return result;
}

function getEffectiveScreensByRole(projectId, spec = null, operationalMockups = []) {
  if (spec && (Array.isArray(spec.screens) || operationalMockups.length > 0)) {
    return getEffectiveScreensByRoleForSpec(projectId, spec, operationalMockups);
  }
  return getProjectCustomizations(projectId).screensByRole;
}

function detectTargetRole(text, customRoles = []) {
  const norm = normalizeText(text);
  for (const r of customRoles) {
    const nr = normalizeText(r);
    if (nr && norm.includes(nr)) return r;
  }
  if (/\b(administrador|admin)\b/.test(norm)) return 'Administrador';
  if (/\b(recepcion|recepcionista|asesor)\b/.test(norm)) return 'Recepción';
  if (/\b(mecanico|tecnico)\b/.test(norm)) return 'Mecánico';
  if (/\b(cliente|portal cliente)\b/.test(norm)) return 'Cliente';
  return null;
}

function resolveScreenToken(rawToken, targetRole) {
  const cleaned = String(rawToken || '')
    .replace(/^[\s•\-*0-9.)+:]+/, '')
    .replace(/[\s.]+$/, '')
    .trim();
  const norm = normalizeText(cleaned);
  if (!norm || norm.length < 2) return null;

  if (['las siguientes pantallas', 'siguientes pantallas', 'pantallas', 'pantalla', 'modulo', 'modulos', 'rol', 'en', 'el', 'la', 'los', 'las', 'solo', 'unicamente', 'tenga', 'quiero'].includes(norm)) {
    return null;
  }

  if (targetRole === 'Cliente') {
    if (norm === 'citas' || norm === 'agenda') {
      return { key: 'citasCliente', label: 'Agendar Citas', icon: 'event_available', endpoint: '/citas' };
    }
    if (norm === 'vehiculos') {
      return { key: 'misVehiculos', label: 'Mis Vehículos', icon: 'garage', endpoint: '/vehiculos' };
    }
  }

  for (const entry of SCREEN_CATALOG) {
    if (entry.aliases.includes(norm) || normalizeText(entry.key) === norm || normalizeText(entry.label) === norm) {
      return { key: entry.key, label: entry.label, icon: entry.icon, endpoint: entry.endpoint };
    }
  }

  for (const entry of SCREEN_CATALOG) {
    if (entry.aliases.some(a => a.length >= 4 && (norm.includes(a) || a.includes(norm)))) {
      return { key: entry.key, label: entry.label, icon: entry.icon, endpoint: entry.endpoint };
    }
  }

  // Si el texto es una oración o frase larga con verbos/instrucciones, NO es un nombre de pantalla
  if (
    norm.length > 30 ||
    norm.split(/\s+/).length > 4 ||
    /(solicitando|debe|permitir|navegar|portal|hasta|establecido|exitosamente|obligatorio|modal|formulario|inicie|sesion|recibida|recibido)/.test(norm)
  ) {
    return null;
  }

  const slug = norm.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const titleCase = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return {
    key: slug || 'modulo-extra',
    label: titleCase || 'Módulo Extra',
    icon: inferIconForScreenTitle(titleCase),
    endpoint: `/${slug || 'modulo-extra'}`
  };
}

function extractScreenListFromMessage(messageText, targetRole) {
  let body = String(messageText || '');
  body = body.replace(/^Quiero (cambiar|modificar)[^:]*:\s*/i, '');

  const colonIdx = body.lastIndexOf(':');
  let listText = colonIdx !== -1 ? body.slice(colonIdx + 1) : body;

  if (colonIdx === -1) {
    listText = listText
      .replace(/^.*?(?:pantallas?|pestanas?|modulos?|vistas?|tenga|deja\s+solo|deja|agrega|anade|añade|aumenta|incluye|quita|elimina|borra|remueve)\s+/i, '');
  }

  listText = listText.replace(/\s+(?:en|para|del|al)\s+(?:el\s+rol\s+|rol\s+)?(?:administrador|admin|recepci[oó]n|mec[aá]nico|cliente)\s*$/i, '');

  const rawParts = listText
    .split(/(?:,|;|\n|\s+y\s+|\s+e\s+)/i)
    .map(s => s.trim())
    .filter(Boolean);

  const resolved = [];
  const seen = new Set();
  for (const part of rawParts) {
    const item = resolveScreenToken(part, targetRole);
    if (item && !seen.has(item.key)) {
      seen.add(item.key);
      resolved.push(item);
    }
  }
  return resolved;
}

function applyChatCustomizationCommand(projectId, messageText, spec = null) {
  const cleanMsg = String(messageText || '').replace(/^Quiero (cambiar|modificar)[^:]*:\s*/i, '').trim();
  const norm = normalizeText(cleanMsg);

  // Comando para quitar / ocultar indicador de "Conectado a API REST · Sin datos estáticos"
  if (
    /(quita|elimina|borra|remueve|oculta|saca|desactiva|no mostrar|no quiero ver)/.test(norm) &&
    /(conectado|api rest|datos estaticos|sin datos|indicador|badge|estado de conexion|punto verde|texto de la cabecera|barra de estado)/.test(norm)
  ) {
    saveProjectCustomizations(projectId, { hideApiStatusBadge: true });
    return {
      matched: true,
      action: 'HIDE_API_BADGE',
      summary: 'Se ha eliminado el indicador de **"Conectado a API REST · Sin datos estáticos"** de la barra superior. La vista previa se actualizó automáticamente.',
      roleUpdated: null,
      screens: []
    };
  }

  // Comando para volver a mostrar el indicador de conexión
  if (
    /(muestra|mostrar|agrega|activa|pon|restaura|habilita)/.test(norm) &&
    /(conectado|api rest|datos estaticos|sin datos|indicador|badge|estado de conexion)/.test(norm)
  ) {
    saveProjectCustomizations(projectId, { hideApiStatusBadge: false });
    return {
      matched: true,
      action: 'SHOW_API_BADGE',
      summary: 'Se habilitó nuevamente el indicador de **"Conectado a API REST"** en la barra superior.',
      roleUpdated: null,
      screens: []
    };
  }

  if (/(restaura|restablece|por defecto|originales|como estaba|reset)/.test(norm) && /(pantalla|rol|menu|navegacion|todo|cliente)/.test(norm)) {
    saveProjectCustomizations(projectId, { screensByRole: {} });
    const fresh = cloneDefaultScreens();
    return {
      matched: true,
      action: 'RESET',
      summary: 'Se restauraron las pantallas originales del proyecto para todos los roles en `frontend/src/App.jsx` y en la Vista Previa Interactiva.',
      screensByRole: fresh
    };
  }

  // Si el usuario pide un modal de cambio de clave temporal
  if (
    /(clave|contrasena|password)/.test(norm) &&
    /(temporal|cambiar|cambio|actualizar|primer inicio|modal)/.test(norm)
  ) {
    // Aseguramos que las pantallas del cliente no se distorsionen
    const existing = readRawStore(projectId);
    const existingScreens = { ...(existing?.screensByRole || {}) };
    delete existingScreens['Cliente'];
    delete existingScreens['cliente'];
    saveProjectCustomizations(projectId, { screensByRole: existingScreens });
    return {
      matched: true,
      action: 'PASSWORD_MODAL',
      summary: '¡Configurado correctamente! El **Modal de Actualizar Contraseña** está habilitado en la cabecera del portal (botón "Cambiar Clave"). El cliente podrá ingresar su clave temporal recibida y registrar su nueva contraseña de forma segura sin alterar las pantallas de navegación.',
      roleUpdated: null,
      screens: []
    };
  }

  const customRoles = Array.isArray(spec?.actors)
    ? spec.actors.map(a => (typeof a === 'string' ? a : a?.name)).filter(Boolean)
    : [];
  const targetRole = detectTargetRole(cleanMsg, customRoles);
  const mentionsScreensOrRole = targetRole && (
    /(pantalla|pestana|modulo|menu|navegacion|vista|tenga|solo|deja|agrega|anade|aumenta|quita|elimina|borra|mostrar|muestre)/.test(norm)
  );

  if (!mentionsScreensOrRole) {
    return { matched: false };
  }

  const rawStore = readRawStore(projectId);
  const savedScreensByRole = (rawStore && rawStore.screensByRole && typeof rawStore.screensByRole === 'object')
    ? { ...rawStore.screensByRole }
    : {};

  const roleScreens = Array.isArray(savedScreensByRole[targetRole])
    ? [...savedScreensByRole[targetRole]]
    : [...(DEFAULT_SCREENS_BY_ROLE[targetRole] || [])];

  const isRemove = /\b(quita|quitar|elimina|eliminar|borra|borrar|remueve|remover|oculta|ocultar|sin)\b/.test(norm);
  const isAdd = !isRemove && /\b(agrega|agregar|anade|añade|anadir|añadir|aumenta|aumentar|incluye|incluir|suma|sumar)\b/.test(norm) && !/\b(solo|unicamente|siguientes pantallas)\b/.test(norm);

  const extracted = extractScreenListFromMessage(cleanMsg, targetRole);
  if (extracted.length === 0) {
    return { matched: false };
  }

  let updatedList;
  let actionLabel;

  if (isRemove) {
    const removeKeys = new Set(extracted.map(x => x.key));
    updatedList = roleScreens.filter(item => !removeKeys.has(item.key) && !removeKeys.has(item.aliasKey));
    if (updatedList.length === 0) updatedList = [roleScreens[0]].filter(Boolean);
    actionLabel = 'REMOVE';
  } else if (isAdd) {
    updatedList = [...roleScreens];
    for (const item of extracted) {
      if (!updatedList.some(existing => existing.key === item.key || existing.aliasKey === item.key)) {
        updatedList.push(item);
      }
    }
    actionLabel = 'ADD';
  } else {
    updatedList = extracted;
    actionLabel = 'SET';
  }

  savedScreensByRole[targetRole] = updatedList;
  saveProjectCustomizations(projectId, { screensByRole: savedScreensByRole });

  const labelsList = updatedList.map(s => `**${s.label}** (\`${s.key}\`)`).join(', ');
  return {
    matched: true,
    action: actionLabel,
    roleUpdated: targetRole,
    screens: updatedList,
    screensByRole: savedScreensByRole,
    summary: `¡Cambio aplicado en vivo! El rol **${targetRole}** ahora tiene configuradas las siguientes pantallas (${updatedList.length}): ${labelsList}.\n\nSe regeneró automáticamente \`frontend/src/App.jsx\` y el bundle en vivo de la Vista Previa Interactiva.`
  };
}

function formatScreensByRoleCode(screensByRole) {
  const lines = ['export const SCREENS_BY_ROLE = {'];
  const roles = Object.keys(screensByRole);
  roles.forEach((role, rIdx) => {
    const items = screensByRole[role] || [];
    const safeRoleKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(role) ? role : JSON.stringify(role);
    lines.push(`  ${safeRoleKey}: [`);
    items.forEach((item, iIdx) => {
      const comma = iIdx < items.length - 1 ? ',' : '';
      const extraAlias = item.aliasKey ? `, aliasKey: ${JSON.stringify(item.aliasKey)}` : '';
      const extraEndpoint = item.endpoint ? `, endpoint: ${JSON.stringify(item.endpoint)}` : '';
      lines.push(`    { key: ${JSON.stringify(item.key)}, label: ${JSON.stringify(item.label)}, icon: ${JSON.stringify(item.icon || 'analytics')}${extraAlias}${extraEndpoint} }${comma}`);
    });
    lines.push(`  ]${rIdx < roles.length - 1 ? ',' : ''}`);
  });
  lines.push('};');
  return lines.join('\n');
}

module.exports = {
  DEFAULT_SCREENS_BY_ROLE,
  SCREEN_CATALOG,
  matchMockupToCatalogEntry,
  getProjectCustomizations,
  saveProjectCustomizations,
  getProjectEnvConfig,
  saveProjectEnvConfig,
  getProjectScreenOverrides,
  saveProjectScreenOverride,
  getEffectiveScreensByRole,
  getEffectiveScreensByRoleForSpec,
  applyChatCustomizationCommand,
  formatScreensByRoleCode
};
