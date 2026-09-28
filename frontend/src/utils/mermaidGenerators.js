/**
 * Transformadores Puros de Datos Estructurados hacia Sintaxis Mermaid
 * (Sin consumir tokens de IA, generación 100% determinística y local)
 */

function sanitizeId(str) {
  if (!str) return 'NODE';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toUpperCase();
}

function sanitizeAttributeType(rawType) {
  if (!rawType) return 'string';
  // Split on union types (e.g. "string|null" -> "string")
  let clean = String(rawType).split('|')[0].trim();
  // Remove nullability/array/parentheses artifacts
  clean = clean.replace(/\?/g, '').replace(/[\(\)\[\]"']/g, '').trim();
  // Strip non-alphanumeric chars
  clean = clean.replace(/[^a-zA-Z0-9_]/g, '_');
  return clean.toLowerCase() || 'string';
}

/**
 * Genera la sintaxis Mermaid de un diagrama Entidad-Relación (erDiagram)
 * a partir de las entidades y relaciones persistidas.
 * @param {Array} entities
 * @param {Array} relationships
 * @returns {string} Código Mermaid erDiagram
 */
export function generateERDiagram(entities = [], relationships = []) {
  if (!entities || entities.length === 0) {
    return `erDiagram
    SISTEMA {
        string estado "Sin entidades registradas"
    }`;
  }

  let lines = ['erDiagram'];

  // 1. Declaración de entidades y atributos
  for (const ent of entities) {
    const entName = sanitizeId(ent.name);
    lines.push(`    ${entName} {`);
    if (ent.attributes && ent.attributes.length > 0) {
      for (const attr of ent.attributes) {
        const type = sanitizeAttributeType(attr.type);
        const attrName = (attr.name || 'campo').replace(/[^a-zA-Z0-9_]/g, '_') || 'campo';
        const pk = attr.isPk ? 'PK' : (attr.isFk ? 'FK' : '');
        lines.push(`        ${type} ${attrName} ${pk}`.trimEnd());
      }
    } else {
      lines.push(`        string id PK`);
    }
    lines.push(`    }`);
  }

  // 2. Declaración de relaciones
  if (relationships && relationships.length > 0) {
    for (const rel of relationships) {
      const source = sanitizeId(rel.source);
      const target = sanitizeId(rel.target);
      const label = rel.description ? rel.description.split(' ')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'relaciona' : 'relaciona';

      let connector = '||--o{';
      if (rel.cardinality === '1:1') connector = '||--||';
      else if (rel.cardinality === 'N:M' || rel.cardinality === 'M:N') connector = '}o--o{';
      else if (rel.cardinality === '0:1' || rel.cardinality === '1:0') connector = '|o--||';

      lines.push(`    ${source} ${connector} ${target} : "${label}"`);
    }
  }

  return lines.join('\n');
}

/**
 * Genera el diagrama de flujo Mermaid para el árbol de navegación (flowchart TD)
 * @param {Array} navigation
 * @param {Array} screens
 * @returns {string} Código Mermaid flowchart TD
 */
export function generateNavigationDiagram(navigation = [], screens = []) {
  if ((!navigation || navigation.length === 0) && (!screens || screens.length === 0)) {
    return `flowchart TD
    INICIO["Inicio del Sistema"]`;
  }

  let lines = ['flowchart TD'];
  const declaredNodes = new Set();

  // 1. Declarar nodos con sus etiquetas humanas
  if (screens && screens.length > 0) {
    for (const scr of screens) {
      const id = sanitizeId(scr.name);
      declaredNodes.add(id);
      const label = scr.name.replace(/["\\]/g, '');
      const route = scr.route ? ` (${scr.route})` : '';
      lines.push(`    ${id}["${label}${route}"]`);
    }
  }

  // 2. Conexiones entre pantallas
  if (navigation && navigation.length > 0) {
    for (const nav of navigation) {
      const fromId = sanitizeId(nav.from);
      const toId = sanitizeId(nav.to);

      if (!declaredNodes.has(fromId)) {
        lines.push(`    ${fromId}["${nav.from.replace(/["\\]/g, '')}"]`);
        declaredNodes.add(fromId);
      }
      if (!declaredNodes.has(toId)) {
        lines.push(`    ${toId}["${nav.to.replace(/["\\]/g, '')}"]`);
        declaredNodes.add(toId);
      }

      if (nav.action) {
        lines.push(`    ${fromId} -->|"${nav.action.replace(/["\\]/g, '')}"| ${toId}`);
      } else {
        lines.push(`    ${fromId} --> ${toId}`);
      }
    }
  } else if (screens && screens.length > 1) {
    // Si no hay navegación explícita, enlazar secuencialmente las pantallas
    for (let i = 0; i < screens.length - 1; i++) {
      const fromId = sanitizeId(screens[i].name);
      const toId = sanitizeId(screens[i + 1].name);
      lines.push(`    ${fromId} --> ${toId}`);
    }
  }

  return lines.join('\n');
}

/**
 * Genera el diagrama de arquitectura Mermaid (flowchart LR o TB)
 * @param {Object} architecture
 * @returns {string} Código Mermaid flowchart
 */
export function generateArchitectureDiagram(architecture) {
  if (!architecture) {
    return `flowchart LR
    FRONT["Frontend (React SPA)"] --> BACK["Backend (Express API)"]
    BACK --> DB[("Base de Datos (PostgreSQL)")]`;
  }

  let lines = ['flowchart LR'];

  const fe = (architecture.frontend || 'React SPA').replace(/["\\]/g, '');
  const be = (architecture.backend || 'Node.js Express API').replace(/["\\]/g, '');
  const db = (architecture.database || 'PostgreSQL DB').replace(/["\\]/g, '');

  lines.push(`    subgraph CapaFrontend ["Capa de Presentación"]`);
  lines.push(`        FRONT["${fe}"]`);
  lines.push(`    end`);

  lines.push(`    subgraph CapaBackend ["Capa de Aplicación y Dominio"]`);
  lines.push(`        BACK["${be}"]`);
  lines.push(`    end`);

  lines.push(`    subgraph CapaDatos ["Capa de Persistencia"]`);
  lines.push(`        DB[("${db}")]`);
  lines.push(`    end`);

  lines.push(`    FRONT -->|HTTP REST / JSON| BACK`);
  lines.push(`    BACK -->|TCP / SQL| DB`);

  // Conexiones personalizadas si existen en el modelo
  if (architecture.components && architecture.components.length > 0) {
    for (const comp of architecture.components) {
      const compId = sanitizeId(comp.name);
      const compName = comp.name.replace(/["\\]/g, '');
      const layer = comp.layer || 'Application';
      if (layer === 'Presentation') {
        lines.push(`    FRONT -.-> ${compId}["${compName}"]`);
      } else if (layer === 'Persistence') {
        lines.push(`    DB -.-> ${compId}["${compName}"]`);
      } else {
        lines.push(`    BACK -.-> ${compId}["${compName}"]`);
      }
    }
  }

  return lines.join('\n');
}
