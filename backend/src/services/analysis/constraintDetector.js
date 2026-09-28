/**
 * ConstraintDetector
 * Extrae supuestos (assumptions), dependencias (dependencies),
 * restricciones (constraints) y riesgos (risks) determinísticamente.
 */

class ConstraintDetector {
  /**
   * Detecta supuestos, dependencias y restricciones a partir de texto y secciones.
   * @param {string} text
   * @param {Array<Object>} sections
   * @returns {{
   *   assumptions: Array<Object>,
   *   dependencies: Array<Object>,
   *   constraints: Array<Object>,
   *   all: Array<Object>
   * }}
   */
  detect(text = '', sections = []) {
    const assumptions = [];
    const dependencies = [];
    const constraints = [];
    const seen = new Set();

    if (!text) return { assumptions, dependencies, constraints, all: [] };

    // 1. Extraer Supuestos (sección 6.1 o texto que contenga SUPUESTOS)
    const supSecs = sections.filter(s => /SUPUESTOS/i.test(s.title) && s.content?.trim().length > 0);
    const supContent = supSecs.map(s => s.content).join('\n');
    if (supContent) {
      const bullets = [...supContent.matchAll(/^[•\-*]\s*([^\n]+(?:\n[ \t]+[^\n•\-*]+)*)/gm)];
      bullets.forEach((b, idx) => {
        const clean = b[1].replace(/\s+/g, ' ').trim();
        if (clean.length > 8 && !seen.has(clean.toLowerCase())) {
          seen.add(clean.toLowerCase());
          assumptions.push({
            id: `SUP-${String(assumptions.length + 1).padStart(2, '0')}`,
            type: 'ASSUMPTION',
            name: `Supuesto: ${clean.slice(0, 45)}...`,
            description: clean,
            source: 'pdf',
            sourceText: b[0].trim()
          });
        }
      });
    }

    // 2. Extraer Dependencias (sección 6.2 o texto que contenga DEPENDENCIAS)
    const depSecs = sections.filter(s => /DEPENDENCIAS/i.test(s.title) && s.content?.trim().length > 0);
    const depContent = depSecs.map(s => s.content).join('\n');
    if (depContent) {
      const bullets = [...depContent.matchAll(/^[•\-*]\s*([^\n]+(?:\n[ \t]+[^\n•\-*]+)*)/gm)];
      bullets.forEach((b, idx) => {
        const clean = b[1].replace(/\s+/g, ' ').trim();
        if (clean.length > 8 && !seen.has(clean.toLowerCase())) {
          seen.add(clean.toLowerCase());
          dependencies.push({
            id: `DEP-${String(dependencies.length + 1).padStart(2, '0')}`,
            type: 'DEPENDENCY',
            name: `Dependencia: ${clean.slice(0, 45)}...`,
            description: clean,
            source: 'pdf',
            sourceText: b[0].trim()
          });
        }
      });
    }

    // 3. Extraer Restricciones explícitas (frases con "deberá ajustarse a", "restricción", "límite de")
    const constraintMatches = [...text.matchAll(/(?:restricci[oó]n|condici[oó]n\s+obligatoria|punto\s+de\s+control\s+obligatorio)[:\s]+([^\n.]+)/gi)];
    for (const cm of constraintMatches) {
      const clean = cm[0].replace(/\s+/g, ' ').trim();
      if (clean.length > 10 && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        constraints.push({
          id: `RES-${String(constraints.length + 1).padStart(2, '0')}`,
          type: 'CONSTRAINT',
          name: `Restricción: ${clean.slice(0, 40)}...`,
          description: clean,
          source: 'pdf',
          sourceText: clean
        });
      }
    }

    const all = [...assumptions, ...dependencies, ...constraints];

    return {
      assumptions,
      dependencies,
      constraints,
      all
    };
  }
}

module.exports = new ConstraintDetector();
