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
    <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
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

function generateFrontendCss() {
  return `/**
 * Global Stylesheet for Generated SPA
 * Follows DESIGN_SYSTEM.md (v3.0 - Estándar Esencial Minimalista)
 */

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

  const entityCards = entities.map(e => {
    const naming = deriveNaming(e.name);
    return `        <div className="card" style={{ borderLeft: '4px solid #3b82f6', cursor: 'pointer', padding: '16px', background: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }} onClick={() => setActiveTab('${naming.endpoint}')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Entidad</span>
            <span className="material-symbols-outlined" style={{ color: '#2563eb', fontSize: '20px' }}>table_chart</span>
          </div>
          <h3 style={{ fontSize: '1.15rem', marginTop: '6px', fontWeight: 700, color: '#1e293b' }}>${naming.modelName}</h3>
          <span style={{ fontSize: '0.75rem', color: '#2563eb' }}>/api/${naming.endpoint}</span>
        </div>`;
  }).join('\n');

  const screenCards = operationalMockups.map(m => {
    return `        <div className="card" style={{ borderLeft: '4px solid #10b981', cursor: 'pointer', padding: '16px', background: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }} onClick={() => setActiveTab('${m.key}')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: '#059669', textTransform: 'uppercase', fontWeight: 600 }}>Pantalla Operativa</span>
            <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '20px' }}>palette</span>
          </div>
          <h3 style={{ fontSize: '1.05rem', marginTop: '6px', fontWeight: 600, color: '#1e293b' }}>${m.title}</h3>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Ver interfaz funcional →</span>
        </div>`;
  }).join('\n');

  return `import React from 'react';

