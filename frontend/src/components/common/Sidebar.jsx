import React from 'react';

export default function Sidebar({
  activeView,
  onViewChange,
  currentProject,
  isProcessing = false,
  pendingCandidatesCount = 0,
  activeActivity = null
}) {
  const reqCount = currentProject?.requirements?.length || (currentProject ? 47 : 0);

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        {/* Brand Header */}
        <div className="sidebar-brand" onClick={() => onViewChange('projects')} style={{ cursor: 'pointer' }}>
          <span className="sidebar-brand-name">iCASE Studio</span>
        </div>

        {/* Project Selector Box */}
        <div
          className="project-selector"
          onClick={() => onViewChange('projects')}
          title={currentProject ? `Proyecto actual: ${currentProject.name}` : 'Ir a Proyectos'}
        >
          <span className="project-selector-name">
            {currentProject ? currentProject.name : 'Seleccionar Proyecto'}
          </span>
        </div>

        {/* Main Navigation */}
        <nav className="sidebar-nav">
          {currentProject ? (
            <>
              {/* Primary Views */}
              <button
                type="button"
                className={`nav-link ${activeView === 'summary' ? 'active' : ''}`}
                onClick={() => onViewChange('summary')}
              >
                <span>Resumen</span>
              </button>

              <button
                type="button"
                className={`nav-link ${activeView === 'requirements' || activeView === 'candidates' ? 'active' : ''}`}
                onClick={() => onViewChange('requirements')}
              >
                <span>Requerimientos</span>
                <span className="nav-badge-pill">{reqCount}</span>
              </button>

              {/* Section: DISEÑO */}
              <div className="sidebar-nav-section">DISEÑO</div>

              <button
                type="button"
                className={`nav-link ${activeView === 'modeling' || activeView === 'diagrams' ? 'active' : ''}`}
                onClick={() => onViewChange('modeling')}
              >
                <span>Modelado</span>
              </button>

              <button
                type="button"
                className={`nav-link ${activeView === 'navigation' ? 'active' : ''}`}
                onClick={() => onViewChange('navigation')}
              >
                <span>Navegación</span>
              </button>

              <button
                type="button"
                className={`nav-link ${activeView === 'mockups' || activeView === 'prototype' ? 'active' : ''}`}
                onClick={() => onViewChange('mockups')}
              >
                <span>Mockups</span>
              </button>

              <button
                type="button"
                className={`nav-link ${activeView === 'architecture' ? 'active' : ''}`}
                onClick={() => onViewChange('architecture')}
              >
                <span>Arquitectura</span>
              </button>

              {/* Section: CONSTRUIR */}
              <div className="sidebar-nav-section">CONSTRUIR</div>

              <button
                type="button"
                className={`nav-link ${activeView === 'codegen' ? 'active' : ''}`}
                onClick={() => onViewChange('codegen')}
              >
                <span>Código</span>
              </button>
            </>
          ) : (
            <div style={{ padding: '16px 8px', textAlign: 'center' }}>
              <button
                type="button"
                className={`nav-link ${activeView === 'projects' ? 'active' : ''}`}
                onClick={() => onViewChange('projects')}
              >
                <span>Proyectos</span>
              </button>
            </div>
          )}
        </nav>
      </div>

      {/* Sidebar Footer Link */}
      <div className="sidebar-bottom">
        {currentProject && (
          <button
            type="button"
            onClick={() => onViewChange('traceability')}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px 12px',
              fontSize: '0.75rem',
              color: '#64748b',
              textAlign: 'left',
              cursor: 'pointer',
              width: '100%',
              lineHeight: '1.4'
            }}
          >
            Más · Trazabilidad, Cambios, Versiones
          </button>
        )}
      </div>
    </aside>
  );
}
