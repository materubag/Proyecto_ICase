const contract=require('./extractionContract');
const {locate}=require('./extractionEvidence');
function recover(data,segments,context=[],known=[]){
 if(!data||!['coveredSegmentIds','actors','requirements','other'].every(k=>Array.isArray(data[k])))throw Error('Contrato de extraccion incompleto');
 const clean={coveredSegmentIds:segments.map(s=>s.id),actors:[],requirements:[],links:[],relations:[],other:[]},issues=[],all=[...segments,...context];
 if(data.coveredSegmentIds.length!==segments.length||segments.some(s=>!data.coveredSegmentIds.includes(s.id)))issues.push({kind:'coverage',message:'Cobertura de segmentos incompleta'});
 const report=(kind,item,error)=>issues.push({kind,statement:item?.statement||item?.name||'',segmentIds:item?.segmentIds||[],quote:item?.quote||'',message:error.message});
 const evidence=item=>{
  const copy=JSON.parse(JSON.stringify(item));
  try{locate(copy,all);return copy;}catch(original){
   if(!Array.isArray(copy.segmentIds)||copy.segmentIds.some(id=>!all.some(s=>s.id===id)))throw original;
   const ids=[...new Set(copy.segmentIds)].sort((a,b)=>(all.find(s=>s.id===a).start||0)-(all.find(s=>s.id===b).start||0));
   for(let size=1;size<=ids.length;size++)for(let start=0;start+size<=ids.length;start++){
    const narrowed={...copy,segmentIds:ids.slice(start,start+size)};
    try{locate(narrowed,all);return narrowed;}catch{}
   }
   throw original;
  }
 };
 const accept=(kind,item)=>{try{const c=evidence(item);contract.validate({...clean,[kind]:[...clean[kind],c]},segments,context,known);clean[kind].push(c);return c;}catch(error){report(kind,item,error);return null;}};
 for(const actor of data.actors)accept('actors',actor);
 for(const req of data.requirements){
  try{
   const r=evidence(req);
   if(!Array.isArray(r.associations))throw Error('Lista de asociaciones invalida');
   const valid=[];
   for(const association of r.associations){try{const a=evidence(association);contract.validate({...clean,requirements:[{...r,associations:[a]}]},segments,context,known);valid.push(a);}catch(error){report('association',association,error);}}
   if(valid.length!==r.associations.length && Array.isArray(r.pending))r.pending.push('Asociaciones invalidas pendientes de revision');
   r.associations=valid;accept('requirements',r);
  }catch(error){report('requirements',req,error);}
 }
 for(const link of data.links||[])accept('links',link);
 for(const relation of data.relations||[])accept('relations',relation);
 for(const item of data.other)accept('other',item);
 contract.validate(clean,segments,context,known);
 return {data:clean,issues};
}
module.exports={recover};
