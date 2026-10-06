export function screenOptions(project) {
 const existing=(project.navigationNodes||[]).filter(n=>n.status==='APPROVED'&&n.route&&n.requirementIds?.length);
 const rules=[['conocimiento','Base de conocimiento',/base de conocimiento|casos resueltos/],['mantenimiento','Mantenimientos',/mantenimiento.*preventiv|mantenimientos proxim/],['auditoria','Auditoria',/auditoria/],['reportes','Reportes e indicadores',/indicadores|reportes/],['cambios','Solicitudes de cambio',/solicitudes de cambio/],['acceso','Usuarios y permisos',/roles y permisos|autenticar|recuperar el acceso/],['recepcion','Recepcion de vehiculos',/recepcion/],['citas','Citas',/citas/],['compras','Proveedores y compras',/proveedores|compras/],['ventas','Venta de repuestos',/ventas directas/],['inventario','Inventario y repuestos',/inventario|stock|registrar productos/],['cotizaciones','Cotizaciones',/cotizaciones|cotizacion|items autorizados/],['reparaciones','Ordenes y reparaciones',/mecanicos|actividades|progreso|estado de la reparacion/],['diagnosticos','Diagnosticos',/fallas|diagnostico|zonas del vehiculo/],['vehiculos','Vehiculos e historial',/vehiculos|vehiculo|historial/],['clientes','Clientes',/clientes/]];
 const groups=new Map();
 for(const r of (project.requirements||[]).filter(r=>r.status==='APPROVED'&&r.type==='FUNCTIONAL')){
  if(existing.some(n=>n.requirementIds.includes(r.id)))continue;
  const text=(r.description||r.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const rule=rules.find(v=>v[2].test(text));const key=rule?.[0]||r.id;const name=rule?.[1]||r.name||r.description;
  if(!groups.has(key))groups.set(key,{id:'proposal-'+key,name,route:'/'+(rule?.[0]||'pantalla-'+r.code.toLowerCase()),platform:'WEB',requirementIds:[],proposed:true});
  groups.get(key).requirementIds.push(r.id);
 }
 const requirements=new Map((project.requirements||[]).map(r=>[r.id,r]));
 return [...existing,...groups.values()].map(screen=>{
   const functionalities=(screen.requirementIds||[]).map(id=>requirements.get(id)).filter(Boolean).map(r=>({id:r.id,code:r.code,text:r.description||r.name}));
   return {...screen,description:screen.description||functionalities[0]?.text||'Pantalla definida en la navegacion del proyecto.',functionalities};
 });
}
