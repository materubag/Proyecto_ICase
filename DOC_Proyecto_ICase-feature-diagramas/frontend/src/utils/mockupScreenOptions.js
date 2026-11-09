// Screen proposals derive exclusively from approved project content.
export const SCREEN_CATEGORIES = [{id:'general',label:'Operaciones del sistema',icon:'apps',color:'#2563eb'}];
export const SCREEN_CATALOG = [];
export function getScreenCategories(project) {
  return [...SCREEN_CATEGORIES,...(project?.actors||[]).filter(a=>!a.isDeleted).map(a=>({id:a.id,actorId:a.id,label:a.name,icon:'person',color:'#059669'}))];
}
const slug = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function screenOptions(project={}) {
  const requirements=(project.requirements||[]).filter(r=>r.status==='APPROVED'&&r.type==='FUNCTIONAL'&&!r.isDeleted);
  const approvedIds=new Set(requirements.map(r=>r.id));
  const used=new Set();
  const make=(node,reqs,proposed)=>{
    const actorIds=[...new Set(reqs.flatMap(r=>r.actorIds||[]))];
    const actor=(project.actors||[]).find(a=>!a.isDeleted&&actorIds.includes(a.id));
    return {...node,platform:node.platform||'UNKNOWN',category:actor?.id||'general',categoryName:actor?.name||'Operaciones del sistema',actorName:actor?.name||null,actorIds,icon:'web',isCore:false,proposed,
      description:node.description||reqs.map(r=>r.description||r.name||'').join('\n'),
      requirementIds:reqs.map(r=>r.id),functionalities:reqs.map(r=>({id:r.id,code:r.code,text:r.description||r.name}))};
  };
  const screens=(project.navigationNodes||[]).filter(n=>n.status==='APPROVED'&&!n.isDeleted).map(n=>{
    const reqs=requirements.filter(r=>(n.requirementIds||[]).includes(r.id));reqs.forEach(r=>used.add(r.id));
    return make({...n,name:n.name||n.route,route:n.route||null},reqs,false);
  });
  const groups=new Map();
  for(const r of requirements.filter(r=>!used.has(r.id))){
    const statement=r.description||r.name||r.code;
    // A lexical group is a selectable proposal, with the complete original statements retained.
    const key=slug(statement.split(/\s+/).at(-1))||slug(r.code)||r.id;
    const group=groups.get(key)||[];group.push(r);groups.set(key,group);
  }
  for(const [key,reqs] of groups){
    screens.push(make({id:'proposal-'+key,name:reqs[0].name||reqs[0].description||reqs[0].code,route:'/'+key},reqs,true));
  }
  return screens.filter(s=>s.requirementIds.every(id=>approvedIds.has(id)));
}
