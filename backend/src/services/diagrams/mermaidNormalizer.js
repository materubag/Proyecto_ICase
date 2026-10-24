
const ER_DEFAULT_ATTRIBUTES = {
  USUARIO: ['int id PK', 'string nombre', 'string email', 'string password_hash', 'int rol_id FK'],
  ROL: ['int id PK', 'string nombre', 'string permisos'],
  CLIENTE: ['int id PK', 'string nombre', 'string telefono', 'string email', 'string direccion'],
  VEHICULO: ['int id PK', 'int cliente_id FK', 'string placa', 'string marca', 'string modelo', 'int kilometraje'],
  RECEPCION: ['int id PK', 'int vehiculo_id FK', 'datetime fecha_ingreso', 'int odometro', 'float combustible', 'string motivo_ingreso'],
  RECEPCION_VEHICULO: ['int id PK', 'int vehiculo_id FK', 'datetime fecha_ingreso', 'int odometro', 'float combustible', 'string motivo_ingreso'],
  CITA: ['int id PK', 'int cliente_id FK', 'datetime fecha_cita', 'string estado', 'string motivo'],
  DIAGNOSTICO: ['int id PK', 'int vehiculo_id FK', 'datetime fecha', 'string observaciones', 'string estado'],
  FALLA: ['int id PK', 'int diagnostico_id FK', 'string codigo_obd', 'string sistema', 'string componente', 'string severidad'],
  FALLA_TECNICA: ['int id PK', 'int diagnostico_id FK', 'string codigo_obd', 'string sistema', 'string componente', 'string severidad'],
  CODIGO_OBD: ['int id PK', 'string codigo', 'string descripcion', 'string solucion_sugerida'],
  BASE_CONOCIMIENTO: ['int id PK', 'string titulo', 'string sintoma', 'string causa', 'string solucion'],
  COTIZACION: ['int id PK', 'int vehiculo_id FK', 'float total', 'string estado', 'datetime fecha_decision'],
  DETALLE_COTIZACION: ['int id PK', 'int cotizacion_id FK', 'int repuesto_id FK', 'int servicio_id FK', 'float precio', 'boolean autorizado'],
  ORDEN_TRABAJO: ['int id PK', 'int cotizacion_id FK', 'int vehiculo_id FK', 'datetime fecha_inicio', 'string estado'],
  DETALLE_ORDEN: ['int id PK', 'int orden_id FK', 'int producto_id FK', 'int cantidad', 'float precio_unitario'],
  ACTIVIDAD_ORDEN: ['int id PK', 'int orden_id FK', 'string descripcion', 'datetime fecha_registro', 'string estado'],
  ASIGNACION_MECANICO: ['int id PK', 'int orden_id FK', 'int usuario_id FK', 'datetime fecha_asignacion'],
  SERVICIO: ['int id PK', 'string codigo', 'string descripcion', 'float precio_mano_obra', 'int duracion_estimada'],
  CATALOGO_SERVICIO: ['int id PK', 'string codigo', 'string descripcion', 'float precio_mano_obra', 'int duracion_estimada'],
  PRODUCTO: ['int id PK', 'string codigo', 'string nombre', 'float precio', 'float costo', 'int stock', 'int stock_minimo'],
  REPUESTO: ['int id PK', 'string codigo', 'string nombre', 'float precio', 'float costo', 'int stock', 'int stock_minimo'],
  MOVIMIENTO_INVENTARIO: ['int id PK', 'int producto_id FK', 'string tipo_movimiento', 'int cantidad', 'datetime fecha', 'int usuario_id FK'],
  PROVEEDOR: ['int id PK', 'string nombre', 'string contacto', 'string telefono', 'string email'],
  COMPRA: ['int id PK', 'int proveedor_id FK', 'datetime fecha', 'float total'],
  COMPRA_PROVEEDOR: ['int id PK', 'int proveedor_id FK', 'datetime fecha', 'float total'],
  DETALLE_COMPRA: ['int id PK', 'int compra_id FK', 'int producto_id FK', 'int cantidad', 'float costo_unitario'],
  VENTA_DIRECTA: ['int id PK', 'int cliente_id FK', 'datetime fecha', 'float total', 'string metodo_pago'],
  DETALLE_VENTA: ['int id PK', 'int venta_id FK', 'int producto_id FK', 'int cantidad', 'float precio'],
  MANTENIMIENTO_PREVENTIVO: ['int id PK', 'int vehiculo_id FK', 'string criterio', 'int proximo_km', 'datetime proxima_fecha', 'string estado'],
  EVIDENCIA_MULTIMEDIA: ['int id PK', 'int diagnostico_id FK', 'string url_archivo', 'string tipo', 'datetime fecha_subida'],
  AUDITORIA: ['int id PK', 'int usuario_id FK', 'string operacion', 'string entidad_afectada', 'datetime fecha'],
  NOTIFICACION: ['int id PK', 'int usuario_id FK', 'string mensaje', 'boolean leido', 'datetime fecha_envio']
};

