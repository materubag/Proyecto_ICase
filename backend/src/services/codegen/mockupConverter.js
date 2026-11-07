const { buildFieldContract, renderFields } = require('./screenContract');
/**
 * Mockup HTML to React JSX Converter & Functional Connector
 * Transforms Stitch HTML mockups into interactive, compilable React components
 * connected explicitly to real backend API operations with dynamic data binding,
 * real CRUD operations, state updates, loading/empty states, and error handling.
 */

const { toCamelCase } = require('./typeMapper');
const { validateAndRepairJsx } = require('./jsxValidator');

// A JSX attribute can contain `=>`, quoted `>` and nested object literals.
// HTML tag regexes stop in the middle of those attributes and corrupt handlers.
function replaceButtons(content, replace) {
  let result = '', cursor = 0;
  const opening = /<button\b/gi;
  let match;
  while ((match = opening.exec(content))) {
    const attrsStart = opening.lastIndex;
    let quote = null, braces = 0, end = attrsStart;
    for (; end < content.length; end++) {
      const char = content[end];
      if (quote) { if (char === '\\') end++; else if (char === quote) quote = null; }
      else if (char === '"' || char === "'" || char === '`') quote = char;
      else if (char === '{') braces++;
      else if (char === '}') braces--;
      else if (char === '>' && braces === 0) break;
    }
    const close = content.indexOf('</button>', end);
    if (close < 0) break;
    result += content.slice(cursor, match.index) + replace(content.slice(match.index, close + 9), content.slice(attrsStart, end), content.slice(end + 1, close));
    cursor = close + 9;
    opening.lastIndex = cursor;
  }
  return result + content.slice(cursor);
}

/**
 * Converts Stitch HTML into clean, functional React JSX with dynamic data binding
 * @param {string} htmlContent - Raw HTML from Stitch
 * @param {string} componentName - React component name
 * @param {string} route - Screen URL route
 * @param {string} entityName - Target entity name if any
 * @param {Object} [binding] - Optional approved mockup binding contract
 * @param {Array} [screensNav] - Optional list of screens for intra-mockup navigation
 * @returns {string} Converted JSX code
 */
function isChrome(block) {
  return /filtrar\s+vista\s+por\s+rol|control de acceso por roles|todos los roles\s*\(|vista\s+\d+\s+de\s+\d+/i.test(block || '');
}

function isSiteNavChrome(block) {
  if (isChrome(block)) return true;
  const text = String(block || '').replace(/<[^>]+>/g, ' ');
  const navHits = (text.match(/recepci[oó]n|diagn[oó]stico|veh[ií]culo|inventario|cliente|bit[aá]cora|repuesto|mostrador|bah[ií]as|cit[ae]s/gi) || []).length;
  const brand = /autron|\btaller\b|portal cliente/i.test(text);
  if (/vista\s+\d+\s+de\s+\d+/i.test(text)) return true;
  if (/\(\s*\/[a-z0-9\-_/]+\)/.test(text) && /taller|mec[aá]nica|administraci[oó]n/i.test(text)) return true;
  return brand && navHits >= 2;
}

function stripRolePreviewChrome(html) {
  if (!html) return html;
  let next = String(html);
  // Preserve the original navigation, header and side panels.
  next = next.replace(/<(p|span)\b[^>]*>[^<]*Vista\s+\d+\s+de\s+\d+[^<]*<\/\1>/gi, '');
  next = next.replace(/<select\b[^>]*>[\s\S]*?Todos los Roles[\s\S]*?<\/select>/gi, '');
  next = next.replace(/<[^>]*>\s*Filtrar Vista por Rol\s*<\/[^>]*>/gi, '');
  return next;
}

function extractStitchCss(html) {
  const chunks = [];
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = styleRe.exec(html || ''))) chunks.push(match[1]);
  return chunks.join('\n').replace(/<\/style>/gi, '').trim();
}

