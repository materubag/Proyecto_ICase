const technologyCatalog = require('../catalogs/technologyCatalog');

/**
 * Detector determinista de tecnologías mediante catálogo extensible.
 * NO envía tecnologías conocidas a Ollama.
 */
class TechnologyDetector {
  /**
   * Detecta tecnologías en el texto.
   * @param {string} text
   * @returns {{
   *   frontend: string[],
   *   backend: string[],
   *   database: string[],
   *   infrastructure: string[],
   *   detected: Array<{ name: string, category: string, source: string }>
   * }}
   */
  detect(text) {
    return technologyCatalog.detect(text);
  }
}

module.exports = new TechnologyDetector();
