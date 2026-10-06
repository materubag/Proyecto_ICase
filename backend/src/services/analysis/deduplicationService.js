/**
 * Deduplication & Canonicalization Service
 * Controls deduplication, normalization, canonical naming, and semantic context filtering
 * for Actors, Requirements, Entities, and Models across ICASE Studio.
 */

const crypto = require('crypto');

const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'a', 'al', 'en', 'para', 'por', 'con', 'sin',
  'que', 'se', 'su', 'sus', 'y', 'o', 'e', 'u'
]);

class DeduplicationService {
  constructor() {
    this.maxContextRequirements = parseInt(process.env.MAX_REQUIREMENTS_FOR_AI_CONTEXT, 10) || 25;
  }

  /**
   * Normalizes text for semantic comparison:
   * lowercases, decomposes accents (NFD), removes special chars, collapses spaces.
   */
  normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Simple Spanish stemmer for key comparison words.
   */
  stem(word) {
    if (!word || word.length <= 3) return word;
    return word
      .replace(/(?:es|as|os|s)$/, '')
      .replace(/(?:ara|era|aria|ria|aron|eron|ando|endo|ado|ido|aran|eran|arian|rian)$/, '')
      .replace(/(?:ran|ron|an|en|ar|er|ir|ra|re|ro|a|e|o)$/, '');
  }

