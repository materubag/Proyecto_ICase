const test=require('node:test');const assert=require('node:assert/strict');
const domainPath=require.resolve('../src/services/engineering/domain');const mockPath=require.resolve('../src/services/mockup/mockup.service');const diagramPath=require.resolve('../src/services/diagrams/DiagramService');
let sent=null;const nodes=[{id:'a',name:'Citas',route:'/citas',status:'APPROVED',platform:'WEB',requirementIds:['ra'],actorIds:[],useCaseIds:[]},{id:'b',name:'Inventario',route:'/inventario',status:'APPROVED',platform:'WEB',requirementIds:['rb'],actorIds:[],useCaseIds:[]}];
const d={project:async()=>({platform:'WEB'}),prisma:{requirement:{findMany:async()=>[{id:'ra'},{id:'rb'}]},actor:{findMany:async()=>[]},useCase:{findMany:async()=>[]},navigationNode:{findMany:async()=>nodes}},fail:(code,message)=>{throw new Error(code);},transaction:async()=>({saved:true})};
require.cache[domainPath]={id:domainPath,filename:domainPath,loaded:true,exports:d};require.cache[mockPath]={id:mockPath,filename:mockPath,loaded:true,exports:{generateMockup:async(project)=>{sent=project;return {screens:[]};}}};require.cache[diagramPath]={id:diagramPath,filename:diagramPath,loaded:true,exports:{}};
const {generate}=require('../src/services/engineering/mockup-artifact.service');
test('selected screen limits navigation and requirement context',async()=>{await generate('p','',null,['a']);assert.deepEqual(sent.navigationNodes.map(n=>n.id),['a']);assert.deepEqual(sent.requirements.map(n=>n.id),['ra']);});
test('empty or foreign selection rejected before provider invocation',async()=>{sent=null;await assert.rejects(()=>generate('p','',null,[]),/SCREENS_SELECTION_REQUIRED/);await assert.rejects(()=>generate('p','',null,['foreign']),/INVALID_SCREEN_SELECTION/);assert.equal(sent,null);});

test('legacy screen selection resolves only to approved project navigation', async () => {
  d.prisma.screen = { findMany: async () => [{ id: 'screen-a', name: 'Citas', route: '/citas' }] };
  await generate('p', '', null, undefined, { screenIds: ['screen-a'] });
  assert.deepEqual(sent.navigationNodes.map(n => n.id), ['a']);
  d.prisma.screen.findMany = async () => [];
  await assert.rejects(() => generate('p', '', null, undefined, { screenIds: ['foreign'] }), /INVALID_SCREEN_SELECTION/);
});

test('local generation keeps selected evidence and uses the versioned artifact flow', async () => {
  const provider = require.cache[mockPath].exports;
  provider.generateLocalMockups = async project => { sent = project; return { screens: [] }; };
  await generate('p', '', null, ['b'], { mode: 'local' });
  assert.deepEqual(sent.navigationNodes.map(n => n.id), ['b']);
  assert.deepEqual(sent.requirements.map(n => n.id), ['rb']);
});

test('reload returns latest persisted mockups and skips rejected versions',async()=>{d.prisma.artifact={findMany:async()=>[{id:'art',name:'n1',versions:[{id:'v',version:2,status:'PENDING_REVIEW',structuredContent:{screen:{name:'Citas',route:'/citas',html:'<html>guardado</html>'}}}]},{id:'bad',name:'n2',versions:[{id:'bad-v',version:1,status:'REJECTED',structuredContent:{screen:{html:'rechazado'}}}]}]};const result=await require('../src/services/engineering/mockup-artifact.service').list('p');assert.equal(result.screens.length,1);assert.equal(result.screens[0].html,'<html>guardado</html>');assert.equal(result.screens[0].id,'n1');assert.equal(result.screens[0].versionId,'v');});
