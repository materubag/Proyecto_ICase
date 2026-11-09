const test=require('node:test'),assert=require('node:assert/strict');const {generate}=require('../src/services/diagrams/processFlow');
const model=()=>({nodes:[{id:'s',label:'Inicio',type:'start'},{id:'p',label:'Registrar solicitud',type:'process',requirementIds:['r']},{id:'e',label:'Fin',type:'end'}],edges:[{source:'s',target:'p'},{source:'p',target:'e'}]});
test('flow renders evidenced steps and terminal nodes',()=>assert.match(generate(model(),[{id:'r'}]),/^flowchart TD/));
test('unknown requirements and disconnected steps are rejected',()=>{
  assert.throws(()=>generate(model(),[]));const m=model();m.edges.pop();assert.throws(()=>generate(m,[{id:'r'}]));
});
test('decisions require distinct labeled branches',()=>{
  const m=model();m.nodes[1].type='decision';assert.throws(()=>generate(m,[{id:'r'}]));
});
test('independent documented processes need not be chained',()=>{
  const m=model();m.nodes.push({id:'s2',label:'Inicio independiente',type:'start'},{id:'e2',label:'Fin independiente',type:'end'});m.edges.push({source:'s2',target:'e2'});assert.ok(generate(m,[{id:'r'}]));
});
test('safe alternative retains every requirement as an independent operation without fabricated decisions',()=>{
  const {independent}=require('../src/services/diagrams/processFlow');const reqs=[{id:'a',code:'RF-01',name:'Registrar clientes'},{id:'b',code:'RF-02',name:'Consultar agenda'}];
  const model=independent(reqs);assert.equal(model.nodes.length,6);assert.equal(model.edges.length,4);assert.ok(!model.nodes.some(n=>n.type==='decision'));assert.ok(generate(model,reqs));
});
