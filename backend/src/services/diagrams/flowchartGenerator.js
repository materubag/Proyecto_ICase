const flow=require('./processFlow');
module.exports={
 generate(requirements=[],useCases=[]){
  const steps=(requirements.length?requirements:useCases).filter(r=>!r.isDeleted&&r.status!=='REMOVED').map((r,i)=>({...r,id:r.id||'step-'+i,name:r.name||r.statement||r.description}));
  if(!steps.length)return 'flowchart TD';
  return flow.generate(flow.independent(steps),steps);
 }
};
