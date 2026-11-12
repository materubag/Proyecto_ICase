const{test}=require('node:test'),assert=require('node:assert/strict');
const{ApprovedStitch}=require('../src/services/mockup/approvedStitch');
const env=require('../src/config/env');
test('Stitch checks capabilities, saves remote identifiers and retrieves exact HTML',async()=>{
  const old=env.GOOGLE_STITCH_API_KEY;env.GOOGLE_STITCH_API_KEY='test-only';const checkpoints=[],requests=[];
  const response=data=>({ok:true,json:async()=>data});
  const service=new ApprovedStitch(async(url,options)=>{
    if(String(url).startsWith('https://storage.googleapis.com/'))return{ok:true,text:async()=>'<html><body>Stitch result</body></html>'};
    const body=JSON.parse(options.body);requests.push(body);
    if(body.method==='initialize')return response({result:{protocolVersion:'2025-03-26'}});
    if(body.method==='notifications/initialized')return{ok:true,status:202};
    if(body.method==='tools/list')return response({result:{tools:[{name:'create_project',inputSchema:{required:['title']}},{name:'generate_screen_from_text',inputSchema:{required:['projectId','prompt']}}]}});
    return response({result:{structuredContent:body.params.name==='create_project'?{name:'projects/p1'}:{outputComponents:[{design:{screens:[{id:'s1',htmlCode:{downloadUrl:'https://storage.googleapis.com/html'}}]}}]}}});
  });
  try{const result=await service.generate({id:'s',name:'Test'}, {name:'Project'}, {},{},async c=>checkpoints.push(structuredClone(c)));
    assert.match(result.html,/Stitch result/);assert.equal(result.remote.screenId,'s1');assert.ok(checkpoints.some(c=>c.remote?.projectId==='p1'));assert.equal(requests.filter(r=>r.params?.name==='generate_screen_from_text').length,1);
  }finally{env.GOOGLE_STITCH_API_KEY=old;}
});
test('ambiguous remote failures never produce a successful generic fallback or a duplicate generation',async()=>{
  const old=env.GOOGLE_STITCH_API_KEY;env.GOOGLE_STITCH_API_KEY='test-only';let generated=0;
  const service=new ApprovedStitch(async(_url,options)=>{
    const body=JSON.parse(options.body);
    if(body.method==='initialize')return{ok:true,json:async()=>({result:{protocolVersion:'2025-03-26'}})};
    if(body.method==='notifications/initialized')return{ok:true,status:202};
    if(body.method==='tools/list')return{ok:true,json:async()=>({result:{tools:[{name:'generate_screen_from_text',inputSchema:{}}]}})};
    generated++;throw new Error('Connection interrupted');
  });const remote={projectId:'p'};
  try{await assert.rejects(service.generate({name:'s'},{name:'p'},{},remote),/Connection/);assert.equal(remote.generationSubmitted,true);
    await assert.rejects(service.generate({name:'s'},{name:'p'},{},remote),/no se reenviará/);assert.equal(generated,1);
  }finally{env.GOOGLE_STITCH_API_KEY=old;}
});
