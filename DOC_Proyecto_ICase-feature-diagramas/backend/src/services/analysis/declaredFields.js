const crypto=require('node:crypto');
const {normalize}=require('./actorIdentity');
const roleFor=value=>({ejecutor:'EXECUTOR',ejecucion:'EXECUTOR',participante:'PARTICIPANT',destinatario:'RECIPIENT',consulta:'VIEWER',lector:'VIEWER'})[normalize(value)]||null;
function resolve(result,options={}) {
  const actorLegend={...(options.actorLegend||{})},roleLegend={...(options.roleLegend||{})};
  const legendEvidence=[];
  for(const segment of result.segments||[])for(const line of segment.text.split('\n')){
    if(!/^\s*leyenda(?: de actores)?\s*:/i.test(line))continue;
    legendEvidence.push({...segment,quote:line});
    for(const entry of line.replace(/^\s*leyenda(?: de actores)?\s*:/i,'').split(';')){
      const match=entry.trim().match(/^([A-Za-z]{1,12})\s*[=:]\s*(.+)$/);
      if(!match)continue;
      const role=roleFor(match[2]);
      if(role)roleLegend[match[1]]=role;else actorLegend[match[1]]=match[2].trim();
    }
  }
  for(const r of result.requirements||[]) {
    const declared=r.declared||{};
    if(declared.priority){
      const priority={alta:'HIGH',high:'HIGH',media:'MEDIUM',medium:'MEDIUM',baja:'LOW',low:'LOW'}[normalize(declared.priority)];
      r.priority=priority||null;
      if(!priority)r.pending.push('Prioridad documentada sin equivalencia configurada');
    }
    if(declared.type){
      const type=/^(?:RF|FUNCTIONAL|FUNCIONAL)$/i.test(declared.type)?'FUNCTIONAL':/^(?:RNF|NON_FUNCTIONAL|NO FUNCIONAL)$/i.test(declared.type)?'NON_FUNCTIONAL':null;
      if(type!==r.type)r.extractionIssues.push('CONFLICTING_DECLARED_TYPE');
    }
    if(!declared.actors)continue;
    for(const item of declared.actors.split(/[;\n]+/).filter(Boolean)) {
      const [actorRef,roleRef]=item.split(':').map(s=>s.trim());
      const actorName=Object.hasOwn(actorLegend,actorRef)&&typeof actorLegend[actorRef]==='string'?actorLegend[actorRef]:null;
      const name=actorName||actorRef;
      let actor=[...(result.actors||[]),...(options.knownActors||[])].find(a=>normalize(a.name)===normalize(name));
      if(!actor&&actorName&&!/^(?:sistema|aplicacion|plataforma)$/i.test(normalize(name))) {
        actor={id:'ACT-'+crypto.createHash('sha256').update(name).digest('hex').slice(0,20),name,kind:'HUMAN',classification:'ROLE',source:'explicit',evidence:legendEvidence.length?legendEvidence:r.evidence};
      }
      const role=(Object.hasOwn(roleLegend,roleRef)?roleLegend[roleRef]:null)||roleFor(roleRef);
      if(!actor || !role) {r.pending.push('UNRESOLVED: actor o rol declarado sin leyenda: '+item);continue;}
      if(!result.actors.some(a=>a.id===actor.id))result.actors.push({...actor,source:actor.source||'explicit',evidence:[...(Array.isArray(actor.evidence)?actor.evidence:[]),...r.evidence,...legendEvidence]});
      r.associations.push({actorId:actor.id,role,evidence:[...r.evidence,...legendEvidence],method:'DOCUMENTED_COLUMN'});
    }
  }
  return result;
}
module.exports={resolve};
