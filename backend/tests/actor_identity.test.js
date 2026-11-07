const test=require('node:test'),assert=require('node:assert/strict');
const identity=require('../src/services/analysis/actorIdentity');
const generator=require('../src/services/diagrams/useCaseGenerator');
const actors=[{id:'uuid-a',codeId:'ACT-01',name:'Operadora'},{id:'uuid-b',codeId:'ACT-02',name:'Cliente'}];
test('resolves explicit identities; ambiguity stays pending',()=>{
  assert.equal(identity.resolve('ACT-01',actors),'uuid-a');
  assert.equal(identity.resolve('Cliente',actors),'uuid-b');
  assert.equal(identity.resolve('temp',actors,[{fingerprint:'temp',promotedId:'uuid-a'}]),'uuid-a');
  assert.equal(identity.resolve('Cliente',[...actors,{id:'uuid-c',name:'Cliente'}]),null);
});
test('temporary extracted actors reuse the existing catalog without promotion or generic fallback',()=>{
  const models=[{id:'model',fingerprint:'tmp',name:'Operadora',status:'PENDING_REVIEW',content:{id:'temporary'}}];
  assert.equal(identity.resolve('temporary',actors,models),'uuid-a');
  assert.equal(identity.resolve('tmp',actors,models),'uuid-a');
  assert.equal(identity.resolve('Usuario del Sistema',actors,models),null);
  assert.equal(identity.resolve('temporary',[...actors,{id:'third',name:'Operadora'}],models),null);
});
test('diagram context keeps requirement identities and links, with no phantom actor',()=>{
  const builder=require('../src/services/diagrams/diagramContextBuilder');
  const context=builder.buildContext('USE_CASE',{actors,requirements:[{id:'r',type:'FUNCTIONAL',name:'Registrar',actorIds:['uuid-a']}],useCases:[]});
  assert.equal(context.actors.length,2);assert.equal(context.actors[0].id,'uuid-a');
  assert.deepEqual(context.functionalRequirements[0].actorIds,['uuid-a']);
  assert.equal(context.functionalRequirements[0].id,'r');
  const empty=builder.buildContext('USE_CASE',{actors:[],requirements:[]});
  assert.deepEqual(empty.actors,[]);assert.ok(!JSON.stringify(context).includes('Usuario del Sistema'));
});
test('reanalysis restores evidence-backed links to existing actors without creating an actor',async()=>{
  const rows=[{id:'r',actorIds:[],sources:{}}];let updates=0;
  const models=[{fingerprint:'temporary',name:'Operadora',status:'PENDING_REVIEW'}];
  const tx={actor:{findMany:async()=>actors},modelCandidate:{findMany:async()=>models},requirementCandidate:{findMany:async()=>[{promotedRequirementId:'r',evidence:{associations:[{actorId:'temporary',role:'EXECUTOR',evidence:[{quote:'La operadora registra'}]}]}}]},requirement:{findMany:async()=>rows,update:async({data})=>{updates++;Object.assign(rows[0],data);}}};
  await identity.refresh(tx,'p');assert.deepEqual(rows[0].actorIds,['uuid-a']);assert.equal(actors.length,2);
  await identity.refresh(tx,'p');assert.equal(updates,1);
});
test('all edges terminate at declared actors; unknown references fail',()=>{
  const code=generator.generate(actors,[{id:'case',code:'CU-01',name:'Registrar',actorIds:['uuid-a'],primaryActorId:'uuid-a',secondaryActorIds:['uuid-b']}]);
  const edges=code.split('\n').filter(l=>l.includes(' --- '));
  assert.equal(edges.length,2);
  for(const edge of edges){const source=edge.trim().split(' ')[0];assert.ok(code.split('\n').some(l=>l.trim().startsWith(source+'((')));}
  assert.throws(()=>generator.generate(actors,[{id:'c',actorIds:['ACT-01']}]),{code:'UNRESOLVED_ACTOR_REFERENCE'});
  assert.equal(generator.generate(actors,[{id:'c',name:'Pendiente'}]).includes(' --- '),false);
});
test('late actor promotion and reanalysis preserve links, recipients are not executors',async()=>{
  let rows=[{id:'r',actorIds:[],sources:{associations:[{actorId:'temporary',role:'EXECUTOR',evidence:[{quote:'La operadora registra'}]},{actorId:'recipient',role:'RECIPIENT',evidence:[{quote:'para el cliente'}]}]}}];
  let models=[];
  const tx={actor:{findMany:async()=>actors},modelCandidate:{findMany:async()=>models},requirement:{findMany:async()=>rows,update:async({data})=>{rows[0]={...rows[0],...data};}}};
  await identity.refresh(tx,'p');assert.deepEqual(rows[0].actorIds,[]);
  models=[{fingerprint:'temporary',promotedId:'uuid-a'},{fingerprint:'recipient',promotedId:'uuid-b'}];
  await identity.refresh(tx,'p');assert.deepEqual(rows[0].actorIds,['uuid-a']);
  await identity.refresh(tx,'p');assert.deepEqual(rows[0].actorIds,['uuid-a']);assert.equal(rows.length,1);
});
test('local extraction does not call AI or invent associations',async()=>{
  const {extract}=require('../src/services/analysis/documentExtraction');let calls=0;
  const result=await extract('RF-01 Registrar pedidos.',{providerOverride:'local',cache:false,providerInstance:{extractDocumentBatch:async()=>{calls++;throw Error('called');}}});
  assert.equal(calls,0);assert.equal(result.requirements.length,1);assert.deepEqual(result.requirements[0].actorIds,[]);
});
test('generation preserves multiple actors and repeated generation reuses persisted cases',async()=>{
  const service=require('../src/services/useCase.service');
  const rows=[];
  const requirements=[{id:'r1',code:'RF-01',type:'FUNCTIONAL',name:'Registrar pedidos',actorIds:['uuid-a','uuid-b']}];
  const db={project:{findUnique:async()=>({actors,requirements})},useCase:{findMany:async()=>rows,create:async({data})=>{const row={id:'case',...data};rows.push(row);return row;},update:async({data})=>Object.assign(rows[0],data)}};
  db.modelCandidate={findMany:async()=>[]};
  const first=await service.generateFundamentalUseCases('p',db);
  assert.deepEqual(first[0].actorIds,['uuid-a','uuid-b']);
  assert.equal(first[0].primaryActorId,'uuid-a');
  assert.deepEqual(first[0].requirementIds,['r1']);
  assert.equal(first[0].preconditions,null);
  await service.generateFundamentalUseCases('p',db);
  assert.equal(rows.length,1);
  assert.equal(generator.generate(actors,rows).split('\n').filter(l=>l.includes(' --- ')).length,2);
});
test('dedicated relationship pass survives unrelated extraction failures and uses existing UUIDs',async()=>{
  const resolver=require('../src/services/analysis/actorRelationshipResolver');
  const result={requirements:[{id:'r',type:'FUNCTIONAL',statement:'Permitir al cliente consultar el progreso.',associations:[],pending:['Responsable pendiente de revisión'],evidence:[{id:'s'}]}],segments:[{id:'s',text:'Permitir al cliente consultar el progreso.',start:0,end:43}],metrics:{requestsUsed:0},partial:true,failures:[{message:'Invalid coverage in other batch'}]};
  let calls=0;
  const provider={extractDocumentBatch:async(input,options)=>{calls++;assert.equal(input.actors[1].id,'uuid-b');assert.ok(options.prompt.includes('EXECUTOR'));return {data:{relationships:[{requirementId:'r',actorId:'uuid-b',role:'EXECUTOR',segmentIds:['s'],quote:'Permitir al cliente consultar el progreso.'},{requirementId:'r',actorId:'phantom',role:'EXECUTOR',segmentIds:['s'],quote:'Permitir al cliente consultar el progreso.'}]}};}};
  await resolver.resolve(result,{knownActors:actors,providerOverride:'openai',providerInstance:provider});
  assert.equal(calls,1);assert.deepEqual(result.requirements[0].actorIds,['uuid-b']);assert.equal(result.relationshipFailures.length,1);assert.equal(result.requirements.length,1);assert.equal(actors.length,2);
  await resolver.resolve(result,{knownActors:actors,providerOverride:'openai',providerInstance:provider});assert.equal(calls,1);
});
test('relationship pass never calls AI in local mode',async()=>{
  const result={requirements:[{type:'FUNCTIONAL',associations:[]}],metrics:{}};
  await require('../src/services/analysis/actorRelationshipResolver').resolve(result,{knownActors:actors,providerOverride:'local',providerInstance:{extractDocumentBatch:()=>{throw Error('Unexpected AI call');}}});
});
