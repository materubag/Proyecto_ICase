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
      // Attribute or method inside class
      // Visibility symbol
      let vis = '+';
      let rest = line;
      if (/^[+\-#~]/.test(line)) {
        vis = line[0];
        rest = line.slice(1).trim();
      }

      // Check if method: methodName() returnType
      const methodMatch = rest.match(/^([a-zA-Z0-9_\u00C0-\u017F]+)\s*\((.*?)\)\s*(.*)$/);
      if (methodMatch) {
        const rawMethodName = methodMatch[1].trim();
        // Section 21: DO NOT invent generic methods like getId(), toDTO(), validarReglas()
        if (BANNED_GENERIC_METHODS.has(rawMethodName.toLowerCase())) {
          continue;
        }
        const methodName = toSafeIdentifier(rawMethodName, 'method');
        const params = methodMatch[2].trim();
        const retType = toSafeIdentifier(methodMatch[3] || 'void', 'type');
        output.push(`    ${vis}${methodName}(${params}) ${retType}`);
        continue;
      }

      // Attribute: Type name
      const attrParts = rest.split(/\s+/);
      if (attrParts.length >= 2) {
        const type = normalizeDataType(attrParts[0]);
        const name = toSafeIdentifier(attrParts[1], 'attr');
        if (seenClassAttrs.has(name.toLowerCase())) continue; // Deduplicate
        seenClassAttrs.add(name.toLowerCase());
        output.push(`    ${vis}${type} ${name}`);
      } else if (attrParts.length === 1) {
        const name = toSafeIdentifier(attrParts[0], 'attr');
        if (seenClassAttrs.has(name.toLowerCase())) continue; // Deduplicate
        seenClassAttrs.add(name.toLowerCase());
        output.push(`    ${vis}string ${name}`);
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
 * Normalizes Architecture diagram (flowchart TB).
 */
function normalizeArchitecture(code) {
  if (!code || typeof code !== 'string') return 'flowchart TB\n';

  const rawLines = code.split('\n');
  const output = ['flowchart TB'];

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
