/**
 * Diagram Semantic Validator
 * Performs deep semantic, architectural, and quality validation on Mermaid E/R and Class diagrams.
 * Detects:
 * - Empty entities / classes
 * - Inappropriate / missing primary keys (PKs)
 * - Descriptive sentence fragments used as attributes (e.g. 'claridad_la_falla')
 * - Isolated entities or classes without relationships
 * - Non-ASCII or illegal characters in identifiers
 * - Generic invented methods in classes (getId, toDTO, validate, save)
 * - Infrastructure leakage (AuthenticationService)
 * - Cross-validation between E/R (relational model) and Class (OOP domain model)
 */

class DiagramSemanticValidator {
  /**
   * Validates an Entity-Relationship (erDiagram) diagram semantically and syntactically.
   * @param {string} code Mermaid erDiagram code
   * @returns {Object} Quality report
   */
  validateER(code = '') {
    const errors = [];
    const warnings = [];

    if (!code || typeof code !== 'string' || !code.trim()) {
      return {
        isValid: false,
        syntaxValid: false,
        errors: ['El código Mermaid está vacío'],
        warnings: [],
        stats: { entitiesCount: 0, relationshipsCount: 0, attributesCount: 0, pksCount: 0 }
      };
    }

    const clean = code.trim();
    if (!clean.toLowerCase().startsWith('erdiagram')) {
      errors.push('El código debe comenzar con "erDiagram".');
    }

    // 1. Extract entities and attributes
    const entities = new Map(); // entityName -> { attributes: [], hasPk: false }
    const entityRegex = /^\s*([A-Za-z0-9_]+)\s*\{([\s\S]*?)\}/gm;
    let match;

    while ((match = entityRegex.exec(clean)) !== null) {
      const entityName = match[1].trim();
      const rawBody = match[2].trim();
      const lines = rawBody.split('\n').map(l => l.trim()).filter(Boolean);

      const attrs = [];
      let hasPk = false;

      for (const line of lines) {
        // Attribute format: type name [PK/FK/UK] ["comment"]
        const parts = line.split(/\s+/);
        const type = parts[0] || 'string';
        const name = parts[1] || '';
        const isPk = parts.slice(2).some(p => p.toUpperCase() === 'PK');
        const isFk = parts.slice(2).some(p => p.toUpperCase() === 'FK');

        if (isPk) hasPk = true;

        // Check for descriptive sentence fragments masquerading as attributes
        if (/claridad|satisfaccion|calidad_del|atencion|falla_del/i.test(name) || name.length > 25) {
          warnings.push(`Atributo sospechoso en entidad '${entityName}': "${name}". Parece una frase o descripción en lugar de una propiedad técnica.`);
        }

        // Check for non-ASCII characters in type or name
        if (/[^\x00-\x7F]/.test(type) || /[^\x00-\x7F]/.test(name)) {
          errors.push(`Atributo con acentos o caracteres no-ASCII en entidad '${entityName}': "${line}". En erDiagram deben ser ASCII simple.`);
        }

        // Check if an obvious non-identifier is marked as PK
        if (isPk && (/claridad|descripcion|detalle|nota|comentario/i.test(name) || name.length > 20)) {
          errors.push(`Clave primaria (PK) inválida en '${entityName}': "${name}". Una PK debe ser un identificador (ej: id, codigo, id_${entityName.toLowerCase()}).`);
        }

        attrs.push({ type, name, isPk, isFk });
      }

      entities.set(entityName, {
        name: entityName,
        attributes: attrs,
        hasPk,
        isEmpty: attrs.length === 0
      });
    }

    // Check empty entities
    for (const [name, data] of entities.entries()) {
      if (data.isEmpty) {
        warnings.push(`Entidad vacía detectada: '${name} {}'. Las entidades persistentes deben tener al menos un identificador (PK) y atributos básicos.`);
      } else if (!data.hasPk) {
        warnings.push(`Entidad '${name}' sin clave primaria (PK) explícita.`);
      }
    }

    // 2. Extract relationships
    // E.g.: CLIENTE ||--o{ VEHICULO : "posee"
    const rels = [];
    const relRegex = /([A-Za-z0-9_]+)\s*([|}>o+]{1,2}(?:--|\.\.)[|{<o+]{1,2})\s*([A-Za-z0-9_]+)(?:\s*:\s*"?([^"\n]*)"?)?/g;

    while ((match = relRegex.exec(clean)) !== null) {
      const source = match[1].trim();
      const card = match[2].trim();
      const target = match[3].trim();
      const label = (match[4] || '').trim();

      rels.push({ source, target, card, label });
    }

    // 3. Check for isolated entities
    const connectedEntities = new Set();
    rels.forEach(r => {
      connectedEntities.add(r.source);
      connectedEntities.add(r.target);
    });

