const { createHash } = require('crypto');

function questionFor(target, ambiguities, targetKind = 'OPERATION') {
  // Technical failures and malformed provider output are never user questions.
  const details = [...new Set(splitAmbiguities(ambiguities).business)];
  if (!details.length) return null;
  const targetId = targetKind === 'OPERATION' ? target.operationId : target.id;
  const digest = createHash('sha256').update(JSON.stringify({ targetKind, targetId, details })).digest('hex').slice(0, 16);
  const questionId = 'generation_' + digest;
  if (target.generationDecisions?.some(decision => decision.questionId === questionId)) return null;
  return {
    questionId, source: 'GENERATION', targetKind, targetId,
    title: `${targetId}: ${target.name || target.title || targetId}`,
    question: `Para completar «${target.name || target.title || targetId}», aclara los siguientes puntos:`,
    details, requirementIds: target.requirementIds || [], options: [], customAllowed: true,
    customPlaceholder: 'Responde cada punto: datos necesarios, pasos, permisos y resultado esperado según corresponda.'
  };
}

function attachDecisions(target, decisions, targetKind = 'OPERATION') {
  const targetId = targetKind === 'OPERATION' ? target.operationId : target.id;
  const relevant = Object.values(decisions || {}).filter(decision => decision.data?.source === 'GENERATION' &&
    decision.data.targetKind === targetKind && decision.data.targetId === targetId);
  if (relevant.length) target.generationDecisions = relevant.map(decision => ({
    questionId: decision.questionId, details: decision.data.details,
    answer: decision.customAnswer, revision: decision.revision
  }));
  return target;
}

