/**
 * Generador determinista de diagramas de Arquitectura Tecnológica (Mermaid flowchart).
 * Prioriza las plantillas de catálogo y enlaza las tecnologías detectadas.
 */

class ArchitectureGenerator {
  /**
   * Genera el diagrama de arquitectura tecnológica.
   * @param {Object} architecture - Arquitectura detectada
   * @param {Object} technologies - Tecnologías detectadas
   * @returns {string} Código Mermaid
   */
  generate(architecture = {}, technologies = {}) {
    // 1. Si la arquitectura ya provee un diagrama generado por plantilla de catálogo
    if (architecture && architecture.mermaidDiagram) {
      return architecture.mermaidDiagram;
    }

    // 2. Extraer tecnologías por capa
    const fe = (technologies.frontend && technologies.frontend.length > 0)
      ? technologies.frontend.join(' + ')
      : 'Cliente Web / Frontend';

    const be = (technologies.backend && technologies.backend.length > 0)
      ? technologies.backend.join(' + ')
      : 'Servidor API / Backend';

    const db = (technologies.database && technologies.database.length > 0)
      ? technologies.database.join(' + ')
      : 'Base de Datos';

    const infra = (technologies.infrastructure && technologies.infrastructure.length > 0)
      ? technologies.infrastructure.join(' + ')
      : null;

    const lines = ['flowchart TD'];

    lines.push(`    CLIENT["Frontend<br/>${fe}"]`);
    lines.push(`    API["Backend<br/>${be}"]`);
    lines.push(`    DB[("${db}")]`);

    lines.push('    CLIENT -->|Peticiones HTTP/REST| API');
    lines.push('    API -->|Consultas y Persistencia| DB');

    if (infra) {
      lines.push(`    INFRA["Infraestructura y Despliegue<br/>${infra}"]`);
      lines.push('    API -.-> INFRA');
    }

    return lines.join('\n');
  }
}

module.exports = new ArchitectureGenerator();
