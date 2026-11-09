const test=require('node:test'),assert=require('node:assert/strict');
const envPath=require.resolve('../src/config/env');
require.cache[envPath]={id:envPath,filename:envPath,loaded:true,exports:{AI_PROVIDER:'openai',OPENAI_MODEL:'configured-model',OPENAI_API_KEY:'',GEMINI_API_KEY:'',N8N_WEBHOOK_URL:''}};
const {AIService,createAIProvider}=require('../src/services/ai/AIService');
const OpenAIProvider=require('../src/services/ai/OpenAIProvider');
const MockAIProvider=require('../src/services/ai/MockAIProvider');
const {validateAIResponse}=require('../src/services/ai/ai.contract.validator');
test('factory honors configured provider and rejects unknown providers',()=>{
 assert.ok(createAIProvider() instanceof OpenAIProvider);
 assert.ok(createAIProvider('mock') instanceof MockAIProvider);
 assert.throws(()=>createAIProvider('missing'),/desconocido/);
});
test('offline provider preserves source requirements and never fabricates a domain catalog',async()=>{
 const result=await createAIProvider('mock').analyzeProject({name:'Fixture',description:'RF-001 Registrar matriculas.'});
 assert.equal(result.requirements.length,1);assert.equal(result.requirements[0].originalCode,'RF-001');
 assert.equal(result.requirements[0].statement,'Registrar matriculas.');assert.deepEqual(result.entities,[]);
 assert.equal(validateAIResponse(result).isValid,true);
});
test('missing OpenAI credentials produce an explicit error',async()=>{
 await assert.rejects(createAIProvider().extractDocumentBatch({}),/no configurado/);
});
test('broken actor references are rejected by the canonical contract',()=>{
 const validation=validateAIResponse({project:{name:'P'},actors:[],requirements:[{code:'RF-001',name:'Registrar',actorIds:['missing']}],entities:[],relationships:[],screens:[],navigation:[],architecture:{}});
 assert.equal(validation.isValid,false);
});
test('legacy persistence without source evidence rejects before database access',async()=>{
 await assert.rejects(AIService.persistProjectAnalysis('p',{requirements:[]}),{code:'SOURCE_EVIDENCE_REQUIRED'});
});
