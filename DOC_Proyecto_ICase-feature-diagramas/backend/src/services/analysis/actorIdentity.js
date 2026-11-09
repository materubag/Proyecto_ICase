const normalize=v=>String(v||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLowerCase();
function named(ref,actors){
  const matches=actors.filter(a=>!a.isDeleted&&[a.name,...(a.aliases||[])].filter(Boolean).some(v=>normalize(v)===normalize(ref)));
  return matches.length===1?matches[0].id:null;
}
function resolve(ref,actors,models=[]){
  if(!ref)return null;
  const exact=actors.find(a=>a.id===ref&&!a.isDeleted);if(exact)return exact.id;
  const found=new Set(actors.filter(a=>!a.isDeleted&&[a.codeId,a.name,...(a.aliases||[])].filter(Boolean).some(v=>normalize(v)===normalize(ref))).map(a=>a.id));
  for(const m of models)if([m.id,m.fingerprint,m.content?.id].includes(ref)){
    if(actors.some(a=>a.id===m.promotedId&&!a.isDeleted))found.add(m.promotedId);
    else if(m.status!=='REJECTED') {const existing=named(m.content?.name||m.name,actors);if(existing)found.add(existing);}
  }
  return found.size===1?[...found][0]:null;
}
function canonical(refs,actors,models=[]){const ids=[],pending=[];for(const ref of refs||[]){const id=resolve(ref,actors,models);(id?ids:pending).push(id||ref);}return {ids:[...new Set(ids)],pending:[...new Set(pending)]};}
const useCaseActors=c=>[...new Set([...(c.actorIds||[]),c.primaryActorId,...(c.secondaryActorIds||[])].filter(Boolean))];
const executorAssociations=ev=>(ev?.associations||[]).filter(a=>['EXECUTOR','PARTICIPANT'].includes(a.role)&&a.evidence?.length);
async function refresh(tx,projectId,extra=[]){
  const actors=await tx.actor.findMany({where:{projectId,isDeleted:false}});
  const models=[...await tx.modelCandidate.findMany({where:{projectId,kind:'ACTOR'}}),...extra];
  const requirements=await tx.requirement.findMany({where:{projectId,isDeleted:false,status:{not:'REMOVED'}}});
  const candidates=tx.requirementCandidate?.findMany ? await tx.requirementCandidate.findMany({where:{projectId,promotedRequirementId:{not:null}}}) : [];
  for(const r of requirements){
    const source=Array.isArray(r.sources)?{legacySources:r.sources}:r.sources||{};
    const candidateAssociations=candidates.filter(c=>c.promotedRequirementId===r.id).flatMap(c=>executorAssociations(c.evidence));
    const mapped=canonical([...(r.actorIds||[]),...(source.pendingActorReferences||[]),...executorAssociations(source).map(a=>a.actorId),...candidateAssociations.map(a=>a.actorId)],actors,models);
    if(JSON.stringify(mapped.ids)!==JSON.stringify(r.actorIds)||JSON.stringify(mapped.pending)!==JSON.stringify(source.pendingActorReferences||[])){
      await tx.requirement.update({where:{id:r.id},data:{actorIds:mapped.ids,sources:{...source,pendingActorReferences:mapped.pending}}});
      r.actorIds=mapped.ids;
    }
  }
  if(tx.useCase?.findMany)for(const c of await tx.useCase.findMany({where:{projectId,isDeleted:false}})){
    const mapped=canonical(useCaseActors(c),actors,models);
    // Only repair existing references; never manufacture an actor for an unassigned case.
    if(!mapped.pending.length){const primary=resolve(c.primaryActorId,actors,models);const secondary=mapped.ids.filter(id=>id!==primary);
      if(JSON.stringify(mapped.ids)!==JSON.stringify(c.actorIds)||primary!==c.primaryActorId||JSON.stringify(secondary)!==JSON.stringify(c.secondaryActorIds))await tx.useCase.update({where:{id:c.id},data:{actorIds:mapped.ids,primaryActorId:primary,secondaryActorIds:secondary}});
    }
  }
  return {actors,requirements};
}
module.exports={normalize,named,resolve,canonical,useCaseActors,executorAssociations,refresh};
