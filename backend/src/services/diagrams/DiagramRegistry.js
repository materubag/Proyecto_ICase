const registry = new Map();
registry.set('ER_DIAGRAM', model => require('./erDiagramGenerator').generate(model.entities, model.relationships));
registry.set('USE_CASE_DIAGRAM', model => require('./useCaseGenerator').generate(model.actors, model.useCases));
// BUG FIX: antes se pasaba navigationNodes dos veces. Ahora: (nodes, screens)
registry.set('NAVIGATION_DIAGRAM', model => require('./navigationGenerator').generate(model.screens || [], model.projectName));
registry.set('FLOWCHART_DIAGRAM', model => require('./flowchartGenerator').generate(model.requirements || [], model.useCases || [], model.projectName));
for (const type of ['SOFTWARE_ARCHITECTURE', 'SYSTEM_ARCHITECTURE']) {
  registry.set(type, model => require('./architectureGenerator').generate(model.architecture));
}
module.exports = registry;
