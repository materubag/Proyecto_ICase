/**
 * AI Mockup Synthesizer & Control Connector
 * Parses Stitch HTML mockups, normalizes interactive DOM control identifiers,
 * and synthesizes versioned UI bindings conforming to icase.binding.contract.v1.
 */

const {
  BINDING_CONTRACT_VERSION,
  validateBindingContract
} = require('./contractSchema');
const { saveBindingProposal } = require('./aiProposalStore');
const { toCamelCase, toSnakeCase } = require('./typeMapper');

/**
 * Normalizes string for fuzzy match comparison
 */
function cleanText(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Normalizes interactive controls inside Stitch HTML mockups, assigning stable IDs
 * and building a mapping back to the original elements.
 */
function normalizeHtmlControls(html) {
  if (!html || typeof html !== 'string') {
    return { tables: [], forms: [], buttons: [], selectorMap: {} };
  }

  const tables = [];
  const forms = [];
  const buttons = [];
  const selectorMap = {};

  // 1. Parse Tables
  const tableMatches = [...html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)];
  tableMatches.forEach((match, idx) => {
    const tableAttrs = match[1] || '';
    const tableContent = match[2] || '';

    const idMatch = tableAttrs.match(/\bid=["']([^"']+)["']/i);
    const tableId = idMatch ? idMatch[1] : `tbl_data_${idx + 1}`;
    const selector = idMatch ? `#${idMatch[1]}` : `table:nth-of-type(${idx + 1})`;

    // Extract headers
    const thMatches = [...tableContent.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)];
    const columns = thMatches.map((th, cIdx) => {
      const text = th[1].replace(/<[^>]+>/g, '').trim();
      return {
        index: cIdx,
        header: text || `Columna ${cIdx + 1}`,
        fieldCandidate: toCamelCase(cleanText(text) || `col_${cIdx + 1}`)
      };
    });

    // Detect if table has dummy static rows in tbody
    const hasStaticRows = /<tbody\b[^>]*>[\s\S]*?<tr\b[\s\S]*?<\/tr>[\s\S]*?<\/tbody>/i.test(tableContent);

    tables.push({
      tableId,
      selector,
      columns,
      hasStaticRows
    });

    selectorMap[selector] = { normalizedId: tableId, type: 'table', columns };
  });

  // 2. Parse Forms & Inputs
  const formMatches = [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)];
  const formContainers = formMatches.length > 0 ? formMatches : [[html, '', html]];

  formContainers.forEach((fMatch, fIdx) => {
    const formAttrs = fMatch[1] || '';
    const formContent = fMatch[2] || '';
    const formIdMatch = formAttrs.match(/\bid=["']([^"']+)["']/i);
    const formId = formIdMatch ? formIdMatch[1] : (formMatches.length > 0 ? `form_main_${fIdx + 1}` : 'form_main');
    const formSelector = formIdMatch ? `#${formIdMatch[1]}` : 'form';

    // Parse Inputs
    const inputMatches = [...formContent.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)];
    const fields = [];

    inputMatches.forEach((inp, inpIdx) => {
      const tag = inp[1].toLowerCase();
      const attrs = inp[2] || '';

      const typeMatch = attrs.match(/\btype=["']([^"']+)["']/i);
      const inputType = typeMatch ? typeMatch[1].toLowerCase() : (tag === 'textarea' ? 'textarea' : 'text');

      if (['submit', 'hidden', 'button'].includes(inputType)) return;

      const nameMatch = attrs.match(/\bname=["']([^"']+)["']/i);
      const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
      const placeholderMatch = attrs.match(/\bplaceholder=["']([^"']+)["']/i);

      const rawIdentifier = nameMatch ? nameMatch[1] : (idMatch ? idMatch[1] : (placeholderMatch ? placeholderMatch[1] : `input_${inpIdx + 1}`));
      const normalizedName = toCamelCase(cleanText(rawIdentifier) || `field_${inpIdx + 1}`);
      const selector = idMatch ? `#${idMatch[1]}` : (nameMatch ? `[name="${nameMatch[1]}"]` : `${tag}:nth-of-type(${inpIdx + 1})`);

      fields.push({
        selector,
        normalizedId: `inp_${normalizedName}`,
        inputName: nameMatch ? nameMatch[1] : normalizedName,
        boundFieldCandidate: normalizedName,
        type: inputType,
        placeholder: placeholderMatch ? placeholderMatch[1] : ''
      });

      selectorMap[selector] = { normalizedId: `inp_${normalizedName}`, type: 'input', boundFieldCandidate: normalizedName };
    });

    if (fields.length > 0) {
      forms.push({
        formId,
        selector: formSelector,
        fields
      });
      selectorMap[formSelector] = { normalizedId: formId, type: 'form', fieldsCount: fields.length };
    }
  });

  // 3. Parse Buttons
  const buttonMatches = [...html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi)];
  buttonMatches.forEach((btn, bIdx) => {
    const tag = btn[1].toLowerCase();
    const attrs = btn[2] || '';
    const innerHtml = btn[3] || '';
    const text = innerHtml.replace(/<[^>]+>/g, '').trim();

    const isBtnClass = /class=["'][^"']*\b(btn|button|bg-blue|bg-indigo|bg-red|bg-green)\b[^"']*["']/i.test(attrs);
    if (tag === 'a' && !isBtnClass) return; // Ignore regular navigational links

    const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
    const btnTextClean = cleanText(text) || `action_${bIdx + 1}`;
    const btnId = idMatch ? idMatch[1] : `btn_${toSnakeCase(btnTextClean)}`;
    const selector = idMatch ? `#${idMatch[1]}` : `button:nth-of-type(${bIdx + 1})`;

    buttons.push({
      buttonId: btnId,
      selector,
      label: text || btnId,
      actionHint: btnTextClean
    });

    selectorMap[selector] = { normalizedId: btnId, type: 'button', label: text };
  });

  return { tables, forms, buttons, selectorMap };
}

