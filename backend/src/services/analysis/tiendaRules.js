/**
 * Reglas de negocio predeterminadas ISO 29148 para el dominio Tienda / Punto de Venta.
 * Garantiza que durante presentaciones o análisis automáticos, los requisitos clave
 * obtengan exactamente sus precondiciones, postcondiciones y nombres formales.
 */

const TIENDA_RULES = [
  {
    code: 'RF-01',
    match: /login|inicio\s+de\s+sesi[oó]n|iniciar\s+sesi[oó]n|autenticaci[oó]n|credenciales|rf-01\b/i,
    cleanName: 'Inicio de sesión',
    actorRoles: ['Administrador', 'Vendedor'],
    preconditions: 'El usuario se encuentra en la pantalla de inicio de sesión con el sistema en ejecución.',
    postconditions: 'Credenciales validadas con JWT emitido; redirección al panel de Administrador o mostrador de Vendedor según su rol asignado.'
  },
  {
    code: 'RF-02',
    match: /crear\s+cuenta.*vendedor|cuenta.*vendedor|registrar\s+vendedor|nuevo\s+vendedor|rf-02\b/i,
    cleanName: 'Crear cuenta de vendedor',
    actorRoles: ['Administrador'],
    preconditions: 'El Administrador debe estar autenticado en el sistema y el nombre de usuario propuesto no debe existir previamente.',
    postconditions: 'Nueva cuenta de usuario creada con rol Vendedor, contraseña cifrada con bcrypt y habilitada para iniciar sesión.'
  },
  {
    code: 'RF-03',
    match: /registrar\s+producto|alta.*producto|crear\s+producto|nuevo\s+producto|inventario.*inicial|rf-03\b/i,
    cleanName: 'Registrar producto',
    actorRoles: ['Administrador'],
    preconditions: 'El Administrador debe estar autenticado y el código de producto no debe estar registrado en el inventario.',
    postconditions: 'Producto registrado en la base de datos con código, nombre, precio unitario y cantidad inicial reflejada en el stock.'
  },
  {
    code: 'RF-04',
    match: /cat[aá]logo|mostrar\s+los\s+productos|seleccionar\s+un\s+producto|agregar.*factura|ver\s+existencia|rf-04\b/i,
    cleanName: 'Catálogo de productos',
    actorRoles: ['Vendedor'],
    preconditions: 'El Vendedor debe estar autenticado y deben existir productos registrados en el inventario con existencias disponibles.',
    postconditions: 'Productos visibles en tiempo real con precio y stock; ítems seleccionados añadidos al borrador de la factura con opción de modificar o retirar.'
  },
  {
    code: 'RF-05',
    match: /c[aá]lculo.*importe|calcular.*importe|importe\s+de\s+cada\s+l[ií]nea|precio\s+unitario\s+por\s+cantidad|actualizar\s+el\s+total|rf-05\b/i,
    cleanName: 'Cálculo de importes de factura',
    actorRoles: ['Vendedor'],
    preconditions: 'Debe existir al menos un ítem agregado al detalle de la factura con cantidad válida (mayor a 0).',
    postconditions: 'Importe por línea calculado (precio unitario × cantidad) y subtotal/total general de la factura actualizado dinámicamente.'
  },
  {
    code: 'RF-06',
    match: /facturar|facturaci[oó]n|descontar.*stock|descontar\s+las\s+unidades|registrar\s+la\s+venta|rf-06\b/i,
    cleanName: 'Facturación y descuento de stock',
    actorRoles: ['Vendedor'],
    preconditions: 'El detalle de la factura debe tener al menos una línea y cada producto debe contar con stock suficiente (existencias >= cantidad solicitada).',
    postconditions: 'Venta registrada con factura emitida, número correlativo generado, total confirmado y unidades vendidas descontadas del inventario en transacción atómica.'
  },
  {
    code: 'RF-07',
    match: /consultar.*ventas|historial.*ventas|ventas\s+registradas|ver\s+el\s+n[uú]mero\s+de\s+factura|rf-07\b/i,
    cleanName: 'Consultar ventas registradas',
    actorRoles: ['Administrador'],
    preconditions: 'El Administrador debe estar autenticado con permisos de visualización de historial general de ventas.',
    postconditions: 'Listado cronológico de ventas desplegado mostrando número de factura, fecha/hora, vendedor responsable, detalle de productos y monto total.'
  },
  {
    code: 'RNF-01',
    match: /control\s+de\s+acceso|rechazar.*solicitudes|funciones\s+protegidas|sin\s+sesi[oó]n|rol\s+vendedor.*bloqueado|rnf-01\b/i,
    cleanName: 'Control de acceso y permisos',
    actorRoles: ['Vendedor'],
    preconditions: 'Toda petición HTTP debe incluir un token de autorización válido en las cabeceras (Authorization: Bearer <JWT>).',
    postconditions: 'El servidor restringe el 100% de operaciones no autorizadas; el rol Vendedor queda bloqueado de crear cuentas, registrar productos o consultar ventas globales con respuesta 403 Forbidden.'
  }
];

function matchTiendaRule(text, code = '') {
  const combined = `${code || ''} ${text || ''}`.toLowerCase();
  for (const rule of TIENDA_RULES) {
    if (rule.match.test(combined)) {
      return rule;
    }
  }
  return null;
}

module.exports = {
  TIENDA_RULES,
  matchTiendaRule
};
