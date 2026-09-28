
const { id, token, label, normalize, resolveEntityName } = require('./mermaidSyntax');


module.exports = {
  generate(entities = [], relationships = []) {
    const lines = ['erDiagram'];

    // 1. Construir indices: nombre original -> token Mermaid
    //    Y mapa normalizado -> nombre original (para resolver variantes)
    const nameToToken = new Map();   // entity.name -> mermaidToken
    const normalizedMap = new Map(); // NORMALIZE(name) -> entity.name

    for (const e of entities) {

      const key = token(e.name);
      nameToToken.set(e.name, key);
      if (e.id) nameToToken.set(e.id, key);
      normalizedMap.set(normalize(e.name), e.name);
    }

    // 2. Emitir bloques de entidad
    for (const e of entities) {
      const key = nameToToken.get(e.name);
      if (e.attributes && e.attributes.length > 0) {
        lines.push('    ' + key + ' {');
        for (const a of e.attributes) {
          const rawName = a.name || 'attr';
          const cleanName = rawName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() || 'campo';
          const attrType = token(a.type || 'string').replace(/^T_/, '').toLowerCase() || 'string';
          const pkTag = a.isPk ? ' PK' : (a.isUk ? ' UK' : (a.isFk ? ' FK' : ''));
          lines.push('        ' + attrType + ' ' + cleanName + pkTag);
        }
        lines.push('    }');
      } else {
        // Entidad sin atributos — solo declarar el bloque vacio
        lines.push('    ' + key + ' {');
        lines.push('        string id PK');

        lines.push('    }');
      }
    }

    // 3. Cardinalidades soportadas
    const cards = {
      '1:1': '||--||', ONE_TO_ONE: '||--||',
      '1:N': '||--o{', ONE_TO_MANY: '||--o{',
      'N:1': '}o--||', MANY_TO_ONE: '}o--||',
      'N:M': '}o--o{', MANY_TO_MANY: '}o--o{',
      'N:N': '}o--o{',
    };

    // 4. Emitir relaciones — validando que source y target existen
    const skipped = [];
    for (const r of relationships) {
      const card = cards[r.cardinality];
      if (!card) {
        skipped.push(`cardinalidad desconocida: ${r.cardinality}`);
        continue;
      }

      // Resolver source
      let srcName = nameToToken.has(r.source) ? r.source : resolveEntityName(r.source, normalizedMap);
      // Resolver target
      let tgtName = nameToToken.has(r.target) ? r.target : resolveEntityName(r.target, normalizedMap);

      if (!srcName || !tgtName) {
        skipped.push(`relacion omitida: "${r.source}" -> "${r.target}" (entidad no encontrada)`);
        continue;
      }

      const srcToken = nameToToken.get(srcName);
      const tgtToken = nameToToken.get(tgtName);
      const rel = label(r.description || 'relaciona');
      lines.push('    ' + srcToken + ' ' + card + ' ' + tgtToken + ' : "' + rel + '"');
    }

    if (skipped.length > 0) {
      console.warn('[erDiagramGenerator] Relaciones omitidas:', skipped);
    }

    return lines.join('\n');
  }
};
