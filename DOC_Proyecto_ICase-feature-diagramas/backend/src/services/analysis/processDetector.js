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
      { name: 'Registro y Captura de Información', trigger: /registro\s+de\s+ingreso|captura\s+de\s+datos|alta\s+de\s+solicitud/i, actor: 'Usuario' },
      { name: 'Procesamiento y Validación de Solicitudes', trigger: /validaci[oó]n|aprobaci[oó]n|procesamiento\s+de\s+solicitud/i, actor: 'Operador / Sistema' },
      { name: 'Gestión y Actualización de Inventario', trigger: /inventario\s+se\s+actualiza|control\s+de\s+stock/i, actor: 'Sistema' },
      { name: 'Generación de Notificaciones y Reportes', trigger: /notificaci[oó]n|alerta|reporte\s+autom[aá]tico/i, actor: 'Sistema' },
      { name: 'Auditoría y Cierre de Operaciones', trigger: /auditor[ií]a|cierre\s+de\s+operaci[oó]n|trazabilidad/i, actor: 'Auditor / Sistema' }
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
    if (/administrador|admin/i.test(text)) return 'Administrador';
    if (/cliente|comprador/i.test(text)) return 'Cliente';
    if (/auditor/i.test(text)) return 'Auditor';
    if (/supervisor|gerente/i.test(text)) return 'Supervisor';
    if (/usuario|operador|empleado/i.test(text)) return 'Usuario';
    const match = text.match(/(?:el|la)\s+([a-záéíóúñ]{3,20})\s+(?:registra|valida|ejecuta|solicita|genera|revisa)/i);
    if (match) {
      return match[1].charAt(0).toUpperCase() + match[1].slice(1);
    }
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
