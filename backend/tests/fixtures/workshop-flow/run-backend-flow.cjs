const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const runId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex');
const project='autron-flow-'+crypto.randomBytes(5).toString('hex');
if(!/^autron-flow-[a-f0-9]{10}$/.test(project))throw new Error('Invalid test project');
const directory=path.join(__dirname,'results',runId);fs.mkdirSync(directory,{recursive:true});
const env={...process.env,AUTRON_FLOW_DB_PASSWORD:crypto.randomBytes(24).toString('hex'),AUTRON_FLOW_JWT_SECRET:crypto.randomBytes(48).toString('hex'),AUTRON_FLOW_RUN_ID:runId};
const prefix=['compose','-p',project,'-f',path.join(__dirname,'compose.flow-tests.yml')];
const metadata={runId,project,startedAt:new Date().toISOString(),isolatedDatabase:'autron_flow_test',portsPublished:false,productionModified:false};
const sourceHash=crypto.createHash('sha256');
function hashDirectory(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const file=path.join(directory,entry.name);if(entry.isDirectory())hashDirectory(file);else sourceHash.update(path.relative(root,file)).update(fs.readFileSync(file));}}
hashDirectory(path.join(root,'backend/src'));metadata.backendSourceSha256=sourceHash.digest('hex');
require('./flow/extract-contracts.cjs');
function docker(args,inherit=false){return spawnSync('docker',[...prefix,...args],{cwd:root,env,encoding:'utf8',maxBuffer:16*1024*1024,...(inherit?{stdio:'inherit'}:{})});}
let code=1;
try {
  console.log('Isolated test project: '+project);
  const up=docker(['up','--build','-d','--wait','--wait-timeout','120'],true);
  if(up.status!==0)throw new Error('No se pudo iniciar el entorno aislado de pruebas.');
  const run=docker(['exec','-T','backend','node','--test','--test-reporter=tap','/flow-tests/backend-roles.flow.test.cjs']);
  fs.writeFileSync(path.join(directory,'test-output.tap'),run.stdout || '');
  fs.writeFileSync(path.join(directory,'test-stderr.log'),run.stderr || '');
  const tail=(run.stdout || '').split('\n').slice(-20).join('\n');console.log(tail);
  code=run.status ?? 1; metadata.testExitCode=code;
  if(!fs.existsSync(path.join(directory,'results.json')))throw new Error('La suite no produjo un informe estructurado. Consulte test-output.tap.');
} catch(error){code=1;metadata.infrastructureError=error.message;console.error(error.message);}
finally {
  // Only the uniquely named test project is removed. All test DB data lives in tmpfs.
  const down=docker(['down','--remove-orphans'],true);
  metadata.cleanupSucceeded=down.status===0;
  if(!metadata.cleanupSucceeded)code=1;
  metadata.finishedAt=new Date().toISOString();
  fs.writeFileSync(path.join(directory,'run.json'),JSON.stringify(metadata,null,2)+'\n');
  if(fs.existsSync(path.join(directory,'results.json'))){
    require('./flow/render-flow-report.cjs').render(directory);
    fs.writeFileSync(path.join(__dirname,'results','latest.json'),JSON.stringify({runId,directory,exitCode:code},null,2)+'\n');
    console.log('Informe: '+path.join(directory,'FLUJO_BACKEND.md'));
  }
  process.exitCode=code;
}
