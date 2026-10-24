const { id, label } = require('./mermaidSyntax');
const {useCaseActors} = require('../analysis/actorIdentity');
module.exports = {
  generate(actors = [], useCases = []) {
    actors = actors.filter(a => !a.isDeleted && require('../analysis/actorEvidence').classify(a)!=='PROJECT_CONTEXT' && (!/^personal$/i.test(a.name || '') || a.reviewStatus === 'APPROVED' || a.status === 'APPROVED'));
    const lines = ['flowchart LR'];
    const unknown = useCases.flatMap(c => useCaseActors(c).filter(ref => !actors.some(a => a.id === ref && !a.isDeleted)));
    if (unknown.length) { const error = new Error('Referencias de actores sin resolver: ' + unknown.join(', ')); error.code = 'UNRESOLVED_ACTOR_REFERENCE'; error.statusCode = 422; throw error; }
    const actorIds = new Set(actors.map(a => a.id));
    const caseIds = new Set(useCases.map(c => c.id));
    for (const a of actors) lines.push('    ' + ('ACTOR_' + id(a.id)) + '(("👤 ' + label(a.name) + '"))');
    if (useCases.length) lines.push('    subgraph SYSTEM["Sistema"]');
    for (const c of useCases) lines.push('    ' + id(c.id || c.code) + '(["' + label(c.code || c.codeId || '') + ': ' + label(c.name) + '"])');
    if (useCases.length) lines.push('    end');
    for (const c of useCases) {
      const actorList = useCaseActors(c);
      for (const a of actorList) lines.push('    ' + ('ACTOR_' + id(a)) + ' --- ' + id(c.id || c.code));
      for (const r of c.relations || []) if (caseIds.has(r.targetId) && ['include', 'extend', 'generalization'].includes(r.type) && r.evidence) lines.push('    ' + id(c.id) + ' -. "' + r.type + '" .-> ' + id(r.targetId));
    }
    return lines.join('\n');
  }
};
