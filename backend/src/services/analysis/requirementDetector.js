const ruleBasedExtractor = require('../document/RuleBasedExtractor');

/**
 * Detector determinista de requisitos funcionales (RF), no funcionales (RNF) y reglas de negocio (RN).
 * Cumple la regla: Todo requisito detectado explícitamente se marca como source: "explicit"
 * y NO debe enviarse a Ollama.
 */
class RequirementDetector {
  /**
   * Detecta requisitos a partir del texto y secciones.
   * @param {string} text
   * @param {Array<Object>} sections
   * @returns {{
   *   functionalRequirements: Array<Object>,
   *   nonFunctionalRequirements: Array<Object>,
   *   businessRules: Array<Object>
   * }}
   */
  detect(text, sections = []) {
    const rfList = ruleBasedExtractor.extractFunctionalRequirements(text, sections) || [];
    const rnfList = ruleBasedExtractor.extractNonFunctionalRequirements(text, sections) || [];
    const rnList = ruleBasedExtractor.extractBusinessRules(text, sections) || [];

    const functionalRequirements = rfList.map(rf => ({
      id: rf.code || rf.id,
      code: rf.code || rf.id,
      name: rf.name || rf.text,
      description: rf.description || rf.name || rf.text,
      priority: rf.priority || 'HIGH',
      type: 'FUNCTIONAL',
      source: 'explicit'
    }));

    const nonFunctionalRequirements = rnfList.map(rnf => ({
      id: rnf.code || rnf.id,
      code: rnf.code || rnf.id,
      name: rnf.name || rnf.text,
      description: rnf.description || rnf.name || rnf.text,
      priority: rnf.priority || 'MEDIUM',
      type: 'NON_FUNCTIONAL',
      source: 'explicit'
    }));

    const businessRules = rnList.map(rn => ({
      id: rn.code || rn.id,
      code: rn.code || rn.id,
      name: rn.name || rn.text,
      description: rn.description || rn.name || rn.text,
      source: 'explicit'
    }));

    return {
      functionalRequirements,
      nonFunctionalRequirements,
      businessRules
    };
  }
}

module.exports = new RequirementDetector();
