import React from 'react';

/**
 * AppShell unificado basado en DESIGN_SYSTEM.md (v3.0)
 * Provee estructura estándar: cabecera limpia, navegación y área principal aireada.
 * Muestra el usuario y rol real validado por backend; no incluye selector visual sustituto.
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
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--color-bg-app)' }}>
      {/* Sidebar Corporativo */}
      <aside className="sidebar" style={{ width: '260px', backgroundColor: 'var(--color-surface)', borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-title)', margin: 0 }}>{title}</h1>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginTop: '2px' }}>Diseño Minimalista v3.0</span>
        </div>

        {/* Información de Usuario Autenticado (RBAC Real) */}
        {user && (
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', backgroundColor: '#fafbfc' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-title)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.nombre || user.username || user.name || user.email || 'Usuario'}
              </span>
              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--color-primary-subtle)', color: 'var(--color-primary)', fontWeight: 600 }}>
                {user.role || user.rol || 'Usuario'}
              </span>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                style={{
                  marginTop: '6px',
                  width: '100%',
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  color: 'var(--status-danger)',
                  background: 'transparent',
                  border: '1px solid #fecaca',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer'
                }}
              >
                Cerrar Sesión
              </button>
            )}
          </div>
        )}

        {/* Navegación */}
        <nav style={{ padding: '16px 8px', flex: 1, overflowY: 'auto' }}>
          {navItems.map((item, index) => {
            if (item.type === 'section') {
              return (
                <div key={item.key || `sec_${index}`} style={{ padding: '14px 14px 6px', fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                  {item.label}
                </div>
              );
            }
            return (
              <div
                key={item.key}
                onClick={() => onSelectTab && onSelectTab(item.key)}
                className={`nav-item ${activeTab === item.key ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  fontSize: '0.88rem',
                  color: activeTab === item.key ? 'var(--color-primary)' : 'var(--color-text-body)',
                  backgroundColor: activeTab === item.key ? 'var(--color-primary-subtle)' : 'transparent',
                  fontWeight: activeTab === item.key ? 600 : 400
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{item.icon || 'circle'}</span>
                <span>{item.label}</span>
              </div>
            );
          })}
        </nav>

        {/* Pie del Sidebar */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          <span>ICASE Generated Suite</span>
        </div>
      </aside>

      {/* Área de Trabajo Principal */}
      <main style={{ flex: 1, padding: '36px 40px', maxWidth: '1280px', margin: '0 auto', width: '100%', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