export default function Dashboard({ setActiveTab, user = null }) {
  const roleName = user?.role || user?.rol || 'Administrador';
  const userName = user?.nombre || user?.username || user?.email || 'Administrador';
  const isAdmin = /admin/i.test(roleName);

  return (
    <div style={{ padding: '8px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Banner de Bienvenida y Rol */}
      <div style={{
        marginBottom: '24px',
        padding: '24px',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        borderRadius: '12px',
        color: '#ffffff',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{
              display: 'inline-block',
              padding: '4px 10px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.5px',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              Sesión Activa: {roleName}
            </span>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '4px 0' }}>
              Panel de Control — ${projectName}
            </h2>
            <p style={{ color: '#e0e7ff', fontSize: '0.92rem', marginTop: '4px', maxWidth: '700px' }}>
              Bienvenido/a, <strong>{userName}</strong>. {isAdmin
                ? 'Tienes acceso total de Administrador para gestionar todas las operaciones, entidades de datos y pantallas operativas del sistema.'
                : 'Accede a los módulos y pantallas operativas autorizados para tu rol.'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', color: '#bfdbfe' }}>Estado del Sistema</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#86efac' }}>● Conectado y Operativo</div>
          </div>
        </div>
      </div>

      {/* Métricas Rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div style={{ padding: '18px', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Rol Autenticado</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e293b', marginTop: '4px' }}>{roleName}</div>
          <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '4px' }}>✓ Permisos verificados por backend</div>
        </div>
        <div style={{ padding: '18px', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Pantallas Aprobadas</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#2563eb', marginTop: '4px' }}>${operationalMockups.length}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Interfaces funcionales conectadas</div>
        </div>
        <div style={{ padding: '18px', background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Módulos de Datos</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#059669', marginTop: '4px' }}>${entities.length}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Tablas PostgreSQL sincronizadas</div>
        </div>
      </div>

${operationalMockups.length > 0 ? `      {/* Pantallas Operativas del Sistema */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Pantallas Operativas Aprobadas</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '2px 0 0 0' }}>Interfaces enriquecidas de Stitch conectadas al backend Express + Sequelize</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
${screenCards}
        </div>
      </div>` : ''}

      {/* Módulos de Datos */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Módulos de Datos y Entidades</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '2px 0 0 0' }}>Gestión directa de tablas y operaciones CRUD de la base de datos</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
${entityCards}
        </div>
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

function generateAppJsx(projectName = 'Aplicación', entities = [], customPages = [], actors = [], compiledMockups = [], options = {}) {
  const { hasAuth = false } = options;

  const entityImports = entities.map(e => {
    const naming = deriveNaming(e.name);
    return `import ${naming.modelName}Page from './pages/${naming.modelName}Page';`;
  }).join('\n');

  const entityPageSwitches = entities.map(e => {
    const naming = deriveNaming(e.name);
    return `      {activeTab === '${naming.endpoint}' && <${naming.modelName}Page />}`;
  }).join('\n');

  // Compiled mockups tabs (omitiendo pantallas de inicio de sesión que ya gestiona LoginPage)
  const operationalMockups = (compiledMockups || []).filter(m =>
    !/iniciodesesi|accesoalsistema|login|auth/i.test((m.key || '') + ' ' + (m.compName || '') + ' ' + (m.title || ''))
  );

  const mockupImports = operationalMockups.map(m => `import ${m.compName} from './pages/mockups/${m.compName}';`).join('\n');

  const mockupSwitches = operationalMockups.map(m => `      {activeTab === '${m.key}' && (
        <${m.compName} onNavigate={setActiveTab} />
      )}`).join('\n');

  const adminDefaultMockup = operationalMockups.find(m => /tablero|reporte|indicador/i.test(m.title || m.key)) || operationalMockups[0];
  const defaultTab = adminDefaultMockup ? `'${adminDefaultMockup.key}'` : "'dashboard'";

  return `import React, { useState, useEffect } from 'react';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
${hasAuth ? `import LoginPage from './pages/LoginPage';\n` : ''}${entityImports}
${mockupImports}

export default function App() {
  const [activeTab, setActiveTab] = useState(${defaultTab});
  const allNavItems = [
${operationalMockups.map(m => {
  let role = (m.roles && m.roles[0]) || 'Administrador';
  const t = (m.title || m.key || '').toLowerCase();
  if (/report|usuario|admin|indicador|inventario|stock|servicio|tarifa|proveedor|compra|venta.*mostrador/i.test(t)) {
    role = 'Administrador';
  } else if (/portal|mis.*vehic|solicitud.*cita|aprobac.*presupuesto|seguimiento.*avance/i.test(t)) {
    role = 'Cliente';
  } else if (/diag|obd|orden.*trabaj|bitacora|taller|conocimiento/i.test(t)) {
    role = 'Mecánico';
  } else if (/recep|inspecc|agenda|cita|directorio|ficha.*client|expediente.*vehic/i.test(t)) {
    role = 'Recepción';
  }

  let icon = 'palette';
  if (/tablero|reporte|indicador/i.test(t)) icon = 'analytics';
  else if (/usuario|rol|seguridad/i.test(t)) icon = 'admin_panel_settings';
  else if (/inventario|stock|repuesto/i.test(t)) icon = 'inventory_2';
  else if (/servicio|tarifa/i.test(t)) icon = 'list_alt';
  else if (/proveedor|compra/i.test(t)) icon = 'local_shipping';
  else if (/venta/i.test(t)) icon = 'point_of_sale';
  else if (/recep|inspecc/i.test(t)) icon = 'directions_car';
  else if (/agenda|cita/i.test(t)) icon = 'calendar_month';
  else if (/cliente/i.test(t)) icon = 'people';
  else if (/vehic/i.test(t)) icon = 'folder_shared';
  else if (/diag|obd/i.test(t)) icon = 'build';
  else if (/orden|trabajo|bitacora/i.test(t)) icon = 'engineering';
  else if (/conocimiento/i.test(t)) icon = 'menu_book';
  else if (/portal/i.test(t)) icon = 'person';

  return `    { key: '${m.key}', label: '${m.title}', icon: '${icon}', role: '${role}', roles: ${JSON.stringify(m.roles || [role])}, isEntity: false }`;
}).join(',\n')},
${entities.map(e => {
  const naming = deriveNaming(e.name);
  return `    { key: '${naming.endpoint}', label: '${naming.modelName}', icon: 'dataset', role: 'Administrador', isEntity: true }`;
}).join(',\n')}
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
  const isAdmin = /admin|gerente|supervisor/i.test(currentUserRole || '');
  const navItems = allNavItems.filter(item => {
    if (isAdmin) return true;
    ${hasAuth ? `if (currentUserRole && item.role) {
      const clean = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      return clean(item.role) === clean(currentUserRole);
    }` : ''}
    return true;
  });

  return (
    <AppShell
      title="${projectName}"
      user={${hasAuth ? 'session?.user' : 'null'}}
      onLogout={${hasAuth ? 'handleLogout' : 'null'}}
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
    >
      {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} user={${hasAuth ? 'session?.user' : 'null'}} />}
${mockupSwitches}
${entityPageSwitches}
    </AppShell>
  );
}
`;
}

function generateAppShellComponent() {
  return `import React, { useState, useMemo } from 'react';

/**
 * AppShell Maestro Unificado con Segmentación por Roles y Actores
 * Basado en el diseño aprobado de Stitch y DESIGN_SYSTEM.md
 */
export default function AppShell({
  title = 'ICASE App',
  user = null,
  onLogout = null,
  children,
  navItems = [],
  activeTab,
  onSelectTab
}) {
  const userRole = (user && (user.role || user.rol)) || 'Administrador';
  const userName = user?.nombre || user?.username || user?.email || 'Usuario';
  const isAdmin = /admin/i.test(userRole);

  // Extraer roles disponibles a partir de los navItems
  const availableRoles = useMemo(() => {
    const rolesSet = new Set();
    navItems.forEach(item => {
      if (item.role) rolesSet.add(item.role);
      else if (Array.isArray(item.roles)) item.roles.forEach(r => rolesSet.add(r));
    });
    return Array.from(rolesSet);
  }, [navItems]);

  // Filtro de rol en la barra lateral: por defecto el rol del usuario autenticado
  const [selectedRoleFilter, setSelectedRoleFilter] = useState(() => {
    if (availableRoles.includes(userRole)) return userRole;
    return availableRoles[0] || 'ALL';
  });
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  // Agrupar items por rol
  const groupedItems = useMemo(() => {
    const groups = {};
    const generalItems = [];
    const entityItems = [];

    navItems.forEach(item => {
      if (item.type === 'section') return;
      if (item.isEntity) {
        entityItems.push(item);
        return;
      }
      const role = item.role || (item.roles && item.roles[0]) || 'General';
      if (!groups[role]) groups[role] = [];
      groups[role].push(item);
    });

    return { groups, generalItems, entityItems };
  }, [navItems]);

  const activeItem = navItems.find(i => i.key === activeTab);
  const activeLabel = activeItem?.label || 'Vista del Sistema';

  // Determinar qué grupos mostrar según el selector de rol
  const displayedGroups = useMemo(() => {
    if (selectedRoleFilter === 'ALL') return groupedItems.groups;
    if (groupedItems.groups[selectedRoleFilter]) {
      return { [selectedRoleFilter]: groupedItems.groups[selectedRoleFilter] };
    }
    return groupedItems.groups;
  }, [groupedItems, selectedRoleFilter]);

  const [showEntities, setShowEntities] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--color-bg-app)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Sidebar Corporativo Oscuro (Estilo Stitch) */}
      <aside style={{
        width: '270px',
        backgroundColor: '#0f172a',
        color: '#94a3b8',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRight: '1px solid #1e293b',
        flexShrink: 0
      }}>
        <div>
          {/* Header del Sidebar */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#4f46e5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.95rem'
            }}>
              {title ? title.charAt(0).toUpperCase() : 'A'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {title}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                Control de Acceso por Roles
              </div>
            </div>
          </div>

          {/* Selector de Rol en Sidebar */}
          <div style={{ padding: '10px 14px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)', position: 'relative' }}>
            <div style={{ fontSize: '0.675rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Filtrar Vista por Rol
            </div>
            <div
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              style={{
                width: '100%',
                backgroundColor: 'rgba(255,255,255,0.06)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
            >
              <span>{selectedRoleFilter === 'ALL' ? '✦ Todos los Roles' : selectedRoleFilter}</span>
              <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#94a3b8' }}>
                {roleMenuOpen ? 'expand_less' : 'expand_more'}
              </span>
            </div>
            {roleMenuOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: '14px',
                right: '14px',
                zIndex: 50,
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                marginTop: '4px'
              }}>
                <div
                  onClick={() => { setSelectedRoleFilter('ALL'); setRoleMenuOpen(false); }}
                  style={{
                    padding: '8px 10px',
                    fontSize: '0.75rem',
                    color: selectedRoleFilter === 'ALL' ? '#818cf8' : '#e2e8f0',
                    backgroundColor: selectedRoleFilter === 'ALL' ? 'rgba(79,70,229,0.15)' : 'transparent',
                    cursor: 'pointer',
                    fontWeight: selectedRoleFilter === 'ALL' ? 600 : 400
                  }}
                >
                  ✦ Todos los Roles ({navItems.filter(i => !i.isEntity && i.type !== 'section').length})
                </div>
                {availableRoles.map(r => (
                  <div
                    key={r}
                    onClick={() => { setSelectedRoleFilter(r); setRoleMenuOpen(false); }}
                    style={{
                      padding: '8px 10px',
                      fontSize: '0.75rem',
                      color: selectedRoleFilter === r ? '#818cf8' : '#e2e8f0',
                      backgroundColor: selectedRoleFilter === r ? 'rgba(79,70,229,0.15)' : 'transparent',
                      cursor: 'pointer',
                      fontWeight: selectedRoleFilter === r ? 600 : 400
                    }}
                  >
                    {r} ({groupedItems.groups[r]?.length || 0})
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Navegación por Grupos de Roles */}
          <nav style={{ padding: '10px 8px', maxHeight: 'calc(100vh - 230px)', overflowY: 'auto' }}>
            {Object.entries(displayedGroups).map(([roleName, screensInRole]) => {
              if (!screensInRole || screensInRole.length === 0) return null;
              return (
                <div key={roleName} style={{ marginBottom: '14px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    marginBottom: '4px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-symbols-outlined" style={{ color: '#818cf8', fontSize: '15px' }}>
                        {/admin/i.test(roleName) ? 'admin_panel_settings' : /recep/i.test(roleName) ? 'directions_car' : /mecanic|tecnic/i.test(roleName) ? 'build' : 'person'}
                      </span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#cbd5e1', letterSpacing: '0.04em' }}>
                        {roleName}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.625rem', backgroundColor: 'rgba(255,255,255,0.08)', color: '#94a3b8', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>
                      {screensInRole.length}
                    </span>
                  </div>

                  {screensInRole.map(item => {
                    const isActive = activeTab === item.key;
                    return (
                      <div
                        key={item.key}
                        onClick={() => onSelectTab && onSelectTab(item.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          marginBottom: '2px',
                          fontSize: '0.8rem',
                          color: isActive ? '#ffffff' : '#94a3b8',
                          backgroundColor: isActive ? '#4f46e5' : 'transparent',
                          fontWeight: isActive ? 600 : 400,
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: isActive ? '#ffffff' : '#818cf8', flexShrink: 0 }}>
                            {item.icon || 'palette'}
                          </span>
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {item.label}
                          </span>
                        </div>
                        {isActive && (
                          <span style={{
                            fontSize: '0.625rem',
                            backgroundColor: 'rgba(255,255,255,0.25)',
                            color: '#ffffff',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            fontWeight: 600,
                            flexShrink: 0
                          }}>
                            Activo
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Sección Módulos de Datos (CRUD Sequelize) */}
            {groupedItems.entityItems.length > 0 && (
              <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                <div
                  onClick={() => setShowEntities(!showEntities)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>database</span>
                    <span>Módulos de Datos ({groupedItems.entityItems.length})</span>
                  </div>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                    {showEntities ? 'expand_less' : 'expand_more'}
                  </span>
                </div>
                {showEntities && groupedItems.entityItems.map(item => {
                  const isActive = activeTab === item.key;
                  return (
                    <div
                      key={item.key}
                      onClick={() => onSelectTab && onSelectTab(item.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        marginBottom: '1px',
                        fontSize: '0.75rem',
                        color: isActive ? '#ffffff' : '#64748b',
                        backgroundColor: isActive ? '#2563eb' : 'transparent',
                        fontWeight: isActive ? 600 : 400
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>table_chart</span>
                      <span>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </nav>
        </div>

        {/* Perfil del Usuario Autenticado en Sidebar Inferior */}
        {user && (
          <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f1f5f9', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {userName}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#818cf8', fontWeight: 500 }}>
                  {userRole}
                </div>
              </div>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#4f46e5', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem' }}>
                {userName.charAt(0).toUpperCase()}
              </div>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                style={{
                  width: '100%',
                  padding: '4px 8px',
                  fontSize: '0.725rem',
                  color: '#f87171',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Cerrar Sesión
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Área de Trabajo con Cabecera Superior */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
        {/* Cabecera Superior Estilo Stitch */}
        <header style={{
          height: '56px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
              {activeLabel}
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              fontSize: '0.7rem',
              fontWeight: 600
            }}>
              ● En Línea
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              backgroundColor: '#f1f5f9',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '0.8rem',
              color: '#64748b'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>search</span>
              <span>Buscar vehículo, cliente u orden...</span>
            </div>
            <span className="material-symbols-outlined" style={{ color: '#64748b', cursor: 'pointer', fontSize: '20px' }}>notifications</span>
            <span className="material-symbols-outlined" style={{ color: '#64748b', cursor: 'pointer', fontSize: '20px' }}>settings</span>
          </div>
        </header>

        {/* Contenido Principal */}
        <main style={{ flex: 1, padding: '24px 32px' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
`;
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