/**
 * Synthesizes mockup UI bindings to real backend API operations and entity attributes
 * @param {string} projectId
 * @param {Object} screen - Screen object with html content
 * @param {Object} catalog - Catalog containing { entities, operations, roles }
 * @returns {Object} Validated candidate mockup binding contract proposal
 */
function synthesizeMockupBindings(projectId, screen, catalog = {}) {
  const html = screen.html || '';
  const { tables, forms, buttons, selectorMap } = normalizeHtmlControls(html);

  const entities = catalog.entities || [];
  const operations = catalog.operations || [];
  const roles = catalog.roles || [];

  const screenNameNorm = cleanText(screen.name || screen.title || '');
  const screenRouteNorm = cleanText(screen.route || '');

  // 1. Find matching primary entity for screen
  let primaryEntity = entities.find(e => {
    const eNorm = cleanText(e.modelName || e.name);
    return screenNameNorm.includes(eNorm) || screenRouteNorm.includes(eNorm);
  });

  if (!primaryEntity && entities.length > 0) {
    primaryEntity = entities[0];
  }

  // 2. Data Sources & Table Bindings
  const dataSources = [];
  const tableBindings = [];

  tables.forEach((tbl, tIdx) => {
    // Find matching list operation
    const listOp = operations.find(o =>
      o.method === 'GET' &&
      !o.route.includes(':') &&
      primaryEntity &&
      (o.entity === primaryEntity.modelName || o.targetEntity === primaryEntity.modelName)
    ) || operations.find(o => o.method === 'GET' && !o.route.includes(':'));

    const dsId = `ds_${primaryEntity ? primaryEntity.tableName : 'main'}_${tIdx + 1}`;
    if (listOp) {
      dataSources.push({
        id: dsId,
        name: `Listado de ${primaryEntity ? primaryEntity.modelName : 'Datos'}`,
        endpoint: listOp.route,
        method: 'GET',
        responseMapping: { listKey: 'data', totalKey: 'total' },
        autoLoad: true
      });
    }

    // Map columns strictly to verified entity attributes
    const mappedColumns = [];
    const entAttrs = primaryEntity ? (primaryEntity.attributes || []) : [];

    tbl.columns.forEach(col => {
      const colNorm = cleanText(col.header);
      // Skip action columns
      if (['accion', 'acciones', 'action', 'actions', 'opciones'].includes(colNorm)) return;

      const matchedAttr = entAttrs.find(a => {
        const aNorm = cleanText(a.fieldName || a.name);
        return aNorm === colNorm || colNorm.includes(aNorm) || aNorm.includes(colNorm);
      });

      if (matchedAttr) {
        mappedColumns.push({
          header: col.header,
          fieldName: matchedAttr.fieldName,
          type: matchedAttr.type || 'string'
        });
      } else if (col.fieldCandidate) {
        // Fallback: match by field name
        const attrByCandidate = entAttrs.find(a => cleanText(a.fieldName) === cleanText(col.fieldCandidate));
        if (attrByCandidate) {
          mappedColumns.push({
            header: col.header,
            fieldName: attrByCandidate.fieldName,
            type: attrByCandidate.type || 'string'
          });
        }
      }
    });

    tableBindings.push({
      selector: tbl.selector,
      tableId: tbl.tableId,
      dataSourceId: dsId,
      operationId: listOp?.operationId || null,
      columns: mappedColumns,
      hasStaticRows: tbl.hasStaticRows
    });
  });

  // 3. Form Bindings
  const formBindings = [];

  forms.forEach((frm, fIdx) => {
    const createOp = operations.find(o =>
      (o.method === 'POST' || o.method === 'PUT') &&
      primaryEntity &&
      (o.entity === primaryEntity.modelName || o.targetEntity === primaryEntity.modelName)
    ) || operations.find(o => o.method === 'POST');

    const entAttrs = primaryEntity ? (primaryEntity.attributes || []) : [];
    const boundFields = [];

    frm.fields.forEach(fld => {
      const fldNorm = cleanText(fld.boundFieldCandidate || fld.inputName);
      const matchedAttr = entAttrs.find(a => {
        const aNorm = cleanText(a.fieldName || a.name);
        return aNorm === fldNorm || fldNorm.includes(aNorm);
      });

      boundFields.push({
        selector: fld.selector,
        normalizedId: fld.normalizedId,
        inputName: fld.inputName,
        boundField: matchedAttr ? matchedAttr.fieldName : fld.inputName,
        type: fld.type,
        required: matchedAttr ? !matchedAttr.allowNull && !matchedAttr.isPk : false
      });
    });

    // Find submit button in this form
    const submitBtn = buttons.find(b =>
      b.actionHint.includes('guardar') ||
      b.actionHint.includes('crear') ||
      b.actionHint.includes('registrar') ||
      b.actionHint.includes('submit')
    );

    formBindings.push({
      selector: frm.selector,
      formId: frm.formId,
      targetOperationId: createOp?.operationId || null,
      submitButtonSelector: submitBtn?.selector || 'button[type="submit"]',
      fields: boundFields
    });
  });

  // 4. Action Buttons
  const actionButtons = [];

  buttons.forEach(btn => {
    const bHint = btn.actionHint;
    let targetOp = null;

    if (bHint.includes('eliminar') || bHint.includes('borrar') || bHint.includes('delete')) {
      targetOp = operations.find(o => o.method === 'DELETE' && primaryEntity && o.entity === primaryEntity.modelName);
    } else if (bHint.includes('guardar') || bHint.includes('crear') || bHint.includes('registrar')) {
      targetOp = operations.find(o => o.method === 'POST' && primaryEntity && o.entity === primaryEntity.modelName);
    } else if (bHint.includes('editar') || bHint.includes('actualizar')) {
      targetOp = operations.find(o => o.method === 'PUT' && primaryEntity && o.entity === primaryEntity.modelName);
    }

    if (targetOp) {
      actionButtons.push({
        selector: btn.selector,
        buttonId: btn.buttonId,
        label: btn.label,
        operationId: targetOp.operationId,
        method: targetOp.method,
        route: targetOp.route,
        confirmMessage: targetOp.method === 'DELETE' ? '¿Está seguro de que desea eliminar este registro?' : null,
        reloadDataSource: true
      });
    }
  });

  const proposal = {
    contractVersion: BINDING_CONTRACT_VERSION,
    screenId: screen.id || screen.name,
    screenRoute: screen.route,
    title: screen.title || screen.name,
    connectedOperationId: dataSources[0]?.operationId || formBindings[0]?.targetOperationId || actionButtons[0]?.operationId || null,
    dataSources,
    tableBindings,
    formBindings,
    actionButtons,
    selectorMap,
    authorizedRoles: screen.roles || roles
  };

  const validation = validateBindingContract(proposal, catalog);

  const dependencies = {
    screenId: screen.id,
    route: screen.route,
    htmlHash: cleanText(html).slice(0, 100),
    entityAttributes: primaryEntity ? (primaryEntity.attributes || []).map(a => a.fieldName) : []
  };

  const stored = saveBindingProposal(projectId, screen.id || screen.name, proposal, dependencies);

  return {
    proposalId: stored.id,
    screenId: screen.id || screen.name,
    status: stored.status,
    valid: validation.valid,
    validationErrors: validation.errors,
    validationWarnings: validation.warnings,
    proposal,
    dependencyHash: stored.dependencyHash
  };
}

module.exports = {
  normalizeHtmlControls,
  synthesizeMockupBindings
};

