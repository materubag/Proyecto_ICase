const JSON5 = require('json5');
const crypto = require('crypto');

function visualId(html) {
  return 'screen-' + crypto.createHash('sha256').update(html || '').digest('hex').slice(0, 12);
}

function extractVisualContract(html = '') {
  const errors = [];
  let config = {};
  // JSON5 accepts object literals, comments and trailing commas, but never calls,
  // functions, assignments or access to the host environment.
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const assignment = match[1].match(/^\s*(?:\/\*[\s\S]*?\*\/\s*)?tailwind\.config\s*=\s*([\s\S]*?)\s*;?\s*$/);
    if (!assignment) {
      if (/tailwind\.config/.test(match[1])) errors.push('UNRESOLVED_VISUAL_CONFIG: configuración no declarativa.');
      continue;
    }
    try {
      const parsed = JSON5.parse(assignment[1].replace(/;\s*$/, ''));
      const safe = value => {
        if (Array.isArray(value)) return value.every(safe);
        if (value && typeof value === 'object') return Object.entries(value).every(([key, item]) => !['__proto__', 'constructor', 'prototype'].includes(key) && safe(item));
        return ['string', 'number', 'boolean'].includes(typeof value) || value === null;
      };
      if (!safe(parsed)) throw new Error('Invalid data');
      config = { theme: parsed.theme || {}, darkMode: parsed.darkMode === 'class' ? 'class' : 'media' };
    } catch (_) { errors.push('UNRESOLVED_VISUAL_CONFIG: el tema contiene expresiones o datos inválidos.'); }
  }
  const fonts = [...html.matchAll(/<link\b[^>]*href=["'](https:\/\/fonts\.googleapis\.com\/[^"']+)["'][^>]*>/gi)].map(match => match[1].replace(/&amp;/g, '&'));
  return { id: visualId(html), config, fonts: [...new Set(fonts)], errors };
}

module.exports = { visualId, extractVisualContract };
