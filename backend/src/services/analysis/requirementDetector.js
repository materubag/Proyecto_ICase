const ruleBasedExtractor = require('../document/RuleBasedExtractor');

/**
 * Detector determinista de requisitos funcionales (RF), no funcionales (RNF) y reglas de negocio (RN).
 * Cumple la regla: Todo requisito detectado explícitamente se marca como source: "explicit"
 * y NO debe enviarse a IA.
 * Detecta códigos formales (RF-01, RNF-01) y estructuras verbales ("El sistema deberá...", "El usuario podrá...").
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
  detect(text = '', sections = []) {
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
      source: 'explicit',
      sourceText: rf.text || rf.name
    }));

    const nonFunctionalRequirements = rnfList.map(rnf => ({
      id: rnf.code || rnf.id,
      code: rnf.code || rnf.id,
      name: rnf.name || rnf.text,
      description: rnf.description || rnf.name || rnf.text,
      priority: rnf.priority || 'MEDIUM',
      type: 'NON_FUNCTIONAL',
      source: 'explicit',
      sourceText: rnf.text || rnf.name
    }));

    const businessRules = rnList.map(rn => ({
      id: rn.code || rn.id,
      code: rn.code || rn.id,
      name: rn.name || rn.text,
      description: rn.description || rn.name || rn.text,
      source: 'explicit',
      sourceText: rn.text || rn.name
    }));

    // Detección complementaria de frases verbales de requisitos si no fueron capturados por RF-XX
    const seenTexts = new Set([
      ...functionalRequirements.map(r => r.name.toLowerCase()),
      ...businessRules.map(r => r.name.toLowerCase())
    ]);

    const verbalPattern = /(?:^|\.\s+|\n+)(El\s+sistema\s+(?:deber[aá]|permitir[aá]|facilitar[aá]|controlar[aá]|gestionará|almacenará)|El\s+(?:usuario|cliente|administrador|mecánico|operador|técnico)\s+podr[aá])\s+([^\n.]{15,180})/gi;
    const verbalMatches = [...text.matchAll(verbalPattern)];

    let autoSeq = functionalRequirements.length + 1;
    for (const vm of verbalMatches) {
      const fullSentence = `${vm[1]} ${vm[2].trim()}`.replace(/\s+/g, ' ');
      const lower = fullSentence.toLowerCase();

      // Verificar que no sea duplicado de uno ya detectado
      const alreadyCaptured = [...seenTexts].some(t => t.includes(lower.slice(0, 30)) || lower.includes(t.slice(0, 30)));
      if (!alreadyCaptured && fullSentence.length > 20) {
        seenTexts.add(lower);
        functionalRequirements.push({
          id: `RF-${String(autoSeq).padStart(2, '0')}`,
          code: `RF-${String(autoSeq).padStart(2, '0')}`,
          name: fullSentence,
          description: fullSentence,
          priority: 'MEDIUM',
          type: 'FUNCTIONAL',
          source: 'explicit',
          sourceText: vm[0].trim()
        });
        autoSeq++;
      }
    }

    return {
      functionalRequirements,
      nonFunctionalRequirements,
      businessRules
    };
  }
}

module.exports = new RequirementDetector();
