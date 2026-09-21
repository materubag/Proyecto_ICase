/**
 * SectionDetector
 * Detector determinístico de secciones basado en patrones, encabezados y normalización.
 * Segmenta el texto en secciones lógicas y categoriza su relevancia.
 */
class SectionDetector {
  constructor() {
    // Patrones de encabezados conocidos con su categoría semántica
    this.sectionDefinitions = [
      {
        id: 'introduccion',
        regex: /^(?:1(?:\.[0-9]+)*\.?\s+)?INTRODUCCI[OÓ]N/i,
        category: 'problem_context'
      },
      {
        id: 'objetivos',
        regex: /^(?:2(?:\.[0-9]+)*\.?\s+)?OBJETIVOS?(?:\s+GENERAL|\s+ESPEC[IÍ]FICOS?)?/i,
        category: 'problem_context'
      },
      {
        id: 'alcance',
        regex: /^(?:3(?:\.[0-9]+)*\.?\s+)?ALCANCE/i,
        category: 'problem_context'
      },
      {
        id: 'situacion_actual_problema',
        regex: /^(?:4(?:\.[0-9]+)*\.?\s+)?(?:DIAGN[OÓ]STICO\s+DE\s+LA\s+OPERACI[OÓ]N|SITUACI[OÓ]N\s+ACTUAL(?:\s+Y\s+PROBLEMA)?|PROBLEMA\s+PRINCIPAL|PROBLEMAS\s+ESPEC[IÍ]FICOS)/i,
        category: 'problem_context'
      },
      {
        id: 'propuesta_tecnica',
        regex: /^(?:5(?:\.[0-9]+)*\.?\s+)?PROPUESTA\s+T[EÉ]CNICA/i,
        category: 'functional'
      },
      {
        id: 'requisitos_funcionales',
        regex: /^(?:5\.1(?:\.[0-9]+)*\.?\s+)?REQUISITOS\s+FUNCIONALES/i,
        category: 'functional'
      },
      {
        id: 'perfiles_contemplados',
        regex: /^(?:PERFILES\s+CONTEMPLADOS|ACTORES(?:\s+DEL\s+SISTEMA)?|ROLES(?:\s+Y\s+PERMISOS)?|USUARIOS\s+DEL\s+SISTEMA)/i,
        category: 'functional'
      },
      {
        id: 'requisitos_no_funcionales',
        regex: /^(?:5\.2(?:\.[0-9]+)*\.?\s+)?(?:CALIDAD,\s+SEGURIDAD\s+Y\s+OPERACI[OÓ]N|REQUISITOS\s+NO\s+FUNCIONALES)/i,
        category: 'functional'
      },
      {
        id: 'reglas_negocio',
        regex: /^(?:5\.3(?:\.[0-9]+)*\.?\s+)?REGLAS\s+DE\s+NEGOCIO(?:\s+PRINCIPALES)?/i,
        category: 'functional'
      },
      {
        id: 'modulos',
        regex: /^(?:5\.4(?:\.[0-9]+)*\.?\s+)?M[OÓ]DULOS\s+A\s+DESARROLLAR/i,
        category: 'functional'
      },
      {
        id: 'arquitectura',
        regex: /^(?:5\.5(?:\.[0-9]+)*\.?\s+)?(?:ARQUITECTURA\s+TECNOL[OÓ]GICA(?:\s+PROPUESTA)?|TECNOLOG[IÍ]AS|ARQUITECTURA\s+DEL\s+SISTEMA)/i,
        category: 'architecture'
      },
      {
        id: 'modelo_operativo',
        regex: /^(?:5\.6(?:\.[0-9]+)*\.?\s+)?MODELO\s+GENERAL\s+DE\s+FUNCIONAMIENTO/i,
        category: 'functional'
      },
      {
        id: 'metodologia',
        regex: /^(?:5\.7(?:\.[0-9]+)*\.?\s+)?METODOLOG[IÍ]A(?:\s+DE\s+DESARROLLO)?/i,
        category: 'context'
      },
      {
        id: 'supuestos_dependencias',
        regex: /^(?:6(?:\.[0-9]+)*\.?\s+)?(?:SUPUESTOS\s+Y\s+DEPENDENCIAS|SUPUESTOS|DEPENDENCIAS)/i,
        category: 'context'
      },
      {
        id: 'soporte_mantenimiento',
        regex: /^(?:7(?:\.[0-9]+)*\.?\s+)?(?:SOPORTE\s+Y\s+MANTENIMIENTO|ESTRATEGIA\s+RECOMENDADA|GARANT[IÍ]A)/i,
        category: 'irrelevant_for_ai'
      },
      {
        id: 'propuesta_economica',
        regex: /^(?:8(?:\.[0-9]+)*\.?\s+)?(?:PROPUESTA\s+ECON[OÓ]MICA|COSTOS(?:\s+OPERATIVOS)?|INVERSI[OÓ]N)/i,
        category: 'irrelevant_for_ai'
      },
      {
        id: 'conclusion',
        regex: /^(?:9(?:\.[0-9]+)*\.?\s+)?(?:CIERRE\s+DE\s+LA\s+PROPUESTA|CONCLUSI[OÓ]N)/i,
        category: 'problem_context'
      },
      {
        id: 'equipo_contacto',
        regex: /^(?:EQUIPO\s+RESPONSABLE|DATOS\s+DE\s+CONTACTO)/i,
        category: 'irrelevant_for_ai'
      }
    ];
  }

