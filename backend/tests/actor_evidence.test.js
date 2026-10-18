const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {classify,profiles}=require('../src/services/analysis/actorEvidence');
const {extract,segmentText}=require('../src/services/analysis/documentExtraction');
const dedup=require('../src/services/analysis/deduplicationService');
const actor=(name,quote)=>({name,evidence:[{quote}]});

test('project suppliers and generic participation do not establish system roles',()=>{
  assert.equal(classify(actor('Empresa Nexora','Empresa Nexora')),'PROJECT_CONTEXT');
  assert.equal(classify(actor('Personal','Participación del personal en levantamiento, validación, pruebas y aceptación.')),'NEEDS_REVIEW');
  assert.equal(classify(actor('Mecánico','• Mecánico: documenta diagnósticos y repuestos.')),'ROLE');
  assert.equal(classify(actor('Personal','Personal: registra las solicitudes del sistema.')),'ROLE');
  assert.equal(classify(actor('Empresa externa','La Empresa externa envía facturas al sistema.')),'ROLE');
});

test('normalization does not replace distinct occupational roles',()=>{
  assert.notEqual(dedup.getActorCanonicalKey('Técnico de soporte'),dedup.getActorCanonicalKey('Mecánico'));
  assert.notEqual(dedup.getActorCanonicalKey('Secretario'),dedup.getActorCanonicalKey('Recepción'));
  assert.notEqual(dedup.getActorCanonicalKey('Supervisor'),dedup.getActorCanonicalKey('Administrador'));
});

test('documented profiles survive local analysis with literal evidence and stable identities',async()=>{
  const text=fs.readFileSync(require('node:path').resolve(__dirname,'../../docs/autron-audit/autron-source.txt'),'utf8');
  const declared=profiles(text,segmentText(text));
  assert.deepEqual(declared.map(a=>a.name),['Cliente','Recepción','Mecánico','Administrador']);
  const opt={providerOverride:'local',cache:false};
  const first=await extract(text,opt),second=await extract(text,opt);
  assert.deepEqual(first.actors.map(a=>a.name),declared.map(a=>a.name));
  assert.deepEqual(first.actors.map(a=>a.id),second.actors.map(a=>a.id));
  assert.ok(first.actors.every(a=>a.classification==='ROLE'&&a.evidence.every(e=>text.includes(e.quote))));
  assert.equal(first.metrics.requestsUsed,0);
});

test('semantic project mentions stay outside confirmed roles and cannot receive requirements',async()=>{
  const text='Empresa TallerPro\nPersonal participa en levantamiento y aceptación.\nEl sistema permitirá registrar vehículos.';
  const providerInstance={async extractDocumentBatch({segments}){
    const segmentIds=segments.map(s=>s.id);
    const at=quote=>segments.filter(s=>s.text.includes(quote)).map(s=>s.id);
    return {data:{coveredSegmentIds:segmentIds,actors:[
      {key:'supplier',name:'Empresa TallerPro',kind:'HUMAN',segmentIds:at('Empresa TallerPro'),quote:'Empresa TallerPro',explicit:true},
      {key:'staff',name:'Personal',kind:'HUMAN',segmentIds:at('Personal participa'),quote:'Personal participa en levantamiento y aceptación.',explicit:true}
    ],requirements:[{statement:'El sistema permitirá registrar vehículos.',type:'FUNCTIONAL',explicit:true,segmentIds:at('El sistema'),quote:'El sistema permitirá registrar vehículos.',pending:[],associations:[{actorKey:'supplier',role:'EXECUTOR',segmentIds:at('Empresa TallerPro'),quote:'Empresa TallerPro'}]}],other:[]}};
  }};
  const result=await extract(text,{providerInstance,providerOverride:'openai',cache:false});
  assert.equal(result.failures.length,0,JSON.stringify(result.failures));
  assert.equal(result.actors.length,1);
  assert.equal(result.actors[0].name,'Personal');
  assert.equal(result.actors[0].reviewStatus,'NEEDS_REVIEW');
  assert.ok(result.requirements.every(r=>r.actorIds.length===0));
  assert.ok(result.other.some(r=>r.type==='CONTEXT'&&r.statement==='Empresa TallerPro'));
  const again=await extract(text,{providerInstance,providerOverride:'openai',cache:false,previousResult:result});
  assert.equal(again.actors.length,1);
});
