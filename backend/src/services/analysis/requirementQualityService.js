/**
 * RequirementQualityService
 * Evaluación de calidad de requisitos basada en criterios de la norma ISO/IEC/IEEE 29148:2018.
 * (Nota: Evaluación de calidad asistida; no constituye certificación formal ISO).
 *
 * Módulos de validación:
 * 1. SyntaxValidator: Estructura gramatical y formulación de obligación.
 * 2. AmbiguityValidator: Identificación de adjetivos/adverbios vagos.
 * 3. SingularityValidator: Verificación de requisito único vs. múltiples obligaciones combinadas.
 * 4. VerifiabilityValidator: Capacidad de prueba o comprobación objetiva.
 * 5. CompletenessValidator: Detección de elementos faltantes (actor, métrica, condición).
 * 6. TraceabilityValidator: Vínculo con fuente, versión y evidencia verificable.
 */

const AMBIGUOUS_WORDS = [
  'rápido', 'rápidamente', 'veloz', 'fácil', 'fácilmente', 'intuitivo', 'amigable',
  'adecuado', 'adecuadamente', 'suficiente', 'suficientemente', 'eficiente', 'eficientemente',
  'normal', 'aproximadamente', 'cuando sea posible', 'en la medida de lo posible',
  'seguro', 'altamente disponible', 'muchos', 'pocos', 'algunos', 'varios', 'etc', 'etcétera'
];

class RequirementQualityService {
  /**
   * Evalúa un candidato a requisito bajo los criterios de ISO/IEC/IEEE 29148:2018.
   * @param {Object} candidate - { title, statement, type, category, evidence, sourceId, sourceVersionId }
   * @returns {{
   *   standard: 'Evaluación de calidad basada en criterios de ISO/IEC/IEEE 29148:2018',
   *   score: number, // 0 - 100
   *   criteria: {
   *     syntax: { pass: boolean, suggestion?: string },
   *     ambiguity: { pass: boolean, detectedTerms: string[], warning?: string },
   *     singularity: { pass: boolean, warning?: string },
   *     verifiability: { pass: boolean, warning?: string },
   *     completeness: { pass: boolean, missingElements: string[], clarificationQuestions: string[] },
   *     traceability: { pass: boolean, evidenceType: string, warning?: string }
   *   },
   *   warnings: string[],
   *   clarificationQuestions: string[]
   * }}
   */
  evaluate(candidate) {
    const statement = (candidate.statement || candidate.description || candidate.title || '').trim();
    const type = candidate.type || 'FUNCTIONAL';
    const evidence = candidate.evidence || {};

    const warnings = [];
    const clarificationQuestions = [];

    // 1. SyntaxValidator
    const syntax = this.validateSyntax(statement, type);
    if (!syntax.pass && syntax.suggestion) {
      warnings.push(`Sintaxis: ${syntax.suggestion}`);
    }

    // 2. AmbiguityValidator
    const ambiguity = this.validateAmbiguity(statement);
    if (!ambiguity.pass) {
      warnings.push(`Ambigüedad: Término(s) vago(s) detectado(s): ${ambiguity.detectedTerms.join(', ')}.`);
    }

    // 3. SingularityValidator
    const singularity = this.validateSingularity(statement);
    if (!singularity.pass && singularity.warning) {
      warnings.push(`Singularidad: ${singularity.warning}`);
    }

    // 4. VerifiabilityValidator
    const verifiability = this.validateVerifiability(statement, ambiguity.detectedTerms, type);
    if (!verifiability.pass && verifiability.warning) {
      warnings.push(`Verificabilidad: ${verifiability.warning}`);
    }

    // 5. CompletenessValidator
    const completeness = this.validateCompleteness(statement, candidate);
    completeness.clarificationQuestions.forEach(q => clarificationQuestions.push(q));
    if (!completeness.pass && completeness.missingElements.length > 0) {
      warnings.push(`Completitud: Información faltante detectada (${completeness.missingElements.join(', ')}).`);
    }

    // 6. TraceabilityValidator
    const traceability = this.validateTraceability(candidate, evidence);
    if (!traceability.pass && traceability.warning) {
      warnings.push(`Trazabilidad: ${traceability.warning}`);
    }

    // Cálculo del Score de Calidad (0 - 100)
    let score = 100;
    if (!syntax.pass) score -= 15;
    if (!ambiguity.pass) score -= 20;
    if (!singularity.pass) score -= 20;
    if (!verifiability.pass) score -= 15;
    if (!completeness.pass) score -= 15;
    if (!traceability.pass) score -= 15;
    score = Math.max(0, score);

    return {
      standard: 'Evaluación de calidad basada en criterios de ISO/IEC/IEEE 29148:2018',
      score,
      criteria: {
        syntax,
        ambiguity,
        singularity,
        verifiability,
        completeness,
        traceability
      },
      warnings,
      clarificationQuestions
    };
  }

