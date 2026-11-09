const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const capability = /\b(?:registrar|consultar|modificar|eliminar|exportar|importar|validar|autenticar|notificar|programar|cancelar|generar|almacenar)\s+[^.;\n]+/gi;
const deliverablePattern = /\b(?:entregar|proveer|elaborar|proporcionar)\s+(?:un\s+)?(?:manual|documentacion\s+tecnica|guia\s+basica|informes?\s+de\s+avance)\b|\b(?:soporte\s+tecnico\s+gratuito|periodo\s+de\s+garantia|atencion\s+de\s+incidencias|corregir\s+errores\s+atribuibles\s+al\s+desarrollo|canal\s+oficial\s+para\s+el\s+reporte|versionado\s+de\s+las\s+actualizaciones|capacitacion\s+al\s+personal|ambiente\s+de\s+pruebas\s+para\s+validacion)\b/i;
const deliverableSection = /garantia|soporte|servicios?\s+post|estrategia\s+recomendada|entregables?|capacitacion/i;
const assumptionSection = /supuestos?|premisas?|dependencias?|riesgos?/i;

function classify(text, context = {}) {
  // Legacy converters sometimes prefixed an objective with a fabricated system obligation.
  const normalized = normalize(text).replace(/^[\s•*\d.:-]+/, '');
  const clean = normalized.replace(/^el sistema debera (?:permitir|contemplar)\s+/, '');
  const section = normalize(context.section?.title || context.section || context.title || context.segments?.[0]?.section || (Array.isArray(context) ? context[0]?.section : null));
  const isCodedRequirement = Boolean(context.originalCode || /requisitos?\s+funcionales|tabla\s+de\s+rf/.test(section));

  if (!isCodedRequirement && (deliverableSection.test(section) || deliverablePattern.test(clean))) {
    return 'CONTEXT';
  }
  if (!isCodedRequirement && assumptionSection.test(section)) {
    return 'CONSTRAINT';
  }

  const delivery = /^(?:(?:objetivo(?: general)?|se busca|el proyecto busca)\s*:?\s*)?(?:desarrollar|implementar|disenar|construir|crear|desplegar)(?:\s+(?:e|y)\s+(?:desarrollar|implementar|disenar|construir|crear|desplegar))*\s+/;
  const artifact = /\b(?:aplicacion|plataforma|software|sistema|solucion|proyecto|prototipo)\b/;
  if (delivery.test(clean) && artifact.test(clean)) return 'OBJECTIVE';
  if (/\b(?:el sistema|la aplicacion|la plataforma)\s+(?:debe(?:ra)?|permitira|permite|podra)\b/.test(normalized)) return 'FUNCTIONAL';
  if ((isCodedRequirement) && /^(?:registrar|consultar|modificar|eliminar|exportar|importar|validar|autenticar|notificar|programar|cancelar|generar|almacenar)\b/.test(clean)) return 'FUNCTIONAL';
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
