// pdf.js emits synthetic whitespace items whose width can hide column gaps.
// Reconstruct baselines using real glyph items; preserve raw parser text separately.
function reconstruct(items) {
  const lines=[];
  for(const item of items){
    if(typeof item.str!=='string'||!item.str.trim()||!item.transform)continue;
    const x=item.transform[4],y=item.transform[5];
    let line=lines.find(l=>Math.abs(l.y-y)<2);
    if(!line){line={y,items:[]};lines.push(line);}
    line.items.push({text:item.str,x,width:item.width||0,size:Math.abs(item.transform[0])||10});
  }
  return lines.sort((a,b)=>b.y-a.y).map(line=>{
    let end=null,text='';
    for(const item of line.items.sort((a,b)=>a.x-b.x)){
      if(end!==null){const gap=item.x-end;text+=gap>Math.max(10,item.size*1.3)?'\t':gap>0.5?' ':'';}
      text+=item.text;end=item.x+item.width;
    }
    return text;
  }).join('\n');
}
module.exports={reconstruct};
