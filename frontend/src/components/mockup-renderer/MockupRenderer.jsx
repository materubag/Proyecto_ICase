import React from 'react';

/**
 * Controlled Declarative Mockup Components
 * Interprets JSON screens produced by n8n / MockupService
 */

function MockNavbar({ component }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.75rem 1.25rem',
      backgroundColor: '#0f172a',
      color: '#ffffff',
      borderRadius: 'var(--radius-sm)',
      marginBottom: '1rem'
    }}>
      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{component.label || 'Barra Principal'}</span>
      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', opacity: 0.85 }}>
        <span>Inicio</span>
        <span>Operaciones</span>
        <span>Perfil</span>
      </div>
    </div>
  );
}

function MockSidebar({ component }) {
  const items = component.meta?.items || ['Inicio', 'Registros', 'Consultas', 'Configuración'];
  return (
    <div style={{
      width: '180px',
      backgroundColor: '#f8fafc',
      borderRight: '1px solid #e2e8f0',
      padding: '1rem 0.75rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
        {component.label || 'Navegación'}
      </div>
      {items.map((item, idx) => (
        <div key={idx} style={{
          padding: '0.4rem 0.6rem',
          borderRadius: '4px',
          fontSize: '0.825rem',
          backgroundColor: idx === 0 ? '#eff6ff' : 'transparent',
          color: idx === 0 ? '#2563eb' : '#334155',
          fontWeight: idx === 0 ? 600 : 400
        }}>
          {item}
        </div>
      ))}
    </div>
  );
}

function MockHeading({ component }) {
  const level = component.meta?.level || 2;
  const style = {
    color: '#0f172a',
    marginBottom: '0.75rem',
    fontWeight: 600,
    letterSpacing: '-0.02em'
  };

  if (level === 1) return <h1 style={{ ...style, fontSize: '1.5rem' }}>{component.label}</h1>;
  if (level === 3) return <h3 style={{ ...style, fontSize: '1.05rem' }}>{component.label}</h3>;
  return <h2 style={{ ...style, fontSize: '1.25rem' }}>{component.label}</h2>;
}

function MockText({ component }) {
  return (
    <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem', lineHeight: 1.5 }}>
      {component.label || component.content}
    </p>
  );
}

function MockInput({ component }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      {component.label && (
        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: '#1e293b', marginBottom: '0.35rem' }}>
          {component.label}
        </label>
      )}
      <input
        type={component.meta?.inputType || 'text'}
        placeholder={component.placeholder || 'Escriba un valor...'}
        disabled
        style={{
          width: '100%',
          padding: '0.5rem 0.75rem',
          border: '1px solid #cbd5e1',
          borderRadius: '4px',
          backgroundColor: '#ffffff',
          color: '#334155'
        }}
      />
    </div>
  );
}

function MockButton({ component }) {
  return (
    <button
      type="button"
      style={{
        padding: '0.5rem 1rem',
        backgroundColor: '#2563eb',
        color: '#ffffff',
        border: 'none',
        borderRadius: '4px',
        fontWeight: 500,
        fontSize: '0.875rem',
        cursor: 'pointer',
        marginRight: '0.5rem',
        marginBottom: '0.5rem'
      }}
    >
      {component.label || 'Acción'}
    </button>
  );
}

function MockCard({ component }) {
  return (
    <div style={{
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      padding: '1.25rem',
      backgroundColor: '#ffffff',
      marginBottom: '1rem',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
    }}>
      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#0f172a', marginBottom: '0.35rem' }}>
        {component.label}
      </div>
      {component.description && (
        <div style={{ fontSize: '0.825rem', color: '#64748b' }}>
          {component.description}
        </div>
      )}
    </div>
  );
}

