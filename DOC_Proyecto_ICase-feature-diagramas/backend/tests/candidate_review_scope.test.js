const test=require('node:test');
const assert=require('node:assert/strict');
const queries=[];
const requirements=[{id:'rf',type:'FUNCTIONAL',status:'PENDING_REVIEW'},{id:'rnf',type:'NON_FUNCTIONAL',status:'APPROVED'}];
const models=[{id:'actor',kind:'ACTOR',name:'Operador',status:'PENDING_REVIEW'}, {id:'snapshot',kind:'DOCUMENT_ANALYSIS',name:'Proyecto',status:'PENDING_REVIEW'}, {id:'objective',kind:'OBJECTIVE',name:'Objetivo',status:'PENDING_REVIEW'}];
const find=rows=>async ({where})=>{queries.push(where);return rows.filter(r=>(!where.kind||(typeof where.kind==='string'?r.kind===where.kind:where.kind.in.includes(r.kind)))&&(!where.type||(typeof where.type==='string'?r.type===where.type:where.type.in.includes(r.type)))&&(!where.status||r.status===where.status));};
const path=require.resolve('../src/config/prisma');
require.cache[path]={id:path,filename:path,loaded:true,exports:{requirementCandidate:{findMany:find(requirements)},modelCandidate:{findMany:find(models)}}};
const service=require('../src/services/analysis/candidate.service');

test('review list and totals only include RF, RNF and actors',async()=>{
  const list=await service.listByProject('project',{status:'ALL'});
  assert.deepEqual(list.map(c=>c.id),['rf','rnf','actor']);
  const stats=await service.getStats('project');
  assert.equal(stats.total,3);assert.equal(stats.pending,2);assert.equal(stats.approved,1);
  assert.equal(stats.objectives.total,0);
});

test('hidden categories are absent even with explicit filters, functional filters are exact',async()=>{
  for(const kind of ['DOCUMENT_ANALYSIS','OBJECTIVE','PROCESS','TECHNOLOGY'])assert.deepEqual(await service.listByProject('project',{kind,status:'ALL'}),[]);
  assert.deepEqual((await service.listByProject('project',{kind:'FUNCTIONAL',status:'ALL'})).map(c=>c.id),['rf']);
  assert.deepEqual((await service.listByProject('project',{kind:'ACTORES',status:'ALL'})).map(c=>c.id),['actor']);
});
