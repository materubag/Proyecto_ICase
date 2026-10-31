// Small, real PDF fixtures with deterministic coordinates. No external generator or model.
function pdf(pages) {
  const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>',null,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  const kids=[];
  const escape=s=>String(s).replace(/[()\\]/g,'\\$&');
  for(const rows of pages){
    const pageId=objects.length,streamId=pageId+1;kids.push(pageId+' 0 R');
    const stream=rows.map((row,index)=>{
      const cells=Array.isArray(row)?row:[row];
      return cells.map((cell,column)=>`BT /F1 10 Tf ${40+column*190} ${750-index*18} Td (${escape(cell)}) Tj ET`).join('\n');
    }).join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 900 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream,'latin1')} >>\nstream\n${stream}\nendstream`);
  }
  objects[2]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  let body='%PDF-1.4\n';const offsets=[0];
  for(let i=1;i<objects.length;i++){offsets.push(Buffer.byteLength(body,'latin1'));body+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(body,'latin1');
  body+=`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body,'latin1');
}
module.exports={pdf};
