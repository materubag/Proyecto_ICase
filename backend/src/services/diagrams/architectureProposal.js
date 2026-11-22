const { label } = require('./mermaidSyntax');

function generate(project) {
  const reqs = (project.requirements || []).filter(r => r.status === 'APPROVED' && !r.isDeleted);
  const functional = reqs.filter(r => r.type === 'FUNCTIONAL');
  if (!functional.length) throw Object.assign(new Error('Aprueba requisitos funcionales para proponer la arquitectura.'), { statusCode: 422 });

  const nfr = (project.requirements || []).filter(r => r.type === 'NON_FUNCTIONAL' && !r.isDeleted);
  const hasBackups = nfr.some(r => /respaldo|backup|recuperaci/i.test(r.name + ' ' + (r.description || '')));

  const evidence = [];
  for (const source of project.sources || []) {
    const text = source.currentVersion?.extractedText || '';
    for (const line of text.split('\n')) {
      for (const tech of require('../analysis/technologyDetector').detect(line).detected) {
        if (!evidence.some(e => e.name === tech.name)) {
          evidence.push({ ...tech, sourceId: source.id, sourceVersionId: source.currentVersion?.id, quote: line });
        }
      }
    }
  }

  const stack = category => evidence.filter(e => e.category === category).map(e => e.name).join(' + ');

  const cleanTech = val => String(val || '').replace(/[&<>"\n\r\\`]/g, ' ').trim().slice(0, 100);

  const feName = cleanTech(stack('frontend') || 'React');
  const beName = cleanTech(stack('backend') || 'Node.js + Express');
  const dbName = cleanTech(stack('database') || 'PostgreSQL');

  const isTienda = /tienda|vendedor|factur|pos\b|caja\b|mostrador/i.test(
    `${project.name || ''} ${project.description || ''} ${functional.map(r => (r.name || '') + ' ' + (r.description || '')).join(' ')}`
  );

  const lines = [
    'flowchart LR',
    '  subgraph COL1 ["COLS. 1: USUARIOS (Hardware / Dispositivos)"]',
    '    direction TB'
  ];

  const actors = (project.actors || []).filter(a => !a.isDeleted);
  const actorNodes = [];
  if (actors.length > 0) {
    for (let idx = 0; idx < actors.length; idx++) {
      const a = actors[idx];
      const name = a.name.trim();
      let device = 'PC / Laptop';
      if (/vendedor|cajer/i.test(name)) device = 'Terminal POS / Mostrador';
      else if (/admin|gerent/i.test(name)) device = 'PC Escritorio';
      else if (/client|usuari/i.test(name)) device = 'Smartphone / Web';
      else if (/mecanic|tecnic/i.test(name)) device = 'Tablet / Móvil';
      else if (/recep/i.test(name)) device = 'PC / Laptop';

      const nodeId = `U_ACT_${idx + 1}`;
      lines.push(`    ${nodeId}["${name} (${device})"]`);
      actorNodes.push(nodeId);
    }
  } else if (isTienda) {
    lines.push('    U_ACT_1["Administrador (PC Escritorio)"]');
    lines.push('    U_ACT_2["Vendedor (Terminal POS / Mostrador)"]');
    actorNodes.push('U_ACT_1', 'U_ACT_2');
  } else {
    lines.push('    U_REC["Recepción (PC / Laptop)"]');
    lines.push('    U_MEC["Mecánico (Tablet / Móvil)"]');
    lines.push('    U_CLI["Cliente (Smartphone)"]');
    lines.push('    U_ADM["Admin (PC Escritorio)"]');
    actorNodes.push('U_REC', 'U_MEC', 'U_CLI', 'U_ADM');
  }

  lines.push('  end');
  lines.push('');
  lines.push('  subgraph COL2 ["COLS. 2: INTERFAZ (Presentación)"]');
  lines.push('    direction TB');
  lines.push('    UI_APP["APP WEB (' + feName + ')"]');
  lines.push('    UI_ROUTER["Router y Vistas SPA"]');
  lines.push('    UI_APP --> UI_ROUTER');
  lines.push('  end');
  lines.push('');
  lines.push('  subgraph COL3 ["COLS. 3: MÓDULOS API (Lógica / ' + beName + ')"]');
  lines.push('    direction TB');

  const groups = new Map();
  const patterns = isTienda ? [
    ['Autenticación y Control de Acceso', /login|inicio\s+de\s+sesi[oó]n|credencial|autentica|rol|permiso|rf-01\b/i],
    ['Gestión de Cuentas de Vendedores', /vendedor|cuenta.*vendedor|usuario|rf-02\b/i],
    ['Catálogo e Inventario de Productos', /producto|cat[aá]logo|stock|inventario|rf-03|rf-04\b/i],
    ['Punto de Venta y Facturación', /factur|importe|caja|descontar.*stock|rf-05|rf-06\b/i],
    ['Historial y Consulta de Ventas', /consultar.*venta|historial.*venta|ventas\s+registradas|rf-07\b/i]
  ] : [
    ['Autenticación y Acceso', /roles|permisos|autentica|usuarios/i],
    ['Clientes y Vehículos', /clientes|vehiculos|expediente|historial/i],
    ['Atención y Citas', /citas|recepcion/i],
    ['Diagnóstico OBD', /fallas|diagnostico|obd/i],
    ['Cotizaciones y Presupuestos', /cotizacion|items autorizados|catalogo de servicios/i],
    ['Órdenes de Trabajo y Taller', /mecanicos|reparacion|actividades/i],
    ['Inventario y Repuestos', /inventario|repuestos|productos|stock|ventas|proveedores/i],
    ['Mantenimiento Preventivo', /mantenimientos|mantenimiento/i],
    ['Base de Conocimiento', /conocimiento/i],
    ['Reportes y Control', /indicadores|reportes|auditoria|solicitudes de cambio/i]
  ];

  for (const r of functional) {
    const t = (r.description || r.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const group = patterns.find(p => p[1].test(t))?.[0] || 'Operaciones del Sistema';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(r.id);
  }

  // Ordenar módulos lógicamente según los patrones para que Autenticación y Módulos Core queden arriba
  const sortedModuleNames = [
    ...patterns.map(p => p[0]).filter(name => groups.has(name)),
    ...Array.from(groups.keys()).filter(name => !patterns.some(p => p[0] === name))
  ];

  let i = 0;
  const modules = [];
  for (const name of sortedModuleNames) {
    const requirementIds = groups.get(name);
    const id = 'MOD_' + (++i);
    lines.push('    ' + id + '["' + name + '"]');
    modules.push({ id, name, requirementIds });
  }

  lines.push('  end');
  lines.push('');
  const hasObjStore = !isTienda && (functional.some(r => /foto|evidencia|adjunto|diagnostico|obd/i.test((r.name || '') + ' ' + (r.description || ''))));
  lines.push('  subgraph COL4 ["COLS. 4: PERSISTENCIA Y RESPALDOS (Datos & RNF-08)"]');
  lines.push('    direction TB');
  lines.push('    STORE[("' + dbName + ' (Base de Datos Relacional)")]');
  if (hasObjStore) {
    lines.push('    OBJ_STORE[("Almacén de Evidencias (Fotos y Diagnósticos)")]');
  }
  if (hasBackups) {
    lines.push('    BACKUP_SVC["Servicio de Respaldos (RNF-08: Backup & Recovery Daemon)"]');
    lines.push('    STORE -.->|Respaldos programados| BACKUP_SVC');
    if (hasObjStore) {
      lines.push('    OBJ_STORE -.->|Copias de seguridad| BACKUP_SVC');
    }
  }
  lines.push('  end');
  lines.push('');
  for (const nodeId of actorNodes) {
    lines.push(`  ${nodeId} --> UI_APP`);
  }
  lines.push('');

  for (const m of modules) {
    lines.push('  UI_ROUTER --> ' + m.id);
    lines.push('  ' + m.id + ' --> STORE');
    if (hasObjStore && (m.name.includes('Diagnóstico') || m.name.includes('Evidencias'))) {
      lines.push('  ' + m.id + ' --> OBJ_STORE');
    }
  }

  const systemCode = [
    'flowchart TB',
    ' USER["Dispositivo del Usuario (Navegador Web / Móvil)"]',
    ' PROXY["Proxy HTTPS Seguro (Nginx / Cifrado SSL - RNF-04)"]',
    ' subgraph HOST["Infraestructura del Sistema' + (evidence.some(e => e.name === 'Docker') ? ' (Docker)' : '') + '"]',
    ' FRONT["Contenedor Frontend (' + label(stack('frontend') || 'React') + ')"]',
    ' BACK["Contenedor Backend API (' + label(stack('backend') || 'Node.js + Express') + ')"]',
    ' DB[("Contenedor Base de Datos (' + label(stack('database') || 'PostgreSQL') + ')")]',
    ...(hasBackups ? [
      ' BACKUP_JOB["Servicio Automatizado de Respaldos (RNF-08: Backup Daemon / Cron)"]',
      ' BACKUP_VOL[("Volumen de Respaldos Seguros (Dumps & Snapshots)")]'
    ] : []),
    ' end',
    ' USER -->|Acceso HTTPS Seguro| PROXY',
    ' PROXY --> FRONT',
    ' PROXY -->|Rutas API| BACK',
    ' BACK -->|Persistencia Transaccional| DB',
    ...(hasBackups ? [
      ' DB -.->|Extracción de volcados / Dumps periódicos| BACKUP_JOB',
      ' BACKUP_JOB -->|Almacenar copias de seguridad| BACKUP_VOL'
    ] : []),
    ' NOTE_SYS["Infraestructura con políticas de respaldo y recuperación (RNF-08)"]',
    ' NOTE_SYS -.-> HOST'
  ].join('\n');

  return {
    code: lines.join('\n'),
    systemCode,
    modules,
    documentedTechnologies: evidence,
    proposed: true,
    warning: 'Arquitectura organizada por Columnas de Responsabilidad (Estilo Kanban) con persistencia y respaldos derivados de RNF.'
  };
}

module.exports = { generate };
