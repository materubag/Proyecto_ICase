/**
 * React Frontend Generator
 * Generates an interactive SPA with Dashboard, dynamic CRUD tables, forms, modals,
 * and high-fidelity functional screens based on project requirements and mockups.
 */

const { toPascalCase, toCamelCase, toSnakeCasePlural, normalizeAttributes } = require('./typeMapper');
const funcGen = require('./functionalPagesGenerator');

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
    <script>
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              primary: "#3525cd",
              "primary-container": "#4f46e5",
              surface: "#f8f9ff",
              background: "#f8f9ff",
              "surface-container-lowest": "#ffffff",
              "surface-container": "#e5eeff",
              "surface-container-high": "#dce9ff",
              "surface-container-highest": "#d3e4fe",
              "on-surface": "#0b1c30",
              outline: "#777587",
              "outline-variant": "#c7c4d8",
              secondary: "#565e74",
              tertiary: "#005338",
              error: "#ba1a1a"
            },
            fontFamily: {
              "body-sm": ["Inter", "sans-serif"],
              "body-md": ["Inter", "sans-serif"],
              "headline-sm": ["Inter", "sans-serif"],
              "headline-md": ["Inter", "sans-serif"],
              "label-sm": ["Inter", "sans-serif"],
              "label-md": ["Inter", "sans-serif"]
            }
          }
        }
      };
    </script>
    <style>
      .material-symbols-outlined {
        font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        display: inline-block;
        vertical-align: middle;
        line-height: 1;
      }
    </style>
  </head>
  <body class="bg-background text-on-surface">
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

    # Proxy a la API backend
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
  return `:root {
  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --primary-light: #eff6ff;
  --bg-main: #f8fafc;
  --bg-sidebar: #0f172a;
  --text-sidebar: #94a3b8;
  --text-sidebar-active: #ffffff;
  --card-bg: #ffffff;
  --border-color: #e2e8f0;
  --text-main: #1e293b;
  --text-muted: #64748b;
  --success: #10b981;
  --danger: #ef4444;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, sans-serif;
}

body {
  background-color: var(--bg-main);
  color: var(--text-main);
}

.app-container {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: 270px;
  background-color: var(--bg-sidebar);
  color: var(--text-sidebar);
  display: flex;
  flex-direction: column;
}

.sidebar-brand {
  padding: 18px 20px;
  font-size: 1.15rem;
  font-weight: 700;
  color: #fff;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  display: flex;
  align-items: center;
  gap: 10px;
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 12px 8px;
}

.nav-section-title {
  padding: 12px 14px 4px 14px;
  font-size: 0.72rem;
  color: #64748b;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  border-radius: 6px;
  color: var(--text-sidebar);
  cursor: pointer;
  margin-bottom: 2px;
  font-size: 0.86rem;
  font-weight: 500;
  transition: all 0.15s;
}

.nav-item:hover {
  background-color: rgba(255,255,255,0.06);
  color: #fff;
}

.nav-item.active {
  background-color: var(--primary);
  color: #fff;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.topbar {
  background: #fff;
  padding: 14px 28px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.content-body {
  padding: 28px;
}

.card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s;
}

.btn-primary {
  background: var(--primary);
  color: #fff;
}

.btn-primary:hover {
  background: var(--primary-hover);
}

.btn-secondary {
  background: #f1f5f9;
  color: #334155;
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background: #e2e8f0;
}

.btn-danger {
  background: #fee2e2;
  color: var(--danger);
  border: 1px solid #fecaca;
}

.btn-danger:hover {
  background: #fecaca;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 0.78rem;
}

/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}
.badge-success { background: #dcfce7; color: #15803d; }
.badge-danger { background: #fee2e2; color: #b91c1c; }
.badge-warning { background: #fef3c7; color: #b45309; }
.badge-info { background: #e0f2fe; color: #0369a1; }
.badge-secondary { background: #f1f5f9; color: #475569; }

.table-responsive {
  width: 100%;
  overflow-x: auto;
  margin-top: 16px;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.85rem;
}

th {
  background: #f8fafc;
  padding: 12px 14px;
  border-bottom: 2px solid var(--border-color);
  color: var(--text-muted);
  font-weight: 600;
}

td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-color);
}

tr:hover {
  background-color: #f8fafc;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-content {
  background: #fff;
  border-radius: 8px;
  width: 90%;
  max-width: 540px;
  padding: 24px;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-size: 0.82rem;
  font-weight: 500;
  margin-bottom: 5px;
  color: var(--text-main);
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.88rem;
  background: #fff;
}

.form-control:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
}
`;
}

