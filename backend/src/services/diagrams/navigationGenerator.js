const { label, normalize } = require('./mermaidSyntax');

/**
 * Genera el diagrama de navegacion (flowchart TD) a partir de:
 * - nodes: NavigationNode[] { id, name, from, to, action, platform, parentId, route }
 * - screens: Screen[] { id, name, route, codeId }
 *
 * Logica:
 * 1. Declarar nodos a partir de las PANTALLAS aprobadas.
 * 2. Construir conexiones a partir de navigationNodes (from -> to).
 * 3. Marcar nodos aislados (sin ninguna conexion).
 * 4. Siempre usar flowchart TD (top-down).
 */
module.exports = {
  generate(nodes = [], screens = []) {
    const lines = ['flowchart TD'];

    // --- Indexar pantallas ---
    // Mapa: nombre normalizado -> { safeId, displayLabel }
    const screenMap = new Map();  // normalizedName -> { safeId, displayName }
    const allSafeIds = new Map(); // safeId -> true (para detectar duplicados)

    const makeSafeId = (name) =>
      'SCR_' + String(name || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .toUpperCase()
        .slice(0, 40);

    // Priorizar screens aprobadas sobre navigationNodes como fuente de nodos
    const declaredScreens = screens.length > 0 ? screens : [];

    for (const s of declaredScreens) {
      const safeId = makeSafeId(s.name);
      const route = s.route ? ` (${s.route})` : '';
      const displayLabel = label(s.name) + route;
      screenMap.set(normalize(s.name), { safeId, displayLabel, name: s.name });
      allSafeIds.set(safeId, false); // false = aislado por ahora
    }

    // Si no hay screens, usar los nombres unicos de from/to en navigationNodes
    if (declaredScreens.length === 0) {
      const allNames = new Set();
      for (const n of nodes) {
        if (n.from) allNames.add(n.from);
        if (n.to) allNames.add(n.to);
        if (n.name) allNames.add(n.name);
      }
      for (const name of allNames) {
        const safeId = makeSafeId(name);
        const displayLabel = label(name);
        screenMap.set(normalize(name), { safeId, displayLabel, name });
        allSafeIds.set(safeId, false);
      }
    }

    // --- Resolver nombre -> safeId (con tolerancia singular/plural) ---
    const resolveName = (rawName) => {
      if (!rawName) return null;
      const key = normalize(rawName);
      if (screenMap.has(key)) return screenMap.get(key).safeId;
      // Intento sin 'S' final
      if (key.endsWith('S') && screenMap.has(key.slice(0, -1)))
        return screenMap.get(key.slice(0, -1)).safeId;
      // Intento con 'S'
      if (screenMap.has(key + 'S'))
        return screenMap.get(key + 'S').safeId;
      return null;
    };

    // --- Emitir declaracion de nodos ---
    for (const [, { safeId, displayLabel }] of screenMap) {
      lines.push('    ' + safeId + '["' + displayLabel + '"]');
    }

    // --- Emitir conexiones desde navigationNodes ---
    const addedEdges = new Set();
    let connectionCount = 0;

    for (const n of nodes) {
      // Conexion from -> to
      if (n.from && n.to) {
        const fromId = resolveName(n.from);
        const toId = resolveName(n.to);
        if (fromId && toId && fromId !== toId) {
          const edgeKey = fromId + '->' + toId;
          if (!addedEdges.has(edgeKey)) {
            addedEdges.add(edgeKey);
            const actionLabel = n.action ? label(n.action) : '';
            if (actionLabel) {
              lines.push('    ' + fromId + ' -->|"' + actionLabel + '"| ' + toId);
            } else {
              lines.push('    ' + fromId + ' --> ' + toId);
            }
            // Marcar ambos como conectados
            allSafeIds.set(fromId, true);
            allSafeIds.set(toId, true);
            connectionCount++;
          }
        }
      }
      // Conexion parentId -> this (si el nodo tiene parentId y nombre)
      if (n.parentId && n.name) {
        const parentId = resolveName(n.parentId) || resolveName(n.from);
        const childId = resolveName(n.name) || resolveName(n.to);
        if (parentId && childId && parentId !== childId) {
          const edgeKey = parentId + '->' + childId;
          if (!addedEdges.has(edgeKey)) {
            addedEdges.add(edgeKey);
            lines.push('    ' + parentId + ' --> ' + childId);
            allSafeIds.set(parentId, true);
            allSafeIds.set(childId, true);
            connectionCount++;
          }
        }
      }
    }

    // --- Agregar estilos para nodos aislados ---
    const isolatedNodes = [...allSafeIds.entries()]
      .filter(([, connected]) => !connected)
      .map(([safeId]) => safeId);

    if (isolatedNodes.length > 0) {
      lines.push('');
      lines.push('    %% Pantallas sin relaciones de navegacion detectadas: ' + isolatedNodes.length);
      for (const iso of isolatedNodes) {
        lines.push('    style ' + iso + ' fill:#f0f0f0,stroke:#aaa,stroke-dasharray:4');
      }
    }

    return lines.join('\n');
  }
};
