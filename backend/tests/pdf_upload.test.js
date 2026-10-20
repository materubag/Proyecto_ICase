const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
test('HTTP uploads reject non-PDF formats, disguised files and audio before analysis',async()=>{
  const app=require('../src/app');
  const server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});
  const send=(route,field,name,mime,content)=>new Promise((resolve,reject)=>{
    const boundary='icase-pdf-policy-test';
    const body=Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${name}"\r\nContent-Type: ${mime}\r\n\r\n${content}\r\n--${boundary}--\r\n`);
    const req=http.request({host:'127.0.0.1',port:server.address().port,path:route,method:'POST',headers:{'Content-Type':'multipart/form-data; boundary='+boundary,'Content-Length':body.length}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
    req.on('error',reject);req.end(body);
  });
  try{
    for(const route of ['/api/documents/extract','/api/projects/p/files','/api/projects/p/sources']){
      assert.equal(await send(route,route.includes('extract')?'file':'files','a.docx','application/pdf','not PDF'),415,route);
    }
    assert.equal(await send('/api/documents/extract','file','a.pdf','application/pdf','not PDF'),415);
    assert.equal(await send('/api/projects/p/sources/audio','file','a.mp3','audio/mpeg','audio'),415);
    assert.equal(await send('/api/sources/s/retry','file','a.mp3','audio/mpeg','audio'),415);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
