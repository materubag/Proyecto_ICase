const crypto=require('node:crypto');
const {classify,normalize}=require('./statementClassifier');
const actorEvidence=require('./actorEvidence');
async function repair(tx,projectId,sourceVersionId){
  const candidates=await tx.requirementCandidate.findMany({where:{projectId,...(sourceVersionId?{sourceVersionId}:{})}});
  const repaired=[];
  for(const row of candidates){
    if(row.rejectionReason && row.rejectionReason.startsWith('RECLASSIFIED_PROJECT_'))continue;
    const original = typeof row.evidence?.text === 'string' ? row.evidence.text : row.originalStatement || row.statement;
    const c1 = classify(original, row.evidence);
    const c2 = classify(row.statement, row.evidence);
    const nonReqType = ['OBJECTIVE', 'CONTEXT', 'CONSTRAINT'].find(t => c1 === t || c2 === t);
    if(!nonReqType)continue;
    const statement=c1===nonReqType?original:row.statement;
    const fingerprint=nonReqType.toLowerCase()+'-'+crypto.createHash('sha256').update(normalize(statement)).digest('hex');
    const official=row.promotedRequirementId?await tx.requirement.findUnique({where:{id:row.promotedRequirementId}}):null;
    // Keep the full original candidate, evidence and official record for audit/restoration.
    if(nonReqType === 'OBJECTIVE'){
      const existing=await tx.modelCandidate.findUnique({where:{projectId_fingerprint:{projectId,fingerprint}}});
      const snapshots=[...(existing?.content?.reclassifiedCandidates || []),JSON.parse(JSON.stringify({candidate:row,requirement:official}))];
      await tx.modelCandidate.upsert({where:{projectId_fingerprint:{projectId,fingerprint}},update:{content:{...existing?.content,statement,reclassifiedCandidates:snapshots}},create:{projectId,kind:'OBJECTIVE',name:statement.slice(0,160),fingerprint,origin:'RULE',status:'PENDING_REVIEW',evidence:row.evidence || {},content:{statement,sourceId:row.sourceId,sourceVersionId:row.sourceVersionId,reclassifiedCandidates:snapshots}}});
    }
    await tx.requirementCandidate.update({where:{id:row.id},data:{status:'REJECTED',canonicalKey:null,rejectionReason:'RECLASSIFIED_PROJECT_'+nonReqType}});
    if(official && !official.isDeleted){
      await tx.requirement.update({where:{id:official.id},data:{isDeleted:true,status:'REJECTED'}});
      const cases=await tx.useCase.findMany({where:{projectId,requirementIds:{has:official.id}}});
      for(const c of cases)await tx.useCase.update({where:{id:c.id},data:{status:'OUTDATED',reviewStatus:'NEEDS_REVIEW'}});
    }
    repaired.push(row.id);
  }
  if(tx.modelCandidate?.findMany){
    const actorCandidates = await tx.modelCandidate.findMany({where:{projectId, kind:'ACTOR'}});
    for(const ac of actorCandidates){
      if(ac.status === 'REJECTED') continue;
      const cl = actorEvidence.classify({name: ac.name, evidence: ac.evidence});
      if(cl === 'PROJECT_CONTEXT'){
        await tx.modelCandidate.update({where:{id: ac.id}, data:{status:'REJECTED', rejectionReason:'PROJECT_CONTEXT_NOT_ACTOR'}});
        if(ac.promotedId && tx.actor?.update){
          await tx.actor.update({where:{id: ac.promotedId}, data:{isDeleted:true, reviewStatus:'REJECTED', status:'REJECTED'}});
        }
      }
    }
  }
  return repaired;
}
module.exports={repair};
