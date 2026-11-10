const { hash } = require('../analysis/workflowContext');
const stages = [
  'Stack tecnológico', 'Estructura del proyecto', 'Base de datos', 'Endpoints y Swagger',
  'Backend integrado', 'Frontend conectado', 'Docker y entrega'
];
const stack = {
  backend: { runtime: 'Node.js 20', framework: 'Express 4', architecture: 'Servicios y controladores' },
  database: { engine: 'PostgreSQL 15+', orm: 'Sequelize 6', migrations: 'Migraciones versionadas' },
  frontend: { framework: 'React 18', build: 'Vite 5', design: 'Mockups aprobados de Stitch' },
  services: { containers: 'Docker Compose', proxy: 'Nginx', auxiliary: [] }
};
const fail = (message, statusCode = 409) => { throw Object.assign(new Error(message), { statusCode }); };
const json = value => JSON.parse(JSON.stringify(value));
const approved = value => value?.approval && value.approval.contentHash === hash(value.content) && value.review?.status === 'SUCCEEDED' && value.validation?.passed === true;
const artifact = (content, old) => ({ version: (old?.version || 0) + 1, content, validation: { passed: false }, review: { status: 'PENDING' }, approval: null });
function assertStage(state, number) {
  if (!Number.isInteger(number) || number < 1 || number > 7) fail('Etapa inválida');
  if (!state.documentApproved) fail('Apruebe la versión vigente de requisitos y actores en el flujo documental');
  if (number > 1 && !approved(state.stages[number - 1])) fail('La etapa anterior requiere pruebas, revisión y aprobación vigentes');
}
function screenErrors(screen, input, catalog) {
  const errors = [];
  for (const field of ['id', 'name', 'purpose', 'route']) if (!screen[field] || typeof screen[field] !== 'string') errors.push('Campo obligatorio: ' + field);
  if (!/^\/(?!\/)[^\s]*$/.test(screen.route || '')) errors.push('Ruta inválida');
  for (const field of ['requirementIds', 'useCaseIds', 'actorIds', 'actions', 'fields', 'dataSources', 'navigation', 'rules', 'evidence', 'questions']) if (!Array.isArray(screen[field])) errors.push('Lista obligatoria: ' + field);
  for (const [key, rows] of [['requirementIds', input.requirements], ['actorIds', input.actors], ['useCaseIds', input.useCases]]) {
    if ((screen[key] || []).some(id => !(rows || []).some(row => row.id === id && (row.status === 'APPROVED' || row.reviewStatus === 'APPROVED')))) errors.push('Referencia no aprobada: ' + key);
  }
  if (!screen.requirementIds?.length) errors.push('Pantalla sin respaldo funcional');
  if ((catalog || []).some(other => other.id !== screen.id && other.route === screen.route)) errors.push('Ruta duplicada');
  for (const state of ['loading', 'empty', 'error', 'success', 'accessDenied']) if (!screen.states?.[state]) errors.push('Falta estado: ' + state);
  for (const field of screen.fields || []) if (!field.id || !field.label || !field.meaning || !field.logicalType || typeof field.required !== 'boolean' || !Array.isArray(field.validations)) errors.push('Campo conceptual incompleto');
  for (const action of screen.actions || []) if (!action.id || !action.label || !action.requirementIds?.length || !Array.isArray(action.actorIds)) errors.push('Acción sin contrato o respaldo');
  for (const nav of screen.navigation || []) if (!(catalog || []).some(other => other.id === nav.screenId)) errors.push('Destino de navegación inexistente');
  return errors;
}
function assertNoSecrets(value) {
  const forbidden = /^(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_STITCH_API_KEY|DATABASE_URL|DB_PASSWORD|JWT_SECRET|password|apiKey|authorization)$/i;
  function walk(item) { if (!item || typeof item !== 'object') return; for (const [key, child] of Object.entries(item)) { if (forbidden.test(key) && typeof child === 'string' && child) fail('Contexto con credenciales rechazado', 422); walk(child); } }
  walk(value);
}
function publicSpec(spec) {
  const copy = json(spec);
  delete copy.demoSeeds; delete copy.initialAccount;
  return copy;
}
module.exports = { hash, stages, stack, fail, json, approved, artifact, assertStage, screenErrors, assertNoSecrets, publicSpec };
