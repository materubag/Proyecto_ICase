/**
 * Generador determinista de diagramas de navegación (Mermaid flowchart TD).
 * Mapea módulos principales, dashboard y flujos de alto nivel sin saturar el diagrama.
 */

function sanitizeNodeId(text = '') {
  if (!text) return 'NODE';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toUpperCase();
}

class NavigationGenerator {
  /**
   * Genera el diagrama de navegación de alto nivel.
   * @param {Array<Object>} screens
   * @param {Array<Object>} navigationLinks
   * @param {Array<Object>} entities
   * @returns {string} Código Mermaid
   */
  generate(screens = [], navigationLinks = [], entities = []) {
    const lines = ['flowchart TD'];

    // 1. Si ya vienen pantallas estructuradas
    if (screens && screens.length > 0) {
      const declared = new Set();

      for (const scr of screens) {
        const id = sanitizeNodeId(scr.name);
        declared.add(id);
        const label = (scr.name || 'Pantalla').replace(/["\\]/g, '');
        lines.push(`    ${id}["${label}"]`);
      }

      // Enlaces de navegación
      if (navigationLinks && navigationLinks.length > 0) {
        for (const nav of navigationLinks) {
          const from = sanitizeNodeId(nav.from);
          const to = sanitizeNodeId(nav.to);
          if (!declared.has(from)) {
            lines.push(`    ${from}["${(nav.from || '').replace(/["\\]/g, '')}"]`);
            declared.add(from);
          }
          if (!declared.has(to)) {
            lines.push(`    ${to}["${(nav.to || '').replace(/["\\]/g, '')}"]`);
            declared.add(to);
          }
          if (nav.action) {
            lines.push(`    ${from} -->|"${nav.action.replace(/["\\]/g, '')}"| ${to}`);
          } else {
            lines.push(`    ${from} --> ${to}`);
          }
        }
      } else if (screens.length > 1) {
        // Enlazar desde la primera (generalmente Login o Dashboard) a las demás
        const rootId = sanitizeNodeId(screens[0].name);
        for (let i = 1; i < screens.length; i++) {
          const childId = sanitizeNodeId(screens[i].name);
          lines.push(`    ${rootId} --> ${childId}`);
        }
      }

      return lines.join('\n');
    }

    // 2. Si no hay pantallas explícitas pero sí entidades, deducir navegación de alto nivel
    lines.push('    LOGIN["Inicio de Sesión"]');
    lines.push('    DASHBOARD["Panel Principal / Dashboard"]');
    lines.push('    LOGIN --> DASHBOARD');

    if (entities && entities.length > 0) {
      // Limitar a máximo 6 módulos principales para mantener el diagrama limpio
      const topEntities = entities.slice(0, 6);
      for (const ent of topEntities) {
        const id = sanitizeNodeId(ent.name);
        lines.push(`    MOD_${id}["Gestión de ${ent.name}"]`);
        lines.push(`    DASHBOARD --> MOD_${id}`);
      }
    } else {
      lines.push('    OPERACIONES["Gestión General"]');
      lines.push('    REPORTES["Reportes y Consultas"]');
      lines.push('    DASHBOARD --> OPERACIONES');
      lines.push('    DASHBOARD --> REPORTES');
    }

    return lines.join('\n');
  }
}

module.exports = new NavigationGenerator();
