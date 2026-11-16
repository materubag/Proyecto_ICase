const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
if(process.env.AUTRON_FLOW_TEST!=='1'||process.env.DB_NAME!=='autron_flow_test')throw new Error('Esta suite solo puede ejecutarse en la base aislada autron_flow_test. Use tests/run-backend-flow.cjs.');
const models=require('/app/src/models'),bcrypt=require('bcryptjs');
const requirements=require('./requirements.json'),contracts=require('./contracts.json');
const base='http://127.0.0.1:8080';
const roles=['Administrador','Cliente','Mecánico','Recepción'];
const emails={'Administrador':'admin@nexora.ec','Cliente':'cliente@nexora.ec','Mecánico':'mecanico@nexora.ec','Recepción':'recepcion@nexora.ec'};
const tokens={},users={},context={};
const report={format:1,runId:process.env.AUTRON_FLOW_RUN_ID,startedAt:new Date().toISOString(),requirements,cases:[],requests:[],fixtures:[],notes:[
  'Los fixtures SQL habilitan pruebas independientes de componentes; no cuentan como pasos del flujo extremo a extremo.',
  'Los sondeos de disponibilidad de operaciones UC no prueban la lógica de negocio. Un 400 puede indicar validación de entrada, pero no cumplimiento funcional.',
  'RF-17 y RF-18 enumeran actores más amplios que sus precondiciones. El flujo usa Recepción para generar órdenes y asignar mecánicos.',
  'RF-07 permite recepción sin cita cuando no corresponda. Se prueba explícitamente ese caso.',
  'RF-03 no exige una cuenta de acceso del cliente como precondición. La prueba de cliente sin cuenta interpreta ese alcance; si el negocio exige lo contrario, el requisito debe aclararlo.',
  'Los payloads de rutas workshop-flow reproducen el vocabulario del frontend. Las operaciones UC carecen de contratos ejecutables; deberán concretarse al implementar esos procesos.'
]};
let active;
function noSecrets(value){
  const forbidden=new Set(['password','contrasena','hashContrasena','passwordHash','hash_contrasena']);let count=0;
  function walk(v){if(!v||typeof v!=='object')return;for(const [key,child]of Object.entries(v)){if(forbidden.has(key)&&child)count++;walk(child);}}
  walk(value);assert.equal(count,0,'La respuesta expone campos de contraseña.');
}
async function request(role,method,endpoint,body,options={}){
  const started=performance.now();const headers={...(tokens[role]?{Authorization:'Bearer '+tokens[role]}:{}),...options.headers};
  const isForm=body instanceof FormData;
  if(body&&!isForm)headers['Content-Type']='application/json';
  const r=await fetch(base+endpoint,{method,headers,...(body?{body:isForm?body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
  const text=await r.text();let json;try{json=JSON.parse(text);}catch{json=null;}
  const observation={caseId:active?.id,role:role || 'Anónimo',method,path:endpoint,status:r.status,elapsedMs:Math.round((performance.now()-started)*100)/100};
  report.requests.push(observation);active?.requests.push(observation);
  return {status:r.status,body:json,text,headers:r.headers};
}
function ok(result,expected){
  const passed=expected?([expected].flat().includes(result.status)):(result.status>=200&&result.status<300);
  assert.ok(passed,`HTTP ${result.status}: ${result.body?.code || result.body?.message || 'respuesta inesperada'}`);
  return result.body?.data ?? result.body;
}
function rejected(result,statuses=[400,409,422]){assert.ok(statuses.includes(result.status),`Debió rechazar la operación; devolvió HTTP ${result.status}.`);}
async function scenario(t,definition,fn){
  const row={kind:'acceptance',roles:[],requirements:[],...definition,status:'RUNNING',requests:[]};report.cases.push(row);
  await t.test(`[${row.id}] ${row.name}`,async st=>{
    const blockers=(row.depends || []).filter(id=>report.cases.find(c=>c.id===id)?.status!=='PASS');
    if(blockers.length){row.status='BLOCKED';row.blockedBy=blockers;row.message='No se ejecuta con IDs ficticios: faltan postcondiciones de '+blockers.join(', ');st.skip(row.message);return;}
    active=row;const started=performance.now();
    try{await fn();row.status='PASS';}catch(error){row.status='FAIL';row.message=error.message;throw error;}
    finally{row.durationMs=Math.round(performance.now()-started);active=null;}
  });
}
async function dbFixture(entity,data){const row=await models[entity].create(data);report.fixtures.push({entity,id:row.id,purpose:'Precondición aislada para pruebas de componente'});return row;}
async function fixtures(){
  const role=await models.ROL.findOne({where:{nombre:'Cliente'}});
  const hash=await bcrypt.hash('Only-For-Isolated-Tests!',10);
  context.otherUser=await dbFixture('USUARIO',{nombre:'Otro cliente de pruebas',correo:'other@example.invalid',rolId:role.id,hashContrasena:hash,estado:'ACTIVO'});
  tokens.Other=ok(await request(null,'POST','/api/auth/login',{email:context.otherUser.correo,password:'Only-For-Isolated-Tests!'}),200).token;
  const mechanicRole=await models.ROL.findOne({where:{nombre:'Mecánico'}});
  context.otherMechanic=await dbFixture('USUARIO',{nombre:'Mecánico sin asignación',correo:'other-mechanic@example.invalid',rolId:mechanicRole.id,hashContrasena:hash,estado:'ACTIVO'});
  tokens.MecOther=ok(await request(null,'POST','/api/auth/login',{email:context.otherMechanic.correo,password:'Only-For-Isolated-Tests!'}),200).token;
  context.client=await dbFixture('CLIENTE',{usuarioId:users.Cliente.id,nombre:'Cliente del flujo',correo:emails.Cliente});
  context.otherClient=await dbFixture('CLIENTE',{usuarioId:context.otherUser.id,nombre:'Otro cliente'});
  context.vehicle=await dbFixture('VEHICULO',{clienteId:context.client.id,placa:'FLOW-001',marca:'Prueba',modelo:'Taller',anio:2020,kilometrajeActual:10000});
  context.otherVehicle=await dbFixture('VEHICULO',{clienteId:context.otherClient.id,placa:'FLOW-002',marca:'Otro',modelo:'Vehículo',anio:2020,kilometrajeActual:20000});
  context.appointment=await dbFixture('CITA',{clienteId:context.client.id,vehiculoId:context.vehicle.id,usuarioId:users['Recepción'].id,fechaHora:new Date(Date.now()+86400000),motivo:'Prueba',estado:'CONFIRMADA'});
  context.reception=await dbFixture('RECEPCION',{vehiculoId:context.vehicle.id,citaId:context.appointment.id,usuarioId:users['Recepción'].id,kilometraje:10000,nivelCombustible:0.5,motivoIngreso:'Diagnóstico',fechaRecepcion:new Date()});
  context.diagnosis=await dbFixture('DIAGNOSTICO',{vehiculoId:context.vehicle.id,recepcionId:context.reception.id,usuarioId:users['Mecánico'].id,kilometraje:10000,estado:'ABIERTO'});
  context.service=await dbFixture('SERVICIO',{nombre:'Servicio de fixture',precioManoObra:100,duracionEstimada:60,activo:true});
  context.product=await dbFixture('PRODUCTO',{codigo:'FLOW-PART',nombre:'Repuesto de fixture',costo:10,precio:20,existencias:20,stockMinimo:5,activo:true});
  context.quote=await dbFixture('COTIZACION',{clienteId:context.client.id,vehiculoId:context.vehicle.id,usuarioId:users['Recepción'].id,estado:'PENDIENTE',subtotal:100,impuestos:15,total:115});
  context.line=await dbFixture('COTIZACIONDETALLE',{cotizacionId:context.quote.id,servicioId:context.service.id,descripcion:'Servicio',cantidad:1,precioUnitario:100,impuesto:15,totalLinea:115,aceptado:false});
  context.order=await dbFixture('ORDENTRABAJO',{clienteId:context.client.id,vehiculoId:context.vehicle.id,recepcionId:context.reception.id,estado:'EN_PROCESO',kilometrajeIngreso:10000});
  await dbFixture('ASIGNACIONMECANICO',{ordenTrabajoId:context.order.id,usuarioId:users['Mecánico'].id,fechaAsignacion:new Date(),estado:'ASIGNADO'});
}
function png(){
  const crc=data=>{let c=0xffffffff;for(const byte of data){c^=byte;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
  const chunk=(type,data)=>{const typeBytes=Buffer.from(type),head=Buffer.alloc(4),sum=Buffer.alloc(4);head.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([typeBytes,data])));return Buffer.concat([head,typeBytes,data,sum]);};
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(512,0);ihdr.writeUInt32BE(512,4);ihdr[8]=8;ihdr[9]=2;
  const pixels=Buffer.alloc(512*(512*3+1),128);for(let y=0;y<512;y++)pixels[y*(512*3+1)]=0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(pixels,{level:0})),chunk('IEND',Buffer.alloc(0))]);
}

test('Flujo backend por requisitos y cuatro roles',async t=>{
  try{
    for(const role of roles)await scenario(t,{id:'LOGIN-'+role,name:`Acceso real y perfil de ${role}`,roles:[role],requirements:['RF-01','RNF-03','RNF-05']},async()=>{
      const login=ok(await request(null,'POST','/api/auth/login',{email:emails[role],password:'Password123!'}),200);
      assert.equal(login.user.role,role);tokens[role]=login.token;users[role]=login.user;noSecrets(login.user);
      const me=ok(await request(role,'GET','/api/auth/me'),200);assert.equal((me.user || me).role,role);
    });
    assert.ok(roles.every(role=>tokens[role]),'Sin los cuatro accesos no se preparan fixtures.');
    await scenario(t,{id:'SEED-IDEMPOTENT',name:'La semilla mantiene cuatro cuentas y no restablece credenciales existentes',roles,requirements:['RF-01','RNF-03']},async()=>{
      const before=await models.USUARIO.findAll();const hashes=new Map(before.map(u=>[u.correo,u.hashContrasena]));
      require('node:child_process').execFileSync('node',['src/seed-demo-users.js'],{cwd:'/app',stdio:'pipe'});
      const after=await models.USUARIO.findAll();assert.equal(after.length,4);
      for(const u of after){assert.equal(u.hashContrasena===hashes.get(u.correo),true,'La semilla cambió una credencial existente.');assert.match(u.hashContrasena,/^\$2[aby]\$\d{2}\$/);assert.equal(await bcrypt.compare('Password123!',u.hashContrasena),true);}
    });
    await scenario(t,{id:'SEED-FAILURE',name:'Un fallo de aprovisionamiento de cuentas no se informa como salida exitosa',roles,requirements:['RF-01','RNF-06']},async()=>{
      const state={exitCode:0,env:{}};
      const fakeModels={sequelize:{authenticate:async()=>{throw new Error('Simulated seed failure');},close:async()=>{}}};
      const source=fs.readFileSync('/app/src/seed-demo-users.js','utf8');
      require('node:vm').runInNewContext(source,{require:name=>name==='dotenv'?{config(){}}:name==='bcryptjs'?bcrypt:fakeModels,console:{log(){},error(){}},process:state});
      await new Promise(resolve=>setImmediate(resolve));
      assert.ok(state.exitCode!==0,'La semilla captura el error pero deja exitCode=0; el arranque puede continuar sin cuentas.');
    });
    await fixtures();
    await scenario(t,{id:'AUTH-DENIED',name:'Sin sesión, token inválido y contraseña incorrecta no acceden a datos',roles,requirements:['RF-01','RNF-05','RNF-11']},async()=>{
      rejected(await request(null,'GET','/api/clientes'),[401]);
      rejected(await request(null,'GET','/api/clientes',null,{headers:{Authorization:'Bearer invalid'}}),[401]);
      rejected(await request(null,'POST','/api/auth/login',{email:emails.Administrador,password:'wrong'}),[401]);
      const expired=require('jsonwebtoken').sign({id:users.Cliente.id,role:'Cliente'},process.env.JWT_SECRET,{expiresIn:-1});
      rejected(await request(null,'GET','/api/mi/vehiculos',null,{headers:{Authorization:'Bearer '+expired}}),[401]);
    });
    await scenario(t,{id:'RF01-RECOVERY',name:'Existe un contrato de recuperación de acceso con verificación',roles,requirements:['RF-01']},async()=>{
      const openapi=JSON.parse(fs.readFileSync('/app/openapi.json','utf8'));
      assert.ok(Object.keys(openapi.paths).some(p=>/recover|forgot|recuper/i.test(p)),'No existe contrato documentado de recuperación verificada; cambiar clave con sesión no sustituye la recuperación.');
    });
    await scenario(t,{id:'RF02-PERMISSIONS',name:'Administrador puede configurar permisos, además de nombres de roles',roles:['Administrador'],requirements:['RF-02']},async()=>{
      const available=ok(await request('Administrador','GET','/api/roles'),200);assert.equal(available.length,4);
      const api=JSON.parse(fs.readFileSync('/app/openapi.json','utf8'));
      assert.ok(Object.keys(api.paths).some(p=>/permiso|permission/i.test(p)),'Hay CRUD de roles pero no contrato para configurar y aplicar permisos.');
    });
    await scenario(t,{id:'RF03-CUSTOMER',name:'Recepción registra y actualiza un cliente con persistencia',roles:['Recepción'],requirements:['RF-03']},async()=>{
      const customer=ok(await request('Recepción','POST','/api/clientes',{usuarioId:context.otherUser.id,nombre:'Cliente registrado por recepción',identificacion:'TEST-002',telefono:'0990000000'}),201);
      ok(await request('Recepción','PUT',`/api/clientes/${customer.id}`,{telefono:'0991111111'}),200);
      assert.equal(ok(await request('Recepción','GET',`/api/clientes/${customer.id}`),200).telefono,'0991111111');
    });
    await scenario(t,{id:'RF03-NO-LOGIN-ACCOUNT',name:'Recepción registra un cliente sin obligarlo a tener cuenta de acceso previa',roles:['Recepción'],requirements:['RF-03']},async()=>{
      ok(await request('Recepción','POST','/api/clientes',{nombre:'Cliente de mostrador',identificacion:'TEST-WALKIN',telefono:'0992222222'}),201);
    });
    await scenario(t,{id:'RF04-VEHICLES',name:'Cliente y Recepción registran vehículos asociados a cliente existente',roles:['Cliente','Recepción'],requirements:['RF-04']},async()=>{
      const own=ok(await request('Cliente','POST','/api/mi/vehiculos',{placa:'API-001',marca:'Prueba',modelo:'Cliente',anio:2020,kilometrajeActual:0}),201);assert.equal(own.clienteId,context.client.id);
      const staff=ok(await request('Recepción','POST','/api/vehiculos',{clienteId:context.client.id,placa:'API-002',marca:'Prueba',modelo:'Recepción'}),201);assert.equal(staff.clienteId,context.client.id);
      assert.notEqual(own.id,staff.id);
    });
    await scenario(t,{id:'RF04-OWNER',name:'Cliente no puede elegir propietario ni acceder a vehículo ajeno',roles:['Cliente'],requirements:['RF-04','RNF-05','RNF-11']},async()=>{
      rejected(await request('Cliente','POST','/api/mi/vehiculos',{clienteId:context.otherClient.id,placa:'FORGED',marca:'X',modelo:'X'}));
      rejected(await request('Cliente','GET',`/api/vehiculos/${context.otherVehicle.id}`),[403,404]);
      const list=ok(await request('Cliente','GET','/api/vehiculos'),200);assert.ok(list.every(v=>v.clienteId===context.client.id));
    });
    await scenario(t,{id:'RF05-RECORD',name:'Expediente consolida ingresos, diagnósticos y trabajos del vehículo',roles:['Recepción'],requirements:['RF-05','RF-27']},async()=>{
      const data=ok(await request('Recepción','GET',`/api/workshop-flow/expediente?vehiculoId=${context.vehicle.id}`));
      assert.ok(data.recepciones?.length&&data.diagnosticos?.length,'El expediente no incluye antecedentes ya persistidos.');
    });
    await scenario(t,{id:'RF06-CUSTOMER-APPOINTMENT',name:'Cliente solicita una cita desde el contrato del frontend',roles:['Cliente'],requirements:['RF-06']},async()=>{
      ok(await request('Cliente','POST','/api/workshop-flow/citas',{vehiculoId:context.vehicle.id,fecha:'2030-06-17',espacioId:1,motivo:'Diagnóstico de prueba'}),[200,201]);
    });
    await scenario(t,{id:'RF06-CONFLICT',name:'Agenda rechaza dos citas incompatibles para el mismo vehículo y horario',roles:['Recepción'],requirements:['RF-06','RNF-06']},async()=>{
      const payload={clienteId:context.client.id,vehiculoId:context.vehicle.id,fechaHora:'2030-06-18T14:00:00.000Z',motivo:'Duplicada',estado:'CONFIRMADA'};
      ok(await request('Recepción','POST','/api/citas',payload),201);
      rejected(await request('Recepción','POST','/api/citas',payload),[409,422]);
    });
    for(const action of ['reprogramar','cancelar'])await scenario(t,{id:'RF06-'+action,name:`Cliente puede ${action} una cita propia elegible`,roles:['Cliente'],requirements:['RF-06']},async()=>{
      ok(await request('Cliente','POST','/api/workshop-flow/citas/'+action,{citaId:context.appointment.id,espacioId:2}));
    });
    await scenario(t,{id:'RF07-RECEPTION',name:'Recepción conserva kilometraje, combustible, motivo y observaciones',roles:['Recepción'],requirements:['RF-07']},async()=>{
      const row=ok(await request('Recepción','POST','/api/recepciones',{vehiculoId:context.vehicle.id,citaId:context.appointment.id,usuarioId:users['Recepción'].id,kilometraje:11000,nivelCombustible:0.5,motivoIngreso:'Ruido',observaciones:'Observación de prueba'}),201);
      const saved=ok(await request('Recepción','GET',`/api/recepciones/${row.id}`),200);assert.equal(saved.kilometraje,11000);assert.equal(Number(saved.nivelCombustible),0.5);assert.equal(saved.motivoIngreso,'Ruido');
    });
    await scenario(t,{id:'RF07-WALK-IN',name:'Una recepción sin cita también es válida cuando no corresponde vincularla',roles:['Recepción'],requirements:['RF-07']},async()=>{
      ok(await request('Recepción','POST','/api/recepciones',{vehiculoId:context.vehicle.id,usuarioId:users['Recepción'].id,kilometraje:11000,nivelCombustible:0.5,motivoIngreso:'Ingreso sin cita'}),201);
    });
    await scenario(t,{id:'RF07-INTAKE-PHOTO',name:'Recepción adjunta evidencia de ingreso antes de existir un diagnóstico',roles:['Recepción'],requirements:['RF-07']},async()=>{
      const form=new FormData();form.append('file',new Blob([png()],{type:'image/png'}),'recepcion.png');
      const uploaded=ok(await request('Recepción','POST','/api/upload',form),201);
      ok(await request('Recepción','POST','/api/evidencia-multimedias',{recepcionId:context.reception.id,usuarioId:users['Recepción'].id,urlOriginal:uploaded.url,pesoBytes:uploaded.size,formatoMime:'image/png',observaciones:'Evidencia al ingreso'}),201);
    });
    await scenario(t,{id:'RF08-DIAGNOSIS',name:'Mecánico registra diagnóstico vinculado a vehículo y recepción',roles:['Mecánico'],requirements:['RF-08']},async()=>{
      const row=ok(await request('Mecánico','POST','/api/diagnosticos',{vehiculoId:context.vehicle.id,recepcionId:context.reception.id,usuarioId:users['Mecánico'].id,kilometraje:10000,observaciones:'Diagnóstico de prueba',estado:'ABIERTO'}),201);
      assert.equal(row.vehiculoId,context.vehicle.id);
    });
    await scenario(t,{id:'RF09-FAULT',name:'Falla conserva sistema, componente, descripción y severidad',roles:['Mecánico'],requirements:['RF-08','RF-09']},async()=>{
      const row=ok(await request('Mecánico','POST','/api/fallas',{diagnosticoId:context.diagnosis.id,sistema:'Motor',componente:'Bujía',descripcion:'Fallo de encendido',severidad:'ALTA'}),201);assert.equal(row.diagnosticoId,context.diagnosis.id);assert.equal(row.severidad,'ALTA');
    });
    await scenario(t,{id:'RF10-ZONES',name:'Estados válidos de zonas se guardan asociados al diagnóstico',roles:['Mecánico'],requirements:['RF-10']},async()=>{
      for(const estado of ['NORMAL','REVISION','FALLA','FALLA_CRITICA']){const row=ok(await request('Mecánico','POST','/api/zona-diagnosticos',{diagnosticoId:context.diagnosis.id,zona:'Zona '+estado,estado}),201);assert.equal(row.estado,estado);}
    });
    await scenario(t,{id:'RF10-INVALID-ZONE',name:'El estado de una zona no admite valores fuera de los cuatro estados requeridos',roles:['Mecánico'],requirements:['RF-10','RNF-06']},async()=>{
      rejected(await request('Mecánico','POST','/api/zona-diagnosticos',{diagnosticoId:context.diagnosis.id,zona:'Motor',estado:'VALOR_INVALIDO'}));
    });
    await scenario(t,{id:'RF11-DIAGNOSTIC-OBD',name:'Código OBD se asocia al diagnóstico, no solo a una biblioteca',roles:['Mecánico'],requirements:['RF-11']},async()=>{
      ok(await request('Mecánico','POST','/api/operations/gestionar-registro-codigos',{diagnosticoId:context.diagnosis.id,codigosObd:['P0300']}));
    });
    await scenario(t,{id:'RF12-EVIDENCE',name:'Fotografía real y observación quedan vinculadas al diagnóstico',roles:['Mecánico'],requirements:['RF-12']},async()=>{
      const form=new FormData();form.append('file',new Blob([png()],{type:'image/png'}),'diagnostico.png');
      const uploaded=ok(await request('Mecánico','POST','/api/upload',form),201);assert.ok(uploaded.url);context.upload=uploaded;
      const evidence=ok(await request('Mecánico','POST','/api/evidencia-multimedias',{recepcionId:context.reception.id,diagnosticoId:context.diagnosis.id,usuarioId:users['Mecánico'].id,urlOriginal:uploaded.url,pesoBytes:uploaded.size,formatoMime:'image/png',observaciones:'Evidencia de prueba'}),201);assert.equal(evidence.diagnosticoId,context.diagnosis.id);
    });
    await scenario(t,{id:'RF13-SERVICES',name:'Administrador mantiene descripción, precio cero, duración y estado del servicio',roles:['Administrador'],requirements:['RF-13']},async()=>{
      const row=ok(await request('Administrador','POST','/api/servicios',{nombre:'Servicio API',descripcion:'Prueba',precioManoObra:0,duracionEstimada:90,activo:true}),201);
      ok(await request('Administrador','PUT',`/api/servicios/${row.id}`,{precioManoObra:100,activo:false}),200);const saved=ok(await request('Administrador','GET',`/api/servicios/${row.id}`),200);assert.equal(Number(saved.precioManoObra),100);assert.equal(saved.activo,false);
    });
    await scenario(t,{id:'RF14-CALCULATE',name:'Cotización calcula y conserva cantidades, impuestos y total a partir de sus ítems',roles:['Recepción'],requirements:['RF-14']},async()=>{
      const quote=ok(await request('Recepción','POST','/api/cotizaciones',{clienteId:context.client.id,vehiculoId:context.vehicle.id,usuarioId:users['Recepción'].id,estado:'PENDIENTE'}),201);
      ok(await request('Recepción','POST','/api/cotizacion-detalles',{cotizacionId:quote.id,servicioId:context.service.id,descripcion:'Mano de obra',cantidad:2,precioUnitario:100,impuesto:30,totalLinea:230,aceptado:false}),201);
      const saved=ok(await request('Recepción','GET',`/api/cotizaciones/${quote.id}`),200);assert.equal(Number(saved.total),230,'El encabezado no refleja el total de sus ítems.');assert.equal(Number(saved.subtotal),200);
    });
    for(const decision of ['APROBAR','APROBAR_PARCIAL','RECHAZAR'])await scenario(t,{id:'RF15-'+decision,name:`Cliente registra decisión ${decision} sobre cotización propia`,roles:['Cliente'],requirements:['RF-15']},async()=>{
      ok(await request('Cliente','POST','/api/workshop-flow/decision',{cotizacionId:context.quote.id,decision,itemsAceptados:[context.line.id]}));
    });
    await scenario(t,{id:'RF16-DECISION-IDENTITY',name:'La decisión registra la identidad y fecha del servidor, sin permitir suplantarlas',roles:['Recepción'],requirements:['RF-16','RNF-11']},async()=>{
      const result=await request('Recepción','POST','/api/cotizacion-decisiones',{cotizacionId:context.quote.id,usuarioId:users.Administrador.id,estadoResultante:'APROBADA',fechaDecision:'1999-01-01T00:00:00.000Z'});
      if([400,403,422].includes(result.status))return;
      const row=ok(result,201);assert.equal(row.usuarioId,users['Recepción'].id,'El navegador pudo falsificar al responsable.');assert.ok(new Date(row.fechaDecision).getUTCFullYear()>2020,'El navegador pudo falsificar la fecha.');
    });
    await scenario(t,{id:'RF17-AUTHORIZATION',name:'No se genera orden para ítems que todavía no fueron autorizados',roles:['Recepción'],requirements:['RF-17','RNF-07']},async()=>{
      const pending=await dbFixture('COTIZACION',{clienteId:context.client.id,vehiculoId:context.vehicle.id,estado:'PENDIENTE'});
      rejected(await request('Recepción','POST','/api/orden-trabajos',{clienteId:context.client.id,vehiculoId:context.vehicle.id,cotizacionId:pending.id,estado:'ABIERTA'}),[400,403,409,422]);
    });
    await scenario(t,{id:'RF18-ASSIGNMENT',name:'Recepción asigna un mecánico y la asignación persiste',roles:['Recepción'],requirements:['RF-18']},async()=>{
      const row=ok(await request('Recepción','POST','/api/asignacion-mecanicos',{ordenTrabajoId:context.order.id,usuarioId:users['Mecánico'].id,fechaAsignacion:new Date().toISOString(),estado:'ASIGNADO'}),201);assert.equal(row.usuarioId,users['Mecánico'].id);
    });
    await scenario(t,{id:'RF18-ROLE-VALIDATION',name:'Una asignación de mecánico no puede apuntar a un usuario Cliente',roles:['Recepción'],requirements:['RF-18','RNF-06']},async()=>{
      rejected(await request('Recepción','POST','/api/asignacion-mecanicos',{ordenTrabajoId:context.order.id,usuarioId:users.Cliente.id,estado:'ASIGNADO'}));
    });
    await scenario(t,{id:'RF19-REPAIR-AUTHOR',name:'Documentación de reparación conserva actividades, pruebas y usuario responsable',roles:['Mecánico'],requirements:['RF-19']},async()=>{
      const row=ok(await request('Mecánico','POST','/api/orden-trabajo-detalles',{ordenTrabajoId:context.order.id,servicioId:context.service.id,actividadRealizada:'Cambio de bujías',observaciones:'Prueba',pruebasEfectuadas:'Encendido estable',estadoReparacion:'COMPLETADA',cantidad:1,precioUnitario:100}),201);
      assert.equal(row.usuarioId,users['Mecánico'].id,'El detalle de reparación no conserva el usuario responsable.');
    });
    await scenario(t,{id:'RF20-PROGRESS',name:'Cliente consulta únicamente progreso de su orden',roles:['Cliente'],requirements:['RF-20']},async()=>{
      const data=ok(await request('Cliente','GET','/api/workshop-flow/progreso'));const rows=Array.isArray(data)?data:data.ordenes;assert.ok(rows.some(row=>row.id===context.order.id));
    });
    await scenario(t,{id:'RF21-PRODUCT',name:'Administrador registra y actualiza el catálogo completo de repuestos',roles:['Administrador'],requirements:['RF-21']},async()=>{
      const row=ok(await request('Administrador','POST','/api/productos',{codigo:'API-PART',nombre:'Repuesto API',categoria:'Motor',marca:'Prueba',costo:0,precio:20,existencias:0,stockMinimo:0,activo:true}),201);assert.equal(Number(row.existencias),0);assert.equal(Number(row.stockMinimo),0);
      ok(await request('Administrador','PUT',`/api/productos/${row.id}`,{precio:25}),200);assert.equal(Number(ok(await request('Administrador','GET',`/api/productos/${row.id}`),200).precio),25);
    });
    await scenario(t,{id:'RF22-ATOMIC-STOCK',name:'Entradas y salidas actualizan stock y movimiento en una misma transacción',roles:['Administrador'],requirements:['RF-22','RNF-07']},async()=>{
      const row=await dbFixture('PRODUCTO',{codigo:'STOCK-TEST',nombre:'Stock aislado',existencias:5,stockMinimo:0});
      ok(await request('Administrador','POST','/api/inventario/movimientos',{productoId:row.id,variacion:2,motivo:'Entrada de prueba'}),201);
      rejected(await request('Administrador','POST','/api/inventario/movimientos',{productoId:row.id,variacion:-10,motivo:'Salida inválida'}),[409]);
      await row.reload();assert.equal(Number(row.existencias),7);assert.equal(await models.MOVIMIENTOINVENTARIO.count({where:{productoId:row.id}}),1);
      await Promise.all([1,1,1].map(variacion=>request('Administrador','POST','/api/inventario/movimientos',{productoId:row.id,variacion,motivo:'Concurrencia'}).then(r=>ok(r,201))));
      await row.reload();assert.equal(Number(row.existencias),10,'Se perdieron actualizaciones concurrentes.');
    });
    await scenario(t,{id:'RF23-CONSUMPTION',name:'Consumo en orden descuenta inventario y registra salida',roles:['Mecánico'],requirements:['RF-23']},async()=>{
      ok(await request('Mecánico','POST','/api/workshop-flow/ordenes/consumo',{ordenId:context.order.id,items:[{productoId:context.product.id,cantidad:2}]}));
      await context.product.reload();assert.equal(Number(context.product.existencias),18);
    });
    await scenario(t,{id:'RF24-LOW-STOCK',name:'Al alcanzar el mínimo se genera una alerta persistente automáticamente',roles:['Administrador'],requirements:['RF-24']},async()=>{
      const row=await dbFixture('PRODUCTO',{codigo:'ALERT-TEST',nombre:'Bajo stock',existencias:6,stockMinimo:5});
      ok(await request('Administrador','POST','/api/inventario/movimientos',{productoId:row.id,variacion:-1,motivo:'Cruzar umbral'}),201);
      const alerts=ok(await request('Administrador','GET','/api/alerta-stocks'),200);assert.ok(alerts.some(alert=>alert.productoId===row.id),'La alerta no fue generada.');
    });
    await scenario(t,{id:'RF25-SALE',name:'Venta directa con detalle descuenta stock sin requerir orden de trabajo',roles:['Recepción'],requirements:['RF-25','RF-23']},async()=>{
      const row=await dbFixture('PRODUCTO',{codigo:'SALE-TEST',nombre:'Venta aislada',precio:20,existencias:10,stockMinimo:0});
      const sale=ok(await request('Recepción','POST','/api/ventas',{clienteId:context.client.id,usuarioId:users['Recepción'].id,numeroDocumento:'TEST-VENTA',subtotal:40,impuestos:6,total:46}),201);
      ok(await request('Recepción','POST','/api/venta-detalles',{ventaId:sale.id,productoId:row.id,cantidad:2,precioUnitario:20,impuesto:6,totalLinea:46}),201);
      await row.reload();assert.equal(Number(row.existencias),8,'La venta se guardó sin descontar el inventario.');assert.ok(await models.MOVIMIENTOINVENTARIO.count({where:{productoId:row.id}})>0);
    });
    await scenario(t,{id:'RF26-PURCHASE',name:'Confirmar compra incrementa existencias y conserva proveedor e ítems',roles:['Administrador'],requirements:['RF-26']},async()=>{
      const vendor=ok(await request('Administrador','POST','/api/proveedores',{nombre:'Proveedor API',identificacion:'TEST-PROV'}),201);
      const row=await dbFixture('PRODUCTO',{codigo:'BUY-TEST',nombre:'Compra aislada',existencias:0,stockMinimo:0});
      const purchase=ok(await request('Administrador','POST','/api/compras',{proveedorId:vendor.id,usuarioId:users.Administrador.id,numeroDocumento:'TEST-COMPRA',estado:'BORRADOR',total:50}),201);
      ok(await request('Administrador','POST','/api/compra-detalles',{compraId:purchase.id,productoId:row.id,cantidad:5,costoUnitario:10,totalLinea:50}),201);
      ok(await request('Administrador','PUT',`/api/compras/${purchase.id}`,{estado:'CONFIRMADA',fechaConfirmacion:new Date().toISOString()}),200);
      await row.reload();assert.equal(Number(row.existencias),5,'La compra se confirmó sin incrementar existencias.');
    });
    await scenario(t,{id:'RF28-MAINTENANCE',name:'Administrador configura mantenimiento preventivo por tiempo y kilometraje',roles:['Administrador'],requirements:['RF-28']},async()=>{
      context.maintenanceVehicle=await dbFixture('VEHICULO',{clienteId:context.client.id,placa:'MAINT-001',marca:'Prueba',modelo:'Mantenimiento',kilometrajeActual:0});
      const row=ok(await request('Administrador','POST','/api/regla-mantenimientos',{vehiculoId:context.maintenanceVehicle.id,tipoVehiculo:'Automóvil',nombre:'Cambio de aceite',intervaloDias:365,intervaloKilometros:5000,anticipacionDias:15,anticipacionKilometros:500,activo:true}),201);context.rule=row;assert.equal(row.intervaloKilometros,5000);
    });
    await scenario(t,{id:'RF28-BY-TYPE',name:'Una regla preventiva puede asociarse a tipo de vehículo sin exigir vehículo individual',roles:['Administrador'],requirements:['RF-28']},async()=>{
      ok(await request('Administrador','POST','/api/regla-mantenimientos',{tipoVehiculo:'Automóvil',nombre:'Regla general por tipo',intervaloDias:365,intervaloKilometros:5000,anticipacionDias:15,anticipacionKilometros:500,activo:true}),201);
    });
    await scenario(t,{id:'RF29-MAINTENANCE-NOTICE',name:'Actualizar kilometraje próximo al vencimiento genera aviso',roles:['Recepción'],requirements:['RF-29'],depends:['RF28-MAINTENANCE']},async()=>{
      ok(await request('Recepción','PUT',`/api/vehiculos/${context.maintenanceVehicle.id}`,{kilometrajeActual:4900}),200);
      const notices=ok(await request('Recepción','GET','/api/aviso-mantenimientos'),200);assert.ok(notices.some(n=>n.vehiculoId===context.maintenanceVehicle.id),'No se generó aviso al actualizar el kilometraje.');
    });
    await scenario(t,{id:'RF30-KNOWLEDGE',name:'Mecánico y Administrador mantienen códigos, síntomas, causas y soluciones',roles:['Mecánico','Administrador'],requirements:['RF-30']},async()=>{
      const row=ok(await request('Mecánico','POST','/api/obd-conocimientos',{usuarioId:users['Mecánico'].id,codigoObd:'P0300',sintoma:'Vibración',componente:'Encendido',descripcion:'Fallo aleatorio',causa:'Bujía',solucion:'Sustituir bujía',casoResuelto:'SI'}),201);context.knowledge=row;
      ok(await request('Administrador','PUT',`/api/obd-conocimientos/${row.id}`,{solucion:'Verificar y sustituir bujías'}),200);assert.equal(ok(await request('Mecánico','GET',`/api/obd-conocimientos/${row.id}`),200).codigoObd,'P0300');
    });
    await scenario(t,{id:'RF31-SEARCH',name:'Búsqueda backend por código OBD devuelve coincidencias',roles:['Mecánico'],requirements:['RF-31']},async()=>{
      const data=ok(await request('Mecánico','POST','/api/operations/gestionar-buscar-bases',{codigoObd:'P0300'}));assert.ok((data.resultados || data).some(row=>row.codigoObd==='P0300'));
    });
    await scenario(t,{id:'RF32-INDICATORS',name:'Indicadores backend corresponden a datos operativos persistidos',roles:['Administrador'],requirements:['RF-32','RF-33']},async()=>{
      const data=ok(await request('Administrador','POST','/api/operations/consultar-reportes-e-indicadores',{desde:'2020-01-01',hasta:'2040-01-01'}));assert.ok(data.indicadores || data.reporte,'No se devolvieron indicadores ni reporte.');
    });
    await scenario(t,{id:'RF34-AUTO-AUDIT',name:'Operación crítica genera auditoría con usuario, fecha y resultado',roles:['Administrador'],requirements:['RF-34']},async()=>{
      const before=await models.AUDITORIA.count();
      const row=ok(await request('Administrador','POST','/api/productos',{codigo:'AUDIT-TEST',nombre:'Auditar alta',existencias:1,stockMinimo:0}),201);
      const audits=await models.AUDITORIA.findAll();assert.ok(audits.length>before,'No se registró auditoría automáticamente.');assert.ok(audits.some(a=>a.entidadId===row.id&&a.usuarioId===users.Administrador.id&&a.fechaHora&&a.resultado));
    });
    await scenario(t,{id:'RF34-READONLY',name:'La API ordinaria no permite editar auditorías',roles:['Administrador'],requirements:['RF-34']},async()=>{
      rejected(await request('Administrador','PUT','/api/auditorias/1',{resultado:'FALSIFICADO'}),[403,404,405]);
    });
    await securityCases(t);
    await completeFlow(t);
    await generatorRegressionCases(t);
    await businessAvailability(t);
    manualCases();
  } finally {
    report.finishedAt=new Date().toISOString();
    const directory=process.env.AUTRON_FLOW_REPORT_DIR;fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'results.json'),JSON.stringify(report,null,2)+'\n');
    await models.sequelize.close();
  }
});

