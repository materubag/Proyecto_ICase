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
   * Aplica reglas de redacción y gramática en español, descartando portadas, metadatos y listas no funcionales.
   * @param {Object} need
   * @param {string} temporaryCode
   * @returns {Object|null}
   */
  convertNeedToRequirementCandidate(need, temporaryCode) {
    if (!need || !need.description) return null;

    // 1. Limpieza de viñetas, guiones y numeraciones iniciales
    let cleanText = need.description
      .replace(/^[•\-\*\d\.\s:–—]+/, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Eliminar dobles puntos finales
    cleanText = cleanText.replace(/\.\.+$/, '.').trim();

    // 2. Filtro estricto de metadatos, portada, contactos y tablas
    const isBoilerplate = /^(?:PROPUESTA\s+(?:T[EÉ]CNICA|ECON[OÓ]MICA|CREADA)|DATOS\s+GENERALES|IDENTIFICACI[OÓ]N|Empresa\s+proponente|Soluci[oó]n\s+AUTRON|Sector\s+Taller|Modalidad\s+Plataforma|EQUIPO\s+RESPONSABLE|DATOS\s+DE\s+CONTACTO|COSTOS\s+OPERATIVOS|TOTAL\s+ESTIMADO|Tarifa\s+Subtotal|SOLUCIONES\s+DE\s+SOFTWARE|CONTROL\s+INTELIGENTE|NEXORA)/i.test(cleanText) ||
      /^(?:Cliente|Administrador|Mec[aá]nico|Recepci[oó]n)\s*:/i.test(cleanText) ||
      /^(?:Usuarios|Clientes|Citas|Recepci[oó]n|Diagn[oó]stico|Base|Servicios|Cotizaciones|[OÓ]rdenes|Inventario|Historial|Dashboard)\s+(?:y\s+|de\s+|con\s+)?(?:seguridad|veh[ií]culos|repuestos|ventas|reportes)/i.test(cleanText);

    if (isBoilerplate || cleanText.length < 15) {
      return null;
    }

    // 3. Formulación gramatical correcta en español
    let statement = cleanText;

    if (/^(?:El\s+sistema\s+(?:deber[aá]|permitir[aá]|podr[aá]|debe)|El\s+(?:usuario|cliente|administrador|mec[aá]nico)\s+(?:podr[aá]|deber[aá])|Cada\s+|Toda\s+|Una\s+|No\s+se\s+)/i.test(statement)) {
      statement = statement.charAt(0).toUpperCase() + statement.slice(1);
      if (!statement.endsWith('.')) statement += '.';
    } else {
      // Si empieza con verbo en infinitivo (ej: "Registrar", "Permitir", "Validar", "Integrar", etc.)
      const startsWithInfinitive = /^(?:[a-záéíóúñ]+(?:ar|er|ir))\b/i.test(statement);
      if (startsWithInfinitive) {
        const lowerFirst = statement.charAt(0).toLowerCase() + statement.slice(1);
        statement = `El sistema deberá permitir ${lowerFirst}`;
        if (!statement.endsWith('.')) statement += '.';
      } else if (/\b(?:deber[aá]|permitir[aá]|podr[aá]|debe)\b/i.test(statement)) {
        statement = statement.charAt(0).toUpperCase() + statement.slice(1);
        if (!statement.endsWith('.')) statement += '.';
      } else {
        // Enunciado declarativo
        const lowerFirst = statement.charAt(0).toLowerCase() + statement.slice(1);
        statement = `El sistema deberá contemplar ${lowerFirst}`;
        if (!statement.endsWith('.')) statement += '.';
      }
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
      title: cleanText.slice(0, 60),
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
        // Convertir Need a RequirementCandidate con validación
        const isNonFunc = need.type === 'QUALITY';
        const reqCand = this.convertNeedToRequirementCandidate(need, 'TEMP');
        if (!reqCand) {
          continue; // Descartar metadatos, portada o texto no funcional
        }

        const tempCode = isNonFunc
          ? `CRNF-${String(rnfCounter++).padStart(2, '0')}`
          : `CRF-${String(rfCounter++).padStart(2, '0')}`;
        reqCand.temporaryCode = tempCode;

        needCandidates.push(needObj);

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

    // Consolidación de candidatos redundantes ANTES de la inserción y revisión
    const deduplicationService = require('./deduplicationService');
    const { canonicalRequirements, extractionStats } = deduplicationService.groupAndConsolidateRequirements(
      requirementCandidates,
      existingCandidates
    );

    // Re-evaluar calidad ISO 29148 sobre los candidatos canónicos consolidados
    canonicalRequirements.forEach(cand => {
      cand.qualityReport = requirementQualityService.evaluate(cand);
    });

    return {
      needCandidates,
      requirementCandidates: canonicalRequirements,
      summary: {
        total: canonicalRequirements.length,
        originalExtracted: requirementCandidates.length,
        duplicatesGrouped: extractionStats.duplicatesGrouped,
        explicit: explicitRequirements.length,
        inferred: canonicalRequirements.length - explicitRequirements.length,
        duplicates: extractionStats.duplicatesGrouped,
        conflicts: conflictCount
      }
    };
  }

  /**
   * Consolida candidatos de modelos generales (Actores, Procesos, Reglas, Tecnologías, Arquitectura, Entidades, etc.)
   * para su persistencia en ModelCandidate y revisión en el centro unificado.
   */
  consolidateModelCandidates({
    actors = [],
    processes = [],
    businessRules = [],
    technologies = [],
    architecture = null,
    entities = [],
    relationships = [],
    screens = [],
    dates = [],
    constraints = [],
    objectives = null,
    scope = null,
    platforms = [],
    projectId,
    sourceId,
    sourceVersionId,
    sourceName = 'Documento'
  }) {
    const deduplicationService = require('./deduplicationService');
    const crypto = require('crypto');
    const modelCandidates = [];
    const seenFingerprints = new Set();

    const addCandidate = (item) => {
      let normalizedName = this.normalizeForComparison(item.name || item.title || '');
      if (item.kind === 'ACTOR') {
        const canonicalKey = deduplicationService.getActorCanonicalKey(item.name);
        normalizedName = canonicalKey;
        item.name = deduplicationService.getPreferredActorDisplayName(item.name, canonicalKey);
      }
      const rawKey = `${item.kind}:${normalizedName}`;
      const fingerprint = crypto.createHash('sha256').update(rawKey).digest('hex');

      if (seenFingerprints.has(fingerprint)) {
        const existing = modelCandidates.find(mc => mc.fingerprint === fingerprint);
        if (existing && item.kind === 'ACTOR') {
          if (!existing.content.aliases) existing.content.aliases = [existing.name];
          if (!existing.content.aliases.includes(item.name)) existing.content.aliases.push(item.name);
          if (item.content?.description && !existing.content.description?.includes(item.content.description)) {
            existing.content.description = `${existing.content.description} · ${item.content.description}`.slice(0, 500);
          }
        }
        return;
      }
      seenFingerprints.add(fingerprint);

      modelCandidates.push({
        projectId,
        kind: item.kind,
        name: (item.name || 'Sin título').slice(0, 150),
        content: item.content || {},
        requirementIds: item.requirementIds || [],
        evidence: {
          sourceFile: sourceName,
          sourceId,
          sourceVersionId,
          snippet: item.evidence || item.sourceText || item.description || '',
          method: item.origin || 'RULE',
          confidence: item.confidence ?? (item.origin === 'INFERRED' ? 0.8 : 0.95)
        },
        origin: item.origin || 'RULE',
        confidence: item.confidence ?? (item.origin === 'INFERRED' ? 0.8 : 0.95),
        status: 'PENDING_REVIEW',
        fingerprint
      });
    };

    // 1. Actores
    actors.forEach(act => {
      addCandidate({
        kind: 'ACTOR',
        name: act.name,
        content: { name: act.name, description: act.description },
        origin: act.source === 'explicit' ? 'RULE' : 'INFERRED',
        evidence: act.sourceText || act.description
      });
    });

    // 2. Procesos
    processes.forEach(proc => {
      addCandidate({
        kind: 'PROCESS',
        name: proc.name,
        content: { name: proc.name, step: proc.step, actor: proc.actor, description: proc.description },
        origin: 'RULE',
        evidence: proc.sourceText || proc.description
      });
    });

    // 3. Reglas de negocio
    businessRules.forEach(rule => {
      addCandidate({
        kind: 'BUSINESS_RULE',
        name: rule.name || rule.description?.slice(0, 60),
        content: { name: rule.name, description: rule.description, code: rule.code },
        origin: 'RULE',
        evidence: rule.sourceText || rule.description
      });
    });

    // 4. Tecnologías
    technologies.forEach(tech => {
      addCandidate({
        kind: 'TECHNOLOGY',
        name: tech.name,
        content: { name: tech.name, category: tech.category, source: tech.source },
        origin: 'RULE',
        evidence: `Mención de tecnología ${tech.name} en el documento.`
      });
    });

    // 5. Arquitectura
    if (architecture?.all) {
      architecture.all.forEach(arch => {
        addCandidate({
          kind: 'ARCHITECTURE',
          name: arch.name,
          content: arch.content,
          origin: 'RULE',
          evidence: arch.evidence
        });
      });
    }

    // 6. Entidades
    entities.forEach(ent => {
      addCandidate({
        kind: 'ENTITY',
        name: ent.name,
        content: { name: ent.name, description: ent.description, attributes: ent.attributes || [] },
        origin: 'RULE',
        evidence: ent.description
      });
    });

    // 7. Relaciones E/R
    relationships.forEach(rel => {
      addCandidate({
        kind: 'RELATIONSHIP',
        name: `${rel.source} -> ${rel.target} (${rel.cardinality})`,
        content: rel,
        origin: rel.origin || 'INFERRED',
        evidence: rel.evidence,
        confidence: rel.confidence || 0.8
      });
    });

    // 8. Pantallas y Vistas
    screens.forEach(scr => {
      addCandidate({
        kind: 'SCREEN',
        name: scr.name,
        content: { name: scr.name, description: scr.description, screenType: scr.screenType, type: scr.type },
        origin: 'RULE',
        evidence: scr.sourceText || scr.description
      });
    });

    // 9. Fechas y Planificación
    dates.forEach(d => {
      addCandidate({
        kind: 'DATE_MILESTONE',
        name: d.name,
        content: d,
        origin: 'RULE',
        evidence: d.sourceText || d.description
      });
    });

    // 10. Restricciones, Supuestos y Dependencias
    constraints.forEach(c => {
      addCandidate({
        kind: 'CONSTRAINT',
        name: c.name,
        content: c,
        origin: 'RULE',
        evidence: c.sourceText || c.description
      });
    });

    // 11. Objetivos
    if (objectives) {
      if (objectives.general) {
        addCandidate({
          kind: 'OBJECTIVE',
          name: 'Objetivo General del Proyecto',
          content: { type: 'GENERAL', statement: objectives.general },
          origin: 'RULE',
          evidence: objectives.general
        });
      }
      (objectives.specific || []).forEach(oe => {
        addCandidate({
          kind: 'OBJECTIVE',
          name: `${oe.id}: ${oe.text.slice(0, 70)}...`,
          content: { type: 'SPECIFIC', id: oe.id, statement: oe.text },
          origin: 'RULE',
          evidence: oe.text
        });
      });
    }

    // 12. Alcance
    if (scope) {
      (scope.included || []).forEach(inc => {
        addCandidate({
          kind: 'SCOPE',
          name: `Alcance Incluido: ${inc.text.slice(0, 65)}...`,
          content: { type: 'INCLUDED', id: inc.id, statement: inc.text },
          origin: 'RULE',
          evidence: inc.text
        });
      });
      (scope.excluded || []).forEach(exc => {
        addCandidate({
          kind: 'SCOPE',
          name: `Alcance Excluido: ${exc.text.slice(0, 65)}...`,
          content: { type: 'EXCLUDED', id: exc.id, statement: exc.text },
          origin: 'RULE',
          evidence: exc.text
        });
      });
    }

    // 13. Plataformas
    platforms.forEach(p => {
      addCandidate({
        kind: 'PLATFORM',
        name: `Plataforma: ${p.type}`,
        content: p,
        origin: 'RULE',
        evidence: p.evidence,
        confidence: p.confidence
      });
    });

    return modelCandidates;
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

