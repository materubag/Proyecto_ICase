const {randomUUID}=require('node:crypto');
class AnalysisJobs {
  constructor(run){this.run=run;this.jobs=new Map();}
  start(options){
    for(const [id,job] of this.jobs)if(job.finishedAt && Date.now()-job.finishedAt>30*60*1000)this.jobs.delete(id);
    const active=[...this.jobs.values()].find(j=>j.sourceId===options.sourceId&&j.status==='RUNNING');
    if(active)return this.view(active);
    const job={id:randomUUID(),sourceId:options.sourceId,status:'RUNNING',startedAt:Date.now()};
    this.jobs.set(job.id,job);
    Promise.resolve().then(()=>this.run(options)).then(result=>{job.result=result;job.status='COMPLETED';},error=>{job.error={message:error.message || 'Error analizando fuente',code:error.code};job.status='FAILED';}).finally(()=>{job.finishedAt=Date.now();});
    return this.view(job);
  }
  view(job){return {jobId:job.id,sourceId:job.sourceId,status:job.status,result:job.result,error:job.error};}
  get(sourceId,id){const job=this.jobs.get(id);return job?.sourceId===sourceId?this.view(job):null;}
}
const jobs=new AnalysisJobs(options=>require('./analysisPipeline').run(options));
module.exports=jobs;
module.exports.AnalysisJobs=AnalysisJobs;
