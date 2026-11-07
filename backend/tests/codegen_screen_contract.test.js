const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFieldContract, buildScreenContract, renderFields, inferScreenRoles, inferScreenEntity } = require('../src/services/codegen/screenContract');
const { generateInteractiveMockupComponent } = require('../src/services/codegen/mockupConverter');
const entities = [
 { id:'client', name:'Cliente', attributes:[{fieldName:'claveCliente',type:'UUID',isPk:true},{fieldName:'nombre',type:'STRING'}] },
 { id:'vehicle', name:'Vehiculo', attributes:[{fieldName:'claveVehiculo',type:'INTEGER',isPk:true},{fieldName:'clienteId',type:'UUID',allowNull:false},{fieldName:'placa',type:'STRING'}] }
];
const relationships = [{sourceEntityId:'client',sourceEntity:'Cliente',targetEntityId:'vehicle',targetEntity:'Vehiculo',cardinality:'1:N',foreignKey:'clienteId'}];
test('Shared field contract resolves nonstandard PK and readable FK label', () => {
 const fields = buildFieldContract(entities[1],relationships,entities);
 const markup = renderFields(fields);
 assert.ok(!markup.includes('name={"claveVehiculo"}'));
 assert.ok(markup.includes('opt["claveCliente"]'));
 assert.ok(markup.includes('opt["nombre"]'));
 const code=generateInteractiveMockupComponent('Vehicle',{name:'Vehicle',contract:{fields,actions:[]}},'<main />');
 assert.ok(code.includes('opt["claveCliente"]'));
 assert.ok(!code.includes('1 - Administrador'));
});
test('Screen titles never grant roles; actor links are required', () => {
  const actors = [{ id: 'a1', name: 'Administrador' }, { id: 'c1', name: 'Cliente' }, { id: 'r1', name: 'Recepción' }];
  assert.deepEqual(inferScreenRoles({ name: 'Portal Cliente: Mis Vehículos', route: '/mis-vehiculos' }, actors), []);
  assert.deepEqual(inferScreenRoles({ name: 'Recepción e Inspección de Vehículos', route: '/recepcion', actorIds: ['r1'] }, actors), ['Recepción']);
});

test('Password storage fields become Contraseña inputs, never passwordHash', () => {
  const fields = buildFieldContract({
    name: 'USUARIO',
    attributes: [
      { fieldName: 'id', isPk: true, type: 'INTEGER' },
      { fieldName: 'correo', type: 'STRING' },
      { fieldName: 'passwordHash', type: 'STRING' }
    ]
  });
  const secret = fields.find(f => f.fieldName === 'passwordHash');
  assert.equal(secret.label, 'Contraseña');
  assert.equal(secret.control, 'password');
  const markup = renderFields(fields);
  assert.ok(markup.includes('type="password"'));
  assert.ok(markup.includes('Contraseña'));
  assert.ok(!markup.includes('password Hash'));
});

test('Foreign keys named *Id become selectors, never raw id inputs', () => {
  const fields = buildFieldContract(
    { name: 'Movimiento', attributes: [{ fieldName: 'id', isPk: true, type: 'INTEGER' }, { fieldName: 'ordenTrabajoId', type: 'INTEGER' }, { fieldName: 'cantidad', type: 'INTEGER' }] },
    [],
    [{ id: 'ot', name: 'Orden de trabajo', modelName: 'OrdenTrabajo', endpoint: 'orden-trabajos', attributes: [{ fieldName: 'id', isPk: true, type: 'INTEGER' }, { fieldName: 'estado', type: 'STRING' }] }]
  );
  const fk = fields.find(f => f.fieldName === 'ordenTrabajoId');
  assert.ok(fk.relation, 'ordenTrabajoId debe resolverse a un selector');
  assert.equal(fk.relation.dataSource, 'orden-trabajos');
  const markup = renderFields(fields);
  assert.ok(markup.includes('<select'));
  assert.ok(!markup.includes('htmlFor={"id"}'));
});

