const d = require('./domain');
function traverse(relations, type, id) {
  const visited = new Set([`${type}:${id}`]);
  const directImpacts = [], indirectImpacts = [];
  const queue = [{ type, id, depth: 0 }];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (const r of relations.filter(r => r.fromType === current.type && r.fromId === current.id)) {
      const key = `${r.toType}:${r.toId}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const item = { type: r.toType, id: r.toId, depth: current.depth + 1 };
      (item.depth === 1 ? directImpacts : indirectImpacts).push(item);
      queue.push(item);
    }
  }
  return { directImpacts, indirectImpacts, artifactsToRegenerate: [...directImpacts, ...indirectImpacts].filter(i => i.type === 'Artifact') };
}
async function analyze(projectId, type, id, tx = d.prisma) {
  const relations = await tx.artifactRelation.findMany({ where: { projectId }, orderBy: { id: 'asc' } });
  const result = traverse(relations, type, id);
  for (const item of [...result.directImpacts, ...result.indirectImpacts]) {
    if (d.delegates[item.type]) {
      const row = await tx[d.delegates[item.type]].findUnique({ where: { id: item.id } });
      item.name = row?.name || row?.style || row?.description || item.id;
      item.status = row?.status;
      item.revision = row?.revision;
    }
  }
  result.fingerprint = d.hash(relations.map(r => [r.fromType, r.fromId, r.toType, r.toId, r.relation]));
  return result;
}
async function invalidate(tx, impact) {
  for (const item of [...impact.directImpacts, ...impact.indirectImpacts]) {
    if (d.delegates[item.type]) await tx[d.delegates[item.type]].updateMany({ where: { id: item.id, status: { notIn: ['REMOVED', 'REJECTED'] } }, data: { status: 'OUTDATED' } });
  }
}
module.exports = { traverse, analyze, invalidate };
