function auditScreenBindings(screen) {
  if (!screen.html || screen.contract?.renderer !== 'task') return { missingFields: [], unboundControls: 0, missingPrimaryAction: false };
  const { convertHtmlToJsx } = require('./mockupConverter');
  const jsx = convertHtmlToJsx(screen.html, 'Audit', screen.route, screen.targetEntity, { screenContract: screen.contract });
  const hasFormSlot = jsx.includes('{slots.form}');
  const controls = [];
  const openings = /<(input|select|textarea|button|a)\b/g;
  let match;
  while ((match = openings.exec(jsx))) {
    let quote = null, depth = 0, end = openings.lastIndex;
    for (; end < jsx.length; end++) {
      const c = jsx[end];
      if (quote) { if (c === '\\') end++; else if (c === quote) quote = null; }
      else if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    const attrs = jsx.slice(openings.lastIndex, end);
    const state = /data-unresolved-control/.test(attrs) ? 'UNRESOLVED'
      : /data-decorative/.test(attrs) ? 'DECORATIVE'
        : /onChange=|onClick=|href="https?:/.test(attrs) ? 'BOUND' : 'UNRESOLVED';
    controls.push({ id: `${match[1]}-${controls.length + 1}`, tag: match[1], state,
      field: attrs.match(/(?:data-field|name)=\{?["']([^"']+)/)?.[1] || null,
      actionId: attrs.match(/data-action-id=["']([^"']+)/)?.[1] || null });
    openings.lastIndex = end + 1;
  }
  const missingFields = hasFormSlot ? [] : (screen.contract.fields || []).filter(field => field.mode === 'editable' && field.control !== 'hidden' && !field.isPk)
    .filter(field => !jsx.includes('slots.setField(' + JSON.stringify(field.fieldName)) && !jsx.includes('slots.updateFiles(' + JSON.stringify(field.fieldName)))
    .map(field => field.fieldName);
  return {
    controls,
    unboundDataRegions: (jsx.match(/data-unresolved-display=/g) || []).length,
    missingFields,
    unboundControls: (jsx.match(/data-unresolved-control=/g) || []).length,
    missingPrimaryAction: !hasFormSlot && Boolean(screen.contract.primaryActionId) && screen.contract.actions?.find(a => a.actionId === screen.contract.primaryActionId)?.method !== 'GET' && !jsx.includes('slots.submit') && !jsx.includes('slots.execute(' + JSON.stringify(screen.contract.primaryActionId))
  };
}
module.exports = { auditScreenBindings };
