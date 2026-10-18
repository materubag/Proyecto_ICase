const test=require('node:test');const assert=require('node:assert/strict');
let row={id:'r',projectId:'p',code:'RF-01',name:'Registrar clientes',description:'El sistema permite registrar clientes.',type:'FUNCTIONAL',priority:'MEDIUM',status:'APPROVED',revision:1,isDeleted:false,actorIds:[],dependencies:[]};
const original=JSON.parse(JSON.stringify(row)),changes=new Map(),versions=[];
const db={requirement:{findUnique:async()=>({...row}),update:async({data})=>{row={...row,...data,revision:row.revision+1};return {...row};}},changeRequest:{create:async({data})=>{const r={id:String(changes.size),status:'PENDING_APPROVAL',...data};changes.set(r.id,r);return r;},findFirst:async({where})=>changes.get(where.id),update:async({where,data})=>Object.assign(changes.get(where.id),data)},requirementVersion:{upsert:async({create})=>versions.push(create),findFirst:async()=>({content:original})}};
db.$transaction=async fn=>fn(db);
function stub(path,exports){const id=require.resolve(path);require.cache[id]={id,filename:id,loaded:true,exports};}
stub('../src/config/prisma',db);
stub('../src/services/engineering/ImpactAnalysisService',{analyze:async()=>({affected:[]}),invalidate:async()=>{}});
const service=require('../src/services/engineering/change.service');
test('confirmed deletion hides requirement while preserving UUID, history and restoration',async()=>{
  const change=await service.propose('p',{type:'DELETE',elementType:'Requirement',elementId:'r',reason:'Eliminar requisito'});
  assert.equal(row.isDeleted,false);
  await service.review('p',change.id,{status:'APPROVED',confirmImpact:true});
  assert.equal(row.status,'REMOVED');assert.equal(row.isDeleted,true);assert.equal(row.id,'r');assert.equal(versions.length,2);
  const restore=await service.propose('p',{type:'RESTORE',elementType:'Requirement',elementId:'r',basedOnVersionId:'previous',reason:'Restaurar requisito'});
  await service.review('p',restore.id,{status:'APPROVED',confirmImpact:true});
  assert.equal(row.isDeleted,false);assert.equal(row.status,'APPROVED');assert.equal(row.id,'r');
});
test('project detail, updates and counts exclude both removed and soft-deleted requirements',async()=>{
  const calls=[];db.project={findUnique:async query=>{calls.push(query);return {id:'p'};},findMany:async query=>{calls.push(query);return [];},update:async query=>{calls.push(query);return {id:'p'};}};
  const projects=require('../src/services/project.service');
  await projects.getProjectById('p');await projects.getAllProjects();await projects.updateProject('p',{name:'Proyecto'});
  for(const q of calls.filter(q=>q.include)){const where=q.include.requirements?.where||q.include._count.select.requirements.where;assert.deepEqual(where,{isDeleted:false,status:{not:'REMOVED'}});}
});
