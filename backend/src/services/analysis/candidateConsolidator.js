/**
 * CandidateConsolidator
 * - Transforma Needs y extracciones deterministas en RequirementCandidate y NeedCandidate.
 * - Detecta duplicados, relaciones y conflictos respecto a candidatos y requisitos oficiales existentes.
 * - Consolida evidencias entre distintas fuentes (PDF y Audio).
 */

const requirementQualityService = require('./requirementQualityService');

const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'a', 'al', 'en', 'para', 'por', 'con', 'sin',
  'que', 'se', 'su', 'sus', 'y', 'o', 'e', 'u'
]);

class CandidateConsolidator {
  /**
   * Limpia y normaliza un texto para comparación lexical simple.
   * @param {string} text
   * @returns {string}
   */
  normalizeForComparison(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  stemWord(word) {
    if (word.length <= 3) return word;
    return word
      .replace(/(?:es|as|os|s)$/, '')
      .replace(/(?:ara|era|aria|ria|aron|eron|ando|endo|ado|ido|aran|eran|arian|rian)$/, '')
      .replace(/(?:ran|ron|an|en|ar|er|ir|ra|re|ro|a|e|o)$/, '');
  }

  /**
   * Calcula similitud Jaccard entre dos cadenas a nivel de palabras (con lematización ligera en español).
   * @param {string} strA
   * @param {string} strB
   * @returns {number} 0.0 a 1.0
   */
  calculateSimilarity(strA, strB) {
    const wordsA = new Set(
      this.normalizeForComparison(strA)
        .split(' ')
        .filter(w => w.length > 2 && !STOP_WORDS.has(w))
        .map(w => this.stemWord(w))
    );
    const wordsB = new Set(
      this.normalizeForComparison(strB)
        .split(' ')
        .filter(w => w.length > 2 && !STOP_WORDS.has(w))
        .map(w => this.stemWord(w))
    );
    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let intersection = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }

    const union = wordsA.size + wordsB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Detecta si un nuevo candidato colisiona o se relaciona con candidatos/requisitos existentes.
   * @param {Object} candidate
   * @param {Array<Object>} existingItems
   * @returns {{ relation: 'NEW'|'DUPLICATE'|'RELATED'|'CONFLICT'|'UPDATE', matchedItem?: Object, score: number }}
   */
  detectRelationship(candidate, existingItems = []) {
    const candidateNorm = this.normalizeForComparison(candidate.statement || candidate.description || '');

    for (const item of existingItems) {
      const itemNorm = this.normalizeForComparison(item.statement || item.description || '');

      // 1. Coincidencia exacta normalizada -> DUPLICATE
      if (candidateNorm === itemNorm && candidateNorm.length > 10) {
        return { relation: 'DUPLICATE', matchedItem: item, score: 1.0 };
      }

      const sim = this.calculateSimilarity(candidateNorm, itemNorm);

      // Evaluar contradicción explícita (e.g. exclusividad vs adición, o negación)
      const hasConflict = this.detectContradiction(candidate.statement, item.statement || item.description);
      if (hasConflict && sim > 0.25) {
        return { relation: 'CONFLICT', matchedItem: item, score: sim };
      }

      // 2. Alta similitud léxica (> 0.75)
      if (sim > 0.75) {
        return { relation: 'DUPLICATE', matchedItem: item, score: sim };
      }

      // 3. Similitud moderada (> 0.45) -> RELATED
      if (sim > 0.45) {
        return { relation: 'RELATED', matchedItem: item, score: sim };
      }
    }

    return { relation: 'NEW', score: 0 };
  }

  /**
   * Detecta si dos afirmaciones presentan términos opuestos o de conflicto de roles.
   * @param {string} textA
   * @param {string} textB
   * @returns {boolean}
   */
  detectContradiction(textA, textB) {
    if (!textA || !textB) return false;
    const lowerA = textA.toLowerCase();
    const lowerB = textB.toLowerCase();

    // Uno tiene "solo/únicamente" y el otro "también/además"
    const hasExclusiveA = /\b(?:solo|únicamente|solamente)\b/i.test(lowerA);
    const hasExclusiveB = /\b(?:solo|únicamente|solamente)\b/i.test(lowerB);
    const hasAdditiveA = /\b(?:también|adem[aá]s|cualquiera)\b/i.test(lowerA);
    const hasAdditiveB = /\b(?:también|adem[aá]s|cualquiera)\b/i.test(lowerB);

    if ((hasExclusiveA && hasAdditiveB) || (hasExclusiveB && hasAdditiveA)) {
      return true;
    }

    // Uno niega lo que el otro afirma
    const hasNegationA = /\b(?:no\s+podr[aá]|no\s+debe|prohibido|jam[aá]s)\b/i.test(lowerA);
    const hasNegationB = /\b(?:no\s+podr[aá]|no\s+debe|prohibido|jam[aá]s)\b/i.test(lowerB);
    if (hasNegationA !== hasNegationB) {
      return true;
    }

    return false;
  }

  /**
   * Transforma una necesidad (Need) en una propuesta de requisito (RequirementCandidate)
   * respetando la incertidumbre sin inventar actores ni métricas.
   * @param {Object} need
   * @param {string} temporaryCode
   * @returns {Object}
   */
  convertNeedToRequirementCandidate(need, temporaryCode) {
    let statement = need.description;

    // Si no está formulado formalmente, anteponer plantilla neutral
    if (!/\b(?:deber[aá]|permitir[aá]|podr[aá]|debe)\b/i.test(statement)) {
      statement = `El sistema deberá permitir ${statement.charAt(0).toLowerCase() + statement.slice(1)}.`;
    }

    const type = need.type === 'QUALITY'
      ? 'NON_FUNCTIONAL'
      : need.type === 'BUSINESS_RULE'
      ? 'BUSINESS_RULE'
      : need.type === 'CONSTRAINT'
      ? 'CONSTRAINT'
      : 'FUNCTIONAL';

    return {
      temporaryCode,
      title: need.description.slice(0, 60),
      statement,
      originalStatement: statement,
      type,
      category: need.type === 'QUALITY' ? 'PERFORMANCE' : null,
      priority: 'MEDIUM',
      origin: need.origin || 'INFERRED',
      confidence: need.confidence || 0.8,
      status: 'PENDING_REVIEW',
      evidence: {
        text: need.evidence || need.description,
        type: 'SEMANTIC_INFERENCE'
      }
    };
  }

  /**
   * Consolida todos los elementos extraídos y evalúa su calidad con ISO 29148.
   * @param {Object} params
   * @param {Array<Object>} params.explicitRequirements
   * @param {Array<Object>} params.semanticResults
   * @param {Array<Object>} params.existingCandidates
   * @param {string} params.projectId
   * @param {string} params.sourceId
   * @param {string} params.sourceVersionId
   * @returns {{
   *   needCandidates: Array<Object>,
   *   requirementCandidates: Array<Object>,
   *   summary: { total: number, explicit: number, inferred: number, duplicates: number, conflicts: number }
   * }}
   */
  consolidate({
    explicitRequirements = [],
    semanticResults = [],
    existingCandidates = [],
    projectId,
    sourceId,
    sourceVersionId,
    sourceSegmentId = null
  }) {
    const needCandidates = [];
    const requirementCandidates = [];

    let rfCounter = 1;
    let rnfCounter = 1;

    let duplicateCount = 0;
    let conflictCount = 0;

    // 1. Procesar Requisitos Explícitos Deterministas (Sin IA)
    for (const explicit of explicitRequirements) {
      const code = explicit.code || `CRF-${String(rfCounter++).padStart(2, '0')}`;
      const statement = explicit.description || explicit.name || '';
      const type = explicit.type === 'NON_FUNCTIONAL' ? 'NON_FUNCTIONAL' : 'FUNCTIONAL';

      const rel = this.detectRelationship({ statement }, existingCandidates);
      if (rel.relation === 'DUPLICATE') duplicateCount++;
      if (rel.relation === 'CONFLICT') conflictCount++;

      const candidateObj = {
        projectId,
        sourceId,
        sourceVersionId,
        sourceSegmentId,
        temporaryCode: code,
        title: explicit.name || explicit.code || code,
        statement,
        originalStatement: statement,
        type,
        category: explicit.category || null,
        priority: explicit.priority || 'MEDIUM',
        origin: 'EXPLICIT',
        confidence: 1.0,
        status: 'PENDING_REVIEW',
        evidence: {
          text: explicit.evidence || statement,
          page: explicit.page || null,
          section: explicit.section || null,
            relationship: rel.relation !== 'NEW' ? { relation: rel.relation, target: rel.matchedItem?.temporaryCode, requirementId: rel.matchedItem?.requirementId || rel.matchedItem?.promotedRequirementId || null } : null
        }
      };

      // Evaluación ISO 29148
      candidateObj.qualityReport = requirementQualityService.evaluate(candidateObj);
      requirementCandidates.push(candidateObj);
    }

    // 2. Procesar Needs y Resultados Semánticos de IA
    for (const semResult of semanticResults) {
      const needs = semResult.needs || [];

      for (const need of needs) {
        const needObj = {
          projectId,
          sourceId,
          sourceVersionId,
          sourceSegmentId,
          type: need.type || 'FUNCTION',
          description: need.description,
          evidence: {
            text: need.evidence || semResult.sourceChunk || '',
            metadata: semResult.metadata || null
          },
          confidence: need.confidence || 0.8,
          origin: 'INFERRED',
          status: 'PENDING_REVIEW',
          metadata: {
            provider: semResult.provider || 'ollama',
            platform: semResult.platforms || 'UNKNOWN'
          }
        };
        needCandidates.push(needObj);

        // Convertir Need a RequirementCandidate
        const isNonFunc = need.type === 'QUALITY';
        const tempCode = isNonFunc
          ? `CRNF-${String(rnfCounter++).padStart(2, '0')}`
          : `CRF-${String(rfCounter++).padStart(2, '0')}`;

        const reqCand = this.convertNeedToRequirementCandidate(need, tempCode);
        reqCand.projectId = projectId;
        reqCand.sourceId = sourceId;
        reqCand.sourceVersionId = sourceVersionId;
        reqCand.sourceSegmentId = sourceSegmentId;

        if (semResult.metadata) {
          reqCand.evidence = {
            ...reqCand.evidence,
            ...semResult.metadata
          };
          if (semResult.metadata.audioSegmentId) {
            reqCand.sourceSegmentId = semResult.metadata.audioSegmentId;
            needObj.sourceSegmentId = semResult.metadata.audioSegmentId;
          }
        }

        // Evaluar relación con otros candidatos
        const rel = this.detectRelationship(reqCand, [...existingCandidates, ...requirementCandidates]);
        if (rel.relation === 'DUPLICATE') duplicateCount++;
        if (rel.relation === 'CONFLICT') conflictCount++;

        reqCand.evidence.relationship = rel.relation !== 'NEW'
          ? { relation: rel.relation, target: rel.matchedItem?.temporaryCode, requirementId: rel.matchedItem?.requirementId || rel.matchedItem?.promotedRequirementId || null }
          : null;

        // Evaluación ISO 29148
        reqCand.qualityReport = requirementQualityService.evaluate(reqCand);
        requirementCandidates.push(reqCand);
      }
    }

    return {
      needCandidates,
      requirementCandidates,
      summary: {
        total: requirementCandidates.length,
        explicit: explicitRequirements.length,
        inferred: requirementCandidates.length - explicitRequirements.length,
        duplicates: duplicateCount,
        conflicts: conflictCount
      }
    };
  }

  computeEvidenceHash(versionId, text) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(`${versionId}:${text || ''}`).digest('hex');
  }

  detectRelation(candidate, existingItems = []) {
    return this.detectRelationship(candidate, existingItems);
  }
}

module.exports = new CandidateConsolidator();
