const test=require('node:test');const assert=require('node:assert/strict');
const resolver=require('../src/services/analysis/actorRelationshipResolver');
function fixture(){
  const segments=[{id:'profile',text:'Recepción: mantiene la información comercial.'},{id:'rf',text:'Registrar y actualizar clientes.'}];
  return {actors:[{id:'temporary',name:'Recepción',kind:'HUMAN',evidence:[{quote:segments[0].text}]}],segments,requirements:[{id:'r',statement:segments[1].text,type:'FUNCTIONAL',evidence:[{id:'rf',quote:segments[1].text}],associations:[],pending:[]}],metrics:{usage:[]}};
}
const proof=[{segmentIds:['profile'],quote:'Recepción: mantiene la información comercial.'},{segmentIds:['rf'],quote:'Registrar y actualizar clientes.'}];
test('different expressions require a second documentary verification; existing UUID wins',async()=>{
  const result=fixture();let calls=0;
  const provider={async extractDocumentBatch(input,opt){calls++;assert.equal(opt.model,'chosen');
    if(input.proposals)return {data:{verdicts:[{key:'0',supported:true,fullActionCoverage:true,fullScopeCoverage:true,reason:'La evidencia del alcance comercial respalda mantener los registros de clientes.'}]}};
    assert.equal(input.actors[0].id,'persisted');assert.ok(input.actors[0].responsibilities.length);
    return {data:{relationships:[{requirementId:'r',actorId:'persisted',role:'EXECUTOR',evidence:proof}]}};
  }};
  const options={providerInstance:provider,providerOverride:'gemini',modelOverride:'chosen',knownActors:[{id:'persisted',name:'Recepción'}]};
  await resolver.resolve(result,options);assert.equal(calls,2);assert.deepEqual(result.requirements[0].actorIds,['persisted']);
  assert.equal(result.requirements[0].associations[0].method,'VERIFIED_RESPONSIBILITY');
  await resolver.resolve(result,options);assert.equal(calls,2);
});
test('a proposal rejected by documentary verification stays pending',async()=>{
  const result=fixture();await resolver.resolve(result,{providerOverride:'openai',providerInstance:{async extractDocumentBatch(input){
    return input.proposals?{data:{verdicts:[{key:'0',supported:false,reason:'El alcance comercial no menciona gestionar clientes.'}]}}:{data:{relationships:[{requirementId:'r',actorId:'temporary',role:'EXECUTOR',evidence:proof}]}};
  }}});assert.deepEqual(result.requirements[0].actorIds||[],[]);assert.equal(result.relationshipFailures.length,1);
});
test('partial scope is insufficient even when the model labels the proposal supported',async()=>{
  const result=fixture();await resolver.resolve(result,{providerOverride:'openai',providerInstance:{async extractDocumentBatch(input){
    return input.proposals?{data:{verdicts:[{key:'0',supported:true,fullActionCoverage:true,fullScopeCoverage:false,reason:'Solo coincide parte del alcance.'}]}}:{data:{relationships:[{requirementId:'r',actorId:'temporary',role:'EXECUTOR',evidence:proof}]}};
  }}});assert.equal(result.requirements[0].associations.length,0);
});
test('being assigned a task does not establish who assigns it',()=>{
  assert.equal(resolver.supported({name:'Mecánico'},{statement:'Asignar mecánicos a una orden de trabajo.'},[{quote:'Mecánico: documenta diagnósticos, actividades y repuestos.'}]),false);
});
test('a verifier cannot replace missing responsibility evidence or fabricated quotations',async()=>{
  const result=fixture();let calls=0;await resolver.resolve(result,{providerOverride:'openai',providerInstance:{async extractDocumentBatch(){calls++;return {data:{relationships:[{requirementId:'r',actorId:'temporary',role:'EXECUTOR',evidence:[proof[1]]},{requirementId:'r',actorId:'temporary',role:'EXECUTOR',evidence:[{segmentIds:['profile'],quote:'Recepción administra permisos.'}]}]}};}}});
  assert.equal(calls,1);assert.equal(result.relationshipFailures.length,2);assert.equal(result.requirements[0].associations.length,0);
});
test('existing association does not prevent an additional evidenced actor or lose candidates',async()=>{
  const result=fixture();result.requirements[0].associations=[{actorId:'first',role:'EXECUTOR',evidence:[{quote:'Evidencia previa'}]}];
  result.actors.push({id:'second',name:'Asistente',evidence:[{quote:'Asistente: registra clientes.'}]});result.segments.push({id:'second-role',text:'Asistente: registra clientes.'});
  await resolver.resolve(result,{providerOverride:'openai',knownActors:[{id:'first',name:'Recepción'}],providerInstance:{async extractDocumentBatch(input){assert.ok(input.actors.some(a=>a.id==='second'));return {data:{relationships:[{requirementId:'r',actorId:'second',role:'EXECUTOR',evidence:[{segmentIds:['second-role'],quote:'Asistente: registra clientes.'}]}]}};}}});
  assert.deepEqual(result.requirements[0].actorIds,['first','second']);assert.equal(result.requirements.length,1);
});
