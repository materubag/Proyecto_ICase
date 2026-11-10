const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const p=require('../src/services/codegen/deliveryPolicy');
const {DeliveryWorkflow}=require('../src/services/codegen/deliveryWorkflow');
const {DeliveryRuntime,writeFiles,manifest,safeFile}=require('../src/services/codegen/deliveryRuntime');
test('approvals require current content, technical validation and separate human decision',()=>{
  const value=p.artifact({value:1});value.validation={passed:true};value.review={status:'SUCCEEDED'};
  assert.equal(!!p.approved(value),false);value.approval={contentHash:p.hash(value.content)};assert.ok(p.approved(value));value.content.value=2;assert.equal(!!p.approved(value),false);
  assert.throws(()=>p.assertStage({documentApproved:true,stages:{}},2),/anterior/);
});
test('incremental files preserve unrelated sources, reject conflicts and preserve applied migrations',()=>{
  const directory=fs.mkdtempSync(path.resolve(__dirname,'../.verification/incremental-'));
  writeFiles(directory,[{path:'backend/src/a.js',content:'first'},{path:'backend/src/b.js',content:'unaffected'},{path:'backend/src/migrations/001.js',content:'migration'}]);
  const prior=manifest(directory);writeFiles(directory,[{path:'backend/src/a.js',content:'second'}],prior);
  assert.equal(fs.readFileSync(path.join(directory,'backend/src/b.js'),'utf8'),'unaffected');
  fs.writeFileSync(path.join(directory,'backend/src/a.js'),'manual');
  assert.throws(()=>writeFiles(directory,[{path:'backend/src/a.js',content:'AI'}],prior),/Conflicto/);
  assert.throws(()=>writeFiles(directory,[{path:'backend/src/migrations/001.js',content:'replace'}],prior),/Conflicto/);
  assert.throws(()=>safeFile(directory,'../outside'),/Ruta/);
});
test('additive column changes create a new migration and require a policy for old rows',()=>{
  const runtime=new DeliveryRuntime(),before=[{id:'e',tableName:'records',attributes:[{fieldName:'id',type:'INTEGER',isPk:true}]}],after=structuredClone(before);
  after[0].attributes.push({fieldName:'phone',columnName:'phone',type:'STRING',allowNull:true});
  const [migration]=runtime.incrementalMigrations(before,after,2);assert.match(migration.content,/addColumn/);assert.match(migration.path,/incremental/);
  after[0].attributes[1].allowNull=false;assert.throws(()=>runtime.incrementalMigrations(before,after,3),/completar registros/);
});
test('credentials cannot enter model context',()=>{
  assert.throws(()=>p.assertNoSecrets({nested:{OPENAI_API_KEY:'private'}}),/credenciales/);
  p.assertNoSecrets({fields:[{name:'password',type:'string'}]});
});
const url=process.env.DELIVERY_TEST_DATABASE_URL;
test('seven stages, screen designs, individual endpoints and durable jobs', {skip:!url},async t=>{
  if(!/^postgresql:\/\/delivery_test:[^@]+@(?:localhost|127\.0\.0\.1):\d+\/delivery_test(?:\?|$)/.test(url))throw new Error('Only the isolated delivery_test database is allowed');
  const {PrismaClient}=require('@prisma/client'),db=new PrismaClient({datasources:{db:{url}}});
  const project=await db.project.create({data:{name:'Generic delivery test'}});
  const fixture=require('./fixtures/ai-library.cjs').fixture(project.id);
  const operation={...fixture.proposal,authorizedRoles:['Lector'],dependencies:[]};
  const scenarios=structuredClone(operation.acceptanceScenarios);
  scenarios[0].requests.push({id:'invalid',operationId:operation.operationId,as:'reader',body:{},status:422},{id:'unauthorized',operationId:operation.operationId,body:{title:'x'},status:401},{id:'denied',operationId:operation.operationId,as:'visitor',body:{title:'x'},status:403});
  scenarios[0].users.push({id:'visitor',role:'Visitante'});
  const screen={id:'screen',name:'Mis libros',purpose:'Registrar libros propios',route:'/libros',requirementIds:['r1'],actorIds:['a'],useCaseIds:[],
    fields:[{id:'title',label:'Título',meaning:'Título del libro',logicalType:'STRING',required:true,validations:[]}],actions:[{id:'save',label:'Guardar',requirementIds:['r1'],actorIds:['a']}],
    dataSources:[],navigation:[],states:{loading:'Cargando',empty:'Sin registros',error:'Error',success:'Guardado',accessDenied:'Sin permiso'},rules:[],evidence:[],questions:[]};
  let failReview=false,hold=null,executions=0,onExecution;
  const input={project:{id:project.id,name:project.name,platform:'WEB'},spec:{...fixture.spec,actors:[{id:'a',name:'Lector',status:'APPROVED'}],operations:[fixture.source]},
    graph:{contextVersion:1,requirements:[{id:'r1',revision:1}]},document:{context:{content:{summary:'Registro de libros'}},units:[]},
    documentApproved:true,requirements:fixture.spec.requirements,actors:[{id:'a',status:'APPROVED'}],useCases:[],entities:fixture.spec.entities,rules:[],navigation:[],prerequisites:{context:true,actors:true,requirements:true,models:[],rules:[]}};
  const runtime=new DeliveryRuntime();
  runtime.execute=async(stage,context)=>{executions++;onExecution?.();if(hold)await hold;return{workspace:context.workspace,manifest:{},changed:[],runtime:{database:'simulated'},tests:[{passed:true,executedAt:new Date().toISOString(),source:'TEST_DOUBLE',check:'INTEGRATION_WIRING'}],passed:true,containerBehaviorPassed:stage===7};};
  const ai={modelFor:task=>task==='review'?'sonnet-test':'luna-test',async documentTask(task,context){
    if(task==='review'){if(failReview)throw new Error('Sonnet failed');return{data:{observations:[],corrections:[],questions:[]},usage:{input_tokens:10,output_tokens:3}};}
    if(context.target==='screens')return{data:{screens:[structuredClone(screen)],questions:[]}};
    if(context.target==='1')return{data:{...p.stack,questions:[]}};
    return{data:{operation,acceptanceScenarios:scenarios,questions:[]},usage:{input_tokens:20,output_tokens:5}};
  }};
  const adapters={inputs:async()=>structuredClone(input),ai,runtime,stitch:{generate:async()=>({html:'<html><body><input name="title"><button>Guardar</button></body></html>',provider:'stitch-test',remote:{projectId:'remote',screenId:'screen'},visualInspection:'NOT_PERFORMED'})}};
  let workflow=new DeliveryWorkflow(db,adapters);
  const validateOriginal=workflow.validate.bind(workflow);
  workflow.validate=async(i,s,target)=>target.startsWith('mockup:')?{passed:true,rendered:false,visualInspection:'NOT_PERFORMED',executedAt:new Date().toISOString()}:validateOriginal(i,s,target);
  async function wait(job){for(let n=0;n<150;n++){const current=await db.deliveryJob.findUnique({where:{id:job.id}});if(!['RUNNING','QUEUED'].includes(current.status))return current;await new Promise(r=>setTimeout(r,15));}throw new Error('Job timeout');}
  async function task(target,name){const job=await workflow.start(project.id,String(target),name);const completed=await wait(job);assert.equal(completed.status,'COMPLETED',completed.error);return completed;}
  async function approve(target,extra={}){const state=await workflow.get(project.id);return workflow.approve(project.id,String(target),state.revision,{resolution:'Decisión de prueba',...extra});}
  async function finish(stage){await task(stage,'execute');await task(stage,'review');await approve(stage);}
  try{
    await t.test('backend rejects skipping steps and unapproved screens sent to Stitch',async()=>{
      await assert.rejects(workflow.start(project.id,'2','execute'),/anterior/);
      await assert.rejects(workflow.start(project.id,'mockup:screen','stitch'),/catálogo/);
    });
    await task('screens','prepare');await task('screens','validate');
    await t.test('failed Sonnet is visible and never grants approval',async()=>{
      failReview=true;const failed=await wait(await workflow.start(project.id,'screens','review'));assert.equal(failed.status,'FAILED');
      assert.equal((await workflow.get(project.id)).catalog.review.status,'FAILED');await assert.rejects(approve('screens'),/Sonnet/);
      const calls=await db.deliveryCall.findMany({where:{projectId:project.id,status:'FAILED'}});assert.equal(calls[0].usage,null);
      failReview=false;await workflow.control(project.id,'resume',failed.id);assert.equal((await wait({...failed})).status,'COMPLETED');
    });
    await approve('screens');const state=await workflow.get(project.id),screenId=state.catalog.content.screens[0].id;
    await task('mockup:'+screenId,'stitch');await task('mockup:'+screenId,'validate');await task('mockup:'+screenId,'review');await approve('mockup:'+screenId);
    await task('1','prepare');await task('1','review');
    await t.test('stack components require separate approvals',async()=>{
      await assert.rejects(approve('1'),/por separado/);
      for(const component of ['backend','database','frontend'])await approve('1',{component});
      assert.equal((await workflow.get(project.id)).stages[1].approval,null);
      await approve('1',{component:'services'});assert.ok(p.approved((await workflow.get(project.id)).stages[1]));
    });
    await finish('2');await finish('3');
    const opId=operation.operationId;
    await t.test('endpoint implementation cannot precede its individual definition approval',async()=>{
      await assert.rejects(workflow.start(project.id,'execution:'+opId,'execute'),/definición/);
      await task('definition:'+opId,'prepare');await task('definition:'+opId,'validate');await task('definition:'+opId,'review');await approve('definition:'+opId);
      await assert.rejects(workflow.start(project.id,'4','execute'),/Cada endpoint/);
      await task('execution:'+opId,'execute');await task('execution:'+opId,'review');await approve('execution:'+opId);
    });
    await finish('4');await finish('5');await finish('6');await finish('7');
    await t.test('reinitializing the service preserves seven approvals, review scope and provider consumption',async()=>{
      const loaded=await new DeliveryWorkflow(db,adapters).get(project.id);
      assert.ok(p.approved(loaded.stages[7]));assert.equal(loaded.mockups[screenId].review.visualInspection,'NOT_PERFORMED');assert.ok(loaded.calls.some(c=>c.usage?.input_tokens===10));
    });
    await t.test('duplicate task requests reuse the same persistent job',async()=>{
      let release;hold=new Promise(r=>release=r);
      const before=executions,job=await workflow.start(project.id,'7','execute');
      const again=await workflow.start(project.id,'7','execute');assert.equal(again.id,job.id);
      release();hold=null;await wait(job);assert.equal(executions,before+1);
    });
    await t.test('source changes invalidate only dependent stages without deleting files or projects',async()=>{
      input.graph.entities=[{id:'book',revision:2}];const changed=await workflow.get(project.id);
      assert.ok(p.approved(changed.stages[1]));assert.ok(p.approved(changed.stages[2]));assert.equal(changed.stages[3].approval,null);assert.ok(changed.history.length);
      assert.ok(await db.project.findUnique({where:{id:project.id}}));
    });
    await t.test('stale results are retained without overwriting newer input versions',async()=>{
      let release,started;hold=new Promise(r=>release=r);const entered=new Promise(r=>started=r);onExecution=started;
      const job=await workflow.start(project.id,'3','execute');await entered;onExecution=null;
      input.graph.entities=[{id:'book',revision:3}];await workflow.get(project.id);release();hold=null;
      const result=await wait(job);assert.equal(result.status,'STALE');assert.ok(result.result);assert.equal((await workflow.get(project.id)).stages[3].approval,null);
    });
    await t.test('recovery marks running jobs interrupted rather than completed',async()=>{
      const job=await db.deliveryJob.create({data:{projectId:project.id,target:'3',task:'execute',cacheKey:'recover-'+project.id,inputHash:'x',request:{},logs:[],status:'RUNNING'}});
      await workflow.recover();assert.equal((await db.deliveryJob.findUnique({where:{id:job.id}})).status,'INTERRUPTED');
    });
  }finally{
    await db.deliveryCall.deleteMany({where:{projectId:project.id}});await db.deliveryJob.deleteMany({where:{projectId:project.id}});await db.deliveryWorkflow.deleteMany({where:{projectId:project.id}});await db.project.delete({where:{id:project.id}});await db.$disconnect();
  }
});
