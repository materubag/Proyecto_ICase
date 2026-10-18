const test=require('node:test'),assert=require('node:assert/strict');
const classifier=require('../src/services/analysis/statementClassifier');
const rules=require('../src/services/document/RuleBasedExtractor');
const sections=require('../src/services/document/SectionDetector');
const {extract}=require('../src/services/analysis/documentExtraction');
test('delivery objective differs from behavior and RF table shorthand',()=>{
  assert.equal(classifier.classify('Desarrollar e implementar una aplicación web integral.'),'OBJECTIVE');
  assert.equal(classifier.classify('El sistema permitirá registrar vehículos.'),'FUNCTIONAL');
  assert.equal(classifier.classify('Registrar vehículos',{section:'Tabla de RF'}),'FUNCTIONAL');
  assert.equal(classifier.classify('Registrar vehículos'),'UNKNOWN');
  const text='OBJETIVO GENERAL\nDesarrollar e implementar una aplicación web integral.\n\nREQUISITOS FUNCIONALES\nRF-01 Registrar vehículos.';
  assert.equal(rules.extractFunctionalRequirements(text,sections.detectSections(text)).length,1);
});
test('objectives retain literal evidence; concrete capabilities merge with existing RF',async()=>{
  const text='OBJETIVO GENERAL\nDesarrollar e implementar una plataforma para registrar vehículos.\n\nREQUISITOS FUNCIONALES\nRF-01 Registrar vehículos.';
  const result=await extract(text,{providerOverride:'local',cache:false,sourceId:'source',sourceVersionId:'v1'});
  assert.equal(result.objectives.length,1);assert.equal(result.requirements.length,1);
  assert.equal(result.requirements[0].originalCode,'RF-01');
  assert.ok(result.requirements[0].evidence.length>=2);
  for(const e of result.objectives[0].evidence)assert.equal(text.substring(e.quoteStart,e.quoteEnd),e.quote);
  assert.match(result.objectives[0].section,/OBJETIVO/);
  const repeat=await extract(text,{providerOverride:'local',cache:false,previousResult:result});
  assert.equal(repeat.requirements.length,1);assert.ok(!repeat.requirements.some(r=>classifier.classify(r.statement)==='OBJECTIVE'));
});
test('needs inside Objectives are retained; no blanket section exclusion',async()=>{
  const text='OBJETIVOS ESPECÍFICOS\nEl sistema permitirá registrar vehículos.';
  const result=await extract(text,{providerOverride:'local',cache:false});
  assert.equal(result.requirements.length,1);assert.equal(result.objectives.length,0);
});
test('legacy infinitive conversion rejects delivery objectives',()=>{
  const consolidator=require('../src/services/analysis/candidateConsolidator');
  assert.equal(consolidator.convertNeedToRequirementCandidate({description:'Desarrollar e implementar una aplicación web integral.'},'CRF-01'),null);
  const result=consolidator.consolidate({explicitRequirements:[{name:'Desarrollar e implementar una aplicación web integral.',section:'Objetivo General'}]});
  assert.equal(result.requirementCandidates.length,0);assert.equal(result.objectives.length,1);
});
test('existing objective candidate is reclassified once with evidence and restoration snapshot',async()=>{
  const {repair}=require('../src/services/analysis/objectiveRepair');
  const candidate={id:'c1',projectId:'p',statement:'Desarrollar e implementar una aplicación web integral.',sourceId:'s',sourceVersionId:'v',status:'PENDING_REVIEW',evidence:{text:'Desarrollar e implementar una aplicación web integral.',section:'Objetivo General',page:2}};
  let model=null;
  const tx={requirementCandidate:{findMany:async()=>[candidate],update:async({data})=>Object.assign(candidate,data)},modelCandidate:{findUnique:async()=>model,upsert:async({create,update})=>{model=model?{...model,...update}:create;return model;}}};
  assert.deepEqual(await repair(tx,'p','v'),['c1']);
  assert.equal(candidate.status,'REJECTED');assert.equal(model.kind,'OBJECTIVE');
  assert.equal(model.content.reclassifiedCandidates[0].candidate.status,'PENDING_REVIEW');
  assert.equal(model.evidence.page,2);assert.equal(model.evidence.section,'Objetivo General');
  assert.deepEqual(await repair(tx,'p','v'),[]);
});
test('project objective is preserved in AUTRON without creating an RF',async()=>{
  const fs=require('node:fs'),path=require('node:path');
  const text=fs.readFileSync(path.resolve(__dirname,'fixtures/autron-source.txt'),'utf8');
  const result=await extract(text,{providerOverride:'local',cache:false});
  assert.ok(result.objectives.some(o=>o.statement.startsWith('Desarrollar e implementar')));
  assert.equal(result.requirements.filter(r=>r.originalCode).length,46);
  assert.ok(!result.requirements.some(r=>classifier.classify(r.statement)==='OBJECTIVE'));
});
