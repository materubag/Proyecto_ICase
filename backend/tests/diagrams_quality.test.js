const test = require('node:test');
const assert = require('node:assert');

const mermaidNormalizer = require('../src/services/diagrams/mermaidNormalizer');
const mermaidValidator = require('../src/services/diagrams/mermaidValidator');
const mermaidRepairer = require('../src/services/diagrams/mermaidRepairer');
const erDiagramGenerator = require('../src/services/diagrams/erDiagramGenerator');
const flowchartGenerator = require('../src/services/diagrams/flowchartGenerator');
const navigationGenerator = require('../src/services/diagrams/navigationGenerator');
const useCaseGenerator = require('../src/services/diagrams/useCaseGenerator');
const architectureGenerator = require('../src/services/diagrams/architectureGenerator');
const diagramContextBuilder = require('../src/services/diagrams/diagramContextBuilder');

test('1. Normalización de ER con código, categoría, descripción (sin acentos en Mermaid)', () => {
  const input = `erDiagram
    PRODUCTO {
        string código PK
        string categoría
        string descripción
        int número
    }`;

  const normalized = mermaidNormalizer.normalize(input, 'ER');
  assert.ok(!normalized.includes('código'), 'No debe contener "código" con acento');
  assert.ok(!normalized.includes('categoría'), 'No debe contener "categoría" con acento');
  assert.ok(!normalized.includes('descripción'), 'No debe contener "descripción" con acento');
  assert.ok(!normalized.includes('número'), 'No debe contener "número" con acento');

  assert.ok(normalized.includes('string codigo PK'), 'Debe contener "string codigo PK"');
  assert.ok(normalized.includes('string categoria'), 'Debe contener "string categoria"');
  assert.ok(normalized.includes('string descripcion'), 'Debe contener "string descripcion"');
  assert.ok(normalized.includes('int numero'), 'Debe contener "int numero"');

  const val = mermaidValidator.validate(normalized, 'ER');
  assert.strictEqual(val.isValid, true, `Debe ser sintácticamente válido: ${val.error}`);
});

test('2. Reparación de atributos concatenados en una sola línea en ER', () => {
  const brokenInput = `erDiagram
    PRODUCTO {
        string código PK string categoría int stock
    }`;

  const normalized = mermaidNormalizer.normalize(brokenInput, 'ER');
  const val = mermaidValidator.validate(normalized, 'ER');
  assert.strictEqual(val.isValid, true, `Debe reparar atributos concatenados: ${val.error}`);
  assert.ok(normalized.includes('string codigo PK'));
  assert.ok(normalized.includes('string categoria'));
  assert.ok(normalized.includes('int stock'));
});

test('3. ER con varias relaciones y cardinalidades estándar', () => {
  const entities = [
    { name: 'Cliente', attributes: [{ name: 'id', type: 'int', isPk: true }, { name: 'nombre', type: 'string' }] },
    { name: 'Orden', attributes: [{ name: 'id', type: 'int', isPk: true }, { name: 'total', type: 'float' }] },
    { name: 'Producto', attributes: [{ name: 'codigo', type: 'string', isPk: true }, { name: 'categoria', type: 'string' }] }
  ];
  const relationships = [
    { source: 'Cliente', target: 'Orden', cardinality: '1:N', description: 'realiza' },
    { source: 'Orden', target: 'Producto', cardinality: 'N:M', description: 'contiene' }
  ];

  const code = erDiagramGenerator.generate(entities, relationships);
  const normalized = mermaidNormalizer.normalize(code, 'ER');
  const val = mermaidValidator.validate(normalized, 'ER');

  assert.strictEqual(val.isValid, true, `ER debe ser válido: ${val.error}`);
  assert.ok(normalized.includes('||--o{'), 'Debe contener cardinalidad 1:N');
  assert.ok(normalized.includes('}o--o{'), 'Debe contener cardinalidad N:M');
});

test('4. Clases con atributos tipados, visibilidad y herencia UML', () => {
  const input = `classDiagram
    class Usuario {
      +string id
      +string nombre
      +validarAcceso() boolean
    }
    class Administrador {
      +string rol
      +auditarSistema() void
    }
    Administrador --|> Usuario : es un tipo de
    Usuario --> Rol : tiene`;

  const normalized = mermaidNormalizer.normalize(input, 'CLASS');
  const val = mermaidValidator.validate(normalized, 'CLASS');
  assert.strictEqual(val.isValid, true, `ClassDiagram debe ser válido: ${val.error}`);
  assert.ok(normalized.includes('--|>'), 'Debe conservar la relación de herencia');
});

test('5. Casos de Uso con actores externos, <<include>> y <<extend>>', () => {
  const actors = [{ name: 'Cliente' }, { name: 'Administrador' }];
  const useCases = [
    { code: 'CU-01', name: 'Realizar Pedido', actor: 'Cliente' },
    { code: 'CU-02', name: 'Verificar Stock', actor: 'Sistema' }
  ];

  const code = useCaseGenerator.generate(actors, useCases);
  const normalized = mermaidNormalizer.normalize(code, 'USE_CASE');
  const val = mermaidValidator.validate(normalized, 'USE_CASE');

  assert.strictEqual(val.isValid, true, `Casos de uso debe ser válido: ${val.error}`);
  assert.ok(normalized.includes('flowchart LR'), 'Debe ser horizontal (flowchart LR)');
  assert.ok(normalized.includes('(('), 'Debe tener actores representados con doble paréntesis');
});