function convertHtmlToJsx(htmlContent, componentName, route, entityName = '', binding = null, screensNav = []) {
  if (!htmlContent) return '';
  const visual = require('./mockupVisualContract').extractVisualContract(htmlContent);
  const stitchCss = extractStitchCss(htmlContent);
  htmlContent = stripRolePreviewChrome(htmlContent);
  const controls = binding?.screenContract?.controlBindings || {};
  for (const tag of ['input', 'textarea', 'select', 'button']) {
    let index = 0;
    htmlContent = htmlContent.replace(new RegExp('<' + tag + '\\b', 'gi'), opening => {
      const position = index++;
      const control = (controls[tag] || []).find(item => item.index === position);
      return !control ? opening : opening
        + (control.field ? ' data-field="' + control.field + '"' : '')
        + (control.actionId ? ' data-action-id="' + control.actionId + '"' : '')
        + (control.label ? ' data-action-label="' + control.label + '"' : '')
        + (control.value !== undefined ? ' data-field-value="' + control.value + '"' : '');
    });
  }
  // Task screens render forms/tables through ContractTask slots. Binding those
  // inputs to formData here would crash: layout={slots => ...} has no formData.
  const isTaskLayout = binding?.screenContract?.renderer === 'task';

  let content = '';
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  content = bodyMatch ? bodyMatch[1] : htmlContent;

  // 2. Remove script tags and comments
  content = stripRolePreviewChrome(content);
  content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  content = content.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  content = content.replace(/<!--[\s\S]*?-->/g, '');

  // 4. Convert class to className and for to htmlFor
  content = content.replace(/\bclass="/g, 'className="');
  content = content.replace(/\bclass='/g, "className='");
  content = content.replace(/\bfor="/g, 'htmlFor="');
  content = content.replace(/\bfor='/g, "htmlFor='");

  // 5. HTML to JSX common attribute conversions
  content = content.replace(/\btabindex=/gi, 'tabIndex=');
  content = content.replace(/\bautocomplete=/gi, 'autoComplete=');
  content = content.replace(/\bautofocus=/gi, 'autoFocus=');
  content = content.replace(/\breadonly=/gi, 'readOnly=');
  content = content.replace(/\bmaxlength=/gi, 'maxLength=');
  content = content.replace(/\bminlength=/gi, 'minLength=');
  content = content.replace(/\bcolspan=/gi, 'colSpan=');
  content = content.replace(/\browspan=/gi, 'rowSpan=');

  // 6. Convert SVG attributes to camelCase
  content = content.replace(/\bstroke-width=/gi, 'strokeWidth=');
  content = content.replace(/\bstroke-linecap=/gi, 'strokeLinecap=');
  content = content.replace(/\bstroke-linejoin=/gi, 'strokeLinejoin=');
  content = content.replace(/\bstroke-dasharray=/gi, 'strokeDasharray=');
  content = content.replace(/\bstroke-dashoffset=/gi, 'strokeDashoffset=');
  content = content.replace(/\bfill-rule=/gi, 'fillRule=');
  content = content.replace(/\bclip-rule=/gi, 'clipRule=');
  content = content.replace(/\bclip-path=/gi, 'clipPath=');
  content = content.replace(/\bxmlns:xlink=/gi, 'xmlnsXlink=');
  content = content.replace(/\bxlink:href=/gi, 'xlinkHref=');

  // 7. Bind input elements to controlled React state
  content = content.replace(/<(input|select|textarea)\b([^>]*?)>/gi, (match, tag, attrs) => {
    // Avoid double-binding if already has controlled onChange
    if (attrs.includes('onChange=')) return match;

    const trimmedAttrs = attrs.trim();
    const isSelfClosing = trimmedAttrs.endsWith('/');
    let cleanAttrs = isSelfClosing ? trimmedAttrs.slice(0, -1).trimEnd() : trimmedAttrs;

    const placeholderMatch = cleanAttrs.match(/\bplaceholder=["']([^"']+)["']/i);
    const placeholderText = placeholderMatch ? placeholderMatch[1].toLowerCase() : '';
    const isSearchInput = /buscar|search|filtrar|codigo|código|nombre|marca|placa|cliente|repuesto|oem|filtro/i.test(placeholderText)
      || cleanAttrs.includes('type="search"')
      || /search/i.test(cleanAttrs);
    const isFileInput = cleanAttrs.includes('type="file"');
    const isVoid = ['input', 'img', 'br', 'hr'].includes(tag.toLowerCase());

    if (!isTaskLayout && isSearchInput) {
      cleanAttrs = cleanAttrs.replace(/\bvalue=["'][^"']*["']/gi, '');
      return `<${tag} ${cleanAttrs} value={searchQuery} onChange={handleSearchChange}${isVoid ? ' />' : '>'}`;
    }

    if (!isTaskLayout && isFileInput) {
      return `<${tag} ${cleanAttrs} onChange={handleFileSelect}${isVoid ? ' />' : '>'}`;
    }

    if (!isTaskLayout && (entityName || binding)) {
      const nameMatch = cleanAttrs.match(/\bname=["']([^"']+)["']/i);
      const idMatch = cleanAttrs.match(/\bid=["']([^"']+)["']/i);
      const staticValMatch = cleanAttrs.match(/\bvalue=["']([^"']*)["']/i);
      const staticVal = staticValMatch ? staticValMatch[1].replace(/"/g, '') : '';

      const rawKey = nameMatch ? nameMatch[1] : (idMatch ? idMatch[1] : (placeholderMatch ? toCamelCase(placeholderMatch[1].replace(/[^a-zA-Z0-9]/g, ' ').trim().slice(0, 15)) : null));
      const key = rawKey ? toCamelCase(rawKey.replace(/[^a-zA-Z0-9_]/g, '')) : null;

      // Strip static value to replace with controlled binding
      cleanAttrs = cleanAttrs.replace(/\bvalue=["'][^"']*["']/gi, '');

      if (key && !['submit', 'button', 'hidden', 'reset'].some(t => cleanAttrs.includes(`type="${t}"`))) {
        return `<${tag} ${cleanAttrs} value={formData['${key}'] !== undefined ? formData['${key}'] : ''} onChange={handleInputChange}${isVoid ? ' />' : '>'}`;
      }
    }

    if (isVoid) {
      return `<${tag} ${cleanAttrs} />`;
    }
    return match;
  });

  // 8. Autoclose void elements: <input>, <img>, <br>, <hr>, respecting JSX expressions
  const voidTags = ['input', 'img', 'br', 'hr', 'source', 'link', 'meta'];
  for (const tag of voidTags) {
    const regex = new RegExp(`<(${tag})\\b((?:[^>"'{]|"[^"]*"|'[^']*'|{[^}]*})*?)(?<!/)>`, 'gi');
    content = content.replace(regex, '<$1$2 />');
  }

  // Clean up any stray slashes before React attributes or duplicated closings
  content = content.replace(/\/\s+(value=|onChange=|className=|id=|name=)/gi, ' $1');
  content = content.replace(/([a-zA-Z0-9"'])\/>/g, '$1 />');
  content = content.replace(/\s*\/+\s*\/>/g, ' />');

  // 9. Convert inline styles
  content = content.replace(/\bstyle="([^"]*)"/g, (match, styleStr) => {
    try {
      const styles = {};
      styleStr.split(';').forEach(rule => {
        const [prop, val] = rule.split(':').map(s => s && s.trim());
        if (prop && val) {
          const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          styles[camelProp] = val;
        }
      });
      return `style={${JSON.stringify(styles)}}`;
    } catch {
      return '';
    }
  });

  // 10. Process inline onclick attributes for modal opening / closing before stripping
  content = content.replace(/\bonclick="([^"]*)"|\bonclick='([^']*)'/gi, (match, code1, code2) => {
    if (isTaskLayout) return '';
    const code = code1 || code2 || '';
    const idMatch = code.match(/getElementById\(['"]([^'"]+)['"]\)/);
    if (idMatch) {
      if (code.includes('classList.remove') || code.includes('classList.toggle')) {
        return `onClick={() => openModal('${idMatch[1]}')}`;
      }
      if (code.includes('classList.add')) {
        return `onClick={() => closeModal('${idMatch[1]}')}`;
      }
    }
    return '';
  });

  // Strip remaining HTML event handlers
  content = content.replace(/\baction="[^"]*"|\baction='[^']*'/gi, '');
  content = content.replace(/\bonsubmit="[^"]*"|\bonsubmit='[^']*'/gi, '');
  content = content.replace(/\bonclick="[^"]*"|\bonclick='[^']*'/gi, '');
  content = content.replace(/<form\b([^>]*)>/gi, (match, attrs) => {
    if (!isTaskLayout && !attrs.includes('onSubmit')) {
      return `<form${attrs} onSubmit={handleSubmit}>`;
    }
    return match;
  });

  // Explicit contracts take precedence over label-based legacy conversion.
  // Task layouts keep visual chrome only; ContractTask owns the live form.
  if (!isTaskLayout && binding?.screenContract) {
    const contract = binding.screenContract;
    content = content.replace(/<form\b/gi, '<form data-contract-form="true"');
    content = replaceButtons(content, (match, attrs, inner) => {
      const id = attrs.match(/(?:data-action-id|id)=["']([^"']+)["']/i)?.[1];
      const action = contract.actions.find(a => a.actionId === id || a.controlId === id);
      const clean = attrs.replace(/onClick=\{[^}]*\}/g, '').replace(/type=["'][^"']+["']/g, '');
      return action
        ? '<button ' + clean + ' type="button" onClick={event => { const form = event.currentTarget.closest("form"); if (!form || form.reportValidity()) executeCustomAction(' + JSON.stringify(action.actionId || action.operationId) + '); }}>' + inner + '</button>'
        : '<button ' + clean + ' type="button" onClick={() => setErrorMessage("UNRESOLVED: vincular control a una acci?n expl?cita")}>' + inner + '</button>';
    });
    content = content.replace(/<(input|select|textarea)\b([^>]*?)(?:\/>|>(?:[\s\S]*?<\/\1>)?)/gi, (match, tag, attrs) => {
      const name = attrs.match(/(?:name|id)=["']([^"']+)["']/i)?.[1];
      const field = contract.fields.find(f => f.fieldName === name);
      if (!field) return match;
      return field.mode === 'editable' ? renderFields([field]) : '<span className="field-automatic">Identificador generado por el sistema</span>';
    });
  }

  // An unbound control stays visible and explains the missing decision.
  if (!isTaskLayout) {
    content = replaceButtons(content, (match, attrs, inner) => {
      if (attrs.includes('onClick=')) return match;
      return '<button' + attrs + ' type="button" onClick={() => setErrorMessage("UNRESOLVED: vincular control a una acci?n expl?cita")}>' + inner + '</button>';
    });
  }

  // 12. Connect navigation links (<a>) inside mockup to onNavigate
  if (Array.isArray(screensNav) && screensNav.length > 0) {
    content = content.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (match, attrs, inner) => {
      if (attrs.includes('onClick=')) return match;
      const cleanInner = inner.replace(/<[^>]+>/g, '').trim().toLowerCase();
      if (!cleanInner || cleanInner.length < 3) return match;

      const targetScreen = screensNav.find(s => {
        const sTitle = (s.title || s.name || s.label || '').toLowerCase();
        const sRoute = (s.route || '').toLowerCase();
        const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
        const hrefVal = hrefMatch ? hrefMatch[1].toLowerCase() : '';
        const innerNorm = cleanInner.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const titleNorm = sTitle.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        if (hrefVal && hrefVal !== '#' && hrefVal !== '/' && sRoute === hrefVal) return true;
        if (cleanInner.length >= 4 && (sTitle.includes(cleanInner) || cleanInner.includes(sTitle) || titleNorm.includes(innerNorm) || innerNorm.includes(titleNorm.split(' ')[0]))) return true;
        return false;
      });

      if (targetScreen) {
        const cleanA = attrs.replace(/\bhref=["'][^"']*["']/gi, '');
        return `<a${cleanA} href="#" onClick={(e) => { e.preventDefault(); if (typeof onNavigate === 'function') onNavigate('${targetScreen.key}'); }}>${inner}</a>`;
      }
      return match;
    });
  }

  // 3. Dynamic Table Injection: replace static tbody dummy rows with dynamic React mapping
  const tbodyMatch = !isTaskLayout && content.match(/<tbody\b([^>]*)>([\s\S]*?)<\/tbody>/i);
  if (tbodyMatch) {
    const tbodyAttrs = tbodyMatch[1] || '';

    // Inspect columns from binding or dynamic row formatting
    const boundCols = binding?.tableBindings?.[0]?.columns || [];
    let dynamicRowCells = '';

    if (boundCols.length > 0) {
      dynamicRowCells = boundCols.map(c =>
        `<td key="${c.fieldName}" style={{ padding: '12px 16px', fontSize: '0.875rem' }}>{item['${c.fieldName}'] !== undefined && item['${c.fieldName}'] !== null ? String(item['${c.fieldName}']) : '-'}</td>`
      ).join('\n            ');
      dynamicRowCells += `\n            <td style={{ padding: '12px 16px', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
              <button type="button" onClick={() => executeRowEdit(item)} style={{ color: '#2563eb', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, marginRight: '10px' }}>Editar</button>
              <button type="button" onClick={() => executeRowDelete(item.id || item[Object.keys(item)[0]])} style={{ color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>Eliminar</button>
            </td>`;
    } else {
      dynamicRowCells = `{Object.entries(item).filter(([k]) => !['password', 'password_hash', 'passwordHash', 'contrasena', 'clave', 'token', 'salt', 'createdAt', 'updatedAt'].includes(k)).slice(0, 6).map(([k, v]) => (
              <td key={k} style={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                {typeof v === 'boolean' || k === 'activo' ? (
                  <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, background: v ? '#ecfdf5' : '#fef2f2', color: v ? '#059669' : '#dc2626' }}>
                    {v ? 'Activo' : 'Inactivo'}
                  </span>
                ) : typeof v === 'number' && (k.toLowerCase().includes('precio') || k.toLowerCase().includes('tarifa') || k.toLowerCase().includes('total')) ? (
                  \`$\${Number(v).toFixed(2)}\`
                ) : (v !== null && v !== undefined ? String(v) : '-')}
              </td>
            ))}
            <td style={{ padding: '12px 16px', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
              <button type="button" onClick={() => executeRowEdit(item)} style={{ color: '#2563eb', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, marginRight: '10px' }}>Editar</button>
              <button type="button" onClick={() => executeRowDelete(item.id || item[Object.keys(item)[0]])} style={{ color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>Eliminar</button>
            </td>`;
    }

    const dynamicTbody = `<tbody${tbodyAttrs}>
        {dataLoading ? (
          <tr>
            <td colSpan={12} style={{ textAlign: 'center', padding: '28px', color: '#64748b', fontSize: '0.9rem' }}>
              Cargando registros...
            </td>
          </tr>
        ) : (!Array.isArray(typeof displayedItems !== 'undefined' ? displayedItems : dataList) || (typeof displayedItems !== 'undefined' ? displayedItems : dataList).length === 0) ? (
          <tr>
            <td colSpan={12} style={{ textAlign: 'center', padding: '28px', color: '#94a3b8', fontSize: '0.9rem' }}>
              No hay registros disponibles. Utilice el formulario para crear uno.
            </td>
          </tr>
        ) : (
          (typeof displayedItems !== 'undefined' ? displayedItems : (dataList.map ? dataList : [])).map((item, rowIdx) => (
            <tr key={item.id || rowIdx} style={{ borderBottom: '1px solid #e2e8f0' }} className="hover:bg-gray-50">
            ${dynamicRowCells}
            </tr>
          ))
        )}
      </tbody>`;

    content = content.replace(/<tbody\b[^>]*>[\s\S]*?<\/tbody>/gi, () => dynamicTbody);
  }

  if (isTaskLayout) content = wireTaskLayout(content, binding.screenContract);

  for (const screen of screensNav || []) {
    const path = String(screen.route || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!path) continue;
    const key = JSON.stringify(screen.key);
    const hrefRe = new RegExp(`<a\\b([^>]*?)href=["']${path}["']([^>]*)>([\\s\\S]*?)</a>`, 'gi');
    content = content.replace(hrefRe, `<button type="button"$1$2 onClick={() => onNavigate(${key})}>$3</button>`);
  }

  if (stitchCss) {
    const id = visual.id;
    const css = `@scope ([data-mockup-screen="${id}"]) { ${stitchCss.replace(/(^|[{},]\s*)(:root|html|body)(?=[\s,{.#[:>])/gm, '$1:scope')} }`;
    content = `<style dangerouslySetInnerHTML={{ __html: ${JSON.stringify(css)} }} />${content}`;
  }
  const bodyClass = htmlContent.match(/<body\b[^>]*\bclass=["']([^"']*)["']/i)?.[1] || '';
  const fonts = visual.fonts.map(href => `<link rel="stylesheet" href=${JSON.stringify(href)} />`).join('');
  return `<div data-mockup-screen="${visual.id}">${fonts}<div className=${JSON.stringify(bodyClass)}>${content}</div></div>`;
}

