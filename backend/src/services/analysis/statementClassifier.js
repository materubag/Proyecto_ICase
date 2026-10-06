const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const capability = /\b(?:registrar|consultar|modificar|eliminar|exportar|importar|validar|autenticar|notificar|programar|cancelar|generar|almacenar)\s+[^.;\n]+/gi;
function classify(text, context = {}) {
  // Legacy converters sometimes prefixed an objective with a fabricated system obligation.
  const normalized = normalize(text).replace(/^[\s•*\d.:-]+/, '');
  const clean = normalized.replace(/^el sistema debera (?:permitir|contemplar)\s+/, '');
  const delivery = /^(?:(?:objetivo(?: general)?|se busca|el proyecto busca)\s*:?\s*)?(?:desarrollar|implementar|disenar|construir|crear|desplegar)(?:\s+(?:e|y)\s+(?:desarrollar|implementar|disenar|construir|crear|desplegar))*\s+/;
  const artifact = /\b(?:aplicacion|plataforma|software|sistema|solucion|proyecto|prototipo)\b/;
  if (delivery.test(clean) && artifact.test(clean)) return 'OBJECTIVE';
  if (/\b(?:el sistema|la aplicacion|la plataforma)\s+(?:debe(?:ra)?|permitira|permite|podra)\b/.test(normalized)) return 'FUNCTIONAL';
  const section = normalize(context.section?.title || context.section || context.title);
  if ((context.originalCode || /requisitos? funcionales|tabla de rf/.test(section)) && /^(?:registrar|consultar|modificar|eliminar|exportar|importar|validar|autenticar|notificar|programar|cancelar|generar|almacenar)\b/.test(clean)) return 'FUNCTIONAL';
  return 'UNKNOWN';
}
function objectives(text, sections = []) {
  const found=[];
  // Preserve paragraphs and their absolute source spans, including wrapped lines.
  for (const m of text.matchAll(/[^\n]+(?:\n(?!\s*\n|\s*(?:\d+(?:\.\d+)*\.?\s+)?(?:OBJETIVOS?|REQUISITOS|RF[- ]|RNF[- ]))[^\n]+)*/gi)) {
    const heading=m[0].match(/^(?:\d+(?:\.\d+)*\.?\s+)?OBJETIVOS?[^\n]*\n/i)?.[0] || '';
    const raw=m[0].slice(heading.length), offset=m.index+heading.length, section=sections.find(s=>offset>=s.start&&offset<s.end);
    if (classify(raw,{section}) !== 'OBJECTIVE') continue;
    found.push({statement:raw.replace(/\s+/g,' ').trim(),quote:raw,start:offset,end:offset+raw.length,section:section?.title || 'General',capabilities:[...raw.matchAll(capability)].map(c=>({statement:c[0].trim(),quote:c[0],start:offset+c.index,end:offset+c.index+c[0].length}))});
  }
  return found;
}
module.exports={classify,objectives,normalize};
