const { id, label } = require('./mermaidSyntax');
module.exports = {
  generate(architecture = {}) {
    const lines = ['flowchart TD'];
    const components = architecture.components || [];
    const names = new Set(components.map(c => c.name));
    for (const c of components) lines.push('    ' + id(c.name) + '["' + label(c.name) + ' ' + label(c.layer || '') + '"]');
    for (const r of architecture.connections || []) {
      if (names.has(r.from) && names.has(r.to) && r.evidence) lines.push('    ' + id(r.from) + ' -->|"' + label(r.type || '') + '"| ' + id(r.to));
    }
    return lines.join('\n');
  }
};
