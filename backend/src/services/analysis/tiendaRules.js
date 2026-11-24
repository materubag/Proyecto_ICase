/**
 * Reglas de negocio predeterminadas ISO 29148 por dominio.
 * Soporta dominio Tienda (Punto de Venta) y dominio Taller (Préstamo de Herramientas).
 * Garantiza que durante presentaciones o análisis automáticos, los requisitos clave
 * obtengan exactamente sus nombres cortos formales, actores, precondiciones y postcondiciones.
 */

const TALLER_RULES = [
  {
    code: 'RF-01',
    match: /registrar\s+herramientas?|alta.*herramientas?|crear\s+herramientas?|nueva\s+herramienta|categor[ií]a.*cantidad.*disponible/i,
    cleanName: 'Registrar herramientas',
    actorRoles: ['Encargado'],
    preconditions: 'El Encargado debe estar autenticado en el sistema. La cantidad inicial disponible debe ser un número entero mayor o igual a cero.',
    postconditions: 'Herramienta registrada exitosamente en el catálogo del taller con nombre, categoría y cantidad disponible inicial.'
  },
  {
    code: 'RF-02',
    match: /consultar\s+herramientas?|cat[aá]logo.*herramientas?|ver\s+herramientas?|disponibilidad.*herramientas?/i,
    cleanName: 'Consultar herramientas',
    actorRoles: ['Estudiante', 'Encargado'],
    preconditions: 'El usuario debe tener acceso al sistema con el catálogo del taller disponible.',
    postconditions: 'Catálogo de herramientas desplegado mostrando nombre, categoría y cantidad de unidades disponibles en tiempo real.'
  },
  {
    code: 'RF-03',
    match: /solicitar.*pr[eé]stamo|pedir.*herramienta|solicitud.*pr[eé]stamo|plazo.*solicitado/i,
    cleanName: 'Solicitar un préstamo',
    actorRoles: ['Estudiante'],
    preconditions: 'El Estudiante debe estar autenticado; la herramienta debe tener cantidad disponible mayor a 0; el plazo solicitado debe ser de 1, 2 o 3 días; y el estudiante no debe registrar préstamos vencidos.',
    postconditions: 'Solicitud de préstamo registrada con estado Pendiente, asociada al estudiante, herramienta seleccionada y plazo solicitado.'
  },
  {
    code: 'RF-04',
    match: /resolver.*solicitud|aprobar.*rechazar|solicitudes.*pendientes/i,
    cleanName: 'Resolver una solicitud',
    actorRoles: ['Encargado'],
    preconditions: 'El Encargado debe estar autenticado en el sistema y debe existir al menos una solicitud en estado Pendiente.',
    postconditions: 'Estado de la solicitud actualizado a Aprobada o Rechazada según la decisión del Encargado, quedando registrada la resolución.'
  },
  {
    code: 'RF-05',
    match: /registrar.*entrega|confirmar.*entrega|entrega.*solicitud|descuenta.*unidad/i,
    cleanName: 'Registrar la entrega',
    actorRoles: ['Encargado'],
    preconditions: 'La solicitud de préstamo debe encontrarse en estado Aprobada y la herramienta debe contar con existencia física para entrega.',
    postconditions: 'Fecha y hora de entrega registradas; fecha/hora límite de vencimiento calculada (24 horas por día de plazo); estado actualizado a Entregada y cantidad disponible descontada en una unidad.'
  },
  {
    code: 'RF-06',
    match: /registrar.*devoluci[oó]n|fecha.*hora.*devoluci[oó]n|suma.*unidad.*disponible|retorno.*herramienta/i,
    cleanName: 'Registrar la devolución',
    actorRoles: ['Encargado'],
    preconditions: 'El préstamo debe encontrarse en estado Entregado o Vencido y el Encargado debe verificar el retorno físico de la herramienta.',
    postconditions: 'Fecha y hora de devolución registradas; estado del préstamo actualizado a Devuelta; cantidad disponible de la herramienta incrementada en una unidad y estudiante rehabilitado si no registra otros vencidos.'
  },
  {
    code: 'RF-07',
    match: /consultar\s+solicitudes\s+propias|mis\s+solicitudes|solicitudes.*estudiante|estado.*solicitudes/i,
    cleanName: 'Consultar solicitudes propias',
    actorRoles: ['Estudiante'],
    preconditions: 'El Estudiante debe estar autenticado en el sistema.',
    postconditions: 'Listado de solicitudes del estudiante desplegado con herramienta, plazo y estado actual (Pendiente, Aprobada, Rechazada, Entregada, Devuelta o Vencida).'
  },
  {
    code: 'RF-08',
    match: /pr[eé]stamos\s+vencidos|consultar\s+pr[eé]stamos\s+vencidos|l[ií]mite\s+de\s+devoluci[oó]n/i,
    cleanName: 'Consultar préstamos vencidos',
    actorRoles: ['Encargado'],
    preconditions: 'El Encargado debe estar autenticado con permisos de supervisión del taller.',
    postconditions: 'Listado de préstamos cuya fecha y hora límite ha expirado sin registrar devolución, mostrando estudiante, herramienta retenida y fecha límite vencida.'
  }
];

