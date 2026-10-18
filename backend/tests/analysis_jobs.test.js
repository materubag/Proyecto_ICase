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
test('source endpoint responds 202 while analysis is pending; status returns completed JSON',async()=>{
  const sourcePath=require.resolve('../src/services/source.service');
  const pipelinePath=require.resolve('../src/services/analysis/analysisPipeline');
  const previousSource=require.cache[sourcePath],previousPipeline=require.cache[pipelinePath];
  let complete;
  require.cache[sourcePath]={id:sourcePath,filename:sourcePath,loaded:true,exports:{getById:async()=>({id:'endpoint-source'})}};
  require.cache[pipelinePath]={id:pipelinePath,filename:pipelinePath,loaded:true,exports:{run:()=>new Promise(resolve=>{complete=resolve;})}};
  try{
    const controller=require('../src/controllers/source.controller');
    const response={statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
    await controller.analyze({params:{sourceId:'endpoint-source'},body:{async:true}},response,error=>{throw error;});
    assert.equal(response.statusCode,202);assert.equal(response.body.success,true);assert.equal(response.body.data.status,'RUNNING');
    await flush();complete({success:true,partial:false});await flush();
    const status={json(body){this.body=body;}};
    await controller.analysisStatus({params:{sourceId:'endpoint-source',jobId:response.body.data.jobId}},status,error=>{throw error;});
    assert.equal(status.body.data.status,'COMPLETED');assert.equal(status.body.data.result.partial,false);
  }finally{
    if(previousSource)require.cache[sourcePath]=previousSource;else delete require.cache[sourcePath];
    if(previousPipeline)require.cache[pipelinePath]=previousPipeline;else delete require.cache[pipelinePath];
  }
});
