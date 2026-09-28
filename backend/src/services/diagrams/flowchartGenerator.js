/**
 * Flowchart Generator
 * Generates semantically correct, syntactically safe Process Flow diagrams (flowchart TD).
 * Models business processes with Start -> Steps -> Decisions -> Branches -> End.
 */

const { toSafeIdentifier, toSafeLabel } = require('./mermaidNormalizer');

module.exports = {
  /**
   * Generates a Process Flow diagram from functional requirements and use cases.
   */
  generate(requirements = [], useCases = [], projectName = 'Sistema') {
    const lines = ['flowchart TD'];

    // Select requirements/use cases to form process sequence
    const items = (useCases && useCases.length > 0)
      ? useCases.map((u, i) => ({ id: `UC_${i + 1}`, name: u.name, actor: u.actor || 'Usuario', desc: u.description }))
      : requirements.slice(0, 8).map((r, i) => ({ id: `RF_${i + 1}`, name: r.name, desc: r.description }));

    if (items.length === 0) {
      lines.push('  START(["Inicio"]) --> PROC1["Ejecutar proceso principal"]');
      lines.push('  PROC1 --> DEC1{"¿Validación exitosa?"}');
      lines.push('  DEC1 -->|Sí| PROC2["Guardar cambios y notificar"]');
      lines.push('  DEC1 -->|No| ERR["Registrar incidencia"]');
      lines.push('  PROC2 --> FIN(["Fin del proceso"])');
      lines.push('  ERR --> FIN');
      return lines.join('\n');
    }

    lines.push(`  START(["Inicio: ${toSafeLabel(projectName, 40)}"])`);
    let lastNode = 'START';

    // Build process steps
    items.forEach((item, idx) => {
      const stepNodeId = `STEP_${idx + 1}`;
      const label = toSafeLabel(item.name, 60);

      lines.push(`  ${lastNode} --> ${stepNodeId}["${idx + 1}. ${label}"]`);
      lastNode = stepNodeId;

      // Add a realistic decision point in the middle of the workflow
      if (idx === Math.floor(items.length / 2)) {
        const decNodeId = `DEC_${idx + 1}`;
        const decLabel = `¿Condiciones y datos válidos?`;
        lines.push(`  ${stepNodeId} --> ${decNodeId}{"${decLabel}"}`);

        const altNodeId = `ALT_${idx + 1}`;
        lines.push(`  ${decNodeId} -->|No| ${altNodeId}["Solicitar corrección / Reintentar"]`);
        lines.push(`  ${altNodeId} --> ${stepNodeId}`);

        // Continue on positive branch
        const nextIdx = idx + 1;
        if (nextIdx < items.length) {
          const nextStepId = `STEP_${nextIdx + 1}`;
          lines.push(`  ${decNodeId} -->|Sí| ${nextStepId}["${nextIdx + 1}. ${toSafeLabel(items[nextIdx].name, 60)}"]`);
          lastNode = nextStepId;
          // Increment loop index will handle remaining steps
        } else {
          lastNode = decNodeId;
        }
      }
    });

    lines.push(`  ${lastNode} --> FIN(["Fin del proceso"])`);

    return lines.join('\n');
  }
};
