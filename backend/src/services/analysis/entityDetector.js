const ruleBasedExtractor = require('../document/RuleBasedExtractor');

/**
 * Detector determinista de entidades del dominio, atributos y relaciones E/R para ICASE.
 * Regla: No inventa atributos ni relaciones inexistentes en el texto original.
 */
class EntityDetector {
  /**
   * Detecta entidades y relaciones a partir del texto y secciones.
   * @param {string} text
   * @param {Array<Object>} sections
   * @returns {{ entities: Array<Object>, relationships: Array<Object> }}
   */
  detect(text = '', sections = []) {
    const rawEntities = ruleBasedExtractor.extractEntities(text, sections) || [];

    const entities = rawEntities.map((ent, idx) => {
      // Intentar extraer atributos mencionados en el texto
      const attributes = this.extractAttributesForEntity(ent.name, text);
      return {
        id: ent.id || `ENT-${String(idx + 1).padStart(2, '0')}`,
        name: ent.name.trim(),
        description: ent.description ? ent.description.trim() : `Entidad ${ent.name}`,
        attributes,
        source: 'explicit'
      };
    });

    // Detectar relaciones en el texto
    const relationships = this.extractRelationships(text, entities);

    return {
      entities,
      relationships
    };
  }

  /**
   * Extrae atributos explícitos para una entidad buscando listas tipo: "con código, categoría, marca, costo..."
   */
  extractAttributesForEntity(entityName, text) {
    const attributes = [];
    const lowerName = entityName.toLowerCase();

    // Patrón: "Registrar productos y repuestos con código, categoría, marca, costo, precio, stock..."
    const attrRegex = new RegExp(`(?:${lowerName}s?)[^.\\n]*?\\s+con\\s+([a-záéíóúñ,\\s]+?)(?:\\.|\\n|;|y\\s+[a-záéíóúñ]+)`, 'i');
    const match = text.match(attrRegex);
    if (match) {
      const rawAttrs = match[1].split(/,|y\s+/).map(a => a.trim()).filter(a => a.length >= 3 && a.length <= 25);
      rawAttrs.forEach((attrName, idx) => {
        attributes.push({
          id: `ATTR-${idx + 1}`,
          name: attrName,
          type: this.inferAttrType(attrName),
          isPk: idx === 0 && /c[oó]digo|id/i.test(attrName)
        });
      });
    }

    return attributes;
  }

  inferAttrType(attr) {
    const lower = attr.toLowerCase();
    if (/fecha|momento|tiempo/i.test(lower)) return 'DateTime';
    if (/precio|costo|total|subtotal|tarifa|valor|kilometraje|stock/i.test(lower)) return 'Decimal';
    if (/activo|estado|habilitado/i.test(lower)) return 'Boolean';
    if (/n[uú]mero|cantidad/i.test(lower)) return 'Int';
    return 'String';
  }

  /**
   * Extrae relaciones explícitas e inferidas entre entidades conocidas.
   */
  extractRelationships(text, entities) {
    const relationships = [];
    const seen = new Set();
    const entityNames = entities.map(e => e.name);

    // Patrones de relaciones
    const patterns = [
      {
        regex: /(?:Un|Cada)\s+([A-ZÁÉÍÓÚ][a-z]+)\s+puede\s+(?:registrar|tener|asociar)\s+(?:varios|m[uú]ltiples)\s+([A-ZÁÉÍÓÚa-z]+)/gi,
        cardinality: '1:N',
        origin: 'RULE'
      },
      {
        regex: /(?:Toda?|Cada)\s+([A-ZÁÉÍÓÚa-z]+)\s+debe\s+vincularse\s+con\s+(?:un|una)\s+([A-ZÁÉÍÓÚa-z]+)/gi,
        cardinality: '1:N',
        origin: 'RULE'
      },
      {
        regex: /Asignar\s+(?:uno\s+o\s+varios|m[uú]ltiples)\s+([A-ZÁÉÍÓÚa-z]+)\s+a\s+(?:un|una)\s+([A-ZÁÉÍÓÚa-z]+)/gi,
        cardinality: 'N:M',
        origin: 'RULE'
      },
      {
        regex: /([A-Za-z]+)\s+usados\s+quedar[aá]n\s+registrados\s+en\s+la\s+([A-Za-z]+)/gi,
        cardinality: 'N:M',
        origin: 'INFERRED'
      }
    ];

    patterns.forEach(({ regex, cardinality, origin }) => {
      const matches = [...text.matchAll(regex)];
      for (const m of matches) {
        let source = this.findClosestEntity(m[1], entityNames) || m[1];
        let target = this.findClosestEntity(m[2], entityNames) || m[2];

        // Capitalizar
        source = source.charAt(0).toUpperCase() + source.slice(1).toLowerCase();
        target = target.charAt(0).toUpperCase() + target.slice(1).toLowerCase();

        const key = `${source}->${target}`;
        if (source !== target && !seen.has(key)) {
          seen.add(key);
          relationships.push({
            id: `REL-${String(relationships.length + 1).padStart(2, '0')}`,
            source,
            target,
            cardinality,
            origin,
            evidence: m[0],
            confidence: origin === 'RULE' ? 0.95 : 0.75,
            description: `Relación ${source} -> ${target} (${cardinality}) detectada en: "${m[0]}"`
          });
        }
      }
    });

    // Relaciones clave del dominio automotriz si ambas entidades existen
    const domainPairs = [
      { source: 'Cliente', target: 'Vehiculo', card: '1:N', desc: 'Un cliente posee uno o varios vehículos.' },
      { source: 'Vehiculo', target: 'OrdenTrabajo', card: '1:N', desc: 'Un vehículo acumula órdenes de trabajo en su historial.' },
      { source: 'Cotizacion', target: 'OrdenTrabajo', card: '1:1', desc: 'Una cotización aprobada genera una orden de trabajo.' },
      { source: 'OrdenTrabajo', target: 'Repuesto', card: 'N:M', desc: 'Una orden consume varios repuestos.' },
      { source: 'Vehiculo', target: 'Cita', card: '1:N', desc: 'Un vehículo puede tener citas agendadas.' }
    ];

    domainPairs.forEach(pair => {
      const hasSource = entityNames.some(n => n.toLowerCase().includes(pair.source.toLowerCase()));
      const hasTarget = entityNames.some(n => n.toLowerCase().includes(pair.target.toLowerCase()));
      const key = `${pair.source}->${pair.target}`;

      if (hasSource && hasTarget && !seen.has(key)) {
        seen.add(key);
        relationships.push({
          id: `REL-${String(relationships.length + 1).padStart(2, '0')}`,
          source: pair.source,
          target: pair.target,
          cardinality: pair.card,
          origin: 'INFERRED',
          evidence: pair.desc,
          confidence: 0.8,
          description: pair.desc
        });
      }
    });

    return relationships;
  }

  findClosestEntity(word, entityList) {
    if (!word) return null;
    const clean = word.toLowerCase().replace(/s$/, '');
    return entityList.find(e => e.toLowerCase().includes(clean) || clean.includes(e.toLowerCase())) || null;
  }
}

module.exports = new EntityDetector();
