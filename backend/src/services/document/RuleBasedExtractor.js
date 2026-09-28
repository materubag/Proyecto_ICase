/**
 * RuleBasedExtractor
 * Extractor determinístico avanzado basado en expresiones regulares y análisis de patrones.
 * Extrae información estructurada SIN IA para que el sistema no dependa del LLM.
 * Soporta variaciones de formato en títulos, numeraciones, requisitos, reglas y entidades.
 */
class RuleBasedExtractor {
  /**
   * Ejecuta la extracción determinística completa sobre el texto limpio y las secciones.
   * @param {string} text - Texto limpio del documento
   * @param {Array<Object>} sections - Secciones detectadas
   * @param {Object} [meta={}] - Metadatos adicionales (fileName, pageCount)
   * @returns {Object} Estructura intermedia canónica (DTO)
   */
  extract(text, sections = [], meta = {}) {
    const functionalRequirements = this.extractFunctionalRequirements(text, sections);
    const nonFunctionalRequirements = this.extractNonFunctionalRequirements(text, sections);
    const businessRules = this.extractBusinessRules(text, sections);
    const actors = this.extractActors(text, sections);
    const technologies = this.extractTechnologies(text, sections);
    const entities = this.extractEntities(text, sections);
    const processes = this.extractProcesses(text, sections);
    const constraints = this.extractConstraints(text, sections);
    const dependencies = this.extractDependencies(text, sections);
    const architecture = this.extractArchitecture(text, sections, technologies);
    const contextSections = this.extractContext(sections);

    // Compatibilidad retroactiva: requirements contiene functional + nonFunctional
    const requirements = [...functionalRequirements, ...nonFunctionalRequirements];

    return {
      document: {
        name: meta.fileName || 'documento.pdf',
        pageCount: meta.pageCount || 1
      },
      sections,
      actors,
      functionalRequirements,
      nonFunctionalRequirements,
      requirements, // alias para retrocompatibilidad
      businessRules,
      entities,
      processes,
      technologies,
      constraints,
      dependencies,
      architecture,
      contextSections,
      rawText: text
    };
  }

