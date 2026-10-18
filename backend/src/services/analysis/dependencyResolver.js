const normalizeCode=value=>String(value||'').toUpperCase().replace(/[\s_–-]+/g,'');
const kinds=new Set(['PREREQUISITE','FUNCTIONAL','BUSINESS_RULE','DATA_RELATION','ENABLES_STATE','PROCESS']);
const proposalKey=(sourceId,p)=>'relation-'+require('node:crypto').createHash('sha256').update(JSON.stringify([sourceId,p.targetId,p.kind,(p.evidence||[]).map(e=>[e.sourceVersionId,e.documentHash,e.quote])])).digest('hex');
const rowHash=row=>require('node:crypto').createHash('sha256').update(JSON.stringify([row.code,row.type,row.description])).digest('hex');
function resolve(requirements,codes,issues) {
  for(const r of requirements){
    r.dependencies=[];r.dependencyEvidence=[];r.dependencyStatus='UNANALYZED';r.relations=[];
    const statement=r.statement||r.description||'';
    const groups=[...statement.matchAll(/(?:depende\s+de|requiere(?:\s+previamente)?|prerrequisito\s*:)\s*((?:(?:RNF|RF)[\s_-]*\d+)(?:(?:\s*[,;]\s*|\s+y\s+)(?:RNF|RF)[\s_-]*\d+)*)/gi)].map(m=>m[1]);
    if(r.declared?.dependencies)groups.push(r.declared.dependencies);
    if(r.declared?.dependencies&&!/(?:RNF|RF)[\s_-]*\d+|\b(?:sin dependencias|ninguna|ninguno)\b/i.test(r.declared.dependencies)){
      r.dependencyStatus='UNRESOLVED';issues.push({code:'UNRESOLVED_DECLARED_DEPENDENCY',requirementId:r.id});
    }
    for(const group of groups)for(const ref of group.matchAll(/(?:RNF|RF)[\s_-]*\d+/gi)){
      const targets=codes.get(normalizeCode(ref[0]))||[];
      if(targets.length!==1||targets[0].id===r.id){
        r.dependencyStatus='UNRESOLVED';issues.push({code:'INVALID_DEPENDENCY',requirementId:r.id,reference:ref[0]});continue;
      }
      const target=targets[0];
      if(!r.dependencies.includes(target.id)){
        r.dependencies.push(target.id);
        r.dependencyEvidence.push({requirementId:target.id,quote:ref[0],evidence:r.evidence});
        r.relations.push({targetId:target.id,kind:'PREREQUISITE',status:'DOCUMENTED',evidence:r.evidence});
      }
      if(r.dependencyStatus!=='UNRESOLVED')r.dependencyStatus='ANALYZED';
    }
    if(/\b(?:sin dependencias|ninguna|ninguno)\b/i.test(r.declared?.dependencies||'')||/\bsin dependencias\b/i.test(statement)){
      if(r.dependencies.length){r.dependencyStatus='UNRESOLVED';issues.push({code:'CONTRADICTORY_DEPENDENCIES',requirementId:r.id});}
      else if(r.dependencyStatus!=='UNRESOLVED')r.dependencyStatus='ANALYZED';
    }
    for(const proposal of r.proposedRelations||[]){
      const target=requirements.find(t=>t.id===proposal.targetId);
      if(!target||target.id===r.id||!kinds.has(proposal.kind)||!proposal.evidence?.length){issues.push({code:'INVALID_RELATION',requirementId:r.id});continue;}
      if(proposal.review?.status==='REJECTED'){r.relations.push({...proposal,status:'REJECTED'});continue;}
      if(proposal.review?.status==='APPROVED'){
        r.relations.push({...proposal,status:'APPROVED'});
        if(proposal.kind==='PREREQUISITE'&&!r.dependencies.includes(target.id))r.dependencies.push(target.id);
        if(r.dependencyStatus==='UNANALYZED')r.dependencyStatus='ANALYZED';
        continue;
      }
      // A literal quote does not constitute human approval.
      r.relations.push({...proposal,status:'UNRESOLVED'});
      r.dependencyStatus='UNRESOLVED';
      issues.push({code:'UNRESOLVED_RELATION',requirementId:r.id,targetId:proposal.targetId});
    }
  }
  const visited=new Set(),path=[],active=new Set(),cycles=new Set();
  function visit(r){
    if(active.has(r.id)){for(const id of path.slice(path.indexOf(r.id)))cycles.add(id);return;}
    if(visited.has(r.id))return;
    active.add(r.id);path.push(r.id);
    for(const id of r.dependencies||[]){const target=requirements.find(t=>t.id===id);if(target)visit(target);}
    path.pop();active.delete(r.id);visited.add(r.id);
  }
  requirements.forEach(visit);
  if(cycles.size){issues.push({code:'CIRCULAR_PREREQUISITES',requirementIds:[...cycles]});for(const r of requirements)if(cycles.has(r.id)){r.dependencyStatus='UNRESOLVED';r.reviewStatus='NEEDS_REVIEW';}}
}
function storedIssues(rows){
  const graph=rows.map(r=>({id:r.id,originalCode:r.code,declared:{dependencies:(r.dependencies||[]).map(ref=>rows.find(target=>target.id===ref)?.code||ref).join(', ')}}));
  const codes=new Map(graph.map(r=>[normalizeCode(r.originalCode),[r]])),issues=[];
  resolve(graph,codes,issues);return issues;
}
async function approveCandidate(tx,candidate){
  await require('./extractionStore').lock(tx,candidate.projectId);
  const current=await tx.modelCandidate.findUnique({where:{id:candidate.id}});
  if(current.status!=='PENDING_REVIEW')throw Object.assign(new Error('La propuesta ya fue revisada.'),{statusCode:409,code:'VERSION_CONFLICT'});
  const p=current.content,rows=await tx.requirement.findMany({where:{projectId:current.projectId,isDeleted:false}});
  const source=rows.find(r=>r.sources?.internalId===p.sourceRequirementId),target=rows.find(r=>r.sources?.internalId===p.targetId);
  if(!source||!target||source.id===target.id||!kinds.has(p.kind)||!p.evidence?.length)throw Object.assign(new Error('Aprueba primero los requisitos referenciados y conserva la evidencia.'),{statusCode:422,code:'RELATION_REVIEW_INVALID'});
  const dependencies=p.kind==='PREREQUISITE'?[...new Set([...(source.dependencies||[]),target.code])]:source.dependencies;
  const issues=storedIssues(rows.map(r=>r.id===source.id?{...r,dependencies}:r));
  if(issues.length)throw Object.assign(new Error('La relación produciría dependencias inconsistentes.'),{statusCode:422,code:'RELATION_REVIEW_INVALID',details:issues});
  const proposal={...p,status:'APPROVED',review:{status:'APPROVED',candidateId:current.id,reviewedAt:new Date().toISOString()}};
  const history=require('../engineering/change.service');await history.remember(tx,source);
  const updated=await tx.requirement.update({where:{id:source.id},data:{dependencies,revision:{increment:1},sources:{...source.sources,relations:[...(source.sources?.relations||[]).filter(r=>!(r.targetId===p.targetId&&r.kind===p.kind)),proposal]}}});
  await history.remember(tx,updated);
  await tx.modelCandidate.update({where:{id:current.id},data:{content:{...p,review:{status:'APPROVED',sourceHash:rowHash(updated),targetHash:rowHash(target)}}}});
  await require('../engineering/domain').link(tx,current.projectId,'Requirement',target.id,'Requirement',source.id,p.kind);
  return updated;
}
async function refresh(tx,projectId){
  const rows=await tx.requirement.findMany({where:{projectId,isDeleted:false}});
  for(const row of rows){
    const source=row.sources;
    if(!source||Array.isArray(source)||!source.pendingDependencyReferences?.length)continue;
    const resolved=source.pendingDependencyReferences.map(id=>rows.find(target=>target.id!==row.id&&(target.id===id||target.sources?.internalId===id)));
    const pending=source.pendingDependencyReferences.filter((id,index)=>!resolved[index]);
    if(pending.length===source.pendingDependencyReferences.length)continue;
    await tx.requirement.update({where:{id:row.id},data:{dependencies:[...new Set([...(row.dependencies||[]),...resolved.filter(Boolean).map(r=>r.code)])],sources:{...source,pendingDependencyReferences:pending,dependencyStatus:pending.length||source.proposedRelations?.length?'UNRESOLVED':'ANALYZED'}}});
    for(const target of resolved.filter(Boolean))await require('../engineering/domain').link(tx,projectId,'Requirement',target.id,'Requirement',row.id,'PREREQUISITE');
  }
}
module.exports={resolve,refresh,storedIssues,approveCandidate,proposalKey,rowHash,kinds};
