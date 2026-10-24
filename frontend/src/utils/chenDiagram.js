import {Graph} from 'dagre-d3-es/src/graphlib/index.js';
import {layout} from 'dagre-d3-es/src/dagre/index.js';

export function parseChen(code=''){
  if(!/^\s*erDiagram\b/i.test(code))throw Error('El diagrama debe comenzar con erDiagram.');
  const entities=[];
  for(const match of code.matchAll(/^\s*(\w+)\s*\{([^}]*)\}/gm)){
    entities.push({id:match[1],name:match[1].replace(/^T_/,'').replace(/_/g,' '),attributes:match[2].split('\n').map(s=>s.trim()).filter(Boolean).map(line=>{
      const words=line.split(/\s+/);return {name:words[1]?.replace(/_/g,' ')||words[0],isPk:words.includes('PK'),type:words[0]};
    })});
  }
  const cardinality={'||':'(1,1)','o|':'(0,1)','|o':'(0,1)','o{':'(0,n)','}o':'(0,n)','|{':'(1,n)','}|':'(1,n)'};
  const relationships=[];
  for(const m of code.matchAll(/^\s*(\w+)\s+(\|\||o\||\|o|\}o|\}\|)(?:--|\.\.)(\|\||o\||\|o|o\{|\|\{)\s+(\w+)\s*:\s*(.+)$/gm)){
    for(const id of [m[1],m[4]])if(!entities.some(e=>e.id===id))entities.push({id,name:id.replace(/^T_/,'').replace(/_/g,' '),attributes:[],implicit:true});
    relationships.push({id:'relationship-'+relationships.length,source:m[1],target:m[4],name:m[5].replace(/^"|"$/g,''),sourceCardinality:cardinality[m[2]],targetCardinality:cardinality[m[3]]});
  }
  if(!entities.length)throw Error('No se encontraron entidades para representar el modelo Chen.');
  return {entities,relationships};
}
export function layoutChen(model){
  const graph=new Graph({multigraph:true}).setGraph({rankdir:'TB',nodesep:80,ranksep:100,marginx:30,marginy:30}).setDefaultEdgeLabel(()=>({}));
  for(const e of model.entities)graph.setNode(e.id,{width:480,height:Math.max(100,Math.ceil(e.attributes.length/2)*48+30),entity:e});
  for(const r of model.relationships){
    graph.setNode(r.id,{width:190,height:110,relationship:r});
    graph.setEdge(r.source,r.id,{cardinality:r.sourceCardinality},r.id+'-source');
    graph.setEdge(r.id,r.target,{cardinality:r.targetCardinality},r.id+'-target');
  }
  layout(graph);
  return {width:graph.graph().width,height:graph.graph().height,nodes:graph.nodes().map(id=>({id,...graph.node(id)})),edges:graph.edges().map(edge=>({...edge,...graph.edge(edge)}))};
}
