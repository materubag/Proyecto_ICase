import React, { useState } from 'react';
import { projectsApi } from '../api/projects.api';

import ProjectSummary from './ProjectSummary';
import ProjectSources from './ProjectSources';
import ProjectCandidateReview from './ProjectCandidateReview';
import ProjectRequirements from './ProjectRequirements';
import ProjectActors from './ProjectActors';
import ProjectModel from './ProjectModel';
import ProjectPrototype from './ProjectPrototype';
import ProjectNavigation from './ProjectNavigation';
import ProjectArchitecture from './ProjectArchitecture';

const TABS = [
  { id: 'summary',       icon: 'auto_awesome',  label: 'Resumen' },
  { id: 'sources',       icon: 'folder_open',   label: 'Fuentes' },
  { id: 'candidates',    icon: 'rate_review',   label: 'Revisión Candidatos' },
  { id: 'requirements',  icon: 'checklist',     label: 'Requisitos',    countKey: 'requirements' },
  { id: 'actors',        icon: 'people',        label: 'Actores',       countKey: 'actors' },
  { id: 'model',         icon: 'account_tree',  label: 'Modelo',        countKey: 'entities' },
  { id: 'prototype',     icon: 'devices',       label: 'Prototipo',     countKey: 'screens' },
  { id: 'navigation',    icon: 'fork_right',    label: 'Navegación' },
  { id: 'architecture',  icon: 'hub',           label: 'Arquitectura' },
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
        {activeTab === 'summary'      && <ProjectSummary project={project} onProjectUpdated={onProjectUpdated} onNavigateTo={onTabChange} />}
        {activeTab === 'sources'      && <ProjectSources project={project} onNavigateToReview={() => onTabChange('candidates')} />}
        {activeTab === 'candidates'   && <ProjectCandidateReview project={project} onNavigateToRequirements={() => onTabChange('requirements')} />}
        {activeTab === 'requirements' && <ProjectRequirements project={project} onProjectUpdated={onProjectUpdated} />}
        {activeTab === 'actors'       && <ProjectActors project={project} onProjectUpdated={onProjectUpdated} />}
        {activeTab === 'model'        && <ProjectModel project={project} />}
        {activeTab === 'prototype'    && <ProjectPrototype project={project} />}
        {activeTab === 'navigation'   && <ProjectNavigation project={project} />}
        {activeTab === 'architecture' && <ProjectArchitecture project={project} />}
      </div>
    </div>
  );
}
