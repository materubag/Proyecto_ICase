const {id,label}=require('./mermaidSyntax');
function generate(nodes=[],projectName='Sistema'){
  if(!nodes.length)throw Object.assign(new Error('No hay nodos de navegación disponibles.'),{statusCode:422});
  const map=new Map(nodes.map(n=>[n.id,n]));
  if(map.size!==nodes.length||nodes.some(n=>!n.id||!n.name))throw Object.assign(new Error('Nodos de navegación duplicados o incompletos.'),{statusCode:422});
  for(const n of nodes){
    const seen=new Set();let current=n;
    while(current?.parentId){
      if(seen.has(current.id))throw Object.assign(new Error('La navegación contiene un ciclo.'),{statusCode:422});seen.add(current.id);
      if(!map.has(current.parentId))throw Object.assign(new Error('Padre de navegación desconocido: '+current.parentId),{statusCode:422});
      current=map.get(current.parentId);
    }
  }
  const lines=['flowchart TD',` APP_ROOT["${label(projectName)}"]`];
  for(const n of nodes)lines.push(` ${id(n.id)}["${label(n.name)}${n.route?' — '+label(n.route):''}"]`);
  for(const n of nodes)lines.push(` ${n.parentId?id(n.parentId):'APP_ROOT'} --> ${id(n.id)}`);
  return lines.join('\n');
}
module.exports={generate};
