'use strict';

const { getEffectiveScreensByRoleForSpec } = require('./codegenCustomizationStore');
const { screenTabKey } = require('./screenContract');
const { extractProjectDesignSystem } = require('./claudeFrontendSynthesizer');

function toPascalCase(str) {
  return String(str || '')
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^[a-z]/, c => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
}

function buildOperationalMockupsFromSpec(spec = {}) {
  const isLoginScreen = s => /iniciodesesi|accesoalsistema|login|auth/i.test((s.name || '') + (s.route || '') + (s.title || '') + (s.key || ''));
  const operationalScreens = (spec.screens || []).filter(s => !isLoginScreen(s));
  const compiledMockups = [];
  let mockupIdx = 1;
  for (const scr of operationalScreens) {
    const hasWork = scr.html || scr.contract?.renderer === 'task' || (scr.contract?.fields || []).length || (scr.actions || []).length;
    if (!hasWork) continue;
    const cleanBase = toPascalCase((scr.name || 'Screen').replace(/[^a-zA-Z0-9_]/g, '')) || 'Screen';
    const compName = `${cleanBase}${mockupIdx > 1 ? mockupIdx : ''}Mockup`;
    const key = screenTabKey(scr);
    mockupIdx++;
    compiledMockups.push({
      compName,
      key,
      title: scr.title || scr.name,
      route: scr.route,
      roles: scr.roles || []
    });
  }
  return compiledMockups;
}

function renderFrontendPreviewHtml(projectId, spec = {}, options = {}) {
  const assetsBase = `/api/projects/${projectId}/codegen/workflow/frontend-preview/assets`;
  const runtimeBase = `/api/projects/${projectId}/codegen/workflow/runtime`;
  const design = extractProjectDesignSystem(spec);
  const operationalMockups = buildOperationalMockupsFromSpec(spec);
  const screensByRole = getEffectiveScreensByRoleForSpec(projectId, spec, operationalMockups);
  const projectName = design.projectName || spec?.project?.name || 'Sistema Generado i-CASE';

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName} — Vista Previa Interactiva i-CASE</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons" />
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      body {
        font-family: '${design.bodyFont || 'Inter'}', system-ui, -apple-system, sans-serif;
        background-color: #f8fafc;
        color: #0f172a;
        margin: 0;
      }
      .material-symbols-outlined, .ms, .material-icons {
        font-family: 'Material Symbols Outlined', 'Material Icons' !important;
        font-weight: normal;
        font-style: normal;
        font-size: 22px;
        line-height: 1;
        letter-spacing: normal;
        text-transform: none;
        display: inline-block;
        white-space: nowrap;
        word-wrap: normal;
        direction: ltr;
        -webkit-font-feature-settings: 'liga';
        -webkit-font-smoothing: antialiased;
        vertical-align: middle;
      }
      .ms-xs { font-size: 16px !important; }
      .ms-sm { font-size: 18px !important; }
      .ms-md { font-size: 24px !important; }
      .ms-lg { font-size: 32px !important; }
    </style>
    <script>
      (function() {
        const RUNTIME_BASE = ${JSON.stringify(runtimeBase)};
        const SCREENS_BY_ROLE = ${JSON.stringify(screensByRole)};
        window.__ICASE_RUNTIME_BASE__ = RUNTIME_BASE;
        window.__ICASE_SCREENS_BY_ROLE__ = SCREENS_BY_ROLE;

        if (!window.location.hash.includes('keepSession')) {
          try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          } catch (e) {}
        }

        // Interceptor de fetch para redirigir /api/* y /uploads/* al motor runtime del proyecto
        const origFetch = window.fetch.bind(window);
        window.fetch = function(input, init) {
          try {
            let url = typeof input === 'string' ? input : (input && input.url ? input.url : String(input));
            if (url.startsWith('/api/') && !url.startsWith('/api/projects/')) {
              url = RUNTIME_BASE + url;
              input = url;
            } else if (url.startsWith('/uploads/')) {
              url = RUNTIME_BASE + url;
              input = url;
            } else if (url.startsWith(window.location.origin + '/api/') && !url.includes('/api/projects/')) {
              const rel = url.slice(window.location.origin.length);
              input = RUNTIME_BASE + rel;
            } else if (url.startsWith(window.location.origin + '/uploads/')) {
              const rel = url.slice(window.location.origin.length);
              input = RUNTIME_BASE + rel;
            }
          } catch (e) {}
          return origFetch(input, init);
        };
      })();
    </script>
    <script crossorigin src="${assetsBase}/react.production.min.js"></script>
    <script crossorigin src="${assetsBase}/react-dom.production.min.js"></script>
  </head>
  <body class="bg-slate-50 text-slate-900">
    <div id="root"></div>
    <script src="${assetsBase}/live-bundle.js?v=${Date.now()}"></script>
  </body>
</html>`;
}

function renderScreenPreviewHtml(projectId, spec = {}, screenId = '', options = {}) {
  return renderFrontendPreviewHtml(projectId, spec, { ...options, screenId });
}

module.exports = {
  renderFrontendPreviewHtml,
  renderScreenPreviewHtml
};
