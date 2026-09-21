const architectureCatalog = require('../catalogs/architectureCatalog');

/**
 * Detector determinista de arquitectura del sistema mediante catálogo conocido.
 * Si no se especifica ninguna arquitectura, asigna la arquitectura por defecto
 * pero con source: "default" en lugar de "explicit".
 */
class ArchitectureDetector {
  /**
   * Detecta arquitectura en el texto.
   * @param {string} text
   * @param {Object} detectedTechnologies
   * @returns {{
   *   name: string,
   *   description: string,
   *   components: Array<Object>,
   *   relations: Array<Object>,
   *   source: 'explicit' | 'default',
   *   mermaidDiagram: string
   * }}
   */
  detect(text, detectedTechnologies = {}) {
    return architectureCatalog.detect(text, detectedTechnologies);
  }
}

module.exports = new ArchitectureDetector();
