const test=require('node:test'),assert=require('node:assert/strict');
const {AnalysisJobs}=require('../src/services/analysis/analysisJobs');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('long analysis returns a job immediately and publishes its result later',async()=>{
  let complete,calls=0;
  const jobs=new AnalysisJobs(()=>{calls++;return new Promise(resolve=>{complete=resolve;});});
  const job=jobs.start({sourceId:'source'});
  assert.equal(job.status,'RUNNING');assert.ok(job.jobId);
  await flush();assert.equal(calls,1);
  assert.equal(jobs.start({sourceId:'source'}).jobId,job.jobId);assert.equal(calls,1);
  assert.equal(jobs.get('other-source',job.jobId),null);
  complete({partial:false,summary:{requirementsCount:46}});await flush();
  const finished=jobs.get('source',job.jobId);
  assert.equal(finished.status,'COMPLETED');assert.equal(finished.result.summary.requirementsCount,46);
});
test('provider failure remains a JSON job error, and retry starts a new job',async()=>{
  const jobs=new AnalysisJobs(async()=>{throw Object.assign(new Error('Provider unavailable'),{code:'AI_UNAVAILABLE'});});
  const first=jobs.start({sourceId:'s'});await flush();
  const failed=jobs.get('s',first.jobId);
  assert.equal(failed.status,'FAILED');assert.deepEqual(failed.error,{message:'Provider unavailable',code:'AI_UNAVAILABLE'});
  assert.notEqual(jobs.start({sourceId:'s'}).jobId,first.jobId);await flush();
});
test('source analysis delegates to persistent context preparation',async()=>{
  const sourcePath=require.resolve('../src/services/source.service');
  const workflowPath=require.resolve('../src/services/analysis/documentWorkflow');
  const previousSource=require.cache[sourcePath],previousWorkflow=require.cache[workflowPath];
  let args;
  require.cache[sourcePath]={id:sourcePath,filename:sourcePath,loaded:true,exports:{getById:async()=>({id:'s',projectId:'p'})}};
  require.cache[workflowPath]={id:workflowPath,filename:workflowPath,loaded:true,exports:{service:()=>({run:async(...input)=>{args=input;return {revision:1};}})}};
  try {
    delete require.cache[require.resolve('../src/controllers/source.controller')];
    const controller=require('../src/controllers/source.controller');
    const response={json(body){this.body=body;}};
    await controller.analyze({params:{sourceId:'s'},body:{}},response,error=>{throw error;});
    assert.deepEqual(args,['p','context','prepare']);assert.equal(response.body.data.workflow,true);assert.equal(response.body.data.revision,1);
  }finally{
    if(previousSource)require.cache[sourcePath]=previousSource;else delete require.cache[sourcePath];
    if(previousWorkflow)require.cache[workflowPath]=previousWorkflow;else delete require.cache[workflowPath];
  }
});