  /**
   * Normaliza un título para comparaciones consistentes.
   * @param {string} title
   * @returns {string}
   */
  normalizeTitle(title) {
    return title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^[0-9]+(?:\.[0-9]+)*\s*/, '')
      .replace(/[·\-_–]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  /**
   * Detecta todas las secciones en un texto estructurado.
   * @param {string} text
   * @returns {Array<Object>} Lista de secciones con title, content, category, start, end
   */
  detectSections(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const lines = text.split('\n');
    const detectedHeadings = [];

    let currentOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineLength = lines[i].length + 1; // +1 por \n

      if (line.length > 0 && line.length < 90) {
        // Comprobar si coincide con alguna definición de sección
        let matchedDef = null;

        for (const def of this.sectionDefinitions) {
          if (def.regex.test(line)) {
            matchedDef = def;
            break;
          }
        }

        // Comprobación adicional para encabezados genéricos numerados o en mayúsculas
        if (!matchedDef) {
          if (/^[1-9]\.\s+[A-ZÁÉÍÓÚÑ\s]{3,50}$/.test(line) || /^[1-9]\.[0-9]+\s+[A-ZÁÉÍÓÚÑ\s]{3,50}$/.test(line)) {
            matchedDef = {
              id: 'custom_numbered',
              category: 'context'
            };
          }
        }

        if (matchedDef) {
          detectedHeadings.push({
            title: line,
            normalizedTitle: this.normalizeTitle(line),
            category: matchedDef.category,
            sectionId: matchedDef.id,
            lineIndex: i,
            startOffset: currentOffset
          });
        }
      }

      currentOffset += lineLength;
    }

    // Si no se detectaron encabezados formales, devolver todo como una sola sección general
    if (detectedHeadings.length === 0) {
      return [
        {
          title: 'DOCUMENTO COMPLETO',
          normalizedTitle: 'DOCUMENTO COMPLETO',
          category: 'problem_context',
          sectionId: 'full_doc',
          content: text.trim(),
          start: 0,
          end: text.length
        }
      ];
    }

    // Extraer contenido entre encabezados consecutivos
    const sections = [];
    for (let j = 0; j < detectedHeadings.length; j++) {
      const current = detectedHeadings[j];
      const next = detectedHeadings[j + 1];

      const startLine = current.lineIndex + 1;
      const endLine = next ? next.lineIndex : lines.length;

      const content = lines.slice(startLine, endLine).join('\n').trim();

      sections.push({
        title: current.title,
        normalizedTitle: current.normalizedTitle,
        category: current.category,
        sectionId: current.sectionId,
        content,
        start: current.startOffset,
        end: next ? next.startOffset : text.length
      });
    }

    return sections;
  }
}

module.exports = new SectionDetector();
