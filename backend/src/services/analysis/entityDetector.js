const ruleBasedExtractor = require('../document/RuleBasedExtractor');

/**
 * Detector determinista de entidades del dominio y relaciones E/R para ICASE.
 * Regla: No inventa atributos que no existan en el texto original.
 */
class EntityDetector {
  /**
   * Detecta entidades a partir del texto y secciones.
   * @param {string} text
   * @param {Array<Object>} sections
   * @returns {{ entities: Array<Object>, relationships: Array<Object> }}
   */
  detect(text, sections = []) {
    const rawEntities = ruleBasedExtractor.extractEntities(text, sections) || [];

    const entities = rawEntities.map((ent, idx) => ({
      id: ent.id || `ENT-${String(idx + 1).padStart(2, '0')}`,
      name: ent.name.trim(),
      description: ent.description ? ent.description.trim() : `Entidad ${ent.name}`,
      attributes: Array.isArray(ent.attributes) ? ent.attributes : [],
      source: 'explicit'
    }));

    // Co-occurrence is not evidence of a relationship or cardinality.
    const relationships = [];

    return {
      entities,
      relationships
    };
  }
}

module.exports = new EntityDetector();
