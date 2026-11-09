const ruleBasedExtractor = require('../document/RuleBasedExtractor');

/**
 * Detector determinista de actores y roles para ICASE.
 */
class ActorDetector {
  /**
   * Detecta actores a partir del texto y secciones.
   * @param {string} text
   * @param {Array<Object>} sections
   * @returns {Array<Object>}
   */
  detect(text, sections = []) {
    const rawActors = ruleBasedExtractor.extractActors(text, sections) || [];

    return rawActors.map((actor, idx) => ({
      id: actor.id || `ACT-${String(idx + 1).padStart(2, '0')}`,
      name: actor.name ? actor.name.trim() : `Rol ${idx + 1}`,
      description: actor.description ? actor.description.trim() : `Actor ${actor.name}`,
      source: 'explicit'
    }));
  }
}

module.exports = new ActorDetector();
