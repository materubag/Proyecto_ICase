const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {extract,segmentText} = require('../src/services/analysis/documentExtraction');
const integrity = require('../src/services/analysis/catalogIntegrity');
const local = {providerOverride:'local',cache:false};
const empty = segments => ({coveredSegmentIds:segments.map(s=>s.id),actors:[],requirements:[],other:[]});

test('table columns, repeated page header and multiline description retain literal evidence',async()=>{
  const text='[PÁGINA 1]\nCódigo\tDescripción\tActores\tPrioridad\nRF-001\tRegistrar préstamos\tBibliotecario\tAlta\n--- [SALTO_PAGINA] ---\n[PÁGINA 2]\nCódigo\tDescripción\tActores\tPrioridad\n\tcon fecha de devolución.\t\t\nRF-002\tConsultar préstamos.\tSocio\tBaja';
  const result=await extract(text,local);
  assert.equal(result.requirements.length,2);
  const r=result.requirements[0];
  assert.equal(r.statement,'Registrar préstamos con fecha de devolución.');
  assert.equal(r.originalCode,'RF-001');
  assert.ok(r.evidence.some(e=>e.page===1)); assert.ok(r.evidence.some(e=>e.page===2));
  for(const e of r.evidence)assert.equal(text.slice(e.quoteStart,e.quoteEnd),e.quote);
});
test('ambiguous tables and conflicting codes block promotion/generation',async()=>{
  for(const text of ['RF-001 | Registrar préstamos | Socio | Alta','RF-001 Registrar préstamos.\nRF-001 Eliminar préstamos.']){
    const result=await extract(text,local);
    assert.equal(result.validation.canGenerate,false);
    assert.ok(result.requirements.some(r=>r.reviewStatus==='NEEDS_REVIEW'));
    assert.throws(()=>integrity.assertValid(result),{code:'EXTRACTION_NEEDS_REVIEW'});
  }
});
test('dependencies require explicit linkage and valid catalog targets',async()=>{
  const result=await extract('RF-001 Registrar una reserva.\nRF-002 Confirmar reserva; requiere previamente RF-001.\nRF-003 Cancelar reserva; depende de RF-099.\nRF-004 Consultar reservas.',local);
  const [a,b,c,d]=result.requirements;
  assert.deepEqual(b.dependencies,[a.id]); assert.equal(b.dependencyStatus,'ANALYZED');
  assert.ok(b.dependencyEvidence[0].evidence.length);
  assert.equal(c.dependencyStatus,'UNRESOLVED'); assert.deepEqual(c.dependencies,[]);
  assert.equal(d.dependencyStatus,'UNANALYZED');
  assert.equal(a.priority,null); assert.equal(a.preconditions,null); assert.equal(a.postconditions,null);
});
test('AUTRON examples are test data: subject, recipient and internal behavior stay distinct',async()=>{
  const knownActors=[{id:'reception',name:'Recepción'},{id:'mechanic',name:'Mecánico'},{id:'client',name:'Cliente'}];
  const result=await extract('RF-026 Recepción asigna uno o varios mecánicos.\nRF-029 Mecánico finaliza una orden.\nRF-023 Cliente autoriza total o parcialmente, o rechaza cotizaciones.\nRF-033 El sistema descuenta automáticamente el inventario.',{...local,knownActors});
  const [assign,finish,authorize,automatic]=result.requirements;
  assert.ok(assign.associations.some(a=>a.actorId==='reception'&&a.role==='EXECUTOR'));
  assert.ok(assign.associations.some(a=>a.actorId==='mechanic'&&a.role==='RECIPIENT'));
  assert.deepEqual(assign.accessActorIds,['reception']);
  assert.deepEqual(finish.accessActorIds,['mechanic']); assert.deepEqual(authorize.accessActorIds,['client']);
  assert.equal(automatic.behavior,'SYSTEM_BEHAVIOR');assert.deepEqual(automatic.actorIds,[]);
});
test('mixed capabilities are separate candidates and explicit business rules survive offline failure',async()=>{
  const result=await extract('RF-001 Registrar préstamos.\n\nEl sistema debe exportar informes.\n\nRN-01 Solo se prestan ejemplares disponibles.',local);
  assert.equal(result.analysisMode,'EXPLICIT_REQUIREMENTS');assert.equal(result.requirements.length,1);
  assert.equal(result.additionalCandidates.length,1);assert.equal(result.businessRules.length,1);
  assert.equal(result.businessRules[0].statement,'Solo se prestan ejemplares disponibles.');
});
test('unchanged segment IDs survive an unrelated edit; cached responses make no network requests',async()=>{
  assert.equal(segmentText('- Registrar libros.\n- Buscar libros.')[0].id,segmentText('- Registrar libros.\n- Exportar libros.')[0].id);
  const cacheDir=await fs.mkdtemp(path.join(os.tmpdir(),'icase-integrity-'));
  let calls=0;
  const providerInstance={async extractDocumentBatch({segments}){calls++;return {data:empty(segments),usage:{prompt_tokens:30,completion_tokens:10}};}};
  const options={providerOverride:'openai',modelOverride:'configured-model',providerInstance,cacheDir,batchSize:1,rates:{input:1,output:2}};
  const first=await extract('- Catálogo editorial.\n- Información institucional.',options);
  const count=calls;
  const second=await extract('- Catálogo editorial.\n- Información institucional.',options);
  assert.equal(calls,count);assert.equal(second.metrics.requestsUsed,0);assert.equal(second.metrics.cacheHits,2);
  assert.equal(first.metrics.usage[0].model,'configured-model');assert.equal(first.metrics.usage[0].estimatedCostUsd,0.00005);
  await extract('- Catálogo editorial.\n- Información revisada.',options);
  // Adjacent context may invalidate both batches, never claim a measured saving here.
  assert.ok(calls>count);
});
test('project gate stops before generation when latest source extraction is invalid',async()=>{
  const result=await extract('RF-001 Registrar datos con',local);
  await assert.rejects(integrity.assertProject({modelCandidate:{findMany:async()=>[{id:'snapshot',content:{sourceId:'s',result}}]}},'p'),{code:'EXTRACTION_NEEDS_REVIEW'});
});
test('discovery retains evidence and marks inferred interpretation unresolved',async()=>{
  const result=await extract('Se propone archivar informes.',{providerOverride:'openai',cache:false,providerInstance:{async extractDocumentBatch({segments}){
    return {data:{...empty(segments),requirements:[{segmentIds:[segments[0].id],statement:'Archivar informes',quote:'Se propone archivar informes.',type:'FUNCTIONAL',explicit:false,associations:[],pending:['Validar interpretación']}]}};
  }}});
  assert.equal(result.analysisMode,'REQUIREMENTS_DISCOVERY');assert.equal(result.requirements[0].analysisStatus,'UNRESOLVED');
  assert.equal(result.requirements[0].status,'PENDING_REVIEW');assert.ok(result.requirements[0].evidence.length);
});
test('documented subjects avoid a redundant semantic relationship request',async()=>{
  const result=await extract('RF-001 Operador registra solicitudes.',{...local,knownActors:[{id:'operator',name:'Operador'}]});
  let calls=0;
  await require('../src/services/analysis/actorRelationshipResolver').resolve(result,{providerOverride:'openai',knownActors:[{id:'operator',name:'Operador'}],providerInstance:{async extractDocumentBatch(){calls++;throw Error('Unexpected paid operation');}}});
  assert.equal(calls,0);assert.deepEqual(result.requirements[0].accessActorIds,['operator']);
});
test('legacy import without evidence fails before a database transaction',async()=>{
  const {AIService}=require('../src/services/ai/AIService');
  await assert.rejects(AIService.persistProjectAnalysis('p',{requirements:[{code:'RF-001',name:'Sin evidencia'}]}),{code:'SOURCE_EVIDENCE_REQUIRED'});
});
test('UML context has no domain catalogs, invented fields or CRUD operations',()=>{
  const context=require('../src/services/diagrams/diagramContextBuilder');
  assert.deepEqual(context.getBaselineAttributes('Paciente'),[]);
  assert.deepEqual(context.getComprehensiveDomainClasses(),[]);
  assert.deepEqual(context.getComprehensiveDomainRelationships(),[]);
  assert.deepEqual(context.sanitizeEntityAttributes([],'Libro'),[]);
  assert.deepEqual(context.deriveDomainMethods('Producto',[],[]),[]);
});
