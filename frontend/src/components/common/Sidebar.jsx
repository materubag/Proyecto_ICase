import React from 'react';

const NAV_GROUPS = [
  {
    title: 'ANÁLISIS',
    items: [
      { id: 'summary', icon: 'auto_awesome', label: 'Resumen' },
      { id: 'requirements', icon: 'checklist', label: 'Requerimientos', checkType: 'requirements' },
      { id: 'sources', icon: 'file_copy', label: 'Fuentes & Entrevistas', checkType: 'sources' },
    ]
  },
  {
    title: 'DISEÑO',
    items: [
      { id: 'modeling', icon: 'schema', label: 'Modelado', checkType: 'modeling' },
      { id: 'navigation', icon: 'account_tree', label: 'Árbol de Navegación' },
      { id: 'mockups', icon: 'devices', label: 'Mockups', checkType: 'mockups' },
      { id: 'architecture', icon: 'layers', label: 'Arquitectura' },
    ]
  },
  {
    title: 'INGENIERÍA',
    items: [
      { id: 'traceability', icon: 'link', label: 'Trazabilidad' },
      { id: 'changes', icon: 'change_circle', label: 'Cambios' },
      { id: 'versions', icon: 'history', label: 'Versiones' },
    ]
  },
  {
    title: 'ASISTENCIA',
    items: [
      { id: 'chat', icon: 'chat', label: 'Chat IA' },
    ]
  }
];

