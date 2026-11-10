// Explicit opt-in. No AI providers are called; HTTP, migrations and browser are real.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
for(const key of ['OPENAI_API_KEY','ANTHROPIC_API_KEY','GEMINI_API_KEY','GOOGLE_STITCH_API_KEY'])process.env[key]='';
const realFetch=global.fetch;global.fetch=(url,...args)=>{if(!/^http:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(String(url)))throw new Error('External provider requests disabled');return realFetch(url,...args);};
const{DeliveryRuntime,manifest}=require('../src/services/codegen/deliveryRuntime');
const{fixture}=require('./fixtures/ai-library.cjs');
async function main(){
  if(process.env.TEST_DB_ADMIN_NAME!=='delivery_test')throw new Error('Use isolated delivery_test PostgreSQL');
  const id='runtime-'+Date.now(),f=fixture(id),runtime=new DeliveryRuntime(),reports=[];
  f.spec.project.name='Generic runtime proof';f.spec.operations=[structuredClone(f.proposal)];
  const listing={operationId:'list-own-books',type:'BUSINESS_LOGIC',name:'Consultar libros propios',method:'GET',route:'/api/operations/list-own-books',authorizedRoles:['Lector'],requirementIds:['r1'],targetEntity:'Book',bindingVersion:2,transaction:false,input:{},steps:[{id:'listed',action:'QUERY',entity:'Book',where:{ownerId:{$ref:'user.id'}}}],resultStep:'listed',unresolved:[],ambiguities:[],output:{successStatus:200}};
  listing.acceptanceScenarios=[{id:'list-own-books',requirementIds:['r1'],users:[{id:'reader',role:'Lector'},{id:'visitor',role:'Visitante'}],fixtures:[],requests:[{id:'created',operationId:f.proposal.operationId,as:'reader',body:{title:'Libro de lista'},status:201,equals:[{path:'data.data.title',value:'Libro de lista'}]},{id:'listed',operationId:listing.operationId,as:'reader',status:200,equals:[{path:'data.data.0.title',value:'Libro de lista'}]},{id:'anonymous',operationId:listing.operationId,status:401},{id:'denied',operationId:listing.operationId,as:'visitor',status:403}],persistence:[{entity:'Book',where:{id:{$ref:'responses.created.data.data.id'}},count:1,fields:{title:'Libro de lista'}}],browser:[]}];
  f.spec.operations.push(listing);
  f.screen.contract.dataSources=[{name:'books',route:listing.route,operationId:listing.operationId}];f.screen.contract.listSource='books';
  f.screen.contract.controlBindings={input:[{index:0,field:'title'}],button:[{index:0,actionId:'confirmar'}]};
  const operation=f.spec.operations[0],scenarios=operation.acceptanceScenarios;
  scenarios[0].users.push({id:'visitor',role:'Visitante'});
  scenarios[0].requests.push({id:'invalid',operationId:operation.operationId,as:'reader',body:{},status:400},{id:'anonymous',operationId:operation.operationId,body:{title:'anonymous'},status:401},{id:'denied',operationId:operation.operationId,as:'visitor',body:{title:'denied'},status:403});
  let state={files:{},stages:{},endpoints:{},mockups:{books:{content:{html:f.screen.html}}}};
  const run=async(stage,target,content)=>{
    const result=await runtime.execute(stage,{spec:f.spec,state,target,content,workspace:'stage-'+stage+'-'+Date.now()},text=>process.stdout.write(text));
    assert.equal(result.passed,true,JSON.stringify(result));reports.push({stage,...result});
    state={...state,files:result.manifest,workspace:result.workspace,runtime:result.runtime};return result;
  };
  try{
    await run(2);const database=await run(3);state.stages[3]={version:1,content:{physicalModel:structuredClone(f.spec.entities),relationships:[]}};
    const definition={content:{operation,acceptanceScenarios:scenarios},validation:{passed:true},review:{status:'SUCCEEDED'}};definition.approval={contentHash:require('../src/services/codegen/deliveryPolicy').hash(definition.content)};
    state.endpoints[operation.operationId]={definition};
    await run(4,operation.operationId,definition.content);state.endpoints[operation.operationId].implemented=true;
    const listDefinition={content:{operation:listing,acceptanceScenarios:listing.acceptanceScenarios},validation:{passed:true},review:{status:'SUCCEEDED'}};listDefinition.approval={contentHash:require('../src/services/codegen/deliveryPolicy').hash(listDefinition.content)};
    state.endpoints[listing.operationId]={definition:listDefinition};await run(4,listing.operationId,listDefinition.content);state.endpoints[listing.operationId].implemented=true;
    await run(5);await run(6);
    // Incremental DB change: a nullable field, preserving all previous migration files and data.
    const {Client}=require('pg'),connection=runtime.connection();const db=new Client({...connection,database:state.runtime.database});await db.connect();
    await db.query('INSERT INTO books(title,"owner_id",created_at,updated_at) VALUES($1,$2,NOW(),NOW())',['Existing record',17]);
    const beforeFiles=manifest(runtime.directory(id,state.workspace));
    f.spec.entities[0].attributes.push({fieldName:'phone',columnName:'phone',type:'STRING',dataType:'STRING',allowNull:true});
    const changed=await run(3);const rows=await db.query('SELECT title,phone FROM books WHERE title=$1',['Existing record']);assert.equal(rows.rows.length,1);assert.equal(rows.rows[0].phone,null);
    const afterFiles=manifest(runtime.directory(id,state.workspace));for(const name of Object.keys(beforeFiles).filter(f=>f.includes('/migrations/')))assert.equal(afterFiles[name],beforeFiles[name]);
    assert.equal(afterFiles['frontend/src/main.jsx'],beforeFiles['frontend/src/main.jsx']);
    reports.push({stage:'INCREMENTAL_FIELD',passed:true,executedAt:new Date().toISOString(),record:rows.rows[0],newMigrations:changed.changed.filter(f=>f.includes('/migrations/'))});await db.end();
    if(process.env.DELIVERY_TEST_DOCKER==='true')await run(7);
    console.log('REAL_RUNTIME_OK '+id);
  }finally{
    await runtime.close(id);fs.writeFileSync(path.resolve(__dirname,'../.verification/delivery-runtime-report.json'),JSON.stringify({reports,completed:reports.some(r=>r.stage==='INCREMENTAL_FIELD')},null,2));
    if(state.runtime?.database){const{Client}=require('pg');const admin=new Client({...runtime.connection(),database:process.env.TEST_DB_ADMIN_NAME});await admin.connect();await admin.query('DROP DATABASE "'+state.runtime.database+'" WITH (FORCE)');await admin.end();}
  }
}
main().catch(error=>{console.error(error.message,JSON.stringify(error.execution||error.report||error.diagnostics||'',null,2));process.exitCode=1;});
