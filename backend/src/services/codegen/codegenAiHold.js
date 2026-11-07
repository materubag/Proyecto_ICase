const fs = require('node:fs');
const path = require('node:path');

function filename(projectId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error('INVALID_PROJECT_ID');
  const root = process.cwd().endsWith('backend') ? process.cwd() : path.join(process.cwd(), 'backend');
  return path.join(root, '.cache', 'codegen_ai_holds', projectId + '.json');
}

function holdProject(projectId, reason) {
  const file = filename(projectId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ projectId, reason, createdAt: new Date().toISOString() }, null, 2));
}

function assertAllowed(projectId) {
  const file = filename(projectId);
  if (!fs.existsSync(file)) return;
  const hold = JSON.parse(fs.readFileSync(file, 'utf8'));
  throw Object.assign(new Error(hold.reason || 'Generación con IA detenida para evitar consumo adicional. Primero deben resolverse los bloqueos técnicos.'), { code: 'AI_GENERATION_HELD', statusCode: 409 });
}

module.exports = { holdProject, assertAllowed };