test('6. Diagrama de Flujo (Procesos) con decisiones, ramas y sin identificador reservado "end"', () => {
  const requirements = [
    { name: 'Registrar orden de servicio', description: 'Recepción del vehículo' },
    { name: 'Inspeccionar fallas mecánicas', description: 'Diagnóstico técnico' },
    { name: 'Generar cotización y cobrar', description: 'Facturación' }
  ];

  const code = flowchartGenerator.generate(requirements, [], 'Taller Automotriz');
  const normalized = mermaidNormalizer.normalize(code, 'FLOWCHART');
  const val = mermaidValidator.validate(normalized, 'FLOWCHART');

  assert.strictEqual(val.isValid, true, `Flowchart debe ser válido: ${val.error}`);
  assert.ok(normalized.includes('flowchart TD'), 'Debe ser top-down (flowchart TD)');
  assert.ok(normalized.includes('{'), 'Debe incluir nodo de decisión');
  assert.ok(normalized.includes('|Sí|') || normalized.includes('|No|'), 'Debe incluir ramas condicionales');
  assert.ok(!/\bend\s*\[/i.test(normalized), 'No debe usar "end" como ID de nodo');
});

test('7. Árbol de Navegación jerárquico Padre -> Hijo (sin procesos)', () => {
  const screens = [
    { id: '1', name: 'Login', route: '/login' },
    { id: '2', name: 'Dashboard Principal', route: '/dashboard' },
    { id: '3', name: 'Lista de Vehículos', route: '/vehiculos' },
    { id: '4', name: 'Registro de Vehículo', route: '/vehiculos/nuevo' }
  ];

  const code = navigationGenerator.generate(screens, 'Sistema AUTRON');
  const normalized = mermaidNormalizer.normalize(code, 'NAVIGATION');
  const val = mermaidValidator.validate(normalized, 'NAVIGATION');

  assert.strictEqual(val.isValid, true, `Árbol de navegación debe ser válido: ${val.error}`);
  assert.ok(normalized.includes('APP_ROOT'), 'Debe tener raíz de jerarquía');
  assert.ok(normalized.includes('SCR_'), 'Debe tener nodos para pantallas');
});

test('8. Arquitectura de Software en tres capas (flowchart TB con subgraphs)', () => {
  const arch = {
    frontend: 'React SPA',
    backend: 'Node.js Express API',
    database: 'PostgreSQL 16',
    components: [
      { name: 'AuthService', layer: 'Presentation' },
      { name: 'OrderService', layer: 'Application' },
      { name: 'PrismaClient', layer: 'Persistence' }
    ]
  };

  const code = architectureGenerator.generate(arch);
  const normalized = mermaidNormalizer.normalize(code, 'ARCHITECTURE');
  const val = mermaidValidator.validate(normalized, 'ARCHITECTURE');

  assert.strictEqual(val.isValid, true, `Arquitectura debe ser válida: ${val.error}`);
  assert.ok(normalized.includes('subgraph'), 'Debe estructurarse en subgraphs');
  assert.ok(normalized.includes('PRESENTATION'), 'Debe tener capa de presentación');
  assert.ok(normalized.includes('DOMAIN'), 'Debe tener capa de dominio');
  assert.ok(normalized.includes('DATA'), 'Debe tener capa de datos');
});

test('9. Detección y reparación de Mermaid deliberadamente inválido', async () => {
  // Unclosed block with accented attributes and missing end
  const brokenMermaid = `erDiagram
    PRODUCTO {
        string código PK
        string categoría
    // Falta llave de cierre`;

  const repairResult = await mermaidRepairer.repairAndValidate(
    brokenMermaid,
    'ER',
    {},
    null,
    () => 'erDiagram\n    PRODUCTO {\n        string id PK\n    }'
  );

  assert.ok(repairResult.code, 'Debe devolver código reparado');
  const finalVal = mermaidValidator.validate(repairResult.code, 'ER');
  assert.strictEqual(finalVal.isValid, true, `Código reparado debe ser válido: ${finalVal.error}`);
});

test('10. Contextos específicos sin mezclar datos innecesarios', () => {
  const dummyProject = {
    name: 'Test Project',
    entities: [{ name: 'Cliente', attributes: [{ name: 'id', type: 'int', isPk: true }] }],
    screens: [{ name: 'Login', route: '/login' }],
    requirements: [{ name: 'RF1', description: 'Login user' }]
  };

  const erCtx = diagramContextBuilder.buildContext('ER', dummyProject);
  assert.ok(erCtx.entities, 'Contexto ER debe incluir entidades');
  assert.strictEqual(erCtx.screens, undefined, 'Contexto ER no debe incluir pantallas');

  const navCtx = diagramContextBuilder.buildContext('NAVIGATION', dummyProject);
  assert.ok(navCtx.screens, 'Contexto Navegación debe incluir pantallas');
  assert.strictEqual(navCtx.entities, undefined, 'Contexto Navegación no debe incluir entidades');

  const flowCtx = diagramContextBuilder.buildContext('FLOWCHART', dummyProject);
  assert.ok(flowCtx.steps, 'Contexto Flujo debe incluir pasos/procesos');
});
