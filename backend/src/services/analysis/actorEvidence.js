const {normalize}=require('./actorIdentity');
function classify(actor){
  const name=normalize(actor.name);
  const quotes=(Array.isArray(actor.evidence)?actor.evidence:[]).map(e=>normalize(e.quote || e.text).replace(/^[•*\-]\s*/,''));
  if(quotes.some(q=>q.startsWith(name+':')))return 'ROLE';
  if(/^(?:personal|responsable|equipo|usuarios?)$/.test(name))return 'NEEDS_REVIEW';
  if(quotes.some(q=>q.includes(name)&&/perfiles|roles|actores|usuario del sistema|interactua|accede|registra|consulta|solicita|aprueba|confirma|envia|recibe|integra/.test(q)))return 'ROLE';
  if(quotes.length && quotes.every(q=>/^(?:empresa|proponente|proveedor del proyecto|equipo de desarrollo|contacto|autor)\b/.test(q)||/levantamiento|aceptacion|puesta en produccion|desarrollo del proyecto/.test(q)))return 'PROJECT_CONTEXT';
  return 'NEEDS_REVIEW';
}
function profiles(text,segments){
  const found=[];
  for(const segment of segments.filter(s=>/perfiles|actores|roles/i.test(s.section || '') || /PERFILES CONTEMPLADOS|ACTORES DEL SISTEMA|ROLES DEL SISTEMA/i.test(s.text))){
    for(const m of segment.text.matchAll(/^[ \t]*[•*-]\s*([^:\n]{2,60}):\s*([^\n]+)/gm)){
      const name=m[1].trim(),quote=m[0].trim();
      found.push({name,description:m[2].trim(),quote,segmentId:segment.id,kind:'HUMAN'});
    }
  }
  return found;
}
module.exports={classify,profiles};
