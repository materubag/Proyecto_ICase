const {id,label}=require('./mermaidSyntax');
function generate(model,requirements=[]){
  const bad=message=>{throw Object.assign(new Error(message),{statusCode:422,code:'INVALID_PROCESS_FLOW'});};
  const nodes=model?.nodes,edges=model?.edges;
  if(!Array.isArray(nodes)||!nodes.length||!Array.isArray(edges))bad('Flujo sin nodos o conexiones.');
  const map=new Map(nodes.map(n=>[n.id,n])),known=new Set(requirements.map(r=>r.id));
  if(map.size!==nodes.length)bad('El flujo tiene IDs duplicados.');
  for(const n of nodes){
    if(!n.id||!n.label||!['start','end','process','decision'].includes(n.type))bad('Nodo del flujo incompleto.');
    if(['process','decision'].includes(n.type)&&(!n.requirementIds?.length||n.requirementIds.some(r=>!known.has(r))))bad('Paso o decisión sin referencia a requisitos existentes.');
  }
  for(const e of edges)if(!map.has(e.source)||!map.has(e.target))bad('Conexión a un nodo desconocido.');
  for(const n of nodes){
    const outgoing=edges.filter(e=>e.source===n.id),incoming=edges.filter(e=>e.target===n.id);
    if(n.type==='decision'&&(new Set(outgoing.map(e=>e.target)).size<2||outgoing.some(e=>!e.label)))bad('Decisión sin ramas etiquetadas.');
    if(n.type==='start'&&incoming.length||n.type==='end'&&outgoing.length)bad('Inicio o fin con conexiones inválidas.');
  }
  function reachable(seeds,reverse=false){const seen=new Set(seeds),queue=[...seeds];while(queue.length){const current=queue.shift();for(const e of edges)if((reverse?e.target:e.source)===current){const next=reverse?e.source:e.target;if(!seen.has(next)){seen.add(next);queue.push(next);}}}return seen;}
  const fromStart=reachable(nodes.filter(n=>n.type==='start').map(n=>n.id)),toEnd=reachable(nodes.filter(n=>n.type==='end').map(n=>n.id),true);
  if(nodes.some(n=>!fromStart.has(n.id)||!toEnd.has(n.id)))bad('Hay pasos sin camino desde inicio hasta fin.');
  const lines=['flowchart TD'];
  for(const n of nodes){const text='"'+label(n.label)+'"';lines.push(` ${id(n.id)}${n.type==='decision'?'{'+text+'}':n.type==='start'||n.type==='end'?'(['+text+'])':'['+text+']'}`);}
  for(const e of edges)lines.push(` ${id(e.source)} --> ${e.label?'|"'+label(e.label)+'"| ':''}${id(e.target)}`);
  return lines.join('\n');
}
function independent(requirements=[]){
  const nodes=[],edges=[];
  for(const r of requirements){
    nodes.push({id:r.id+'-start',type:'start',label:'Inicio — '+(r.code||r.name)},{id:r.id,type:'process',label:r.name||r.description,requirementIds:[r.id]},{id:r.id+'-end',type:'end',label:'Fin — '+(r.code||r.name)});
    edges.push({source:r.id+'-start',target:r.id},{source:r.id,target:r.id+'-end'});
  }
  return {nodes,edges};
}
module.exports={generate,independent};
