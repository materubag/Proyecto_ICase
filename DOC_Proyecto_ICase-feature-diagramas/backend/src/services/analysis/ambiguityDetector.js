/**
 * Detector de ambigüedades e información no estructurada para ICASE.
 * Aísla fragmentos dudosos para que Ollama sea invocado SOLO cuando sea estrictamente necesario
 * y con un volumen minúsculo de tokens.
 */

const AMBIGUITY_PATTERNS = [
  /\b(?:podr[ií]a|podr[ií]an|tal\s+vez|quiz[aá]s|a\s+evaluar|se\s+sugiere|se\s+recomienda)\b/i,
  /\b(?:en\s+el\s+futuro|opcionalmente|pendiente\s+de\s+definici[oó]n|por\s+definir|a\s+definir)\b/i,
  /\b(?:etc[eé]tera|etc\.?|entre\s+otros|entre\s+otras)\b/i,
  /\b(?:sin\s+especificar|no\s+est[aá]\s+claro|posiblemente|eventualmente)\b/i
];

class AmbiguityDetector {
  /**
   * Detecta fragmentos ambiguos o pendientes de interpretación semántica.
   * Filtra estrictamente todo lo que ya fue detectado por reglas deterministas:
   * (RF, RNF, tecnologías, arquitecturas conocidas).
   * @param {string[]} paragraphs - Párrafos únicos del documento
   * @param {Object} deterministicData - Datos ya extraídos determinísticamente
   * @param {Object} [options]
   * @param {number} [options.maxFragments=5] - Límite estricto de fragmentos
   * @param {number} [options.maxFragmentLength=300] - Límite de longitud por fragmento
   * @returns {{
   *   hasAmbiguity: boolean,
   *   ambiguousFragments: string[],
   *   stats: { originalTokens: number, structuredTokens: number, sentFragments: number, sentTokens: number }
   * }}
   */
  detectAmbiguities(paragraphs = [], deterministicData = {}, options = {}) {
    const maxFragments = options.maxFragments || 5;
    const maxFragmentLength = options.maxFragmentLength || 300;

    // Recopilar textos ya clasificados para excluirlos
    const knownTexts = new Set();

    // RF / RNF / RN
    const allReqs = [
      ...(deterministicData.functionalRequirements || []),
      ...(deterministicData.nonFunctionalRequirements || []),
      ...(deterministicData.businessRules || []),
      ...(deterministicData.requirements || [])
    ];
    for (const r of allReqs) {
      if (r.name) knownTexts.add(r.name.toLowerCase().trim());
      if (r.description) knownTexts.add(r.description.toLowerCase().trim());
      if (r.code) knownTexts.add(r.code.toLowerCase().trim());
    }

    // Actores y entidades
    const entitiesAndActors = [
      ...(deterministicData.actors || []),
      ...(deterministicData.entities || [])
    ];
    for (const ea of entitiesAndActors) {
      if (ea.name) knownTexts.add(ea.name.toLowerCase().trim());
    }

    // Tecnologías y arquitecturas
    const techLists = [
      ...(deterministicData.technologies?.frontend || []),
      ...(deterministicData.technologies?.backend || []),
      ...(deterministicData.technologies?.database || []),
      ...(deterministicData.technologies?.infrastructure || [])
    ];
    for (const t of techLists) {
      knownTexts.add(t.toLowerCase().trim());
    }

    const ambiguousFragments = [];

    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (trimmed.length < 20) continue; // Fragmentos muy cortos no aportan ambigüedad sustancial

      const lower = trimmed.toLowerCase();

      // 1. Omitir si ya coincide con un requisito o elemento conocido
      let isAlreadyClassified = false;
      for (const known of knownTexts) {
        if (known.length > 10 && lower.includes(known)) {
          isAlreadyClassified = true;
          break;
        }
      }
      if (isAlreadyClassified) continue;

      // 2. Omitir líneas de código RF-xx o RNF-xx
      if (/^(?:RF|RNF|RN|CU)-\d+/i.test(trimmed)) continue;

      // 3. Evaluar patrones de ambigüedad lingüística
      const isAmbiguous = AMBIGUITY_PATTERNS.some(regex => regex.test(trimmed));

      if (isAmbiguous) {
        // Truncar si sobrepasa la longitud máxima permitida
        const boundedFragment = trimmed.length > maxFragmentLength
          ? trimmed.slice(0, maxFragmentLength) + '...'
          : trimmed;

        ambiguousFragments.push(boundedFragment);

        if (ambiguousFragments.length >= maxFragments) {
          break;
        }
      }
    }

    // Estimación aproximada de tokens (1 token ~ 4 caracteres)
    const rawCharCount = paragraphs.join(' ').length;
    const originalTokens = Math.round(rawCharCount / 4);

    const structuredCharCount = JSON.stringify(deterministicData).length;
    const structuredTokens = Math.round(structuredCharCount / 4);

    const sentCharCount = ambiguousFragments.join(' ').length;
    const sentTokens = Math.round(sentCharCount / 4);

    return {
      hasAmbiguity: ambiguousFragments.length > 0,
      ambiguousFragments,
      stats: {
        originalTokens,
        structuredTokens,
        sentFragments: ambiguousFragments.length,
        sentTokens
      }
    };
  }
}

module.exports = new AmbiguityDetector();
