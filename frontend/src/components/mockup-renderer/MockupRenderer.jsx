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
      backgroundColor: '#1e293b',
      color: '#ffffff',
      borderRadius: 'var(--radius-sm)',
      marginBottom: '1rem'
    }}>
      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{component.label || 'Application Bar'}</span>
      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', opacity: 0.85 }}>
        <span>Inicio</span>
        <span>Perfil</span>
        <span>Salir</span>
      </div>
    </div>
  );
}

function MockSidebar({ component }) {
  const items = component.meta?.items || ['Dashboard', 'Registros', 'Reportes', 'Configuración'];
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
  const headers = component.meta?.headers || ['Columna 1', 'Columna 2', 'Columna 3'];
  const rows = component.meta?.rows || [
    ['Dato A1', 'Dato B1', 'Dato C1'],
    ['Dato A2', 'Dato B2', 'Dato C2']
  ];

  return (
    <div style={{ marginBottom: '1rem', overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
      {component.label && (
        <div style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.875rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          {component.label}
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <thead>
          <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx} style={{ borderBottom: rIdx === rows.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
              {row.map((col, cIdx) => (
                <td key={cIdx} style={{ padding: '0.55rem 0.75rem' }}>{col}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MockList({ component }) {
  const items = component.meta?.items || ['Elemento 1', 'Elemento 2', 'Elemento 3'];
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

export default function MockupRenderer({ screen }) {
  if (!screen) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
        No hay datos de pantalla para renderizar.
      </div>
    );
  }

  if (screen.html || screen.htmlUrl) {
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
        <iframe
          title={`Prototipo ${screen.name}`}
          src={screen.html ? undefined : screen.htmlUrl}
          srcDoc={screen.html || undefined}
          sandbox="allow-scripts"
          style={{ width: '100%', minHeight: '620px', border: 0, background: '#fff' }}
        />
      </div>
    );
  }

  const hasSidebar = screen.components?.some(c => c.type === 'sidebar');
  const nonSidebarComponents = screen.components?.filter(c => c.type !== 'sidebar') || [];
  const sidebarComponent = screen.components?.find(c => c.type === 'sidebar');

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

      <div style={{ display: 'flex', minHeight: '360px' }}>
        {hasSidebar && <MockSidebar component={sidebarComponent} />}
        <div className="mockup-canvas-content" style={{ flex: 1 }}>
          {nonSidebarComponents.map((comp, idx) => (
            <RenderComponent key={idx} component={comp} />
          ))}
        </div>
      </div>
    </div>
  );
}