  validateSyntax(statement, type) {
    if (!statement) return { pass: false, suggestion: 'El enunciado no puede estar vacío.' };

    const hasShallPattern = /\b(?:deber[aá]|deber[aá]n|permitir[aá]|debe|podr[aá])\b/i.test(statement);
    if (type === 'FUNCTIONAL' && !hasShallPattern) {
      return {
        pass: false,
        suggestion: 'Se recomienda formular en tercera persona con obligación activa (ej. "El sistema deberá permitir...").'
      };
    }

    return { pass: true };
  }

  validateAmbiguity(statement) {
    const lower = statement.toLowerCase();
    const detectedTerms = [];

    for (const term of AMBIGUOUS_WORDS) {
      // Buscar palabra completa o frase
      const regex = new RegExp(`\\b${term}\\b`, 'i');
      if (regex.test(lower)) {
        detectedTerms.push(term);
      }
    }

    return {
      pass: detectedTerms.length === 0,
      detectedTerms,
      warning: detectedTerms.length > 0
        ? `Contiene términos subjetivos o no cuantificados (${detectedTerms.join(', ')}).`
        : null
    };
  }

  validateSingularity(statement) {
    // Detectar conectores coordinantes repetidos como "y además", "y también", o múltiples verbos de acción
    const actionVerbs = statement.match(/\b(?:registrar|consultar|modificar|eliminar|enviar|generar|notificar|bloquear|calcular|exportar|importar)\b/gi) || [];
    const hasMultipleAnds = (statement.match(/,\s*(?:y\s+)?/g) || []).length >= 3;

    if (actionVerbs.length >= 3 || hasMultipleAnds) {
      return {
        pass: false,
        warning: `Posible requisito múltiple (contiene ${actionVerbs.length} acciones distintas). Se sugiere desglosarlo en requisitos individuales atómicos.`
      };
    }

    return { pass: true };
  }

  validateVerifiability(statement, detectedAmbiguousTerms = [], type) {
    if (detectedAmbiguousTerms.includes('rápido') || detectedAmbiguousTerms.includes('rápidamente')) {
      return {
        pass: false,
        warning: 'Requisito no verificable: Especifica rapidez sin una métrica de tiempo comprobable (ej. ms o segundos).'
      };
    }

    if (detectedAmbiguousTerms.includes('fácil') || detectedAmbiguousTerms.includes('intuitivo') || detectedAmbiguousTerms.includes('amigable')) {
      return {
        pass: false,
        warning: 'Criterio subjetivo de usabilidad difícil de verificar sin una métrica de prueba de usuario.'
      };
    }

    return { pass: true };
  }

  validateCompleteness(statement, candidate) {
    const missingElements = [];
    const clarificationQuestions = [];

    // Actor no especificado
    const mentionsActor = /\b(?:usuario|administrador|cliente|operador|sistema|supervisor|bibliotecario|auditor)\b/i.test(statement);
    if (!mentionsActor && candidate.type === 'FUNCTIONAL') {
      missingElements.push('actor');
      clarificationQuestions.push('¿Qué rol o perfil de usuario está autorizado para ejecutar esta acción?');
    }

    // Métrica faltante en RNF de rendimiento
    if (candidate.type === 'NON_FUNCTIONAL' || candidate.category === 'PERFORMANCE') {
      const hasMetric = /\b(?:\d+\s*(?:ms|segundos?|minutos?|horas?|%|mb|gb|tps))\b/i.test(statement);
      if (!hasMetric) {
        missingElements.push('métrica de rendimiento');
        clarificationQuestions.push('¿Cuál es el tiempo máximo aceptable de respuesta o rendimiento esperado?');
      }
    }

    return {
      pass: missingElements.length === 0,
      missingElements,
      clarificationQuestions
    };
  }

  validateTraceability(candidate, evidence) {
    const hasSource = Boolean(candidate.sourceId || candidate.sourceVersionId);
    const hasEvidence = Boolean(evidence && (evidence.text || evidence.page || evidence.startTime !== undefined));

    if (!hasSource && !hasEvidence) {
      return {
        pass: false,
        evidenceType: 'NONE',
        warning: 'El candidato no cuenta con origen o evidencia documental asociada.'
      };
    }

    const evidenceType = evidence?.startTime !== undefined ? 'AUDIO_TIMESTAMP' : evidence?.page ? 'PDF_PAGE' : 'TEXT_SNIPPET';

    return {
      pass: true,
      evidenceType
    };
  }

  evaluateRequirement(candidate) {
    return this.evaluate(candidate);
  }
}

module.exports = new RequirementQualityService();
