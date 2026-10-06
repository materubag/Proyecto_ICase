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
    const classifier=require('../analysis/statementClassifier');
    const out=this.extractCodedRequirements(text, sections, 'RF', 'FUNCTIONAL').filter(r=>classifier.classify(r.text,r)!=='OBJECTIVE');
    const add=(statement,start,end,section)=>{if(out.some(r=>start>=r.start&&start<r.end))return;out.push({name:statement,text:statement,description:statement,type:'FUNCTIONAL',source:'explicit',extractionMethod:'LOCAL',sourceText:text.substring(start,end),section,start,end});};
    for(const m of text.matchAll(/(?:El sistema|La aplicaci[o\u00f3]n|La plataforma)\s+(?:debe(?:r[a\u00e1])?|permitir[a\u00e1]|permite|podr[a\u00e1])\s+[^.\n]+[.]?/gi)) {
      if(classifier.objectives(text,sections).some(o=>m.index>=o.start&&m.index<o.end))continue;
      add(m[0],m.index,m.index+m[0].length,this.findSectionForOffset(m.index,sections));
    }
    for(const section of sections.filter(s=>/requisitos?\s+funcionales|tabla de rf/i.test(s.title||'')))for(const m of text.substring(section.start,section.end).matchAll(/^[ \t|]*(?:registrar|consultar|modificar|eliminar|exportar|importar|generar|almacenar)\s+[^\n|]+/gmi)) {
      const start=section.start+m.index;add(m[0].trim(),start,start+m[0].length,section.title);
    }
    return out;
  }

  extractNonFunctionalRequirements(text, sections = []) {
    return this.extractCodedRequirements(text, sections, 'RNF', 'NON_FUNCTIONAL');
  }

  extractCodedRequirements(text = '', sections = [], prefix, type) {
    const rows = [...text.matchAll(/[^\n]*(?:\n|$)/g)].filter(m => m[0]);
    const pattern = /^[ \t|]*(?:(?:Requisitos?\s+(?:no\s+)?funcionales?|Código)\s+)?((RNF|RF)[ \t_–-]*([0-9]+))\b[ \t:|.–-]*(.*)$/i;
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      const first = rows[i][0].replace(/\r?\n$/, '');
      const m = first.match(pattern);
      if (!m || m[2].toUpperCase() !== prefix || /^(?:(?:A|AL|HASTA|TO)\s+)?R(?:N)?F[ -]*\d+\s*$/i.test(m[4])) continue;
      let description = m[4].replace(/\|\s*$/, '').trim();
      let end = rows[i].index + first.length;
      let started = Boolean(description);
      for (let j = i + 1; j < rows.length; j++) {
        const next = rows[j][0].replace(/\r?\n$/, '');
        const clean = next.trim();
        if (/^\[PÁGINA|SALTO_PAGINA|^NEXORA\b|^[•*]|^\d+(?:\.\d+)*\.?\s+[A-ZÁÉÍÓÚÑ]|^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ \t·-]{5,}$/.test(clean) || pattern.test(next)) break;
        if (!clean) { if (started) break; else continue; }
        // A complete sentence followed by another paragraph is a separate finding.
        // Explicit conditional continuations stay attached (e.g. "solo si...", "con...").
        if (started && /[.;]$/.test(description) && !/^(?:si\b|cuando\b|siempre\b|solo\b|únicamente\b|bajo\b|con\b|sin\b|excepto\b|y\b|o\b|también\b|además\b|asimismo\b|el sistema\b|la aplicación\b|debe(?:rá)?\b)/i.test(clean) && !/^[ \t]+\S/.test(next)) break;
        description += (description ? '\n' : '') + clean;
        started = true; end = rows[j].index + next.length;
      }
      if (!description) continue;
      const start = rows[i].index + first.indexOf(m[1]);
      const code = `${prefix}-${String(Number(m[3])).padStart(2, '0')}`;
      const sourceText = text.substring(start, end);
      const name = description.replace(/\s+/g, ' ').trim();
      const pages = [...text.substring(0, start).matchAll(/\[PÁGINA\s+(\d+)\]/gi)];
      out.push({ id: code, code, originalCode: m[1], name, text: name, description: name, type,
        source: 'explicit', extractionMethod: 'LOCAL', section: this.findSectionForOffset(start, sections),
        sourceText, start, end, page: pages.length ? Number(pages.at(-1)[1]) : null });
    }
    // Same code with different text is not silently discarded.
    return out;
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
        context.problemPrincipal = sec.content;
      } else if (/SITUACI[OÓ]N\s+ACTUAL/i.test(sec.title)) {
        context.situacionActual = sec.content;
      } else if (/OBJETIVOS?/i.test(sec.title)) {
        context.objetivos = sec.content;
      } else if (/ALCANCE/i.test(sec.title)) {
        context.alcance = sec.content;
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
