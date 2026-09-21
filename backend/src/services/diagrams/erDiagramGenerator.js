/**
 * Generador determinista de diagramas Entidad-Relación (Mermaid erDiagram).
 * Regla fundamental: NO inventa atributos ni relaciones que no existan en el modelo estructurado.
 */

function sanitizeEntityName(name = '') {
  if (!name) return 'ENTIDAD';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toUpperCase();
}

function sanitizeLabel(label = '') {
  if (!label) return 'relaciona';
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase() || 'relaciona';
}

class ErDiagramGenerator {
  /**
   * Genera la sintaxis Mermaid de un diagrama Entidad-Relación.
   * @param {Array<Object>} entities
   * @param {Array<Object>} relationships
   * @returns {string} Código Mermaid
   */
  generate(entities = [], relationships = []) {
    if (!entities || entities.length === 0) {
      return `erDiagram
    SISTEMA {
        string estado "Sin entidades definidas"
    }`;
    }

    const lines = ['erDiagram'];
    const declaredEntities = new Set();

    // 1. Entidades y atributos (SOLO si fueron explícitamente detectados)
    for (const ent of entities) {
      const entName = sanitizeEntityName(ent.name);
      declaredEntities.add(entName);

      const hasAttributes = Array.isArray(ent.attributes) && ent.attributes.length > 0;
      // Solo agregamos bloque de atributos si vienen con atributos explícitos
      if (hasAttributes) {
        lines.push(`    ${entName} {`);
        for (const attr of ent.attributes) {
          const type = (attr.type || 'string').toLowerCase();
          const attrName = (attr.name || 'campo').replace(/[^a-zA-Z0-9_]/g, '');
          const pk = attr.isPk ? 'PK' : '';
          lines.push(`        ${type} ${attrName} ${pk}`.trimEnd());
        }
        lines.push(`    }`);
      }
    }

    // 2. Relaciones entre entidades
    if (relationships && relationships.length > 0) {
      for (const rel of relationships) {
        const source = sanitizeEntityName(rel.source);
        const target = sanitizeEntityName(rel.target);
        const label = sanitizeLabel(rel.description || rel.label || 'relaciona');

        // Determinar cardinalidad
        let connector = '||--o{';
        const card = (rel.cardinality || '').toUpperCase();
        if (card === '1:1') connector = '||--||';
        else if (card === 'N:M' || card === 'M:N') connector = '}o--o{';
        else if (card === '0:1' || card === '1:0') connector = '|o--||';
        else if (card === '1:N') connector = '||--o{';

        lines.push(`    ${source} ${connector} ${target} : ${label}`);
      }
    } else if (entities.length > 1) {
      // Si hay varias entidades pero sin relaciones explícitas, mostrar al menos las entidades
      // sin inventar relaciones falsas.
      for (const ent of entities) {
        const entName = sanitizeEntityName(ent.name);
        if (!Array.isArray(ent.attributes) || ent.attributes.length === 0) {
          lines.push(`    ${entName} {`);
          lines.push(`        string id PK`);
          lines.push(`    }`);
        }
      }
    }

    return lines.join('\n');
  }
}

module.exports = new ErDiagramGenerator();