/**
 * Mermaid Normalizer
 * Enforces robust, safe identifiers and syntax across all Mermaid diagram types.
 * Solves character encoding issues (accents, ñ, special chars) in attribute names and node IDs,
 * splits concatenated attributes, and normalizes delimiters.
 */

// Spanish/Latin accent mapping
const ACCENT_MAP = {
  'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'ã': 'a', 'å': 'a',
  'é': 'e', 'è': 'e', 'ë': 'e', 'ê': 'e',
  'í': 'i', 'ì': 'i', 'ï': 'i', 'î': 'i',
  'ó': 'o', 'ò': 'o', 'ö': 'o', 'ô': 'o', 'õ': 'o',
  'ú': 'u', 'ù': 'u', 'ü': 'u', 'û': 'u',
  'ñ': 'n', 'Ñ': 'N',
  'ç': 'c', 'Ç': 'C',
  'Á': 'A', 'À': 'A', 'Ä': 'A', 'Â': 'A', 'Ã': 'A',
  'É': 'E', 'È': 'E', 'Ë': 'E', 'Ê': 'E',
  'Í': 'I', 'Ì': 'I', 'Ï': 'I', 'Î': 'I',
  'Ó': 'O', 'Ò': 'O', 'Ö': 'O', 'Ô': 'O', 'Õ': 'O',
  'Ú': 'U', 'Ù': 'U', 'Ü': 'U', 'Û': 'U'
};

// Reserved keywords in Mermaid that cannot be used as standalone node IDs
const RESERVED_NODE_IDS = new Set([
  'end', 'subgraph', 'class', 'style', 'classdef', 'graph', 'flowchart',
  'direction', 'click', 'call', 'callback', 'linkstyle', 'interpolate'
]);

/**
 * Strips accents and diacritics from a string.
 */
function stripAccents(str) {
  if (!str || typeof str !== 'string') return '';
  return str.split('').map(char => ACCENT_MAP[char] || char).join('')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Converts a raw name into a safe, valid ASCII Mermaid identifier.
 * Example: "código" -> "codigo", "orden de trabajo" -> "orden_trabajo"
 */
function toSafeIdentifier(str, defaultPrefix = 'id') {
  if (!str) return `${defaultPrefix}_item`;
  const clean = stripAccents(String(str))
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!clean) return `${defaultPrefix}_item`;

  const lower = clean.toLowerCase();
  if (RESERVED_NODE_IDS.has(lower)) {
    return `${defaultPrefix}_${clean}`;
  }

  // Identifiers cannot start with a digit in Mermaid
  if (/^[0-9]/.test(clean)) {
    return `${defaultPrefix}_${clean}`;
  }

  return clean;
}

/**
 * Normalizes attribute data types to standard Mermaid ER / Class types.
 */
function normalizeDataType(rawType) {
  if (!rawType) return 'string';
  const clean = stripAccents(String(rawType)).toLowerCase().trim();

  if (/^(int|integer|entero|number|numero|id|bigint|smallint)/.test(clean)) return 'int';
  if (/^(str|string|varchar|text|texto|char|char\d*|nombre|correo|email|direccion)/.test(clean)) return 'string';
  if (/^(bool|boolean|booleano|estado|activo)/.test(clean)) return 'boolean';
  if (/^(float|double|decimal|precio|costo|monto|saldo|real|numeric)/.test(clean)) return 'float';
  if (/^(datetime|timestamp|fecha_hora)/.test(clean)) return 'datetime';
  if (/^(date|fecha)/.test(clean)) return 'date';
  if (/^(uuid|guid)/.test(clean)) return 'string';

  // Fallback to safe alphanumeric word
  return toSafeIdentifier(clean, 'type');
}

/**
 * Sanitizes a human-readable label to be safely placed in quotes inside Mermaid.
 */
