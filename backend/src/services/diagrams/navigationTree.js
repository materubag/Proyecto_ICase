const { id, label } = require('./mermaidSyntax');

/**
 * Genera el Árbol de Navegación jerárquico (flowchart TD).
 * Organiza las pantallas por Módulos y Portales de Actores.
 * @param {Array} nodes - Nodos de navegación { id, name, route, parentId, actorIds }
 * @param {string} projectName - Nombre del proyecto
 * @param {Array} actors - Catálogo de actores del proyecto
 */
function generate(nodes = [], projectName = 'Sistema', actors = []) {
  const validNodes = (nodes || []).filter(n => n && (n.id || n.name)).map((n, idx) => ({
    id: n.id || `nav_node_${idx}`,
    name: n.name || n.from || n.to || 'Módulo',
    parentId: n.parentId || null,
    route: n.route || null,
    actorIds: Array.isArray(n.actorIds) ? n.actorIds : []
  }));

  if (!validNodes.length) {
    throw Object.assign(new Error('No hay nodos de navegación disponibles.'), { statusCode: 422 });
  }

  const map = new Map(validNodes.map(n => [n.id, n]));
  const actorMap = new Map((actors || []).map(a => [a.id, a]));

  // Evitar ciclos y corregir referencias a padres inexistentes
  for (const n of validNodes) {
    const seen = new Set();
    let current = n;
    while (current?.parentId) {
      if (seen.has(current.id) || !map.has(current.parentId)) {
        current.parentId = null;
        break;
      }
      seen.add(current.id);
      current = map.get(current.parentId);
    }
  }

  const explicitChildren = validNodes.filter(n => n.parentId && map.has(n.parentId));
  const rootNodes = validNodes.filter(n => !n.parentId || !map.has(n.parentId));

  const lines = ['flowchart TD', `  APP_ROOT["🌐 ${label(projectName)}"]`];

  // Si hay más de 3 pantallas raíz, agruparlas por módulo/portal de actor
  if (rootNodes.length > 3) {
    const modules = new Map();

    for (const n of rootNodes) {
      const isAuth = /login|acceso|autentic/i.test((n.route || '') + ' ' + (n.name || '')) || (n.actorIds && n.actorIds.length > 2);
      let modKey = 'general';
      let modLabel = 'Operaciones del Sistema';

      if (isAuth) {
        modKey = 'auth';
        modLabel = 'Portal de Acceso';
      } else {
        const matchedActor = n.actorIds.map(id => actorMap.get(id)).find(Boolean) ||
          (actors || []).find(a => (n.name || '').toLowerCase().includes(a.name.toLowerCase()));

        if (matchedActor) {
          const safeKey = matchedActor.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
          modKey = 'actor_' + safeKey;
          const isPortal = /client|externo|afiliado/i.test(matchedActor.name);
          modLabel = (isPortal ? 'Portal ' : 'Módulo ') + matchedActor.name;
        } else {
          const r = ((n.route || '') + ' ' + (n.name || '')).toLowerCase();
          if (/recep|citas|cliente|vehiculo/i.test(r)) {
            modKey = 'recepcion';
            modLabel = 'Módulo Recepción';
          } else if (/diag|reparac|mecanic|conocimiento/i.test(r)) {
            modKey = 'mecanico';
            modLabel = 'Módulo Mecánico y Taller';
          } else if (/admin|usuario|reporte|inventario|compra|servicio|venta/i.test(r)) {
            modKey = 'admin';
            modLabel = 'Módulo de Administración';
          }
        }
      }

      if (!modules.has(modKey)) modules.set(modKey, { label: modLabel, screens: [] });
      modules.get(modKey).screens.push(n);
    }

    for (const [modKey, mod] of modules.entries()) {
      const modNodeId = 'MOD_' + modKey.toUpperCase();
      lines.push(`  APP_ROOT --> ${modNodeId}["${label(mod.label)}"]`);
      for (const s of mod.screens) {
        const scrId = id(s.id);
        lines.push(`  ${scrId}["${label(s.name)}${s.route ? '\\n' + label(s.route) : ''}"]`);
        lines.push(`  ${modNodeId} --> ${scrId}`);
      }
    }
  } else {
    for (const n of rootNodes) {
      const scrId = id(n.id);
      lines.push(`  ${scrId}["${label(n.name)}${n.route ? '\\n' + label(n.route) : ''}"]`);
      lines.push(`  APP_ROOT --> ${scrId}`);
    }
  }

  // Conectar hijos explícitos si existen subpantallas
  for (const child of explicitChildren) {
    const childId = id(child.id);
    const parentId = id(child.parentId);
    lines.push(`  ${childId}["${label(child.name)}${child.route ? '\\n' + label(child.route) : ''}"]`);
    lines.push(`  ${parentId} --> ${childId}`);
  }

  return lines.join('\n');
}

module.exports = { generate };
