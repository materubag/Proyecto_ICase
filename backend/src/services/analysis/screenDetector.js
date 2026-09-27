/**
 * ScreenDetector
 * Detecta candidatos de Pantallas, Módulos y Vistas:
 * - Módulos a desarrollar (e.g. sección 5.4)
 * - Pantallas explícitas (Login, Dashboard, Catálogo, Formulario, Expediente digital, etc.)
 */

class ScreenDetector {
  /**
   * Detecta pantallas y módulos en el texto.
   * @param {string} text
   * @param {Array<Object>} sections
   * @returns {Array<Object>} Lista de pantallas/módulos candidatos
   */
  detect(text = '', sections = []) {
    const screens = [];
    const seen = new Set();

    if (!text) return screens;

    // 1. Extraer módulos numerados de la sección "Módulos a desarrollar"
    const modSecs = sections.filter(s => /M[OÓ]DULOS\s+A\s+DESARROLLAR/i.test(s.title) && s.content?.trim().length > 0);
    const combinedModContent = modSecs.map(s => s.content).join('\n');

    if (combinedModContent) {
      // Formato: "1. Usuarios y seguridad Inicio de sesión..." o "Módulo 1: ..."
      const modMatches = [...combinedModContent.matchAll(/^[ \t]*([0-9]{1,2})\.\s+([A-Za-záéíóúÁÉÍÓÚñ\s/y\-]+?)(?:\s+([A-ZÁÉÍÓÚ][^\n]+(?:\n[ \t]+[^\n0-9.]+)*))?$/gm)];
      for (const m of modMatches) {
        const num = m[1];
        let name = m[2].trim();
        let desc = m[3] ? m[3].replace(/\s+/g, ' ').trim() : `Módulo de ${name}`;

        // Limpiar subencabezados pegados
        name = name.replace(/M[oó]dulo\s+Descripci[oó]n/i, '').trim();

        if (name.length >= 3 && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          screens.push({
            id: `SCR-${String(screens.length + 1).padStart(2, '0')}`,
            name: `Módulo: ${name}`,
            type: 'MODULE',
            description: desc,
            screenType: this.inferScreenType(name),
            source: 'pdf',
            sourceText: m[0].trim()
          });
        }
      }
    }

    // 2. Detectar vistas o pantallas comunes del sistema
    const commonScreenKeywords = [
      { name: 'Portal de Clientes', type: 'PORTAL', trigger: /portal\s+(?:para\s+)?clientes/i },
      { name: 'Entorno Operativo del Taller', type: 'DASHBOARD', trigger: /entorno\s+operativo/i },
      { name: 'Expediente Digital del Vehículo', type: 'DETAIL_VIEW', trigger: /expediente\s+digital/i },
      { name: 'Diagnóstico Visual Interactivo', type: 'INTERACTIVE_VIEW', trigger: /mapa\s+visual|representaci[oó]n\s+gr[aá]fica\s+interactiva/i },
      { name: 'Agenda y Gestión de Citas', type: 'CALENDAR_VIEW', trigger: /agenda\s+de\s+citas|solicitud\s+de\s+cita/i },
      { name: 'Catálogo de Repuestos y Servicios', type: 'CATALOG', trigger: /cat[aá]logo\s+de\s+servicios|cat[aá]logo\s+de\s+repuestos/i },
      { name: 'Cotizaciones y Aprobaciones', type: 'FORM_VIEW', trigger: /gesti[oó]n\s+de\s+cotizaciones/i },
      { name: 'Dashboard de Indicadores y Reportes', type: 'DASHBOARD', trigger: /dashboard|indicadores\s+de\s+citas/i }
    ];

    for (const scr of commonScreenKeywords) {
      if (scr.trigger.test(text) && !seen.has(scr.name.toLowerCase())) {
        seen.add(scr.name.toLowerCase());
        screens.push({
          id: `SCR-${String(screens.length + 1).padStart(2, '0')}`,
          name: scr.name,
          type: 'SCREEN',
          description: `Vista identificada: ${scr.name}`,
          screenType: scr.type,
          source: 'pdf',
          sourceText: scr.name
        });
      }
    }

    return screens;
  }

  inferScreenType(name) {
    const lower = name.toLowerCase();
    if (lower.includes('seguridad') || lower.includes('usuario') || lower.includes('login') || lower.includes('acceso')) return 'AUTH';
    if (lower.includes('dashboard') || lower.includes('reporte') || lower.includes('indicador')) return 'DASHBOARD';
    if (lower.includes('inventario') || lower.includes('catálogo') || lower.includes('servicio')) return 'CATALOG';
    if (lower.includes('cita') || lower.includes('agenda')) return 'SCHEDULE';
    if (lower.includes('orden') || lower.includes('cotización') || lower.includes('recepción')) return 'WORKFLOW';
    return 'STANDARD_VIEW';
  }
}

module.exports = new ScreenDetector();
