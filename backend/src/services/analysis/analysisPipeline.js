const prisma=require('../../config/prisma');
const extraction=require('./documentExtraction');
const store=require('./extractionStore');
class AnalysisPipeline {
  async run(options){
    const {sourceId,sourceVersionId,projectId,persist=true,force=false,sourceType='PDF'}=options;
    let source,version,text=options.text||'';
    if(persist){
      source=await prisma.source.findUnique({where:{id:sourceId},include:{currentVersion:{include:{segments:true}}}});
      if(!source)throw Object.assign(new Error('Fuente no encontrada'),{statusCode:404});
      if(projectId&&projectId!==source.projectId)throw Object.assign(new Error('La fuente pertenece a otro proyecto'),{statusCode:409});
      version=sourceVersionId?await prisma.sourceVersion.findUnique({where:{id:sourceVersionId},include:{segments:true}}):source.currentVersion;
      if(!version||version.sourceId!==source.id)throw Object.assign(new Error('Versión ajena o inexistente'),{statusCode:409});
      text=options.text||version.extractedText||'';
    }else{
      source={id:sourceId||'in-memory-source',projectId,name:'Fuente en Memoria',type:sourceType};
      version={id:sourceVersionId||'in-memory-version',segments:options.segments||[]};
      if(!text)text=version.segments.map(s=>s.text).join('\n');
    }
    if(!text.trim())throw Object.assign(new Error('La fuente no contiene texto'),{statusCode:400});
    const knownActors=options.knownActors || (persist && prisma.actor?.findMany ? await prisma.actor.findMany({where:{projectId:source.projectId,isDeleted:false}}) : []);
    options={...options,knownActors};
    const meta={projectId:source.projectId,sourceId:source.id,sourceVersionId:version.id,text,options};
    let result,reused=false;
    const snapshot=persist?await store.findSnapshot(meta):null;
    if(!force&&snapshot?.content?.result&&!snapshot.content.result.partial){result={...snapshot.content.result,rawText:text};reused=true;}
    if(!result)result=await extraction.extract(text,{...options,fileName:source.name,sourceId:source.id,sourceVersionId:version.id,segments:version.segments,
      knownRequirements:require('./requirementIdentity').consolidate([...(options.knownRequirements||[]),...(snapshot?.content?.result?.requirements||[])]),
      previousResult:!force&&snapshot?.content?.result?.partial?snapshot.content.result:null});
    if(reused)result.metrics={...result.metrics,requestsUsed:0,usage:[]};
    if(persist)await require('./actorRelationshipResolver').resolve(result,{...options,sourceId:source.id,sourceVersionId:version.id});
    const saved=persist?await store.persist(source.projectId,result,meta):{
      requirements:result.requirements.map(r=>({projectId,sourceId:source.id,sourceVersionId:version.id,temporaryCode:r.originalCode||r.id,
        title:r.name,statement:r.statement,type:r.type,origin:r.source==='inferred'?'INFERRED':'EXPLICIT',confidence:null,status:'PENDING_REVIEW',
        evidence:store.envelope(r),qualityReport:{pending:r.pending,partial:result.partial}})),models:result.actors.map(a=>({kind:'ACTOR',name:a.name,content:a,evidence:a.evidence}))};
    const metrics={...result.metrics,...(reused?{reusedSource:true}:{})};
    return {success:true,cached:reused,partial:result.partial,sourceId:source.id,sourceVersionId:version.id,
      extraction:result,coverage:result.coverage,failures:result.failures,metrics,
      summary:{requirementsCount:result.requirements.length,actorsCount:result.actors.length,businessRulesCount:result.businessRules.length,
        totalCandidates:saved.requirements.length+saved.models.length,totalPendingReview:saved.requirements.filter(r=>r.status==='PENDING_REVIEW').length,
        explicitCount:result.requirements.filter(r=>r.source!=='inferred').length,inferredCount:result.requirements.filter(r=>r.source==='inferred').length,aiMetrics:metrics},
      explicitRequirements:result.requirements.filter(r=>r.source!=='inferred'),needCandidates:[],requirementCandidates:saved.requirements,modelCandidates:saved.models};
  }
  async runPipeline(options){return this.run(options);}
}
module.exports=new AnalysisPipeline();
