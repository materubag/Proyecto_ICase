/**
 * StructureDetector
 * Clasifica secciones y fragmentos de texto en:
 * - STRUCTURED: Contenido con códigos explícitos (RF-01, RNF-02, etc.)
 * - SEMI_STRUCTURED: Listas con viñetas o items bajo encabezados reconocibles
 * - UNSTRUCTURED: Texto narrativo, párrafos libres o transcripciones de audio
 */

const EXPLICIT_REQ_REGEX = /^(?:RF|RNF|RN|REQ|CU)[-\s_]?\d+/i;
const BULLET_REGEX = /^[\s]*[-*•–—]\s+|^\s*\d+[\.)]\s+/;

class StructureDetector {
  /**
   * Analiza un conjunto de párrafos o líneas y los clasifica estructuralmente.
   * @param {string[]} paragraphs - Párrafos extraídos y normalizados
   * @param {Array<{ title: string, content: string }>} [sections=[]]
   * @returns {{
   *   classification: 'STRUCTURED'|'SEMI_STRUCTURED'|'UNSTRUCTURED',
   *   structuredBlocks: Array<{ text: string, type: string, lineIndex: number }>,
   *   semiStructuredBlocks: Array<{ text: string, type: string, lineIndex: number }>,
   *   unstructuredBlocks: Array<{ text: string, type: string, lineIndex: number }>,
   *   metrics: { structuredCount: number, semiStructuredCount: number, unstructuredCount: number }
   * }}
   */
  classify(paragraphs = [], sections = []) {
    const structuredBlocks = [];
    const semiStructuredBlocks = [];
    const unstructuredBlocks = [];

    paragraphs.forEach((p, idx) => {
      const trimmed = p.trim();
      if (!trimmed) return;

      const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);

      // 1. Detección de Bloque Estructurado (inicia con RF-xx o RNF-xx o contiene códigos claros)
      const hasExplicitCode = lines.some(line => EXPLICIT_REQ_REGEX.test(line));
      if (hasExplicitCode) {
        structuredBlocks.push({
          text: trimmed,
          type: 'STRUCTURED',
          lineIndex: idx
        });
        return;
      }

      // 2. Detección de Bloque Semi-estructurado (listas de viñetas, guiones o pasos numerados)
      const isBulletList = lines.filter(line => BULLET_REGEX.test(line)).length >= Math.min(2, lines.length);
      if (isBulletList) {
        semiStructuredBlocks.push({
          text: trimmed,
          type: 'SEMI_STRUCTURED',
          lineIndex: idx
        });
        return;
      }

      // 3. Bloque No Estructurado (prosa libre, transcripción de entrevista)
      unstructuredBlocks.push({
        text: trimmed,
        type: 'UNSTRUCTURED',
        lineIndex: idx
      });
    });

    // Determinar la clasificación predominante
    let classification = 'UNSTRUCTURED';
    if (structuredBlocks.length > 0 && structuredBlocks.length >= unstructuredBlocks.length) {
      classification = 'STRUCTURED';
    } else if (semiStructuredBlocks.length > 0 && semiStructuredBlocks.length >= unstructuredBlocks.length) {
      classification = 'SEMI_STRUCTURED';
    }

    return {
      classification,
      structuredBlocks,
      semiStructuredBlocks,
      unstructuredBlocks,
      metrics: {
        structuredCount: structuredBlocks.length,
        semiStructuredCount: semiStructuredBlocks.length,
        unstructuredCount: unstructuredBlocks.length
      }
    };
  }
}

module.exports = new StructureDetector();
