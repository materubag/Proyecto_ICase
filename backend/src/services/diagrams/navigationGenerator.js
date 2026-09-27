const { id, label } = require('./mermaidSyntax');
module.exports = {
  generate(nodes = [], links = []) {
    const lines = ['flowchart TD'];
    const refs = new Map();
    for (const n of nodes) { refs.set(n.id || n.name, id(n.id || n.name)); refs.set(n.name, id(n.id || n.name)); }
    for (const n of nodes) {
      lines.push('    ' + refs.get(n.id || n.name) + '["' + label(n.name) + ' ' + label(n.route) + ' (' + label(n.platform || 'UNKNOWN') + ')"]');
      if (n.parentId && refs.has(n.parentId)) lines.push('    ' + refs.get(n.parentId) + ' --> ' + refs.get(n.id || n.name));
    }
    for (const r of links) if (refs.has(r.from) && refs.has(r.to) && r.from !== r.to) lines.push('    ' + refs.get(r.from) + ' -->|"' + label(r.action) + '"| ' + refs.get(r.to));
    return lines.join('\n');
  }
};
