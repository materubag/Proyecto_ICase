const crypto=require('node:crypto');
const identity=require('./requirementIdentity');
const config=require('./documentExtraction').configuration;
const prisma=require('../../config/prisma');
const fingerprint=({sourceVersionId,text,options={},projectId})=>'extraction-v3-'+crypto.createHash('sha256').update(JSON.stringify([projectId,sourceVersionId||null,text,config(options),options.mode||null,options.actorLegend||{},options.roleLegend||{},(options.knownActors||[]).map(a=>[a.id,a.name,a.aliases,a.description]).sort((a,b)=>a[0].localeCompare(b[0]))])).digest('hex');
async function lock(tx,projectId){if(tx.$queryRawUnsafe)await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text',projectId);}
function envelope(r){return {canonicalKey:identity.keyFor(r),internalId:r.id,originalCode:r.originalCode||null,
  originalCodes:r.originalCodes||[],originalDescription:r.originalDescription||null,declared:r.declared||{},boundaryContext:r.boundaryContext||null,segments:r.evidence||[],associations:r.associations||[],actorIds:r.actorIds||[],
  section:r.section||null,context:r.context||null,pending:r.pending||[],reviewStatus:r.reviewStatus||null,
  dependencyStatus:r.dependencyStatus||'UNANALYZED',dependencies:r.dependencies||[],dependencyEvidence:r.dependencyEvidence||[],
  relations:r.relations||[],proposedRelations:r.proposedRelations||[],readActorIds:r.readActorIds||[],
  businessRuleRefs:r.businessRuleRefs||[],
  actorAnalysisStatus:r.actorAnalysisStatus||'UNRESOLVED',behavior:r.behavior||null,accessActorIds:r.accessActorIds||[],
  extractionIssues:r.extractionIssues||[],refinements:r.refinements||[],extractionMethods:r.extractionMethods||[r.extractionMethod||'SEMANTIC']};}
function mergeEnvelope(a={},b={}){
  return {...a,...b,originalCode:a.originalCode||b.originalCode||null,
    originalCodes:identity.unique([...(a.originalCodes||[]),...(b.originalCodes||[]),a.originalCode,b.originalCode].filter(Boolean)),
    segments:identity.unique([...(a.segments||[]),...(b.segments||[])]),
    associations:identity.unique([...(a.associations||[]),...(b.associations||[])]),
    actorIds:[...new Set([...(a.actorIds||[]),...(b.actorIds||[])])],
    pending:identity.unique([...(a.pending||[]),...(b.pending||[])]),
    refinements:identity.unique([...(a.refinements||[]),...(b.refinements||[])]),
    relationHistory:identity.unique([...(a.relationHistory||[]),...(a.relations||[])]),
    relations:(b.relations||a.relations||[]).map(relation=>(a.relations||[]).find(old=>old.status==='APPROVED'&&require('./dependencyResolver').proposalKey(a.internalId,old)===require('./dependencyResolver').proposalKey(b.internalId||a.internalId,relation))||relation),
    extractionMethods:identity.unique([...(a.extractionMethods||[]),...(b.extractionMethods||[])])};
}
async function findSnapshot(meta){return prisma.modelCandidate.findFirst({where:{projectId:meta.projectId,kind:'DOCUMENT_ANALYSIS',fingerprint:fingerprint(meta)}});}
async function persist(projectId,result,meta={}){
  const clean=JSON.parse(JSON.stringify(result));
  require('./catalogIntegrity').analyze(clean);
  return prisma.$transaction(async tx=>{
    await lock(tx,projectId);
    const old=await tx.requirementCandidate.findMany({where:{projectId},orderBy:{createdAt:'asc'}});
    const saved=[];
    await require('./objectiveRepair').repair(tx,projectId,meta.sourceVersionId);
    for(const objective of clean.objectives || []){
      const key='objective-'+crypto.createHash('sha256').update(identity.normalize(objective.statement)).digest('hex');
      const existing=await tx.modelCandidate.findUnique({where:{projectId_fingerprint:{projectId,fingerprint:key}}});
      const ev=identity.unique([...[].concat(existing?.evidence || []),...(objective.evidence || [])]);
      await tx.modelCandidate.upsert({where:{projectId_fingerprint:{projectId,fingerprint:key}},update:{evidence:ev},create:{projectId,kind:'OBJECTIVE',name:objective.statement.slice(0,160),content:objective,evidence:ev,fingerprint:key,origin:'RULE',status:'PENDING_REVIEW'}});
    }
    for(const r of identity.consolidate(clean.requirements).filter(r=>require('./statementClassifier').classify(r.statement,r)!=='OBJECTIVE')){
      const key=identity.keyFor(r);
      const exact=old.filter(c=>c.canonicalKey===key||identity.same({...c,statement:c.statement},r));
      // Adopt a legacy over-captured enumerated sentence in the SAME immutable source version.
      // Preserve the approved wording and keep the correction as a review, not another requirement.
      const corrections=exact.length?[]:old.filter(c=>r.originalCode&&meta.sourceVersionId&&c.sourceVersionId===meta.sourceVersionId&&
        c.evidence?.originalCode===r.originalCode&&c.type===r.type&&/[.]$/.test(r.statement.trim())&&
        identity.normalize(c.statement).startsWith(identity.normalize(r.statement)+'. '));
      const matches=exact.length?exact:corrections;
      const existing=matches.find(c=>c.canonicalKey===key)||matches.find(c=>c.promotedRequirementId)||matches[0];
      const evidence=mergeEnvelope(existing?.evidence,envelope(r));
      if(corrections.length){
        evidence.statementCorrection={previous:existing.statement,proposed:r.statement,evidence:r.evidence,status:'PENDING_REVIEW'};
        evidence.pending=identity.unique([...evidence.pending,'Revisar material añadido por el extractor anterior; conservar el texto aprobado hasta revisión']);
      }
      const data={canonicalKey:key,evidence,confidence:existing?.confidence??null};
      // An approved/human-edited statement and its UUID remain untouched.
      if(existing?.status==='PENDING_REVIEW')data.qualityReport={...existing.qualityReport,pending:evidence.pending,partial:clean.partial};
      let row;
      if(existing)row=await tx.requirementCandidate.update({where:{id:existing.id},data});
      else row=await tx.requirementCandidate.create({data:{...data,projectId,
        sourceId:meta.sourceId||null,sourceVersionId:meta.sourceVersionId||null,
        sourceSegmentId:r.evidence.find(e=>e.sourceSegmentId)?.sourceSegmentId||null,
        temporaryCode:r.originalCode||r.id,title:r.name||r.statement,statement:r.statement,
        originalStatement:r.evidence.map(e=>e.quote).join('\n'),type:r.type,
        origin:r.source==='inferred'?'INFERRED':'EXPLICIT',status:'PENDING_REVIEW',confidence:null,
        priority:r.priority??null,qualityReport:{pending:evidence.pending,partial:clean.partial}}});
      if(!existing)old.push(row);
      saved.push(row);
      if(row.promotedRequirementId){
        const official=await tx.requirement.findUnique({where:{id:row.promotedRequirementId}});
        if(official&&!official.isDeleted){
          await tx.requirement.update({where:{id:official.id},data:{canonicalKey:key,
            sources:mergeEnvelope(Array.isArray(official.sources)?{legacySources:official.sources}:official.sources||{},evidence)}});
          for(const e of evidence.segments||[])for(const [kind,id] of [['Source',e.sourceId],['SourceVersion',e.sourceVersionId],['AudioSegment',e.sourceSegmentId]])
            if(id)await require('../engineering/domain').link(tx,projectId,kind,id,'Requirement',official.id,'EVIDENCE');
        }
      }
    }
    const models=[];
    for(const r of clean.requirements)for(const proposal of r.proposedRelations||[]){
      const fingerprint=require('./dependencyResolver').proposalKey(r.id,proposal);
      models.push(await tx.modelCandidate.upsert({where:{projectId_fingerprint:{projectId,fingerprint}},update:{},create:{projectId,kind:'REQUIREMENT_RELATION',name:`${r.originalCode||r.id}: ${proposal.kind}`,content:{...proposal,sourceRequirementId:r.id},evidence:proposal.evidence,fingerprint,status:'PENDING_REVIEW',origin:'INFERRED'}}));
    }
    for(const item of [...(clean.additionalCandidates||[]).map(r=>({...r,kind:'REQUIREMENT_DISCOVERY'})),...(clean.businessRules||[]).map(r=>({...r,kind:'BUSINESS_RULE'}))]){
      const key=item.kind+'-'+crypto.createHash('sha256').update(identity.normalize(item.statement||item.quote||item.reason)).digest('hex');
      models.push(await tx.modelCandidate.upsert({where:{projectId_fingerprint:{projectId,fingerprint:key}},update:{evidence:item.evidence||[]},create:{projectId,kind:item.kind,name:(item.statement||item.quote||item.reason).slice(0,160),content:item,evidence:item.evidence||[],fingerprint:key,status:'PENDING_REVIEW',origin:item.source==='explicit'?'EXPLICIT':'INFERRED'}}));
    }
    const catalog=await tx.actor?.findMany({where:{projectId,isDeleted:false}}) || [];
    const actorIdentity=require('./actorIdentity');
    for(const actor of clean.actors){
      const existing=await tx.modelCandidate.findUnique({where:{projectId_fingerprint:{projectId,fingerprint:actor.id}}});
      const content={...(existing?.content||{}),...actor,evidence:identity.unique([...(existing?.content?.evidence||[]),...actor.evidence])};
      const matchedId=actorIdentity.named(actor.name,catalog);
      models.push(await tx.modelCandidate.upsert({where:{projectId_fingerprint:{projectId,fingerprint:actor.id}},
        update:{content,evidence:content.evidence,...(matchedId?{promotedId:matchedId}:{})},create:{projectId,kind:'ACTOR',name:actor.name,content,evidence:actor.evidence,
          fingerprint:actor.id,origin:actor.source.toUpperCase(),confidence:null,status:'PENDING_REVIEW',promotedId:matchedId}}));
    }
    if(tx.actor && tx.requirement)await actorIdentity.refresh(tx,projectId,models);
    const snapshotKey=meta.snapshotKey||fingerprint({projectId,text:clean.rawText||'',sourceVersionId:meta.sourceVersionId,options:meta.options});
    const {rawText,...snapshot}=clean;
    models.push(await tx.modelCandidate.upsert({where:{projectId_fingerprint:{projectId,fingerprint:snapshotKey}},
      update:{content:{result:snapshot,partial:clean.partial,coverage:clean.coverage,failures:clean.failures,metrics:clean.metrics,sourceVersionId:meta.sourceVersionId||null,sourceId:meta.sourceId||null}},
      create:{projectId,kind:'DOCUMENT_ANALYSIS',name:clean.project.name,fingerprint:snapshotKey,status:'PENDING_REVIEW',origin:'EXPLICIT',confidence:null,
        content:{result:snapshot,partial:clean.partial,coverage:clean.coverage,failures:clean.failures,metrics:clean.metrics,sourceVersionId:meta.sourceVersionId||null,sourceId:meta.sourceId||null}}}));
    if(meta.sourceVersionId){
      await tx.sourceVersion.update({where:{id:meta.sourceVersionId},data:{analyzedAt:clean.partial?null:new Date()}});
      await tx.source.update({where:{id:meta.sourceId},data:{status:clean.partial?'PENDING_REVIEW':'ANALYZED'}});
    }
    return {requirements:saved,models};
  },{timeout:20000});
}
async function promote(tx,candidate){
  await lock(tx,candidate.projectId);
  const current=await tx.requirementCandidate.findUnique({where:{id:candidate.id}});
  if(current.evidence?.reviewStatus==='NEEDS_REVIEW'||current.evidence?.extractionIssues?.length)throw Object.assign(new Error('Corrige la extracción antes de aprobar este requisito.'),{statusCode:422,code:'EXTRACTION_NEEDS_REVIEW'});
  if(current.rejectionReason==='RECLASSIFIED_PROJECT_OBJECTIVE' || require('./statementClassifier').classify(current.statement,current.evidence)==='OBJECTIVE') {
    throw Object.assign(new Error('Este enunciado es un objetivo del proyecto y no puede promoverse como requisito.'),{code:'PROJECT_OBJECTIVE_NOT_REQUIREMENT',statusCode:422});
  }
  const key=identity.keyFor(current);
  const reserved=await tx.requirement.findMany({where:{projectId:current.projectId}});
  const all=reserved.filter(r=>!r.isDeleted);
  let official=all.find(r=>r.canonicalKey===key)||all.find(r=>r.id===current.promotedRequirementId)||all.find(r=>identity.same(r,current));
  const originalCode=current.evidence?.originalCode;
  if(originalCode&&reserved.some(r=>require('./catalogIntegrity').normalizeCode(r.code)===require('./catalogIntegrity').normalizeCode(originalCode)&&r.id!==official?.id)){
    throw Object.assign(new Error('El código documental ya identifica otro requisito; resuelve el conflicto sin renumerar el original.'),{statusCode:422,code:'ORIGINAL_CODE_CONFLICT'});
  }
  const ev=mergeEnvelope(Array.isArray(official?.sources)?{legacySources:official.sources}:official?.sources||{},current.evidence||{});
  const dependencyRows=(ev.dependencies||[]).map(ref=>all.find(r=>r.id===ref||r.sources?.internalId===ref));
  const dependencyCodes=dependencyRows.filter(Boolean).map(r=>r.code);
  ev.pendingDependencyReferences=(ev.dependencies||[]).filter((ref,i)=>!dependencyRows[i]);
  if(ev.pendingDependencyReferences.length)ev.dependencyStatus='UNRESOLVED';
  const actorModels=await tx.modelCandidate.findMany({where:{projectId:current.projectId,kind:'ACTOR'}});
  const ai=require('./actorIdentity');
  const actors=await tx.actor.findMany({where:{projectId:current.projectId,isDeleted:false}});
  ev.accessActorIds=ai.canonical((ev.associations||[]).filter(a=>a.role==='EXECUTOR').map(a=>a.actorId),actors,actorModels).ids;
  ev.readActorIds=ai.canonical((ev.associations||[]).filter(a=>a.role==='VIEWER').map(a=>a.actorId),actors,actorModels).ids;
  const actorIds=ai.canonical(ai.executorAssociations(ev).map(a=>a.actorId),actors,actorModels).ids;
  if(official)official=await tx.requirement.update({where:{id:official.id},data:{canonicalKey:key,sources:ev,actorIds:[...new Set([...official.actorIds,...actorIds])]}});
  else{
    const prefix=current.type==='NON_FUNCTIONAL'?'RNF':'RF';
    let code=current.evidence?.originalCode;
    if(!code||!new RegExp(`^${prefix}[-_ ]*\\d+$`,'i').test(code)||reserved.some(r=>r.code===code)){
      let next=Math.max(0,...reserved.filter(r=>r.code.startsWith(prefix+'-')).map(r=>Number(r.code.match(/(\d+)$/)?.[1])||0))+1;
      code=`${prefix}-${String(next).padStart(2,'0')}`;
    }
    official=await tx.requirement.create({data:{projectId:current.projectId,canonicalKey:key,code,name:current.title,description:current.statement,
      type:current.type,priority:current.priority??null,status:'APPROVED',actorIds,dependencies:dependencyCodes,sources:ev,qualityReport:current.qualityReport||{}}});
    await require('../engineering/change.service').remember(tx,official);
  }
  const domain=require('../engineering/domain');
  for(const e of ev.segments||[]){
    for(const [kind,id] of [['Source',e.sourceId],['SourceVersion',e.sourceVersionId],['AudioSegment',e.sourceSegmentId]])if(id)await domain.link(tx,current.projectId,kind,id,'Requirement',official.id,'EVIDENCE');
  }
  const updated=await tx.requirementCandidate.update({where:{id:current.id},data:{status:'APPROVED',promotedRequirementId:official.id}});
  await require('./dependencyResolver').refresh(tx,current.projectId);
  return {candidate:updated,promotedItem:official,kind:'REQUIREMENT',reused:Boolean(all.find(r=>r.id===official.id))};
}
module.exports={fingerprint,findSnapshot,persist,promote,lock,envelope,mergeEnvelope};
