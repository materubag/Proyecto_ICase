'use strict';

const path = require('node:path');
const babelParser = require('./runtimeAssets/babelParser');

/**
 * Compila un archivo JS/JSX (ESM + JSX) a un módulo CommonJS ejecutable en el navegador
 * usando el AST oficial de @babel/parser (0 dependencias externas).
 */
function transpileModuleAst(sourceCode, moduleId) {
  const code = String(sourceCode || '');
  let ast;
  try {
    ast = babelParser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx']
    });
  } catch (err) {
    throw new Error(`Error de sintaxis en ${moduleId}: ${err.message}`);
  }

  function compileNode(node) {
    if (!node) return 'null';

    switch (node.type) {
      case 'JSXElement': {
        const open = node.openingElement;
        const tag = compileJsxTagName(open.name);
        const props = compileJsxAttributes(open.attributes);
        const children = compileJsxChildren(node.children);
        return `React.createElement(${tag}, ${props}${children.length ? ', ' + children.join(', ') : ''})`;
      }
      case 'JSXFragment': {
        const children = compileJsxChildren(node.children);
        return `React.createElement(React.Fragment, null${children.length ? ', ' + children.join(', ') : ''})`;
      }
      default:
        return compileSourceRange(node.start, node.end, node);
    }
  }

  function compileJsxTagName(nameNode) {
    if (nameNode.type === 'JSXIdentifier') {
      const name = nameNode.name;
      if (/^[a-z]/.test(name) || name.includes('-')) {
        return JSON.stringify(name);
      }
      return name;
    }
    if (nameNode.type === 'JSXMemberExpression') {
      return `${compileJsxTagName(nameNode.object)}.${nameNode.property.name}`;
    }
    return JSON.stringify('div');
  }

  function compileJsxAttributes(attrs) {
    if (!attrs || attrs.length === 0) return 'null';
    const parts = [];
    let currentObjProps = [];

    const flushObj = () => {
      if (currentObjProps.length > 0) {
        parts.push(`{ ${currentObjProps.join(', ')} }`);
        currentObjProps = [];
      }
    };

    for (const attr of attrs) {
      if (attr.type === 'JSXSpreadAttribute') {
        flushObj();
        parts.push(compileNode(attr.argument));
      } else if (attr.type === 'JSXAttribute') {
        const rawKey = attr.name.type === 'JSXNamespacedName'
          ? `${attr.name.namespace.name}:${attr.name.name.name}`
          : attr.name.name;
        const keyCode = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(rawKey) ? rawKey : JSON.stringify(rawKey);
        let valCode = 'true';
        if (attr.value) {
          if (attr.value.type === 'StringLiteral') {
            valCode = JSON.stringify(attr.value.value);
          } else if (attr.value.type === 'JSXExpressionContainer') {
            valCode = compileNode(attr.value.expression);
          } else {
            valCode = compileNode(attr.value);
          }
        }
        currentObjProps.push(`${keyCode}: ${valCode}`);
      }
    }
    flushObj();
    if (parts.length === 1) return parts[0];
    return `Object.assign({}, ${parts.join(', ')})`;
  }

  function compileJsxChildren(children) {
    const out = [];
    for (const child of children || []) {
      if (child.type === 'JSXText') {
        const cleaned = cleanJsxText(child.value);
        if (cleaned !== '') {
          out.push(JSON.stringify(cleaned));
        }
      } else if (child.type === 'JSXExpressionContainer') {
        if (child.expression.type !== 'JSXEmptyExpression') {
          out.push(compileNode(child.expression));
        }
      } else if (child.type === 'JSXElement' || child.type === 'JSXFragment') {
        out.push(compileNode(child));
      } else {
        out.push(compileNode(child));
      }
    }
    return out;
  }

  function cleanJsxText(raw) {
    const lines = String(raw || '').split(/\r\n|\n|\r/);
    let lastNonEmptyLine = 0;
    for (let i = 0; i < lines.length; i++) {
      if (/[^\s\t]/.test(lines[i])) lastNonEmptyLine = i;
    }
    let str = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isFirstLine = i === 0;
      const isLastLine = i === lines.length - 1;
      const isLastNonEmptyLine = i === lastNonEmptyLine;
      let trimmedLine = line.replace(/\t/g, ' ');
      if (!isFirstLine) trimmedLine = trimmedLine.replace(/^[ ]+/, '');
      if (!isLastLine) trimmedLine = trimmedLine.replace(/[ ]+$/, '');
      if (trimmedLine) {
        if (!isLastNonEmptyLine) trimmedLine += ' ';
        str += trimmedLine;
      }
    }
    return str;
  }

  // Reemplaza los sub-nodos JSX o Import/Export dentro de un rango [start, end]
  function compileSourceRange(start, end, parentNode) {
    const replacements = [];

    function walk(n) {
      if (!n || typeof n !== 'object') return;
      if (n !== parentNode && (n.type === 'JSXElement' || n.type === 'JSXFragment')) {
        replacements.push({
          start: n.start,
          end: n.end,
          text: compileNode(n)
        });
        return; // compileNode ya procesa recursivamente los hijos de este JSXElement
      }
      for (const key of Object.keys(n)) {
        if (key === 'loc' || key === 'LeadingComments' || key === 'TrailingComments') continue;
        const child = n[key];
        if (Array.isArray(child)) {
          for (const c of child) {
            if (c && typeof c.type === 'string') walk(c);
          }
        } else if (child && typeof child.type === 'string') {
          walk(child);
        }
      }
    }

    walk(parentNode);
    replacements.sort((a, b) => a.start - b.start);

    let cursor = start;
    let out = '';
    for (const r of replacements) {
      if (r.start < cursor) continue;
      out += code.slice(cursor, r.start) + r.text;
      cursor = r.end;
    }
    out += code.slice(cursor, end);
    return out;
  }

  // Transformación de sentencias de nivel superior (Import / Export + JSX)
  const bodyStatements = [];
  for (const stmt of ast.program.body) {
    if (stmt.type === 'ImportDeclaration') {
      const sourceVal = stmt.source.value;
      if (sourceVal.endsWith('.css')) {
        continue;
      }
      const specs = stmt.specifiers || [];
      if (specs.length === 0) {
        bodyStatements.push(`__require(${JSON.stringify(sourceVal)});`);
        continue;
      }
      const varId = `__imp_${stmt.start}`;
      const lines = [`const ${varId} = __require(${JSON.stringify(sourceVal)});`];
      for (const sp of specs) {
        if (sp.type === 'ImportDefaultSpecifier') {
          lines.push(`const ${sp.local.name} = (${varId} && ${varId}.__esModule) ? ${varId}.default : ${varId};`);
        } else if (sp.type === 'ImportNamespaceSpecifier') {
          lines.push(`const ${sp.local.name} = ${varId};`);
        } else if (sp.type === 'ImportSpecifier') {
          const importedName = sp.imported.name || sp.imported.value;
          lines.push(`const ${sp.local.name} = ${varId}[${JSON.stringify(importedName)}];`);
        }
      }
      bodyStatements.push(lines.join('\n'));
    } else if (stmt.type === 'ExportDefaultDeclaration') {
      const decl = stmt.declaration;
      const compiledDecl = compileNode(decl);
      if ((decl.type === 'FunctionDeclaration' || decl.type === 'ClassDeclaration') && decl.id) {
        bodyStatements.push(`${compiledDecl}\nexports.__esModule = true;\nexports.default = ${decl.id.name};`);
      } else {
        bodyStatements.push(`exports.__esModule = true;\nexports.default = ${compiledDecl};`);
      }
    } else if (stmt.type === 'ExportNamedDeclaration') {
      if (stmt.declaration) {
        const decl = stmt.declaration;
        const compiledDecl = compileNode(decl);
        const exportedNames = [];
        if (decl.type === 'FunctionDeclaration' || decl.type === 'ClassDeclaration') {
          if (decl.id) exportedNames.push(decl.id.name);
        } else if (decl.type === 'VariableDeclaration') {
          for (const d of decl.declarations || []) {
            if (d.id && d.id.type === 'Identifier') exportedNames.push(d.id.name);
          }
        }
        const assignLines = exportedNames.map(n => `exports[${JSON.stringify(n)}] = ${n};`).join('\n');
        bodyStatements.push(`${compiledDecl}\nexports.__esModule = true;\n${assignLines}`);
      } else if (stmt.specifiers && stmt.specifiers.length > 0) {
        const assignLines = stmt.specifiers.map(sp => {
          const expName = sp.exported.name || sp.exported.value;
          return `exports[${JSON.stringify(expName)}] = ${sp.local.name};`;
        }).join('\n');
        bodyStatements.push(`exports.__esModule = true;\n${assignLines}`);
      }
    } else {
      bodyStatements.push(compileNode(stmt));
    }
  }

  let transformed = bodyStatements.join('\n');
  // Reemplazar import.meta.env por objeto seguro en runtime
  transformed = transformed.replace(/import\.meta\.env/g, '({ VITE_API_URL: "/api" })');
  return transformed;
}

