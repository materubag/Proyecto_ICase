const test=require('node:test');
const assert=require('node:assert/strict');
const actors=[{id:'actor-uuid',name:'Operador',projectId:'project',status:'PENDING_REVIEW'}];
const requirements=[{id:'approved-rf',actorIds:[],status:'APPROVED',sources:{}},{id:'unknown-rf',actorIds:[],status:'APPROVED',sources:{}}];
const tx={
  actor:{update:async({where,data})=>Object.assign(actors.find(a=>a.id===where.id),data),findMany:async()=>actors},
  modelCandidate:{findMany:async()=>[{fingerprint:'temporary-role',name:'Operador',status:'PENDING_REVIEW'}]},
  requirementCandidate:{findMany:async()=>[{promotedRequirementId:'approved-rf',evidence:{associations:[{actorId:'temporary-role',role:'EXECUTOR',evidence:[{quote:'Operador: registra pedidos.'}]}]}}]},
  requirement:{findMany:async()=>requirements,update:async({where,data})=>Object.assign(requirements.find(r=>r.id===where.id),data)}
};
const path=require.resolve('../src/config/prisma');
require.cache[path]={id:path,filename:path,loaded:true,exports:{$transaction:async fn=>fn(tx)}};
const service=require('../src/services/actor.service');
test('approving an actor from its list links previously approved requirements without reapproval',async()=>{
  await service.updateStatus('actor-uuid','APPROVED');
  assert.deepEqual(requirements[0].actorIds,['actor-uuid']);
  assert.deepEqual(requirements[1].actorIds,[]);
  assert.equal(requirements[0].status,'APPROVED');
  await service.updateStatus('actor-uuid','APPROVED');
  assert.deepEqual(requirements[0].actorIds,['actor-uuid']);
  assert.equal(requirements.length,2);assert.equal(actors.length,1);
});