function fieldToken(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function matchContractField(attrs, fields = [], hint = '') {
  const declared = attrs.match(/\bdata-field=["']([^"']+)["']/i)?.[1];
  if (declared) return fields.find(field => field.fieldName === declared) || null;
  const name = attrs.match(/\b(?:name|id)=["']([^"']+)["']/i)?.[1] || '';
  const placeholder = attrs.match(/\bplaceholder=["']([^"']+)["']/i)?.[1] || '';
  const aria = attrs.match(/\baria-label=["']([^"']+)["']/i)?.[1] || '';
  const haystack = fieldToken([name, placeholder, aria, hint].join(' '));
  if (!haystack) return null;
  const exact = fields.filter(field => fieldToken(field.fieldName) === fieldToken(name));
  if (exact.length === 1) return exact[0];
  const candidates = fields.filter(field => {
    const keys = [field.fieldName, field.label, field.originalName, String(field.fieldName || '').replace(/Id$/i, '')]
      .map(fieldToken).filter(key => key.length >= 3);
    return keys.some(key => haystack === key || haystack.includes(key) || (key.includes(haystack) && haystack.length >= 4));
  });
  return candidates.length === 1 ? candidates[0] : null;
}

function bindFieldAttrs(attrs, field) {
  let next = String(attrs || '')
    .replace(/\bvalue=\{[^}]*\}/g, '')
    .replace(/\bonChange=\{[\s\S]*?\}/g, '')
    .replace(/\bvalue=["'][^"']*["']/gi, '')
    .replace(/\bdefaultValue=["'][^"']*["']/gi, '')
    .replace(/\b(?:defaultChecked|checked)(?:=\{[^}]*\}|=["'][^"']*["'])?/gi, '')
    .replace(/\bname=["'][^"']*["']/gi, '')
    .replace(/\bid=["'][^"']*["']/gi, '');
  const key = JSON.stringify(field.fieldName);
  const isCheck = /\btype=["']checkbox["']/i.test(next);
  const isFile = /\btype=["']file["']/i.test(next);
  next += ` id={${key}} name={${key}}`;
  if (isFile) return `${next} onChange={event => slots.updateFiles(${key}, Array.from(event.target.files || []))}`;
  if (isCheck) return `${next} checked={Boolean(slots.values[${key}])} onChange={event => slots.setField(${key}, event.target.checked)}`;
  const numeric = /INTEGER|FLOAT|DECIMAL|NUMBER|BIGINT/.test(field.dataType || '');
  const fromEvent = numeric
    ? `event.target.value === '' ? '' : Number(event.target.value)`
    : `event.target.value`;
  return `${next} value={slots.values[${key}] ?? ''} onChange={event => slots.setField(${key}, ${fromEvent})}`;
}

function selectOptionsJsx(field) {
  const key = JSON.stringify(field.fieldName);
  if (field.relation) {
    const valueField = JSON.stringify(field.relation.valueField || 'id');
    return `<option value="">{slots.loading ? 'Cargando…' : 'Seleccionar'}</option>{(slots.optionsFor(${key}) || []).map(row => <option key={row[${valueField}]} value={row[${valueField}]}>{slots.labelFor(${key}, row)}</option>)}`;
  }
  if (field.options?.length) {
    return `<option value="">Seleccionar</option>{(${JSON.stringify(field.options)}).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}`;
  }
  return `<option value="">Seleccionar</option>`;
}

function liveTbody(attrs, template, columns) {
  const row = template.match(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/i);
  const cells = [...(row?.[2] || '').matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)];
  const count = cells.length || 1;
  if (!Array.isArray(columns)) return '<tbody' + attrs + ' data-unresolved-display="true"><tr><td colSpan={' + count + '}>Listado pendiente de vinculacion</td></tr></tbody>';
  const rendered = cells.map((cell, index) => {
    const binding = columns.find(c => c.index === index);
    const descriptors = binding?.fields || (binding ? [binding] : []);
    const body = descriptors.length ? descriptors.map(c => '<div>{slots.display(row, ' + JSON.stringify(c) + ')}</div>').join('') : '<span aria-label="Dato no vinculado">?</span>';
    return '<td' + cell[1] + '>' + body + '</td>';
  }).join('');
  return '<tbody' + attrs + '>{slots.loading ? <tr><td colSpan={' + count + '}>Cargando...</td></tr> : !(slots.rows || []).length ? <tr><td colSpan={' + count + '}>Sin registros</td></tr> : (slots.rows || []).map(row => <tr' + (row?.[1] || '') + ' key={row[slots.valueField] || row.id}>' + rendered + '</tr>)}</tbody>';
}