  /**
   * Extrae requisitos funcionales con patrones flexibles:
   * RF-01, RF01, RF 01, Requisito funcional RF-01, etc.
   */
  extractFunctionalRequirements(text, sections = []) {
    if (!text) return [];

    const lines = text.split('\n');
    const reqs = [];
    const seenCodes = new Set();

    // Regex flexible para capturar RF:
    // "RF-01", "RF01", "RF 01", "RF-1", "Requisito funcional RF-01", "Código RF-01", etc.
    const rfRegex = /^(?:(?:Requisito\s+funcional|Requisitos\s+funcionales|C[oó]digo)\s+)?\b(RF)[\s\-_–]?([0-9]{1,3})\b[\s\t:.\-]+(.+)$/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(rfRegex);

      if (match) {
        const num = parseInt(match[2], 10);
        const code = `RF-${String(num).padStart(2, '0')}`;

        // Ignorar encabezados de rango como "RF-01 A RF-12"
        if (/A\s+R(?:N)?F-?[0-9]+/i.test(match[3])) {
          continue;
        }

        if (seenCodes.has(code)) {
          continue;
        }

        let name = match[3].trim();
        let j = i + 1;

        // Capturar líneas siguientes que formen parte de la misma descripción
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          if (!nextLine) break;
          // Romper si empieza otro requisito, sección, o tabla
          if (/^(?:(?:R(?:N)?F|RN)[\s\-_]?[0-9]|[0-9]+\.|PERFILES|CALIDAD|CRITERIO|La autorización|Módulo|Capa|Tipo|•)/i.test(nextLine)) {
            break;
          }
          name += ' ' + nextLine;
          j++;
        }

        // Limpiar subencabezados pegados
        const subheaderIdx = name.search(/\s+(?:TRAZABILIDAD TÉCNICA|CRITERIO DE RENDIMIENTO|RESULTADO ESPERADO)/i);
        let description = '';
        if (subheaderIdx !== -1) {
          description = name.slice(subheaderIdx).trim();
          name = name.slice(0, subheaderIdx).trim();
        }

        // Determinar sección de origen
        const sectionOrigin = this.findSectionForOffset(lines.slice(0, i).join('\n').length, sections);

        seenCodes.add(code);
        reqs.push({
          id: code,
          code,
          name: name.trim(),
          text: name.trim(),
          description: description || name.trim(),
          type: 'FUNCTIONAL',
          priority: 'HIGH',
          source: 'pdf',
          section: sectionOrigin,
          sourceText: line
        });
      }
    }

    return reqs;
  }

  /**
   * Extrae requisitos no funcionales con patrones flexibles:
   * RNF-01, RNF01, RNF 01, Requisito no funcional RNF-01, etc.
   */
  extractNonFunctionalRequirements(text, sections = []) {
    if (!text) return [];

    const lines = text.split('\n');
    const reqs = [];
    const seenCodes = new Set();

    const rnfRegex = /^(?:(?:Requisito\s+no\s+funcional|Requisitos\s+no\s+funcionales|C[oó]digo)\s+)?\b(RNF)[\s\-_–]?([0-9]{1,3})\b[\s\t:.\-]+(.+)$/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(rnfRegex);

      if (match) {
        const num = parseInt(match[2], 10);
        const code = `RNF-${String(num).padStart(2, '0')}`;

        if (/A\s+RNF-?[0-9]+/i.test(match[3]) || seenCodes.has(code)) {
          continue;
        }

        let name = match[3].trim();
        let j = i + 1;

        while (j < lines.length) {
          const nextLine = lines[j].trim();
          if (!nextLine) break;
          if (/^(?:(?:R(?:N)?F|RN)[\s\-_]?[0-9]|[0-9]+\.|PERFILES|CALIDAD|CRITERIO|La autorización|Módulo|Capa|Tipo|•)/i.test(nextLine)) {
            break;
          }
          name += ' ' + nextLine;
          j++;
        }

        const sectionOrigin = this.findSectionForOffset(lines.slice(0, i).join('\n').length, sections);

        seenCodes.add(code);
        reqs.push({
          id: code,
          code,
          name: name.trim(),
          text: name.trim(),
          description: name.trim(),
          type: 'NON_FUNCTIONAL',
          priority: 'MEDIUM',
          source: 'pdf',
          section: sectionOrigin,
          sourceText: line
        });
      }
    }

    return reqs;
  }

  /**
   * Extrae reglas de negocio:
   * RN-01, RN01, RN 01 o viñetas en la sección de reglas de negocio.
   */
  extractBusinessRules(text, sections = []) {
    const rules = [];
    const seenTexts = new Set();
    let counter = 1;

    // 1. Buscar patrones explícitos RN-01, RN 01, etc.
    const rnExplicitRegex = /^(?:(?:Regla\s+de\s+negocio|Reglas\s+de\s+negocio)\s+)?\b(RN)[\s\-_–]?([0-9]{1,3})\b[\s\t:.\-]+(.+)$/gmi;
    const matches = [...text.matchAll(rnExplicitRegex)];
    for (const m of matches) {
      const num = parseInt(m[2], 10);
      const id = `RN-${String(num).padStart(2, '0')}`;
      const ruleText = m[3].trim();
      if (!seenTexts.has(ruleText.toLowerCase())) {
        seenTexts.add(ruleText.toLowerCase());
        rules.push({
          id,
          code: id,
          text: ruleText,
          description: ruleText,
          source: 'pdf',
          section: 'Reglas de negocio'
        });
      }
    }

    // 2. Si hay secciones específicas de reglas de negocio, extraer sus viñetas
    const rnSections = sections.filter(s =>
      s.sectionId === 'reglas_negocio' ||
      /REGLAS\s+DE\s+NEGOCIO/i.test(s.title)
    );

    for (const sec of rnSections) {
      if (sec && sec.content) {
        const bulletMatches = [...sec.content.matchAll(/^[•\-*]\s*([^\n]+)/gm)];
        for (const bm of bulletMatches) {
          const raw = bm[1].trim();
          if (raw.length > 10 && !seenTexts.has(raw.toLowerCase())) {
            seenTexts.add(raw.toLowerCase());
            const id = `RN-${String(counter++).padStart(2, '0')}`;
            rules.push({
              id,
              code: id,
              text: raw,
              description: raw,
              source: 'pdf',
              section: sec.title
            });
          }
        }
      }
    }

    return rules;
  }

  /**
   * Extrae actores o perfiles contemplados.
   */
  extractActors(text, sections = []) {
    const actors = [];
    const seenNames = new Set();

    // 1. Buscar en secciones específicas de perfiles o actores
    const profileSection = sections.find(s =>
      s.sectionId === 'perfiles_contemplados' ||
      /PERFILES\s+CONTEMPLADOS|ROLES|ACTORES|USUARIOS|PARTICIPANTES/i.test(s.title)
    );

    const sourceText = profileSection ? profileSection.content : text;

    // Viñetas: "• Nombre: descripción..."
    const bulletMatches = [...sourceText.matchAll(/^[•\-*]\s*([A-Za-zÁÉÍÓÚñáéíóú\s]{2,30}):\s*([^\n]+)/gm)];
    for (const match of bulletMatches) {
      const name = match[1].trim();
      const description = match[2].trim();
      const normalized = name.toLowerCase();

      if (!seenNames.has(normalized)) {
        seenNames.add(normalized);
        actors.push({
          id: `ACT-${String(actors.length + 1).padStart(2, '0')}`,
          name,
          description,
          source: 'pdf',
          sourceText: match[0]
        });
      }
    }

    // 2. Palabras clave comunes de roles en singular o plural
    if (actors.length === 0 || actors.length < 3) {
      const commonRolesRegex = /\b(Administrador(?:es)?|Cliente(?:s)?|Mec[aá]nico(?:s)?|Recepci[oó]n(?:es)?|Usuario(?:s)?|T[eé]cnico(?:s)?|Gerente(?:s)?|Bibliotecario(?:s)?|Lector(?:es)?|Docente(?:s)?|Estudiante(?:s)?|Operador(?:es)?|Auditor(?:es)?)\b/gi;
      const roleMatches = [...text.matchAll(commonRolesRegex)];

      for (const m of roleMatches) {
        let raw = m[1].toLowerCase();
        if (raw.endsWith('es') && raw !== 'gerentes') {
          raw = raw.slice(0, -2);
        } else if (raw.endsWith('s')) {
          raw = raw.slice(0, -1);
        }
        const name = raw.charAt(0).toUpperCase() + raw.slice(1);
        const norm = name.toLowerCase();

        if (!seenNames.has(norm)) {
          seenNames.add(norm);
          actors.push({
            id: `ACT-${String(actors.length + 1).padStart(2, '0')}`,
            name,
            description: `Rol de ${name} identificado en el sistema.`,
            source: 'pdf',
            sourceText: m[0]
          });
        }
      }
    }

    const deduplicationService = require('../analysis/deduplicationService');
    return deduplicationService.consolidateActors(actors);
  }

  /**
   * Extrae nombres de tecnologías mencionadas explícitamente en el texto.
   * NO inventa tecnologías.
   */
  extractTechnologies(text, sections = []) {
    const knownTech = [
      'React', 'Vue', 'Vue.js', 'Angular', 'Next.js', 'Vite',
      'Node.js', 'Express', 'Express.js', 'NestJS',
      'FastAPI', 'Django', 'Flask', 'Python',
      'Java', 'Spring Boot', 'Spring',
      'PostgreSQL', 'Postgres', 'MySQL', 'MongoDB', 'SQLite', 'Oracle', 'Prisma',
      'Docker', 'Kubernetes',
      'JWT', 'REST API', 'GraphQL', 'HTTPS', 'TypeScript', 'JavaScript',
      'Tailwind CSS', 'Bootstrap'
    ];

    const detected = [];
    const seen = new Set();

    for (const tech of knownTech) {
      // Búsqueda con límite de palabra seguro
      const escaped = tech.replace('.', '\\.').replace(' ', '\\s+');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(text)) {
        if (!seen.has(tech.toLowerCase())) {
          seen.add(tech.toLowerCase());
          detected.push(tech);
        }
      }
    }

    return detected;
  }

  /**
   * Extrae posibles entidades identificadas en el texto o secciones de modelo de datos.
   */
  extractEntities(text, sections = []) {
    const entities = [];
    const seen = new Set();

    // 1. Buscar en secciones como "Modelo de datos", "Entidades", "Base de datos"
    const dataSection = sections.find(s =>
      /ENTIDADES|MODELO\s+DE\s+DATOS|BASE\s+DE\s+DATOS|INFORMACI[OÓ]N\s+PRINCIPAL/i.test(s.title)
    );

    const targetText = dataSection ? dataSection.content : text;

    // Buscar patrones tipo: "entidades Usuario, Libro, Autor..." o "entidades como Cliente, Vehiculo..."
    const entitiesListMatch = targetText.match(/(?:entidades|tablas|modelos)(?:\s+principales)?(?:\s+como|\s+del\s+sistema|\s*:|\s+incluyen)?\s*([A-Za-zÁÉÍÓÚñáéíóú,\s\ny]+)/i);

    if (entitiesListMatch) {
      const candidates = entitiesListMatch[1].split(/[,y\n]/).map(c => c.trim()).filter(Boolean);
      for (const c of candidates) {
        if (c.length >= 3 && c.length <= 25 && /^[A-ZÁÉÍÓÚ][a-záéíóúñA-Z]+$/.test(c)) {
          const norm = c.toLowerCase();
          if (!seen.has(norm)) {
            seen.add(norm);
            entities.push({
              id: `ENT-${String(entities.length + 1).padStart(2, '0')}`,
              name: c,
              description: `Entidad ${c} identificada en el documento.`,
              attributes: [],
              source: 'pdf'
            });
          }
        }
      }
    }

    // 2. Si no hubo lista explícita, buscar entidades comunes del dominio
    if (entities.length === 0) {
      const domainEntityKeywords = [
        'Usuario', 'Cliente', 'Vehiculo', 'Cita', 'Diagnostico',
        'Cotizacion', 'OrdenTrabajo', 'Repuesto', 'Servicio',
        'Libro', 'Autor', 'Categoria', 'Prestamo', 'Ejemplar',
        'Producto', 'Venta', 'Factura', 'Inventario', 'Proveedor'
      ];

      for (const kw of domainEntityKeywords) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        if (regex.test(text)) {
          const norm = kw.toLowerCase();
          if (!seen.has(norm)) {
            seen.add(norm);
            entities.push({
              id: `ENT-${String(entities.length + 1).padStart(2, '0')}`,
              name: kw,
              description: `Entidad ${kw} identificada en el dominio del documento.`,
              attributes: [],
              source: 'pdf'
            });
          }
        }
      }
    }

    return entities;
  }

  /**
   * Extrae procesos o pasos secuenciales detectados en el documento.
   */
  extractProcesses(text, sections = []) {
    const processes = [];
    const procSection = sections.find(s =>
      s.sectionId === 'modelo_operativo' ||
      /MODELO\s+GENERAL|PROCESOS|FLUJO\s+DE\s+OPERACI[OÓ]N/i.test(s.title)
    );

    const source = procSection ? procSection.content : '';
    if (source) {
      const stepMatches = [...source.matchAll(/^[ \t]*([0-9]{1,2})\.\s*([^\n]+)/gm)];
      for (const sm of stepMatches) {
        processes.push({
          step: parseInt(sm[1], 10),
          description: sm[2].trim(),
          source: 'pdf'
        });
      }
    }

    return processes;
  }

  /**
   * Extrae restricciones del sistema.
   */
  extractConstraints(text, sections = []) {
    const constraints = [];
    const supSection = sections.find(s =>
      /SUPUESTOS|RESTRICCIONES|DEPENDENCIAS/i.test(s.title)
    );

    if (supSection && supSection.content) {
      const bullets = [...supSection.content.matchAll(/^[•\-*]\s*([^\n]+)/gm)];
      for (const b of bullets) {
        constraints.push(b[1].trim());
      }
    }

    return constraints;
  }

  /**
   * Extrae dependencias explícitas.
   */
  extractDependencies(text, sections = []) {
    const dependencies = [];
    const depSection = sections.find(s => /DEPENDENCIAS/i.test(s.title));
    if (depSection && depSection.content) {
      const bullets = [...depSection.content.matchAll(/^[•\-*]\s*([^\n]+)/gm)];
      for (const b of bullets) {
        dependencies.push(b[1].trim());
      }
    }
    return dependencies;
  }

  /**
   * Extrae estructura de arquitectura basada en tecnologías y patrones detectados.
   */
  extractArchitecture(text, sections = [], detectedTech = []) {
    const archSection = sections.find(s => s.sectionId === 'arquitectura');
    const content = archSection ? archSection.content : text;

    let style = 'UNKNOWN';
    if (/tres capas/i.test(content)) style = 'Arquitectura Web de Tres Capas';
    if (/microservicios/i.test(content)) style = 'Arquitectura de Microservicios';
    if (/hexagonal|clean architecture/i.test(content)) style = 'Arquitectura Limpia / Hexagonal';

    // Determinar capas principales con base en tecnologías detectadas
    const frontendTech = detectedTech.find(t => ['React', 'Vue', 'Angular', 'Next.js'].includes(t)) || 'UNKNOWN';
    const backendTech = detectedTech.find(t => ['Node.js', 'Express', 'FastAPI', 'Spring Boot', 'Django'].includes(t)) || 'UNKNOWN';
    const dbTech = detectedTech.find(t => ['PostgreSQL', 'Postgres', 'MySQL', 'MongoDB', 'SQLite'].includes(t)) || 'UNKNOWN';

    return {
      style,
      frontend: frontendTech,
      backend: backendTech,
      database: dbTech,
      technologies: detectedTech,
      connections: [],
      components: detectedTech.map(name => ({ name, layer: null, type: null })),
      source: 'pdf'
    };
  }

  /**
   * Extrae resúmenes contextuales de situación actual, problemas y objetivos.
   */
  extractContext(sections = []) {
    const context = {
      problemPrincipal: '',
      situacionActual: '',
      objetivos: '',
      alcance: ''
    };

    for (const sec of sections) {
      if (/PROBLEMA\s+PRINCIPAL/i.test(sec.title)) {
        context.problemPrincipal = sec.content.slice(0, 500);
      } else if (/SITUACI[OÓ]N\s+ACTUAL/i.test(sec.title)) {
        context.situacionActual = sec.content.slice(0, 500);
      } else if (/OBJETIVOS?/i.test(sec.title)) {
        context.objetivos = sec.content.slice(0, 600);
      } else if (/ALCANCE/i.test(sec.title)) {
        context.alcance = sec.content.slice(0, 500);
      }
    }

    return context;
  }

  /**
   * Helper para encontrar la sección correspondiente a un offset.
   */
  findSectionForOffset(offset, sections = []) {
    for (const s of sections) {
      if (offset >= s.start && offset <= s.end) {
        return s.title;
      }
    }
    return 'General';
  }
}

module.exports = new RuleBasedExtractor();