function normalizeModulePath(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/^frontend\/src\//, './')
    .replace(/\.(jsx|js)$/, '');
}

/**
 * Empaqueta todos los archivos generados en `frontend/src/**` del proyecto en un bundle JS
 * ejecutable directamente en el navegador para la Vista Previa Interactiva.
 */
async function buildLiveProjectFrontendBundle(projectId) {
  const codeGenService = require('./codeGenerator.service');
  const generated = await codeGenService.generateProjectFiles(projectId, {
    allowUnapproved: true,
    allowPartialScope: true,
    reviewOnly: true,
    includeDocker: false
  });

  const frontendFiles = (generated.files || []).filter(f =>
    f.path.startsWith('frontend/src/') &&
    (f.path.endsWith('.js') || f.path.endsWith('.jsx')) &&
    f.path !== 'frontend/src/main.jsx'
  );

  const moduleEntries = [];

  for (const file of frontendFiles) {
    const modKey = normalizeModulePath(file.path);
    const transpiled = transpileModuleAst(file.content, modKey);
    moduleEntries.push(`  ${JSON.stringify(modKey)}: function(module, exports, __require) {\n${transpiled}\n  }`);
  }

  return `(function() {
  const React = window.React;
  const ReactDOM = window.ReactDOM;

  const __modules = {
${moduleEntries.join(',\n')}
  };

  const __cache = {};

  function resolvePath(basePath, relPath) {
    if (relPath === 'react') return '__external_react__';
    if (relPath === 'react-dom' || relPath === 'react-dom/client') return '__external_react_dom__';
    if (!relPath.startsWith('.')) return relPath;

    const baseParts = basePath.split('/').slice(0, -1);
    const relParts = relPath.replace(/\\.(jsx|js)$/, '').split('/');
    const stack = [...baseParts];

    for (const part of relParts) {
      if (!part || part === '.') continue;
      if (part === '..') {
        if (stack.length > 1) stack.pop();
      } else {
        stack.push(part);
      }
    }
    return stack.join('/');
  }

  function createRequire(currentModKey) {
    return function __require(request) {
      const resolved = resolvePath(currentModKey, request);
      if (resolved === '__external_react__') return window.React;
      if (resolved === '__external_react_dom__') return window.ReactDOM;
      if (__cache[resolved]) return __cache[resolved].exports;

      const factory = __modules[resolved];
      if (!factory) {
        console.warn('[i-CASE LiveBundler] Módulo no encontrado:', resolved, 'desde', currentModKey);
        return {};
      }
      const module = { exports: {} };
      __cache[resolved] = module;
      factory(module, module.exports, createRequire(resolved));
      return module.exports;
    };
  }

  try {
    const rootRequire = createRequire('./main');
    const appMod = rootRequire('./App');
    const App = (appMod && appMod.__esModule) ? appMod.default : appMod;
    const container = document.getElementById('root');
    if (container && App) {
      const root = ReactDOM.createRoot ? ReactDOM.createRoot(container) : null;
      if (root) {
        root.render(React.createElement(App, null));
      } else if (ReactDOM.render) {
        ReactDOM.render(React.createElement(App, null), container);
      }
    }
  } catch (err) {
    console.error('[i-CASE LiveBundler] Error al montar la aplicación:', err);
    const container = document.getElementById('root');
    if (container) {
      container.innerHTML = '<div style="padding:24px;color:#b91c1c;font-family:sans-serif;"><h3>Error al compilar vista previa</h3><pre>' + String(err && err.stack || err) + '</pre></div>';
    }
  }
})();`;
}

module.exports = {
  transpileModuleAst,
  buildLiveProjectFrontendBundle
};
