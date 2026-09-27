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

const TABS = [
  { id: 'summary',      icon: 'auto_awesome',   label: 'Resumen' },
  { id: 'requirements', icon: 'checklist',      label: 'Requerimientos', countKey: 'requirements' },
  { id: 'planning',     icon: 'calendar_month', label: 'Planificación' },
  { id: 'modeling',     icon: 'schema',         label: 'Modelado' },
  { id: 'navigation',   icon: 'account_tree',   label: 'Árbol de Navegación' },
  { id: 'mockups',      icon: 'devices',        label: 'Mockups', countKey: 'screens' },
  { id: 'architecture', icon: 'layers',         label: 'Arquitectura' },
  { id: 'traceability', icon: 'link',           label: 'Trazabilidad' },
  { id: 'tools_team',   icon: 'groups',         label: 'Equipo & Herramientas' },
  { id: 'changes',      icon: 'change_circle',  label: 'Cambios' },
  { id: 'versions',     icon: 'history',        label: 'Versiones' },
  { id: 'chat',         icon: 'chat',           label: 'Chat IA' },
];

export default function ProjectDetail({
  project,
  onBack,
  onProjectUpdated,
  activeTab = 'summary',
  onTabChange
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

  const getCount = (key) => {
    if (!key) return null;
    return project[key]?.length ?? project._count?.[key] ?? null;
  };

  const statusBadge = () => {
    switch (project.status) {
      case 'IN_PROGRESS': return <span className="badge badge-in-progress">En Progreso</span>;
      case 'COMPLETED':   return <span className="badge badge-success">Completado</span>;
      default:            return <span className="badge badge-planning">Planificación</span>;
    }
  };

  return (
    <div className="full-page">
      {/* Sub-header: project info + tabs */}
      <div className="page-subheader">
        {/* Row 1: project name + actions */}
        <div className="page-subheader-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            {isEditing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="form-control"
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  style={{ width: '280px', height: '32px', padding: '0 8px', fontWeight: 600 }}
                  autoFocus
                />
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !nameValue.trim()}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setIsEditing(false)} disabled={saving}>
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                <h1 className="page-title">{project.name}</h1>
                {statusBadge()}
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => { setNameValue(project.name); setDescValue(project.description || ''); setIsEditing(true); }}
                  title="Editar proyecto"
                >
                  <span className="ms ms-sm">edit</span>
                </button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--outline)' }}>
              Actualizado: {new Date(project.updatedAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={onBack}>
              <span className="ms ms-sm">arrow_back</span>
              <span>Proyectos</span>
            </button>
          </div>
        </div>

        {/* Row 2: description (if editing) */}
        {isEditing && (
          <textarea
            className="form-control"
            value={descValue}
            onChange={e => setDescValue(e.target.value)}
            placeholder="Descripción del proyecto..."
            style={{ minHeight: '60px' }}
          />
        )}

        {/* Row 3: Tab navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', overflowX: 'auto' }}>
          {TABS.map(tab => {
            const count = getCount(tab.countKey);
            return (
              <button
                key={tab.id}
                className={`seg-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => onTabChange(tab.id)}
              >
                <span className="ms ms-sm">{tab.icon}</span>
                <span>{tab.label}</span>
                {count !== null && (
                  <span className="seg-btn-count">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
          <ProjectNavigation project={project} />
        )}
        {(activeTab === 'mockups' || activeTab === 'prototype') && (
          <ProjectPrototype project={project} />
        )}
        {activeTab === 'architecture' && (
          <ProjectArchitecture project={project} />
        )}
        {activeTab === 'sources' && (
          <ProjectSources project={project} onNavigateToReview={() => onTabChange('requirements')} />
        )}
        {activeTab === 'tools_team' && (
          <ProjectToolsTeam project={project} onNavigateTo={onTabChange} />
        )}
        {['traceability', 'changes', 'versions', 'chat'].includes(activeTab) && (
          <ProjectEngineering project={project} view={activeTab} onProjectUpdated={onProjectUpdated} />
        )}
      </div>
    </div>
  );
}