function wireTaskLayout(content, contract = {}) {
  const fields = (contract.fields || []).filter(field => field && field.mode !== 'automatic' && field.control !== 'hidden');
  let next = content.replace(/<form\b([^>]*)>/gi, (match, attrs) => {
    if (/onSubmit=\{/.test(attrs)) return match;
    return `<form${attrs} data-contract-form="true" onSubmit={slots.submit}>`;
  });
  next = next.replace(/<(input)\b([^>]*?)(\/)?>/gi, (match, tag, attrs, _closing, offset) => {
    if (/type=["'](?:submit|button|hidden|reset)["']/i.test(attrs)) return match;
    const isSearch = /buscar|search|filtrar/i.test(attrs);
    if (isSearch) {
      const clean = String(attrs).replace(/\bvalue=["'][^"']*["']/gi, '').replace(/\bvalue=\{[^}]*\}/g, '');
      return `<input ${clean} value={slots.filter ?? ''} onChange={event => slots.setFilter(event.target.value)} />`;
    }
    const labels = [...String(next).slice(0, offset).matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)];
    const hint = labels.at(-1)?.[1]?.replace(/<[^>]*>/g, ' ') || '';
    const field = matchContractField(attrs, fields, hint);
    if (!field) return `<input ${String(attrs).replace(/\b(?:value|defaultValue)=["'][^"']*["']/gi, '')} disabled data-unresolved-control="true" />`;
    return `<input ${bindFieldAttrs(attrs, field)} />`;
  });
  next = next.replace(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi, (match, attrs, _inner, offset) => {
    const labels = [...String(next).slice(0, offset).matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)];
    const field = matchContractField(attrs, fields, labels.at(-1)?.[1]?.replace(/<[^>]*>/g, ' ') || '');
    if (!field) return `<textarea ${attrs} disabled data-unresolved-control="true"></textarea>`;
    return `<textarea ${bindFieldAttrs(attrs, field)}></textarea>`;
  });
  next = next.replace(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi, (match, attrs, _inner, offset) => {
    const nearby = String(next).slice(Math.max(0, offset - 350), offset).replace(/<[^>]+>/g, ' ');
    const field = matchContractField(attrs, fields, nearby);
    if (!field) return `<select ${attrs} disabled data-unresolved-control="true"><option value="">UNRESOLVED: selector sin contrato</option></select>`;
    return `<select ${bindFieldAttrs(attrs, field)}>${selectOptionsJsx(field)}</select>`;
  });
  let tableIndex = 0;
  next = next.replace(/<tbody\b([^>]*)>([\s\S]*?)<\/tbody>/gi, (match, attrs, inner) => liveTbody(attrs, inner, tableIndex++ === 0 ? contract.tableColumns : undefined));
  next = replaceButtons(next, (match, attrs, inner) => {
    if (attrs.includes('onClick=')) return match;
    attrs = attrs.replace(/\sdisabled(?:=["'][^"']*["'])?(?=\s|$)/gi, '');
    const boundField = attrs.match(/data-field=["']([^"']+)["']/)?.[1];
    const boundValue = attrs.match(/data-field-value=["']([^"']+)["']/)?.[1];
    if (boundField && boundValue !== undefined) return `<button${attrs.replace(/\btype=["'][^"']+["']/gi, '')} type="button" aria-pressed={slots.values[${JSON.stringify(boundField)}] === ${Number(boundValue)}} onClick={() => slots.setField(${JSON.stringify(boundField)}, ${Number(boundValue)})}>${inner}</button>`;
    const text = String(inner).replace(/<svg\b[\s\S]*?<\/svg>/gi, '').replace(/<span\b[^>]*class(?:Name)?=["'][^"']*material-symbols[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '').replace(/<[^>]+>/g, '');
    const explicit = attrs.match(/data-action-id=["']([^"']+)["']/)?.[1];
    const label = attrs.match(/data-action-label=["']([^"']+)["']/)?.[1];
    if (label) inner = (inner.match(/<span\b[^>]*class(?:Name)?=["'][^"']*material-symbols[^"']*["'][^>]*>[\s\S]*?<\/span>/i)?.[0] || '') + '<span>' + label + '</span>';
    const action = (contract.actions || []).find(a => !a.supplemental && (explicit ? a.actionId === explicit : fieldToken(a.name) === fieldToken(text)));
    if (!action) return `<button${attrs.replace(/\btype=["'][^"']+["']/gi, '')} type="button" disabled data-unresolved-control="true" title="Control pendiente de vinculación">${inner}</button>`;
    const clean = attrs.replace(/\btype=["'][^"']+["']/gi, '');
    const added = (contract.additionalControls || []).filter(item => item.beforeActionId === action.actionId).flatMap(item => item.fields).map(name => {
      const field = fields.find(f => f.fieldName === name);
      if (!field) throw new Error('ADDITIONAL_CONTROL_FIELD_NOT_FOUND: ' + name);
      const styles = 'className="w-full p-2.5 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface"';
      const attrs = bindFieldAttrs(styles + (field.control === 'files' ? ' type="file" accept="image/*" multiple' : ''), field);
      const control = field.relation || field.options ? `<select ${attrs}>${selectOptionsJsx(field)}</select>` : `<input ${attrs} />`;
      return `<div className="mb-3" data-added-control=${JSON.stringify(name)}><label htmlFor=${JSON.stringify(name)}>${field.label || name}${field.required ? ' *' : ''}</label>${control}</div>`;
    }).join('');
    return `${added}<button${clean} data-action-id=${JSON.stringify(action.actionId)} type="button" disabled={slots.busy || slots.loading} onClick={() => slots.execute(${JSON.stringify(action.actionId)})}>${inner}</button>${contract.recordListAfterActionId === action.actionId ? '{slots.table}' : ''}`;
  });
  return next;
}

/**
 * Generates an interactive, functionally wired React Component from a Screen Mockup
 */
function generateInteractiveMockupComponent(compName, screen, convertedJsx, operation = null, actions = [], entity = null) {
  const isConnected = Boolean(operation?.route || screen.readEndpoint || screen.contract?.actions?.some(a => a.route));
  const targetEndpoint = screen.readEndpoint || operation?.route || null;
  const httpMethod = (operation?.method || 'POST').toLowerCase();
  const screenActions = screen.contract?.actions || ((actions && actions.length > 0) ? actions : (screen.actions || []));

  // Determine read endpoint and write endpoint
  let readEndpoint = screen.readEndpoint
    || (operation?.method === 'GET' ? operation.route : null)
    || (screenActions.find(a => (a.method || '').toUpperCase() === 'GET')?.route)
    || null;

  if (!readEndpoint && targetEndpoint) {
    readEndpoint = targetEndpoint.replace(/\/:[a-zA-Z0-9_]+$/, '');
  }
  const writeAction = (screen.contract?.actions || screenActions).find(a => a.method === 'POST');
  const writeEndpoint = writeAction?.route || null;
  const entityTitle = screen.targetEntity || entity?.name || screen.title || screen.name;

  const fields = screen.contract?.fields || buildFieldContract(entity);
  const entityAttrs = fields.filter(f => f.mode === 'editable');
  const modalFieldsJsx = renderFields(fields);
  const relationFields = fields.filter(f => f.relation?.endpoint);

  const displayAttrs = entityAttrs.slice(0, 6);
  const liveTableColumnsTh = displayAttrs.length > 0
    ? displayAttrs.map(a => {
        const aName = a.name || a.fieldName;
        return `<th style={{ padding: '10px 14px', textTransform: 'capitalize' }}>${aName}</th>`;
      }).join('\n                  ')
    : "<th style={{ padding: '10px 14px' }}>Datos</th>";

  const liveTableRowTds = displayAttrs.length > 0
    ? displayAttrs.map(a => {
        const aName = a.name || a.fieldName;
        return `<td style={{ padding: '12px 14px', color: '#1e293b' }}>
                      {item['${aName}'] !== undefined && item['${aName}'] !== null ? String(item['${aName}']) : '-'}
                    </td>`;
      }).join('\n                    ')
    : `<td style={{ padding: '12px 14px', color: '#1e293b' }}>
         {JSON.stringify(item).slice(0, 60)}
       </td>`;

  const hasDynamicTable = Boolean(convertedJsx && convertedJsx.includes('{dataLoading ?'));

  const rawComponentCode = `import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

/**
 * Componente de Pantalla Diseñado y Conectado Funcionalmente
 * Título: ${screen.title || screen.name}
 * Ruta: ${screen.route}
 * Operación vinculada: ${operation?.name || operation?.operationId || (isConnected ? (readEndpoint || targetEndpoint) : 'SIN_OPERACION_VINCULADA')}
 */
export default function ${compName}({ onNavigate } = {}) {
  const [formData, setFormData] = useState(${JSON.stringify(Object.fromEntries(fields.filter(f => f.mode === "editable" && f.defaultValue != null && !["NOW", "UUIDV4"].includes(f.defaultValue)).map(f => [f.fieldName, f.defaultValue])))});
  const [relationOptions, setRelationOptions] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dataList, setDataList] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [dashboardMetrics] = useState({});
  const isOperationConnected = ${isConnected};

  const actionsMap = {
${screenActions.map(a => `    [${JSON.stringify(a.actionId || a.operationId)}]: ${JSON.stringify({ name: a.name || a.actionId || a.operationId, method: (a.method || 'POST').toLowerCase(), route: a.route || '' })}`).join(',\n')}
  };

  const loadData = async () => {
    ${readEndpoint ? `try {
      setDataLoading(true);
      const res = await apiClient.get('${readEndpoint}');
      const items = Array.isArray(res) 
        ? res 
        : (Array.isArray(res?.data) 
            ? res.data 
            : (Array.isArray(res?.items) 
                ? res.items 
                : (Array.isArray(res?.rows) ? res.rows : [])));
      setDataList(items);

    } catch (err) {
      console.error('Error cargando datos:', err);
      setDataList([]);
      setErrorMessage(err.message || 'Error al cargar registros');
    } finally {
      setDataLoading(false);
    }` : ''}
  };

  useEffect(() => {
    ${readEndpoint ? 'loadData();' : ''}
    ${relationFields.map(f => `apiClient.get(${JSON.stringify(f.relation.endpoint)}).then(res => setRelationOptions(prev => ({ ...prev, [${JSON.stringify(f.fieldName)}]: Array.isArray(res) ? res : res.data || [] }))).catch(err => setErrorMessage(err.message));`).join('\n')}
  }, []);

  const handleInputChange = (e) => {
    const { name, id, value, type, checked } = e.target;
    const fieldKey = name || id || 'field';
    let parsedValue = value;
    if (type === 'checkbox') parsedValue = checked;
    else if (type === 'number') parsedValue = value === '' ? '' : Number(value);
    setFormData(prev => ({
      ...prev,
      [fieldKey]: parsedValue
    }));
  };

  const handleSearchChange = (e) => setSearchQuery(e.target.value);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const uploadData = new FormData();
    uploadData.append('file', file);
    try {
      setSubmitting(true);
      const res = await apiClient.post('/api/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const url = res.url || res.data?.url || (res.filename ? \`/uploads/\${res.filename}\` : null);
      if (url) {
        const fieldKey = e.target.name || 'foto_url';
        setFormData(prev => ({ ...prev, [fieldKey]: url, foto_url: url, imagen_url: url }));
        setResultMessage('Archivo / imagen cargada exitosamente.');
      }
    } catch (err) {
      setErrorMessage('Error al subir archivo: ' + (err.message || 'Error de red'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleIncrementValue = (field, delta) => {
    setFormData(prev => {
      const current = Number(prev[field] !== undefined ? prev[field] : 0);
      return {
        ...prev,
        [field]: current + delta
      };
    });
    setResultMessage(\`Valor incrementado en +\${delta}.\`);
  };

  const displayedItems = (Array.isArray(dataList) ? dataList : []).filter(item => {
    if (activeFilter !== 'ALL') {
      if (activeFilter === 'CRITICAL') {
        const stock = Number(item.stock !== undefined ? item.stock : 99);
        const min = Number(item.stockMinimo !== undefined ? item.stockMinimo : 10);
        if (stock > min) return false;
      } else if (item.categoria && !String(item.categoria).toLowerCase().includes(activeFilter.toLowerCase())) {
        return false;
      }
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(item).some(val => val !== null && val !== undefined && String(val).toLowerCase().includes(q));
  });

  const openModal = (id) => {
    if (typeof document !== 'undefined' && id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('hidden');
    }
    setShowCreateModal(true);
  };

  const closeModal = (id) => {
    if (typeof document !== 'undefined') {
      if (id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      } else {
        document.querySelectorAll('[id^="modal-"]').forEach(m => m.classList.add('hidden'));
      }
    }
    setShowCreateModal(false);
  };

  const handleOpenCreate = () => {
    setFormData({});
    setEditingId(null);
    setShowCreateModal(true);
    setResultMessage(null);
    setErrorMessage(null);
  };

  const handleCancel = () => {
    setFormData({});
    setEditingId(null);
    closeModal();
    setResultMessage(null);
    setErrorMessage(null);
  };

  const executeRowEdit = (item) => {
    if (!item) return;
    setFormData({ ...item });
    setEditingId(item[${JSON.stringify(entity?.primaryKey?.fieldName || fields.find(f => f.isPk)?.fieldName || "id")}]);
    setShowCreateModal(true);
    setResultMessage('Registro cargado para edición. Modifique los campos deseados y guarde los cambios.');
  };

  const executeCustomAction = async (actionId, method, route) => {
    const targetRoute = actionsMap[actionId]?.route;
    const targetMethod = actionsMap[actionId]?.method;

    if (!targetRoute) {
      setErrorMessage(\`La acción '\${actionId}' no tiene una ruta de API definida.\`);
      return;
    }
    setSubmitting(true);
    setResultMessage(null);
    setErrorMessage(null);
    try {
      let response;
      const lowerMethod = targetMethod.toLowerCase();
      if (lowerMethod === 'get') response = await apiClient.get(targetRoute);
      else if (lowerMethod === 'delete') response = await apiClient.delete(targetRoute);
      else if (lowerMethod === 'put') response = await apiClient.put(targetRoute, formData);
      else if (lowerMethod === 'patch') response = await apiClient.patch(targetRoute, formData);
      else response = await apiClient.post(targetRoute, formData);

      setResultMessage(response?.message || 'Acción ejecutada exitosamente.');
      setFormData({});
      setEditingId(null);
      ${readEndpoint ? 'await loadData();' : ''}
    } catch (err) {
      setErrorMessage(err.details?.message || err.message || 'Error al ejecutar la acción.');
    } finally {
      setSubmitting(false);
    }
  };

  const executeRowDelete = async (id) => {
    if (!id) return;
    if (typeof window !== 'undefined' && !window.confirm('¿Está seguro de que desea eliminar este registro?')) return;
    setSubmitting(true);
    setResultMessage(null);
    setErrorMessage(null);
    try {
      const baseRoute = '${writeEndpoint || readEndpoint || targetEndpoint || ''}'.replace(/\\/:[a-zA-Z0-9_]+$/, '');
      if (!baseRoute) throw new Error('No se definió endpoint base para eliminación.');
      await apiClient.delete(\`\${baseRoute}/\${id}\`);
      setResultMessage('Registro eliminado exitosamente de la base de datos.');
      ${readEndpoint ? 'await loadData();' : ''}
    } catch (err) {
      setErrorMessage(err.details?.message || err.message || 'Error al eliminar el registro.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    const listToExport = displayedItems.length > 0 ? displayedItems : dataList;
    if (!listToExport || listToExport.length === 0) {
      setErrorMessage('No hay registros disponibles para exportar.');
      return;
    }
    try {
      const headers = Object.keys(listToExport[0] || {}).filter(k => !['password', 'passwordHash', 'password_hash', 'contrasena'].includes(k));
      const csvContent = [
        headers.join(','),
        ...listToExport.map(row => headers.map(h => JSON.stringify(row[h] !== undefined && row[h] !== null ? row[h] : '')).join(','))
      ].join('\\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', \`reporte_\${Date.now()}.csv\`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setResultMessage(\`Reporte exportado exitosamente (\${listToExport.length} registros en formato CSV).\`);
    } catch (err) {
      setErrorMessage('Error al exportar reporte: ' + err.message);
    }
  };

  const handleFilter = () => {
    ${readEndpoint ? 'loadData();' : ''}
    setResultMessage('Filtros aplicados y registros sincronizados con la base de datos.');
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSubmitting(true);
    setResultMessage(null);
    setErrorMessage(null);

    try {
      if (!${JSON.stringify(writeEndpoint)}) throw new Error('UNRESOLVED: definir operaci?n de escritura');
      const endpoint = editingId ? \`${writeEndpoint}/\${editingId}\` : '${writeEndpoint || targetEndpoint || ''}';
      const method = editingId ? 'put' : 'post';

      let response;
      if (method === 'put') {
        response = await apiClient.put(endpoint, formData);
      } else {
        response = await apiClient.post(endpoint, formData);
      }

      setResultMessage(response?.message || 'Operación completada exitosamente. Registro guardado en la base de datos.');
      setFormData({});
      setEditingId(null);
      closeModal();
      ${readEndpoint ? 'await loadData();' : ''}
    } catch (err) {
      setErrorMessage(err.details?.message || err.message || 'Error al ejecutar la acción.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mockup-interactive-view" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {!isOperationConnected && (
        <div style={{ marginBottom: '14px', padding: '10px 14px', background: '#fffbeb', color: '#b45309', borderRadius: '6px', border: '1px solid #fde68a', fontSize: '0.85rem' }}>
          ⚠️ Incompleto: Sin operación vinculada
        </div>
      )}

      {submitting && (
        <div style={{ marginBottom: '14px', padding: '10px 14px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '6px', fontSize: '0.85rem' }}>
          Procesando solicitud...
        </div>
      )}

      {resultMessage && (
        <div style={{ marginBottom: '14px', padding: '12px 16px', background: '#f0fdf4', color: '#16a34a', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.9rem' }}>
          ✓ {resultMessage}
        </div>
      )}

      {errorMessage && (
        <div style={{ marginBottom: '14px', padding: '12px 16px', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '0.9rem' }}>
          ✗ {errorMessage}
        </div>
      )}

      {/* Modal Dinámico de Creación y Edición de Registros */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
            width: '100%',
            maxWidth: '540px',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                {editingId ? 'Editar Registro' : 'Registrar Nuevo ${entityTitle}'}
              </h3>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#64748b' }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
${modalFieldsJsx}
              <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#4f46e5', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                  {submitting ? 'Guardando...' : (editingId ? 'Actualizar Cambios' : 'Guardar Registro')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barra de Acciones y Estado Operativo */}
      {${Boolean(readEndpoint)} && <div style={{
        marginBottom: '16px',
        padding: '12px 18px',
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
            ${entityTitle}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>
            {dataLoading ? 'Sincronizando...' : \`\${displayedItems.length} registros en BD\`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleOpenCreate}
            style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#4f46e5', color: '#ffffff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
          >
            + Nuevo ${entityTitle}
          </button>
          <button
            type="button"
            onClick={loadData}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: '0.8rem', cursor: 'pointer' }}
          >
            🔄 Sincronizar
          </button>
          <button
            type="button"
            onClick={handleExport}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: '0.8rem', cursor: 'pointer' }}
          >
            📥 Exportar CSV
          </button>
        </div>
      </div>}

      {/* Contenedor Visual Mockup con Enlaces Interactivos Directos */}
      <div className="mockup-content-wrapper">
        ${convertedJsx}
      </div>

      {/* Panel de Datos y Registros Reales de la Base de Datos para Diseños No Tabulares */}
      {!${hasDynamicTable} && ${Boolean(readEndpoint)} && (
        <div style={{
          marginTop: '28px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                Registros de ${entityTitle} en PostgreSQL
              </h4>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                Datos reales conectados con el backend en tiempo real
              </p>
            </div>
            <input
              type="text"
              placeholder="Buscar en registros..."
              value={searchQuery}
              onChange={handleSearchChange}
              style={{
                padding: '6px 12px',
                fontSize: '0.8rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                width: '200px'
              }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                  ${liveTableColumnsTh}
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {dataLoading ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                      Cargando registros desde PostgreSQL...
                    </td>
                  </tr>
                ) : (!Array.isArray(displayedItems) || displayedItems.length === 0) ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                      No hay registros disponibles. Utilice "+ Nuevo ${entityTitle}" para agregar uno.
                    </td>
                  </tr>
                ) : (
                  displayedItems.map((item, idx) => (
                    <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }} className="hover:bg-gray-50">
                      ${liveTableRowTds}
                      <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => executeRowEdit(item)}
                          style={{ color: '#4f46e5', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600, marginRight: '10px', fontSize: '0.8rem' }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => executeRowDelete(item.id || item[Object.keys(item)[0]])}
                          style={{ color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.8rem' }}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
`;

  const validation = validateAndRepairJsx(rawComponentCode, { compName });
  return validation.repairedJsx || rawComponentCode;
}

module.exports = {
  convertHtmlToJsx,
  generateInteractiveMockupComponent,
  stripRolePreviewChrome
};
