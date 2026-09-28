const { id, token, label } = require('./mermaidSyntax');
module.exports = {
  generate(entities = [], relationships = []) {
    const lines = ['erDiagram'];
    const names = new Map();
    for (const e of entities) { const key = token(e.name) + '_' + id(e.id || e.name); names.set(e.id || e.name, key); names.set(e.name, key); }
    for (const e of entities) {
      const key = names.get(e.id || e.name);
      if (e.attributes?.length) {
        lines.push('    ' + key + ' {');
        for (const a of e.attributes) {
          const rawType = String(a.type || 'string').split('|')[0].trim();
          lines.push('        ' + token(rawType) + ' ' + token(a.name) + (a.isPk ? ' PK' : ''));
        }
        lines.push('    }');
      }
    }
    const cards = { '1:1': '||--||', ONE_TO_ONE: '||--||', '1:N': '||--o{', ONE_TO_MANY: '||--o{', 'N:M': '}o--o{', MANY_TO_MANY: '}o--o{' };
    for (const r of relationships) {
      if (!names.has(r.source) || !names.has(r.target) || !cards[r.cardinality]) throw new Error('Relación E/R sin extremos o cardinalidad confirmada.');
      lines.push('    ' + names.get(r.source) + ' ' + cards[r.cardinality] + ' ' + names.get(r.target) + ' : "' + label(r.description || 'relaciona') + '"');
    }
    return lines.join('\n');
  }
};
