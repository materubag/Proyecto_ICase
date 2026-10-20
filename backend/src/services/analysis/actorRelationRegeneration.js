const prisma=require('../../config/prisma');
const {AnalysisJobs}=require('./analysisJobs');
const identity=require('./actorIdentity');
const unique=require('./requirementIdentity').unique;
const resolver=require('./actorRelationshipResolver');
const {segmentText,configuration}=require('./documentExtraction');
const fail=(message,statusCode=422)=>Object.assign(new Error(message),{statusCode});
async function prepare(projectId,db=prisma){
  const config=configuration();
  if(!['openai','gemini'].includes(config.provider))throw fail('Selecciona OpenAI o Gemini para regenerar relaciones con IA.');
  if(!await db.project.findUnique({where:{id:projectId}}))throw fail('Proyecto no encontrado',404);
  const [actors,requirements,sources,snapshots]=await Promise.all([
    db.actor.findMany({where:{projectId,isDeleted:false}}),db.requirement.findMany({where:{projectId,isDeleted:false,status:{not:'REMOVED'}}}),
    db.source.findMany({where:{projectId},include:{currentVersion:true}}),db.modelCandidate.findMany({where:{projectId,kind:'DOCUMENT_ANALYSIS'},orderBy:{createdAt:'desc'}})
  ]);
  if(!actors.length)throw fail('Aprueba o registra los actores antes de regenerar las relaciones.');
  const segments=[];
  for(const source of sources){
    const version=source.currentVersion;if(!version?.extractedText)continue;
    const snapshot=snapshots.find(s=>s.content?.sourceVersionId===version.id);
    for(const s of snapshot?.content?.result?.segments||segmentText(version.extractedText))segments.push({...s,originalId:s.id,id:version.id+':'+s.id,sourceId:source.id,sourceVersionId:version.id,sourceFile:source.name});
  }
  if(!segments.length)throw fail('No hay texto documental disponible. Analiza primero una fuente del proyecto.');
  return {config,actors,requirements,segments};
}
async function run({projectId},dependencies={}){
  const db=dependencies.db||prisma,data=await prepare(projectId,db);
  const result={segments:data.segments,requirements:data.requirements.map(r=>({id:r.id,statement:r.description||r.name,type:r.type,associations:[],actorIds:[],pending:[],evidence:(r.sources?.segments||[]).flatMap(e=>{
    const s=data.segments.find(s=>s.originalId===e.id&&(!e.sourceVersionId||s.sourceVersionId===e.sourceVersionId));return s?[{...e,id:s.id}]:[];
  })})),metrics:{requestsUsed:0,usage:[]}};
  await (dependencies.resolve||resolver.resolve)(result,{knownActors:data.actors,providerOverride:data.config.provider,modelOverride:data.config.model});
  if(result.relationshipFailures?.some(f=>f.requirementIds)&&!result.requirements.some(r=>r.associations.length))throw fail('La IA no pudo completar las relaciones. Las asignaciones existentes se conservaron. Reintenta o revisa la configuración.',502);
  return db.$transaction(async tx=>{
    await require('./extractionStore').lock(tx,projectId);
    const actors=await tx.actor.findMany({where:{projectId,isDeleted:false}});
    const changes=[],pending=[];let linksAdded=0;
    for(const r of result.requirements){
      if(r.type!=='FUNCTIONAL')continue;
      const live=await tx.requirement.findUnique({where:{id:r.id}});
      if(!live||live.isDeleted||live.status==='REMOVED'||live.projectId!==projectId)continue;
      if((live.description||live.name)!==r.statement){pending.push({id:live.id,code:live.code,name:live.name,reason:'El requisito cambió durante el análisis; regenera sus relaciones.'});continue;}
      const additions=identity.canonical(identity.executorAssociations(r).map(a=>a.actorId),actors).ids;
      const ids=[...new Set([...(live.actorIds||[]),...additions])],added=ids.filter(id=>!(live.actorIds||[]).includes(id));
      if(added.length){
        const before=JSON.parse(JSON.stringify({actorIds:live.actorIds,sources:live.sources}));
        const sources={...(Array.isArray(live.sources)?{legacySources:live.sources}:live.sources||{}),associations:unique([...(live.sources?.associations||[]),...r.associations])};
        await tx.requirement.update({where:{id:live.id},data:{actorIds:ids,sources}});
        for(const c of await tx.requirementCandidate.findMany({where:{projectId,promotedRequirementId:live.id}}))await tx.requirementCandidate.update({where:{id:c.id},data:{evidence:{...c.evidence,associations:unique([...(c.evidence?.associations||[]),...r.associations]),actorIds:ids}}});
        changes.push({id:live.id,code:live.code,before,after:{actorIds:ids,sources}});linksAdded+=added.length;
      }
      if(!ids.length)pending.push({id:live.id,code:live.code,name:live.name,reason:result.relationshipFailures?.filter(f=>f.requirementId===live.id).map(f=>f.message).join('; ')||'No se encontró evidencia suficiente de quién realiza la acción.'});
    }
    let affectedUseCases=0;
    if(changes.length){
      const changed=new Set(changes.map(c=>c.id));
      for(const c of await tx.useCase.findMany({where:{projectId,isDeleted:false}}))if(c.requirementIds.some(id=>changed.has(id))){await tx.useCase.update({where:{id:c.id},data:{reviewStatus:'NEEDS_REVIEW',sources:{...(c.sources||{}),actorRelationsOutdated:true}}});affectedUseCases++;}
      await tx.artifact.updateMany({where:{projectId,type:{in:['USE_CASE','USE_CASE_DIAGRAM']}},data:{status:'NEEDS_REVIEW'}});
    }
    const summary={requirementsReviewed:result.requirements.filter(r=>r.type==='FUNCTIONAL').length,requirementsUpdated:changes.length,linksAdded,pending,affectedUseCases,partial:result.relationshipFailures?.some(f=>f.requirementIds)||false};
    await tx.modelCandidate.create({data:{projectId,kind:'ACTOR_RELATION_REGENERATION',name:'Regeneración de relaciones',fingerprint:'actor-relations-'+require('node:crypto').randomUUID(),status:'COMPLETED',origin:'INFERRED',content:{summary,changes,failures:result.relationshipFailures||[],metrics:result.metrics}}});
    return summary;
  },{timeout:20000});
}
const jobs=new AnalysisJobs(run);
module.exports={prepare,run,jobs};
