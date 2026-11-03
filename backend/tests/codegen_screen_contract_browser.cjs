const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('url');
const { buildFieldContract } = require('../src/services/codegen/screenContract');
const { convertHtmlToJsx, generateInteractiveMockupComponent } = require('../src/services/codegen/mockupConverter');
const frontend = require('../src/services/codegen/reactFrontendGenerator');

// Browser verification of generated controls, not AUTRON business acceptance.
(async () => {
 const root = path.resolve(__dirname, '../..');
 const cache = path.join(root, 'backend/.cache');
 fs.mkdirSync(cache, {recursive:true});
 const dir = fs.mkdtempSync(path.join(cache, 'screen-browser-'));
 const entities = [
  {id:'client', name:'Cliente', attributes:[{fieldName:'claveCliente',type:'UUID',isPk:true},{fieldName:'nombre',type:'STRING'}]},
  {id:'vehicle', name:'Vehiculo', attributes:[{fieldName:'claveVehiculo',type:'INTEGER',isPk:true},{fieldName:'clienteId',type:'UUID',allowNull:false},{fieldName:'placa',type:'STRING',allowNull:false}]}
 ];
 const fields = buildFieldContract(entities[1], [{sourceEntityId:'client',targetEntityId:'vehicle',cardinality:'1:N',foreignKey:'clienteId'}], entities);
 const actions=[{actionId:'save',operationId:'create',name:'Guardar',method:'POST',route:'/api/vehiculos'}];
 const contract={fields,actions};
 const html='<main><h1>Registrar vehículo</h1><form><input name="claveVehiculo"/><input name="clienteId"/><input name="placa"/><button data-action-id="save">Guardar</button></form></main>';
 const jsx=convertHtmlToJsx(html,'Screen','/vehiculos','Vehiculo',{screenContract:contract});
 fs.mkdirSync(path.join(dir,'src/pages/mockups'),{recursive:true});fs.mkdirSync(path.join(dir,'src/api'),{recursive:true});
 fs.writeFileSync(path.join(dir,'index.html'),'<div id="root"></div><script type="module" src="/src/main.jsx"></script>');
 fs.writeFileSync(path.join(dir,'src/main.jsx'),"import React from 'react';import {createRoot} from 'react-dom/client';import Screen from './pages/mockups/Screen';import './index.css';createRoot(document.getElementById('root')).render(<Screen/>);");
 fs.writeFileSync(path.join(dir,'src/index.css'),frontend.generateFrontendCss());
 fs.writeFileSync(path.join(dir,'src/api/client.js'),frontend.generateApiClientJs());
 fs.writeFileSync(path.join(dir,'src/pages/mockups/Screen.jsx'),generateInteractiveMockupComponent('Screen',{name:'Vehiculo',contract},jsx,null,actions,entities[1]));
 const { build, preview } = await import(pathToFileURL(path.join(root,'frontend/node_modules/vite/dist/node/index.js')).href);
 await build({root:dir,configFile:false,resolve:{alias:{react:path.join(root,'frontend/node_modules/react'),'react-dom':path.join(root,'frontend/node_modules/react-dom')}}});
 const server=await preview({root:dir,configFile:false,preview:{port:5199,host:'127.0.0.1'}});
 const {chromium}=require(path.join(root,'frontend/node_modules/@playwright/test'));
 let browser;
 try {
  browser=await chromium.launch({headless:true});
  for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844]]) {
   const page=await browser.newPage({viewport:{width,height}});
   const writes=[];
   await page.route('**/api/**',route=>{
    const req=route.request();
    if(req.method()==='POST') writes.push({url:req.url(),body:req.postDataJSON()});
    return route.fulfill({json:req.method()==='GET'?{success:true,data:[{claveCliente:'client-uuid',nombre:'Cliente de prueba explícito'}]}:{success:true,message:'Guardado'}});
   });
   await page.goto('http://127.0.0.1:5199');
   await page.getByRole('heading',{name:'Registrar vehículo'}).waitFor();
   assert.equal(await page.locator('input[name="claveVehiculo"]').count(),0);
   await page.getByRole('button',{name:'Guardar',exact:true}).first().click();
   assert.equal(writes.length,0, 'Required fields prevent API calls');
   await page.locator('select[name="clienteId"]').selectOption({label:'Cliente de prueba explícito'});
   await page.locator('input[name="placa"]').fill('PRUEBA-001');
   await page.screenshot({path:path.join(dir,name+'.png'),fullPage:true});
   await page.getByRole('button',{name:'Guardar',exact:true}).first().click();
   await page.getByText('Guardado',{exact:false}).waitFor();
   assert.equal(writes.length,1);
   assert.ok(writes[0].url.endsWith('/api/vehiculos'));
   assert.equal(writes[0].body.clienteId,'client-uuid');
   assert.equal(writes[0].body.placa,'PRUEBA-001');
   assert.equal(writes[0].body.claveVehiculo,undefined);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   console.log(name+': generated form and operation verified (mock API)');
   await page.close();
  }
  console.log('Artifacts: '+dir);
 } finally { await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1});