const TIENDA_RULES = [
  {
    code: 'RF-01',
    match: /login|inicio\s+de\s+sesi[oó]n|iniciar\s+sesi[oó]n|autenticaci[oó]n|credenciales/i,
    cleanName: 'Inicio de sesión',
    actorRoles: ['Administrador', 'Vendedor'],
    preconditions: 'El usuario se encuentra en la pantalla de inicio de sesión con el sistema en ejecución.',
    postconditions: 'Credenciales validadas con JWT emitido; redirección al panel de Administrador o mostrador de Vendedor según su rol asignado.'
  },
  {
    code: 'RF-02',
    match: /crear\s+cuenta.*vendedor|cuenta.*vendedor|registrar\s+vendedor|nuevo\s+vendedor/i,
    cleanName: 'Crear cuenta de vendedor',
    actorRoles: ['Administrador'],
    preconditions: 'El Administrador debe estar autenticado en el sistema y el nombre de usuario propuesto no debe existir previamente.',
    postconditions: 'Nueva cuenta de usuario creada con rol Vendedor, contraseña cifrada con bcrypt y habilitada para iniciar sesión.'
  },
  {
    code: 'RF-03',
    match: /registrar\s+producto|alta.*producto|crear\s+producto|nuevo\s+producto|inventario.*inicial/i,
    cleanName: 'Registrar producto',
    actorRoles: ['Administrador'],
    preconditions: 'El Administrador debe estar autenticado y el código de producto no debe estar registrado en el inventario.',
    postconditions: 'Producto registrado en la base de datos con código, nombre, precio unitario y cantidad inicial reflejada en el stock.'
  },
  {
    code: 'RF-04',
    match: /cat[aá]logo(\s+de\s+productos)?|mostrar\s+los\s+productos|seleccionar\s+un\s+producto|agregar.*factura/i,
    cleanName: 'Catálogo de productos',
    actorRoles: ['Vendedor'],
    preconditions: 'El Vendedor debe estar autenticado y deben existir productos registrados en el inventario con existencias disponibles.',
    postconditions: 'Productos visibles en tiempo real con precio y stock; ítems seleccionados añadidos al borrador de la factura con opción de modificar o retirar.'
  },
  {
    code: 'RF-05',
    match: /c[aá]lculo.*importe|calcular.*importe|importe\s+de\s+cada\s+l[ií]nea|precio\s+unitario\s+por\s+cantidad|actualizar\s+el\s+total/i,
    cleanName: 'Cálculo de importes de factura',
    actorRoles: ['Vendedor'],
    preconditions: 'Debe existir al menos un ítem agregado al detalle de la factura con cantidad válida (mayor a 0).',
    postconditions: 'Importe por línea calculado (precio unitario × cantidad) y subtotal/total general de la factura actualizado dinámicamente.'
  },
  {
    code: 'RF-06',
    match: /facturar|facturaci[oó]n|descontar.*stock|descontar\s+las\s+unidades|registrar\s+la\s+venta/i,
    cleanName: 'Facturación y descuento de stock',
    actorRoles: ['Vendedor'],
    preconditions: 'El detalle de la factura debe tener al menos una línea y cada producto debe contar con stock suficiente (existencias >= cantidad solicitada).',
    postconditions: 'Venta registrada con factura emitida, número correlativo generado, total confirmado y unidades vendidas descontadas del inventario en transacción atómica.'
  },
  {
    code: 'RF-07',
    match: /consultar.*ventas|historial.*ventas|ventas\s+registradas|ver\s+el\s+n[uú]mero\s+de\s+factura/i,
    cleanName: 'Consultar ventas registradas',
    actorRoles: ['Administrador'],
    preconditions: 'El Administrador debe estar autenticado con permisos de visualización de historial general de ventas.',
    postconditions: 'Listado cronológico de ventas desplegado mostrando número de factura, fecha/hora, vendedor responsable, detalle de productos y monto total.'
  },
  {
    code: 'RNF-01',
    match: /control\s+de\s+acceso|rechazar.*solicitudes|funciones\s+protegidas|sin\s+sesi[oó]n|rol\s+vendedor.*bloqueado/i,
    cleanName: 'Control de acceso y permisos',
    actorRoles: ['Vendedor'],
    preconditions: 'Toda petición HTTP debe incluir un token de autorización válido en las cabeceras (Authorization: Bearer <JWT>).',
    postconditions: 'El servidor restringe el 100% de operaciones no autorizadas; el rol Vendedor queda bloqueado de crear cuentas, registrar productos o consultar ventas globales con respuesta 403 Forbidden.'
  }
];

function matchTiendaRule(text, code = '') {
  const combined = `${code || ''} ${text || ''}`.toLowerCase();

  // 1. Detectar si el contexto corresponde a Taller / Préstamo de herramientas
  const isTallerContext = /herramienta|taller|pr[eé]stamo|devoluci[oó]n|encargado|estudiante/i.test(combined);
  if (isTallerContext) {
    for (const rule of TALLER_RULES) {
      if (rule.match.test(combined)) {
        return rule;
      }
    }
  }

  // 2. Si no es taller, evaluar reglas de Tienda
  for (const rule of TIENDA_RULES) {
    if (rule.match.test(combined)) {
      return rule;
    }
  }

  return null;
}

module.exports = {
  TIENDA_RULES,
  TALLER_RULES,
  matchTiendaRule
};
