import React, { useState } from 'react';
import { projectsApi } from '../api/projects.api';

import ProjectSummary from './ProjectSummary';
import ProjectSources from './ProjectSources';
import ProjectRequirements from './ProjectRequirements';
import ProjectPlanning from './ProjectPlanning';
import ProjectModeling from './ProjectModeling';
import ProjectNavigation from './ProjectNavigation';
import ProjectPrototype from './ProjectPrototype';
import ProjectArchitecture from './ProjectArchitecture';
import ProjectToolsTeam from './ProjectToolsTeam';
import ProjectEngineering from './ProjectEngineering';
import ProjectChatView from '../components/chat/ProjectChatView';

export default function ProjectDetail({
  project,
  onBack,
  onProjectUpdated,
  activeTab = 'summary',
  onTabChange,
  pendingCandidatesCount = 0
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [nameValue, setNameValue] = useState(project.name || '');
  const [descValue, setDescValue] = useState(project.description || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!nameValue.trim()) return;
    try {
      setSaving(true);
      await projectsApi.update(project.id, {
        name: nameValue.trim(),
        description: descValue.trim(),
        systemDescription: descValue.trim()
      });
      setIsEditing(false);
      await onProjectUpdated();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const statusBadge = () => {
    switch (project.status) {
      case 'IN_PROGRESS':
        return <span className="badge badge-in-progress">En Progreso</span>;
      case 'COMPLETED':
        return <span className="badge badge-success">Completado</span>;
      default:
        return <span className="badge badge-planning">Planificación</span>;
    }
  };

  return (
    <div className="full-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Workspace Sub-header: project context & quick actions (without duplicate tab navigation) */}
      <div className="page-subheader">
        <div className="page-subheader-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexWrap: 'wrap' }}>
            {isEditing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="form-control"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  style={{ width: '280px', height: '32px', padding: '0 8px', fontWeight: 600 }}
                  autoFocus
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSave}
                  disabled={saving || !nameValue.trim()}
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                <h1 className="page-title" style={{ margin: 0 }}>{project.name}</h1>
                {statusBadge()}
                <button
                  type="button"
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => {
                    setNameValue(project.name);
                    setDescValue(project.description || '');
                    setIsEditing(true);
                  }}
                  title="Editar nombre y descripción"
                  aria-label="Editar proyecto"
                >
                  <span className="ms ms-sm">edit</span>
                </button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {/* Attention banner if pending candidates exist */}
            {pendingCandidatesCount > 0 && activeTab !== 'requirements' && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => onTabChange('requirements')}
                style={{
                  color: '#f87171',
                  borderColor: 'rgba(248, 113, 113, 0.2)',
                  background: 'rgba(248, 113, 113, 0.08)',
                  fontSize: '0.75rem'
                }}
                title="Ir a revisión de candidatos ISO 29148"
              >
                <span className="ms ms-xs">rate_review</span>
                <span>{pendingCandidatesCount} candidatos por revisar</span>
              </button>
            )}

            <span style={{ fontSize: '0.75rem', color: 'var(--outline)' }}>
              Actualizado: {new Date(project.updatedAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onBack}
              title="Volver a lista de proyectos"
            >
              <span className="ms ms-sm">arrow_back</span>
              <span>Proyectos</span>
            </button>
          </div>
        </div>

        {/* Inline description editor if editing */}
        {isEditing && (
          <textarea
            className="form-control"
            value={descValue}
            onChange={(e) => setDescValue(e.target.value)}
            placeholder="Descripción del proyecto..."
            style={{ minHeight: '60px', marginTop: '6px' }}
          />
        )}
      </div>

      {/* Module Workspace Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'summary' && (
          <ProjectSummary project={project} onProjectUpdated={onProjectUpdated} onNavigateTo={onTabChange} />
        )}
        {(activeTab === 'requirements' || activeTab === 'candidates' || activeTab === 'actors') && (
          <ProjectRequirements
            project={project}
            onProjectUpdated={onProjectUpdated}
            initialSubTab={activeTab === 'candidates' ? 'candidates' : activeTab === 'actors' ? 'actors' : 'candidates'}
          />
        )}
        {activeTab === 'sources' && (
          <ProjectSources
            project={project}
            onNavigateToReview={() => onTabChange('requirements')}
            onNavigateToSummary={() => onTabChange('summary')}
          />
        )}
        {activeTab === 'planning' && (
          <ProjectPlanning project={project} />
        )}
        {(activeTab === 'modeling' || activeTab === 'diagrams' || activeTab === 'model' || activeTab === 'usecases') && (
          <ProjectModeling
            project={project}
            initialSubTab={activeTab === 'usecases' ? 'usecases' : 'er'}
          />
        )}
        {activeTab === 'navigation' && (
          <ProjectNavigation project={project} onProjectUpdated={onProjectUpdated} />
        )}
        {(activeTab === 'mockups' || activeTab === 'prototype') && (
          <ProjectPrototype project={project} onProjectUpdated={onProjectUpdated} />
        )}
        {activeTab === 'architecture' && (
          <ProjectArchitecture project={project} onProjectUpdated={onProjectUpdated} />
        )}
        {activeTab === 'tools_team' && (
          <ProjectToolsTeam project={project} onNavigateTo={onTabChange} />
        )}
        {activeTab === 'chat' && (
          <ProjectChatView project={project} onProjectUpdated={onProjectUpdated} />
        )}
        {['traceability', 'changes', 'versions'].includes(activeTab) && (
          <ProjectEngineering project={project} view={activeTab} onProjectUpdated={onProjectUpdated} />
        )}
      </div>
    </div>
  );
}
