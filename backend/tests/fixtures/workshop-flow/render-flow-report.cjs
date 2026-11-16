const fs=require('node:fs'),path=require('node:path');
const escape=value=>String(value ?? '').replace(/\|/g,'\\|').replace(/[\r\n]+/g,' ');
const count=rows=>Object.fromEntries(['PASS','FAIL','BLOCKED','NOT_EVALUATED'].map(status=>[status,rows.filter(row=>row.status===status).length]));
function render(directory){
  const data=JSON.parse(fs.readFileSync(path.join(directory,'results.json'),'utf8'));
  const run=JSON.parse(fs.readFileSync(path.join(directory,'run.json'),'utf8'));
  const cases=data.cases,counts=count(cases),flow=cases.filter(c=>c.kind==='end-to-end');
  const core=cases.filter(c=>['acceptance','end-to-end','measurement'].includes(c.kind));
  const availability=cases.filter(c=>c.kind==='availability');
  const brokenOperations=[...new Set(availability.filter(c=>c.status==='FAIL').map(c=>c.id.match(/CONTRACT-(UC-\d+)/)?.[1]).filter(Boolean))];
  const firstFailure=flow.find(c=>c.status==='FAIL');
  const matrix=data.requirements.map(requirement=>{
    const checks=core.filter(c=>c.requirements.includes(requirement.code));
    const totals=count(checks);
    const status=totals.FAIL?'FALLOS DETECTADOS':totals.BLOCKED?'BLOQUEADO / PARCIAL':checks.length?(requirement.code==='RNF-02'?'PARCIAL: MUESTRA LOCAL DE API':'PRUEBAS OK EN EL ALCANCE INDICADO'):'NO EVALUADO POR API';
    return {...requirement,status,counts:totals,cases:checks.map(c=>c.id)};
  });
  const summary={runId:data.runId,cases:counts,workflow:{status:flow.every(c=>c.status==='PASS')?'COMPLETED':'BLOCKED',firstFailure:firstFailure?.id,counts:count(flow)},unimplementedDeclaredOperations:brokenOperations,requirements:matrix,cleanupSucceeded:run.cleanupSucceeded};
  const priority=c=>/^IDOR-|^MECHANIC-ASSIGNMENT|^RNF11-UPLOAD/.test(c.id)?'P0':/^RF16-|^RF17-|^RF18-|^RF23-|^RF24-|^RF25-|^RF26-|^RF34-|^RNF07-/.test(c.id)?'P1':'P2';
  const findings=core.filter(c=>c.status==='FAIL').map(c=>({id:c.id,priority:priority(c),name:c.name,requirements:c.requirements,evidence:c.message,requests:c.requests}));
  fs.writeFileSync(path.join(directory,'findings.json'),JSON.stringify(findings,null,2)+'\n');
  fs.writeFileSync(path.join(directory,'summary.json'),JSON.stringify(summary,null,2)+'\n');
  const lines=['# Validación del backend generado de Autron','',
    `Ejecución: ${data.runId}. Entorno: PostgreSQL temporal y backend exclusivos del proyecto Docker ${run.project}.`, '',
    `Casos: **${counts.PASS} correctos, ${counts.FAIL} fallidos, ${counts.BLOCKED} bloqueados y ${counts.NOT_EVALUATED} pendientes de otro tipo de validación**.`,
    `Flujo extremo a extremo: **${summary.workflow.status}**. ${firstFailure?`Primer fallo: ${firstFailure.id} — ${firstFailure.name}.`:''}`,
    `Operaciones de negocio declaradas que no resultan ejecutables: **${brokenOperations.length}** (${brokenOperations.join(', ')}).`,
    `Limpieza del entorno aislado: **${run.cleanupSucceeded?'completada':'PENDIENTE'}**. No se publicaron puertos ni se usaron los volúmenes del Autron activo.`, '',
    '## Cómo interpretar los resultados','',
    '- Un CRUD correcto no demuestra cálculos, transiciones de estado, auditoría automática ni aislamiento de registros.',
    '- Los pasos bloqueados no se ejecutaron ni se cuentan como aprobados. No se rellenaron con IDs ficticios.',
    '- Las precondiciones creadas con SQL están identificadas como fixtures; permiten detectar fallos posteriores independientemente del primer bloqueo del flujo.',
    '- Los sondeos UC verifican disponibilidad y permisos declarados, no su lógica completa. Se muestran separados de las pruebas funcionales.',
    '- Un resultado favorable de estas pruebas no certifica todos los detalles del requisito ni el comportamiento del frontend.', '',
    '## Revisión de la semilla de usuarios','',
    `- Acceso con rol correcto: ${cases.filter(c=>c.id.startsWith('LOGIN-')&&c.status==='PASS').length}/4 perfiles.`,
    `- Idempotencia: ${cases.find(c=>c.id==='SEED-IDEMPOTENT')?.status}. Se verificó que repetir la semilla no duplica usuarios ni cambia sus credenciales.`,
    `- Manejo de errores: ${cases.find(c=>c.id==='SEED-FAILURE')?.status}. El catch actual escribe el error, pero no establece una salida distinta de cero; el arranque puede continuar sin cuentas.`,
    '- findOrCreate conserva una cuenta existente: no repara automáticamente su rol, estado o contraseña si ya fueron modificados.',
    '- La semilla crea USUARIO y ROL, pero no el perfil CLIENTE. Las precondiciones de ese perfil se indican expresamente en los fixtures.', '',
    '## Hallazgos que deben corregirse primero','',
    ...findings.filter(f=>f.priority==='P0').map(f=>`- **${f.priority} ${f.id}**: ${f.name}. ${escape(f.evidence)}`),
    '- **P1 — Integridad operativa**: revisar generación de órdenes autorizadas, identidad de decisiones, cálculo de cotizaciones, inventario de ventas/compras y auditoría automática.',
    '- **Bloqueo del flujo**: las rutas workshop-flow del frontend no están implementadas en el exportado y las 28 operaciones UC siguen sin comportamiento ejecutable.','',
    '## Resultado por actor','', '| Actor | Correctos | Fallidos | Bloqueados |','|---|---:|---:|---:|',
    ...['Administrador','Cliente','Mecánico','Recepción'].map(role=>{const totals=count(core.filter(c=>c.roles.includes(role)));return `| ${role} | ${totals.PASS} | ${totals.FAIL} | ${totals.BLOCKED} |`;}), '',
    '## Cadena del flujo completo','', '| Paso | Actor | Requisitos | Estado | Evidencia / bloqueo |','|---|---|---|---|---|',
    ...flow.map(c=>`| ${escape(c.id+' '+c.name)} | ${c.roles.join(', ')} | ${c.requirements.join(', ')} | ${c.status} | ${escape(c.message || c.requests.map(r=>r.method+' '+r.path+' → '+r.status).join('; '))} |`), '',
    '## Matriz de requisitos','', '| Requisito | Nombre | Resultado de las pruebas backend | Casos |','|---|---|---|---|',
    ...matrix.map(r=>`| ${r.code} | ${escape(r.name)} | ${r.status} | ${r.cases.join(', ') || 'Validación externa/manual requerida'} |`), '',
    '## Fallos funcionales y de protección de datos','',
    ...core.filter(c=>c.status==='FAIL').flatMap(c=>[
      `### ${c.id} — ${c.name}`,'',
      `Actor: ${c.roles.join(', ')}. Requisitos: ${c.requirements.join(', ')}.`,
      `Resultado: ${escape(c.message)}.`,
      ...c.requests.map(r=>`- ${r.method} ${r.path}: HTTP ${r.status} (${r.elapsedMs} ms).`),''
    ]),
    '## Matriz de operaciones declaradas por rol','',
    'Los permisos esperados de esta tabla proceden de icase.spec.json; no son una aprobación de esa política frente al texto de los requisitos.', '',
    '| Operación | Administrador | Cliente | Mecánico | Recepción |','|---|---|---|---|---|',
    ...[...new Set(cases.filter(c=>/^CONTRACT-/.test(c.id)).map(c=>c.id.match(/CONTRACT-(UC-\d+)/)[1]))].map(id=>`| ${id} | `+['Administrador','Cliente','Mecánico','Recepción'].map(role=>{const c=cases.find(c=>c.id===`CONTRACT-${id}-${role}`);return c?`${c.requests[0]?.status ?? '-'} / ${c.status} (${c.kind==='availability'?'permitido':'denegado'})`:'sin prueba';}).join(' | ')+' |'), '',
    '## Requisitos que requieren otra validación','',
    ...cases.filter(c=>c.kind==='manual').map(c=>`- ${c.requirements.join(', ')}: ${c.message}`),
    '- RNF-02: el muestreo cubre solo API local sin carga. Falta medir usuario → interfaz y carga normal definida.',
    '- RF-10: se comprueba persistencia de estados de zonas; la representación visual necesita prueba de interfaz.',
    '- RF-32/RF-33: se prueba el contrato backend declarado. Los indicadores calculados en React requieren validación adicional.', '',
    '## Observaciones sobre los requisitos','',...data.notes.map(note=>'- '+note),'',
    '## Archivos y reproducción','',
    '- Ejecutar desde autron-revision: `node tests/run-backend-flow.cjs`.',
    '- `results.json`: resultados de cada caso y solicitudes HTTP, sin tokens ni contraseñas.',
    '- `summary.json`: matriz de requisitos y conteos para automatización.',
    '- `test-output.tap`: salida nativa de node:test.',
    '- `run.json`: entorno de ejecución, salida de la suite y limpieza.',
    '- `findings.json`: defectos funcionales y de protección de datos priorizados (no incluye cada sondeo UC repetido por rol).',
    '- La suite devuelve código 1 si detecta fallos. Eso no implica que el runner esté roto; revisar infrastructureError en run.json.',
    '- Los datos temporales viven en tmpfs. El runner elimina únicamente el proyecto Docker de pruebas creado para esa ejecución.',''];
  fs.writeFileSync(path.join(directory,'FLUJO_BACKEND.md'),lines.join('\n'));
  console.log(JSON.stringify({cases:counts,workflow:summary.workflow,unimplementedOperations:brokenOperations.length}));
}
module.exports={render};