    const isolated = [];
    for (const entName of entities.keys()) {
      if (!connectedEntities.has(entName)) {
        isolated.push(entName);
      }
    }

    if (isolated.length > 0) {
      warnings.push(`Entidad(es) aislada(s) sin relaciones en el modelo E/R: ${isolated.join(', ')}.`);
    }

    if (entities.size > 2 && rels.length === 0) {
      errors.push('El diagrama E/R no contiene ninguna relación entre entidades.');
    }

    const totalAttributes = Array.from(entities.values()).reduce((acc, e) => acc + e.attributes.length, 0);
    const totalPks = Array.from(entities.values()).filter(e => e.hasPk).length;

    return {
      isValid: errors.length === 0,
      syntaxValid: errors.length === 0,
      errors,
      warnings,
      stats: {
        entitiesCount: entities.size,
        relationshipsCount: rels.length,
        attributesCount: totalAttributes,
        pksCount: totalPks,
        emptyEntitiesCount: Array.from(entities.values()).filter(e => e.isEmpty).length,
        isolatedEntitiesCount: isolated.length
      }
    };
  }

  /**
   * Validates an Object-Oriented Class Diagram (classDiagram) semantically and syntactically.
   * @param {string} code Mermaid classDiagram code
   * @returns {Object} Quality report
   */
  validateClass(code = '') {
    const errors = [];
    const warnings = [];

    if (!code || typeof code !== 'string' || !code.trim()) {
      return {
        isValid: false,
        syntaxValid: false,
        errors: ['El código Mermaid está vacío'],
        warnings: [],
        stats: { classesCount: 0, relationshipsCount: 0, attributesCount: 0, methodsCount: 0 }
      };
    }

    const clean = code.trim();
    if (!clean.toLowerCase().startsWith('classdiagram')) {
      errors.push('El código debe comenzar con "classDiagram".');
    }

    // 1. Extract classes and members
    const classes = new Map();
    const classBlockRegex = /class\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)\}/g;
    let match;

    while ((match = classBlockRegex.exec(clean)) !== null) {
      const className = match[1].trim();
      const rawBody = match[2].trim();
      const lines = rawBody.split('\n').map(l => l.trim()).filter(Boolean);

      const attrs = [];
      const methods = [];

      for (const line of lines) {
        // Method format: [+|-|#]name(args) [returnType]
        if (line.includes('(')) {
          const isGeneric = /\b(?:getid|setid|todto|validate|validarreglas|save)\b/i.test(line);
          if (isGeneric) {
            warnings.push(`Método genérico de programación detectado en clase '${className}': "${line}". Prioriza operaciones de dominio reales (ej: registrar, calcularTotal, agendar).`);
          }
          methods.push(line);
        } else {
          // Attribute format: [+|-|#]Type name
          // Check for spaces or invalid tokens inside attribute
          const stripped = line.replace(/^[+\-#~]\s*/, '').trim();
          const tokens = stripped.split(/\s+/);

          if (tokens.length > 2) {
            errors.push(`Atributo con espacios en clase '${className}': "${line}". Debe tener formato "+Tipo nombreAtributo" sin espacios en el nombre.`);
          }

          if (/[^\x00-\x7F]/.test(line)) {
            errors.push(`Atributo con acentos o caracteres especiales en '${className}': "${line}".`);
          }

          if (/claridad\s+la\s+falla|precio\s+de\s+mano/i.test(line)) {
            errors.push(`Atributo mal interpretado en '${className}': "${line}". Debe normalizarse en camelCase (ej: precioManoObra).`);
          }

          attrs.push(line);
        }
      }

      // Check forbidden infrastructure classes
      if (/AuthenticationService|JwtService|TokenService|N8nService/i.test(className)) {
        warnings.push(`Clase técnica de infraestructura '${className}' incluida en el diagrama de dominio. El modelo POO debe priorizar conceptos del negocio.`);
      }

      classes.set(className, {
        name: className,
        attributes: attrs,
        methods,
        isEmpty: attrs.length === 0 && methods.length === 0
      });
    }

    // Check standalone class declarations: e.g. "class Cita" without block
    const standaloneClassRegex = /^\s*class\s+([A-Za-z0-9_]+)(?!\s*\{)/gm;
    while ((match = standaloneClassRegex.exec(clean)) !== null) {
      const cName = match[1].trim();
      if (!classes.has(cName)) {
        classes.set(cName, { name: cName, attributes: [], methods: [], isEmpty: true });
        warnings.push(`Clase vacía detectada: '${cName}'. Debe incluir atributos o métodos del dominio.`);
      }
    }

    for (const [name, data] of classes.entries()) {
      if (data.isEmpty) {
        warnings.push(`Clase vacía '${name}': No contiene atributos ni métodos documentados.`);
      }
    }

    // 2. Extract relationships between classes
    const rels = [];
    const classRelRegex = /([A-Za-z0-9_]+)\s*(?:(?:"[^"]*")?\s*)?(?:-->|<--|--|\.\.|\*--|o--|--\|>|<\|--)\s*(?:(?:"[^"]*")?\s*)?([A-Za-z0-9_]+)/g;

    while ((match = classRelRegex.exec(clean)) !== null) {
      const src = match[1].trim();
      const tgt = match[2].trim();
      if (src !== tgt) {
        rels.push({ src, tgt });
      }
    }

    // 3. Check for isolated classes
    const connectedClasses = new Set();
    rels.forEach(r => {
      connectedClasses.add(r.src);
      connectedClasses.add(r.tgt);
    });

    const isolatedClasses = [];
    for (const cName of classes.keys()) {
      if (!connectedClasses.has(cName)) {
        isolatedClasses.push(cName);
      }
    }

    if (isolatedClasses.length > 0) {
      warnings.push(`Clase(s) aislada(s) sin relaciones: ${isolatedClasses.join(', ')}.`);
    }

    if (classes.size > 2 && rels.length === 0) {
      errors.push('El diagrama de clases no contiene relaciones orientadas a objetos entre las clases.');
    }

    const totalAttrs = Array.from(classes.values()).reduce((acc, c) => acc + c.attributes.length, 0);
    const totalMethods = Array.from(classes.values()).reduce((acc, c) => acc + c.methods.length, 0);

    return {
      isValid: errors.length === 0,
      syntaxValid: errors.length === 0,
      errors,
      warnings,
      stats: {
        classesCount: classes.size,
        relationshipsCount: rels.length,
        attributesCount: totalAttrs,
        methodsCount: totalMethods,
        emptyClassesCount: Array.from(classes.values()).filter(c => c.isEmpty).length,
        isolatedClassesCount: isolatedClasses.length
      }
    };
  }

  /**
   * Cross-validates consistency between E/R relational model and Class OOP model.
   * Compares entities vs classes, persistence alignment, and shared associations.
   * @param {string} erCode Mermaid erDiagram
   * @param {string} classCode Mermaid classDiagram
   * @returns {Object} Cross-model consistency report
   */
  crossValidate(erCode = '', classCode = '') {
    const erReport = this.validateER(erCode);
    const classReport = this.validateClass(classCode);

    if (!erReport.isValid || !classReport.isValid) {
      return {
        isConsistent: false,
        score: 0,
        erValid: erReport.isValid,
        classValid: classReport.isValid,
        discrepancies: ['Uno o ambos diagramas tienen errores sintácticos que impiden la validación cruzada.']
      };
    }

    // Extract names normalized (lowercase without special chars)
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    const erEntities = new Set();
    const erRegex = /^\s*([A-Za-z0-9_]+)\s*\{/gm;
    let match;
    while ((match = erRegex.exec(erCode)) !== null) {
      erEntities.add(normalize(match[1]));
    }

    const classNames = new Set();
    const clsRegex = /class\s+([A-Za-z0-9_]+)/g;
    while ((match = clsRegex.exec(classCode)) !== null) {
      classNames.add(normalize(match[1]));
    }

    const matched = [];
    const missingInClass = [];
    const missingInER = [];

    for (const ent of erEntities) {
      if (classNames.has(ent)) {
        matched.push(ent);
      } else {
        missingInClass.push(ent);
      }
    }

    for (const cls of classNames) {
      // Discard pure services from ER matching
      if (/service|controller|manager/i.test(cls)) continue;
      if (!erEntities.has(cls)) {
        missingInER.push(cls);
      }
    }

    const discrepancies = [];
    if (missingInClass.length > 0) {
      discrepancies.push(`Entidad(es) de datos en E/R sin clase correspondiente en POO: ${missingInClass.join(', ')}.`);
    }
    if (missingInER.length > 0) {
      discrepancies.push(`Clase(s) de dominio en POO que parecen persistentes pero no existen en E/R: ${missingInER.join(', ')}.`);
    }

    const totalConcepts = new Set([...erEntities, ...classNames]).size;
    const consistencyScore = totalConcepts > 0 ? Math.round((matched.length / totalConcepts) * 100) : 100;

    return {
      isConsistent: discrepancies.length === 0,
      score: consistencyScore,
      matchedConcepts: matched,
      missingInClass,
      missingInER,
      discrepancies,
      summary: `Correspondencia conceptual: ${consistencyScore}% (${matched.length} conceptos compartidos de ${totalConcepts} totales).`
    };
  }
}

module.exports = new DiagramSemanticValidator();
