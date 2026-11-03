/**
 * React Frontend Generator
 * Generates an interactive SPA with dynamic Dashboard, CRUD views, forms, modals,
 * and high-fidelity functional screens based on approved project specifications.
 */

const { toPascalCase, toCamelCase, toSnakeCasePlural, deriveNaming, normalizeAttributes } = require('./typeMapper');
const { generateEntityViewPage } = require('./functionalPagesGenerator');

function generateFrontendPackageJson(projectName = 'app') {
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-|-$/g, '') || 'app-frontend';

  return JSON.stringify({
    name: `${safeName}-frontend`,
    version: '1.0.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview'
    },
    dependencies: {
      react: '^18.3.1',
      'react-dom': '^18.3.1'
    },
    devDependencies: {
      '@vitejs/plugin-react': '^4.3.1',
      autoprefixer: '^10.4.20',
      postcss: '^8.4.47',
      tailwindcss: '^3.4.14',
      vite: '^5.4.2'
    }
  }, null, 2);
}

function generateViteConfig() {
  return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
});
`;
}

function generateIndexHtml(projectName = 'Aplicación') {
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName} — Sistema de Gestión</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
  </head>
  <body class="bg-slate-50 text-slate-800">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;
}

function generateFrontendDockerfile() {
  return `# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
}

function generateFrontendNginxConf() {
  return `server {
    listen 80;
    server_name localhost;

    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`;
}

function generateTailwindConfig() {
  return `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: []
};
`;
}

function generatePostcssConfig() {
  return `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
`;
}

