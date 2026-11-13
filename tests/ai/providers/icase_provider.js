/**
 * Custom Promptfoo Provider for ICASE Studio
 * Connects Promptfoo directly to ICASE's internal AI generation logic deterministically,
 * supporting offline evaluation, stored responses, and reproducible test runs.
 */

const MockAIProvider = require('../../../backend/src/services/ai/MockAIProvider');
const registry = require('../../../backend/src/services/diagrams/DiagramRegistry');
const mermaidNormalizer = require('../../../backend/src/services/diagrams/mermaidNormalizer');
const { normalizeAIResponse } = require('../../../backend/src/services/ai/ai.contract.validator');

const mockProvider = new MockAIProvider();

class ICasePromptfooProvider {
  constructor(options = {}) {
    this.providerId = options.id || 'icase-engine';
  }

  id() {
    return this.providerId;
  }

  async callApi(prompt, context) {
    const vars = context.vars || {};
    const task = vars.task || 'PROJECT_ANALYSIS';

    try {
      if (task === 'PROJECT_ANALYSIS') {
        const raw = await mockProvider.analyzeProject({
          name: vars.projectName || 'Sistema de Información',
          description: vars.systemDescription || ''
        });
        const normalized = normalizeAIResponse(raw);
        return {
          output: JSON.stringify(normalized, null, 2)
        };
      }

      if (task === 'ER_DIAGRAM') {
        const generator = registry.get('ER_DIAGRAM');
        const model = {
          entities: vars.entities || [
            { id: '1', name: 'Libro', attributes: [{ name: 'isbn', type: 'string', isPk: true }, { name: 'titulo', type: 'string' }] },
            { id: '2', name: 'Prestamo', attributes: [{ name: 'id', type: 'string', isPk: true }, { name: 'fecha', type: 'datetime' }] }
          ],
          relationships: vars.relationships || [
            { source: '1', target: '2', cardinality: 'ONE_TO_MANY', description: 'asociado a' }
          ]
        };
        const code = generator(model);
        return { output: mermaidNormalizer.normalize(code, 'ER') };
      }

      if (task === 'CLASS_DIAGRAM') {
        // Generate UML Domain Class Diagram
        const raw = await mockProvider.analyzeProject({
          name: vars.projectName || 'Sistema Test',
          description: vars.systemDescription || 'Gestión de libros y préstamos'
        });
        const classes = (raw.entities || []).map(e => ({
          name: e.name,
          attributes: (e.attributes || []).map(a => `+${a.type || 'String'} ${a.name}`),
          methods: [`+registrar()`, `+consultar()`]
        }));
        let classCode = 'classDiagram\n';
        for (const cls of classes) {
          classCode += `  class ${cls.name} {\n`;
          for (const attr of cls.attributes) classCode += `    ${attr}\n`;
          for (const m of cls.methods) classCode += `    ${m}\n`;
          classCode += `  }\n`;
        }
        return { output: mermaidNormalizer.normalize(classCode, 'CLASS') };
      }

      if (task === 'USE_CASE_DIAGRAM') {
        const generator = registry.get('USE_CASE_DIAGRAM');
        const model = {
          actors: vars.actors || [{ id: 'act-1', name: 'Bibliotecario' }],
          useCases: vars.useCases || [
            { id: 'uc-1', code: 'CU-01', name: 'Registrar Prestamo', actorIds: ['act-1'], relations: [] }
          ]
        };
        const code = generator(model);
        return { output: mermaidNormalizer.normalize(code, 'USE_CASE') };
      }

      if (task === 'NAVIGATION_DIAGRAM') {
        const generator = registry.get('NAVIGATION_DIAGRAM');
        const model = {
          projectName: vars.projectName || 'Portal',
          screens: vars.screens || [
            { id: 's1', name: 'Login', route: '/login' },
            { id: 's2', name: 'Dashboard', route: '/dashboard', parentId: 's1' }
          ]
        };
        const code = generator(model);
        return { output: mermaidNormalizer.normalize(code, 'NAVIGATION') };
      }

      if (task === 'ARCHITECTURE') {
        const generator = registry.get('SOFTWARE_ARCHITECTURE');
        const model = {
          architecture: vars.architecture || {
            components: [
              { name: 'Frontend React' },
              { name: 'API Express' },
              { name: 'Base de Datos PostgreSQL' }
            ],
            connections: [
              { from: 'Frontend React', to: 'API Express', type: 'REST' },
              { from: 'API Express', to: 'Base de Datos PostgreSQL', type: 'Prisma' }
            ]
          }
        };
        const code = generator(model);
        return { output: mermaidNormalizer.normalize(code, 'ARCHITECTURE') };
      }

      return { output: 'Unknown task' };
    } catch (err) {
      return {
        error: err.message
      };
    }
  }
}

module.exports = ICasePromptfooProvider;

