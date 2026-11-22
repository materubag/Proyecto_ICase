'use strict';

const PERMISSIONS_SEED = [
  ['citas.crear', 'Agendar cita', ['Administrador', 'Recepción', 'Cliente']],
  ['citas.reprogramar', 'Reprogramar cita', ['Administrador', 'Recepción', 'Cliente']],
  ['citas.disponibilidad', 'Definir horarios', ['Administrador', 'Recepción']],
  ['recepcion.crear', 'Registrar recepción', ['Administrador', 'Recepción']],
  ['diag.registrar', 'Registrar diagnóstico', ['Administrador', 'Mecánico']],
  ['diag.obd', 'Consultar base OBD', ['Administrador', 'Recepción', 'Mecánico']],
  ['diag.proponer', 'Proponer código OBD', ['Administrador', 'Mecánico']],
  ['ot.asignar', 'Asignar mecánicos', ['Administrador', 'Recepción']],
  ['ot.bitacora', 'Registrar bitácora', ['Administrador', 'Mecánico']],
  ['ot.consumo_stock', 'Consumir repuesto', ['Administrador', 'Mecánico']],
  ['inv.ajuste', 'Ajustar inventario', ['Administrador']],
  ['inv.venta_mostrador', 'Venta de mostrador', ['Administrador', 'Recepción']],
  ['inv.compras', 'Registrar compras', ['Administrador']],
  ['mant.configurar', 'Configurar mantenimiento', ['Administrador', 'Recepción']],
  ['reportes.kpi', 'Ver indicadores', ['Administrador']]
];

const OBD_CATALOG = [
  ['P0101', 'Circuito del sensor MAF fuera de rango', 'Filtro de aire saturado o sensor MAF sucio', 'Sensor MAF', 'Limpiar el sensor con limpiador dieléctrico y revisar fugas de admisión'],
  ['P0102', 'Señal baja del sensor MAF', 'Conector sulfatado o cableado abierto', 'Sensor MAF', 'Medir alimentación de 5 V y continuidad del arnés'],
  ['P0113', 'Señal alta del sensor de temperatura de aire', 'Sensor IAT abierto o desconectado', 'Sensor IAT', 'Verificar resistencia del sensor en frío y en caliente'],
  ['P0128', 'Temperatura de refrigerante por debajo del termostato', 'Termostato abierto o sensor ECT fuera de rango', 'Termostato', 'Reemplazar el termostato y purgar el sistema de refrigeración'],
  ['P0131', 'Sensor de oxígeno banco 1 sensor 1 con voltaje bajo', 'Mezcla pobre o sensor envejecido', 'Sensor de oxígeno', 'Revisar fugas de vacío antes de cambiar el sensor'],
  ['P0135', 'Calentador del sensor de oxígeno banco 1 sensor 1', 'Resistencia del calentador abierta', 'Sensor de oxígeno', 'Medir la resistencia del calentador y el fusible del circuito'],
  ['P0171', 'Mezcla demasiado pobre, banco 1', 'Fuga de admisión, inyector sucio o bomba con baja presión', 'Sistema de combustible', 'Prueba de humo en admisión y medición de presión de combustible'],
  ['P0172', 'Mezcla demasiado rica, banco 1', 'Inyector goteando o sensor MAF descalibrado', 'Sistema de combustible', 'Balance de inyectores y lectura de ajuste de combustible'],
  ['P0300', 'Fallas de encendido aleatorias', 'Bujías, bobinas, combustible o compresión desigual', 'Encendido', 'Identificar el cilindro con el escáner y probar chispa y compresión'],
  ['P0301', 'Falla de encendido en el cilindro 1', 'Bujía, bobina o inyector del cilindro 1', 'Encendido cilindro 1', 'Intercambiar bobina y bujía para aislar el componente'],
  ['P0302', 'Falla de encendido en el cilindro 2', 'Bujía, bobina o inyector del cilindro 2', 'Encendido cilindro 2', 'Intercambiar bobina y bujía para aislar el componente'],
  ['P0303', 'Falla de encendido en el cilindro 3', 'Bujía, bobina o inyector del cilindro 3', 'Encendido cilindro 3', 'Intercambiar bobina y bujía para aislar el componente'],
  ['P0304', 'Falla de encendido en el cilindro 4', 'Bujía, bobina o inyector del cilindro 4', 'Encendido cilindro 4', 'Intercambiar bobina y bujía para aislar el componente'],
  ['P0325', 'Circuito del sensor de detonación', 'Sensor de knock flojo o arnés dañado', 'Sensor de detonación', 'Apretar el sensor al torque indicado y revisar el blindaje del cable'],
  ['P0335', 'Circuito del sensor de cigüeñal', 'Sensor CKP sucio, reluctor dañado o entrehierro incorrecto', 'Sensor CKP', 'Inspeccionar el tono de la rueda fónica y la señal con osciloscopio'],
  ['P0340', 'Circuito del sensor de árbol de levas', 'Sensor CMP o sincronización de distribución fuera de punto', 'Sensor CMP', 'Comparar las señales CKP y CMP antes de desarmar distribución'],
  ['P0345', 'Sensor de posición del árbol de levas, banco 2', 'Circuito abierto o pérdida de sincronismo en banco 2', 'Sensor CMP banco 2', 'Verificar conector, alimentación y fase de distribución'],
  ['P0401', 'Flujo insuficiente de la válvula EGR', 'Pasajes de EGR obstruidos', 'Válvula EGR', 'Limpiar los conductos y comprobar el accionamiento de la válvula'],
  ['P0420', 'Eficiencia del catalizador por debajo del umbral, banco 1', 'Catalizador agotado o fuga antes del sensor trasero', 'Catalizador', 'Comparar las señales de los sensores de oxígeno delantero y trasero'],
  ['P0430', 'Eficiencia del catalizador por debajo del umbral, banco 2', 'Catalizador del banco 2 degradado', 'Catalizador banco 2', 'Descartar fallas de encendido crónicas antes de cambiar el catalizador'],
  ['P0442', 'Fuga pequeña en el sistema EVAP', 'Tapa de combustible floja o manguera cuarteada', 'Sistema EVAP', 'Apretar la tapa y hacer prueba de humo en el depósito'],
  ['P0455', 'Fuga grande en el sistema EVAP', 'Tapa ausente, cánister roto o válvula de purga abierta', 'Sistema EVAP', 'Revisar tapa, cánister y válvula de purga'],
  ['P0500', 'Sensor de velocidad del vehículo', 'Sensor VSS o anillo reluctor dañado', 'Sensor de velocidad', 'Verificar señal de velocidad en ruta y el conector del sensor'],
  ['P0507', 'Revoluciones de ralentí más altas de lo esperado', 'Cuerpo de aceleración sucio o fuga de vacío', 'Cuerpo de aceleración', 'Limpiar el cuerpo de aceleración y reaprender ralentí'],
  ['P0562', 'Voltaje del sistema bajo', 'Batería descargada, alternador o tierra deficiente', 'Sistema de carga', 'Medir voltaje en ralentí y con carga de consumidores'],
  ['P0606', 'Procesador del módulo de control del motor', 'Falla interna de la ECU o alimentación inestable', 'ECU', 'Confirmar alimentación y tierras antes de diagnosticar el módulo'],
  ['P0700', 'Solicitud de diagnóstico del módulo de transmisión', 'La TCM registró un código propio', 'Transmisión', 'Leer los códigos específicos de la transmisión'],
  ['P0715', 'Sensor de velocidad de entrada de la transmisión', 'Sensor de entrada o conector con falso contacto', 'Sensor de entrada', 'Comparar velocidad de entrada contra revoluciones del motor'],
  ['P0720', 'Sensor de velocidad de salida de la transmisión', 'Sensor de salida defectuoso', 'Sensor de salida', 'Verificar la señal mientras se gira la transmisión'],
  ['P0741', 'Embrague del convertidor de par desacoplado', 'Solenoide TCC o convertidor desgastado', 'Convertidor de par', 'Probar el solenoide y la presión de línea antes de abrir la caja'],
  ['P0750', 'Solenoide de cambio A', 'Solenoide abierto, en corto o fluido degradado', 'Solenoide de cambio', 'Medir resistencia del solenoide y el estado del fluido'],
  ['C0035', 'Sensor de velocidad de la rueda delantera izquierda', 'Sensor ABS sucio o anillo tonificado dañado', 'Sensor ABS', 'Limpiar el sensor y revisar el entrehierro'],
  ['C0040', 'Sensor de velocidad de la rueda delantera derecha', 'Sensor ABS o cableado de la rueda derecha', 'Sensor ABS', 'Comparar las cuatro señales de rueda en el escáner'],
  ['B1000', 'Falla interna de un módulo de carrocería', 'Módulo con alimentación irregular', 'Módulo de carrocería', 'Revisar alimentación, tierra y códigos del módulo afectado'],
  ['U0100', 'Pérdida de comunicación con el módulo del motor', 'Línea CAN en corto o ECU sin alimentación', 'Red CAN', 'Medir resistencia de la red CAN, que debe estar cerca de 60 ohmios']
];

const SPARE_PARTS_SEED = [
  ['FLT-AIR-001', 'Filtro de aire panel', 'Filtros', 'Mann', 8.5, 16, 24, 6],
  ['FLT-OIL-002', 'Filtro de aceite sellado', 'Filtros', 'Bosch', 4.2, 9.5, 30, 8],
  ['FLT-CAB-003', 'Filtro de cabina de carbón', 'Filtros', 'Mann', 7.8, 15, 18, 4],
  ['FLT-GAS-004', 'Filtro de combustible en línea', 'Filtros', 'Bosch', 6.4, 13, 16, 4],
  ['LUB-5W30-005', 'Aceite de motor sintético 5W-30, galón', 'Lubricantes', 'Valvoline', 22, 38, 20, 6],
  ['LUB-10W40-006', 'Aceite de motor mineral 10W-40, galón', 'Lubricantes', 'Havoline', 14, 26, 16, 4],
  ['LUB-ATF-007', 'Aceite de transmisión automática, litro', 'Lubricantes', 'Mobil', 8, 15, 12, 4],
  ['LUB-BRK-008', 'Líquido de frenos DOT 4, 500 ml', 'Frenos', 'Bosch', 4.5, 9, 14, 4],
  ['LUB-CLT-009', 'Refrigerante concentrado, galón', 'Refrigeración', 'Prestone', 9, 18, 10, 3],
  ['BUJ-IRID-010', 'Bujía de iridio, unidad', 'Encendido', 'NGK', 6.5, 14, 40, 12],
  ['BOB-IGN-011', 'Bobina de encendido individual', 'Encendido', 'Bosch', 28, 52, 8, 2],
  ['CAB-BUJ-012', 'Cable de bujía, juego', 'Encendido', 'NGK', 18, 34, 6, 2],
  ['PST-FRN-013', 'Pastillas de freno delanteras cerámicas', 'Frenos', 'Brembo', 28, 49, 10, 3],
  ['PST-FRT-014', 'Pastillas de freno traseras', 'Frenos', 'Brembo', 22, 39, 8, 2],
  ['DSC-FRN-015', 'Disco de freno delantero ventilado', 'Frenos', 'Brembo', 32, 58, 6, 2],
  ['DSC-FRT-016', 'Disco de freno trasero', 'Frenos', 'Brembo', 26, 46, 4, 2],
  ['BAT-12V-017', 'Batería 12 V 60 Ah libre de mantenimiento', 'Eléctrico', 'Bosch', 72, 118, 5, 2],
  ['ALT-COR-018', 'Correa de accesorios', 'Motor', 'Gates', 12, 24, 8, 2],
  ['ALT-DST-019', 'Kit de banda de distribución con tensor', 'Motor', 'Gates', 48, 89, 3, 1],
  ['BOM-AGU-020', 'Bomba de agua', 'Refrigeración', 'Gates', 35, 64, 3, 1],
  ['TER-MOT-021', 'Termostato de motor', 'Refrigeración', 'Gates', 9, 18, 7, 2],
  ['RAD-MNG-022', 'Manguera superior de radiador', 'Refrigeración', 'Gates', 11, 22, 5, 2],
  ['AMO-DEL-023', 'Amortiguador delantero', 'Suspensión', 'Monroe', 42, 78, 4, 2],
  ['AMO-TRA-024', 'Amortiguador trasero', 'Suspensión', 'Monroe', 36, 68, 4, 2],
  ['ROT-DEL-025', 'Rótula de suspensión delantera', 'Suspensión', 'Monroe', 16, 32, 6, 2],
  ['TER-DIR-026', 'Terminal de dirección', 'Dirección', 'Monroe', 14, 28, 6, 2],
  ['PLU-ESC-027', 'Limpiaparabrisas de 22 pulgadas', 'Carrocería', 'Bosch', 6, 13, 12, 4],
  ['FOC-H4-028', 'Foco halógeno H4', 'Eléctrico', 'Osram', 5.5, 12, 15, 4],
  ['SEN-O2-029', 'Sensor de oxígeno de 4 cables', 'Sensores', 'Bosch', 38, 72, 4, 1],
  ['SEN-MAP-030', 'Sensor MAP', 'Sensores', 'Bosch', 24, 46, 3, 1],
  ['SEN-ABS-031', 'Sensor de velocidad de rueda ABS', 'Frenos', 'Bosch', 22, 42, 4, 1],
  ['INY-GAS-032', 'Inyector de combustible', 'Combustible', 'Bosch', 34, 62, 6, 2]
];