function splitAmbiguities(ambiguities) {
  const business = [], technical = [];
  for (const item of Array.isArray(ambiguities) ? ambiguities : []) {
    const value = typeof item === 'string' ? item : item?.question || item?.message || item?.description || item?.issue || item?.reason;
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) continue;
    if (/^[A-Z][A-Z0-9_]+$/.test(text) || /^(?:unresolved|undefined|null|\[object Object\])(?:\s|:|$)/i.test(text)) {
      technical.push('INVALID_CLARIFICATION_OUTPUT: ' + text);
      continue;
    }
    const approvedImplementation = /(?:aprobad[oa]s?|decisi[oó]n[^.;!?]{0,120}\bconfirma(?:da)?\b)/i.test(text) && /(?:incorporar|implementar|actualizar|conectar|falta un v[ií]nculo ejecutable|todav[ií]a no est[aá]n|se requiere separar|comandos independientes|contratos independientes|no forma parte de este CREATE)/i.test(text);
    const missingRuntime = /(?:Implementar un default persistente|el contrato ejecutable de ese mecanismo no est[aá] incluido|binding disponible no incluye una operaci[oó]n de trim)/i.test(text);
    // Missing policy is a business question; representing an approved policy in
    // a schema, migration, runtime or existing HTML is implementation work.
    const missingPolicy = /(?:no se proporcion[oó].*matriz|no se especifica.*pol[ií]tica.*roles.*asignar|no se especifica.*(?:tasa de impuestos|criterio de autorizaci[oó]n))/i.test(text);
    const technicalContract = /(?:binding.*no (?:puede|ofrece|especifica)|bodySchema no puede expresar|esquema.*no (?:define par[aá]metros|expresar esta comparaci[oó]n)|referencias.*no especifican acceso a par[aá]metros|ninguna entidad.*clave de idempotencia|idempotencia.*no existe un modelo|contrato declarativo no especifica bloqueo|AUDITORIA\.detalle es STRING|cat[aá]logo.*fechaRegistro sin defaultValue|UC-\d+.*(?:cuatro contratos independientes|debe dividirse en contratos|no puede ejecutar conjuntamente)|(?:no existe|no hay).*PROPUESTAOBDCODIGO|no hay un flujo ejecutable|modelo suministrado no declara la restricci[oó]n|falta.*(?:modelo|campos|vencimiento).*(?:contratos|USUARIO)|campos.*no existen en USUARIO)/i.test(text);
    const screenImplementation = /(?:HTML|controles?|bot[oó]n|radios|input|selectores|filas|pantalla|interfaz).*(?:no (?:existe|hay|contiene|tiene|expone|declara|refleja|est[aá]|permite)|no se (?:conecta|vincula)|no corresponde|no aparecen|pendiente|incompatible|est[aá]tico|como texto|vincula su acci[oó]n|operaci[oó]n.*autorizad|distintivo|contrato distinto)|no (?:hay|existe) (?:un |una )?(?:control|bot[oó]n|operaci[oó]n (?:GET|UPDATE))|(?:narrativa|descripci[oó]n).*rol.*(?:mientras|pero)|(?:ruta y el contrato de pantalla deben aclararse)/i.test(text);
    const confirmedWork = /(?:decisi[oó]n|regla confirmada|reglas aprobadas|autorizaci[oó]n aprobada|rama de evidencia aprob[oó]|las decisiones)/i.test(text) && /(?:validaci[oó]n de no desactivar|asegurar que el contrato|expresar esos permisos en contratos|c[oó]mo se almacenar[aá] la huella|no define un atributo|no est[aá] aprobado|no est[aá] representad|no establece una relaci[oó]n|no aparece en el cat[aá]logo|authorizedRoles=|no implementa esas reglas|restricci[oó]n [uú]nica|contratos ejecutables|identidad t[eé]cnica|limitaciones anteriores|no se especifica un c[aá]lculo de fecha)/i.test(text);
    const inconsistentInterface = /(?:contrato autoriza.*mientras.*descripci[oó]n narrativa|operaci[oó]n est[aá] autorizada.*mientras.*HTML|control input.*formato y unidades|bot[oó]n principal dice.*crea una venta BORRADOR|limitaciones anteriores no se puede verificar una ejecuci[oó]n exitosa)/i.test(text);
    const implementation = /\b(bindingVersion|resultStep|UNKNOWN_BROWSER_FIELD)\b|(?:binding|motor|generador|QUERY).*(?:no implementa|no permite|no soporta|no proporciona|falta soporte)|(?:COUNT|SUM|GROUP BY).*(?:binding|implement|soport)|no (?:hay|existe|se proporcionó).*(?:pantalla|controles).*(?:ya aprobad|decisión aprob)|(?:contrato de pantalla|pantalla.*contrato).*(?:solo declara|únicamente.*consulta)|recomendaci[oó]n:\s*(?:implementar|actualizar el contrato|completar el modelo|modelar ese dato|especificar y habilitar)|(?:modelo|cat[aá]logo).*(?:no contiene|no declara|a[uú]n no).*(?:aprobad|default)/i.test(text);
    (!missingPolicy && (implementation || approvedImplementation || missingRuntime || technicalContract || screenImplementation || confirmedWork || inconsistentInterface) ? technical : business).push(text);
  }
  return { business, technical };
}

// Repair persisted questions without approving anything or scheduling AI calls.
function reclassifyTechnicalQuestions(job) {
  if (job.status !== 'WAITING_FOR_INPUT') return false;
  let changed = false;
  const pending = [];
  for (const question of job.questions || []) {
    if (question.source !== 'GENERATION') { pending.push(question); continue; }
    const split = splitAmbiguities(question.details);
    if (!split.technical.length) { pending.push(question); continue; }
    changed = true;
    job.planningBlockers ||= [];
    let blocker = job.planningBlockers.find(item => item.operationId === question.targetId && item.targetKind === question.targetKind);
    if (!blocker) {
      blocker = { operationId: question.targetId, targetKind: question.targetKind, name: question.title, errors: [] };
      job.planningBlockers.push(blocker);
    }
    blocker.errors = [...new Set([...blocker.errors, ...split.technical])];
    if (split.business.length) pending.push({ ...question, details: split.business });
  }
  if (!changed) return false;
  job.questions = pending;
  if (!pending.length) {
    job.status = 'BLOCKED';
    job.stageMessage = 'Las decisiones están guardadas. Quedan tareas de implementación técnica; no se requieren respuestas repetidas.';
  } else job.stageMessage = `Quedan ${pending.length} aclaraciones de negocio; los puntos técnicos se trasladaron a bloqueos de implementación.`;
  return true;
}

module.exports = { questionFor, attachDecisions, splitAmbiguities, reclassifyTechnicalQuestions };
