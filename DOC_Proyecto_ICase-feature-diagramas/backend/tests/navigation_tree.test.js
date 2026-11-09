const test=require('node:test');const assert=require('node:assert/strict');const {generate}=require('../src/services/diagrams/navigationTree');
test('navigation preserves explicit parent-child links and unique IDs even with equal names',()=>{
  const code=generate([{id:'module',name:'Clientes'},{id:'list',name:'Clientes',parentId:'module',route:'/clientes'}],'Taller');
  assert.equal(code.split('\n').filter(l=>l.includes(' --> ')).length,2);assert.ok(code.includes('/clientes'));assert.ok(!code.includes('/login'));
});
test('cycles, missing parents and empty navigation cannot become successful trees',()=>{
  assert.throws(()=>generate([]));assert.throws(()=>generate([{id:'a',name:'A',parentId:'missing'}]));
  assert.throws(()=>generate([{id:'a',name:'A',parentId:'b'},{id:'b',name:'B',parentId:'a'}]));
  assert.throws(()=>generate([{id:'a',name:'A'},{id:'a',name:'B'}]));
});