test('Operational screens infer their entity and bind list/create CRUD', () => {
  const cita = { id: 'cita', name: 'Cita', modelName: 'Cita', tableName: 'citas', endpoint: 'citas', attributes: [{ fieldName: 'id', isPk: true, type: 'INTEGER' }, { fieldName: 'fecha', type: 'DATE' }] };
  const vehiculo = entities[1];
  const ops = [
    { operationId: 'op_citas_list', method: 'GET', route: '/api/citas', entity: 'Cita', authorizedRoles: ['Recepción'] },
    { operationId: 'op_citas_create', method: 'POST', route: '/api/citas', entity: 'Cita', authorizedRoles: ['Recepción'] },
    { operationId: 'op_vehiculos_list', method: 'GET', route: '/api/vehiculos', entity: 'Vehiculo', authorizedRoles: ['Recepción'] },
    { operationId: 'op_vehiculos_create', method: 'POST', route: '/api/vehiculos', entity: 'Vehiculo', authorizedRoles: ['Recepción'] }
  ];
  assert.equal(inferScreenEntity({ name: 'Agenda y Gestión de Citas de Taller' }, [cita, vehiculo]).modelName, 'Cita');
  const agenda = buildScreenContract({ name: 'Agenda y Gestión de Citas de Taller', route: '/citas' }, { entities: [cita, vehiculo], relationships: [], operations: ops });
  assert.ok(agenda.actions.length, 'Citas queda con operaciones');
  assert.ok(!agenda.unresolved.some(m => /operaciones explícitas/.test(m)));
  const recepcion = buildScreenContract({ name: 'Recepción e Inspección de Vehículos', route: '/recepcion' }, { entities: [cita, vehiculo], relationships: [], operations: ops });
  assert.ok(recepcion.actions.length, 'Recepción queda con operaciones del vehículo');
  assert.ok(!recepcion.unresolved.some(m => /operaciones explícitas/.test(m)));
});

test('Reception has no inferred vehicle write and honors explicit process binding', () => {
 const spec={entities,relationships,operations:[{operationId:'receive',method:'POST',route:'/api/operations/receive',authorizedRoles:['Operador']}]};
 assert.ok(buildScreenContract({name:'Recepción vehículo'},spec).unresolved.length);
 const contract=buildScreenContract({name:'Recepción',contract:{actions:[{operationId:'receive',route:'/api/vehiculos'}]}},spec);
 assert.equal(contract.actions[0].route,'/api/operations/receive');
 assert.deepEqual(contract.actions[0].permissions,['Operador']);
});

test('Exported API enforces operation permissions over HTTP', async () => {
 const vm = require('vm');
 const express = require('express');
 const jwt = require('jsonwebtoken');
 const { generateAuthMiddlewareFile } = require('../src/services/codegen/authGenerator');
 const { generateEntityRoutesFile } = require('../src/services/codegen/routeGenerator');
 const authModule={exports:{}};
 vm.runInNewContext(generateAuthMiddlewareFile(), {module:authModule,exports:authModule.exports,require,process:{env:{JWT_SECRET:'contract-test-secret'}},console});
 const routeModule={exports:{}};
 const controller={create:(req,res)=>res.status(201).json({role:req.user.role})};
 for(const name of ['getAll','getById','update','delete']) controller[name]=(req,res)=>res.json({ok:true});
 const entity={...entities[1],modelName:'Vehiculo'};
 const code=generateEntityRoutesFile(entity,{hasAuth:true,operations:[{entity:'Vehiculo',method:'POST',route:'/api/vehiculos',authorizedRoles:['Operador']}]});
 vm.runInNewContext(code,{module:routeModule,exports:routeModule.exports,require:name=>name==='express'?express:name.includes('auth.middleware')?authModule.exports:controller});
 const app=express();app.use('/api/vehiculos',routeModule.exports);
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const url='http://127.0.0.1:'+server.address().port+'/api/vehiculos';
 try {
  assert.equal((await fetch(url,{method:'POST'})).status,401);
  const token=role=>jwt.sign({id:'test-user',role},'contract-test-secret');
  assert.equal((await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token('Visitante')}})).status,403);
  assert.equal((await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token('Operador')}})).status,201);
  assert.equal((await fetch(url,{headers:{Authorization:'Bearer '+token('Operador')}})).status,403,'Undeclared GET permission is denied');
 } finally { await new Promise(resolve=>server.close(resolve)); }
});
