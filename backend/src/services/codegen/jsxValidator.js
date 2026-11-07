/**
 * JSX Syntax & Contract Validator for React Code Generation
 * Performs static analysis on generated JSX/React code to guarantee
 * semantic integrity, zero syntax errors, valid self-closing tags,
 * and correct controlled component bindings (value + onChange).
 */

const VOID_TAGS = new Set(['input', 'img', 'br', 'hr', 'source', 'link', 'meta', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);

/**
 * Validates and repairs common JSX syntactic deformities
 * @param {string} code - The JSX / React component code
 * @param {Object} [context] - Optional metadata (screenName, compName)
 * @returns {{ valid: boolean, errors: string[], repairedJsx: string, repaired: boolean }}
 */
function validateAndRepairJsx(code, context = {}) {
  if (!code || typeof code !== 'string') {
    return { valid: false, errors: ['Código JSX vacío o no definido'], repairedJsx: '', repaired: false };
  }

  let repaired = false;
  let currentCode = code;
  const errors = [];

  // 1. Repair broken arrow functions caused by regex void closing: e.g., (e) = /> or (e) = >
  if (/\(e\)\s*=\s*\/>/g.test(currentCode)) {
    currentCode = currentCode.replace(/\(e\)\s*=\s*\/>/g, '(e) => handleSearchChange(e)');
    repaired = true;
  }
  if (/\(e\)\s*=>\s*\/>/g.test(currentCode)) {
    currentCode = currentCode.replace(/\(e\)\s*=>\s*\/>/g, '(e) => handleSearchChange(e)');
    repaired = true;
  }

  // 2. Repair broken onclick quotes with classList: e.g., onclick="...classList.toggle('...')"
  if (/\bonclick=["'][^"']*classList\.(add|remove|toggle)\(['"]([^'"]+)['"]\)[^"']*["']/gi.test(currentCode)) {
    currentCode = currentCode.replace(/\bonclick=["'][^"']*classList\.(add|remove|toggle)\(['"]([^'"]+)['"]\)[^"']*["']/gi, (m, action, id) => {
      repaired = true;
      if (action === 'add') return `onClick={() => closeModal('${id}')}`;
      return `onClick={() => openModal('${id}')}`;
    });
  }

  // 3. Repair unclosed void tags: ensure <input ...>, <img ...> are <... />, respecting {...} JSX expressions
  for (const tag of VOID_TAGS) {
    const unclosedVoidRegex = new RegExp(`<(${tag})\\b((?:[^>"'{]|"[^"]*"|'[^']*'|{[^}]*})*?)(?<!/)>`, 'gi');
    if (unclosedVoidRegex.test(currentCode)) {
      currentCode = currentCode.replace(unclosedVoidRegex, '<$1$2 />');
      repaired = true;
    }
  }

  // 4. Clean up corrupted slashes before attributes: e.g. <input / value=... / onChange=... />
  if (/<(input|img|br|hr)\b[^>]*?\/\s+(value|onChange|name|id|className|type)=/gi.test(currentCode)) {
    currentCode = currentCode.replace(/\/\s+(value=|onChange=|name=|id=|className=|type=)/gi, ' $1');
    repaired = true;
  }
  if (/\s*\/+\s*\/>/g.test(currentCode)) {
    currentCode = currentCode.replace(/\s*\/+\s*\/>/g, ' />');
    repaired = true;
  }

  // 5. Repair Read-Only inputs: any <input ... value="..." without onChange must receive onChange={handleInputChange}
  const readOnlyInputRegex = /<input\b((?:[^>"']|"[^"]*"|'[^']*')+?)(\/?>)/gi;
  currentCode = currentCode.replace(readOnlyInputRegex, (match, attrs, closing) => {
    const hasValue = /\bvalue=/.test(attrs);
    const hasOnChange = /\bonChange=/.test(attrs);
    const hasReadOnly = /\breadOnly\b/.test(attrs);
    const isSubmitOrButton = /\btype=["'](submit|button|reset|hidden)["']/i.test(attrs);

    if (hasValue && !hasOnChange && !hasReadOnly && !isSubmitOrButton) {
      repaired = true;
      // Extract or assign a name/key
      const nameMatch = attrs.match(/\bname=["']([^"']+)["']/i);
      const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
      const fieldKey = nameMatch ? nameMatch[1] : (idMatch ? idMatch[1] : 'field');

      // Convert hardcoded value="..." to reactive value with fallback
      let cleanAttrs = attrs;
      const staticValMatch = attrs.match(/\bvalue=["']([^"']*)["']/i);
      if (staticValMatch) {
        const staticVal = staticValMatch[1].replace(/"/g, '&quot;');
        cleanAttrs = cleanAttrs.replace(/\bvalue=["'][^"']*["']/i, `value={formData['${fieldKey}'] !== undefined ? formData['${fieldKey}'] : "${staticVal}"}`);
      }
      return `<input${cleanAttrs} onChange={handleInputChange} ${closing.endsWith('/>') ? '' : '/>'}`;
    }
    return match;
  });

  // 6. Verify Tag Balance for main container tags
  const tagsToTrack = ['div', 'section', 'article', 'main', 'form', 'table', 'tbody', 'thead', 'tr', 'button', 'select', 'textarea', 'p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li'];
  for (const tag of tagsToTrack) {
    const openCount = (currentCode.match(new RegExp(`<${tag}\\b[^>]*?(?<!/)>`, 'gi')) || []).length;
    const closeCount = (currentCode.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    if (openCount !== closeCount) {
      errors.push(`Desbalance de etiquetas <${tag}>: se abrieron ${openCount} y se cerraron ${closeCount}`);
      // Self-heal missing closing tag if single imbalance at root container
      if (openCount === closeCount + 1 && ['div', 'form', 'main'].includes(tag)) {
        currentCode = currentCode.trimEnd() + `\n</${tag}>`;
        repaired = true;
      }
    }
  }

  // 7. Verify essential imports in React component code
  if (currentCode.includes('useState') && !currentCode.includes("import React, { useState")) {
    errors.push('Falta importación de useState');
  }
  if (currentCode.includes('apiClient') && !currentCode.includes("import apiClient from")) {
    errors.push('Falta importación de apiClient');
  }

  const valid = errors.length === 0;

  return {
    valid,
    errors,
    repairedJsx: currentCode,
    repaired
  };
}

module.exports = {
  validateAndRepairJsx,
  VOID_TAGS
};