function generateFrontendCss() {
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

/**
 * Global Stylesheet for Generated SPA
 * Follows DESIGN_SYSTEM.md (v3.0 - Estándar Esencial Minimalista)
 */

* { box-sizing: border-box; }
.icase-shell { display: flex; flex-direction: column; min-height: 100vh; background: var(--color-bg-app); }
.icase-topbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 1.25rem; min-height: 64px; padding: .65rem 1.25rem; background: #ffffff; border-bottom: 1px solid var(--color-border); }
.icase-brand { display: flex; align-items: center; gap: .7rem; flex-shrink: 0; }
.icase-brand span { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: var(--color-primary); color: #fff; font-weight: 700; }
.icase-brand strong { display: block; font-size: .95rem; line-height: 1.1; }
.icase-brand small { display: inline-flex; margin-top: .2rem; padding: .1rem .45rem; border-radius: 999px; background: #f1f5f9; color: var(--color-text-muted); font-size: .68rem; font-weight: 600; }
.icase-topnav { display: flex; align-items: stretch; gap: .15rem; flex: 1; min-width: 0; overflow-x: auto; }
.icase-topnav button { appearance: none; border: 0; background: transparent; color: #64748b; font: inherit; font-size: .88rem; font-weight: 500; padding: .85rem .7rem; white-space: nowrap; cursor: pointer; border-bottom: 2px solid transparent; }
.icase-topnav button.active { color: var(--color-primary); font-weight: 600; border-bottom-color: var(--color-primary); }
.icase-session { display: flex; align-items: center; gap: .65rem; margin-left: auto; flex-shrink: 0; }
.icase-session strong { font-size: .8rem; }
.icase-session span { color: var(--color-text-muted); font-size: .75rem; }
.icase-session button { appearance: none; border: 1px solid var(--color-border); background: #fff; border-radius: 8px; padding: .45rem .7rem; font: inherit; font-size: .78rem; cursor: pointer; }
.icase-menu-toggle { display: none; }
.icase-nav-overlay { display: none; }
.icase-content { min-width: 0; flex: 1; }
@media(max-width: 900px) {
  .icase-menu-toggle { display: inline-flex; margin-left: auto; padding: .45rem .7rem; border: 1px solid var(--color-border); background: #fff; border-radius: 8px; }
  .icase-topnav { display: none; position: absolute; top: 64px; left: 0; right: 0; flex-direction: column; background: #fff; border-bottom: 1px solid var(--color-border); padding: .5rem; }
  .icase-topnav[data-open=true] { display: flex; }
  .icase-nav-overlay { display: block; position: fixed; inset: 64px 0 0; z-index: 19; border: 0; background: #0f172a66; }
  .icase-session span { display: none; }
}
.contract-task { padding: 1rem; max-width: 1280px; margin: auto; }
.contract-task:has(.mockup-screen) { max-width: none; padding: 0; }
.contract-task:has(.mockup-screen) > nav { display: none; }
.icase-content:has(.mockup-screen) { padding: 0; }
.icase-content:has(.mockup-screen) .icase-task-header { display: none; }
.mockup-screen { min-width: 0; }
.mockup-screen [data-contract-form], .mockup-screen .contract-table { margin: 0; max-width: none; }
.mockup-screen form[data-contract-form] { max-width: none; padding: 0; background: transparent; border: 0; border-radius: 0; }
.mockup-live-region { padding: 1.25rem; }
.mockup-live-panel { display: none; }
.contract-purpose { color: var(--color-text-muted); margin: 0 0 1.25rem; }
.contract-task-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr); gap: 1.5rem; align-items: start; }
.contract-panel, .contract-table { padding: 1.5rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); margin-bottom: 1.5rem; min-width: 0; overflow-x: auto; }
.contract-task table { width: 100%; border-collapse: collapse; }
.contract-table button { padding: .65rem .85rem; border: 1px solid var(--color-border); background: white; color: var(--color-primary); border-radius: var(--radius-sm); cursor: pointer; }
@media(max-width: 640px) { .contract-table table, .contract-table tbody, .contract-table tr { display: block; width: 100%; } .contract-table thead { display: none; } .contract-table tr { border: 1px solid var(--color-border); border-radius: var(--radius-sm); margin-bottom: 1rem; } .contract-task .contract-table td { display: grid; grid-template-columns: minmax(90px, 40%) minmax(0, 1fr); gap: .5rem; overflow-wrap: anywhere; } .contract-table td::before { content: attr(data-label); font-weight: 600; } }
.contract-task td, .contract-task th { padding: .75rem; text-align: left; border-bottom: 1px solid var(--color-border); }
.contract-task nav { display: flex; flex-wrap: wrap; gap: .75rem; }
.contract-task nav button { padding: .75rem; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: white; }
.contract-image-preview { position: fixed; inset: 0; z-index: 50; background: #0f172aee; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 1rem; }
.contract-image-preview img { max-width: 90vw; max-height: 80vh; object-fit: contain; background: white; }
.contract-image-preview button { padding: .75rem 1rem; border: 0; border-radius: 6px; }
.contract-error { padding: 1rem; color: var(--status-danger); background: var(--status-danger-bg); }
.contract-success { padding: 1rem; color: var(--status-success); background: var(--status-success-bg); }
@media(max-width: 760px) { .contract-task-grid { grid-template-columns: minmax(0, 1fr); } .contract-task { padding: .5rem; } }
.dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; }
.dashboard-card { text-align: left; cursor: pointer; width: 100%; font: inherit; color: inherit; }
.dashboard-card h3 { margin: .35rem 0 .5rem; }
.dashboard-card-kicker { font-size: .75rem; letter-spacing: .06em; text-transform: uppercase; color: var(--color-text-muted); font-weight: 600; }
.entity-page { padding: 1rem; max-width: 1280px; margin: auto; }
.form-group { min-width: 0; margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: .4rem; font-weight: 600; }
.form-group input, .form-group select, .form-group textarea { width: 100%; max-width: 100%; padding: .65rem; border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
.form-group input[type=checkbox] { width: auto; }
.mockup-content-wrapper { max-width: 100%; overflow-x: auto; padding: 1rem; }
form[data-contract-form] { max-width: 760px; padding: 1.5rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
button[data-action-id] { padding: .7rem 1.25rem; border: 0; border-radius: var(--radius-sm); background: var(--color-primary); color: white; font-weight: 600; cursor: pointer; }
.field-automatic { display: block; margin-bottom: 1rem; color: var(--color-text-muted); font-size: .85rem; }
@media(max-width: 640px) { table { display: block; max-width: 100%; overflow-x: auto; } input, select, textarea, button { min-height: 44px; } }
:root {
  --color-primary: #4f46e5;
  --color-primary-hover: #4338ca;
  --color-primary-subtle: #eef2ff;
  --color-bg-app: #f8fafc;
  --color-surface: #ffffff;
  --color-border: #e2e8f0;
  --color-border-focus: #6366f1;
  --color-text-title: #0f172a;
  --color-text-body: #334155;
  --color-text-muted: #64748b;
  --color-text-placeholder: #94a3b8;
  --status-success: #16a34a;
  --status-success-bg: #f0fdf4;
  --status-warning: #d97706;
  --status-warning-bg: #fffbeb;
  --status-danger: #dc2626;
  --status-danger-bg: #fef2f2;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 16px;
  --shadow-card: 0 1px 3px rgba(15, 23, 42, 0.04);

  /* Semantic Aliases */
  --primary: var(--color-primary);
  --primary-hover: var(--color-primary-hover);
  --bg-main: var(--color-bg-app);
  --surface: var(--color-surface);
  --text-main: var(--color-text-title);
  --text-muted: var(--color-text-muted);
  --border: var(--color-border);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Inter', sans-serif;
  background-color: var(--bg-main);
  color: var(--text-main);
  line-height: 1.5;
}

/* Nav styles */
.sidebar {
  width: 260px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  color: var(--text-muted);
  border-radius: 6px;
  cursor: pointer;
  margin: 2px 8px;
  font-size: 0.88rem;
  transition: all 0.15s ease;
}

.nav-item:hover {
  background: #f1f5f9;
  color: var(--text-main);
}

.nav-item.active {
  background: #eff6ff;
  color: var(--primary);
  font-weight: 600;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background-color 0.15s;
}

.btn-primary {
  background-color: var(--primary);
  color: #fff;
}

.btn-primary:hover {
  background-color: var(--primary-hover);
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px;
}
`;
}

function generateApiClientJs() {
  return `/**
 * Cliente HTTP unificado para la API REST de Express + Sequelize
 * Soporta métodos REST estándar (GET, POST, PUT, PATCH, DELETE),
 * inyecta automáticamente el token de autenticación desde localStorage,
 * retorna directamente el payload data y propaga errores estructurados del servidor.
 */

const API_BASE = '/api';

export async function apiRequest(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : \`/\${endpoint}\`;
  const url = cleanEndpoint.startsWith('/api') ? cleanEndpoint : \`\${API_BASE}\${cleanEndpoint}\`;

  // Obtener token de autenticación de la sesión si existe
  const token = typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('token') : null;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': \`Bearer \${token}\` } : {}),
      ...options.headers
    },
    ...options
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const json = await response.json().catch(() => ({}));

  if (!response.ok || json.success === false) {
    if (response.status === 401 && (json.code === 'TOKEN_EXPIRED' || json.code === 'UNAUTHENTICATED')) {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('token');
        window.localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth:expired'));
      }
    }
    const error = new Error(json.message || json.error || \`Error HTTP \${response.status}\`);
    error.status = response.status;
    error.details = json;
    throw error;
  }

  // Contrato unificado: Retorna directamente json.data
  return json.data !== undefined ? json.data : json;
}

const apiClient = {
  request: apiRequest,
  get: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'PUT', body }),
  patch: (endpoint, body, options = {}) => apiRequest(endpoint, { ...options, method: 'PATCH', body }),
  delete: (endpoint, options = {}) => apiRequest(endpoint, { ...options, method: 'DELETE' })
};

export default apiClient;
`;
}

function generateMainJsx() {
  return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
}

function generateDashboardJsx(projectName = 'Aplicación', entities = [], compiledMockups = []) {
  const operationalMockups = (compiledMockups || []).filter(m =>
    !/iniciodesesi|accesoalsistema|login|auth/i.test((m.key || '') + ' ' + (m.compName || '') + ' ' + (m.title || ''))
  );

  const hideEntityNav = operationalMockups.length > 0;
  const entityCards = hideEntityNav ? '' : entities.map(e => {
    const naming = deriveNaming(e.name);
    return `        <button type="button" className="contract-panel dashboard-card" onClick={() => setActiveTab('${naming.endpoint}')}>
          <span className="dashboard-card-kicker">Consulta</span>
          <h3>${(e.name || naming.modelName).replace(/_/g, ' ')}</h3>
          <span>Abrir listado</span>
        </button>`;
  }).join('\n');

  const screenCards = operationalMockups.map(m => {
    return `        <button type="button" className="contract-panel dashboard-card" onClick={() => setActiveTab(${JSON.stringify(m.key)})}>
          <span className="dashboard-card-kicker">Tarea</span>
          <h3>{${JSON.stringify(m.title)}}</h3>
          <span>Continuar el proceso</span>
        </button>`;
  }).join('\n');

  return `import React from 'react';

export default function Dashboard({ setActiveTab, user = null }) {
  const roleName = user?.role || user?.rol || 'Sesión';
  const userName = user?.nombre || user?.username || user?.email || 'Usuario';

  return (
    <div className="contract-task">
      <section className="contract-panel">
        <p className="dashboard-card-kicker">{roleName}</p>
        <h1>${projectName}</h1>
        <p className="contract-purpose">Hola {userName}. Elige una tarea para continuar el proceso.</p>
      </section>
      <div className="dashboard-grid">
${screenCards || entityCards}
      </div>
    </div>
  );
}
`;
}

function generateLoginPageJsx(projectName = 'Aplicación') {
  const domain = projectName ? projectName.toLowerCase().replace(/[^a-z0-9]/g, '') : 'app';
  return `import React, { useState } from 'react';
import apiClient from '../api/client';

/**
 * Pantalla de Inicio de Sesión según DESIGN_SYSTEM.md (v3.0)
 * Valida credenciales contra el backend (/api/auth/login), guarda el JWT y session info,
 * y propaga errores reales sin admitir suplantación visual de roles.
 */
export default function LoginPage({ onLoginSuccess }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/auth/login', {
        identifier,
        password
      });

      const token = response.token || response.data?.token;
      const user = response.user || response.data?.user;

      if (!token) {
        throw new Error('Respuesta inválida del servidor: No se recibió token de sesión.');
      }

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user || {}));

      if (onLoginSuccess) {
        onLoginSuccess(token, user);
      }
    } catch (err) {
      setError(err.details?.message || err.message || 'Error al autenticar credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--color-bg-app)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg, 16px)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
        padding: '36px 32px'
      }}>
        {/* Cabecera */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text-title)', marginBottom: '6px' }}>
            ${projectName}
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            Inicio de sesión seguro para usuarios autorizados
          </p>
        </div>

        {/* Mensaje de Error */}
        {error && (
          <div style={{
            marginBottom: '20px',
            padding: '12px 14px',
            backgroundColor: 'var(--status-danger-bg)',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-md)',
            color: 'var(--status-danger)',
            fontSize: '0.85rem'
          }}>
            ✗ {error}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-body)', marginBottom: '6px' }}>
              Usuario o Correo Electrónico
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="ej. usuario@ejemplo.com"
              style={{
                width: '100%',
                height: '44px',
                padding: '0 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: '0.875rem',
                color: 'var(--color-text-title)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-body)', marginBottom: '6px' }}>
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                height: '44px',
                padding: '0 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                fontSize: '0.875rem',
                color: 'var(--color-text-title)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '44px',
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'background-color 0.15s ease'
            }}
          >
            {loading ? 'Verificando...' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Acceso Rápido con Credenciales Semilla */}
        <div style={{
          marginTop: '20px',
          padding: '12px 14px',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 'var(--radius-md, 8px)',
          fontSize: '0.8125rem',
          color: '#1e40af',
          textAlign: 'left'
        }}>
          <strong style={{ display: 'block', marginBottom: '4px' }}>🔑 Credenciales de Acceso Rápido (Semilla):</strong>
          <div>• <strong>Usuario:</strong> <code>admin</code> (o <code>admin@${domain}.com</code>)</div>
          <div>• <strong>Contraseña:</strong> <code>admin123</code></div>
          <button
            type="button"
            onClick={() => { setIdentifier('admin'); setPassword('admin123'); }}
            style={{
              marginTop: '6px',
              padding: '0',
              background: 'none',
              border: 'none',
              color: '#2563eb',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Autocompletar formulario
          </button>
        </div>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          Autenticación JWT gestionada por backend Express + Sequelize
        </div>
      </div>
    </div>
  );
}
`;
}

const { compactNavLabel } = require('./screenContract');

function generateAppJsx(projectName = 'Aplicación', entities = [], customPages = [], actors = [], compiledMockups = [], options = {}) {
  const { hasAuth = false } = options;
  const taskEntityIds = new Set(customPages.filter(s => s.contract?.renderer === 'task').map(s => s.contract.entityId).filter(Boolean));
  const hideEntityNav = (compiledMockups || []).length > 0;

  const visibleEntities = hideEntityNav ? [] : entities;
  const entityImports = visibleEntities.map(e => {
    const naming = deriveNaming(e.name);
    return `import ${naming.modelName}Page from './pages/${naming.modelName}Page';`;
  }).join('\n');

  const entityPageSwitches = visibleEntities.map(e => {
    const naming = deriveNaming(e.name);
    return `      {navItems.some(item => item.key === '${naming.endpoint}') && resolvedTab === '${naming.endpoint}' && <${naming.modelName}Page />}`;
  }).join('\n');

  // Compiled mockups tabs (omitiendo pantallas de inicio de sesión que ya gestiona LoginPage)
  const operationalMockups = (compiledMockups || []).filter(m =>
    !/iniciodesesi|accesoalsistema|login|auth/i.test((m.key || '') + ' ' + (m.compName || '') + ' ' + (m.title || ''))
  ).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  const mockupImports = operationalMockups.map(m => `import ${m.compName} from './pages/mockups/${m.compName}';`).join('\n');

  const mockupSwitches = operationalMockups.map(m => `      {navItems.some(item => item.key === '${m.key}') && resolvedTab === '${m.key}' && (
        <${m.compName} onNavigate={setActiveTab} />
      )}`).join('\n');

  const adminDefaultMockup = operationalMockups[0];
  const defaultTab = adminDefaultMockup ? `'${adminDefaultMockup.key}'` : "'dashboard'";
  const navEntries = [
    ...operationalMockups.map(m => `    { key: ${JSON.stringify(m.key)}, label: ${JSON.stringify(compactNavLabel(m.title))}, icon: 'task_alt', role: ${JSON.stringify(m.roles?.[0] || '')}, roles: ${JSON.stringify(m.roles || [])}, isEntity: false }`),
    ...(hideEntityNav ? [] : entities.filter(e => !taskEntityIds.has(e.id) && !/(detalle|item|permiso|falla|multimedia)/i.test((e.name || '') + (e.modelName || ''))).map(e => {
      const naming = deriveNaming(e.name);
      const label = (e.name || naming.modelName).replace(/_/g, ' ');
      return `    { key: ${JSON.stringify(naming.endpoint)}, label: ${JSON.stringify(label)}, icon: 'dataset', roles: ${JSON.stringify(e.permissions || [])}, isEntity: true }`;
    }))
  ];

  return `import React, { useState, useEffect } from 'react';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
${hasAuth ? `import LoginPage from './pages/LoginPage';\n` : ''}${entityImports}
${mockupImports}

export default function App() {
  const [activeTab, setActiveTab] = useState(${defaultTab});
  const allNavItems = [
${navEntries.join(',\n')}
  ];

${hasAuth ? `  const [session, setSession] = useState(() => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      return token ? { token, user: userStr ? JSON.parse(userStr) : null } : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleExpired = () => {
      setSession(null);
    };
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  const cleanStr = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const getInitialTab = (u) => {
    const role = cleanStr(u?.role || u?.rol || '');
    const match = allNavItems.find(item => !item.isEntity && item.role && cleanStr(item.role) === role);
    return match ? match.key : ${defaultTab};
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setSession(null);
    setActiveTab(${defaultTab});
  };

  if (!session || !session.token) {
    return <LoginPage onLoginSuccess={(token, user) => { setSession({ token, user }); setActiveTab(getInitialTab(user)); }} />;
  }
` : ''}

  const currentUserRole = ${hasAuth ? '(session?.user?.role || session?.user?.rol || null)' : 'null'};
  const navItems = allNavItems.filter(item => {
    ${hasAuth ? "const role = cleanStr(currentUserRole); if (!Array.isArray(item.roles) || item.roles.length === 0) return /admin/.test(role); return item.roles.some(r => cleanStr(r) === role);" : "return true;"}
  });

  const resolvedTab = navItems.some(item => item.key === activeTab) ? activeTab : (navItems[0]?.key || 'dashboard');
  return (
    <AppShell
      title="${projectName}"
      user={${hasAuth ? 'session?.user' : 'null'}}
      onLogout={${hasAuth ? 'handleLogout' : 'null'}}
      navItems={navItems}
      activeTab={resolvedTab}
      onSelectTab={setActiveTab}
    >
      {resolvedTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} user={${hasAuth ? 'session?.user' : 'null'}} />}
${mockupSwitches}
${entityPageSwitches}
    </AppShell>
  );
}
`;
}

function generateAppShellComponent() {
  return require('fs').readFileSync(require.resolve('./appShellTemplate.jsx'), 'utf8');
}

function generateSharedFormFieldComponent() {
  return `import React from 'react';

/**
 * Campo de Entrada estandarizado según DESIGN_SYSTEM.md (Sección 4.1)
 */
export default function FormField({ label, name, type = 'text', value, onChange, placeholder, required = false, error = null }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      {label && (
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-body)', marginBottom: '6px' }}>
          {label} {required && <span style={{ color: 'var(--status-danger)' }}>*</span>}
        </label>
      )}
      <input
        type={type}
        name={name}
        id={name}
        value={value !== undefined && value !== null ? value : ''}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%',
          height: '44px',
          padding: '0 14px',
          borderRadius: 'var(--radius-md)',
          border: error ? '1px solid var(--status-danger)' : '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          fontSize: '0.875rem',
          color: 'var(--color-text-title)',
          outline: 'none',
          boxSizing: 'border-box'
        }}
      />
      {error && (
        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--status-danger)', marginTop: '4px' }}>
          {error}
        </span>
      )}
    </div>
  );
}
`;
}

function generateSharedButtonComponent() {
  return `import React from 'react';

/**
 * Botón Minimalista estandarizado según DESIGN_SYSTEM.md (Sección 4.2)
 */
export default function Button({ children, onClick, type = 'button', variant = 'primary', disabled = false, fullWidth = false }) {
  const isPrimary = variant === 'primary';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: fullWidth ? '100%' : 'auto',
        height: '44px',
        padding: '0 20px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: isPrimary ? 'var(--color-primary)' : 'var(--color-surface)',
        color: isPrimary ? '#ffffff' : 'var(--color-text-body)',
        border: isPrimary ? 'none' : '1px solid var(--color-border)',
        fontSize: '0.875rem',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.15s ease',
        boxSizing: 'border-box'
      }}
    >
      {children}
    </button>
  );
}
`;
}

function generateSharedStatusBadgeComponent() {
  return `import React from 'react';

/**
 * Badge de Estado Semántico Ligero según DESIGN_SYSTEM.md (Sección 4.3)
 */
export default function StatusBadge({ status = 'info', label }) {
  let bg = '#eff6ff';
  let text = '#1d4ed8';
  let dot = '#3b82f6';

  const s = String(status).toLowerCase();
  if (s.includes('succ') || s.includes('aprob') || s.includes('complet') || s.includes('confirm') || s.includes('act')) {
    bg = 'var(--status-success-bg, #f0fdf4)';
    text = 'var(--status-success, #16a34a)';
    dot = '#16a34a';
  } else if (s.includes('warn') || s.includes('pend') || s.includes('proc') || s.includes('revis')) {
    bg = 'var(--status-warning-bg, #fffbeb)';
    text = 'var(--status-warning, #d97706)';
    dot = '#d97706';
  } else if (s.includes('dang') || s.includes('err') || s.includes('rech') || s.includes('canc')) {
    bg = 'var(--status-danger-bg, #fef2f2)';
    text = 'var(--status-danger, #dc2626)';
    dot = '#dc2626';
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      borderRadius: 'var(--radius-sm)',
      backgroundColor: bg,
      color: text,
      fontSize: '0.75rem',
      fontWeight: 500,
      border: '1px solid rgba(0,0,0,0.05)'
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dot }} />
      <span>{label || status}</span>
    </span>
  );
}
`;
}

module.exports = {
  generateFrontendPackageJson,
  generateViteConfig,
  generateTailwindConfig,
  generatePostcssConfig,
  generateIndexHtml,
  generateFrontendDockerfile,
  generateFrontendNginxConf,
  generateFrontendCss,
  generateApiClientJs,
  generateMainJsx,
  generateAppJsx,
  generateDashboardJsx,
  generateEntityViewPage,
  generateAppShellComponent,
  generateLoginPageJsx,
  generateSharedFormFieldComponent,
  generateSharedButtonComponent,
  generateSharedStatusBadgeComponent
};
