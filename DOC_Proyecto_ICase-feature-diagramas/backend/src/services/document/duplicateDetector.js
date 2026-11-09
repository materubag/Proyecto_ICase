const textNormalizer = require('./textNormalizer');

/**
 * Detector y eliminador de duplicados para fragmentos y requisitos en el pipeline ICASE.
 * Maneja:
 * 1. Duplicados exactos.
 * 2. Duplicados normalizados (mayúsculas, acentos, espacios).
 * 3. Duplicados cercanos (similitud basada en n-gramas de palabras / Jaccard).
 */
class DuplicateDetector {
  /**
   * Calcula el coeficiente de similitud de Jaccard entre dos cadenas de texto.
   * @param {string} a
   * @param {string} b
   * @returns {number} Similitud entre 0.0 y 1.0
   */
  calculateSimilarity(a, b) {
    const normA = textNormalizer.normalizeForComparison(a);
    const normB = textNormalizer.normalizeForComparison(b);

    if (normA === normB) return 1.0;
    if (!normA || !normB) return 0.0;

    const wordsA = new Set(normA.split(' '));
    const wordsB = new Set(normB.split(' '));

    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);

    if (union.size === 0) return 0.0;
    const wordJaccard = intersection.size / union.size;

    // Si además la longitud relativa es muy similar, refuerza la confianza
    const lenRatio = Math.min(normA.length, normB.length) / Math.max(normA.length, normB.length);
    return Number(((wordJaccard * 0.7) + (lenRatio * 0.3)).toFixed(2));
  }

  /**
   * Deduplica una lista de fragmentos de texto o párrafos.
   * @param {string[]} fragments - Lista de textos
   * @param {Object} [options]
   * @param {number} [options.similarityThreshold=0.85] - Umbral para posible duplicado
   * @returns {{
   *   uniqueFragments: string[],
   *   possibleDuplicates: Array<{ original: string, duplicate: string, confidence: number }>,
   *   statistics: { totalFragments: number, duplicatesRemoved: number }
   * }}
   */
  deduplicateFragments(fragments = [], options = {}) {
    const similarityThreshold = options.similarityThreshold || 0.85;
    const totalFragments = fragments.length;
    const seenExact = new Set();
    const seenNormalized = new Map(); // normalizedKey -> originalText
    const uniqueFragments = [];
    const possibleDuplicates = [];
    let duplicatesRemoved = 0;

    for (const fragment of fragments) {
      const trimmed = fragment.trim();
      if (!trimmed) {
        duplicatesRemoved++;
        continue;
      }

      // 1. Duplicado exacto
      if (seenExact.has(trimmed)) {
        duplicatesRemoved++;
        continue;
      }

      // 2. Duplicado normalizado (mayúsculas, tildes, espacios colapsados)
      const normKey = textNormalizer.normalizeForComparison(trimmed);
      if (seenNormalized.has(normKey)) {
        duplicatesRemoved++;
        continue;
      }

      // 3. Duplicado cercano (similitud semántica/léxica aproximada)
      let isNearDuplicate = false;
      for (const [existingNormKey, originalText] of seenNormalized.entries()) {
        const sim = this.calculateSimilarity(normKey, existingNormKey);
        if (sim >= 0.92) {
          // Prácticamente idéntico: se descarta como duplicado
          duplicatesRemoved++;
          isNearDuplicate = true;
          break;
        } else if (sim >= similarityThreshold) {
          // Posible duplicado no eliminado automáticamente: se registra para revisión
          possibleDuplicates.push({
            type: 'possible_duplicate',
            original: originalText,
            duplicate: trimmed,
            confidence: sim
          });
        }
      }

      if (!isNearDuplicate) {
        seenExact.add(trimmed);
        seenNormalized.set(normKey, trimmed);
        uniqueFragments.push(trimmed);
      }
    }

    return {
      uniqueFragments,
      possibleDuplicates,
      statistics: {
        totalFragments,
        duplicatesRemoved
      }
    };
  }

  /**
   * Deduplica objetos estructurados como requisitos o actores
   * basándose en código e idéntica descripción/nombre.
   * @param {Array<Object>} items
   * @param {string} keyField - Campo clave ('code', 'id', 'name')
   * @returns {{ uniqueItems: Array<Object>, duplicatesRemoved: number }}
   */
  deduplicateItems(items = [], keyField = 'code') {
    const total = items.length;
    const seenKeys = new Set();
    const seenNormalized = new Set();
    const uniqueItems = [];

    for (const item of items) {
      if (!item) continue;
      const keyVal = item[keyField] ? String(item[keyField]).trim().toUpperCase() : null;
      const descVal = item.description || item.name || '';
      const normDesc = textNormalizer.normalizeForComparison(descVal);

      if (keyVal && seenKeys.has(keyVal)) {
        continue; // duplicado por código
      }
      if (normDesc && seenNormalized.has(normDesc)) {
        continue; // duplicado por descripción idéntica
      }

      if (keyVal) seenKeys.add(keyVal);
      if (normDesc) seenNormalized.add(normDesc);
      uniqueItems.push(item);
    }

    return {
      uniqueItems,
      duplicatesRemoved: total - uniqueItems.length
    };
  }
}

module.exports = new DuplicateDetector();