function toSafeLabel(text, maxLength = 120) {
  if (!text) return '';
  return String(text)
    .replace(/["\r\n\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Normalizes an ER diagram (erDiagram).
 * Solves:
 * - Accents in attributes: string código PK -> string codigo PK
 * - Concatenated attributes on the same line
 * - Safe entity names and relationship cardinalities
 */
function normalizeER(code) {
  if (!code || typeof code !== 'string') return 'erDiagram\n';

  const rawLines = code.split('\n');
    const outputLines = ['erDiagram'];
  let inEntityBlock = false;
  let currentEntity = null;

  // Cardinality normalization lookup
  const CARD_MAP = {
    '||--||': '||--||',
    '||--o{': '||--o{',
    '||--|{': '||--|{',
    '}|--||': '}o--||',
    '}o--||': '}o--||',
    '}o--o{': '}o--o{',
    '}|--|{': '}o--o{',
    '|o--o|': '|o--o|',
    '|o--o{': '|o--o{',
    '1:1': '||--||',
    '1:n': '||--o{',
    '1:m': '||--o{',
    'n:1': '}o--||',
    'm:1': '}o--||',
    'n:m': '}o--o{',
    'n:n': '}o--o{'
  };

  const knownEntities = new Set();
  const seenEREdges = new Set();
  const seenERAttrs = new Set();

  for (let rawLine of rawLines) {
    let line = rawLine.trim();
    if (!line) continue;

    // Ignore existing headers
    if (/^erdiagram/i.test(line) || /^direction\s+/i.test(line)) {
      continue;
    }

    // Entity block opening: ENTITY_NAME {
    const entityOpenMatch = line.match(/^([a-zA-Z0-9_\u00C0-\u017F\s-]+)\s*\{$/);
    if (entityOpenMatch && !inEntityBlock) {
      const rawEntityName = entityOpenMatch[1].trim();
      currentEntity = toSafeIdentifier(rawEntityName, 'ENT').toUpperCase();
      knownEntities.add(currentEntity);
      seenERAttrs.clear();
      inEntityBlock = true;
      outputLines.push(`    ${currentEntity} {`);
      continue;
    }

    // Entity block closing: }
    if (inEntityBlock && line === '}') {
      outputLines.push('    }');
      inEntityBlock = false;
      currentEntity = null;
      continue;
    }

    // Inside Entity Block: parse and normalize attributes
    if (inEntityBlock) {
      // Split concatenated attributes if multiple exist on the same line
      const attributeChunks = splitConcatenatedAttributes(line);

      for (const chunk of attributeChunks) {
        const normalizedAttr = normalizeAttributeLine(chunk);
        if (normalizedAttr) {
          const attrNameOnly = normalizedAttr.split(/\s+/)[1]?.toLowerCase();
          if (attrNameOnly && seenERAttrs.has(attrNameOnly)) {
            continue; // Deduplicate repeated attribute in entity
          }
          if (attrNameOnly) seenERAttrs.add(attrNameOnly);
          outputLines.push(`        ${normalizedAttr}`);
        }
      }
      continue;
    }

    // Relationships: ENTITY_A ||--o{ ENTITY_B : "description"
    const relMatch = line.match(/^(\S+)\s+([|{}o\-]+)\s+(\S+)\s*(?::\s*(.*))?$/);
    if (relMatch) {
      const [, rawSrc, rawCard, rawTgt, rawDesc] = relMatch;
      const src = toSafeIdentifier(rawSrc, 'ENT').toUpperCase();
      const tgt = toSafeIdentifier(rawTgt, 'ENT').toUpperCase();

      // Deduplicate relationships and inverse duplicates
      const pairKey1 = `${src}__${tgt}`;
      const pairKey2 = `${tgt}__${src}`;
      if (seenEREdges.has(pairKey1) || seenEREdges.has(pairKey2)) {
        continue;
      }
      seenEREdges.add(pairKey1);

      knownEntities.add(src);
      knownEntities.add(tgt);

      // Normalize cardinality
      const cleanCard = rawCard.replace(/\s+/g, '');
      const card = CARD_MAP[cleanCard] || '||--o{';

      let desc = (rawDesc || 'relaciona').replace(/^["']|["']$/g, '').trim();
      desc = toSafeLabel(desc || 'relaciona', 80);

      outputLines.push(`    ${src} ${card} ${tgt} : "${desc}"`);
      continue;
    }
  }

  // If a block was left open, close it
  if (inEntityBlock) {
    outputLines.push('    }');
  }

  // Connect isolated ER entities if any exist to guarantee clean connected graphs
  const definedEntities = new Set();
  const connectedEntities = new Set();

  for (const l of outputLines) {
    const em = l.match(/^\s*([A-Za-z0-9_]+)\s*\{/);
    if (em) definedEntities.add(em[1]);

    const rm = l.match(/^\s*([A-Za-z0-9_]+)\s+([|{}o\-]+)\s+([A-Za-z0-9_]+)/);
    if (rm) {
      connectedEntities.add(rm[1]);
      connectedEntities.add(rm[3]);
    }
  }

  const possibleERHubs = ['ORDEN_TRABAJO', 'COTIZACION', 'VEHICULO', 'DIAGNOSTICO', 'USUARIO'];
  const defaultERHub = possibleERHubs.find(h => definedEntities.has(h)) || Array.from(definedEntities)[0];

  if (defaultERHub) {
    for (const ent of definedEntities) {
      if (!connectedEntities.has(ent) && ent !== defaultERHub) {
        if (/SERVICIO/i.test(ent)) {
          const targetHub = definedEntities.has('ORDEN_TRABAJO') ? 'ORDEN_TRABAJO' : (definedEntities.has('COTIZACION') ? 'COTIZACION' : defaultERHub);
          outputLines.push(`    ${targetHub} ||--o{ ${ent} : "incluye"`);
        } else if (/BASE_CONOCIMIENTO|CODIGO_OBD/i.test(ent)) {
          const targetHub = definedEntities.has('DIAGNOSTICO') ? 'DIAGNOSTICO' : defaultERHub;
          outputLines.push(`    ${targetHub} }o--o{ ${ent} : "consulta"`);
        } else if (/MANTENIMIENTO/i.test(ent) && definedEntities.has('VEHICULO')) {
          outputLines.push(`    VEHICULO ||--o{ ${ent} : "programa"`);
        } else if (/NOTIFICACION|AUDITORIA/i.test(ent) && definedEntities.has('USUARIO')) {
          outputLines.push(`    USUARIO ||--o{ ${ent} : "genera"`);
        } else {
          outputLines.push(`    ${defaultERHub} ||--o{ ${ent} : "relaciona"`);
        }
        connectedEntities.add(ent);
      }
    }
  }

  // Ensure every entity mentioned in relationships has an attribute block with PK
  const declaredBlockEntities = new Set();
  for (const l of outputLines) {
    const em = l.match(/^\s*([A-Za-z0-9_]+)\s*\{/);
    if (em) declaredBlockEntities.add(em[1]);
  }

  const synthesizedBlocks = [];
  for (const ent of knownEntities) {
    if (!declaredBlockEntities.has(ent)) {
      const attrs = ER_DEFAULT_ATTRIBUTES[ent] || [
        'int id PK',
        'string nombre',
        'string estado',
        'datetime fecha_creacion'
      ];
      synthesizedBlocks.push(`    ${ent} {\n${attrs.map(a => `        ${a}`).join('\n')}\n    }`);
      declaredBlockEntities.add(ent);
    }
  }

  if (synthesizedBlocks.length > 0) {
    outputLines.splice(1, 0, ...synthesizedBlocks);
  }

    return outputLines.join('\n');
}

/**
 * Splits lines with concatenated attributes like:
 * "string código PK string categoría" or "int id PK string nombre"
 */
function splitConcatenatedAttributes(line) {
  if (!line || !line.trim()) return [];

  // Common attribute type keywords to detect boundaries
  const typePattern = /(?:^|\s+)((?:string|int|float|boolean|date|datetime|decimal|text|uuid|varchar|number|entero|fecha|precio|id)(?:\([0-9]+\))?)\s+/gi;
  const matches = [...line.matchAll(typePattern)];

  if (matches.length <= 1) {
    return [line.trim()];
  }

  const chunks = [];
  for (let i = 0; i < matches.length; i++) {
    const startIndex = matches[i].index;
    const endIndex = i + 1 < matches.length ? matches[i + 1].index : line.length;
    const chunk = line.slice(startIndex, endIndex).trim();
    if (chunk) chunks.push(chunk);
  }

  return chunks.length > 0 ? chunks : [line.trim()];
}

/**
 * Normalizes a single attribute line inside an ER block.
 * Strips accents from attribute names and types:
 * e.g. "string código PK" -> "string codigo PK"
 */
function normalizeAttributeLine(chunk) {
  if (!chunk) return null;
  const parts = chunk.trim().split(/\s+/);
  if (parts.length < 2) {
    // Only one token provided: treat as "string <token>"
    const name = toSafeIdentifier(parts[0], 'attr');
    return `string ${name}`;
  }

  const rawType = parts[0];
  const rawName = parts[1];
  const remaining = parts.slice(2).join(' ').toUpperCase();

  const safeType = normalizeDataType(rawType);
  const safeName = toSafeIdentifier(rawName, 'attr').toLowerCase();

  let keyTag = '';
  if (remaining.includes('PK')) keyTag = ' PK';
  else if (remaining.includes('FK')) keyTag = ' FK';
  else if (remaining.includes('UK')) keyTag = ' UK';

  return `${safeType} ${safeName}${keyTag}`;
}

/**
 * Normalizes Class diagrams (classDiagram).
 */
function normalizeClass(code) {
  if (!code || typeof code !== 'string') return 'classDiagram\n';

  const lines = code.split('\n');
  const output = ['classDiagram'];
  let inClass = false;
  const seenClassEdges = new Set();
  const seenClassAttrs = new Set();
  const BANNED_GENERIC_METHODS = new Set(['getid', 'setid', 'validarreglas', 'todto', 'to_dto', 'get_id']);

  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line || /^classdiagram/i.test(line)) continue;

    // Class definition: class ClassName {
    const classMatch = line.match(/^class\s+([a-zA-Z0-9_\u00C0-\u017F\s-]+)\s*\{?$/i);
    if (classMatch && !line.includes('-->') && !line.includes('--|>') && !line.includes('o--') && !line.includes('*--')) {
      const rawName = classMatch[1].trim();
      const safeName = toSafeIdentifier(rawName, 'Class');
      const pascalName = safeName.charAt(0).toUpperCase() + safeName.slice(1);
      output.push(`  class ${pascalName} {`);
      inClass = true;
      seenClassAttrs.clear();
      continue;
    }

    if (inClass && line === '}') {
      output.push('  }');
      inClass = false;
      continue;
    }

    if (inClass) {
      // Handle comma-separated attributes on a single line (e.g. "+int id, +string nombre")
      const subItems = line.includes('(') ? [line] : line.split(/[,;]/).map(s => s.trim()).filter(Boolean);

      for (const item of subItems) {
        let vis = '+';
        let rest = item;
        if (/^[+\-#~]/.test(item)) {
          vis = item[0];
          rest = item.slice(1).trim();
        }

        // Check if method (either prefix returnType "void registrar()" or UML suffix "registrar() void")
        if (rest.includes('(')) {
          const prefixMatch = rest.match(/^([a-zA-Z0-9_<>[\]]+)\s+([a-zA-Z0-9_\u00C0-\u017F]+)\s*\((.*?)\)\s*$/);
          if (prefixMatch) {
            const rawRet = prefixMatch[1].trim();
            let rawMethodName = prefixMatch[2].trim();
            let params = prefixMatch[3].trim();
            const suffixParamMatch = rawMethodName.match(/^([a-zA-Z0-9]+)_(string|int|float|boolean|datetime|date|list)$/i);
            if (suffixParamMatch && !params) {
              rawMethodName = suffixParamMatch[1];
              params = `${suffixParamMatch[2].toLowerCase()} valor`;
            }
            if (BANNED_GENERIC_METHODS.has(rawMethodName.toLowerCase())) continue;
            const methodName = toSafeIdentifier(rawMethodName, 'method');
            const retType = toSafeIdentifier(rawRet || 'void', 'type');
            output.push(`    ${vis}${methodName}(${params}) ${retType}`);
            continue;
          }

          const suffixMatch = rest.match(/^([a-zA-Z0-9_\u00C0-\u017F]+)\s*\((.*?)\)\s*(.*)$/);
          if (suffixMatch) {
            let rawMethodName = suffixMatch[1].trim();
            let params = suffixMatch[2].trim();
            const suffixParamMatch = rawMethodName.match(/^([a-zA-Z0-9]+)_(string|int|float|boolean|datetime|date|list)$/i);
            if (suffixParamMatch && !params) {
              rawMethodName = suffixParamMatch[1];
              params = `${suffixParamMatch[2].toLowerCase()} valor`;
            }
            if (BANNED_GENERIC_METHODS.has(rawMethodName.toLowerCase())) continue;
            const methodName = toSafeIdentifier(rawMethodName, 'method');
            const retType = toSafeIdentifier(suffixMatch[3] || 'void', 'type');
            output.push(`    ${vis}${methodName}(${params}) ${retType}`);
            continue;
          }
        }

        // Attribute: Type name (or recovering methods that lost parentheses like "void registrar" or "boolean autenticar_string")
        const attrParts = rest.split(/\s+/);
        if (attrParts.length >= 2) {
          const isVoidPrefix = attrParts[0].toLowerCase() === 'void';
          const isVerbMethod = /^(?:autenticar|recuperar|verificar|consultar|buscar|calcular|evaluar|solicitar|reprogramar|cancelar|confirmar|registrar|generar|iniciar|finalizar|clasificar|asociar|aplicar|actualizar|aprobar|rechazar|autorizar|desestimar|asignar|completar|reversar|emitir|procesar|configurar|enviar|marcar|cambiar|consolidar|examinar|identificar|adjuntar|ingresar|atender|programar)/i.test(attrParts[1]);

          if (isVoidPrefix || isVerbMethod) {
            let rawMethodName = attrParts[1];
            let retType = isVoidPrefix ? 'void' : normalizeDataType(attrParts[0]);
            let params = '';

            const suffixParamMatch = rawMethodName.match(/^([a-zA-Z0-9]+)_(string|int|float|boolean|datetime|date|list)$/i);
            if (suffixParamMatch) {
              rawMethodName = suffixParamMatch[1];
              params = `${suffixParamMatch[2].toLowerCase()} valor`;
            }

            const methodName = toSafeIdentifier(rawMethodName, 'method');
            if (!BANNED_GENERIC_METHODS.has(methodName.toLowerCase())) {
              output.push(`    ${vis}${methodName}(${params}) ${retType}`);
              continue;
            }
          }

          const type = normalizeDataType(attrParts[0]);
          const name = toSafeIdentifier(attrParts[1], 'attr');
          if (seenClassAttrs.has(name.toLowerCase())) continue;
          seenClassAttrs.add(name.toLowerCase());
          output.push(`    ${vis}${type} ${name}`);
        } else if (attrParts.length === 1) {
          const isSingleVerb = /^(?:autenticar|recuperar|verificar|consultar|buscar|calcular|evaluar|solicitar|reprogramar|cancelar|confirmar|registrar|generar|iniciar|finalizar|clasificar|asociar|aplicar|actualizar|aprobar|rechazar|autorizar|desestimar|asignar|completar|reversar|emitir|procesar|configurar|enviar|marcar|cambiar|consolidar|examinar|identificar|adjuntar|ingresar|atender|programar)/i.test(attrParts[0]);
          if (isSingleVerb) {
            let rawMethodName = attrParts[0];
            let params = '';
            const suffixParamMatch = rawMethodName.match(/^([a-zA-Z0-9]+)_(string|int|float|boolean|datetime|date|list)$/i);
            if (suffixParamMatch) {
              rawMethodName = suffixParamMatch[1];
              params = `${suffixParamMatch[2].toLowerCase()} valor`;
            }
            const methodName = toSafeIdentifier(rawMethodName, 'method');
            if (!BANNED_GENERIC_METHODS.has(methodName.toLowerCase())) {
              output.push(`    ${vis}${methodName}(${params}) void`);
              continue;
            }
          }
          const name = toSafeIdentifier(attrParts[0], 'attr');
          if (seenClassAttrs.has(name.toLowerCase())) continue;
          seenClassAttrs.add(name.toLowerCase());
          output.push(`    ${vis}string ${name}`);
        }
      }
      continue;
    }

    // Outside class: relationships (associations, inheritance, composition)
    // ClassA --|> ClassB
    // ClassA *-- ClassB
    // ClassA o-- ClassB
    // ClassA --> ClassB
    const relMatch = line.match(/^(\S+)\s+(?:"([^"]*)"\s+)?(<\|--|--\|>|<\|\.\.|\.\.\|>|\*--|--\*|o--|--o|<--|-->|\.\.>|<\.\.|--|\.\.)\s+(?:"([^"]*)"\s+)?([^\s:]+)(?:\s*:\s*(.*))?$/);
    if (relMatch) {
      const [, rawA, leftMultiplicity, relOp, rightMultiplicity, rawB, rawDesc] = relMatch;
      const classA = toSafeIdentifier(rawA, 'Class');
      const classB = toSafeIdentifier(rawB, 'Class');

      // Section 32: Detect and prevent duplicate or reverse duplicate edges (e.g. A o-- B AND B o-- A)
      const edgeKey1 = `${classA}__${classB}`;
      const edgeKey2 = `${classB}__${classA}`;
      if (seenClassEdges.has(edgeKey1) || seenClassEdges.has(edgeKey2)) {
        continue;
      }
      seenClassEdges.add(edgeKey1);

      const desc = rawDesc ? `: ${toSafeLabel(rawDesc, 60)}` : '';
      output.push(`  ${classA} ${leftMultiplicity!==undefined?'"'+toSafeLabel(leftMultiplicity,20)+'" ':''}${relOp} ${rightMultiplicity!==undefined?'"'+toSafeLabel(rightMultiplicity,20)+'" ':''}${classB} ${desc}`.trim());
      continue;
    }

    output.push(`  ${line}`);
  }

  if (inClass) output.push('  }');

  // Connect isolated classes if any exist to guarantee clean connected graphs
  const definedClasses = new Set();
  const relatedClasses = new Set();

  for (const l of output) {
    const cm = l.match(/^\s*class\s+([a-zA-Z0-9_]+)\s*\{/);
    if (cm) definedClasses.add(cm[1]);

    const rm = l.match(/^\s*([A-Za-z0-9_]+)\s*(?:(?:"[^"]*")?\s*)?(?:-->|<--|--|\.\.|\*--|o--|--\|>|<\|--)\s*(?:(?:"[^"]*")?\s*)?([A-Za-z0-9_]+)/);
    if (rm) {
      relatedClasses.add(rm[1]);
      relatedClasses.add(rm[2]);
    }
  }

  const possibleHubs = ['OrdenTrabajo', 'Cotizacion', 'Vehiculo', 'Diagnostico', 'Usuario', 'BaseConocimiento'];
  const defaultHub = possibleHubs.find(h => definedClasses.has(h)) || Array.from(definedClasses)[0];

  if (defaultHub) {
    for (const c of definedClasses) {
      if (!relatedClasses.has(c) && c !== defaultHub) {
        if (/codigoobd|soluciontecnica|articulo/i.test(c) && definedClasses.has('BaseConocimiento')) {
          output.push(`  BaseConocimiento "1" *-- "0..*" ${c} : agrupa`);
        } else if (/baseconocimiento/i.test(c) && definedClasses.has('Diagnostico')) {
          output.push(`  Diagnostico "0..*" --> "0..*" ${c} : consulta`);
        } else if (/zonavehiculo/i.test(c) && definedClasses.has('InspeccionVisual')) {
          output.push(`  InspeccionVisual "1" *-- "1..*" ${c} : examina`);
        } else if (/inspeccionvisual/i.test(c) && definedClasses.has('RecepcionVehiculo')) {
          output.push(`  RecepcionVehiculo "1" *-- "1" ${c} : incluye`);
        } else if (/evidenciamultimedia/i.test(c) && definedClasses.has('Diagnostico')) {
          output.push(`  Diagnostico "1" o-- "0..*" ${c} : documenta`);
        } else if (/detallecotizacion/i.test(c) && definedClasses.has('Cotizacion')) {
          output.push(`  Cotizacion "1" *-- "1..*" ${c} : compone`);
        } else if (/actividadorden|asignacionmecanico|pruebareparacion/i.test(c) && definedClasses.has('OrdenTrabajo')) {
          output.push(`  OrdenTrabajo "1" *-- "1..*" ${c} : desglosa`);
        } else if (/detalleventa/i.test(c) && definedClasses.has('VentaDirecta')) {
          output.push(`  VentaDirecta "1" *-- "1..*" ${c} : desglosa`);
        } else if (/detallecompra/i.test(c) && definedClasses.has('Compra')) {
          output.push(`  Compra "1" *-- "1..*" ${c} : detalla`);
        } else if (/alertamantenimiento/i.test(c) && definedClasses.has('MantenimientoPreventivo')) {
          output.push(`  MantenimientoPreventivo "1" --> "0..*" ${c} : dispara`);
        } else if (/expedientedigital/i.test(c) && definedClasses.has('Vehiculo')) {
          output.push(`  Vehiculo "1" *-- "1" ${c} : consolida`);
        } else if (/permiso/i.test(c) && definedClasses.has('Rol')) {
          output.push(`  Rol "1" *-- "1..*" ${c} : define`);
        } else if (/falla/i.test(c) && definedClasses.has('Diagnostico')) {
          output.push(`  Diagnostico "1" *-- "1..*" ${c} : identifica`);
        } else if (/servicio/i.test(c)) {
          const targetHub = definedClasses.has('OrdenTrabajo') ? 'OrdenTrabajo' : (definedClasses.has('Cotizacion') ? 'Cotizacion' : defaultHub);
          output.push(`  ${targetHub} "1" -- "0..*" ${c} : incluye`);
        } else if (/movimiento|stock|inventario/i.test(c) && definedClasses.has('Repuesto')) {
          output.push(`  Repuesto "1" -- "0..*" ${c} : registra`);
        } else if (/notificacion|auditoria/i.test(c) && definedClasses.has('Usuario')) {
          output.push(`  Usuario "1" -- "0..*" ${c} : genera`);
        } else {
          output.push(`  ${defaultHub} "1" -- "0..*" ${c} : relaciona`);
        }
        relatedClasses.add(c);
      }
    }
  }

  return output.join('\n');
}

/**
 * Normalizes Process Flow diagrams (flowchart TD).
 * Ensures start, process, decision branches, and safe node IDs (prevents 'end' keyword bug).
 */
function normalizeFlowchart(code) {
  if (!code || typeof code !== 'string') {
    return 'flowchart TD\n  START([Inicio]) --> FIN([Fin])\n';
  }

  const rawLines = code.split('\n');
  const output = ['flowchart TD'];

  for (let rawLine of rawLines) {
    let line = rawLine.trim();
    if (!line) continue;
    if (/^(flowchart|graph)\s+/i.test(line)) continue;

    // Fix forbidden node id 'end' (Mermaid reserved word)
    // e.g. "end[Fin]" -> "NODE_END[Fin]" or "end([Fin])" -> "NODE_END([Fin])"
    line = line.replace(/\bend(?=\s*\[|\s*\()(?!\s*-->)/gi, 'NODE_END');
    line = line.replace(/(?:-->|---\s*)\s*end\b/gi, '--> NODE_END');
    line = line.replace(/\bend\s*(?:-->|---)/gi, 'NODE_END -->');

    // Fix forbidden node id 'inicio' -> 'NODE_START'
    line = line.replace(/\binicio(?=\s*\[|\s*\()/gi, 'NODE_START');

    // Sanitize quotes in labels
    // e.g. ["Texto con "comillas" internas"]
    line = line.replace(/\["([^"]*)"\]/g, (match, inner) => `["${toSafeLabel(inner)}"]`);

    output.push(`  ${line}`);
  }

  return output.join('\n');
}

/**
 * Normalizes Use Case diagram (flowchart LR).
 */
function normalizeUseCase(code) {
  if (!code || typeof code !== 'string') return 'flowchart LR\n';

  const rawLines = code.split('\n');
  const output = ['flowchart LR'];

  for (let rawLine of rawLines) {
    let line = rawLine.trim();
    if (!line) continue;
    if (/^(flowchart|graph)\s+/i.test(line)) continue;

    // Node definitions: ACT_1(("Actor")), UC_1(["Use Case"])
    output.push(`  ${line}`);
  }

  return output.join('\n');
}

/**
 * Normalizes Navigation Tree (flowchart TD with hierarchical parent->child structure).
 */
function normalizeNavigation(code) {
  if (!code || typeof code !== 'string') return 'flowchart TD\n';

  const rawLines = code.split('\n');
  const output = ['flowchart TD'];

  for (let rawLine of rawLines) {
    let line = rawLine.trim();
    if (!line) continue;
    if (/^(flowchart|graph)\s+/i.test(line)) continue;

    output.push(`  ${line}`);
  }

  return output.join('\n');
}

/**
 * Normalizes Architecture diagram (flowchart LR or flowchart TB).
 */
function normalizeArchitecture(code) {
  if (!code || typeof code !== 'string') return 'flowchart LR\n';

  const rawLines = code.split('\n');
  const firstHeader = rawLines.find(l => /^(flowchart|graph)\s+/i.test(l.trim()));
  const header = firstHeader ? firstHeader.trim() : 'flowchart LR';
  const output = [header];

  let subgraphCount = 0;
  let endCount = 0;

  for (let rawLine of rawLines) {
    let line = rawLine.trim();
    if (!line) continue;
    if (/^(flowchart|graph)\s+/i.test(line)) continue;

    if (/^subgraph\s+/i.test(line)) subgraphCount++;
    if (/^end$/i.test(line)) endCount++;

    output.push(`  ${line}`);
  }

  // Balance subgraphs if any end was missing
  while (endCount < subgraphCount) {
    output.push('  end');
    endCount++;
  }

  return output.join('\n');
}

/**
 * Main dispatcher to normalize any Mermaid code based on diagram type.
 */
function normalize(code, diagramType) {
  if (!code) return '';

  switch (diagramType) {
    case 'ER':
      return normalizeER(code);
    case 'CLASS':
      return normalizeClass(code);
    case 'FLOWCHART':
      return normalizeFlowchart(code);
    case 'USE_CASE':
      return normalizeUseCase(code);
    case 'NAVIGATION':
      return normalizeNavigation(code);
    case 'ARCHITECTURE':
      return normalizeArchitecture(code);
    default:
      return code.trim();
  }
}

module.exports = {
  stripAccents,
  toSafeIdentifier,
  normalizeDataType,
  toSafeLabel,
  normalizeER,
  normalizeClass,
  normalizeFlowchart,
  normalizeUseCase,
  normalizeNavigation,
  normalizeArchitecture,
  normalize
};
