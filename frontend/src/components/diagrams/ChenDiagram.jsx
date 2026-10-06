import React,{useMemo,useEffect} from 'react';
import {parseChen,layoutChen} from '../../utils/chenDiagram';

export default function ChenDiagram({code,onValidated,fit=false}){
  const result=useMemo(()=>{try{return {drawing:layoutChen(parseChen(code))};}catch(e){return {error:e.message};}},[code]);
  useEffect(()=>{onValidated?.(!result.error,result.error);},[result]);
  if(result.error)return <p role="alert">{result.error}</p>;
  const {drawing}=result,nodes=new Map(drawing.nodes.map(n=>[n.id,n]));
  return <svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Diagrama entidad–relación en notación Chen" viewBox={`0 0 ${drawing.width} ${drawing.height}`} width={drawing.width} height={drawing.height} style={{background:'#fff',color:'#1f2937',width:fit?'100%':drawing.width,maxWidth:fit?'100%':undefined,flexShrink:0,height:'auto',fontFamily:'Arial, sans-serif'}}>
    <title>Modelo entidad–relación — notación Chen</title>
    {drawing.edges.map(e=>{
      const start=nodes.get(e.v),end=nodes.get(e.w);
      const from={x:start.x,y:start.y+(start.entity?22:55)},to={x:end.x,y:end.y-(end.entity?22:55)};
      const points=[from,...e.points,to];
      const labelPoint=start.entity?e.points[0]:e.points.at(-1);
      return <g key={e.name}><polyline points={points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke="#64748b" strokeWidth="1.5"/><text x={labelPoint.x+10} y={labelPoint.y-8} fontSize="13" fill="#334155">{e.cardinality}</text></g>;
    })}
    {drawing.nodes.map(n=>n.entity?<g key={n.id}>
      {n.entity.attributes.map((a,i)=>{
        const count=Math.ceil(n.entity.attributes.length/2),row=Math.floor(i/2),x=n.x+(i%2===0?-172:172),y=n.y+(row-(count-1)/2)*48;
        return <g key={i}><line x1={n.x+(i%2===0?-70:70)} y1={n.y} x2={x+(i%2===0?76:-76)} y2={y} stroke="#64748b"/><ellipse cx={x} cy={y} rx="76" ry="19" fill="#fff" stroke="#64748b" strokeWidth="1.5"/><text x={x} y={y+4} textAnchor="middle" fontSize="11" textDecoration={a.isPk?'underline':undefined}><title>{a.name} ({a.type}){a.isPk?' — clave primaria':''}</title>{a.name.length>25?a.name.slice(0,23)+'…':a.name}</text></g>;
      })}
      <rect x={n.x-70} y={n.y-22} width="140" height="44" fill="#ffce35" stroke="#b88900"/><text x={n.x} y={n.y+4} textAnchor="middle" fontSize="12" fontWeight="600"><title>{n.entity.name}</title>{n.entity.name.length>21?n.entity.name.slice(0,19)+'…':n.entity.name}</text>
    </g>:<g key={n.id}><polygon points={`${n.x},${n.y-55} ${n.x+95},${n.y} ${n.x},${n.y+55} ${n.x-95},${n.y}`} fill="#effcff" stroke="#36bfd3" strokeWidth="2"/><text x={n.x} y={n.y+4} textAnchor="middle" fontSize="12"><title>{n.relationship.name}</title>{n.relationship.name.length>25?n.relationship.name.slice(0,23)+'…':n.relationship.name}</text></g>)}
  </svg>;
}