  /**
   * Calculates Jaccard similarity between two texts based on stemmed tokens.
   */
  calculateSimilarity(textA, textB) {
    const tokensA = new Set(
      this.normalizeText(textA)
        .split(' ')
        .filter(w => w.length > 2 && !STOP_WORDS.has(w))
        .map(w => this.stem(w))
    );
    const tokensB = new Set(
      this.normalizeText(textB)
        .split(' ')
        .filter(w => w.length > 2 && !STOP_WORDS.has(w))
        .map(w => this.stem(w))
    );

    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    let common = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) common++;
    }

    const union = tokensA.size + tokensB.size - common;
    return union > 0 ? common / union : 0;
  }

  // =========================================================================
  // 1. ACTOR CANONICALIZATION & DEDUPLICATION
  // =========================================================================

  /**
   * Extracts the canonical base key for an actor name.
   * Maps "Administrador/a", "Administrador", "ADMINISTRADOR/A", "administrador" -> "administrador"
   * Maps "Mecánico", "Mecanico", "Mecánicos" -> "mecanico"
   */
  getActorCanonicalKey(name) {
    if (!name) return 'usuario';
    let clean = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    // Strip gendered suffixes: /a, (a), /o, (o), -a, etc.
    clean = clean.replace(/[\/\(][ao][\)]?/g, '');
    clean = clean.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

    // Handle plurals
    if (clean.endsWith('es') && clean !== 'gerentes') {
      clean = clean.slice(0, -2);
    } else if (clean.endsWith('s') && !clean.endsWith('ss')) {
      clean = clean.slice(0, -1);
    }

    // Only spelling/gender variants of the same declared role are equivalent.
    if (/^administrador(?:a)?$/.test(clean)) return 'administrador';
    if (/^client(?:e)?$/.test(clean)) return 'cliente';
    if (/^mecanic[oa]$/.test(clean)) return 'mecanico';
    if (/^recepcion(?:ista)?$/.test(clean)) return 'recepcion';
    return clean;
  }

  /**
   * Returns a proper, professional display title for a canonical key.
   */
  getPreferredActorDisplayName(rawName, canonicalKey) {
    if (canonicalKey === 'administrador') return 'Administrador';
    if (canonicalKey === 'cliente') return 'Cliente';
    if (canonicalKey === 'mecanico') return 'Mecánico';
    if (canonicalKey === 'recepcion') return 'Recepción';
    if (canonicalKey === 'gerente') return 'Gerente';
    if (canonicalKey === 'auditor') return 'Auditor';

    // Capitalize properly
    return rawName.charAt(0).toUpperCase() + rawName.slice(1);
  }

  /**
   * Deduplicates and canonicalizes a list of actors or actor candidates.
   * Merges descriptions, aliases, responsibilities, and preserves approval status.
   */
  consolidateActors(actors = [], existingActors = []) {
    const canonicalMap = new Map(); // canonicalKey -> consolidatedActor

    // First index existing approved actors
    existingActors.forEach(act => {
      const key = this.getActorCanonicalKey(act.name);
      canonicalMap.set(key, {
        id: act.id,
        codeId: act.codeId || null,
        name: act.name,
        canonicalKey: key,
        description: act.description || '',
        aliases: new Set([act.name]),
        sources: new Set([act.source || 'db']),
        reviewStatus: act.reviewStatus || act.status || 'PENDING',
        status: act.status || act.reviewStatus || 'PENDING',
        isExisting: true
      });
    });

    // Merge incoming actors
    actors.forEach(act => {
      const key = this.getActorCanonicalKey(act.name);
      const displayName = this.getPreferredActorDisplayName(act.name, key);

      if (!canonicalMap.has(key)) {
        canonicalMap.set(key, {
          id: act.id || null,
          codeId: act.codeId || null,
          name: displayName,
          canonicalKey: key,
          description: act.description || '',
          aliases: new Set([act.name]),
          sources: new Set([act.source || act.evidence || 'document']),
          reviewStatus: act.reviewStatus || act.status || 'PENDING',
          status: act.status || act.reviewStatus || 'PENDING',
          isExisting: false
        });
      } else {
        const existing = canonicalMap.get(key);
        existing.aliases.add(act.name);
        if (act.source) existing.sources.add(act.source);

        // Merge descriptions if incoming adds substantive info
        if (act.description && !existing.description.includes(act.description)) {
          if (!existing.description) {
            existing.description = act.description;
          } else if (existing.description.length < 300) {
            existing.description = `${existing.description} · ${act.description}`;
          }
        }

        // If either was approved, keep approved
        if (act.reviewStatus === 'APPROVED' || act.status === 'APPROVED') {
          existing.reviewStatus = 'APPROVED';
          existing.status = 'APPROVED';
        }
      }
    });

    // Build final sequential array
    const result = [];
    let idx = 1;
    for (const [key, item] of canonicalMap.entries()) {
      result.push({
        id: item.id || `act-canonical-${key}`,
        codeId: item.codeId || `ACT-${String(idx).padStart(2, '0')}`,
        name: item.name,
        canonicalKey: key,
        description: item.description,
        aliases: Array.from(item.aliases).filter(a => a && a !== item.name),
        sources: Array.from(item.sources),
        reviewStatus: item.reviewStatus,
        status: item.status
      });
      idx++;
    }

    return result;
  }

  // =========================================================================
  // 1.1 SEMANTIC ACTION-OBJECT EXTRACTION & FINGERPRINTING
  // =========================================================================

  /**
   * Action synonym groups for deterministic semantic clustering.
   */
  getActionCanonicalKey(text) {
    if (!text) return null;
    const lower = this.normalizeText(text);

    if (/\b(?:crear|registrar|anadir|agregar|ingresar|incorporar|alta)\b/i.test(lower)) return 'crear_registrar';
    if (/\b(?:actualizar|modificar|editar|cambiar)\b/i.test(lower)) return 'actualizar_modificar';
    if (/\b(?:consultar|buscar|visualizar|ver|listar|obtener|revisar)\b/i.test(lower)) return 'consultar_listar';
    if (/\b(?:eliminar|borrar|remover|cancelar|baja|descartar)\b/i.test(lower)) return 'eliminar_cancelar';
    if (/\b(?:autenticar|acceder|login|iniciar\s+sesion)\b/i.test(lower)) return 'autenticar_acceso';
    if (/\b(?:generar|emitir|calcular|cotizar)\b/i.test(lower)) return 'generar_emitir';
    if (/\b(?:solicitar|pedir|agendar|programar|reservar)\b/i.test(lower)) return 'solicitar_agendar';
    if (/\b(?:asignar|derivar|vincular|asociar)\b/i.test(lower)) return 'asignar_vincular';
    if (/\b(?:aprobar|confirmar|validar|autorizar)\b/i.test(lower)) return 'aprobar_confirmar';
    if (/\b(?:notificar|enviar|alertar|comunicar)\b/i.test(lower)) return 'notificar_alertar';
    if (/\b(?:diagnosticar|clasificar)\b/i.test(lower)) return 'diagnosticar_evaluar';

    return null;
  }

  /**
   * Target domain entity/object normalization for semantic clustering.
   */
  getObjectCanonicalKey(text) {
    if (!text) return null;
    const lower = this.normalizeText(text);

    if (/\b(?:usuario|usuarios|cuenta|cuentas|perfil|perfiles)\b/i.test(lower)) return 'usuario';
    if (/\b(?:vehiculo|vehiculos|auto|automovil|automoviles|coche|coches)\b/i.test(lower)) return 'vehiculo';
    if (/\b(?:cliente|clientes)\b/i.test(lower)) return 'cliente';
    if (/\b(?:mecanico|mecanicos|tecnico|tecnicos)\b/i.test(lower)) return 'mecanico';
    if (/\b(?:cita|citas|agenda|disponibilidad)\b/i.test(lower)) return 'cita';
    if (/\b(?:cotizacion|cotizaciones|presupuesto|presupuestos)\b/i.test(lower)) return 'cotizacion';
    if (/\b(?:orden|ordenes|servicio|servicios|mantenimiento)\b/i.test(lower)) return 'orden_servicio';
    if (/\b(?:diagnostico|diagnosticos|falla|fallas|averia|averias|obd)\b/i.test(lower)) return 'diagnostico';
    if (/\b(?:repuesto|repuestos|material|materiales|inventario|stock)\b/i.test(lower)) return 'repuesto_inventario';
    if (/\b(?:factura|facturas|pago|pagos|cobro|cobros)\b/i.test(lower)) return 'factura_pago';
    if (/\b(?:reporte|reportes|dashboard|estadistica|estadisticas)\b/i.test(lower)) return 'reporte';
    if (/\b(?:expediente|expedientes|historial)\b/i.test(lower)) return 'expediente_historial';
    if (/\b(?:rol|roles|permiso|permisos)\b/i.test(lower)) return 'roles_permisos';

    return null;
  }

  /**
   * Extracts semantic tuple (actor, action, object) from a requirement statement.
   */
  extractSemanticTuple(statement) {
    if (!statement) return { actor: null, action: null, object: null };
    const norm = this.normalizeText(statement);

    // 1. Detect actor
    let actorKey = null;
    if (/\b(?:administrador|admin)\b/i.test(norm)) actorKey = 'administrador';
    else if (/\b(?:cliente|comprador)\b/i.test(norm)) actorKey = 'cliente';
    else if (/\b(?:mecanico|tecnico)\b/i.test(norm)) actorKey = 'mecanico';
    else if (/\b(?:recepcion|recepcionista|secretaria)\b/i.test(norm)) actorKey = 'recepcion';
    else if (/\b(?:usuario|operador)\b/i.test(norm)) actorKey = 'usuario';
    else actorKey = 'sistema';

    // 2. Detect action
    const actionKey = this.getActionCanonicalKey(statement);

    // 3. Detect object
    const objectKey = this.getObjectCanonicalKey(statement);

    return { actor: actorKey, action: actionKey, object: objectKey };
  }

  /**
   * Determines if two requirement statements represent the same semantic intention.
   * Matches exact duplicates, high lexical similarity, or identical (actor + action + object).
   */
  isSemanticEquivalent(candA, candB) {
    const textA = candA.statement || candA.description || candA.name || '';
    const textB = candB.statement || candB.description || candB.name || '';

    const normA = this.normalizeText(textA);
    const normB = this.normalizeText(textB);

    if (!normA || !normB) return false;

    // 1. Exact normalized match
    if (normA === normB) return true;

    // 2. High lexical similarity (Jaccard >= 0.76)
    const sim = this.calculateSimilarity(normA, normB);
    if (sim >= 0.76) return true;

    // 3. Normalized Actor + Action + Object match (e.g. "El administrador podrá registrar usuarios" vs "El administrador podrá crear nuevos usuarios")
    const tupleA = this.extractSemanticTuple(textA);
    const tupleB = this.extractSemanticTuple(textB);

    if (
      tupleA.action && tupleB.action &&
      tupleA.object && tupleB.object &&
      tupleA.action === tupleB.action &&
      tupleA.object === tupleB.object &&
      (tupleA.actor === tupleB.actor || tupleA.actor === 'sistema' || tupleB.actor === 'sistema')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Groups and consolidates candidate requirements BEFORE they enter the official review flow.
   * Returns canonical requirements with all original sources tracked in `sources`.
   */
  groupAndConsolidateRequirements(candidates = [], existingApproved = []) {
    const groups = []; // [{ canonical, sources: [], redundancyCount: 0 }]

    for (const cand of candidates) {
      const statement = (cand.statement || cand.description || cand.name || '').trim();
      if (!statement || statement.length < 10) continue;

      const candidateCode = (cand.code || cand.temporaryCode || '').trim().toUpperCase();
      const isExplicit = cand.origin === 'EXPLICIT' || cand.source === 'explicit' || /^(?:C)?RN?F-\d+$/i.test(candidateCode);
      const normalizedStatement = this.normalizeText(statement);

      // First check if this candidate matches an already approved requirement in the project
      const matchedApproved = existingApproved.find(app => {
        const approvedCode = (app.code || '').trim().toUpperCase();
        if (isExplicit) return candidateCode && approvedCode === candidateCode;
        return this.isSemanticEquivalent({ statement }, { statement: app.description || app.name });
      });

      if (matchedApproved) {
        // Trace source to the existing approved requirement, do not create duplicate!
        continue;
      }

      // Check if this candidate matches an existing group
      let matchedGroup = null;
      for (const g of groups) {
        const groupCode = (g.canonical.code || g.canonical.temporaryCode || '').trim().toUpperCase();
        const groupIsExplicit = g.canonical.origin === 'EXPLICIT' || g.canonical.source === 'explicit' || /^(?:C)?RN?F-\d+$/i.test(groupCode);
        const sameExplicitCode = isExplicit && groupIsExplicit && candidateCode && groupCode === candidateCode;
        const sameStatement = normalizedStatement === this.normalizeText(g.canonical.statement);
        const equivalentInferred = !isExplicit && !groupIsExplicit && this.isSemanticEquivalent({ statement }, { statement: g.canonical.statement });

        if (sameExplicitCode || sameStatement || equivalentInferred) {
          matchedGroup = g;
          break;
        }
      }

      const sourceEntry = {
        candidateId: cand.id || null,
        temporaryCode: cand.temporaryCode || cand.code || null,
        statement,
        originalStatement: cand.originalStatement || statement,
        sourceFile: cand.evidence?.sourceFile || cand.source?.name || 'Documento',
        sourceId: cand.sourceId || null,
        sourceVersionId: cand.sourceVersionId || null,
        method: cand.origin || 'EXTRACTED',
        confidence: cand.confidence ?? 1.0
      };

      if (matchedGroup) {
        matchedGroup.sources.push(sourceEntry);
        matchedGroup.redundancyCount++;

        // If incoming statement is more descriptive and formal, refine canonical statement
        if (statement.length > matchedGroup.canonical.statement.length && statement.length <= 250) {
          if (/^El\s+(?:sistema|usuario|administrador|cliente)/i.test(statement)) {
            matchedGroup.canonical.statement = statement;
            matchedGroup.canonical.title = cand.title || matchedGroup.canonical.title;
          }
        }
      } else {
        groups.push({
          canonical: {
            ...cand,
            statement,
            title: cand.title || statement.slice(0, 60)
          },
          sources: [sourceEntry],
          redundancyCount: 0
        });
      }
    }

    // Assign sequential canonical codes to the consolidated list
    let rfCounter = 1;
    let rnfCounter = 1;

    const canonicalRequirements = groups.map(g => {
      const isRNF = g.canonical.type === 'NON_FUNCTIONAL' ||
                    g.canonical.type === 'RNF' ||
                    (g.canonical.temporaryCode && g.canonical.temporaryCode.startsWith('CRNF'));

      const code = isRNF
        ? `RNF-${String(rnfCounter++).padStart(2, '0')}`
        : `RF-${String(rfCounter++).padStart(2, '0')}`;

      return {
        ...g.canonical,
        code,
        temporaryCode: code,
        type: isRNF ? 'NON_FUNCTIONAL' : 'FUNCTIONAL',
        sources: g.sources,
        redundancyCount: g.redundancyCount,
        status: 'PENDING'
      };
    });

    const totalExtracted = candidates.length;
    const canonicalCount = canonicalRequirements.length;
    const duplicatesGrouped = Math.max(0, totalExtracted - canonicalCount);

    return {
      canonicalRequirements,
      extractionStats: {
        totalExtracted,
        canonicalCount,
        duplicatesGrouped
      }
    };
  }

  // =========================================================================
  // 2. REQUIREMENT AUDIT, DEDUPLICATION & METRICS
  // =========================================================================

  /**
   * Computes a full audit summary of requirements:
   * - Total extracted
   * - Exact duplicates
   * - Redundant / similar requirements
   * - Potentially valid unique requirements
   */
  auditRequirements(requirements = []) {
    const total = requirements.length;
    let rfCount = 0;
    let rnfCount = 0;
    let approvedCount = 0;
    let pendingCount = 0;

    const seenStatements = new Map(); // normalizedText -> firstItem
    const exactDuplicates = [];
    const redundantPairs = [];
    const uniqueList = [];

    requirements.forEach(req => {
      const type = (req.type || 'FUNCTIONAL').toUpperCase();
      if (type.includes('NON') || type === 'RNF') rnfCount++;
      else rfCount++;

      const isApproved = req.status === 'APPROVED' || req.reviewStatus === 'APPROVED';
      if (isApproved) approvedCount++;
      else pendingCount++;

      const text = req.statement || req.description || req.name || '';
      const norm = this.normalizeText(text);

      if (!norm || norm.length < 5) return;

      if (seenStatements.has(norm)) {
        const original = seenStatements.get(norm);
        exactDuplicates.push({
          duplicateId: req.id || req.temporaryCode,
          originalId: original.id || original.temporaryCode,
          statement: text
        });
      } else {
        // Check for high similarity with already processed unique items
        let isRedundant = false;
        for (const u of uniqueList) {
          const sim = this.calculateSimilarity(norm, u.norm);
          if (sim >= 0.78) {
            redundantPairs.push({
              itemA: u.req.id || u.req.temporaryCode || u.req.code,
              itemB: req.id || req.temporaryCode || req.code,
              similarity: Math.round(sim * 100),
              statementA: u.req.statement || u.req.description || u.req.name,
              statementB: text
            });
            isRedundant = true;
            break;
          }
        }

        seenStatements.set(norm, req);
        uniqueList.push({ norm, req, isRedundant });
      }
    });

    const validCount = uniqueList.filter(u => !u.isRedundant).length;

    return {
      total,
      rfCount,
      rnfCount,
      functional: rfCount,
      nonFunctional: rnfCount,
      approvedCount,
      approved: approvedCount,
      pendingCount,
      pending: pendingCount,
      exactDuplicatesCount: exactDuplicates.length,
      redundantCount: redundantPairs.length,
      validCount,
      exactDuplicates,
      redundantPairs
    };
  }

  // =========================================================================
  // 3. TASK-SPECIFIC CONTEXT SELECTION (NO BLIND 116 SENDS)
  // =========================================================================

  /**
   * Filters and prioritizes requirements relevant to a specific diagram or AI task.
   * Respects MAX_REQUIREMENTS_FOR_AI_CONTEXT without blind slicing.
   *
   * @param {Array<Object>} requirements All project requirements
   * @param {'USE_CASE'|'ER'|'CLASS'|'FLOWCHART'|'NAVIGATION'|'ARCHITECTURE'} taskType
   * @param {number} maxLimit Configurable maximum items to return
   * @returns {Array<Object>} Filtered and clustered relevant requirements
   */
  selectRelevantRequirements(requirements = [], taskType = 'USE_CASE', maxLimit = null) {
    const limit = maxLimit || this.maxContextRequirements;
    if (!requirements || requirements.length === 0) return [];

    // Filter by type: for ER, Navigation, Flowchart, Use Cases, discard RNFs
    const functionalOnly = ['USE_CASE', 'ER', 'CLASS', 'FLOWCHART', 'NAVIGATION'].includes(taskType);
    let pool = requirements.filter(r => {
      const t = (r.type || 'FUNCTIONAL').toUpperCase();
      if (functionalOnly) return !t.includes('NON') && t !== 'RNF';
      return true;
    });

    // Score relevance per task type
    const scored = pool.map(req => {
      const text = (req.name + ' ' + (req.description || '') + ' ' + (req.statement || '')).toLowerCase();
      let score = 0;

      // Approved items get priority
      if (req.status === 'APPROVED' || req.reviewStatus === 'APPROVED') score += 5;

      switch (taskType) {
        case 'USE_CASE':
          if (/registrar|crear|consultar|gestionar|solicitar|aprobar|emitir|generar|cancelar|asignar/i.test(text)) score += 4;
          if (req.actorIds && req.actorIds.length > 0) score += 3;
          if (/usuario|cliente|mecanico|recepcion|admin/i.test(text)) score += 2;
          break;

        case 'ER':
          if (/entidad|tabla|relaci|datos|campo|atributo|clave|id|codigo/i.test(text)) score += 4;
          if (/vehiculo|orden|cliente|producto|servicio|cita|factura|repuesto|inventario/i.test(text)) score += 3;
          if (/tiene|posee|asociad|pertenece|registra|contiene/i.test(text)) score += 3;
          break;

        case 'CLASS':
          if (/clase|metodo|operacion|calculo|calcular|validar|estado|regla/i.test(text)) score += 4;
          if (/herencia|tipo\s+de|subtipo|interfaz|polimorfismo/i.test(text)) score += 4;
          if (/servicio|controlador|entidad|modelo/i.test(text)) score += 2;
          break;

        case 'FLOWCHART':
          if (/flujo|proceso|paso|etapa|secuencia|inicio|fin/i.test(text)) score += 4;
          if (/si\s|condici|decisi|valid|estado|rechazo|aprob/i.test(text)) score += 4;
          if (/luego|despues|notificar|enviar|completar/i.test(text)) score += 3;
          break;

        case 'NAVIGATION':
          if (/pantalla|vista|interfaz|formulario|modulo|menu|boton|navega/i.test(text)) score += 5;
          if (/dashboard|lista|detalle|registro|login|reporte/i.test(text)) score += 4;
          if (/ruta|enlace|pestana/i.test(text)) score += 3;
          break;

        case 'ARCHITECTURE':
          if (/arquitectura|capa|componente|servicio|api|rest|frontend|backend|base\s+de\s+datos/i.test(text)) score += 5;
          if (/docker|servidor|cloud|proxy|https|autenticacion|token/i.test(text)) score += 4;
          if (req.type === 'NON_FUNCTIONAL') score += 2;
          break;
      }

      return { req, score };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    // Pick top items up to limit
    const selected = scored.slice(0, limit).map(item => item.req);
    return selected;
  }
}

module.exports = new DeduplicationService();
