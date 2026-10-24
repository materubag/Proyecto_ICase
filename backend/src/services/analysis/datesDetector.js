/**
 * DatesDetector
 * Extractor determinista de fechas, fases, hitos, duraciones y planificación del proyecto.
 * "Buscar patrones de fechas y planificación: fechas concretas, fechas límite, inicio, finalización, entregas, parciales, hitos, cronogramas, semanas, meses, duración, actividades, tareas, fases."
 */

class DatesDetector {
  /**
   * Detecta elementos de planificación y fechas.
   * @param {string} text
   * @param {Array<Object>} sections
   * @returns {Array<Object>} Lista de candidatos de planificación
   */
  detect(text = '', sections = []) {
    const items = [];
    const seen = new Set();

    if (!text) return items;

    // 1. Detección en sección de propuesta económica / fases / cronograma
    const econSec = sections.find(s => /PROPUESTA\s+ECON[OÓ]MICA|CRONOGRAMA|PLANIFICACI[OÓ]N/i.test(s.title) && s.content?.trim().length > 0);
    const targetText = econSec ? econSec.content : text;

    // Detectar actividades con horas o tarifas: "Actividad ... 40 h ... USD 320,00"
    const activityRegex = /([A-Za-záéíóúÁÉÍÓÚñ\s/y]+?)\s+([0-9]{1,3})\s*h\b(?:\s+(?:USD|[\$€])\s*([0-9.,]+))?/g;
    const actMatches = [...targetText.matchAll(activityRegex)];
    for (const match of actMatches) {
      const name = match[1].replace(/TOTAL ESTIMADO/i, '').trim();
      const hours = parseInt(match[2], 10);
      const cost = match[3] || null;

      if (name.length > 5 && name.length < 60 && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        items.push({
          id: `PLAN-${String(items.length + 1).padStart(2, '0')}`,
          name: `Fase: ${name}`,
          type: 'PHASE_ACTIVITY',
          duration: `${hours} horas`,
          estimatedCost: cost ? `USD ${cost}` : null,
          description: `Actividad de desarrollo planificada con ${hours} horas de esfuerzo estimado${cost ? ` (Costo: USD ${cost})` : ''}.`,
          source: 'pdf',
          sourceText: match[0]
        });
      }
    }

    // 2. Total estimado de horas y presupuesto
    const totalMatch = text.match(/TOTAL\s+ESTIMADO\s+([0-9]{1,4})\s*h(?:\s*—?\s*(?:USD|[\$€])\s*([0-9.,]+))?/i);
    if (totalMatch && !seen.has('total_esfuerzo')) {
      seen.add('total_esfuerzo');
      items.push({
        id: `PLAN-${String(items.length + 1).padStart(2, '0')}`,
        name: 'Inversión y Esfuerzo Total',
        type: 'TOTAL_EFFORT',
        duration: `${totalMatch[1]} horas`,
        estimatedCost: totalMatch[2] ? `USD ${totalMatch[2]}` : null,
        description: `Esfuerzo total estimado de ${totalMatch[1]} horas de trabajo${totalMatch[2] ? ` por un valor de USD ${totalMatch[2]}` : ''}.`,
        source: 'pdf',
        sourceText: totalMatch[0]
      });
    }

    // 3. Garantía y soporte temporal: "tres meses de soporte técnico gratuito"
    const garantiaMatch = text.match(/([0-9]+|tres|seis|doce|cuatro)\s+meses\s+de\s+(?:soporte(?:\s+t[eé]cnico)?(?:\s+gratuito)?|garant[ií]a)/i);
    if (garantiaMatch && !seen.has('garantia_soporte')) {
      seen.add('garantia_soporte');
      items.push({
        id: `PLAN-${String(items.length + 1).padStart(2, '0')}`,
        name: 'Período de Garantía y Soporte',
        type: 'SUPPORT_PERIOD',
        duration: `${garantiaMatch[1]} meses`,
        description: `Garantía y soporte técnico durante ${garantiaMatch[1]} meses posterior a la aceptación en producción.`,
        source: 'pdf',
        sourceText: garantiaMatch[0]
      });
    }

    // 4. Menciones explícitas de Sprints o iteraciones
    const sprintMatch = text.match(/(?:Sprints|iteraciones)\s+(?:de\s+)?([0-9]+\s*(?:semanas?|d[ií]as?))/i) || text.match(/\bSprints?\b/i);
    if (sprintMatch && !seen.has('sprint_iteration')) {
      seen.add('sprint_iteration');
      items.push({
        id: `PLAN-${String(items.length + 1).padStart(2, '0')}`,
        name: 'Ciclos de Desarrollo Scrum (Sprints)',
        type: 'METHODOLOGY_ITERATION',
        duration: sprintMatch[1] || 'Iteraciones cortas',
        description: 'Desarrollo organizado en Sprints con planificación, desarrollo, pruebas y revisión del incremento.',
        source: 'pdf',
        sourceText: sprintMatch[0]
      });
    }

    // 5. Patrones de fechas concretas: "30 de septiembre", "DD/MM/YYYY", "semana X"
    const specificDateRegex = /\b(?:Entrega(?::|\s+el)?|Inicio(?::|\s+el)?|Fecha\s+l[ií]mite(?::|\s+el)?)\s+([0-9]{1,2}\s+de\s+[a-záéíóú]+\s*(?:de\s+[0-9]{4})?|[0-9]{1,2}[/\-][0-9]{1,2}[/\-][0-9]{2,4})/gi;
    const dateMatches = [...text.matchAll(specificDateRegex)];
    for (const dm of dateMatches) {
      const full = dm[0].trim();
      if (!seen.has(full.toLowerCase())) {
        seen.add(full.toLowerCase());
        items.push({
          id: `PLAN-${String(items.length + 1).padStart(2, '0')}`,
          name: full.slice(0, 30),
          type: 'DEADLINE_MILESTONE',
          date: dm[1],
          description: full,
          source: 'pdf',
          sourceText: full
        });
      }
    }

    return items;
  }
}

module.exports = new DatesDetector();
