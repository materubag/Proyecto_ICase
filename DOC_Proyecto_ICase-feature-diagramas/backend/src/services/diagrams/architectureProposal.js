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

  const lines = [
    'flowchart LR',
    '  subgraph COL1 ["COLS. 1: USUARIOS (Hardware / Dispositivos)"]',
    '    direction TB',
    '    U_REC["Recepción (PC / Laptop)"]',
    '    U_MEC["Mecánico (Tablet / Móvil)"]',
    '    U_CLI["Cliente (Smartphone)"]',
    '    U_ADM["Admin (PC Escritorio)"]',
    '  end',
    '',
    '  subgraph COL2 ["COLS. 2: INTERFAZ (Presentación)"]',
    '    direction TB',
    '    UI_APP["APP WEB (' + feName + ')"]',
    '    UI_ROUTER["Router y Vistas SPA"]',
    '    UI_APP --> UI_ROUTER',
    '  end',
    '',
    '  subgraph COL3 ["COLS. 3: MÓDULOS API (Lógica / ' + beName + ')"]',
    '    direction TB'
  ];

  const groups = new Map();
  const patterns = [
    ['Autenticación y Acceso', /roles|permisos|autentica|usuarios/],
    ['Clientes y Vehículos', /clientes|vehiculos|expediente|historial/],
    ['Atención y Citas', /citas|recepcion/],
    ['Diagnóstico OBD', /fallas|diagnostico|obd/],
    ['Cotizaciones y Presupuestos', /cotizacion|items autorizados|catalogo de servicios/],
    ['Órdenes de Trabajo y Taller', /mecanicos|reparacion|actividades/],
    ['Inventario y Repuestos', /inventario|repuestos|productos|stock|ventas|proveedores/],
    ['Mantenimiento Preventivo', /mantenimientos|mantenimiento/],
    ['Base de Conocimiento', /conocimiento/],
    ['Reportes y Control', /indicadores|reportes|auditoria|solicitudes de cambio/]
  ];

  for (const r of functional) {
    const t = (r.description || r.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const group = patterns.find(p => p[1].test(t))?.[0] || 'Operaciones del Sistema';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(r.id);
  }

  // Ordenar módulos lógicamente según los patrones para que Autenticación y Vehículos queden arriba
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
  lines.push('  subgraph COL4 ["COLS. 4: PERSISTENCIA Y RESPALDOS (Datos & RNF-08)"]');
  lines.push('    direction TB');
  lines.push('    STORE[("' + dbName + ' (Base de Datos Relacional)")]');
  lines.push('    OBJ_STORE[("Almacén de Evidencias (Fotos y Diagnósticos)")]');
  if (hasBackups) {
    lines.push('    BACKUP_SVC["Servicio de Respaldos (RNF-08: Backup & Recovery Daemon)"]');
    lines.push('    STORE -.->|Respaldos programados| BACKUP_SVC');
    lines.push('    OBJ_STORE -.->|Copias de seguridad| BACKUP_SVC');
  }
  lines.push('  end');
  lines.push('');
  lines.push('  U_REC --> UI_APP');
  lines.push('  U_MEC --> UI_APP');
  lines.push('  U_CLI --> UI_APP');
  lines.push('  U_ADM --> UI_APP');
  lines.push('');

  for (const m of modules) {
    lines.push('  UI_ROUTER --> ' + m.id);
    lines.push('  ' + m.id + ' --> STORE');
    if (m.name.includes('Diagnóstico') || m.name.includes('Evidencias')) {
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