function MockTable({ component }) {
  const headers = component.meta?.headers || ['Código', 'Concepto', 'Responsable', 'Estado'];
  const rows = component.meta?.rows || [
    ['REG-001', 'Atención registrada', 'Administrador', 'Completado'],
    ['REG-002', 'Solicitud pendiente', 'Recepción', 'En Proceso']
  ];

  return (
    <div style={{ marginBottom: '1rem', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
      {component.label && (
        <div style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.875rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', color: '#0f172a' }}>
          {component.label}
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left' }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: '0.55rem 0.75rem', borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx} style={{ borderBottom: rIdx === rows.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
              {row.map((col, cIdx) => (
                <td key={cIdx} style={{ padding: '0.6rem 0.75rem', color: '#1e293b' }}>
                  {String(col).toLowerCase().includes('completado') ? (
                    <span style={{ background: '#ecfdf5', color: '#065f46', padding: '2px 6px', borderRadius: 4, fontWeight: 600, fontSize: '0.75rem' }}>{col}</span>
                  ) : String(col).toLowerCase().includes('proceso') ? (
                    <span style={{ background: '#fffbeb', color: '#92400e', padding: '2px 6px', borderRadius: 4, fontWeight: 600, fontSize: '0.75rem' }}>{col}</span>
                  ) : cIdx === 0 ? (
                    <code style={{ fontSize: '0.775rem' }}>{col}</code>
                  ) : col}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MockList({ component }) {
  const items = component.meta?.items || ['Opción 1', 'Opción 2', 'Opción 3'];
  return (
    <ul style={{ paddingLeft: '1.25rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#334155' }}>
      {items.map((it, idx) => (
        <li key={idx} style={{ marginBottom: '0.25rem' }}>{it}</li>
      ))}
    </ul>
  );
}

function MockForm({ component }) {
  return (
    <div style={{
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      padding: '1.25rem',
      backgroundColor: '#ffffff',
      marginBottom: '1rem'
    }}>
      {component.label && (
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#0f172a' }}>
          {component.label}
        </h3>
      )}
      {component.children && component.children.map((child, idx) => (
        <RenderComponent key={idx} component={child} />
      ))}
    </div>
  );
}

function RenderComponent({ component }) {
  if (!component) return null;

  switch (component.type?.toLowerCase()) {
    case 'navbar':
      return <MockNavbar component={component} />;
    case 'sidebar':
      return <MockSidebar component={component} />;
    case 'heading':
      return <MockHeading component={component} />;
    case 'text':
      return <MockText component={component} />;
    case 'input':
      return <MockInput component={component} />;
    case 'button':
      return <MockButton component={component} />;
    case 'card':
      return <MockCard component={component} />;
    case 'table':
      return <MockTable component={component} />;
    case 'list':
      return <MockList component={component} />;
    case 'form':
      return <MockForm component={component} />;
    default:
      return (
        <div style={{ padding: '0.5rem', background: '#f1f5f9', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
          [Componente: {component.type}] - {component.label}
        </div>
      );
  }
}

import AppShellPreview, { THEMES } from './AppShellPreview';

export default function MockupRenderer({
  screen,
  project,
  allScreens = [],
  onSelectScreen,
  themeConfig = { color: 'indigo', layout: 'sidebar', showShell: true }
}) {
  if (!screen) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        No hay datos de pantalla para renderizar.
      </div>
    );
  }

  const currentTheme = THEMES[themeConfig?.color] || THEMES.indigo;
  const showShell = themeConfig?.showShell !== false;

  // Inyección de estilos de tema para que el HTML de Stitch o del generador adopte el color primario elegido
  const themeInjectionCss = `
    <style>
      :root {
        --primary-theme: ${currentTheme.primary};
        --primary-hover: ${currentTheme.primaryHover};
        --primary-light: ${currentTheme.primaryLight};
      }
      .btn-mockup-primary, button[type="submit"], .btn-primary, [class*="bg-indigo-"], [class*="bg-blue-"], [class*="bg-primary"] {
        background-color: ${currentTheme.primary} !important;
        border-color: ${currentTheme.primary} !important;
        color: #ffffff !important;
      }
      .btn-mockup-primary:hover, button[type="submit"]:hover {
        background-color: ${currentTheme.primaryHover} !important;
      }
      .mockup-input:focus, input:focus, select:focus, textarea:focus {
        border-color: ${currentTheme.primary} !important;
        box-shadow: 0 0 0 2px ${currentTheme.primaryLight} !important;
      }
      /* Ocultar barras maestras duplicadas si el HTML interno ya las traía */
      .mockup-topbar { display: none !important; }
      body { background-color: transparent !important; padding: 0.5rem !important; }
      .mockup-container { max-width: 100% !important; margin: 0 !important; box-shadow: none !important; border: none !important; }
    </style>
  `;

  let processedHtml = null;
  if (screen.html) {
    if (screen.html.includes('</head>')) {
      processedHtml = screen.html.replace('</head>', `${themeInjectionCss}</head>`);
    } else {
      processedHtml = `${themeInjectionCss}${screen.html}`;
    }
  }

  // Contenido interno según el tipo de pantalla
  const renderInnerContent = () => {
    if (processedHtml || screen.htmlUrl) {
      return (
        <iframe
          title={`Prototipo ${screen.name}`}
          src={processedHtml ? undefined : screen.htmlUrl}
          srcDoc={processedHtml || undefined}
          sandbox="allow-scripts"
          style={{
            width: '100%',
            minHeight: '620px',
            border: 0,
            background: 'transparent',
            display: 'block'
          }}
        />
      );
    }

    const hasSidebar = screen.components?.some(c => c.type === 'sidebar');
    const nonSidebarComponents = screen.components?.filter(c => c.type !== 'sidebar') || [];
    const sidebarComponent = screen.components?.find(c => c.type === 'sidebar');

    return (
      <div style={{ display: 'flex', minHeight: '360px', background: '#ffffff', borderRadius: '8px', padding: '16px', border: '1px solid #e2e8f0' }}>
        {hasSidebar && !showShell && <MockSidebar component={sidebarComponent} />}
        <div className="mockup-canvas-content" style={{ flex: 1 }}>
          {nonSidebarComponents.map((comp, idx) => (
            <RenderComponent key={idx} component={comp} />
          ))}
        </div>
      </div>
    );
  };

  // Si showShell es false, renderizar en modo tarjeta simple (componente aislado)
  if (!showShell) {
    return (
      <div className="mockup-preview-window">
        <div className="mockup-header-bar">
          <div className="window-dots">
            <div className="window-dot" style={{ backgroundColor: '#f87171' }} />
            <div className="window-dot" style={{ backgroundColor: '#fbbf24' }} />
            <div className="window-dot" style={{ backgroundColor: '#34d399' }} />
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.75rem', fontFamily: 'monospace' }}>
            {screen.route || '/'} — {screen.name}
          </div>
        </div>
        {renderInnerContent()}
      </div>
    );
  }

  // Modo Aplicación Completa Unificada (App Shell)
  return (
    <AppShellPreview
      screen={screen}
      project={project}
      allScreens={allScreens}
      onSelectScreen={onSelectScreen}
      themeConfig={themeConfig}
    >
      {renderInnerContent()}
    </AppShellPreview>
  );
}