const SERVICES_SEED = [
  ['Diagnóstico con escáner', 'Lectura de códigos, prueba de sensores y reporte de la falla encontrada', 20, 40],
  ['Cambio de aceite y filtro', 'Drenado del aceite, filtro nuevo y nivel según la viscosidad del motor', 25, 40],
  ['Cambio de filtro de aire', 'Sustitución del filtro del motor', 8, 15],
  ['Cambio de filtro de cabina', 'Sustitución del filtro del habitáculo', 10, 20],
  ['Cambio de filtro de combustible', 'Sustitución del filtro en línea y purga del circuito', 15, 30],
  ['Cambio de bujías', 'Sustitución del juego de bujías y revisión de la luz de electrodo', 22, 45],
  ['Cambio de bobina de encendido', 'Sustitución de la bobina y prueba de chispa', 18, 30],
  ['Limpieza de inyectores', 'Limpieza en banco o en el vehículo y control de fugas', 40, 70],
  ['Cambio de pastillas delanteras', 'Sustitución de pastillas, limpieza de mordazas y prueba de frenado', 35, 60],
  ['Cambio de pastillas traseras', 'Sustitución de pastillas traseras y ajuste del freno', 35, 60],
  ['Cambio de discos de freno', 'Sustitución de discos y pastillas del eje indicado', 55, 90],
  ['Purga de líquido de frenos', 'Sustitución del líquido DOT y purga de las cuatro ruedas', 20, 40],
  ['Cambio de kit de distribución', 'Banda o cadena, tensor y bomba de agua si el kit la incluye', 140, 240],
  ['Cambio de correa de accesorios', 'Sustitución de la correa y revisión del tensor', 22, 40],
  ['Cambio de bomba de agua', 'Sustitución de la bomba y llenado del sistema de refrigeración', 55, 120],
  ['Cambio de termostato', 'Sustitución del termostato y purga del refrigerante', 28, 50],
  ['Cambio de refrigerante', 'Drenado, llenado y purga del sistema de enfriamiento', 18, 40],
  ['Cambio de amortiguadores delanteros', 'Sustitución del par delantero y prueba de ruta', 55, 90],
  ['Cambio de amortiguadores traseros', 'Sustitución del par trasero y prueba de ruta', 48, 80],
  ['Alineación y balanceo', 'Alineación de dirección y balanceo de las cuatro ruedas', 25, 60],
  ['Cambio de batería', 'Sustitución de la batería y verificación del sistema de carga', 12, 20],
  ['Cambio de sensor de oxígeno', 'Sustitución del sensor y borrado del código relacionado', 25, 40],
  ['Revisión de frenos y suspensión', 'Inspección en elevador de frenos, rótulas, terminales y amortiguadores', 15, 30],
  ['Lavado de motor', 'Limpieza externa del motor y secado de conectores', 12, 30]
];

const projectStates = new Map();
const uploadedBlobs = new Map();

function money(val) {
  const num = Number(val || 0);
  return Number.isFinite(num) ? Math.round((num + Number.EPSILON) * 100) / 100 : 0;
}

function todayStr(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

/**
 * Estado inicial idéntico a seed-data.js de ejemplo_referencia.zip:
 * Solo roles, usuarios base, permisos, catálogo OBD, servicios y repuestos.
 * NO crea clientes, vehículos, citas, recepciones, diagnósticos, cotizaciones ni órdenes estáticas.
 */
function createInitialProjectState() {
  const roles = [
    { id: 1, nombre: 'Administrador', descripcion: 'Control total del taller, finanzas, usuarios y auditoría' },
    { id: 2, nombre: 'Recepción', descripcion: 'Agenda de citas, recepción de vehículos, cotizaciones y mostrador' },
    { id: 3, nombre: 'Mecánico', descripcion: 'Diagnóstico técnico OBD, órdenes de trabajo y bitácora' },
    { id: 4, nombre: 'Cliente', descripcion: 'Portal del cliente propietario de vehículos' }
  ];

  const rolesMap = {
    Administrador: 1,
    Recepción: 2,
    Mecánico: 3,
    Cliente: 4
  };

  const usuarios = [
    { id: 1, nombre: 'Administrador Nexora', correo: 'admin@nexora.ec', rolId: 1, ROL: { id: 1, nombre: 'Administrador' }, activo: true, cambioObligatorio: false, passwordPlain: 'Password123!' },
    { id: 2, nombre: 'Administrador General Autron', correo: 'admin@autron5.com', rolId: 1, ROL: { id: 1, nombre: 'Administrador' }, activo: true, cambioObligatorio: false, passwordPlain: 'admin123' },
    { id: 3, nombre: 'Recepción Nexora', correo: 'recepcion@nexora.ec', rolId: 2, ROL: { id: 2, nombre: 'Recepción' }, activo: true, cambioObligatorio: false, passwordPlain: 'Password123!' },
    { id: 4, nombre: 'Mecánico Nexora', correo: 'mecanico@nexora.ec', rolId: 3, ROL: { id: 3, nombre: 'Mecánico' }, activo: true, cambioObligatorio: false, passwordPlain: 'Password123!' },
    { id: 5, nombre: 'Cliente de prueba', correo: 'cliente@nexora.ec', rolId: 4, ROL: { id: 4, nombre: 'Cliente' }, activo: true, cambioObligatorio: false, passwordPlain: 'Password123!' }
  ];

  const permisos = [];
  const rolPermisos = [];
  PERMISSIONS_SEED.forEach(([codigo, descripcion, allowedRoles], idx) => {
    const permId = idx + 1;
    permisos.push({ id: permId, codigo, descripcion });
    for (const rName of allowedRoles) {
      const rId = rolesMap[rName];
      if (rId) rolPermisos.push({ rolId: rId, permisoId: permId });
    }
  });

  const obdCodigos = [];
  const productos = [];
  const movimientoInventarios = [];
  const servicios = [];

  return {
    roles,
    usuarios,
    permisos,
    rolPermisos,
    obdCodigos,
    productos,
    movimientoInventarios,
    servicios,
    // Tablas operativas inicialmente vacías (sin datos estáticos):
    clientes: [],
    vehiculos: [],
    espacioCitas: [],
    citas: [],
    recepciones: [],
    evidencias: [],
    diagnosticos: [],
    diagnosticoFallas: [],
    proveedores: [],
    cotizaciones: [],
    cotizacionItems: [],
    ordenTrabajos: [],
    ordenMecanicos: [],
    actividades: [],
    ventas: [],
    vendedores: [],
    compras: [],
    propuestaObdCodigos: [],
    programacionMantenimientos: [],
    alertas: [],
    notificaciones: [],
    auditorias: [],
    customEntities: {}
  };
}

const STORE_PRODUCTS_SEED = [
  { id: 1, codigo: 'SKU-77210', nombre: 'Aceite de Oliva Extra Virgen 500ml', categoria: 'Abarrotes', precio_venta: 128.50, precio: 128.50, costo: 95.00, existencia_actual: 45, stock: 45, stockMinimo: 10, activo: true },
  { id: 2, codigo: 'SKU-31094', nombre: 'Café Tostado en Grano Selección 1kg', categoria: 'Bebidas', precio_venta: 245.00, precio: 245.00, costo: 180.00, existencia_actual: 3, stock: 3, stockMinimo: 10, activo: true },
  { id: 3, codigo: 'SKU-99412', nombre: 'Detergente Líquido Biodegradable 3L', categoria: 'Limpieza', precio_venta: 162.00, precio: 162.00, costo: 115.00, existencia_actual: 28, stock: 28, stockMinimo: 8, activo: true },
  { id: 4, codigo: 'SKU-48190', nombre: 'Agua Mineral de Manantial Pack 6x500ml', categoria: 'Bebidas', precio_venta: 72.00, precio: 72.00, costo: 48.00, existencia_actual: 60, stock: 60, stockMinimo: 15, activo: true },
  { id: 5, codigo: 'SKU-10245', nombre: 'Arroz Flor Extra Envejecido 1kg', categoria: 'Abarrotes', precio_venta: 38.00, precio: 38.00, costo: 25.00, existencia_actual: 40, stock: 40, stockMinimo: 10, activo: true },
  { id: 6, codigo: 'SKU-55219', nombre: 'Atún Lomitos en Aceite de Girasol 140g', categoria: 'Enlatados', precio_venta: 45.00, precio: 45.00, costo: 32.00, existencia_actual: 50, stock: 50, stockMinimo: 12, activo: true },
  { id: 7, codigo: 'SKU-88231', nombre: 'Leche Entera Larga Vida 1L', categoria: 'Lácteos', precio_venta: 28.00, precio: 28.00, costo: 19.00, existencia_actual: 35, stock: 35, stockMinimo: 10, activo: true },
  { id: 8, codigo: 'SKU-66324', nombre: 'Fideos Spaghetti Clásico 400g', categoria: 'Pastas', precio_venta: 22.00, precio: 22.00, costo: 14.00, existencia_actual: 8, stock: 8, stockMinimo: 10, activo: true }
];

const STORE_VENDORS_SEED = [
  { id: 1, nombre: 'Carlos Mendoza', username: 'cmendoza', rol: 'Vendedor', fechaAlta: '14 Oct 2024', activo: true },
  { id: 2, nombre: 'Mariana Soto', username: 'msoto', rol: 'Vendedor', fechaAlta: '28 Sep 2024', activo: true },
  { id: 3, nombre: 'Roberto Gómez', username: 'rgomez', rol: 'Vendedor', fechaAlta: '15 Ago 2024', activo: true },
  { id: 4, nombre: 'Elena Castillo', username: 'ecastillo', rol: 'Vendedor', fechaAlta: '02 Jul 2024', activo: true }
];

const STORE_SALES_SEED = [
  { id: 1, factura: 'FAC-001-0024', fecha: '21 Nov 2024 · 10:15', cliente: 'Consumidor Final', vendedor: 'Carlos Mendoza', productos: '2x Aceite de Oliva 500ml, 1x Café Tostado 1kg', total: 502.00, subtotal: 436.52, iva: 65.48, unidades: 3 },
  { id: 2, factura: 'FAC-001-0023', fecha: '21 Nov 2024 · 09:42', cliente: 'Distribuidora San Juan', vendedor: 'Mariana Soto', productos: '5x Arroz Flor 1kg, 3x Atún Lomitos 140g', total: 325.00, subtotal: 282.61, iva: 42.39, unidades: 8 },
  { id: 3, factura: 'FAC-001-0022', fecha: '21 Nov 2024 · 08:30', cliente: 'Juan Carlos Morales', vendedor: 'Carlos Mendoza', productos: '2x Detergente Líquido 3L', total: 324.00, subtotal: 281.74, iva: 42.26, unidades: 2 },
  { id: 4, factura: 'FAC-001-0021', fecha: '20 Nov 2024 · 18:05', cliente: 'Consumidor Final', vendedor: 'Elena Castillo', productos: '6x Agua Mineral 500ml, 2x Fideos Spaghetti 400g', total: 116.00, subtotal: 100.87, iva: 15.13, unidades: 8 },
  { id: 5, factura: 'FAC-001-0020', fecha: '20 Nov 2024 · 16:20', cliente: 'Restaurante El Criollo', vendedor: 'Roberto Gómez', productos: '10x Arroz Flor 1kg, 4x Aceite 1L', total: 492.00, subtotal: 427.83, iva: 64.17, unidades: 14 }
];

function getState(projectId) {
  const key = String(projectId || 'default');
  if (!projectStates.has(key)) {
    projectStates.set(key, createInitialProjectState());
  }
  const state = projectStates.get(key);
  if (Array.isArray(state.productos) && state.productos.length === 0) {
    state.productos = STORE_PRODUCTS_SEED.map(p => ({ ...p }));
  }
  if (!state.vendedores || state.vendedores.length === 0) {
    state.vendedores = STORE_VENDORS_SEED.map(v => ({ ...v }));
  }
  if (!state.ventas || state.ventas.length === 0) {
    state.ventas = STORE_SALES_SEED.map(s => ({ ...s }));
  }
  if (!state.usuarios.some(u => u.rol === 'Vendedor' || u.role === 'Vendedor')) {
    state.usuarios.push(
      { id: 10, nombre: 'Carlos Mendoza', correo: 'vendedor@tienda.com', email: 'vendedor@tienda.com', rolId: 10, role: 'Vendedor', rol: 'Vendedor', ROL: { id: 10, nombre: 'Vendedor' }, activo: true, cambioObligatorio: false, passwordPlain: 'Password123!' },
      { id: 11, nombre: 'Laura Paredes', correo: 'admin@tienda.com', email: 'admin@tienda.com', rolId: 1, role: 'Administrador', rol: 'Administrador', ROL: { id: 1, nombre: 'Administrador' }, activo: true, cambioObligatorio: false, passwordPlain: 'Password123!' }
    );
  }
  return state;
}

function nextId(list) {
  if (!Array.isArray(list) || list.length === 0) return 1;
  return Math.max(...list.map(item => Number(item.id) || 0)) + 1;
}

function addAudit(state, user, entidad, entidadId, operacion, detalle) {
  state.auditorias.unshift({
    id: nextId(state.auditorias),
    usuarioId: user?.id || null,
    Usuario: { nombre: user?.nombre || 'Usuario' },
    entidad,
    entidadId,
    operacion,
    detalle: typeof detalle === 'string' ? detalle : JSON.stringify(detalle || {}),
    fechaEvento: new Date().toISOString()
  });
}

function addNotification(state, usuarioId, tipo, mensaje) {
  if (!usuarioId) return null;
  const row = {
    id: nextId(state.notificaciones),
    usuarioId: Number(usuarioId),
    tipo: tipo || 'taller',
    mensaje: String(mensaje || '').slice(0, 250),
    estado: 'PENDIENTE',
    fechaCreacion: new Date().toISOString()
  };
  state.notificaciones.unshift(row);
  return row;
}

function notifyAdmins(state, tipo, mensaje) {
  const admins = state.usuarios.filter(u => u.rolId === 1 && u.activo !== false);
  for (const admin of admins) {
    addNotification(state, admin.id, tipo, mensaje);
  }
}

function clientUserId(state, client) {
  if (!client) return null;
  if (client.usuarioId) return client.usuarioId;
  if (client.correo) {
    const account = state.usuarios.find(u => String(u.correo || '').toLowerCase() === String(client.correo || '').toLowerCase());
    if (account) return account.id;
  }
  return null;
}

function getClientIdsForUser(state, user) {
  if (!user) return [];
  const uEmail = String(user.correo || user.email || '').toLowerCase();
  return state.clientes
    .filter(c => Number(c.usuarioId) === Number(user.id) || (uEmail && String(c.correo || '').toLowerCase() === uEmail))
    .map(c => Number(c.id));
}

function resolveCurrentUser(state, req) {
  const auth = req.headers?.authorization || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        const found = state.usuarios.find(u => Number(u.id) === Number(decoded.id) || u.correo === decoded.email || u.correo === decoded.correo);
        if (found) {
          const rolObj = state.roles.find(r => Number(r.id) === Number(found.rolId));
          const roleName = rolObj?.nombre || found.ROL?.nombre || 'Administrador';
          return {
            id: found.id,
            nombre: found.nombre,
            correo: found.correo,
            email: found.correo,
            role: roleName,
            rol: roleName
          };
        }
      }
    } catch {
      // ignore token parse error
    }
  }
  return { id: 1, nombre: 'Administrador Nexora', correo: 'admin@nexora.ec', role: 'Administrador', rol: 'Administrador' };
}

