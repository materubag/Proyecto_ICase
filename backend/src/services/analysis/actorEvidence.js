const {normalize}=require('./actorIdentity');
function classify(actor){
  const name=normalize(actor.name);
  const rawEv = Array.isArray(actor.evidence)
    ? actor.evidence
    : (actor.evidence && typeof actor.evidence === 'object' ? [actor.evidence] : (actor.evidence ? [{ quote: String(actor.evidence) }] : []));
  const quotes=rawEv.map(e=>normalize(e.quote || e.text || e.snippet || '').replace(/^[•*\-]\s*/,'')).filter(Boolean);

  // 1. Vendor, developer, IT provider or proposal authors are project context, NOT actors
  const vendorTerms = /\b(?:soporte t[eé]cnico|garant[ií]a|desarrollo del proyecto|equipo de desarrollo|proveedor|proponente|consultora|puesta en producci[oó]n|levantamiento de informaci[oó]n|entregar documentaci[oó]n|propuesta econ[oó]mica|propuesta t[eé]cnica|corregir[aá]n errores atribuibles al desarrollo)\b/i;
  const isVendorName = /^(?:empresa|proponente|proveedor|consultora|contratista|equipo de desarrollo|desarrollador(?:es|a)?|autor(?:es)?|contacto)\b/i.test(name);
  if (isVendorName || quotes.some(q => vendorTerms.test(q))) {
    if (!quotes.some(q => /\b(?:inicia sesi[oó]n|pantalla|formulario|bot[oó]n|interfaz de usuario|rol de acceso)\b/i.test(q))) {
      return 'PROJECT_CONTEXT';
    }
  }

  // 2. Organization/business name without specific user role (e.g. "El taller", "La empresa", "La biblioteca")
  if (/^(?:el |la )?(?:empresa|instituci[oó]n|organizaci[oó]n|negocio|entidad|compañ[ií]a)$/i.test(name) &&
      !quotes.some(q => q.startsWith(name + ':') || q.startsWith(name + ' -'))) {
    return 'PROJECT_CONTEXT';
  }

  // 3. User roles with clear interactions or profiles
  if (quotes.some(q => q.startsWith(name + ':') || q.startsWith(name + ' -') || q.startsWith(name + ' –'))) return 'ROLE';
  if (/^(?:personal|responsable|equipo|usuarios?)$/.test(name)) return 'NEEDS_REVIEW';
  if (quotes.some(q => q.includes(name) && /perfiles|roles|actores|usuario|interactua|accede|registra|consulta|solicita|aprueba|confirma|envia|recibe|integra|gestiona|administra|supervisa|decisiones|atiende|opera|facilita|coordina|mantiene|genera|controla|utiliza|realiza/.test(q))) return 'ROLE';
  if (quotes.some(q => q.includes(name))) return 'ROLE';
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
