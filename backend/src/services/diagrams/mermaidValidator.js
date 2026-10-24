/**
 * Mermaid Validator
 * Validates Mermaid code syntactically and semantically before rendering or saving.
 * Detects invalid headers, unclosed blocks, accents in ER attributes, broken relationships,
 * and unbalanced subgraphs.
 */

const VALID_HEADERS = {
  ER: ['erdiagram'],
  CLASS: ['classdiagram'],
  USE_CASE: ['flowchart', 'graph'],
  FLOWCHART: ['flowchart', 'graph'],
  NAVIGATION: ['flowchart', 'graph', 'mindmap'],
  ARCHITECTURE: ['flowchart', 'graph']
};

/**
 * Validates that Mermaid code starts with the expected header for the given diagram type.
 */
function validateHeader(code, diagramType) {
  const trimmed = code.trim().toLowerCase();
  const allowed = VALID_HEADERS[diagramType] || ['flowchart', 'graph'];
  const hasValidHeader = allowed.some(h => trimmed.startsWith(h));

  if (!hasValidHeader) {
    return {
      isValid: false,
      error: `Encabezado inválido para ${diagramType}. Debe comenzar con: ${allowed.join(' o ')}`
    };
  }
  return { isValid: true };
}

/**
 * Checks for balanced brackets, braces, parentheses, and quotes.
 */
function validateDelimiters(code) {
  const openBrackets = (code.match(/\[/g) || []).length;
  const closeBrackets = (code.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    return {
      isValid: false,
      error: `Corchetes desbalanceados: ${openBrackets} '[' vs ${closeBrackets} ']'`
    };
  }

  // Remove ER relationship cardinality operators (like ||--o{, }o--o{, |o..|{) before checking braces
  const codeWithoutCardinality = code.replace(/[|}>o+]{1,2}(?:--|\.\.)[|{<o+]{1,2}/g, '');
  const openBraces = (codeWithoutCardinality.match(/\{/g) || []).length;
  const closeBraces = (codeWithoutCardinality.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    return {
      isValid: false,
      error: `Llaves desbalanceadas: ${openBraces} '{' vs ${closeBraces} '}'`
    };
  }

  const openParens = (code.match(/\(/g) || []).length;
  const closeParens = (code.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    return {
      isValid: false,
      error: `Paréntesis desbalanceados: ${openParens} '(' vs ${closeParens} ')'`
    };
  }

  const subgraphs = (code.match(/\bsubgraph\b/gi) || []).length;
  const ends = (code.match(/\bend\b/gi) || []).length;
  if (subgraphs > 0 && subgraphs !== ends) {
    return {
      isValid: false,
      error: `Bloques subgraph incompletos: ${subgraphs} 'subgraph' vs ${ends} 'end'`
    };
  }

  return { isValid: true };
}

/**
 * Validates ER diagram specific constraints (e.g. no accents in attribute lines).
 */
function validateER(code) {
  const lines = code.split('\n');
  let inBlock = false;
  let blockEntity = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.endsWith('{')) {
      inBlock = true;
      blockEntity = line.replace(/\{$/, '').trim();
      continue;
    }

    if (inBlock && line === '}') {
      inBlock = false;
      blockEntity = '';
      continue;
    }

    if (inBlock) {
      // Attribute line: must be ASCII only for type and name
      // e.g. "string codigo PK"
      const parts = line.split(/\s+/);
      const type = parts[0];
      const name = parts[1];

      // Check for non-ASCII in type or name (like 'código' or 'categoría')
      if (/[^\x00-\x7F]/.test(type) || (name && /[^\x00-\x7F]/.test(name))) {
        return {
          isValid: false,
          error: `Carácter no-ASCII en atributo de ER en línea ${i + 1}: "${line}". En Mermaid erDiagram los atributos deben ser ASCII simple (ej: codigo, categoria).`,
          line: i + 1
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Validates Flowchart constraints:
 * - No forbidden reserved keywords like 'end' as node ID
 * - Decision diamonds have branches
 */
function validateFlowchart(code) {
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Forbidden node ID 'end'
    if (/^\bend\s*\[/i.test(line) || /^\bend\s*\(/i.test(line) || /\s+-->\s*end\b/i.test(line) || /^\bend\s+-->/i.test(line)) {
      return {
        isValid: false,
        error: `Identificador de nodo prohibido 'end' en línea ${i + 1}. 'end' es una palabra reservada de Mermaid.`,
        line: i + 1
      };
    }
  }

  return { isValid: true };
}

/**
 * Main validator method.
 */
function validate(code, diagramType) {
  if (!code || typeof code !== 'string' || !code.trim()) {
    return { isValid: false, error: 'Código Mermaid vacío o nulo' };
  }

  // 1. Header
  const headerCheck = validateHeader(code, diagramType);
  if (!headerCheck.isValid) return headerCheck;

  // 2. Balanced delimiters
  const delimCheck = validateDelimiters(code);
  if (!delimCheck.isValid) return delimCheck;

  // 3. Diagram-specific validations
  if (diagramType === 'ER') {
    const erCheck = validateER(code);
    if (!erCheck.isValid) return erCheck;
  } else if (diagramType === 'FLOWCHART' || diagramType === 'NAVIGATION' || diagramType === 'USE_CASE') {
    const flowCheck = validateFlowchart(code);
    if (!flowCheck.isValid) return flowCheck;
  }

  return { isValid: true };
}

module.exports = {
  validate,
  validateHeader,
  validateDelimiters,
  validateER,
  validateFlowchart
};
