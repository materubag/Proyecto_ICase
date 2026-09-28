const { id, label } = require('./mermaidSyntax');
module.exports = {
  generate(actors = [], useCases = []) {
    const lines = ['flowchart LR'];
    const actorIds = new Set(actors.map(a => a.id));
    const caseIds = new Set(useCases.map(c => c.id));
    for (const a of actors) lines.push('    ' + id(a.id || a.name) + '(("👤 ' + label(a.name) + '"))');
    if (useCases.length) lines.push('    subgraph SYSTEM["Sistema"]');
    for (const c of useCases) lines.push('    ' + id(c.id || c.code) + '(["' + label(c.code) + ': ' + label(c.name) + '"])');
    if (useCases.length) lines.push('    end');
    for (const c of useCases) {
      const actorList = c.actorIds || (c.actor ? [c.actor] : []);
      for (const a of actorList) lines.push('    ' + id(a) + ' --- ' + id(c.id || c.code));
      for (const r of c.relations || []) if (caseIds.has(r.targetId) && ['include', 'extend', 'generalization'].includes(r.type) && r.evidence) lines.push('    ' + id(c.id) + ' -. "' + r.type + '" .-> ' + id(r.targetId));
    }
    return lines.join('\n');
  }
};
