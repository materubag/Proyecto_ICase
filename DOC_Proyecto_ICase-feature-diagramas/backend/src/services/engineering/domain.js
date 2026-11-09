const crypto = require('crypto');
const prisma = require('../../config/prisma');
const delegates = { Requirement: 'requirement', Actor: 'actor', UseCase: 'useCase', Entity: 'entity', EntityAttribute: 'entityAttribute', EntityRelationship: 'entityRelationship', NavigationNode: 'navigationNode', Architecture: 'architecture', BusinessRule: 'businessRule', Technology: 'technology', Artifact: 'artifact', Screen: 'screen' };
function fail(code, message = code, statusCode = 409) { throw Object.assign(new Error(message), { code, statusCode }); }
function json(value) { return JSON.parse(JSON.stringify(value)); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, canonical(value[k])]));
  return value;
}
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex'); }
async function transaction(fn) {
  try { return await prisma.$transaction(fn, { isolationLevel: 'Serializable', timeout: 20000 }); }
  catch (e) { if (['P2034', 'P2002'].includes(e.code)) fail('VERSION_CONFLICT', 'Otro proceso modificó estos datos. Actualiza e intenta de nuevo.'); throw e; }
}
async function project(tx, id) { const p = await tx.project.findUnique({ where: { id } }); if (!p) fail('PROJECT_NOT_FOUND', undefined, 404); return p; }
async function element(tx, projectId, type, id) {
  const delegate = delegates[type];
  if (!delegate) fail('INVALID_ELEMENT_TYPE', undefined, 400);
  const row = await tx[delegate].findUnique({ where: { id }, ...(type === 'EntityAttribute' ? { include: { entity: true } } : {}), ...(type === 'Architecture' ? { include: { components: true } } : {}) });
  if (!row || (row.projectId || row.entity?.projectId) !== projectId) fail('ELEMENT_NOT_FOUND', undefined, 404);
  return row;
}
async function link(tx, projectId, fromType, fromId, toType, toId, relation = 'DERIVES') {
  const data = { projectId, fromType, fromId, toType, toId, relation };
  return tx.artifactRelation.upsert({ where: { projectId_fromType_fromId_toType_toId_relation: data }, create: data, update: {} });
}
async function approvedRequirements(tx, projectId, ids) {
  if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string')) fail('EVIDENCE_REQUIRED', 'Selecciona requisitos aprobados como evidencia.', 400);
  const rows = await tx.requirement.findMany({ where: { projectId, id: { in: ids }, status: 'APPROVED' } });
  if (rows.length !== new Set(ids).size) fail('DEPENDENCY_CONFLICT', 'La evidencia incluye requisitos que no están aprobados.');
  return rows;
}
module.exports = { prisma, delegates, fail, json, hash, transaction, project, element, link, approvedRequirements };
