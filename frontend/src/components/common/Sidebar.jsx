import React from 'react';

const NAV_ITEMS = [
  { id: 'projects',      icon: 'folder',         label: 'Proyectos',             requiresProject: false },
  { id: 'summary',       icon: 'auto_awesome',   label: 'Resumen',               requiresProject: true },
  { id: 'requirements',  icon: 'checklist',      label: 'Requerimientos',        requiresProject: true },
  { id: 'planning',      icon: 'calendar_month', label: 'Planificación',         requiresProject: true },
  { id: 'modeling',      icon: 'schema',         label: 'Modelado',              requiresProject: true },
  { id: 'navigation',    icon: 'account_tree',   label: 'Árbol de Navegación',   requiresProject: true },
  { id: 'mockups',       icon: 'devices',        label: 'Mockups',               requiresProject: true },
  { id: 'architecture',  icon: 'layers',         label: 'Arquitectura',          requiresProject: true },
  { id: 'traceability',  icon: 'link',           label: 'Trazabilidad',          requiresProject: true },
  { id: 'tools_team',    icon: 'groups',         label: 'Equipo & Herramientas', requiresProject: true },
  { id: 'changes',       icon: 'change_circle',  label: 'Cambios',               requiresProject: true },
  { id: 'versions',      icon: 'history',        label: 'Versiones',             requiresProject: true },
  { id: 'chat',          icon: 'chat',           label: 'Chat IA',               requiresProject: true },
];

export default function Sidebar({ activeView, onViewChange, currentProject }) {
  return (
    <aside className="sidebar">
      {/* Top section */}
      <div className="sidebar-top">
        {/* Brand */}
        <div className="sidebar-brand" onClick={() => onViewChange('projects')}>
          <div className="sidebar-brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect width="16" height="16" x="4" y="4" rx="2.5" />
              <path d="m9 10 2 2 4-4" />
            </svg>
          </div>
          <span className="sidebar-brand-name">ICASE</span>
          <span className="sidebar-brand-tag">Studio</span>
        </div>

        {/* Project selector */}
        <div className="project-selector" onClick={() => onViewChange('projects')}>
          <div className="project-selector-inner">
            {currentProject ? (
              <>
                <div className="project-dot" />
                <span className="project-selector-name" title={currentProject.name}>
                  {currentProject.name}
                </span>
              </>
            ) : (
              <span className="project-selector-placeholder">Seleccionar proyecto</span>
            )}
          </div>
          <span className="ms ms-xs" style={{ color: 'var(--on-surface-variant)' }}>unfold_more</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {/* General section */}
          <span className="sidebar-nav-section">General</span>
          {NAV_ITEMS.filter(i => !i.requiresProject).map(item => (
            <button
              key={item.id}
              className={`nav-link ${activeView === item.id ? 'active' : ''}`}
              onClick={() => onViewChange(item.id)}
            >
              <span className="ms">{item.icon}</span>
              {item.label}
            </button>
          ))}

          {/* Project section */}
          {currentProject && (
            <>
              <span className="sidebar-nav-section">Proyecto Actual</span>
              {NAV_ITEMS.filter(i => i.requiresProject).map(item => (
                <button
                  key={item.id}
                  className={`nav-link ${activeView === item.id ? 'active' : ''}`}
                  onClick={() => onViewChange(item.id)}
                >
                  <span className="ms">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </>
          )}

          {/* Disabled items when no project */}
          {!currentProject && (
            <>
              <span className="sidebar-nav-section">Proyecto Actual</span>
              {NAV_ITEMS.filter(i => i.requiresProject).map(item => (
                <button
                  key={item.id}
                  className="nav-link disabled"
                  disabled
                >
                  <span className="ms">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </>
          )}
        </nav>
      </div>

      {/* Bottom section */}
      <div className="sidebar-bottom">
        <div className="sidebar-status">
          <div className="sidebar-status-text">
            <div className="sidebar-status-dot" />
            Sync OK
          </div>
          <span className="sidebar-version">v2.0</span>
        </div>
      </div>
    </aside>
  );
}
