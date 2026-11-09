import test from 'node:test';
import assert from 'node:assert/strict';
import {parseChen,layoutChen} from '../src/utils/chenDiagram.js';
const code='erDiagram\n AUTOR {\n int codigo PK\n string nombre\n }\n LIBRO {\n int codigo PK\n string titulo\n }\n AUTOR }o--o{ LIBRO : "Escribe"';
test('Chen preserves entities, attributes, primary keys and many-to-many relationship',()=>{
  const model=parseChen(code);assert.equal(model.entities.length,2);assert.equal(model.entities[0].attributes[0].isPk,true);
  assert.equal(model.relationships[0].name,'Escribe');assert.equal(model.relationships[0].sourceCardinality,'(0,n)');assert.equal(model.relationships[0].targetCardinality,'(0,n)');
  const diagram=layoutChen(model);assert.equal(diagram.nodes.length,3);assert.equal(diagram.edges.length,2);assert.ok(diagram.width>0&&diagram.height>0);
});
test('all relationship endpoints exist and no fake attributes are added',()=>{
  const implicit=parseChen(code+'\n AUTOR ||--o{ DESCONOCIDA : tiene').entities.find(e=>e.id==='DESCONOCIDA');
  assert.equal(implicit.implicit,true);assert.deepEqual(implicit.attributes,[]);
  const model=parseChen('erDiagram\n Entidad {\n }');assert.deepEqual(model.entities[0].attributes,[]);
});
test('multiple associations between the same pair retain separate diamonds',()=>{
  const model=parseChen(code+'\n AUTOR ||--o{ LIBRO : Revisa');assert.equal(layoutChen(model).nodes.length,4);assert.equal(layoutChen(model).edges.length,4);
});

test('relation-only Mermaid entities render without invented attributes',()=>{const m=parseChen('erDiagram\n USUARIO ||--o{ ROL : tiene');assert.equal(m.entities.length,2);assert.ok(m.entities.every(e=>e.attributes.length===0));assert.equal(layoutChen(m).nodes.length,3);});
