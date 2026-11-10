// Trusted runner. Configuration is supplied by iCASE, never by a model response.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
async function run() {
  const config = JSON.parse(process.env.ICASE_CONTAINER_TEST_CONFIG || '{}');
  if (!config.directory || !config.specFile || !/^https?:\/\//.test(config.baseUrl || '')) throw new Error('INVALID_RUNNER_CONFIGURATION');
  const spec = JSON.parse(fs.readFileSync(config.specFile, 'utf8'));
  const requireApp = createRequire(path.join(config.directory, 'backend/package.json'));
  const models = requireApp(path.join(config.directory, 'backend/src/models'));
  const { Sequelize } = requireApp('sequelize');
  const independentDb = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, { dialect: 'postgres', host: process.env.DB_HOST, port: Number(process.env.DB_PORT), logging: false });
  const independentModels = Object.fromEntries(Object.entries(models).filter(([,m])=>typeof m?.getAttributes==='function').map(([name,m])=>[name,independentDb.define(name,m.getAttributes(),{tableName:m.getTableName(),timestamps:false})]));
  const request = async(method,route,body,token)=>{
    const response = await fetch(config.apiUrl+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return{status:response.status,body:await response.json()};
  };
  try {
    const outcome = await require('./contractAcceptanceRunner').runContractAcceptance({models,independentModels,request,spec,directory:config.directory,baseUrl:config.baseUrl});
    const report={...outcome,source:'RUNNING_DOCKER_CONTAINERS',executedAt:new Date().toISOString()};
    fs.writeFileSync(config.reportFile,JSON.stringify(report,null,2));
    if(!outcome.passed||!outcome.browserPassed){console.error(JSON.stringify(outcome.failures));process.exitCode=1;}
    else console.log('Pruebas reales de contenedores: '+outcome.tests.length);
  } finally {await independentDb.close();await models.sequelize.close();}
}
run().catch(error=>{console.error(error.code||error.message);process.exitCode=1;});
