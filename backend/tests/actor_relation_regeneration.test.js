const test=require('node:test');const assert=require('node:assert/strict');
const envPath=require.resolve('../src/config/env');require.cache[envPath]={id:envPath,filename:envPath,loaded:true,exports:{AI_PROVIDER:'openai',OPENAI_MODEL:'chosen'}};
const service=require('../src/services/analysis/actorRelationRegeneration');
function fixture(){
  const actors=[{id:'manual',name:'Operador'},{id:'new',name:'Recepción'}];
  const rows=[{id:'r',projectId:'p',code:'RF-01',type:'FUNCTIONAL',description:'Registrar clientes.',actorIds:['manual'],sources:{}},{id:'unknown',projectId:'p',code:'RF-02',type:'FUNCTIONAL',description:'Realizar tarea.',actorIds:[],sources:{}},{id:'rnf',projectId:'p',code:'RNF-01',type:'NON_FUNCTIONAL',description:'Disponibilidad.',actorIds:[],sources:{}}];
  const audit=[],cases=[{id:'case',requirementIds:['r'],sources:{}}];
  const db={project:{findUnique:async()=>({id:'p'})},actor:{findMany:async()=>actors},source:{findMany:async()=>[{id:'source',name:'Documento',currentVersion:{id:'v',extractedText:'Recepción: registra clientes.'}}]},modelCandidate:{findMany:async()=>[],create:async({data})=>audit.push(data)},requirement:{findMany:async()=>rows,findUnique:async({where})=>rows.find(r=>r.id===where.id),update:async({where,data})=>Object.assign(rows.find(r=>r.id===where.id),data)},requirementCandidate:{findMany:async()=>[]},useCase:{findMany:async()=>cases,update:async({data})=>Object.assign(cases[0],data)},artifact:{updateMany:async()=>{}},$transaction:async fn=>fn(db)};
  return {db,rows,audit,cases};
}
test('regeneration preserves manual links, adds validated UUIDs, reports pending and leaves RNF intact',async()=>{
  const f=fixture();const resolve=async(result,options)=>{assert.equal(options.modelOverride,'chosen');const r=result.requirements[0];r.associations=[{actorId:'new',role:'EXECUTOR',evidence:[{quote:'Recepción: registra clientes.'}]}];};
  const summary=await service.run({projectId:'p'},{db:f.db,resolve});
  assert.deepEqual(f.rows[0].actorIds,['manual','new']);assert.deepEqual(f.rows[2].actorIds,[]);
  assert.equal(summary.linksAdded,1);assert.equal(summary.pending.length,1);assert.equal(summary.affectedUseCases,1);
  assert.equal(f.cases[0].sources.actorRelationsOutdated,true);assert.equal(f.audit[0].content.changes[0].before.actorIds.length,1);
  const again=await service.run({projectId:'p'},{db:f.db,resolve});assert.equal(again.linksAdded,0);assert.equal(f.rows.length,3);
});
test('failed AI does not replace existing associations',async()=>{
  const f=fixture();await assert.rejects(service.run({projectId:'p'},{db:f.db,resolve:async r=>{r.relationshipFailures=[{requirementIds:['r'],message:'provider unavailable'}];}}),{statusCode:502});assert.deepEqual(f.rows[0].actorIds,['manual']);assert.equal(f.audit.length,0);
});
test('concurrent requirement changes are left pending without applying stale conclusions',async()=>{
  const f=fixture();const result=await service.run({projectId:'p'},{db:f.db,resolve:async r=>{f.rows[0].description='Nueva acción.';r.requirements[0].associations=[{actorId:'new',role:'EXECUTOR',evidence:[{quote:'Cita'}]}];}});
  assert.equal(result.linksAdded,0);assert.ok(result.pending.some(r=>r.id==='r'&&r.reason.includes('cambió')));assert.deepEqual(f.rows[0].actorIds,['manual']);
});