async function securityCases(t){
  await scenario(t,{id:'AUTH-PROVISION',name:'Administrador registra, restablece contraseña y desactiva una cuenta; la baja invalida acceso',roles:['Administrador','Mecánico'],requirements:['RF-01','RNF-03','RNF-05']},async()=>{
    const role=await models.ROL.findOne({where:{nombre:'Mecánico'}});
    const data=ok(await request('Administrador','POST','/api/usuarios',{nombre:'Cuenta de prueba API',correo:'provision@example.invalid',rolId:role.id,contrasena:'Temporary!OnlyTests123',estado:'ACTIVO'}),201);noSecrets(data);
    const saved=await models.USUARIO.findByPk(data.id);assert.equal(await bcrypt.compare('Temporary!OnlyTests123',saved.hashContrasena),true,'La contraseña no se guardó como hash verificable.');
    ok(await request('Administrador','PUT',`/api/usuarios/${data.id}`,{contrasena:'Changed!OnlyTests123'}),200);
    rejected(await request(null,'POST','/api/auth/login',{email:data.correo,password:'Temporary!OnlyTests123'}),[401]);
    tokens.Provision=ok(await request(null,'POST','/api/auth/login',{email:data.correo,password:'Changed!OnlyTests123'}),200).token;
    ok(await request('Administrador','PUT',`/api/usuarios/${data.id}`,{estado:'INACTIVO'}),200);
    rejected(await request('Provision','GET','/api/auth/me'),[401,403]);
  });
  for(const role of roles.filter(r=>r!=='Administrador'))for(const [resource,refs,payload]of[
    ['servicios',['RF-13'],{nombre:'Servicio fuera de rol',descripcion:'Prueba de permisos',precioManoObra:10,duracionEstimada:60,activo:true}],
    ['productos',['RF-21'],{codigo:'RBAC-'+role,nombre:'Producto fuera de rol',precio:10,existencias:0,stockMinimo:0}],
    ['usuarios',['RF-01'],{nombre:'Alta administrativa fuera de rol',correo:`rbac-${roles.indexOf(role)}@example.invalid`,rolId:1,contrasena:'OnlyForForbiddenTest!',estado:'ACTIVO'}]
  ])await scenario(t,{id:`RBAC-${resource}-${role}`,name:`${role} no modifica ${resource} administrativos`,roles:[role],requirements:[...refs,'RNF-05']},async()=>{
    rejected(await request(role,'POST','/api/'+resource,payload),[403]);
  });
  const foreignAppointment=await dbFixture('CITA',{clienteId:context.otherClient.id,vehiculoId:context.otherVehicle.id,estado:'SOLICITADA'});
  const foreignQuote=await dbFixture('COTIZACION',{clienteId:context.otherClient.id,vehiculoId:context.otherVehicle.id,estado:'PENDIENTE',total:99});
  const foreignLine=await dbFixture('COTIZACIONDETALLE',{cotizacionId:foreignQuote.id,servicioId:context.service.id,cantidad:1,precioUnitario:99,totalLinea:99});
  const foreignDecision=await dbFixture('COTIZACIONDECISION',{cotizacionId:foreignQuote.id,usuarioId:context.otherUser.id,estadoResultante:'APROBADA',fechaDecision:new Date()});
  for(const[endpoint,id,refs]of[['citas',foreignAppointment.id,['RF-06']],['cotizaciones',foreignQuote.id,['RF-15']],['cotizacion-detalles',foreignLine.id,['RF-15']],['cotizacion-decisiones',foreignDecision.id,['RF-16']]])await scenario(t,{id:'IDOR-'+endpoint,name:`Cliente no consulta ${endpoint} de otro cliente`,roles:['Cliente'],requirements:[...refs,'RNF-05','RNF-11']},async()=>{
    rejected(await request('Cliente','GET',`/api/${endpoint}/${id}`),[403,404]);
  });
  await scenario(t,{id:'MECHANIC-ASSIGNMENT-ACCESS',name:'Mecánico sin asignación no modifica una orden ajena',roles:['Mecánico'],requirements:['RF-19','RNF-05','RNF-11']},async()=>{
    rejected(await request('MecOther','PUT',`/api/orden-trabajos/${context.order.id}`,{estado:'FINALIZADA'}),[403,404]);
  });
  await scenario(t,{id:'RNF07-FOREIGN-KEY',name:'Referencia inexistente se rechaza sin guardar registros huérfanos',roles:['Recepción'],requirements:['RNF-07']},async()=>{
    const before=await models.VEHICULO.count();rejected(await request('Recepción','POST','/api/vehiculos',{clienteId:999999,placa:'INVALID-FK'}));assert.equal(await models.VEHICULO.count(),before);
  });
  await scenario(t,{id:'RNF03-HASH',name:'Las contraseñas se almacenan como bcrypt y no aparecen en respuestas',roles:['Administrador'],requirements:['RNF-03']},async()=>{
    const rows=await models.USUARIO.findAll();assert.ok(rows.every(u=>/^\$2[aby]\$/.test(u.hashContrasena)));
    noSecrets(ok(await request('Administrador','GET','/api/usuarios'),200));
  });
  await scenario(t,{id:'RNF06-INPUT',name:'Tipos y propiedades desconocidas se rechazan sin cambiar registros',roles:['Administrador'],requirements:['RNF-06']},async()=>{
    const before=await models.PRODUCTO.count();rejected(await request('Administrador','POST','/api/productos',{codigo:'INVALID',nombre:'Inválido',stockDesconocido:5}));
    rejected(await request('Administrador','POST','/api/productos',{codigo:'INVALID',nombre:'Inválido',precio:'no-numérico'}));assert.equal(await models.PRODUCTO.count(),before);
  });
  await scenario(t,{id:'RNF06-DOMAIN',name:'El catálogo rechaza precio o existencias negativos',roles:['Administrador'],requirements:['RF-21','RNF-06']},async()=>{
    rejected(await request('Administrador','POST','/api/productos',{codigo:'NEGATIVE',nombre:'Inválido',precio:-10,existencias:-5,stockMinimo:-1}));
  });
  await scenario(t,{id:'RNF07-CONSISTENCY',name:'No se relaciona una orden con cliente y vehículo de propietarios distintos',roles:['Recepción'],requirements:['RNF-07']},async()=>{
    rejected(await request('Recepción','POST','/api/orden-trabajos',{clienteId:context.otherClient.id,vehiculoId:context.vehicle.id,estado:'ABIERTA'}));
  });
  await scenario(t,{id:'RNF11-UPLOAD',name:'Una evidencia técnica no se entrega anónimamente por su URL',roles:['Mecánico'],requirements:['RNF-11']},async()=>{
    assert.ok(context.upload?.url,'No se creó evidencia de precondición.');rejected(await request(null,'GET',context.upload.url),[401,403]);
  });
  await scenario(t,{id:'RNF12-OPTIMIZATION',name:'La carga produce versiones optimizada y miniatura de una imagen grande',roles:['Mecánico'],requirements:['RNF-12']},async()=>{
    assert.ok(context.upload?.urlOptimizada&&context.upload?.urlThumbnail,'El upload solo devuelve el original, sin versiones optimizadas.');
  });
  await scenario(t,{id:'RNF02-API-LATENCY',name:'Muestra local de API: diez lecturas ordinarias por debajo de un segundo',roles:['Administrador'],kind:'measurement',requirements:['RNF-02']},async()=>{
    const samples=[];for(let n=0;n<10;n++){const start=performance.now();ok(await request('Administrador','GET','/api/servicios'),200);samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);active.measurement={samples:samples.length,p95Ms:Math.round(samples[Math.ceil(samples.length*0.95)-1]),scope:'API local sin carga; no mide interfaz ni SLA de producción'};assert.ok(active.measurement.p95Ms<1000);
  });
}

