/**
 * crossDocumentDeduplicator
 * Implementa las 3 capas de deduplicación y detección de redundancia semántica sin IA
 * para fuentes múltiples (PDFs y Audios) a nivel de proyecto.
 *
 * Capa 1: Normalización de texto, minúsculas, espacios, tildes y hash exacto.
 * Capa 2: Mismo código de requisito (RF/RNF/RN) o sección/palabras clave principales.
 * Capa 3: Similitud Jaccard de tokens / inclusión de fragmentos con SIMILARITY_THRESHOLD (0.85).
 */

const crypto = require('crypto');
const env = require('../../config/env');

const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'a', 'al', 'en', 'para', 'por', 'con', 'sin',
  'que', 'se', 'su', 'sus', 'y', 'o', 'e', 'u', 'como', 'este', 'esta'
]);

class CrossDocumentDeduplicator {
  /**
   * Capa 1: Normaliza texto eliminando acentos, caracteres especiales y espacios múltiples.
   */
  normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  hash(text) {
    return crypto.createHash('sha256').update(this.normalizeText(text)).digest('hex');
  }

  /**
   * Extrae tokens significativos para comparación Jaccard.
   */
  tokenize(text) {
    const norm = this.normalizeText(text);
    return new Set(
      norm.split(' ')
        .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    );
  }

  /**
   * Capa 3: Similitud Jaccard entre dos conjuntos de tokens.
   */
  jaccardSimilarity(tokensA, tokensB) {
    if (tokensA.size === 0 || tokensB.size === 0) return 0;
    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersection++;
    }
    const union = tokensA.size + tokensB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Consolida y deduplica requisitos y fragmentos provenientes de múltiples documentos.
   * @param {Array<{
   *   code?: string,
   *   name?: string,
   *   description?: string,
   *   statement?: string,
   *   type?: string,
   *   sourceId: string,
   *   sourceVersionId?: string,
   *   documentName: string
   * }>} rawItems
   * @returns {{
   *   canonicalItems: Array<Object>,
   *   statistics: { exactDuplicates: number, similarClusters: number, canonicalCount: number }
   * }}
   */
  deduplicateRequirements(rawItems = []) {
    const threshold = env.SIMILARITY_THRESHOLD || 0.85;
    const canonicalMap = new Map(); // key -> item
    let exactDuplicates = 0;
    let similarClusters = 0;

    for (const item of rawItems) {
      const statement = (item.statement || item.description || item.name || '').trim();
      const code = (item.code || '').trim().toUpperCase();
      const norm = this.normalizeText(statement);
      const textHash = this.hash(statement);
      const tokens = this.tokenize(statement);

      const sourceRef = {
        sourceId: item.sourceId,
        sourceVersionId: item.sourceVersionId,
        documentName: item.documentName,
        originalCode: code || null,
        originalStatement: statement
      };

      // 1. Capa 1 & 2: Coincidencia exacta de hash o mismo código explícito (RF-01 con mismo propósito)
      let matchedCanonical = null;

      for (const [_, canon] of canonicalMap) {
        // Coincidencia exacta de texto
        if (canon.textHash === textHash) {
          matchedCanonical = canon;
          exactDuplicates++;
          break;
        }

        // Coincidencia de código explícito (e.g. ambos son RF-01)
        if (code && canon.code && code === canon.code) {
          const sim = this.jaccardSimilarity(tokens, canon.tokens);
          if (sim >= 0.5) {
            matchedCanonical = canon;
            exactDuplicates++;
            break;
          }
        }

        // Capa 3: Similitud léxica superior al umbral (e.g. 0.85)
        const sim = this.jaccardSimilarity(tokens, canon.tokens);
        if (sim >= threshold) {
          matchedCanonical = canon;
          similarClusters++;
          break;
        }

        // Detección de inclusión (uno contenido dentro de otro si es suficientemente largo)
        if (norm.length > 30 && canon.norm.length > 30) {
          if (norm.includes(canon.norm) || canon.norm.includes(norm)) {
            matchedCanonical = canon;
            similarClusters++;
            break;
          }
        }
      }

      if (matchedCanonical) {
        // Enlazar fuente preservando proveniencia sin duplicar procesamiento
        const alreadyHasRef = matchedCanonical.sources.some(
          s => s.sourceId === item.sourceId && s.documentName === item.documentName
        );
        if (!alreadyHasRef) {
          matchedCanonical.sources.push(sourceRef);
        }
      } else {
        // Registrar como nuevo canónico
        const canonicalKey = code || `canon-${canonicalMap.size + 1}`;
        canonicalMap.set(canonicalKey, {
          ...item,
          code: code || item.code,
          statement,
          norm,
          textHash,
          tokens,
          sources: [sourceRef]
        });
      }
    }

    const canonicalItems = Array.from(canonicalMap.values()).map(c => {
      const { norm, textHash, tokens, ...rest } = c;
      return {
        ...rest,
        sourceRefs: rest.sources
      };
    });

    return {
      canonicalItems,
      uniqueRequirements: canonicalItems,
      statistics: {
        exactDuplicates,
        similarClusters,
        canonicalCount: canonicalItems.length
      }
    };
  }

  consolidateRequirements(rawItems = []) {
    return this.deduplicateRequirements(rawItems);
  }

  /**
   * Filtra fragmentos ambiguos entre múltiples documentos para que Gemini no reciba redundancias.
   * @param {Array<{ chunkText: string, metadata: any }>} ambiguousFragments
   * @returns {{ uniqueFragments: Array<Object>, duplicatesRemoved: number }}
   */
  deduplicateAmbiguousFragments(ambiguousFragments = [], thresholdOverride = null) {
    const threshold = typeof thresholdOverride === 'number' ? thresholdOverride : (env.SIMILARITY_THRESHOLD || 0.85);
    const unique = [];
    let duplicatesRemoved = 0;

    for (const chunk of ambiguousFragments) {
      const text = (chunk.chunkText || '').trim();
      const norm = this.normalizeText(text);
      if (norm.length < 10) continue;

      const tokens = this.tokenize(text);
      let isDuplicate = false;

      for (const u of unique) {
        if (u.norm === norm) {
          isDuplicate = true;
          break;
        }
        const sim = this.jaccardSimilarity(tokens, u.tokens);
        if (sim >= threshold) {
          isDuplicate = true;
          break;
        }

        // Similitud de solapamiento (overlap coefficient)
        let intersection = 0;
        for (const t of tokens) {
          if (u.tokens.has(t)) intersection++;
        }
        const minTokens = Math.min(tokens.size, u.tokens.size);
        if (minTokens >= 4 && (intersection / minTokens) >= Math.max(0.75, threshold - 0.1)) {
          isDuplicate = true;
          break;
        }
      }

      if (isDuplicate) {
        duplicatesRemoved++;
      } else {
        unique.push({
          ...chunk,
          norm,
          tokens
        });
      }
    }

    const cleaned = unique.map(({ norm, tokens, ...rest }) => rest);
    return {
      uniqueFragments: cleaned,
      duplicatesRemoved,
      duplicateClusters: duplicatesRemoved > 0 ? [{ count: duplicatesRemoved }] : []
    };
  }
}

module.exports = new CrossDocumentDeduplicator();
