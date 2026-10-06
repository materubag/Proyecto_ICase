const crypto=require('node:crypto');
const {classify,normalize}=require('./statementClassifier');
async function repair(tx,projectId,sourceVersionId){
  const candidates=await tx.requirementCandidate.findMany({where:{projectId,...(sourceVersionId?{sourceVersionId}:{})}});
  const repaired=[];
  for(const row of candidates){
    if(row.rejectionReason==='RECLASSIFIED_PROJECT_OBJECTIVE')continue;
    const original = typeof row.evidence?.text === 'string' ? row.evidence.text : row.originalStatement || row.statement;
    if(classify(original,row.evidence)!=='OBJECTIVE' && classify(row.statement,row.evidence)!=='OBJECTIVE')continue;
    const statement=classify(original,row.evidence)==='OBJECTIVE'?original:row.statement;
    const fingerprint='objective-'+crypto.createHash('sha256').update(normalize(statement)).digest('hex');
    const official=row.promotedRequirementId?await tx.requirement.findUnique({where:{id:row.promotedRequirementId}}):null;
    // Keep the full original candidate, evidence and official record for audit/restoration.
    const existing=await tx.modelCandidate.findUnique({where:{projectId_fingerprint:{projectId,fingerprint}}});
    const snapshots=[...(existing?.content?.reclassifiedCandidates || []),JSON.parse(JSON.stringify({candidate:row,requirement:official}))];
    await tx.modelCandidate.upsert({where:{projectId_fingerprint:{projectId,fingerprint}},update:{content:{...existing?.content,statement,reclassifiedCandidates:snapshots}},create:{projectId,kind:'OBJECTIVE',name:statement.slice(0,160),fingerprint,origin:'RULE',status:'PENDING_REVIEW',evidence:row.evidence || {},content:{statement,sourceId:row.sourceId,sourceVersionId:row.sourceVersionId,reclassifiedCandidates:snapshots}}});
    await tx.requirementCandidate.update({where:{id:row.id},data:{status:'REJECTED',canonicalKey:null,rejectionReason:'RECLASSIFIED_PROJECT_OBJECTIVE'}});
    if(official && !official.isDeleted){
      await tx.requirement.update({where:{id:official.id},data:{isDeleted:true,status:'REJECTED'}});
      const cases=await tx.useCase.findMany({where:{projectId,requirementIds:{has:official.id}}});
      for(const c of cases)await tx.useCase.update({where:{id:c.id},data:{status:'OUTDATED',reviewStatus:'NEEDS_REVIEW'}});
    }
    repaired.push(row.id);
  }
  return repaired;
}
module.exports={repair};
