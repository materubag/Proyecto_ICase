const {id,label}=require('./mermaidSyntax');
function generate(nodes=[],projectName='Sistema'){
  // Sanitize nodes: ensure valid names, fallback missing IDs, and heal orphan or cyclic parent references
  const validNodes = nodes.filter(n => n && (n.id || n.name)).map((n, idx) => ({
    id: n.id || `nav_node_${idx}`,
    name: n.name || n.from || n.to || 'Módulo',
    parentId: n.parentId || null,
    route: n.route || null
  }));

  if (!validNodes.length) throw Object.assign(new Error('No hay nodos de navegación disponibles.'), { statusCode: 422 });

  const map = new Map(validNodes.map(n => [n.id, n]));

  // Break cycles and heal unknown parents by attaching them directly to root (parentId = null)
  for (const n of validNodes) {
    const seen = new Set();
    let current = n;
    while (current?.parentId) {
      if (seen.has(current.id) || !map.has(current.parentId)) {
        // If parent is unknown or introduces a cycle, safely attach to root
        current.parentId = null;
        break;
      }
      seen.add(current.id);
      current = map.get(current.parentId);
    }
  }

  const lines = ['flowchart TD', ` APP_ROOT["${label(projectName)}"]`];
  for (const n of validNodes) lines.push(` ${id(n.id)}["${label(n.name)}${n.route ? ' — ' + label(n.route) : ''}"]`);
  for (const n of validNodes) lines.push(` ${n.parentId ? id(n.parentId) : 'APP_ROOT'} --> ${id(n.id)}`);
  return lines.join('\n');
}
module.exports={generate};
