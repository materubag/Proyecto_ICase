import React, { useState } from 'react';
import ProjectModel from './ProjectModel';
import ProjectUseCases from './ProjectUseCases';

export default function ProjectModeling({ project, onProjectUpdated }) {
  const [activeSubTab, setActiveSubTab] = useState('er'); // 'er' | 'usecases' | 'classes'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header bar */}
      <div className="full-page-header" style={{ borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div>
            <h2 className="page-title" style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="ms ms-sm" style={{ color: 'var(--primary)' }}>schema</span>
              Modelado del Sistema (E/R, Casos de Uso y Clases UML)
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
              Modelos estructurados del sistema derivados directamente de los requisitos y entidades
            </span>
          </div>
        </div>

        <div className="view-toggle">
          <button
            className={`view-toggle-btn ${activeSubTab === 'er' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('er')}
          >
            <span className="ms ms-xs">table_chart</span>
            <span>Diagrama Entidad–Relación (E/R)</span>
          </button>
          <button
            className={`view-toggle-btn ${activeSubTab === 'usecases' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('usecases')}
          >
            <span className="ms ms-xs">account_tree</span>
            <span>Casos de Uso</span>
          </button>
          <button
            className={`view-toggle-btn ${activeSubTab === 'classes' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('classes')}
          >
            <span className="ms ms-xs">schema</span>
            <span>Diagrama de Clases (UML)</span>
          </button>
        </div>
      </div>

      {/* Sub-view content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeSubTab === 'er' && (
          <ProjectModel
            project={project}
            onProjectUpdated={onProjectUpdated}
            initialTab="er"
            hideInternalTabs={true}
          />
        )}
        {activeSubTab === 'usecases' && (
          <ProjectUseCases
            project={project}
            onProjectUpdated={onProjectUpdated}
          />
        )}
        {activeSubTab === 'classes' && (
          <ProjectModel
            project={project}
            onProjectUpdated={onProjectUpdated}
            initialTab="classes"
            hideInternalTabs={true}
          />
        )}
      </div>
    </div>
  );
}