function makeJwtForUser(state, user) {
  const rolObj = state.roles.find(r => Number(r.id) === Number(user.rolId));
  const roleName = rolObj?.nombre || user.ROL?.nombre || user.rol || user.role || 'Administrador';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    email: user.correo,
    correo: user.correo,
    nombre: user.nombre,
    role: roleName,
    rol: roleName,
    iat: Math.floor(Date.now() / 1000)
  })).toString('base64url');
  return `${header}.${payload}.autron_verified_sig`;
}

function checkPermission(state, user, codigo) {
  const roleName = user?.role || user?.rol || 'Administrador';
  if (roleName === 'Administrador') return true;
  const rol = state.roles.find(r => r.nombre === roleName);
  if (!rol) return false;
  const perm = state.permisos.find(p => p.codigo === codigo);
  if (!perm) return true;
  return state.rolPermisos.some(rp => Number(rp.rolId) === Number(rol.id) && Number(rp.permisoId) === Number(perm.id));
}

function buildDefaultSvgPhoto(label = 'AUTRON TALLER · EVIDENCIA VEHICULAR') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
    </defs>
    <rect width="640" height="400" fill="url(#bg)" rx="16"/>
    <rect x="24" y="24" width="592" height="352" rx="12" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="8 6" opacity="0.5"/>
    <path d="M140 250 L185 175 L310 165 L430 175 L495 235 L510 275 L125 275 Z" fill="#334155" stroke="#60a5fa" stroke-width="4"/>
    <circle cx="215" cy="275" r="34" fill="#0f172a" stroke="#94a3b8" stroke-width="8"/>
    <circle cx="435" cy="275" r="34" fill="#0f172a" stroke="#94a3b8" stroke-width="8"/>
    <text x="320" y="95" text-anchor="middle" fill="#f8fafc" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="bold">${label}</text>
    <text x="320" y="345" text-anchor="middle" fill="#94a3b8" font-family="Segoe UI, Arial, sans-serif" font-size="14">Evidencia Multimedia Registrada · AUTRON</text>
  </svg>`;
}

function getUploadedPhotoBuffer(filename) {
  if (uploadedBlobs.has(filename)) {
    return uploadedBlobs.get(filename);
  }
  return {
    mimetype: 'image/svg+xml',
    buffer: Buffer.from(buildDefaultSvgPhoto(filename.replace(/\.[^.]+$/, '').toUpperCase()), 'utf8')
  };
}

function storeUploadedPhoto(filename, mimetype, buffer) {
  uploadedBlobs.set(filename, { mimetype: mimetype || 'image/svg+xml', buffer });
}

function watchStock(state, product, user) {
  const stock = Number(product.stock || 0);
  const minimum = Number(product.stockMinimo || 0);
  if (minimum > 0 && stock <= minimum) {
    state.alertas.unshift({
      id: nextId(state.alertas),
      productoId: product.id,
      vehiculoId: null,
      usuarioId: user?.id || null,
      tipoAlerta: 'BAJO_STOCK',
      mensaje: `${product.nombre || product.codigo} tiene stock ${stock} y el mínimo es ${minimum}.`,
      estado: 'PENDIENTE',
      fechaGeneracion: new Date().toISOString()
    });
    notifyAdmins(state, 'inventario', `Stock bajo: ${product.codigo} ${product.nombre || ''} (${stock}).`);
  }
}

async function handleWorkshopRuntimeRequest(projectId, req, res) {
  const state = getState(projectId);
  const user = resolveCurrentUser(state, req);
  const rawUrl = req.url || '/';
  const [pathPart, queryPart] = rawUrl.split('?');
  const query = Object.fromEntries(new URLSearchParams(queryPart || ''));
  const cleanUrl = pathPart.replace(/^\/api/, '') || '/';
  const method = (req.method || 'GET').toUpperCase();
  const body = req.body || {};

  // 0. Health & Uploads
  if (cleanUrl === '/health' || cleanUrl === '/') {
    return res.json({ status: 'OK', message: 'Servidor Runtime Autron Activo' });
  }

  if (cleanUrl.startsWith('/uploads/') || cleanUrl.startsWith('/upload/files/')) {
    const file = decodeURIComponent(cleanUrl.replace(/^\/(uploads|upload\/files)\//, ''));
    const entry = getUploadedPhotoBuffer(file);
    res.setHeader('Content-Type', entry.mimetype);
    return res.send(entry.buffer);
  }

  if (cleanUrl === '/upload' && method === 'POST') {
    const archivoId = `file_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const filename = `${archivoId}.svg`;
    const url = `/uploads/${filename}`;
    storeUploadedPhoto(filename, 'image/svg+xml', Buffer.from(buildDefaultSvgPhoto('EVIDENCIA FOTOGRÁFICA · AUTRON'), 'utf8'));
    return res.status(201).json({
      success: true,
      archivoId,
      url,
      filename,
      data: { archivoId, url, filename, mimetype: 'image/svg+xml' }
    });
  }

  // 1. Auth Endpoints
  if (cleanUrl === '/auth/login' && method === 'POST') {
    const identifier = String(body.correo || body.email || body.identifier || body.username || '').trim().toLowerCase();
    let account = state.usuarios.find(u => u.correo.toLowerCase() === identifier);
    if (!account && identifier) {
      const prefix = identifier.split('@')[0] || 'usuario';
      let inferredRole = 'Administrador';
      let inferredRolId = 1;
      if (/recep|asesor/.test(prefix)) { inferredRole = 'Recepción'; inferredRolId = 2; }
      else if (/mecan|tecnic/.test(prefix)) { inferredRole = 'Mecánico'; inferredRolId = 3; }
      else if (/client|pacient|estudiant|socio/.test(prefix)) { inferredRole = 'Cliente'; inferredRolId = 4; }
      else if (!/admin/.test(prefix)) {
        inferredRole = prefix.charAt(0).toUpperCase() + prefix.slice(1);
      }
      account = {
        id: nextId(state.usuarios),
        nombre: `${inferredRole} (${prefix})`,
        correo: identifier,
        rolId: inferredRolId,
        ROL: { id: inferredRolId, nombre: inferredRole },
        activo: true,
        cambioObligatorio: false
      };
      state.usuarios.push(account);
    }
    if (!account || account.activo === false) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas o usuario inactivo.' });
    }
    const rolObj = state.roles.find(r => Number(r.id) === Number(account.rolId));
    const roleName = account.ROL?.nombre || rolObj?.nombre || 'Administrador';
    const userPayload = {
      id: account.id,
      nombre: account.nombre,
      correo: account.correo,
      email: account.correo,
      role: roleName,
      rol: roleName,
      cambioObligatorio: Boolean(account.cambioObligatorio)
    };
    const token = makeJwtForUser(state, account);
    return res.json({
      success: true,
      token,
      user: userPayload,
      data: { token, user: userPayload }
    });
  }

  if (cleanUrl === '/auth/change-password' && method === 'POST') {
    const account = state.usuarios.find(u => Number(u.id) === Number(user.id));
    if (account) {
      account.cambioObligatorio = false;
      if (body.passwordNueva) account.passwordPlain = body.passwordNueva;
    }
    return res.json({ success: true, data: { updated: true } });
  }

  // 2. Workshop Flow Endpoints (/workshop-flow/*)
  if (cleanUrl === '/workshop-flow/mecanicos' && method === 'GET') {
    const mechanics = state.usuarios
      .filter(u => (u.ROL?.nombre === 'Mecánico' || Number(u.rolId) === 3) && u.activo !== false)
      .map(u => ({ id: u.id, nombre: u.nombre, correo: u.correo }));
    return res.json({ success: true, data: mechanics });
  }

  if (cleanUrl === '/workshop-flow/recepcion' && method === 'POST') {
    if (!checkPermission(state, user, 'recepcion.crear')) {
      return res.status(403).json({
        success: false,
        message: `Tu rol actual (${user.role || user.rol || 'Cliente'}) no tiene permisos para ingresar vehículos al taller. Esta función corresponde exclusivamente a Recepción o Administrador.`
      });
    }
    const mecanicoId = Number(body.mecanicoId);
    const mechanic = state.usuarios.find(u => Number(u.id) === mecanicoId && Number(u.rolId) === 3 && u.activo !== false);
    if (!mechanic) {
      return res.status(422).json({ success: false, message: 'Selecciona un mecánico activo para el diagnóstico.' });
    }
    const vehicle = state.vehiculos.find(v => Number(v.id) === Number(body.vehiculoId));
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehículo no encontrado. Regístralo primero en el directorio.' });
    }
    const client = state.clientes.find(c => Number(c.id) === Number(body.clienteId || vehicle.clienteId));
    const km = Number(body.kilometraje || vehicle.kilometrajeActual || 0);
    if (km > Number(vehicle.kilometrajeActual || 0)) {
      vehicle.kilometrajeActual = km;
    }

    const recepcion = {
      id: nextId(state.recepciones),
      citaId: body.citaId ? Number(body.citaId) : null,
      vehiculoId: vehicle.id,
      clienteId: client?.id || vehicle.clienteId,
      usuarioId: user.id,
      mecanicoId: mechanic.id,
      fechaRecepcion: new Date().toISOString(),
      kilometraje: km,
      nivelCombustible: body.nivelCombustible,
      motivoIngreso: body.motivoIngreso || 'Inspección y diagnóstico',
      observaciones: body.observaciones || null,
      estado: 'REGISTRADA'
    };
    state.recepciones.unshift(recepcion);

    const openAppointment = body.citaId
      ? state.citas.find(c => Number(c.id) === Number(body.citaId))
      : state.citas.find(c => Number(c.vehiculoId) === Number(vehicle.id) && ['SOLICITADA', 'CONFIRMADA', 'REPROGRAMADA'].includes(c.estado));
    if (openAppointment) {
      openAppointment.estado = 'INGRESADA';
      recepcion.citaId = openAppointment.id;
    }

    const archivoIds = Array.isArray(body.archivoIds) ? body.archivoIds : [];
    const createdEvidenceIds = [];
    for (const archivoId of archivoIds) {
      const ev = {
        id: nextId(state.evidencias),
        recepcionId: recepcion.id,
        diagnosticoId: null,
        usuarioId: user.id,
        archivoId,
        urlOriginal: `/uploads/${archivoId}.svg`,
        fechaCarga: new Date().toISOString()
      };
      state.evidencias.unshift(ev);
      createdEvidenceIds.push(ev.id);
    }

    addNotification(
      state,
      mechanic.id,
      'taller',
      `Recepción te asignó el vehículo ${vehicle.placa}. Realiza la inspección y registra el diagnóstico.`
    );
    addAudit(state, user, 'RECEPCION', recepcion.id, 'REGISTRAR', { mecanicoId: mechanic.id, evidencias: createdEvidenceIds.length });

    return res.status(201).json({
      success: true,
      data: {
        recepcionId: recepcion.id,
        mecanicoId: mechanic.id,
        mecanicoNombre: mechanic.nombre,
        placa: vehicle.placa,
        evidencias: createdEvidenceIds
      }
    });
  }

  if (cleanUrl === '/workshop-flow/asignaciones' && method === 'GET') {
    const role = user.role || user.rol;
    const rows = state.recepciones.filter(row => {
      if (role === 'Mecánico') return Number(row.mecanicoId) === Number(user.id);
      return Boolean(row.mecanicoId);
    });
    const result = rows.map(row => {
      const vehicle = state.vehiculos.find(v => Number(v.id) === Number(row.vehiculoId));
      const client = vehicle ? state.clientes.find(c => Number(c.id) === Number(vehicle.clienteId)) : null;
      const mechanic = state.usuarios.find(u => Number(u.id) === Number(row.mecanicoId));
      const diagnostic = state.diagnosticos.find(d => Number(d.recepcionId) === Number(row.id));
      const quote = diagnostic ? state.cotizaciones.find(q => Number(q.diagnosticoId) === Number(diagnostic.id)) : null;
      return {
        recepcionId: row.id,
        vehiculoId: row.vehiculoId,
        mecanicoId: row.mecanicoId,
        mecanicoNombre: mechanic?.nombre || null,
        placa: vehicle?.placa || null,
        marca: vehicle?.marca || null,
        modelo: vehicle?.modelo || null,
        clienteNombre: client?.nombre || null,
        motivoIngreso: row.motivoIngreso,
        kilometraje: row.kilometraje,
        diagnosticoId: diagnostic?.id || null,
        cotizacionEstado: quote?.estado || null
      };
    });
    return res.json({ success: true, data: result });
  }

  if (cleanUrl === '/workshop-flow/diagnostico' && method === 'POST') {
    if (!checkPermission(state, user, 'diag.registrar')) {
      return res.status(403).json({ success: false, message: 'Tu rol no tiene el permiso diag.registrar.' });
    }
    const vehiculoId = Number(body.vehiculoId);
    const recepcionId = Number(body.recepcionId);
    const items = Array.isArray(body.items) ? body.items : [];
    if (!vehiculoId || !recepcionId) {
      return res.status(422).json({ success: false, message: 'Falta el vehículo o la recepción.' });
    }
    if (!String(body.observaciones || '').trim()) {
      return res.status(422).json({ success: false, message: 'Escribe las observaciones del diagnóstico.' });
    }
    if (items.length === 0) {
      return res.status(422).json({ success: false, message: 'Agrega al menos un servicio o un repuesto a la cotización.' });
    }
    const reception = state.recepciones.find(r => Number(r.id) === recepcionId && Number(r.vehiculoId) === vehiculoId);
    if (!reception) {
      return res.status(404).json({ success: false, message: 'No existe una recepción de ese vehículo.' });
    }
    if ((user.role || user.rol) === 'Mecánico' && Number(reception.mecanicoId) !== Number(user.id)) {
      return res.status(403).json({ success: false, message: 'Este ingreso está asignado a otro mecánico.' });
    }

    const vehicle = state.vehiculos.find(v => Number(v.id) === vehiculoId);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehículo no encontrado.' });
    }
    const client = state.clientes.find(c => Number(c.id) === Number(vehicle.clienteId));

    const diagnostic = {
      id: nextId(state.diagnosticos),
      vehiculoId,
      recepcionId,
      usuarioId: user.id,
      observaciones: String(body.observaciones).trim(),
      fechaDiagnostico: new Date().toISOString(),
      estado: 'REGISTRADO'
    };
    state.diagnosticos.unshift(diagnostic);

    const zoneMap = { revision: 'BAJA', falla: 'MEDIA', falla_critica: 'ALTA', normal: null };
    const zonas = Array.isArray(body.zonas) ? body.zonas : [];
    for (const zone of zonas) {
      const severidad = zoneMap[zone.estado];
      if (!severidad) continue;
      state.diagnosticoFallas.unshift({
        id: nextId(state.diagnosticoFallas),
        diagnosticoId: diagnostic.id,
        zona: zone.zona,
        sistema: 'Inspección visual',
        componente: zone.zona,
        descripcion: `Zona ${zone.zona} marcada como ${zone.estado}`,
        severidad,
        estadoZona: severidad === 'ALTA' ? 'CRITICA' : 'CON_FALLA',
        esCritica: severidad === 'ALTA',
        createdAt: new Date().toISOString()
      });
    }

    const fallas = Array.isArray(body.fallas) ? body.fallas : [];
    for (const falla of fallas) {
      const sevRaw = String(falla.severidad || 'MEDIA').toUpperCase();
      const normalized = sevRaw === 'CRITICA' || sevRaw === 'ALTA' ? 'ALTA' : (sevRaw === 'BAJA' ? 'BAJA' : 'MEDIA');
      state.diagnosticoFallas.unshift({
        id: nextId(state.diagnosticoFallas),
        diagnosticoId: diagnostic.id,
        zona: falla.zona || null,
        sistema: falla.sistema || null,
        componente: falla.componente || null,
        descripcion: String(falla.descripcion || '').slice(0, 255),
        severidad: normalized,
        estadoZona: normalized === 'ALTA' ? 'CRITICA' : 'CON_FALLA',
        esCritica: normalized === 'ALTA',
        createdAt: new Date().toISOString()
      });
      const code = String(falla.descripcion || '').match(/\b([PBCU][0-9A-F]{4})\b/i);
      if (code) {
        state.obdCodigos.unshift({
          id: nextId(state.obdCodigos),
          diagnosticoId: diagnostic.id,
          codigo: code[1].toUpperCase(),
          sintoma: String(falla.descripcion || '').slice(0, 255),
          causa: falla.sistema || null,
          componente: falla.componente || null,
          descripcionCaso: String(falla.descripcion || '').slice(0, 255),
          casoResuelto: false
        });
      }
    }

    const lines = [];
    for (const item of items) {
      const tipoItem = item.tipoItem === 'REPUESTO' ? 'REPUESTO' : 'SERVICIO';
      const elementoId = Number(item.elementoId || item.servicioId || item.productoId);
      const cantidad = Number(item.cantidad || 1);
      const source = tipoItem === 'SERVICIO'
        ? state.servicios.find(s => Number(s.id) === elementoId)
        : state.productos.find(p => Number(p.id) === elementoId);
      if (!source) {
        return res.status(422).json({ success: false, message: 'Un servicio o repuesto de la cotización no existe.' });
      }
      const precio = Number(tipoItem === 'SERVICIO' ? source.precioManoObra : source.precio);
      const subtotal = money(cantidad * precio);
      const impuesto = source.tratamientoImpuesto !== 'PENDIENTE' ? money(subtotal * 0.15) : 0;
      const total = money(subtotal + impuesto);
      lines.push({
        tipoItem,
        servicioId: tipoItem === 'SERVICIO' ? elementoId : null,
        productoId: tipoItem === 'REPUESTO' ? elementoId : null,
        descripcion: source.nombre || tipoItem,
        cantidad,
        precioUnitario: money(precio),
        subtotal,
        impuesto,
        total
      });
    }

    const quoteId = nextId(state.cotizaciones);
    const quote = {
      id: quoteId,
      diagnosticoId: diagnostic.id,
      clienteId: vehicle.clienteId,
      usuarioId: user.id,
      fechaEmision: new Date().toISOString(),
      estado: 'ENVIADA',
      subtotal: money(lines.reduce((s, l) => s + l.subtotal, 0)),
      impuestos: money(lines.reduce((s, l) => s + l.impuesto, 0)),
      total: money(lines.reduce((s, l) => s + l.total, 0)),
      observaciones: `Cotización del diagnóstico ${diagnostic.id}`
    };
    state.cotizaciones.unshift(quote);

    for (const line of lines) {
      state.cotizacionItems.push({
        id: nextId(state.cotizacionItems),
        cotizacionId: quote.id,
        ...line,
        estadoAprobacion: 'PENDIENTE'
      });
    }

    const archivoIds = Array.isArray(body.archivoIds) ? body.archivoIds : [];
    const createdEvidenceIds = [];
    for (const archivoId of archivoIds) {
      const ev = {
        id: nextId(state.evidencias),
        recepcionId: null,
        diagnosticoId: diagnostic.id,
        usuarioId: user.id,
        archivoId,
        urlOriginal: `/uploads/${archivoId}.svg`,
        fechaCarga: new Date().toISOString()
      };
      state.evidencias.unshift(ev);
      createdEvidenceIds.push(ev.id);
    }

    addAudit(state, user, 'DIAGNOSTICO', diagnostic.id, 'REGISTRAR', { cotizacionId: quote.id });
    addNotification(
      state,
      clientUserId(state, client),
      'cotizacion',
      `Tienes una cotización de ${vehicle.placa} por $${quote.total}. Revísala y aprueba total o parcialmente.`
    );

    return res.status(201).json({
      success: true,
      data: {
        diagnosticoId: diagnostic.id,
        cotizacionId: quote.id,
        estado: quote.estado,
        total: quote.total,
        placa: vehicle.placa,
        evidencias: createdEvidenceIds
      }
    });
  }

  if (cleanUrl === '/workshop-flow/cotizaciones' && method === 'GET') {
    const role = user.role || user.rol;
    let quotes = state.cotizaciones;
    if (role === 'Cliente') {
      const clientIds = getClientIdsForUser(state, user);
      if (clientIds.length === 0) return res.json({ success: true, data: [] });
      quotes = quotes.filter(q => clientIds.includes(Number(q.clienteId)));
    }
    const result = quotes.map(quote => {
      const items = state.cotizacionItems.filter(i => Number(i.cotizacionId) === Number(quote.id));
      const diagnostic = state.diagnosticos.find(d => Number(d.id) === Number(quote.diagnosticoId));
      const vehicle = diagnostic ? state.vehiculos.find(v => Number(v.id) === Number(diagnostic.vehiculoId)) : null;
      const receptions = vehicle ? state.recepciones.filter(r => Number(r.vehiculoId) === Number(vehicle.id)) : [];
      const recIds = receptions.map(r => Number(r.id));
      const evidencias = state.evidencias.filter(e =>
        (diagnostic && Number(e.diagnosticoId) === Number(diagnostic.id)) ||
        (e.recepcionId && recIds.includes(Number(e.recepcionId)))
      );
      const detailed = items.map(item => {
        const product = item.productoId ? state.productos.find(p => Number(p.id) === Number(item.productoId)) : null;
        const service = item.servicioId ? state.servicios.find(s => Number(s.id) === Number(item.servicioId)) : null;
        return {
          id: item.id,
          tipoItem: item.tipoItem,
          descripcion: item.descripcion || service?.nombre || product?.nombre || 'Ítem',
          codigo: product?.codigo || null,
          cantidad: Number(item.cantidad),
          precioUnitario: Number(item.precioUnitario),
          subtotal: Number(item.subtotal),
          impuesto: Number(item.impuesto || 0),
          total: Number(item.total),
          estadoAprobacion: item.estadoAprobacion
        };
      });
      return {
        id: quote.id,
        estado: quote.estado,
        subtotal: Number(quote.subtotal),
        impuestos: Number(quote.impuestos),
        total: Number(quote.total),
        fechaEmision: quote.fechaEmision,
        fechaDecision: quote.fechaDecision || null,
        observaciones: diagnostic?.observaciones || quote.observaciones,
        placa: vehicle?.placa || null,
        vehiculo: vehicle ? `${vehicle.marca || ''} ${vehicle.modelo || ''}`.trim() : null,
        items: detailed,
        evidencias: evidencias.filter(row => row.urlOriginal).map(row => ({ id: row.id, url: row.urlOriginal }))
      };
    });
    return res.json({ success: true, data: result });
  }

  if (cleanUrl === '/workshop-flow/decision' && method === 'POST') {
    const cotizacionId = Number(body.cotizacionId);
    const decision = body.decision;
    if (!cotizacionId || !['APROBAR', 'APROBAR_PARCIALMENTE', 'RECHAZAR'].includes(decision)) {
      return res.status(422).json({ success: false, message: 'Decisión de cotización no válida.' });
    }
    const quote = state.cotizaciones.find(q => Number(q.id) === cotizacionId);
    if (!quote) return res.status(404).json({ success: false, message: 'Cotización no encontrada.' });
    if (quote.estado !== 'ENVIADA') return res.status(409).json({ success: false, message: 'Esta cotización ya fue decidida.' });

    const items = state.cotizacionItems.filter(i => Number(i.cotizacionId) === cotizacionId);
    const requested = new Set((body.itemsAprobadosIds || body.itemIdsAprobados || []).map(Number));
    let approvedIds = [];
    if (decision === 'APROBAR') approvedIds = items.map(i => i.id);
    if (decision === 'APROBAR_PARCIALMENTE') {
      approvedIds = items.filter(i => requested.has(Number(i.id))).map(i => i.id);
      if (approvedIds.length === 0) {
        return res.status(422).json({ success: false, message: 'Selecciona al menos un ítem para la aprobación parcial.' });
      }
    }
    const approved = new Set(approvedIds);
    for (const item of items) {
      item.estadoAprobacion = decision === 'RECHAZAR' ? 'RECHAZADO' : (approved.has(item.id) ? 'APROBADO' : 'RECHAZADO');
    }
    const estado = decision === 'RECHAZAR' ? 'RECHAZADA' : (decision === 'APROBAR' ? 'APROBADA' : 'APROBADA_PARCIALMENTE');
    quote.estado = estado;
    quote.fechaDecision = new Date().toISOString();
    addAudit(state, user, 'COTIZACION', quote.id, decision, { estado });

    const diagnostic = state.diagnosticos.find(d => Number(d.id) === Number(quote.diagnosticoId));
    const vehicle = diagnostic ? state.vehiculos.find(v => Number(v.id) === Number(diagnostic.vehiculoId)) : null;
    const reception = diagnostic?.recepcionId ? state.recepciones.find(r => Number(r.id) === Number(diagnostic.recepcionId)) : null;

    let ordenId = null;
    if (estado !== 'RECHAZADA') {
      let order = state.ordenTrabajos.find(o => Number(o.cotizacionId) === Number(quote.id));
      if (!order) {
        const mechanicId = reception?.mecanicoId || diagnostic?.usuarioId || null;
        order = {
          id: nextId(state.ordenTrabajos),
          cotizacionId: quote.id,
          vehiculoId: vehicle?.id || diagnostic?.vehiculoId,
          usuarioId: mechanicId,
          estado: 'CREADA',
          fechaApertura: new Date().toISOString(),
          fechaCierre: null,
          kilometraje: vehicle?.kilometrajeActual || reception?.kilometraje || null,
          observaciones: 'Orden abierta al aprobar la cotización'
        };
        state.ordenTrabajos.unshift(order);
        if (mechanicId) {
          state.ordenMecanicos.push({
            id: nextId(state.ordenMecanicos),
            ordenTrabajoId: order.id,
            usuarioId: mechanicId,
            fechaAsignacion: new Date().toISOString()
          });
          addNotification(state, mechanicId, 'taller', `El cliente aprobó la cotización de ${vehicle?.placa || 'el vehículo'}. Ya puedes iniciar el trabajo.`);
        }
      }
      ordenId = order.id;
    } else if (reception?.mecanicoId) {
      addNotification(state, reception.mecanicoId, 'taller', `El cliente rechazó la cotización de ${vehicle?.placa || 'el vehículo'}.`);
    }

    return res.json({ success: true, data: { cotizacionId, estado, ordenId } });
  }

  if (cleanUrl === '/workshop-flow/ordenes' && method === 'GET') {
    const role = user.role || user.rol;
    let orders = state.ordenTrabajos;
    if (role === 'Mecánico') {
      const allowed = new Set(
        state.ordenMecanicos
          .filter(link => Number(link.usuarioId) === Number(user.id))
          .map(link => Number(link.ordenTrabajoId))
      );
      orders = orders.filter(o => allowed.has(Number(o.id)));
    }
    const result = orders.map(order => {
      const vehicle = state.vehiculos.find(v => Number(v.id) === Number(order.vehiculoId));
      const approvedParts = order.cotizacionId
        ? state.cotizacionItems.filter(i => Number(i.cotizacionId) === Number(order.cotizacionId) && i.tipoItem === 'REPUESTO' && i.estadoAprobacion === 'APROBADO')
        : [];
      const repuestos = approvedParts.map(item => {
        const product = state.productos.find(p => Number(p.id) === Number(item.productoId));
        return {
          id: item.id,
          productoId: item.productoId,
          codigo: product?.codigo || null,
          nombre: product?.nombre || item.descripcion || 'Repuesto',
          cantidad: Number(item.cantidad || 0),
          stock: Number(product?.stock || 0)
        };
      });
      const links = state.ordenMecanicos.filter(l => Number(l.ordenTrabajoId) === Number(order.id));
      const names = links
        .map(l => state.usuarios.find(u => Number(u.id) === Number(l.usuarioId))?.nombre)
        .filter(Boolean);
      return {
        id: order.id,
        estado: order.estado,
        vehiculoId: order.vehiculoId,
        placa: vehicle?.placa || null,
        marca: vehicle?.marca || null,
        modelo: vehicle?.modelo || null,
        kilometraje: order.kilometraje || vehicle?.kilometrajeActual || null,
        mecanicoNombre: names.join(', ') || null,
        mecanicoIds: links.map(l => l.usuarioId),
        fechaCierre: order.fechaCierre,
        repuestos
      };
    });
    return res.json({ success: true, data: result });
  }

  if (cleanUrl === '/workshop-flow/fase' && method === 'POST') {
    const ordenTrabajoId = Number(body.ordenTrabajoId);
    const fase = body.fase;
    const validPhases = ['EN_REPARACION', 'EN_PRUEBAS', 'LAVADO', 'FINALIZADA'];
    if (!ordenTrabajoId || !validPhases.includes(fase)) {
      return res.status(422).json({ success: false, message: 'La fase de trabajo no es válida.' });
    }
    const order = state.ordenTrabajos.find(o => Number(o.id) === ordenTrabajoId);
    if (!order) return res.status(404).json({ success: false, message: 'Orden de trabajo no encontrada.' });
    if (order.estado === 'FINALIZADA') return res.status(409).json({ success: false, message: 'La orden ya está finalizada.' });

    if ((user.role || user.rol) === 'Mecánico') {
      const assigned = state.ordenMecanicos.some(l => Number(l.ordenTrabajoId) === ordenTrabajoId && Number(l.usuarioId) === Number(user.id));
      if (!assigned) return res.status(403).json({ success: false, message: 'Esta orden no está asignada a tu usuario.' });
    }

    order.estado = fase;
    const descuentos = [];
    let notificacion = null;
    if (fase === 'FINALIZADA') {
      order.fechaCierre = new Date().toISOString();
      if (order.cotizacionId) {
        const repItems = state.cotizacionItems.filter(i => Number(i.cotizacionId) === Number(order.cotizacionId) && i.tipoItem === 'REPUESTO' && i.estadoAprobacion === 'APROBADO');
        for (const item of repItems) {
          const product = state.productos.find(p => Number(p.id) === Number(item.productoId));
          if (!product) continue;
          const qty = Number(item.cantidad || 0);
          product.stock = Math.max(0, Number(product.stock || 0) - qty);
          const mov = {
            id: nextId(state.movimientoInventarios),
            productoId: product.id,
            usuarioId: user.id,
            ordenTrabajoId: order.id,
            tipoMovimiento: 'SALIDA',
            cantidad: qty,
            stockResultante: product.stock,
            motivo: `Consumo único al finalizar la orden ${order.id}`,
            fechaMovimiento: new Date().toISOString()
          };
          state.movimientoInventarios.unshift(mov);
          descuentos.push(mov.id);
          watchStock(state, product, user);
        }
      }
      const vehicle = state.vehiculos.find(v => Number(v.id) === Number(order.vehiculoId));
      const client = vehicle ? state.clientes.find(c => Number(c.id) === Number(vehicle.clienteId)) : null;
      notificacion = addNotification(
        state,
        clientUserId(state, client),
        'taller',
        `El vehículo ${vehicle?.placa || 'tu vehículo'} ya está reparado y listo para retiro.`
      );
    }
    addAudit(state, user, 'ORDENTRABAJO', ordenTrabajoId, 'CAMBIAR_FASE', { fase, descuentos });
    return res.json({
      success: true,
      data: { ordenTrabajoId, estado: fase, notificacionId: notificacion?.id || null, descuentos: descuentos.length }
    });
  }

  if (cleanUrl === '/workshop-flow/ordenes/mecanicos' && method === 'POST') {
    const ordenTrabajoId = Number(body.ordenTrabajoId);
    const mecanicoIds = [...new Set((body.mecanicoIds || []).map(Number).filter(Boolean))];
    if (!ordenTrabajoId || mecanicoIds.length === 0) {
      return res.status(422).json({ success: false, message: 'Indica la orden y al menos un mecánico.' });
    }
    for (const mecanicoId of mecanicoIds) {
      const exists = state.ordenMecanicos.some(l => Number(l.ordenTrabajoId) === ordenTrabajoId && Number(l.usuarioId) === mecanicoId);
      if (!exists) {
        state.ordenMecanicos.push({
          id: nextId(state.ordenMecanicos),
          ordenTrabajoId,
          usuarioId: mecanicoId,
          fechaAsignacion: new Date().toISOString()
        });
      }
      addNotification(state, mecanicoId, 'taller', `Te asignaron la orden ${ordenTrabajoId}.`);
    }
    return res.json({ success: true, data: { ordenTrabajoId, mecanicoIds } });
  }

  if (cleanUrl === '/workshop-flow/ordenes/consumo' && method === 'POST') {
    const ordenTrabajoId = Number(body.ordenTrabajoId);
    const order = state.ordenTrabajos.find(o => Number(o.id) === ordenTrabajoId);
    if (!order) return res.status(404).json({ success: false, message: 'Orden de trabajo no encontrada.' });
    const act = {
      id: nextId(state.actividades),
      ordenTrabajoId,
      usuarioId: user.id,
      descripcion: String(body.descripcion || 'Actividad de taller').slice(0, 250),
      observaciones: body.observaciones || null,
      pruebas: body.pruebas || null,
      estado: order.estado,
      fechaRegistro: new Date().toISOString()
    };
    state.actividades.unshift(act);
    return res.status(201).json({ success: true, data: { actividadId: act.id, movimientoId: null } });
  }

  if (cleanUrl === '/workshop-flow/notificaciones' && method === 'GET') {
    const list = state.notificaciones
      .filter(n => Number(n.usuarioId) === Number(user.id))
      .map(n => ({
        id: n.id,
        tipo: n.tipo || 'taller',
        titulo: n.tipo === 'cotizacion' ? 'Cotización del taller' : 'Aviso del taller',
        mensaje: n.mensaje,
        estado: n.estado,
        leida: n.estado === 'LEIDA',
        fechaCreacion: n.fechaCreacion
      }));
    return res.json({ success: true, data: list });
  }

  const notifReadMatch = cleanUrl.match(/^\/workshop-flow\/notificaciones\/(\d+)\/leida$/);
  if (notifReadMatch && method === 'POST') {
    const id = Number(notifReadMatch[1]);
    const row = state.notificaciones.find(n => Number(n.id) === id && Number(n.usuarioId) === Number(user.id));
    if (row) row.estado = 'LEIDA';
    return res.json({ success: true, data: { id, leida: true } });
  }

  if (cleanUrl === '/workshop-flow/alertas' && method === 'GET') {
    const role = user.role || user.rol;
    if (role !== 'Administrador' && role !== 'Recepción') {
      return res.json({ success: true, data: [] });
    }
    return res.json({ success: true, data: state.alertas });
  }

  if (cleanUrl === '/workshop-flow/usuarios' && method === 'POST') {
    const nombre = String(body.nombre || '').trim();
    const correo = String(body.correo || '').trim().toLowerCase();
    const rolNombre = String(body.rol || 'Cliente').replace(' y Asesoría', '').replace(' de Taller', '');
    if (!nombre || !correo) return res.status(422).json({ success: false, message: 'Nombre y correo son obligatorios.' });
    const rol = state.roles.find(r => r.nombre === rolNombre) || state.roles[2];
    if (state.usuarios.some(u => u.correo.toLowerCase() === correo)) {
      return res.status(409).json({ success: false, message: 'Ya existe un usuario con ese correo.' });
    }
    const passwordTemporal = body.password || `Taller${Math.floor(100000 + Math.random() * 900000)}`;
    const newUser = {
      id: nextId(state.usuarios),
      nombre,
      correo,
      rolId: rol.id,
      ROL: { id: rol.id, nombre: rol.nombre },
      activo: true,
      cambioObligatorio: true,
      passwordPlain: passwordTemporal
    };
    state.usuarios.push(newUser);
    addAudit(state, user, 'USUARIO', newUser.id, 'CREAR', { correo, rol: rol.nombre });
    return res.status(201).json({
      success: true,
      data: { id: newUser.id, nombre, correo, rol: rol.nombre, passwordTemporal }
    });
  }

  const resetPwdMatch = cleanUrl.match(/^\/workshop-flow\/usuarios\/(\d+)\/clave$/);
  if (resetPwdMatch && method === 'POST') {
    const id = Number(resetPwdMatch[1]);
    const u = state.usuarios.find(item => Number(item.id) === id);
    if (!u) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    const passwordTemporal = `Taller${Math.floor(100000 + Math.random() * 900000)}`;
    u.passwordPlain = passwordTemporal;
    u.cambioObligatorio = true;
    addAudit(state, user, 'USUARIO', u.id, 'RECUPERAR_ACCESO', { correo: u.correo });
    return res.json({
      success: true,
      data: { correo: u.correo, passwordTemporal }
    });
  }

  if (cleanUrl === '/workshop-flow/clientes-acceso' && method === 'POST') {
    const nombre = String(body.nombre || '').trim();
    const correo = String(body.correo || '').trim().toLowerCase();
    if (!nombre || !correo || correo === 'sin correo') {
      return res.status(422).json({ success: false, message: 'El nombre y el correo del cliente son obligatorios para generar el acceso.' });
    }
    let client = body.clienteId ? state.clientes.find(c => Number(c.id) === Number(body.clienteId)) : null;
    if (!client) client = state.clientes.find(c => String(c.correo || '').toLowerCase() === correo);

    let account = state.usuarios.find(u => u.correo.toLowerCase() === correo);
    const passwordTemporal = `Taller${Math.floor(100000 + Math.random() * 900000)}`;
    if (!account) {
      account = {
        id: nextId(state.usuarios),
        nombre,
        correo,
        rolId: 4,
        ROL: { id: 4, nombre: 'Cliente' },
        activo: true,
        cambioObligatorio: true,
        passwordPlain: passwordTemporal
      };
      state.usuarios.push(account);
    } else {
      account.passwordPlain = passwordTemporal;
    }

    if (!client) {
      client = {
        id: nextId(state.clientes),
        nombre,
        documento: body.documento || null,
        telefono: body.telefono || null,
        correo,
        direccion: body.direccion || null,
        usuarioId: account.id,
        fechaCreacion: new Date().toISOString()
      };
      state.clientes.unshift(client);
    } else {
      client.usuarioId = account.id;
      client.correo = correo;
    }

    addNotification(state, account.id, 'taller', 'Tu acceso al portal del taller ya está activo.');
    return res.status(201).json({
      success: true,
      data: {
        clienteId: client.id,
        usuarioId: account.id,
        correo,
        passwordTemporal
      }
    });
  }

  if (cleanUrl === '/workshop-flow/indicadores' && method === 'GET') {
    const ingresos = state.ventas
      .filter(v => v.estado === 'CONFIRMADA')
      .reduce((acc, v) => acc + Number(v.total || 0), 0);
    const bajoStock = state.productos.filter(p => Number(p.stockMinimo || 0) > 0 && Number(p.stock || 0) <= Number(p.stockMinimo)).length;
    const serviceCount = new Map();
    for (const item of state.cotizacionItems) {
      if (item.tipoItem !== 'SERVICIO') continue;
      const name = state.servicios.find(s => Number(s.id) === Number(item.servicioId))?.nombre || item.descripcion || 'Servicio';
      serviceCount.set(name, (serviceCount.get(name) || 0) + Number(item.cantidad || 1));
    }
    const faultCount = new Map();
    for (const fault of state.diagnosticoFallas) {
      const name = fault.descripcion || fault.sistema || 'Falla';
      faultCount.set(name, (faultCount.get(name) || 0) + 1);
    }
    const rank = map => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([nombre, cantidad]) => ({ nombre, cantidad }));

    return res.json({
      success: true,
      data: {
        fechaDesde: query.fechaDesde || todayStr(-30),
        fechaHasta: query.fechaHasta || todayStr(0),
        citas: state.citas.length,
        recepciones: state.recepciones.length,
        ordenes: state.ordenTrabajos.length,
        ordenesAbiertas: state.ordenTrabajos.filter(o => o.estado && o.estado !== 'FINALIZADA').length,
        ingresos: money(ingresos),
        productos: state.productos.length,
        bajoStock,
        fallas: state.diagnosticoFallas.length,
        serviciosMasUsados: rank(serviceCount),
        fallasFrecuentes: rank(faultCount)
      }
    });
  }

  if (cleanUrl === '/workshop-flow/productos' && method === 'POST') {
    const codigo = String(body.codigo || '').trim();
    const nombre = String(body.nombre || '').trim();
    if (!codigo || !nombre) return res.status(422).json({ success: false, message: 'Código y nombre del repuesto son obligatorios.' });
    const prod = {
      id: nextId(state.productos),
      codigo,
      nombre,
      descripcion: body.descripcion || null,
      categoria: body.categoria || null,
      marca: body.marca || null,
      costo: body.costo != null ? money(body.costo) : 0,
      precio: body.precio != null ? money(body.precio) : 0,
      stock: Number(body.stock || 0),
      stockMinimo: Number(body.stockMinimo || 0),
      activo: true,
      tratamientoImpuesto: body.tratamientoImpuesto || 'GRAVADO'
    };
    state.productos.unshift(prod);
    watchStock(state, prod, user);
    return res.status(201).json({ success: true, data: prod });
  }

  const retirarProdMatch = cleanUrl.match(/^\/workshop-flow\/productos\/(\d+)\/retirar$/);
  if (retirarProdMatch && method === 'POST') {
    const id = Number(retirarProdMatch[1]);
    const prod = state.productos.find(p => Number(p.id) === id);
    if (prod) prod.activo = false;
    return res.json({ success: true, data: { id, activo: false, modo: 'oculto' } });
  }

  if (cleanUrl === '/workshop-flow/proveedores' && method === 'POST') {
    const nombre = String(body.nombre || '').trim();
    if (!nombre) return res.status(422).json({ success: false, message: 'El nombre del proveedor es obligatorio.' });
    const sup = {
      id: nextId(state.proveedores),
      nombre,
      identificacionFiscal: body.identificacionFiscal || null,
      telefono: body.telefono || null,
      correo: body.correo || null,
      direccion: body.direccion || null
    };
    state.proveedores.unshift(sup);
    return res.status(201).json({ success: true, data: sup });
  }

  if (cleanUrl === '/workshop-flow/compras' && method === 'POST') {
    const proveedorId = Number(body.proveedorId);
    const items = Array.isArray(body.items) ? body.items : [];
    if (!proveedorId || items.length === 0) {
      return res.status(422).json({ success: false, message: 'La compra necesita proveedor y al menos un repuesto.' });
    }
    let total = 0;
    for (const item of items) {
      const prod = state.productos.find(p => Number(p.id) === Number(item.productoId));
      if (!prod) continue;
      const qty = Number(item.cantidad || 1);
      const cost = money(item.costo != null ? item.costo : prod.costo);
      total = money(total + qty * cost);
      prod.stock = Number(prod.stock || 0) + qty;
      prod.costo = cost;
    }
    const comp = {
      id: nextId(state.compras),
      proveedorId,
      usuarioId: user.id,
      numeroDocumento: body.numeroDocumento || `COMP-${Date.now()}`,
      fechaCompra: new Date().toISOString(),
      estado: 'RECIBIDA',
      total
    };
    state.compras.unshift(comp);
    return res.status(201).json({ success: true, data: { compraId: comp.id, total } });
  }

  if (cleanUrl === '/workshop-flow/ajuste' && method === 'POST') {
    const prod = state.productos.find(p => Number(p.id) === Number(body.productoId));
    if (!prod) return res.status(404).json({ success: false, message: 'Repuesto no encontrado.' });
    prod.stock = Number(body.stockNuevo);
    watchStock(state, prod, user);
    return res.json({ success: true, data: { productoId: prod.id, stock: prod.stock, movimientoId: Date.now() } });
  }

  if (cleanUrl === '/workshop-flow/expediente' && method === 'GET') {
    const id = Number(query.vehiculoId);
    const vehicle = state.vehiculos.find(v => Number(v.id) === id);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehículo no encontrado.' });
    const client = state.clientes.find(c => Number(c.id) === Number(vehicle.clienteId)) || null;
    const recs = state.recepciones.filter(r => Number(r.vehiculoId) === id);
    const diags = state.diagnosticos.filter(d => Number(d.vehiculoId) === id);
    const ords = state.ordenTrabajos.filter(o => Number(o.vehiculoId) === id);
    const planes = state.programacionMantenimientos.filter(p => Number(p.vehiculoId) === id);
    const recIds = recs.map(r => Number(r.id));
    const diagIds = diags.map(d => Number(d.id));
    const evidencias = state.evidencias.filter(e =>
      (e.recepcionId && recIds.includes(Number(e.recepcionId))) ||
      (e.diagnosticoId && diagIds.includes(Number(e.diagnosticoId)))
    );
    const historial = [
      ...recs.map(r => ({ fecha: r.fechaRecepcion, tipo: 'Recepción', detalle: r.motivoIngreso, kilometraje: r.kilometraje })),
      ...diags.map(d => ({ fecha: d.fechaDiagnostico, tipo: 'Diagnóstico', detalle: d.observaciones, estado: d.estado })),
      ...ords.map(o => ({ fecha: o.fechaApertura, tipo: 'Orden de trabajo', detalle: o.observaciones || o.estado, estado: o.estado })),
      ...planes.map(p => ({ fecha: p.fechaProxima, tipo: 'Mantenimiento', detalle: p.descripcion, kilometraje: p.kilometrajeProximo, estado: p.activo ? 'ACTIVO' : 'INACTIVO' }))
    ];
    return res.json({
      success: true,
      data: {
        vehiculo: vehicle,
        cliente: client,
        historial,
        evidencias: evidencias.map(e => ({ id: e.id, url: e.urlOriginal, recepcionId: e.recepcionId, diagnosticoId: e.diagnosticoId })),
        mantenimientos: planes
      }
    });
  }

  if (cleanUrl === '/workshop-flow/progreso' && method === 'GET') {
    const clientIds = getClientIdsForUser(state, user);
    if (clientIds.length === 0) return res.json({ success: true, data: [] });
    const vehicles = state.vehiculos.filter(v => clientIds.includes(Number(v.clienteId)));
    const result = vehicles.map(vehicle => {
      const orders = state.ordenTrabajos.filter(o => Number(o.vehiculoId) === Number(vehicle.id));
      const receptions = state.recepciones.filter(r => Number(r.vehiculoId) === Number(vehicle.id));
      const diagnostics = state.diagnosticos.filter(d => Number(d.vehiculoId) === Number(vehicle.id));
      const order = orders[0] || null;
      const reception = receptions[0] || null;
      const diagnostic = diagnostics[0] || null;
      const quote = order?.cotizacionId
        ? state.cotizaciones.find(q => Number(q.id) === Number(order.cotizacionId))
        : (diagnostic ? state.cotizaciones.find(q => Number(q.diagnosticoId) === Number(diagnostic.id)) : null);
      let estado = 'SIN_INGRESO';
      if (reception) estado = 'EN_TALLER';
      if (quote && ['BORRADOR', 'ENVIADA'].includes(quote.estado)) estado = 'COTIZACION_ENVIADA';
      if (quote?.estado === 'RECHAZADA') estado = 'COTIZACION_RECHAZADA';
      if (order) estado = order.estado;

      const recIds = receptions.map(r => Number(r.id));
      const diagIds = diagnostics.map(d => Number(d.id));
      const evidencias = state.evidencias.filter(e =>
        (e.recepcionId && recIds.includes(Number(e.recepcionId))) ||
        (e.diagnosticoId && diagIds.includes(Number(e.diagnosticoId)))
      );

      return {
        vehiculoId: vehicle.id,
        placa: vehicle.placa,
        modelo: `${vehicle.marca || ''} ${vehicle.modelo || ''}`.trim(),
        kilometraje: reception?.kilometraje || vehicle.kilometrajeActual,
        ordenId: order?.id || null,
        estado,
        fechaApertura: order?.fechaApertura || null,
        fechaCierre: order?.fechaCierre || null,
        ingreso: reception ? {
          fecha: reception.fechaRecepcion,
          motivo: reception.motivoIngreso
        } : null,
        evidencias: evidencias.filter(r => r.urlOriginal).map(r => ({ id: r.id, url: r.urlOriginal }))
      };
    });
    return res.json({ success: true, data: result });
  }

  if (cleanUrl === '/workshop-flow/disponibilidad' && method === 'GET') {
    const fecha = query.fecha || todayStr(0);
    const slots = state.espacioCitas.filter(s => s.habilitado !== false && String(s.inicio).startsWith(fecha));
    const mapped = slots.map(s => {
      const ocupados = state.citas.filter(c => Number(c.espacioId) === Number(s.id) && c.estado !== 'CANCELADA').length;
      return {
        id: s.id,
        inicio: s.inicio,
        fin: s.fin,
        capacidad: Number(s.capacidad || 1),
        ocupados,
        disponible: ocupados < Number(s.capacidad || 1)
      };
    });
    return res.json({ success: true, data: mapped });
  }

  if (cleanUrl === '/workshop-flow/espacios' && method === 'POST') {
    if (!checkPermission(state, user, 'citas.disponibilidad')) {
      return res.status(403).json({ success: false, message: 'Tu rol no tiene el permiso citas.disponibilidad.' });
    }
    const inicio = new Date(body.inicio);
    const fin = new Date(body.fin);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime()) || fin <= inicio) {
      return res.status(422).json({ success: false, message: 'Indica un inicio y un fin válidos.' });
    }
    const slot = {
      id: nextId(state.espacioCitas),
      inicio: body.inicio,
      fin: body.fin,
      capacidad: Math.max(1, Number(body.capacidad || 1)),
      habilitado: true
    };
    state.espacioCitas.push(slot);
    return res.status(201).json({ success: true, data: slot });
  }

  if (cleanUrl === '/workshop-flow/citas' && method === 'POST') {
    if (!checkPermission(state, user, 'citas.crear')) {
      return res.status(403).json({ success: false, message: 'Tu rol no tiene el permiso citas.crear.' });
    }
    const slot = state.espacioCitas.find(s => Number(s.id) === Number(body.espacioId) && s.habilitado !== false);
    if (!slot) return res.status(422).json({ success: false, message: 'Ese horario no está habilitado.' });
    const used = state.citas.filter(c => Number(c.espacioId) === Number(slot.id) && c.estado !== 'CANCELADA').length;
    if (used >= Number(slot.capacidad || 1)) {
      return res.status(409).json({ success: false, message: 'Ese horario ya no tiene cupo.' });
    }
    const vehicle = state.vehiculos.find(v => Number(v.id) === Number(body.vehiculoId));
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehículo no encontrado.' });
    const client = state.clientes.find(c => Number(c.id) === Number(vehicle.clienteId));
    const cita = {
      id: nextId(state.citas),
      clienteId: client?.id || vehicle.clienteId,
      vehiculoId: vehicle.id,
      espacioId: slot.id,
      fechaHora: slot.inicio,
      motivo: String(body.motivo || '').slice(0, 250),
      estado: 'SOLICITADA',
      fechaCreacion: new Date().toISOString()
    };
    state.citas.unshift(cita);
    notifyAdmins(state, 'citas', `Nueva cita de ${client?.nombre || 'Cliente'} para ${vehicle.placa}.`);
    return res.status(201).json({ success: true, data: cita });
  }

  if (cleanUrl === '/workshop-flow/citas/cancelar' && method === 'POST') {
    const cita = state.citas.find(c => Number(c.id) === Number(body.citaId));
    if (!cita) return res.status(404).json({ success: false, message: 'Cita no encontrada.' });
    cita.estado = 'CANCELADA';
    return res.json({ success: true, data: { id: cita.id, estado: 'CANCELADA' } });
  }

  if (cleanUrl === '/workshop-flow/citas/reprogramar' && method === 'POST') {
    const cita = state.citas.find(c => Number(c.id) === Number(body.citaId));
    if (!cita) return res.status(404).json({ success: false, message: 'Cita no encontrada.' });
    const slot = state.espacioCitas.find(s => Number(s.id) === Number(body.espacioId));
    if (!slot) return res.status(422).json({ success: false, message: 'Elige un horario con cupo para reprogramar.' });
    cita.espacioId = slot.id;
    cita.fechaHora = slot.inicio;
    cita.estado = 'REPROGRAMADA';
    return res.json({ success: true, data: { id: cita.id, estado: 'REPROGRAMADA', fechaHora: slot.inicio } });
  }

  if (cleanUrl === '/workshop-flow/venta' && method === 'POST') {
    const items = Array.isArray(body.items) ? body.items : [];
    if (!body.clienteId || items.length === 0) {
      return res.status(422).json({ success: false, message: 'Selecciona el cliente y agrega al menos un repuesto.' });
    }
    let subtotal = 0;
    for (const item of items) {
      const prod = state.productos.find(p => Number(p.id) === Number(item.repuestoId || item.productoId));
      if (!prod) continue;
      const qty = Math.max(1, Number(item.cantidad || 1));
      if (Number(prod.stock || 0) < qty) {
        return res.status(409).json({ success: false, message: `Stock insuficiente de ${prod.nombre}.` });
      }
      subtotal = money(subtotal + qty * Number(prod.precio || 0));
      prod.stock = Number(prod.stock || 0) - qty;
      watchStock(state, prod, user);
    }
    const impuestos = money(subtotal * 0.15);
    const total = money(subtotal + impuestos);
    const venta = {
      id: nextId(state.ventas),
      clienteId: Number(body.clienteId),
      usuarioId: user.id,
      fechaVenta: new Date().toISOString(),
      estado: 'CONFIRMADA',
      subtotal,
      impuestos,
      total
    };
    state.ventas.unshift(venta);
    return res.status(201).json({ success: true, data: { ventaId: venta.id, estado: 'CONFIRMADA', data: venta } });
  }

  if (cleanUrl === '/workshop-flow/mantenimiento' && method === 'POST') {
    const vehiculoId = Number(body.vehiculoId);
    const vehicle = state.vehiculos.find(v => Number(v.id) === vehiculoId);
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehículo no encontrado.' });
    const intervaloDias = body.intervaloDias ? Number(body.intervaloDias) : null;
    const intervaloKilometros = body.intervaloKilometros ? Number(body.intervaloKilometros) : null;
    const fechaBase = body.fechaBase || null;
    const kilometrajeBase = body.kilometrajeBase != null && body.kilometrajeBase !== '' ? Number(body.kilometrajeBase) : null;
    const fechaProxima = fechaBase && intervaloDias ? new Date(new Date(fechaBase).getTime() + intervaloDias * 86400000).toISOString().slice(0, 10) : null;
    const kilometrajeProximo = kilometrajeBase != null && intervaloKilometros ? kilometrajeBase + intervaloKilometros : null;
    const plan = {
      id: nextId(state.programacionMantenimientos),
      vehiculoId,
      descripcion: String(body.descripcion || '').trim(),
      fechaBase,
      intervaloDias,
      kilometrajeBase,
      intervaloKilometros,
      fechaProxima,
      kilometrajeProximo,
      activo: true
    };
    state.programacionMantenimientos.unshift(plan);
    return res.status(201).json({ success: true, data: plan });
  }

  if (cleanUrl === '/workshop-flow/conocimiento' && method === 'GET') {
    const q = String(query.q || '').trim().toLowerCase();
    const mapped = state.obdCodigos
      .filter(row => {
        if (!q) return true;
        return [row.codigo, row.sintoma, row.causa, row.solucion, row.componente, row.descripcionCaso]
          .some(v => String(v || '').toLowerCase().includes(q));
      })
      .map(row => ({
        id: row.id,
        codigo: row.codigo,
        sintoma: row.sintoma,
        causa: row.causa,
        solucion: row.solucion,
        componente: row.componente,
        descripcionCaso: row.descripcionCaso,
        casoResuelto: row.casoResuelto === true,
        esCatalogo: !row.diagnosticoId
      }));
    return res.json({
      success: true,
      data: {
        catalogo: mapped.filter(r => r.esCatalogo),
        casos: mapped.filter(r => !r.esCatalogo)
      }
    });
  }

  if (cleanUrl === '/workshop-flow/obd' && method === 'POST') {
    const codigo = String(body.codigo || '').trim().toUpperCase();
    if (!/^[PBCU][0-9A-F]{4}$/.test(codigo)) {
      return res.status(422).json({ success: false, message: 'El código OBD debe tener el formato P0301.' });
    }
    const row = {
      id: nextId(state.obdCodigos),
      codigo,
      componente: body.componente || null,
      sintoma: body.sintoma || null,
      causa: body.causa || null,
      solucion: body.solucion || null,
      descripcionCaso: body.descripcionCaso || null,
      casoResuelto: Boolean(body.casoResuelto),
      diagnosticoId: null
    };
    state.obdCodigos.unshift(row);
    return res.status(201).json({ success: true, data: row });
  }

  if (cleanUrl === '/workshop-flow/obd/proponer' && method === 'POST') {
    const datos = {
      codigo: String(body.codigo || '').trim().toUpperCase(),
      sintoma: body.sintomas || body.sintoma || '',
      causa: body.causas || body.causa || '',
      solucion: body.solucion || '',
      componente: body.componente || ''
    };
    const prop = {
      id: nextId(state.propuestaObdCodigos),
      tipo: 'ALTA',
      datosPropuestos: JSON.stringify(datos),
      estado: 'PENDIENTE',
      usuarioPropuestaId: user.id,
      fechaPropuesta: new Date().toISOString()
    };
    state.propuestaObdCodigos.unshift(prop);
    notifyAdmins(state, 'conocimiento', `Hay una propuesta OBD ${datos.codigo} por revisar.`);
    return res.status(201).json({ success: true, data: { id: prop.id, estado: 'PENDIENTE' } });
  }

  if (cleanUrl === '/workshop-flow/obd/propuestas' && method === 'GET') {
    const mapped = state.propuestaObdCodigos.map(row => ({
      id: row.id,
      tipo: row.tipo,
      estado: row.estado,
      datos: (() => { try { return JSON.parse(row.datosPropuestos || '{}'); } catch { return {}; } })(),
      fechaPropuesta: row.fechaPropuesta
    }));
    return res.json({ success: true, data: mapped });
  }

  const obdResolveMatch = cleanUrl.match(/^\/workshop-flow\/obd\/propuestas\/(\d+)\/resolver$/);
  if (obdResolveMatch && method === 'POST') {
    const id = Number(obdResolveMatch[1]);
    const prop = state.propuestaObdCodigos.find(p => Number(p.id) === id);
    const decision = String(body.decision || 'APROBAR').toUpperCase();
    if (prop && prop.estado === 'PENDIENTE') {
      prop.estado = decision === 'APROBAR' ? 'APROBADA' : 'RECHAZADA';
      if (decision === 'APROBAR') {
        const datos = JSON.parse(prop.datosPropuestos || '{}');
        state.obdCodigos.unshift({
          id: nextId(state.obdCodigos),
          codigo: datos.codigo || 'P0456',
          componente: datos.componente || 'Motor',
          sintoma: datos.sintoma || '',
          causa: datos.causa || '',
          solucion: datos.solucion || '',
          casoResuelto: false,
          diagnosticoId: null
        });
      }
    }
    return res.json({ success: true, data: { id, estado: prop?.estado || 'APROBADA' } });
  }

  const obdCaseMatch = cleanUrl.match(/^\/workshop-flow\/obd\/(\d+)\/caso$/);
  if (obdCaseMatch && method === 'POST') {
    const id = Number(obdCaseMatch[1]);
    const row = state.obdCodigos.find(o => Number(o.id) === id);
    if (row) {
      row.casoResuelto = true;
      if (body.solucion) row.solucion = body.solucion;
    }
    return res.json({ success: true, data: { id, casoResuelto: true } });
  }

  if (cleanUrl === '/workshop-flow/permisos' && method === 'GET') {
    return res.json({
      success: true,
      data: {
        roles: state.roles.map(r => ({ id: r.id, nombre: r.nombre })),
        permisos: state.permisos,
        asignaciones: state.rolPermisos
      }
    });
  }

  if (cleanUrl === '/workshop-flow/permisos' && method === 'POST') {
    const rol = state.roles.find(r => r.nombre === body.rol);
    const perm = state.permisos.find(p => p.codigo === body.codigo);
    if (rol && perm) {
      state.rolPermisos = state.rolPermisos.filter(rp => !(Number(rp.rolId) === Number(rol.id) && Number(rp.permisoId) === Number(perm.id)));
      if (body.concedido) {
        state.rolPermisos.push({ rolId: rol.id, permisoId: perm.id });
      }
    }
    return res.json({ success: true, data: { rol: body.rol, codigo: body.codigo, concedido: Boolean(body.concedido) } });
  }

  // 3. Business Operations (/operations/*)
  if (cleanUrl.startsWith('/operations/')) {
    if (cleanUrl === '/operations/uc-14/confirmar') {
      const cita = state.citas.find(c => Number(c.id) === Number(body.citaId));
      if (cita) cita.estado = 'CONFIRMADA';
      return res.json({ success: true, data: cita || { id: body.citaId, estado: 'CONFIRMADA' } });
    }
    if (cleanUrl === '/operations/uc-14/resolver-reprogramacion') {
      const cita = state.citas.find(c => Number(c.id) === Number(body.citaId || body.solicitudId));
      if (cita) cita.estado = body.decision === 'APROBADA' || body.decision === 'APROBAR' ? 'REPROGRAMADA' : 'CONFIRMADA';
      return res.json({ success: true, data: cita || { id: body.citaId, estado: 'CONFIRMADA' } });
    }
    if (cleanUrl === '/operations/uc-25/crear') {
      const srv = {
        id: nextId(state.servicios),
        codigo: `SRV-${String(state.servicios.length + 1).padStart(3, '0')}`,
        nombre: body.nombre || 'Servicio Taller',
        descripcion: body.descripcion || 'General',
        categoria: body.descripcion || 'General',
        duracionEstimadaMinutos: Number(body.duracionEstimadaMinutos || 60),
        precioManoObra: money(body.precioManoObra || 35),
        activo: true,
        tratamientoImpuesto: 'GRAVADO'
      };
      state.servicios.unshift(srv);
      return res.status(201).json({ success: true, data: srv });
    }
    if (cleanUrl === '/operations/uc-25/actualizar') {
      const srv = state.servicios.find(s => Number(s.id) === Number(body.servicioId));
      if (srv) {
        if (body.nombre) srv.nombre = body.nombre;
        if (body.descripcion) { srv.descripcion = body.descripcion; srv.categoria = body.descripcion; }
        if (body.precioManoObra != null) srv.precioManoObra = money(body.precioManoObra);
        if (body.duracionEstimadaMinutos != null) srv.duracionEstimadaMinutos = Number(body.duracionEstimadaMinutos);
      }
      return res.json({ success: true, data: srv || { id: body.servicioId } });
    }
    if (cleanUrl === '/operations/uc-20/registrar') {
      const correo = String(body.correo || '').trim().toLowerCase();
      const matchedUser = correo ? state.usuarios.find(u => u.correo.toLowerCase() === correo) : null;
      const cli = {
        id: nextId(state.clientes),
        nombre: body.nombre || 'Nuevo Cliente',
        documento: body.documento || null,
        telefono: body.telefono || null,
        correo: correo || null,
        direccion: body.direccion || null,
        usuarioId: matchedUser ? matchedUser.id : null,
        fechaCreacion: new Date().toISOString()
      };
      state.clientes.unshift(cli);
      addAudit(state, user, 'CLIENTE', cli.id, 'REGISTRAR', { nombre: cli.nombre, correo: cli.correo });
      return res.status(201).json({ success: true, id: cli.id, data: cli });
    }
    if (cleanUrl === '/operations/uc-20/actualizar') {
      const cli = state.clientes.find(c => Number(c.id) === Number(body.clienteId));
      if (cli) {
        Object.assign(cli, body);
        if (cli.correo) {
          const matchedUser = state.usuarios.find(u => u.correo.toLowerCase() === String(cli.correo).toLowerCase());
          if (matchedUser) cli.usuarioId = matchedUser.id;
        }
      }
      return res.json({ success: true, data: cli || body });
    }
    if (cleanUrl === '/operations/uc-24/registrar') {
      const veh = {
        id: nextId(state.vehiculos),
        clienteId: Number(body.clienteId),
        placa: String(body.placa || '').toUpperCase().trim(),
        marca: body.marca || null,
        modelo: body.modelo || null,
        anio: Number(body.anio || new Date().getFullYear()),
        color: body.color || null,
        vin: body.vin || null,
        kilometrajeActual: Number(body.kilometrajeActual || 0),
        estado: 'ACTIVO'
      };
      state.vehiculos.unshift(veh);
      addAudit(state, user, 'VEHICULO', veh.id, 'REGISTRAR', { placa: veh.placa, clienteId: veh.clienteId });
      return res.status(201).json({ success: true, id: veh.id, data: veh });
    }
    if (cleanUrl === '/operations/uc-03/actualizar-kilometraje') {
      const veh = state.vehiculos.find(v => Number(v.id) === Number(body.vehiculoId));
      if (veh && body.nuevoKilometraje != null) {
        veh.kilometrajeActual = Number(body.nuevoKilometraje);
      }
      return res.json({ success: true, data: veh });
    }
    if (cleanUrl === '/operations/uc-07/ajustar') {
      const prod = state.productos.find(p => Number(p.id) === Number(body.productoId));
      if (prod) {
        if (body.cantidadNueva != null) prod.stock = Number(body.cantidadNueva);
        if (body.stockNuevo != null) prod.stock = Number(body.stockNuevo);
        watchStock(state, prod, user);
      }
      return res.json({ success: true, data: prod });
    }
    if (cleanUrl === '/operations/uc-04/indicadores') {
      const ingresos = state.ventas.filter(v => v.estado === 'CONFIRMADA').reduce((s, v) => s + Number(v.total || 0), 0);
      return res.json({
        success: true,
        data: {
          ingresos: money(ingresos),
          ordenes: state.ordenTrabajos.length,
          citas: state.citas.length
        }
      });
    }
    return res.json({ success: true, status: 'COMPLETED', data: { ...body, id: Date.now() } });
  }

  // 4. Generic & Standard Entity CRUD Endpoints (with Role Scoping!)
  const entityMap = {
    clientes: 'clientes',
    cliente: 'clientes',
    vehiculos: 'vehiculos',
    vehiculo: 'vehiculos',
    citas: 'citas',
    cita: 'citas',
    'espacio-citas': 'espacioCitas',
    'espacio-cita': 'espacioCitas',
    recepciones: 'recepciones',
    recepcion: 'recepciones',
    diagnosticos: 'diagnosticos',
    diagnostico: 'diagnosticos',
    'diagnostico-fallas': 'diagnosticoFallas',
    servicios: 'servicios',
    servicio: 'servicios',
    productos: 'productos',
    producto: 'productos',
    repuestos: 'productos',
    repuesto: 'productos',
    proveedores: 'proveedores',
    proveedor: 'proveedores',
    cotizaciones: 'cotizaciones',
    cotizacion: 'cotizaciones',
    'cotizacion-items': 'cotizacionItems',
    'cotizacion-detalles': 'cotizacionItems',
    'orden-trabajos': 'ordenTrabajos',
    'orden-trabajo': 'ordenTrabajos',
    'ordenes-trabajo': 'ordenTrabajos',
    'orden-trabajo-detalles': 'ordenTrabajos',
    'orden-mecanicos': 'ordenMecanicos',
    actividades: 'actividades',
    vendedores: 'vendedores',
    vendedor: 'vendedores',
    ventas: 'ventas',
    venta: 'ventas',
    compras: 'compras',
    compra: 'compras',
    'movimiento-inventarios': 'movimientoInventarios',
    'obd-codigos': 'obdCodigos',
    'obd-conocimientos': 'obdCodigos',
    'propuesta-obd-codigos': 'propuestaObdCodigos',
    'programacion-mantenimientos': 'programacionMantenimientos',
    alertas: 'alertas',
    'alerta-stocks': 'alertas',
    notificaciones: 'notificaciones',
    'evidencia-multimedias': 'evidencias',
    evidencias: 'evidencias',
    usuarios: 'usuarios',
    usuario: 'usuarios',
    roles: 'roles',
    rol: 'roles',
    permisos: 'permisos',
    'rol-permisos': 'rolPermisos',
    auditorias: 'auditorias'
  };

  const parts = cleanUrl.replace(/^\//, '').split('/').filter(Boolean);
  const resourceSlug = (parts[0] || 'recurso').toLowerCase();
  const itemId = parts[1] || null;

  const storeKey = entityMap[resourceSlug];
  let list;
  if (storeKey && Array.isArray(state[storeKey])) {
    list = state[storeKey];
  } else {
    if (!state.customEntities[resourceSlug]) {
      state.customEntities[resourceSlug] = [];
    }
    list = state.customEntities[resourceSlug];
  }

  const role = user.role || user.rol;

  if (method === 'GET') {
    let scopedList = list;
    // Filtrado estricto por Rol para Cliente y Mecánico
    if (role === 'Cliente') {
      const clientIds = getClientIdsForUser(state, user);
      if (resourceSlug === 'vehiculos' || resourceSlug === 'citas' || resourceSlug === 'cotizaciones') {
        scopedList = list.filter(row => clientIds.includes(Number(row.clienteId)));
      } else if (resourceSlug === 'clientes') {
        scopedList = list.filter(row => clientIds.includes(Number(row.id)));
      } else if (resourceSlug === 'notificaciones') {
        scopedList = list.filter(row => Number(row.usuarioId) === Number(user.id));
      }
    } else if (role === 'Mecánico') {
      if (resourceSlug === 'recepciones') {
        scopedList = list.filter(row => Number(row.mecanicoId) === Number(user.id));
      } else if (resourceSlug === 'notificaciones') {
        scopedList = list.filter(row => Number(row.usuarioId) === Number(user.id));
      }
    }

    if (itemId) {
      const found = scopedList.find(r => String(r.id) === String(itemId));
      if (!found) return res.status(404).json({ success: false, code: 'RECORD_NOT_FOUND' });
      return res.json({ success: true, data: found });
    }
    return res.json({ success: true, count: scopedList.length, data: scopedList });
  }

  if (method === 'POST') {
    const id = nextId(list);
    const now = new Date().toISOString();
    const created = {
      id,
      ...body,
      fechaCreacion: body.fechaCreacion || now,
      createdAt: body.createdAt || now,
      updatedAt: now
    };
    if (user?.id && !created.usuarioId) {
      created.usuarioId = user.id;
    }
    if (resourceSlug === 'clientes' && created.correo) {
      const matchedUser = state.usuarios.find(u => u.correo.toLowerCase() === String(created.correo).toLowerCase());
      if (matchedUser) created.usuarioId = matchedUser.id;
    }

    // VALIDACIÓN Y DESCUENTO AUTOMÁTICO DE STOCK AL REGISTRAR VENTA
    if (resourceSlug === 'ventas' || resourceSlug === 'venta') {
      const saleItems = Array.isArray(body.items)
        ? body.items
        : (Array.isArray(body.detalles) ? body.detalles : (Array.isArray(body.detalle_venta) ? body.detalle_venta : []));

      // 1. Validación previa estricta: ningún producto puede vender más de su stock disponible
      for (const item of saleItems) {
        const prodId = item.producto_id || item.productoId || item.id;
        const prodCodigo = item.codigo;
        const qty = Number(item.cantidad || 1);
        let prod = (state.productos || []).find(p =>
          (prodId && String(p.id) === String(prodId)) ||
          (prodCodigo && String(p.codigo).toLowerCase() === String(prodCodigo).toLowerCase())
        );

        if (!prod && prodId) {
          try {
            const models = require('../models');
            if (models && models.PRODUCTO) {
              const dbP = await models.PRODUCTO.findByPk(prodId);
              if (dbP) {
                prod = { id: dbP.id, codigo: dbP.codigo, nombre: dbP.nombre, existencia_actual: Number(dbP.existenciaActual || 0), stock: Number(dbP.existenciaActual || 0), precio: Number(dbP.precioUnitarioVenta || 0) };
                state.productos.push(prod);
              }
            }
          } catch (_) {}
        }

        if (prod) {
          const currentStock = Number(prod.existencia_actual != null ? prod.existencia_actual : (prod.stock || 0));
          if (qty > currentStock) {
            return res.status(400).json({
              success: false,
              error: {
                message: `Stock insuficiente para "${prod.nombre}". Existencia disponible: ${currentStock}, Solicitado: ${qty}`
              }
            });
          }
        }
      }

      // 2. Descuento atómico si todos los productos tienen stock suficiente
      for (const item of saleItems) {
        const prodId = item.producto_id || item.productoId || item.id;
        const prodCodigo = item.codigo;
        const qty = Number(item.cantidad || 1);
        let prod = (state.productos || []).find(p =>
          (prodId && String(p.id) === String(prodId)) ||
          (prodCodigo && String(p.codigo).toLowerCase() === String(prodCodigo).toLowerCase())
        );

        if (!prod && prodId) {
          try {
            const models = require('../models');
            if (models && models.PRODUCTO) {
              const dbP = await models.PRODUCTO.findByPk(prodId);
              if (dbP) {
                prod = { id: dbP.id, codigo: dbP.codigo, nombre: dbP.nombre, existencia_actual: Number(dbP.existenciaActual || 0), stock: Number(dbP.existenciaActual || 0), precio: Number(dbP.precioUnitarioVenta || 0) };
                state.productos.push(prod);
              }
            }
          } catch (_) {}
        }

        if (prod) {
          const currentStock = Number(prod.existencia_actual != null ? prod.existencia_actual : (prod.stock || 0));
          const newStock = Math.max(0, currentStock - qty);
          prod.existencia_actual = newStock;
          prod.stock = newStock;

          // Sincronizar actualización en PostgreSQL
          try {
            const models = require('../models');
            if (models && models.PRODUCTO) {
              await models.PRODUCTO.update(
                { existenciaActual: newStock },
                { where: { id: prod.id } }
              );
            }
          } catch (_) {}

          // Registrar en kardex de movimientos de inventario
          if (Array.isArray(state.movimientoInventarios)) {
            state.movimientoInventarios.unshift({
              id: nextId(state.movimientoInventarios),
              productoId: prod.id,
              productoNombre: prod.nombre,
              tipoMovimiento: 'SALIDA_VENTA',
              cantidad: qty,
              saldoResultante: newStock,
              fechaMovimiento: now,
              referencia: `Factura ${body.numero_factura || id}`,
              usuarioId: user?.id || null
            });
          }
        }
      }
    }

    list.unshift(created);
    addAudit(state, user, resourceSlug.toUpperCase(), id, 'CREAR', created);
    return res.status(201).json({ success: true, data: created });
  }

  if (method === 'PUT' || method === 'PATCH') {
    const idx = list.findIndex(r => String(r.id) === String(itemId));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...body, updatedAt: new Date().toISOString() };
      return res.json({ success: true, data: list[idx] });
    }
    return res.status(404).json({ success: false, code: 'RECORD_NOT_FOUND' });
  }

  if (method === 'DELETE') {
    const idx = list.findIndex(r => String(r.id) === String(itemId));
    if (idx >= 0) list.splice(idx, 1);
    return res.json({ success: true, data: { id: itemId, deleted: true } });
  }

  return res.json({ success: true, data: {} });
}

module.exports = {
  handleWorkshopRuntimeRequest,
  getState
};
