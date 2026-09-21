/**
 * Generador de Diagramas de Casos de Uso (Mermaid).
 * Relaciona actores principales con los requisitos funcionales detectados.
 */

function sanitizeId(str = '') {
  if (!str) return 'NODE';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toUpperCase();
}

class UseCaseGenerator {
  /**
   * Genera diagrama de casos de uso en sintaxis Mermaid.
   * @param {Array<Object>} actors
   * @param {Array<Object>} functionalRequirements
   * @returns {string} Código Mermaid
   */
  generate(actors = [], functionalRequirements = []) {
    const lines = ['flowchart LR'];

    if (!actors || actors.length === 0) {
      actors = [{ id: 'ACT_DEFAULT', name: 'Usuario' }];
    }

    // 1. Declarar actores
    const declaredActors = new Set();
    for (const act of actors) {
      const actId = sanitizeId(act.id || act.name);
      declaredActors.add(actId);
      lines.push(`    ${actId}["👤 ${act.name}"]`);
    }

    const defaultActorId = sanitizeId(actors[0].id || actors[0].name);

    // 2. Declarar casos de uso a partir de requisitos funcionales (máx 10 para legibilidad)
    const topReqs = (functionalRequirements || []).slice(0, 10);
    for (const req of topReqs) {
      const code = sanitizeId(req.code || req.id || 'RF');
      const label = (req.name || req.description || 'Caso de Uso')
        .replace(/["\\]/g, '')
        .slice(0, 45);
      lines.push(`    UC_${code}(["${code}: ${label}"])`);

      // Relación con actor
      let linked = false;
      if (Array.isArray(req.actorIds) && req.actorIds.length > 0) {
        for (const aId of req.actorIds) {
          const sanitizedAId = sanitizeId(aId);
          if (declaredActors.has(sanitizedAId)) {
            lines.push(`    ${sanitizedAId} --- UC_${code}`);
            linked = true;
          }
        }
      }

      if (!linked) {
        lines.push(`    ${defaultActorId} --- UC_${code}`);
      }
    }

    return lines.join('\n');
  }
}

module.exports = new UseCaseGenerator();