function generateApiClientJs() {
  return `/**
 * Cliente HTTP para conectarse a la API REST de Express + Sequelize
 */

const API_BASE = '/api';

export async function apiRequest(endpoint, options = {}) {
  const url = \`\${API_BASE}\${endpoint.startsWith('/') ? endpoint : \`/\${endpoint}\`}\`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
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
    throw new Error(json.message || json.error || \`Error HTTP \${response.status}\`);
  }

  return json.data;
}
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

function generateDashboardJsx(projectName = 'Aplicación') {
  return `import React from 'react';

export default function Dashboard({ setActiveTab }) {
  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Panel de Control Principal — ${projectName}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          Sistema de gestión integral para taller automotriz, diagnóstico pericial y portal de clientes.
        </p>
      </div>

      {/* Tarjetas de Métricas Ejecutivas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Vehículos en Taller Hoy</span>
          <h3 style={{ fontSize: '1.6rem', marginTop: '4px', color: 'var(--primary)' }}>8</h3>
          <span style={{ fontSize: '0.75rem', color: '#10b981' }}>3 ingresados hoy</span>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Citas Pendientes Esta Semana</span>
          <h3 style={{ fontSize: '1.6rem', marginTop: '4px', color: '#f59e0b' }}>12</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>2 bahías disponibles</span>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Órdenes en Reparación Activa</span>
          <h3 style={{ fontSize: '1.6rem', marginTop: '4px', color: '#10b981' }}>5</h3>
          <span style={{ fontSize: '0.75rem', color: '#10b981' }}>2 listas para control de calidad</span>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Alertas de Bajo Stock</span>
          <h3 style={{ fontSize: '1.6rem', marginTop: '4px', color: '#ef4444' }}>2</h3>
          <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>Pastillas de freno y filtros</span>
        </div>
      </div>

      {/* Accesos Rápidos Operativos */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px' }}>Acciones Rápidas del Día</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setActiveTab('recepcion')}>
            <span className="material-symbols-outlined">directions_car</span>
            Nueva Recepción
          </button>
          <button className="btn btn-secondary" onClick={() => setActiveTab('citas')}>
            <span className="material-symbols-outlined">event</span>
            Agendar Cita
          </button>
          <button className="btn btn-secondary" onClick={() => setActiveTab('diagnosticos')}>
            <span className="material-symbols-outlined">bug_report</span>
            Registrar Falla OBD
          </button>
          <button className="btn btn-secondary" onClick={() => setActiveTab('inventario')}>
            <span className="material-symbols-outlined">inventory_2</span>
            Consultar Stock
          </button>
        </div>
      </div>

      {/* Resumen de Flujo de Taller */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Flujo de Trabajo Operativo</h3>
          <ol style={{ paddingLeft: '20px', fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)' }}>
            <li><strong>Recepción:</strong> Registro de kilometraje, combustible e inspección de carrocería.</li>
            <li><strong>Diagnóstico OBD:</strong> Escaneo de averías DTC y causas probables.</li>
            <li><strong>Presupuesto:</strong> Generación y aprobación de cotización con repuestos y mano de obra.</li>
            <li><strong>Reparación:</strong> Asignación de mecánico y consumo de insumos del inventario.</li>
            <li><strong>Control de Calidad:</strong> Prueba de ruta y entrega conforme al cliente.</li>
          </ol>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Estado del Entorno Full-Stack</h3>
          <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-success">✓ Conectado</span>
              <span>PostgreSQL 15 Container</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-success">✓ Operativa</span>
              <span>API REST Express + Sequelize ORM</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-success">✓ Compilado</span>
              <span>Frontend React 18 + Vite SPA</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
`;
}

function generateAppJsx(projectName = 'Aplicación', entities = [], customPages = [], actors = [], compiledMockups = []) {
  const isMockupMode = customPages && customPages.length > 0;

  // Lista de páginas funcionales con asignación de roles (RBAC ISO 29148)
  const pagesList = isMockupMode
    ? customPages.filter(p => p.route !== '/login').map(p => ({
        pascal: p.pascal || 'Custom',
        key: p.key || p.route.replace(/^\//, '').replace(/-/g, '_'),
        name: p.name || p.title || 'Módulo',
        icon: p.icon || 'view_quilt',
        roles: p.roles || (
          p.route.includes('cliente') ? ['Cliente'] :
          p.route.includes('diagnostico') || p.route.includes('obd') ? ['Administrador', 'Mecánico'] :
          p.route.includes('recepcion') || p.route.includes('cita') ? ['Administrador', 'Recepción'] :
          p.route.includes('reparacion') || p.route.includes('orden') ? ['Administrador', 'Mecánico', 'Recepción'] :
          ['Administrador']
        )
      }))
    : [
        { pascal: 'Recepcion', key: 'recepcion', name: 'Recepción e Inspección', icon: 'directions_car', roles: ['Administrador', 'Recepción'] },
        { pascal: 'Citas', key: 'citas', name: 'Agenda de Citas', icon: 'event', roles: ['Administrador', 'Recepción'] },
        { pascal: 'Diagnosticos', key: 'diagnosticos', name: 'Diagnósticos OBD', icon: 'bug_report', roles: ['Administrador', 'Mecánico'] },
        { pascal: 'Reparaciones', key: 'reparaciones', name: 'Órdenes de Trabajo', icon: 'engineering', roles: ['Administrador', 'Mecánico', 'Recepción'] },
        { pascal: 'Clientes', key: 'clientes', name: 'Directorio de Clientes', icon: 'people', roles: ['Administrador', 'Recepción'] },
        { pascal: 'Vehiculos', key: 'vehiculos', name: 'Expediente de Vehículos', icon: 'folder_shared', roles: ['Administrador', 'Recepción', 'Mecánico'] },
        { pascal: 'Inventario', key: 'inventario', name: 'Inventario y Repuestos', icon: 'inventory_2', roles: ['Administrador', 'Mecánico'] },
        { pascal: 'Servicios', key: 'servicios', name: 'Catálogo de Servicios', icon: 'list_alt', roles: ['Administrador', 'Recepción'] },
        { pascal: 'MisVehiculos', key: 'mis_vehiculos', name: 'Mis Vehículos', icon: 'car_repair', roles: ['Cliente'] },
        { pascal: 'CitasCliente', key: 'citas_cliente', name: 'Solicitar Cita', icon: 'calendar_month', roles: ['Cliente'] },
        { pascal: 'CotizacionesCliente', key: 'cotizaciones_cliente', name: 'Presupuestos', icon: 'check_circle', roles: ['Cliente', 'Recepción'] },
        { pascal: 'ProgresoReparacion', key: 'progreso_reparacion', name: 'Seguimiento en Vivo', icon: 'trending_up', roles: ['Cliente'] },
        { pascal: 'Conocimiento', key: 'conocimiento', name: 'Base de Conocimiento OBD', icon: 'menu_book', roles: ['Administrador', 'Mecánico'] },
        { pascal: 'Reportes', key: 'reportes', name: 'Indicadores y Reportes', icon: 'analytics', roles: ['Administrador'] },
        { pascal: 'Usuarios', key: 'usuarios', name: 'Personal y Roles', icon: 'admin_panel_settings', roles: ['Administrador'] }
      ];

  const pageImports = pagesList.map(p => `import ${p.pascal}Page from './pages/${p.pascal}Page';`).join('\n');
  const pageSwitches = pagesList.map(p => `          {activeTab === '${p.key}' && isAuthorized('${p.key}') && <${p.pascal}Page />}`).join('\n');

  // Opciones de roles según los actores del proyecto
  const roleList = (actors && actors.length > 0)
    ? actors.map(a => a.name)
    : ['Administrador', 'Recepción', 'Mecánico', 'Cliente'];

  const roleOptions = roleList.map(r => `<option value="${r}">${r}</option>`).join('\n              ');
  const initialRole = roleList[0] || 'Administrador';

  // Navigation tabs for data models (solo visibles para Administrador)
  const ormNavButtons = entities.slice(0, 10).map(e => {
    const pascal = toPascalCase(e.name);
    return `            <div
              className={\`nav-item \${activeTab === 'orm_${pascal}' ? 'active' : ''}\`}
              onClick={() => setActiveTab('orm_${pascal}')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>table_chart</span>
              <span style={{ fontSize: '0.8rem' }}>${pascal}</span>
            </div>`;
  }).join('\n');

  const ormConditionalPages = entities.map(e => {
    const pascal = toPascalCase(e.name);
    return `            {activeTab === 'orm_${pascal}' && <${pascal}OrmPage />}`;
  }).join('\n');

  const ormImports = entities.map(e => {
    const pascal = toPascalCase(e.name);
    return `import ${pascal}OrmPage from './pages/orm/${pascal}Page';`;
  }).join('\n');

  // Mockups de diseño compilados (ArtifactVersion con Tailwind)
  const mockupImports = (compiledMockups && compiledMockups.length > 0)
    ? compiledMockups.map(m => `import ${m.compName} from './pages/mockups/${m.compName}';`).join('\n')
    : '';

  const mockupNavButtons = (compiledMockups && compiledMockups.length > 0)
    ? compiledMockups.map(m => `            <div
              className={\`nav-item \${activeTab === '${m.key}' ? 'active' : ''}\`}
              onClick={() => setActiveTab('${m.key}')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>palette</span>
              <span style={{ fontSize: '0.8rem' }} title="${m.title}">${m.compName.replace('Mockup', '')}</span>
            </div>`).join('\n')
    : '';

  const mockupConditionalPages = (compiledMockups && compiledMockups.length > 0)
    ? compiledMockups.map(m => `            {activeTab === '${m.key}' && (
              <div>
                <div style={{ marginBottom: '16px', padding: '10px 16px', background: '#e0f2fe', color: '#0369a1', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🎨 <strong>Mockup de Diseño Original:</strong> ${m.title}</span>
                  <span className="badge badge-info">${m.route}</span>
                </div>
                <${m.compName} />
              </div>
            )}`).join('\n')
    : '';

  const modulesJson = JSON.stringify(pagesList, null, 2);

  return `import React, { useState } from 'react';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
${pageImports}
${ormImports}
${mockupImports}

// Configuración de módulos y permisos por rol (RBAC)
const MODULES_CONFIG = ${modulesJson};

const ROLE_DEFAULT_TABS = {
  Administrador: 'dashboard',
  Recepción: 'recepcion',
  Mecánico: 'diagnosticos',
  Cliente: 'mis_vehiculos'
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeRole, setActiveRole] = useState('${initialRole}');
  const [activeTab, setActiveTab] = useState('dashboard');

  // Si no ha iniciado sesión, mostrar la pantalla de Login (RF-01, RNF-03)
  if (!currentUser) {
    return (
      <LoginPage
        onLogin={(user) => {
          const role = user.role || 'Administrador';
          const defaultTab = ROLE_DEFAULT_TABS[role] || (MODULES_CONFIG.find(m => m.roles?.includes(role))?.key) || 'dashboard';
          setCurrentUser(user);
          setActiveRole(role);
          setActiveTab(defaultTab);
        }}
      />
    );
  }

  // Comprobar si la pestaña solicitada está permitida para el rol actual
  const isAuthorized = (tab, role = activeRole) => {
    if (tab === 'dashboard') return role === 'Administrador';
    if (tab.startsWith('orm_')) return role === 'Administrador';
    if (tab.startsWith('mockup_')) return role === 'Administrador';
    const mod = MODULES_CONFIG.find(m => m.key === tab);
    return mod ? (!mod.roles || mod.roles.includes(role)) : false;
  };

  // Módulos visibles en la barra lateral según el rol activo
  const allowedModules = MODULES_CONFIG.filter(m => !m.roles || m.roles.includes(activeRole));

  // Cambio de rol simulado (solo para Administrador)
  const handleRoleChange = (newRole) => {
    setActiveRole(newRole);
    const defaultTab = ROLE_DEFAULT_TABS[newRole] || (MODULES_CONFIG.find(m => m.roles?.includes(newRole))?.key) || 'dashboard';
    setActiveTab(defaultTab);
  };

  return (
    <div className="app-container">
      {/* Sidebar de Navegación con Control de Acceso por Rol (RBAC) */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="material-symbols-outlined" style={{ color: '#38bdf8' }}>dashboard</span>
          <span>${projectName}</span>
        </div>

        <nav className="sidebar-nav">
          {/* Panel General: solo disponible para Administrador */}
          {activeRole === 'Administrador' && (
            <div
              className={\`nav-item \${activeTab === 'dashboard' ? 'active' : ''}\`}
              onClick={() => setActiveTab('dashboard')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>dashboard</span>
              <span>Panel General</span>
            </div>
          )}

          <div className="nav-section-title">
            {activeRole === 'Cliente' ? 'Portal del Cliente' : \`Módulos (\${activeRole})\`}
          </div>

          {/* Módulos estrictamente autorizados para el rol activo */}
          {allowedModules.map(m => (
            <div
              key={m.key}
              className={\`nav-item \${activeTab === m.key ? 'active' : ''}\`}
              onClick={() => setActiveTab(m.key)}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{m.icon || 'view_quilt'}</span>
              <span>{m.name}</span>
            </div>
          ))}

          {/* TABLAS DE DATOS ORM: Solo visibles para perfil Administrador */}
          {activeRole === 'Administrador' && (
            <>
              <div className="nav-section-title" style={{ opacity: 0.7 }}>Tablas Sequelize (ORM)</div>
${ormNavButtons}
            </>
          )}

          {/* MOCKUPS DE DISEÑO: Mockups reales aprobados en la BD con Tailwind CSS */}
          {activeRole === 'Administrador' && (
            <>
              <div className="nav-section-title" style={{ opacity: 0.7 }}>Mockups Aprobados (Tailwind)</div>
${mockupNavButtons}
            </>
          )}
        </nav>
      </aside>

      {/* Contenido Principal */}
      <main className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Estado: <strong style={{ color: '#10b981' }}>● Conectado a PostgreSQL</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Si es Administrador, puede simular otros roles para probar la experiencia */}
            {currentUser.role === 'Administrador' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Simular Rol:</span>
                <select
                  className="form-control"
                  style={{ width: 'auto', padding: '3px 8px', fontSize: '0.78rem' }}
                  value={activeRole}
                  onChange={e => handleRoleChange(e.target.value)}
                  title="Como Administrador puedes simular la vista y permisos de otros roles"
                >
                  ${roleOptions}
                </select>
              </div>
            ) : (
              <span className="badge badge-info" style={{ fontSize: '0.78rem' }}>Perfil: {currentUser.role}</span>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#f1f5f9', borderRadius: '20px', fontSize: '0.8rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--primary)' }}>account_circle</span>
              <strong>{currentUser.name}</strong>
              <span className="badge badge-info" style={{ marginLeft: '4px' }}>{activeRole}</span>
            </div>

            <button
              className="btn btn-sm btn-danger"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              onClick={() => setCurrentUser(null)}
              title="Cerrar Sesión y regresar a pantalla de Login"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>logout</span>
              Cerrar Sesión
            </button>
          </div>
        </header>

        <div className="content-body">
          {activeTab === 'dashboard' && activeRole === 'Administrador' && <Dashboard setActiveTab={setActiveTab} />}
${pageSwitches}
          {activeRole === 'Administrador' && (
            <>
${ormConditionalPages}
${mockupConditionalPages}
            </>
          )}

          {/* Bloque de Acceso Denegado si se intenta acceder a una pestaña no permitida */}
          {!isAuthorized(activeTab) && (
            <div className="card" style={{ padding: '36px', textAlign: 'center', maxWidth: '540px', margin: '40px auto' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ef4444', marginBottom: '12px' }}>lock</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#991b1b', marginBottom: '8px' }}>Acceso Restringido</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                Tu perfil actual (<strong>{activeRole}</strong>) no tiene autorización para visualizar este módulo.
              </p>
              <button
                className="btn btn-primary"
                style={{ marginTop: '20px', display: 'inline-flex', margin: '20px auto 0 auto' }}
                onClick={() => setActiveTab(ROLE_DEFAULT_TABS[activeRole] || allowedModules[0]?.key || 'dashboard')}
              >
                Volver a mi módulo principal
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
`;
}

function generateEntityPageJsx(entity) {
  const pascalName = toPascalCase(entity.name);
  const pluralRoute = toSnakeCasePlural(entity.name);
  const normalizedAttrs = normalizeAttributes(entity.attributes || []);
  const nonPkAttrs = normalizedAttrs.filter(a => !a.isPk && !a.fieldName.toLowerCase().includes('hash') && !a.fieldName.toLowerCase().includes('token'));

  // Table headers (filter out sensitive fields like passwords or tokens)
  const displayAttrs = normalizedAttrs.filter(a => !a.fieldName.toLowerCase().includes('hash') && !a.fieldName.toLowerCase().includes('token'));
  const thHeaders = displayAttrs.map(a => `<th>${a.fieldName}</th>`).join('\n              ');
  const tdValues = displayAttrs.map(a => `<td>{String(item.${a.fieldName} ?? '')}</td>`).join('\n                ');

  // Initial state for form fields
  const initialState = nonPkAttrs.map(a => `${a.fieldName}: ''`).join(',\n    ');

  // Modal form inputs
  const formInputs = nonPkAttrs.map(a => {
    let inputType = 'text';
    if (a.dataType.includes('INTEGER') || a.dataType.includes('FLOAT') || a.dataType.includes('DECIMAL')) inputType = 'number';
    else if (a.dataType.includes('DATE')) inputType = 'date';
    else if (a.dataType.includes('BOOLEAN')) inputType = 'checkbox';

    if (inputType === 'checkbox') {
      return `          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="${a.fieldName}"
              checked={Boolean(formData.${a.fieldName})}
              onChange={e => setFormData({ ...formData, ${a.fieldName}: e.target.checked })}
            />
            <label htmlFor="${a.fieldName}" style={{ margin: 0 }}>${a.fieldName}</label>
          </div>`;
    }

    return `          <div className="form-group">
            <label htmlFor="${a.fieldName}">${a.fieldName}</label>
            <input
              type="${inputType}"
              id="${a.fieldName}"
              className="form-control"
              value={formData.${a.fieldName} || ''}
              onChange={e => setFormData({ ...formData, ${a.fieldName}: e.target.value })}
            />
          </div>`;
  }).join('\n');

  return `import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../api/client';

export default function ${pascalName}Page() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    ${initialState}
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/${pluralRoute}');
      setData(Array.isArray(res) ? res : (res?.data || []));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      ${initialState}
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({ ...item });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este registro?')) return;
    try {
      await apiRequest(\`/${pluralRoute}/\${id}\`, { method: 'DELETE' });
      setData(data.filter(item => item.id !== id));
    } catch (err) {
      alert(\`Error al eliminar: \${err.message}\`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        const updated = await apiRequest(\`/${pluralRoute}/\${editingItem.id}\`, {
          method: 'PUT',
          body: formData
        });
        setData(data.map(item => (item.id === editingItem.id ? updated : item)));
      } else {
        const created = await apiRequest('/${pluralRoute}', {
          method: 'POST',
          body: formData
        });
        setData([created, ...data]);
      }
      setModalOpen(false);
    } catch (err) {
      alert(\`Error al guardar: \${err.message}\`);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Tabla ORM: ${pascalName}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Operaciones directas sobre el modelo Sequelize <code>${pascalName}</code> (/api/${pluralRoute}).
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <span className="material-symbols-outlined">add</span>
          Nuevo Registro
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: '6px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <div className="card">
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando registros...</div>
        ) : data.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No hay registros en la tabla. Haz clic en "Nuevo Registro" para crear uno.
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  ${thHeaders}
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, idx) => (
                  <tr key={item.id || idx}>
                    ${tdValues}
                    <td style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => handleOpenEdit(item)}>Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '16px', fontWeight: 700 }}>
              {editingItem ? 'Editar Registro' : 'Nuevo Registro'} — ${pascalName}
            </h3>
            <form onSubmit={handleSubmit}>
              ${formInputs}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
`;
}

function getFunctionalPages() {
  return [
    { fileName: 'LoginPage.jsx', content: funcGen.generateLoginPage() },
    { fileName: 'RecepcionPage.jsx', content: funcGen.generateRecepcionPage() },
    { fileName: 'CitasPage.jsx', content: funcGen.generateCitasPage() },
    { fileName: 'ClientesPage.jsx', content: funcGen.generateClientesPage() },
    { fileName: 'VehiculosPage.jsx', content: funcGen.generateVehiculosPage() },
    { fileName: 'DiagnosticosPage.jsx', content: funcGen.generateDiagnosticosPage() },
    { fileName: 'ReparacionesPage.jsx', content: funcGen.generateReparacionesPage() },
    { fileName: 'InventarioPage.jsx', content: funcGen.generateInventarioPage() },
    { fileName: 'ServiciosPage.jsx', content: funcGen.generateServiciosPage() },
    { fileName: 'MisVehiculosPage.jsx', content: funcGen.generateMisVehiculosPage() },
    { fileName: 'CitasClientePage.jsx', content: funcGen.generateCitasClientePage() },
    { fileName: 'CotizacionesClientePage.jsx', content: funcGen.generateCotizacionesClientePage() },
    { fileName: 'ProgresoReparacionPage.jsx', content: funcGen.generateProgresoReparacionPage() },
    { fileName: 'ConocimientoPage.jsx', content: funcGen.generateConocimientoPage() },
    { fileName: 'ReportesPage.jsx', content: funcGen.generateReportesPage() },
    { fileName: 'UsuariosPage.jsx', content: funcGen.generateUsuariosPage() }
  ];
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
  generateEntityPageJsx,
  getFunctionalPages
};