async function completeFlow(t){
  const chain={};
  const steps=[
    ['E2E-01','Administrador prepara servicio y repuesto','Administrador',['RF-13','RF-21'],async()=>{chain.service=ok(await request('Administrador','POST','/api/servicios',{nombre:'Servicio E2E',descripcion:'Servicio del flujo',precioManoObra:100,duracionEstimada:60,activo:true}),201);chain.product=ok(await request('Administrador','POST','/api/productos',{codigo:'E2E-PART',nombre:'Repuesto E2E',precio:20,costo:10,existencias:10,stockMinimo:2,activo:true}),201);}],
    ['E2E-02','Cliente registra vehículo','Cliente',['RF-04'],async()=>{chain.vehicle=ok(await request('Cliente','POST','/api/mi/vehiculos',{placa:'E2E-001',marca:'Prueba',modelo:'Flujo',kilometrajeActual:0}),201);}],
    ['E2E-03','Cliente obtiene disponibilidad','Cliente',['RF-06'],async()=>{chain.slots=ok(await request('Cliente','GET','/api/workshop-flow/disponibilidad?fecha=2030-06-17'));assert.ok((chain.slots.espacios || chain.slots).length);}],
    ['E2E-04','Cliente solicita cita disponible','Cliente',['RF-06'],async()=>{const slot=(chain.slots.espacios || chain.slots)[0];chain.appointment=ok(await request('Cliente','POST','/api/workshop-flow/citas',{vehiculoId:chain.vehicle.id,espacioId:slot.id,motivo:'Revisión E2E'}));assert.ok(chain.appointment.id);}],
    ['E2E-05','Recepción confirma la cita','Recepción',['RF-06'],async()=>{ok(await request('Recepción','POST','/api/operations/uc-14/confirmar',{citaId:chain.appointment.id}));}],
    ['E2E-06','Recepción registra ingreso del vehículo','Recepción',['RF-07'],async()=>{chain.reception=ok(await request('Recepción','POST','/api/workshop-flow/recepcion',{vehiculoId:chain.vehicle.id,citaId:chain.appointment.id,kilometraje:0,nivelCombustible:0.5,motivoIngreso:'Revisión E2E',mecanicoId:users['Mecánico'].id}));assert.ok(chain.reception.id || chain.reception.recepcionId);}],
    ['E2E-07','Mecánico registra diagnóstico, falla, zona y código OBD','Mecánico',['RF-08','RF-09','RF-10','RF-11'],async()=>{chain.diagnosis=ok(await request('Mecánico','POST','/api/workshop-flow/diagnostico',{vehiculoId:chain.vehicle.id,recepcionId:chain.reception.id || chain.reception.recepcionId,fallas:[{sistema:'Motor',componente:'Bujía',descripcion:'Fallo',severidad:'ALTA',codigoObd:'P0300'}],zonas:[{zona:'Motor',estado:'FALLA'}]}));}],
    ['E2E-08','Recepción genera cotización calculada','Recepción',['RF-14'],async()=>{chain.quote=ok(await request('Recepción','POST','/api/operations/gestionar-facturacion-y-cobros',{clienteId:chain.vehicle.clienteId,vehiculoId:chain.vehicle.id,items:[{servicioId:chain.service.id,cantidad:1}]}));assert.ok(chain.quote.id);assert.ok(Number(chain.quote.total)>0);}],
    ['E2E-09','Cliente autoriza conceptos de la cotización','Cliente',['RF-15','RF-16'],async()=>{ok(await request('Cliente','POST','/api/workshop-flow/decision',{cotizacionId:chain.quote.id,decision:'APROBAR'}));}],
    ['E2E-10','Recepción genera orden solo con conceptos autorizados','Recepción',['RF-17'],async()=>{chain.order=ok(await request('Recepción','POST','/api/operations/gestionar-ordenes-de-trabajo-y-reparaciones-uc-13',{cotizacionId:chain.quote.id}));assert.ok(chain.order.id);}],
    ['E2E-11','Recepción asigna mecánico a la orden','Recepción',['RF-18'],async()=>{ok(await request('Recepción','POST','/api/workshop-flow/ordenes/mecanicos',{ordenId:chain.order.id,mecanicoIds:[users['Mecánico'].id]}));}],
    ['E2E-12','Mecánico documenta reparación y consume repuestos','Mecánico',['RF-19','RF-23'],async()=>{ok(await request('Mecánico','POST','/api/workshop-flow/ordenes/consumo',{ordenId:chain.order.id,items:[{productoId:chain.product.id,cantidad:2}],actividadRealizada:'Reparación E2E',pruebasEfectuadas:'Prueba operativa'}));}],
    ['E2E-13','Cliente consulta avance de su reparación','Cliente',['RF-20'],async()=>{const rows=ok(await request('Cliente','GET','/api/workshop-flow/progreso'));assert.ok((rows.ordenes || rows).some(row=>row.id===chain.order.id));}],
    ['E2E-14','Recepción registra venta directa y salida de inventario','Recepción',['RF-25','RF-23'],async()=>{ok(await request('Recepción','POST','/api/workshop-flow/venta',{clienteId:chain.vehicle.clienteId,items:[{productoId:chain.product.id,cantidad:1}]}));const product=ok(await request('Administrador','GET',`/api/productos/${chain.product.id}`),200);assert.equal(Number(product.existencias),7);}],
    ['E2E-15','Administrador consulta auditoría e indicadores del recorrido','Administrador',['RF-32','RF-33','RF-34'],async()=>{const audits=ok(await request('Administrador','GET','/api/auditorias'),200);assert.ok(audits.length);ok(await request('Administrador','POST','/api/operations/consultar-reportes-e-indicadores',{desde:'2020-01-01',hasta:'2040-01-01'}));}]
  ];
  for(let i=0;i<steps.length;i++){const[id,name,role,refs,fn]=steps[i];await scenario(t,{id,name,roles:[role],requirements:refs,kind:'end-to-end',depends:i?[steps[i-1][0]]:[]},fn);}
}
async function businessAvailability(t){
  for(const op of contracts.operations)for(const role of roles){
    const allowed=op.roles.includes(role);
    await scenario(t,{id:`CONTRACT-${op.id}-${role}`,name:`${op.id}: ${role} ${allowed?'dispone de contrato ejecutable':'queda rechazado por permisos'}`,requirements:op.requirements,roles:[role],kind:allowed?'availability':'declared-rbac'},async()=>{
      const result=await request(role,op.method,op.path,{});
      if(!allowed){rejected(result,[403]);return;}
      assert.ok(![401,403,404,501].includes(result.status)&&result.status<500,`Operación declarada no ejecutable: HTTP ${result.status} (${result.body?.code || result.body?.message || 'sin detalle'}).`);
    });
  }
}
async function generatorRegressionCases(t){
 await scenario(t,{id:'GEN-STOCK-ALIAS',name:'El vocabulario stock del frontend se transforma y se rechazan contradicciones',roles:['Administrador'],requirements:['RF-21','RNF-06']},async()=>{
  const row=ok(await request('Administrador','POST','/api/productos',{codigo:'ALIAS-GEN',nombre:'Alias generado',stock:3,stockMinimo:0}),201);assert.equal(Number(row.existencias),3);
  rejected(await request('Administrador','PUT','/api/productos/'+row.id,{stock:2,existencias:9}));
 });
 await scenario(t,{id:'GEN-SERVICES-ADAPTER',name:'Las rutas de servicios del frontend existen y persisten',roles:['Administrador'],requirements:['RF-13']},async()=>{
  const row=ok(await request('Administrador','POST','/api/operations/uc-25/crear',{nombre:'Alias servicio',descripcion:'Mantenimiento',duracionEstimadaMinutos:90,precioManoObra:12}),201);assert.equal(Number(row.duracionEstimada),90);
  ok(await request('Administrador','POST','/api/operations/uc-25/actualizar',{servicioId:row.id,precioManoObra:15}));
 });
 await scenario(t,{id:'GEN-IDEMPOTENCY',name:'Reintentar una salida con la misma clave no descuenta dos veces',roles:['Administrador'],requirements:['RF-22','RNF-07']},async()=>{
  const product=await dbFixture('PRODUCTO',{codigo:'RETRY-GEN',nombre:'Retry',existencias:10,stockMinimo:0});const payload={productoId:product.id,variacion:-2,motivo:'Prueba',claveOperacion:'inventory-retry'};
  ok(await request('Administrador','POST','/api/inventario/movimientos',payload),201);ok(await request('Administrador','POST','/api/inventario/movimientos',payload),201);assert.equal(Number((await models.PRODUCTO.findByPk(product.id)).existencias),8);
  rejected(await request('Administrador','POST','/api/inventario/movimientos',{...payload,variacion:-3}),[409]);
 });
 await scenario(t,{id:'GEN-SALE-ROLLBACK',name:'Una venta con stock insuficiente revierte encabezado, detalles y movimientos',roles:['Recepción'],requirements:['RF-25','RNF-07']},async()=>{
  const first=await dbFixture('PRODUCTO',{codigo:'ROLLBACK-A',nombre:'Disponible',existencias:10,precio:5,stockMinimo:0}),second=await dbFixture('PRODUCTO',{codigo:'ROLLBACK-B',nombre:'Agotado',existencias:0,precio:5,stockMinimo:0});const sales=await models.VENTA.count(),movements=await models.MOVIMIENTOINVENTARIO.count();
  rejected(await request('Recepción','POST','/api/workshop-flow/venta',{clienteId:context.client.id,items:[{productoId:first.id,cantidad:1},{productoId:second.id,cantidad:1}]}),[409]);assert.equal(await models.VENTA.count(),sales);assert.equal(await models.MOVIMIENTOINVENTARIO.count(),movements);assert.equal(Number((await models.PRODUCTO.findByPk(first.id)).existencias),10);
 });
 await scenario(t,{id:'GEN-PERMISSION-EFFECT',name:'Revocar un permiso de catálogo se aplica inmediatamente a la API',roles:['Administrador'],requirements:['RF-02']},async()=>{
  try{ok(await request('Administrador','POST','/api/workshop-flow/permisos',{rol:'Administrador',codigo:'inv.alertas',concedido:false}));rejected(await request('Administrador','PUT','/api/productos/'+context.product.id,{stockMinimo:2}),[403]);}
  finally{ok(await request('Administrador','POST','/api/workshop-flow/permisos',{rol:'Administrador',codigo:'inv.alertas',concedido:true}));}
 });
 await scenario(t,{id:'GEN-PRIVATE-FOREIGN-FILE',name:'Un cliente ajeno tampoco puede leer una evidencia autenticándose',roles:['Cliente'],requirements:['RNF-11']},async()=>{assert.ok(context.upload?.url);rejected(await request('Other','GET',context.upload.url),[403,404]);});
 await scenario(t,{id:'GEN-TEMPORARY-ACCOUNT',name:'El alta de usuario de la pantalla genera una contraseña temporal válida',roles:['Administrador'],requirements:['RF-01']},async()=>{
  const account=ok(await request('Administrador','POST','/api/workshop-flow/usuarios',{nombre:'Nuevo usuario',correo:'temporary-generator@example.invalid',rol:'Mecánico'}),201);assert.ok(account.passwordTemporal?.length>=16);assert.equal(account.cambioObligatorio,true);const login=ok(await request(null,'POST','/api/auth/login',{email:account.correo,password:account.passwordTemporal}),200);assert.equal(login.user.cambioObligatorio,true);
  tokens.Temporary=login.token;rejected(await request('Temporary','GET','/api/servicios'),[428]);
  ok(await request('Temporary','POST','/api/auth/change-password',{claveActual:account.passwordTemporal,nuevaClave:'Changed!Generator123'}));
  rejected(await request('Temporary','GET','/api/auth/me'),[401]);const fresh=ok(await request(null,'POST','/api/auth/login',{email:account.correo,password:'Changed!Generator123'}),200);assert.equal(fresh.user.cambioObligatorio,false);
 });
 await scenario(t,{id:'GEN-PHASE-ONCE',name:'Finalizar una orden descuenta solo el consumo pendiente y permite reintentos',roles:['Recepción','Mecánico','Cliente'],requirements:['RF-17','RF-18','RF-19','RF-23']},async()=>{
  const product=await dbFixture('PRODUCTO',{codigo:'PHASE-GEN',nombre:'Repuesto de finalización',existencias:10,precio:5,stockMinimo:0});
  const quote=ok(await request('Recepción','POST','/api/operations/gestionar-facturacion-y-cobros',{clienteId:context.client.id,vehiculoId:context.vehicle.id,items:[{servicioId:context.service.id,productoId:product.id,cantidad:3}]}));
  ok(await request('Cliente','POST','/api/workshop-flow/decision',{cotizacionId:quote.id,decision:'APROBAR'}));
  const order=ok(await request('Recepción','POST','/api/workshop-flow/ordenes',{cotizacionId:quote.id}),201);assert.equal(Number((await models.PRODUCTO.findByPk(product.id)).existencias),10);
  ok(await request('Recepción','POST','/api/workshop-flow/ordenes/mecanicos',{ordenId:order.id,mecanicoIds:[users['Mecánico'].id]}));
  ok(await request('Mecánico','POST','/api/workshop-flow/ordenes/consumo',{ordenId:order.id,items:[{productoId:product.id,cantidad:2}],actividadRealizada:'Consumo parcial'}));assert.equal(Number((await models.PRODUCTO.findByPk(product.id)).existencias),8);
  ok(await request('Mecánico','POST','/api/workshop-flow/fase',{ordenId:order.id,fase:'EN_REPARACION'}));
  ok(await request('Mecánico','POST','/api/workshop-flow/fase',{ordenId:order.id,fase:'FINALIZADA'}));
  ok(await request('Mecánico','POST','/api/workshop-flow/fase',{ordenId:order.id,fase:'FINALIZADA'}));assert.equal(Number((await models.PRODUCTO.findByPk(product.id)).existencias),7);
 });
 await scenario(t,{id:'GEN-EXPIRED-QUOTE',name:'Una cotización vencida no admite aprobación ni crea decisiones',roles:['Cliente'],requirements:['RF-15','RNF-07']},async()=>{
  const quote=await dbFixture('COTIZACION',{clienteId:context.client.id,vehiculoId:context.vehicle.id,estado:'PENDIENTE',fechaVencimiento:new Date('2000-01-01')});const count=await models.COTIZACIONDECISION.count();rejected(await request('Cliente','POST','/api/workshop-flow/decision',{cotizacionId:quote.id,decision:'APROBAR'}),[409]);assert.equal(await models.COTIZACIONDECISION.count(),count);
 });
}
function manualCases(){
  for(const[code,reason]of[
    ['RNF-01','Requiere pruebas de navegadores, resoluciones y operatividad del frontend.'],
    ['RNF-04','Debe verificarse en el despliegue HTTPS de producción; este entorno HTTP aislado no lo certifica.'],
    ['RNF-08','Requiere política de respaldos, ejecución programada y restauración ensayada en un entorno dedicado.'],
    ['RNF-09','Requiere evaluación de tareas y mensajes con usuarios; no se infiere de la API.'],
    ['RNF-10','Requiere revisión arquitectónica de responsabilidades y dependencias; una prueba HTTP no la certifica.']
  ])report.cases.push({id:'MANUAL-'+code,name:reason,kind:'manual',requirements:[code],roles:[],status:'NOT_EVALUATED',message:reason,requests:[]});
}
