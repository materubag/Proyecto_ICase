/**
 * ProcessDetector
 * Extrae procesos de negocio y flujos operativos con pasos secuenciales, actores y descripción.
 */

class ProcessDetector {
  /**
   * Detecta procesos y flujos en el texto.
   * @param {string} text
   * @param {Array<Object>} sections
   * @returns {Array<Object>}
   */
  detect(text = '', sections = []) {
    const processes = [];
    const seen = new Set();

    if (!text) return processes;

    // 1. Extraer del Modelo General de Funcionamiento (sección 5.6)
    const procSec = sections.find(s =>
      s.sectionId === 'modelo_operativo' ||
      /MODELO\s+GENERAL|FLUJO\s+DE\s+OPERACI[OÓ]N|PROCESOS/i.test(s.title)
    );

    const source = procSec ? procSec.content : '';
    if (source) {
      const stepMatches = [...source.matchAll(/^[ \t]*([0-9]{1,2})\.\s*([^\n]+(?:\n[ \t]+[^\n0-9.]+)*)/gm)];
      for (const sm of stepMatches) {
        const stepNum = parseInt(sm[1], 10);
        const description = sm[2].replace(/\s+/g, ' ').trim();
        const actor = this.inferActorFromStep(description);
        const name = this.generateProcessName(description);

        if (!seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          processes.push({
            id: `PROC-${String(processes.length + 1).padStart(2, '0')}`,
            step: stepNum,
            name,
            actor,
            description,
            source: 'pdf',
            sourceText: sm[0].trim()
          });
        }
      }
    }

    // 2. Procesos canónicos universales detectables en el texto
    const canonicalProcesses = [
      { name: 'Autenticación y Control de Acceso', trigger: /inicio\s+de\s+sesi[oó]n|recuperaci[oó]n\s+de\s+acceso|autenticaci[oó]n/i, actor: 'Usuario' },
      { name: 'Gestión de Citas y Agendamiento', trigger: /solicitud\s+de\s+una\s+cita|confirmar\s+la\s+cita/i, actor: 'Cliente / Recepción' },
      { name: 'Recepción y Registro de Ingreso del Vehículo', trigger: /recepci[oó]n\s+del\s+veh[ií]culo|registro\s+de\s+ingreso/i, actor: 'Recepción' },
      { name: 'Inspección Técnica y Diagnóstico de Fallas', trigger: /inspecci[oó]n\s+y\s+registra\s+el\s+diagn[oó]stico|c[oó]digos\s+OBD/i, actor: 'Mecánico' },
      { name: 'Generación y Aprobación de Cotizaciones', trigger: /genera\s+una\s+cotizaci[oó]n|aprueba(?:\s+parcialmente)?\s+o\s+rechaza\s+la\s+cotizaci[oó]n/i, actor: 'Cliente' },
      { name: 'Ejecución de Orden de Trabajo y Reparación', trigger: /[oó]rden\s+de\s+trabajo|registra\s+avances\s+y\s+repuestos/i, actor: 'Mecánico' },
      { name: 'Gestión y Descuento Automático de Inventario', trigger: /inventario\s+se\s+actualiza\s+autom[aá]ticamente|descontar\s+del\s+inventario/i, actor: 'Sistema' },
      { name: 'Pruebas Finales y Entrega del Vehículo', trigger: /realizan\s+pruebas,\s+se\s+finaliza\s+la\s+[oó]rden\s+y\s+se\s+entrega/i, actor: 'Recepción / Mecánico' },
      { name: 'Mantenimiento Preventivo y Seguimiento', trigger: /programaci[oó]n\s+de\s+mantenimiento\s+preventivo|avisos\s+de\s+mantenimiento/i, actor: 'Sistema' },
      { name: 'Gestión de la Base de Conocimiento Técnico', trigger: /base\s+de\s+conocimiento|casos\s+resueltos/i, actor: 'Mecánico / Administrador' }
    ];

    for (const cp of canonicalProcesses) {
      if (cp.trigger.test(text) && !seen.has(cp.name.toLowerCase())) {
        seen.add(cp.name.toLowerCase());
        processes.push({
          id: `PROC-${String(processes.length + 1).padStart(2, '0')}`,
          name: cp.name,
          actor: cp.actor,
          description: `Flujo del sistema: ${cp.name}`,
          source: 'pdf',
          sourceText: cp.name
        });
      }
    }

    return processes;
  }

  inferActorFromStep(text) {
    if (/cliente/i.test(text)) return 'Cliente';
    if (/mec[aá]nico/i.test(text)) return 'Mecánico';
    if (/recepci[oó]n|taller\s+confirma/i.test(text)) return 'Recepción';
    if (/administrador/i.test(text)) return 'Administrador';
    return 'Sistema';
  }

  generateProcessName(desc) {
    // Tomar las primeras 5-8 palabras o un resumen limpio
    const words = desc.split(' ');
    if (words.length <= 7) return desc;
    return words.slice(0, 7).join(' ') + '...';
  }
}

module.exports = new ProcessDetector();
