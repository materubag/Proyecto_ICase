const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const spec=JSON.parse(fs.readFileSync(path.join(root,'icase.spec.json'),'utf8'));
const codes=new Map(spec.requirements.map(r=>[r.id,r.code]));
const operations=spec.operations.filter(op=>op.type==='BUSINESS_LOGIC').map(op=>({id:op.operationId,method:op.method,path:op.route,roles:op.authorizedRoles,requirements:op.requirementIds.map(id=>codes.get(id)||id),steps:op.steps || []}));
const crud=[];
for(const file of fs.readdirSync(path.join(root,'backend/src/routes')).filter(f=>f.endsWith('.routes.js'))){
  const source=fs.readFileSync(path.join(root,'backend/src/routes',file),'utf8');
  for(const match of source.matchAll(/req\.crudContract = (.+?); next\(\);/g)) {
    const op=JSON.parse(match[1]);crud.push({id:op.operationId,entity:op.entity,method:op.method,path:op.route,roles:op.authorizedRoles,body:op.input?.bodySchema,recordScope:op.recordScope || []});
  }
}
fs.writeFileSync(path.join(__dirname,'contracts.json'),JSON.stringify({operations,crud},null,2)+'\n');
console.log(`Contratos extraídos: ${operations.length} operaciones de negocio y ${crud.length} rutas CRUD.`);
