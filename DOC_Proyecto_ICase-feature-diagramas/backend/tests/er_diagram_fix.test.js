const test=require('node:test');const assert=require('node:assert/strict');
const configPath=require.resolve('../src/config/env');require.cache[configPath]={id:configPath,filename:configPath,loaded:true,exports:{AI_PROVIDER:'openai',OPENAI_MODEL:'chosen'}};
const availability=require('../src/services/diagrams/diagramAvailabilityService');
const normalizer=require('../src/services/diagrams/mermaidNormalizer');
const code='erDiagram\n direction TB\n CLIENTE {\n int id PK\n }\n VEHICULO {\n int id PK\n }\n CLIENTE ||--o{ VEHICULO : posee';
const project={id:'p',name:'Taller',requirements:[{id:'r',type:'FUNCTIONAL',name:'Registrar vehículos',description:'Registrar vehículos de clientes.',status:'APPROVED'}],entities:[],relationships:[],actors:[],artifacts:[]};
require('../src/config/prisma').modelCandidate.findMany=async()=>[];
require('../src/config/prisma').source.findMany=async()=>[];
require('../src/config/prisma').requirement.findMany=async()=>project.requirements;
require('../src/config/prisma').actor.findMany=async()=>project.actors;
test('ER can be proposed from functional requirements without a separate entity approval step',()=>{
  const check=availability.evaluateProjectData(project).diagrams.ER;assert.equal(check.canGenerate,true);assert.equal(check.status,'PARTIAL');
  assert.equal(availability.evaluateProjectData({...project,requirements:[]}).diagrams.ER.canGenerate,false);
});
test('normalization removes unsupported ER direction without losing relationships',()=>{
  const normalized=normalizer.normalize(code,'ER');assert.ok(!/direction/i.test(normalized));assert.match(normalized,/CLIENTE.*\|\|--o\{.*VEHICULO/);
});
test('ER generation uses selected provider and persists a nonempty valid proposed diagram',async()=>{
  const prisma=require('../src/config/prisma');prisma.project.findUnique=async()=>project;
  const extraction=require('../src/services/analysis/documentExtraction');let called=false;
  extraction.createProvider=name=>{assert.equal(name,'openai');return {extractDocumentBatch:async(input,options)=>{called=true;assert.equal(options.model,'chosen');return {data:{mermaidCode:code}};}};};
  const service=require('../src/services/diagrams/diagramAiService');service.persistDiagramArtifact=async()=>({id:'version',createdAt:new Date()});
  const result=await service.generateDiagram('p','ER',{force:true});assert.equal(called,true);assert.equal(result.provider,'OPENAI');assert.equal(result.validation.isValid,true);assert.ok(!result.code.includes('direction'));
});
test('UML generation receives functional requirements and uses selected provider without prior class approval',async()=>{
  const check=availability.evaluateProjectData(project).diagrams.CLASS;assert.equal(check.canGenerate,true);
  const extraction=require('../src/services/analysis/documentExtraction');
  extraction.createProvider=name=>{assert.equal(name,'openai');return {extractDocumentBatch:async(input,options)=>{
    assert.equal(input.functionalRequirements[0].id,'r');assert.equal(options.model,'chosen');
    return {data:{mermaidCode:'classDiagram\n class Cliente {\n +int id\n +registrarVehiculo() void\n }\n class Vehiculo {\n +int id\n +string placa\n }\n Cliente "1" --> "0..*" Vehiculo : registra'}};
  }};};
  const service=require('../src/services/diagrams/diagramAiService');
  const result=await service.generateDiagram('p','CLASS',{force:true});assert.equal(result.provider,'OPENAI');assert.equal(result.validation.isValid,true);assert.equal(result.validation.stats.classesCount,2);
});
test('invalid empty UML responses cannot be saved as successful diagrams',async()=>{
  const extraction=require('../src/services/analysis/documentExtraction');extraction.createProvider=()=>({extractDocumentBatch:async()=>({data:{mermaidCode:'classDiagram'}})});
  const service=require('../src/services/diagrams/diagramAiService');await assert.rejects(service.generateDiagram('p','CLASS',{force:true}),{code:'INVALID_CLASS_DIAGRAM'});
});
test('invalid flow response uses one request and reports independent activities explicitly',async()=>{
  const extraction=require('../src/services/analysis/documentExtraction');let calls=0;
  extraction.createProvider=()=>({extractDocumentBatch:async()=>{calls++;return {data:{nodes:[],edges:[]}};}});
  const result=await require('../src/services/diagrams/diagramAiService').generateDiagram('p','FLOWCHART',{force:true});
  assert.equal(calls,1);assert.equal(result.validation.isValid,true);assert.ok(result.warning.includes('independientes'));assert.ok(result.code.includes(project.requirements[0].name));
});
