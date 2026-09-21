/**
 * Servicio de normalización y limpieza de texto para el pipeline ICASE.
 * Preserva rawText intacto mientras genera normalizedText para comparaciones deterministas.
 */

class TextNormalizer {
  /**
   * Normaliza texto preservando el original.
   * @param {string} rawText - Texto original extraído del PDF
   * @returns {{ rawText: string, normalizedText: string, lines: string[], paragraphs: string[] }}
   */
  normalize(rawText = '') {
    if (!rawText || typeof rawText !== 'string') {
      return {
        rawText: '',
        normalizedText: '',
        lines: [],
        paragraphs: []
      };
    }

    // 1. Normalización Unicode a forma canónica NFC
    const nfcText = rawText.normalize('NFC');

    // 2. Limpieza de caracteres de control o artefactos comunes de PDF
    // Conserva saltos de línea (\n), retornos de carro (\r) y tabulaciones (\t)
    const sanitized = nfcText
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    // 3. Normalización de espacios repetidos pero preservando estructura de párrafos
    // Divide en líneas y limpia espacios al inicio/final de cada línea
    const cleanLines = sanitized
      .split('\n')
      .map(line => line.replace(/[ \t]+/g, ' ').trim())
      .filter(line => line.length > 0);

    // 4. Texto normalizado uniforme (para indexación y búsqueda determinista)
    const normalizedText = cleanLines.join('\n');

    // 5. División en párrafos o fragmentos lógicos
    const rawBlocks = sanitized.split(/\n\s*\n+/);
    const paragraphs = [];
    for (const block of rawBlocks) {
      const blockLines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let currentGroup = [];
      for (const line of blockLines) {
        if (/^(?:(?:RF|RNF|RN|CU)[\s\-_]?[0-9]|•|\*|[0-9]+\.)/i.test(line)) {
          if (currentGroup.length > 0) {
            paragraphs.push(currentGroup.join(' '));
            currentGroup = [];
          }
          paragraphs.push(line);
        } else {
          currentGroup.push(line);
        }
      }
      if (currentGroup.length > 0) {
        paragraphs.push(currentGroup.join(' '));
      }
    }

    return {
      rawText: sanitized,
      normalizedText,
      lines: cleanLines,
      paragraphs
    };
  }

  /**
   * Genera una clave normalizada para comparación de igualdad semántica simple
   * (minúsculas, sin acentos, sin puntuación redundante, espacios colapsados).
   * @param {string} text
   * @returns {string}
   */
  normalizeForComparison(text = '') {
    if (!text || typeof text !== 'string') return '';
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Elimina diacríticos/tildes para matching
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

module.exports = new TextNormalizer();
