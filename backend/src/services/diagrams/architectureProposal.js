const {label}=require('./mermaidSyntax');
function generate(project){
 const reqs=(project.requirements||[]).filter(r=>r.status==='APPROVED'&&!r.isDeleted);const functional=reqs.filter(r=>r.type==='FUNCTIONAL');
 if(!functional.length)throw Object.assign(new Error('Aprueba requisitos funcionales para proponer la arquitectura.'),{statusCode:422});
 const evidence=[];
 for(const source of project.sources||[]) {
   const text=source.currentVersion?.extractedText||'';
   for(const line of text.split('\n')) for(const tech of require('../analysis/technologyDetector').detect(line).detected) {
     if(!evidence.some(e=>e.name===tech.name)) evidence.push({...tech,sourceId:source.id,sourceVersionId:source.currentVersion.id,quote:line});
   }
 }
 const stack=category=>evidence.filter(e=>e.category===category).map(e=>e.name).join(' + ');
 const lines=['flowchart TB',' NOTE["Arquitectura logica propuesta - tecnologias y despliegue por confirmar"]',' subgraph PRESENTATION["Presentacion propuesta"]',' UI["Interfaz del sistema"]',' end',' subgraph DOMAIN["Responsabilidades de negocio"]'];
 lines[1]=' NOTE["Tecnologias documentadas; organizacion logica propuesta"]';
 lines[3]=' UI["'+label(stack('frontend')||'Interfaz - tecnologia por confirmar')+'"]';
 const groups=new Map();const patterns=[['Acceso y permisos',/roles|permisos|autentica|usuarios/],['Clientes y vehiculos',/clientes|vehiculos|expediente|historial/],['Atencion y citas',/citas|recepcion/],['Diagnostico',/fallas|diagnostico|obd/],['Cotizaciones',/cotizacion|items autorizados|catalogo de servicios/],['Reparacion',/mecanicos|reparacion|actividades/],['Inventario',/inventario|repuestos|productos|stock|ventas|proveedores/],['Mantenimientos',/mantenimientos|mantenimiento/],['Conocimiento',/conocimiento/],['Reportes y control',/indicadores|reportes|auditoria|solicitudes de cambio/]];
 for(const r of functional){const t=(r.description||r.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const group=patterns.find(p=>p[1].test(t))?.[0]||'Otras operaciones documentadas';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(r.id);}
 let i=0;const modules=[];for(const [name,requirementIds]of groups){const id='MODULE_'+i++;lines.push(id+'["'+label(name)+'"]');modules.push({id,name,requirementIds});}
 lines.push(' end',' subgraph DATA["Persistencia propuesta"]',' STORE[("Datos del dominio - motor por confirmar")]',' end');for(const m of modules)lines.push(' UI --> '+m.id,m.id+' --> STORE');
 if(stack('backend')) {
   lines.push(' API["'+label(stack('backend'))+' - servicios"]',' UI --> API');
   for(const m of modules)lines.push(' API --> '+m.id);
 }
 if(stack('database')) {
   const pos=lines.findIndex(l=>l.startsWith(' STORE['));
   lines[pos]=' STORE[("'+label(stack('database'))+'")]';
 }
 if(stack('infrastructure'))lines.push(' DEPLOY["'+label(stack('infrastructure'))+' - despliegue documentado"]',' DEPLOY -.-> API');
 lines.push(' NOTE -.-> UI');
 const systemCode=[
   'flowchart TB',
   ' USER["Cliente web - navegador"]',
   ' PROXY["Proxy HTTPS - producto por confirmar"]',
   ' subgraph HOST["Despliegue propuesto'+(evidence.some(e=>e.name==='Docker')?' con Docker':'')+'"]',
   ' FRONT["Frontend: '+label(stack('frontend')||'por confirmar')+'"]',
   ' BACK["Backend API: '+label(stack('backend')||'por confirmar')+'"]',
   ' DB[("Base de datos: '+label(stack('database')||'por confirmar')+'")]',' end',
   ' USER -->|HTTPS| PROXY',' PROXY --> FRONT',' PROXY -->|API| BACK',' BACK -->|Persistencia| DB',
   ' NOTE_SYS["Propuesta: confirmar alojamiento, puertos, volumenes y topologia"]',' NOTE_SYS -.-> HOST'
 ].join('\n');
 return {code:lines.join('\n'),systemCode,modules,documentedTechnologies:evidence,proposed:true,warning:'Organizacion logica propuesta. Las tecnologias citadas provienen de las fuentes; versiones, infraestructura concreta y despliegue requieren confirmacion.'};
}
module.exports={generate};