export default function Sidebar({
  activeView,
  onViewChange,
  currentProject,
  isProcessing = false,
  pendingCandidatesCount = 0,
  activeActivity = null
}) {
  // Derive status indicators based on real project state
  const getItemStatus = (item) => {
    if (!currentProject) return null;

    if (item.id === 'sources') {
      if (isProcessing) return { type: 'processing', tooltip: 'Procesando fuentes...' };
      const count = currentProject.sources?.length ?? 0;
      if (count > 0) return { type: 'completed', text: count };
      return null;
    }

    if (item.id === 'requirements') {
      if (pendingCandidatesCount > 0) {
        return { type: 'attention', tooltip: `${pendingCandidatesCount} candidatos por revisar` };
      }
      const reqs = currentProject.requirements || [];
      const hasPending = reqs.some(r => r.status === 'PENDING' || r.status === 'IN_REVIEW');
      if (hasPending) return { type: 'attention', tooltip: 'Requisitos pendientes de aprobación' };
      if (reqs.length > 0) return { type: 'completed', text: reqs.length };
      return null;
    }

    if (item.id === 'modeling') {
      if (activeActivity?.type === 'generating_modeling' || activeActivity?.type?.includes('diagram')) {
        return { type: 'processing', tooltip: 'Generando diagramas...' };
      }
      const hasEntities = (currentProject.entities?.length || 0) > 0;
      if (hasEntities) return { type: 'completed' };
      return null;
    }

    if (item.id === 'navigation') {
      const hasScreens = (currentProject.screens?.length || 0) > 0;
      const hasNodes = (currentProject.navigationNodes?.length || 0) > 0;
      if (hasScreens || hasNodes) return { type: 'completed' };
      return null;
    }

    if (item.id === 'architecture') {
      const hasArch = (currentProject.architectures?.length || 0) > 0;
      if (hasArch) return { type: 'completed' };
      return null;
    }

    if (item.id === 'mockups') {
      const hasScreens = (currentProject.screens?.length || 0) > 0;
      if (hasScreens) return { type: 'completed' };
      return null;
    }

    return null;
  };

  const renderStatusBadge = (status) => {
    if (!status) return null;

    if (status.type === 'processing') {
      return (
        <span
          className="sidebar-status-pill processing"
          title={status.tooltip}
          style={{ display: 'inline-flex', alignItems: 'center' }}
        >
          <span className="ms ms-xs spin" style={{ color: 'var(--primary)', fontSize: '13px' }}>
            autorenew
          </span>
        </span>
      );
    }

    if (status.type === 'attention') {
      return (
        <span
          className="sidebar-status-pill attention"
          title={status.tooltip}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#b42318',
            display: 'inline-block'
          }}
        />
      );
    }

    if (status.type === 'error') {
      return (
        <span
          className="sidebar-status-pill error"
          title={status.tooltip || 'Error'}
          style={{
            fontSize: '0.6875rem',
            color: '#ffffff',
            background: '#b42318',
            padding: '0 5px',
            borderRadius: 'var(--radius-xs)',
            fontWeight: 700
          }}
        >
          !
        </span>
      );
    }

    if (status.type === 'completed') {
      return (
        <span
          className="sidebar-status-pill completed"
          style={{
            fontSize: '0.6875rem',
            color: 'var(--secondary)',
            background: 'var(--surface-container)',
            padding: '0 5px',
            borderRadius: 'var(--radius-xs)',
            fontFamily: 'var(--font-mono)'
          }}
        >
          {status.text ? status.text : '✓'}
        </span>
      );
    }

    return null;
  };

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-top">
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

        {/* Project Selector / Dashboard Switcher */}
        <div
          className={`project-selector ${!currentProject ? 'no-project' : ''}`}
          onClick={() => onViewChange('projects')}
          title={currentProject ? `Proyecto actual: ${currentProject.name}` : 'Ir a Proyectos'}
        >
          <div className="project-selector-inner">
            <div
              className="project-dot"
              style={{
                backgroundColor: currentProject ? 'var(--primary)' : 'var(--outline)'
              }}
            />
            <span className="project-selector-name">
              {currentProject ? currentProject.name : 'Mis Proyectos'}
            </span>
          </div>
          <span className="ms ms-xs" style={{ color: 'var(--on-surface-variant)' }}>
            unfold_more
          </span>
        </div>

        {/* Main Navigation with Vertical Scroll */}
        <nav className="sidebar-nav">
          {/* General Section */}
          <button
            type="button"
            className={`nav-link ${activeView === 'projects' ? 'active' : ''}`}
            onClick={() => onViewChange('projects')}
          >
            <span className="ms">folder</span>
            <span style={{ flex: 1 }}>Dashboard</span>
          </button>

          {/* Grouped Project Navigation */}
          {currentProject ? (
            NAV_GROUPS.map((group) => (
              <div key={group.title} className="sidebar-nav-group">
                <span className="sidebar-nav-section">{group.title}</span>
                {group.items.map((item) => {
                  const status = getItemStatus(item);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`nav-link ${activeView === item.id ? 'active' : ''}`}
                      onClick={() => onViewChange(item.id)}
                    >
                      <span className="ms">{item.icon}</span>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {renderStatusBadge(status)}
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            <div style={{ padding: '16px 8px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--outline)', margin: 0 }}>
                Selecciona o abre un proyecto para acceder a las herramientas de ingeniería.
              </p>
            </div>
          )}
        </nav>
      </div>

      {/* Global Activity Widget if in progress */}
      {isProcessing && (
        <div
          className="sidebar-activity-widget"
          onClick={() => onViewChange('sources')}
          style={{
            margin: '8px 4px',
            padding: '8px 10px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(41, 82, 217, 0.08)',
            border: '1px solid rgba(41, 82, 217, 0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          title="Ver proceso activo"
        >
          <span className="ms ms-xs spin" style={{ color: 'var(--primary)' }}>
            autorenew
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--primary)', display: 'block' }}>
              Procesando fuentes
            </span>
            <span style={{ fontSize: '0.625rem', color: 'var(--secondary)' }}>
              Haz clic para ver la cola
            </span>
          </div>
        </div>
      )}

      {/* Sidebar Footer */}
      <div className="sidebar-bottom">
        <div className="sidebar-status">
          <div className="sidebar-status-text">
            <div className="sidebar-status-dot" />
            <span>Workspace Ready</span>
          </div>
          <span className="sidebar-version">v2.1</span>
        </div>
      </div>
    </aside>
  );
}
