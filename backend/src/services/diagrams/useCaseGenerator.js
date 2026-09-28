const { id, label } = require('./mermaidSyntax');

module.exports = {
  generate(actors = [], useCases = []) {
    if (!actors.length && !useCases.length) {
      return 'flowchart LR';
    }

    const lines = ['flowchart LR'];

    // Map to resolve any actor reference (id, codeId, code, or name) to a declared node ID
    const actorNodeMap = new Map();
    const declaredActorNodes = new Set();

    // 1. Declare Actors (outside system boundary)
    for (const a of actors) {
      const actorKey = String(a.id || a.codeId || a.code || a.name);
      const actorNodeId = id(actorKey);

      if (!declaredActorNodes.has(actorNodeId)) {
        declaredActorNodes.add(actorNodeId);
        lines.push(`    ${actorNodeId}(("👤 ${label(a.name || a.codeId || 'Actor')}"))`);
      }

      // Index this actor under all possible identifiers for lookup
      if (a.id) actorNodeMap.set(String(a.id), actorNodeId);
      if (a.codeId) {
        actorNodeMap.set(String(a.codeId), actorNodeId);
        actorNodeMap.set(String(a.codeId).toUpperCase(), actorNodeId);
      }
      if (a.code) {
        actorNodeMap.set(String(a.code), actorNodeId);
        actorNodeMap.set(String(a.code).toUpperCase(), actorNodeId);
      }
      if (a.name) {
        actorNodeMap.set(String(a.name), actorNodeId);
        actorNodeMap.set(String(a.name).toLowerCase(), actorNodeId);
        actorNodeMap.set(String(a.name).trim().toLowerCase(), actorNodeId);
      }
    }

    // Default fallback actor node if none was declared
    let defaultActorNodeId = declaredActorNodes.values().next().value;
    if (!defaultActorNodeId && useCases.length > 0) {
      defaultActorNodeId = id('ACT_DEFAULT_USER');
      declaredActorNodes.add(defaultActorNodeId);
      lines.push(`    ${defaultActorNodeId}(("👤 Usuario"))`);
      actorNodeMap.set('usuario', defaultActorNodeId);
      actorNodeMap.set('user', defaultActorNodeId);
    }

    // 2. Declare Use Cases inside System Subgraph
    const caseIds = new Set();
    const useCaseNodeMap = new Map();

    if (useCases.length > 0) {
      lines.push('    subgraph SYSTEM["Sistema"]');
      for (const c of useCases) {
        const ucKey = String(c.id || c.codeId || c.code || c.name);
        const ucNodeId = id(ucKey);
        useCaseNodeMap.set(ucKey, ucNodeId);
        if (c.id) caseIds.add(String(c.id));
        if (c.codeId) caseIds.add(String(c.codeId));
        if (c.code) caseIds.add(String(c.code));

        const codeText = label(c.codeId || c.code || 'CU');
        const nameText = label(c.name || 'Caso de Uso');
        lines.push(`    ${ucNodeId}(["${codeText}: ${nameText}"])`);
      }
      lines.push('    end');
    }

    // 3. Connect Actors to Use Cases
    const connectedEdges = new Set();

    for (const c of useCases) {
      const ucKey = String(c.id || c.codeId || c.code || c.name);
      const ucNodeId = useCaseNodeMap.get(ucKey) || id(ucKey);

      // Collect potential actor references
      const rawActorRefs = [];
      if (Array.isArray(c.actorIds) && c.actorIds.length > 0) {
        rawActorRefs.push(...c.actorIds);
      }
      if (c.primaryActorId) rawActorRefs.push(c.primaryActorId);
      if (Array.isArray(c.secondaryActorIds) && c.secondaryActorIds.length > 0) {
        rawActorRefs.push(...c.secondaryActorIds);
      }
      if (c.actor) rawActorRefs.push(c.actor);

      // Match refs to registered actor nodes
      const targetActorNodes = new Set();
      for (const ref of rawActorRefs) {
        const strRef = String(ref).trim();
        const matched = actorNodeMap.get(strRef) || actorNodeMap.get(strRef.toLowerCase()) || actorNodeMap.get(strRef.toUpperCase());
        if (matched) targetActorNodes.add(matched);
      }

      // If no actor was matched, connect to default actor
      if (targetActorNodes.size === 0 && defaultActorNodeId) {
        targetActorNodes.add(defaultActorNodeId);
      }

      for (const actNode of targetActorNodes) {
        const edgeKey = `${actNode}---${ucNodeId}`;
        if (!connectedEdges.has(edgeKey)) {
          connectedEdges.add(edgeKey);
          lines.push(`    ${actNode} --- ${ucNodeId}`);
        }
      }

      // Inter-usecase relations (include / extend)
      for (const r of c.relations || []) {
        if (caseIds.has(String(r.targetId)) && ['include', 'extend', 'generalization'].includes(r.type) && r.evidence) {
          const targetNode = useCaseNodeMap.get(String(r.targetId)) || id(r.targetId);
          const relLabel = r.type === 'include' ? '<<include>>' : (r.type === 'extend' ? '<<extend>>' : r.type);
          lines.push(`    ${ucNodeId} -.->|${relLabel}| ${targetNode}`);
        }
      }
    }

    return lines.join('\n');
  }
};
