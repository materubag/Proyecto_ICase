const test=require('node:test'),assert=require('node:assert/strict');
const {pdf}=require('./fixtures/pdfFixture.cjs');
const extractor=require('../src/services/document/PdfExtractor');
const {extract}=require('../src/services/analysis/documentExtraction');
const local={providerOverride:'local',cache:false};
const empty=segments=>({coveredSegmentIds:segments.map(s=>s.id),actors:[],requirements:[],other:[]});
const domains=[
  {name:'academica',pages:[['GESTION ACADEMICA','1. RF-001: Registrar matriculas.','RNF-01 Responder en dos segundos.']],expected:['Registrar matriculas.','Responder en dos segundos.']},
  {name:'inventario',pages:[[['Codigo','Descripcion','Prioridad'],['RF-001','Registrar existencias.','Alta'],['RNF-01','Conservar integridad.','Media']]],expected:['Registrar existencias.','Conservar integridad.']},
  {name:'reservas',pages:[['RESERVAS','RF-001 Registrar reservas'],['RESERVAS','con fecha y recurso.','RNF-01 Cifrar las comunicaciones.']],expected:['Registrar reservas con fecha y recurso.','Cifrar las comunicaciones.']},
  {name:'servicios',pages:[[['RF-001 Registrar solicitudes.','RNF-01 Mantener disponibilidad.']]],expected:['Registrar solicitudes.','Mantener disponibilidad.']}
];
for(const domain of domains)test('PDF real offline: '+domain.name,async()=>{
  const document=await extractor.extractFromBuffer(pdf(domain.pages),domain.name+'.pdf');
  const result=await extract(document.extractedText,local);
  assert.deepEqual(result.requirements.map(r=>r.statement),domain.expected);
  assert.ok(result.requirements.every(r=>r.evidence.length));
  assert.ok(!result.actors.some(a=>/mec[aá]nico|recepci[oó]n/i.test(a.name)));
});
test('declared fields and documented legend preserve multiple executors and read-only roles',async()=>{
  const text='Leyenda: A=Administrador; R=Recepción; C=Auditor; E=Ejecutor; L=Consulta\nCódigo | Tipo | Descripción | Actores | Dependencias | Prioridad\nRF-001 | RF | El Administrador y Recepción podrán crear cuentas. | A:E; R:E; C:L | Sin dependencias | Alta\nRF-002 | RF | Consultar cuentas. | C:L | RF-001 | Baja';
  const result=await extract(text,local),[a,b]=result.requirements;
  assert.equal(a.statement,'El Administrador y Recepción podrán crear cuentas.');
  assert.equal(a.priority,'HIGH');assert.equal(b.priority,'LOW');
  assert.deepEqual(a.accessActorIds.map(id=>result.actors.find(actor=>actor.id===id).name).sort(),['Administrador','Recepción']);
  assert.equal(a.readActorIds.length,1);assert.ok(!a.accessActorIds.includes(a.readActorIds[0]));
  assert.deepEqual(b.dependencies,[a.id]);assert.equal(a.dependencyStatus,'ANALYZED');
});
test('unknown abbreviations never become permissions',async()=>{
  const result=await extract('Código | Descripción | Actores\nRF-001 | Crear cuentas. | A:E',local);
  assert.equal(result.requirements[0].associations.length,0);
  assert.ok(result.requirements[0].pending.some(p=>p.includes('sin leyenda')));
});
test('cycles and unknown dependencies block generation without losing evidence',async()=>{
  const result=await extract('Código | Descripción | Dependencias\nRF-001 | Registrar operaciones. | RF-002\nRF-002 | Validar operaciones. | RF-001',local);
  assert.ok(result.validation.issues.some(i=>i.code==='CIRCULAR_PREREQUISITES'));
  assert.equal(result.validation.canGenerate,false);assert.ok(result.requirements.every(r=>r.evidence.length));
});
test('semantic relations remain evidence-backed proposals, not approved dependencies',async()=>{
  const result=await extract('RF-001 Registrar una solicitud.\nRF-002 Confirmar solicitudes registradas.',{providerOverride:'openai',cache:false,providerInstance:{async extractDocumentBatch({segments,knownRequirements}){
    return {data:{...empty(segments),relations:[{requirementId:knownRequirements[1].id,targetId:knownRequirements[0].id,kind:'ENABLES_STATE',segmentIds:[segments[1].id],quote:segments[1].text.trim(),reason:'La confirmación exige una solicitud registrada.'}]}};
  }}});
  const r=result.requirements[1];assert.deepEqual(r.dependencies,[]);assert.equal(r.relations[0].status,'UNRESOLVED');assert.equal(result.validation.canGenerate,false);
});
test('only PDF metadata and real PDF content are accepted',async()=>{
  const policy=require('../src/utils/pdfFilePolicy');
  for(const originalname of ['a.doc','a.docx','a.odt','a.txt','a.mp3','a.exe'])assert.throws(()=>policy.validate({originalname,mimetype:'application/pdf'}),{code:'PDF_REQUIRED'});
  assert.throws(()=>policy.validate({originalname:'a.pdf',mimetype:'audio/mpeg'}),{code:'PDF_REQUIRED'});
  await assert.rejects(extractor.extractFromBuffer(Buffer.from('not a PDF'),'a.pdf'),{code:'PDF_REQUIRED'});
  assert.doesNotThrow(()=>policy.validate({originalname:'A.PDF',mimetype:'application/pdf'}));
});
test('documented unambiguous subjects require zero extraction requests',async()=>{
  let calls=0;
  const result=await extract('RF-001 Operador registra solicitudes.',{providerOverride:'openai',knownActors:[{id:'o',name:'Operador'}],cache:false,providerInstance:{async extractDocumentBatch(){calls++;throw Error('Unnecessary request');}}});
  assert.equal(calls,0);assert.equal(result.partial,false);assert.equal(result.metrics.localResolvedBatches,1);
});
test('paragraph requirements and multiline rules preserve exact codes, statements and links',async()=>{
  const result=await extract('RF-001: Registrar reservas. RF-002: Consultar reservas.\n\nCódigo | Descripción | Reglas\nRF-003 | Confirmar reservas. | RN-001\n\nRN-001 Solo confirmar reservas\ncon disponibilidad validada.',local);
  assert.deepEqual(result.requirements.map(r=>r.originalCode),['RF-001','RF-002','RF-003']);
  assert.equal(result.requirements[0].statement,'Registrar reservas.');
  assert.equal(result.businessRules[0].code,'RN-001');
  assert.equal(result.businessRules[0].statement,'Solo confirmar reservas con disponibilidad validada.');
  assert.equal(result.requirements[2].businessRuleRefs[0].code,'RN-001');
});
test('validation recomputes evidence rather than trusting a supplied successful report',()=>{
  const result={requirements:[{id:'r',statement:'Registrar datos.',type:'FUNCTIONAL',evidence:[],associations:[]}],actors:[],validation:{canGenerate:true}};
  assert.throws(()=>require('../src/services/analysis/catalogIntegrity').assertValid(result),{code:'EXTRACTION_NEEDS_REVIEW'});
});
test('passive mentions and message recipients are never execution permissions',async()=>{
  const result=await extract('RF-001 Mecánico asignado a una orden.\nRF-002 Cliente recibe notificaciones.\nRF-003 Administrador y Cliente podrán ser consultados.',{...local,knownActors:[{id:'m',name:'Mecánico'},{id:'c',name:'Cliente'},{id:'a',name:'Administrador'}]});
  assert.ok(result.requirements.every(r=>r.accessActorIds.length===0));
  assert.equal(result.requirements[1].associations[0].role,'RECIPIENT');
});
