import React, { useState } from 'react';
import { ArrowLeft, Sparkles, CheckSquare, Users, Database, Layout, GitFork, Cpu, Edit3, Save } from 'lucide-react';
import { projectsApi } from '../api/projects.api';

import ProjectSummary from './ProjectSummary';
import ProjectRequirements from './ProjectRequirements';
import ProjectActors from './ProjectActors';
import ProjectModel from './ProjectModel';
import ProjectPrototype from './ProjectPrototype';
import ProjectNavigation from './ProjectNavigation';
import ProjectArchitecture from './ProjectArchitecture';

export default function ProjectDetail({
  project,
  onBack,
  onProjectUpdated,
  activeTab = 'summary',
  onTabChange
}) {
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [nameValue, setNameValue] = useState(project.name || '');
  const [descValue, setDescValue] = useState(project.description || '');
  const [savingProject, setSavingProject] = useState(false);

  async function handleSaveProject() {
    if (!nameValue.trim()) {
      alert('El nombre del proyecto no puede estar vacío.');
      return;
    }
    try {
      setSavingProject(true);
      await projectsApi.update(project.id, {
        name: nameValue.trim(),
        description: descValue.trim(),
        systemDescription: descValue.trim()
      });
      setIsEditingProject(false);
      await onProjectUpdated();
    } catch (err) {
      alert(`Error al actualizar el proyecto: ${err.message}`);
    } finally {
      setSavingProject(false);
    }
  }

  return (
    <div>
      {/* Back Button and Project Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onBack}
          style={{ marginBottom: '1rem' }}
        >
          <ArrowLeft size={14} />
          <span>Volver a Proyectos</span>
        </button>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
            {isEditingProject ? (
              <div style={{ width: '100%', maxWidth: '750px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Nombre del Proyecto *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    placeholder="Nombre del proyecto"
                    style={{ fontSize: '1.1rem', fontWeight: 600 }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Descripción del Proyecto</label>
                  <textarea
                    className="form-control"
                    value={descValue}
                    onChange={(e) => setDescValue(e.target.value)}
                    placeholder="Descripción o propósito del sistema"
                    style={{ minHeight: '90px' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveProject}
                    disabled={savingProject || !nameValue.trim()}
                  >
                    <Save size={14} />
                    <span>{savingProject ? 'Guardando...' : 'Guardar Cambios'}</span>
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsEditingProject(false)}
                    disabled={savingProject}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {project.name}
                  </h1>
                  <span className="badge badge-in-progress">{project.status}</span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setNameValue(project.name || '');
                      setDescValue(project.description || '');
                      setIsEditingProject(true);
                    }}
                    title="Editar nombre y descripción del proyecto"
                  >
                    <Edit3 size={13} />
                    <span>Editar Proyecto</span>
                  </button>
                </div>

                <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '850px' }}>
                  {project.description || 'Sin descripción asignada.'}
                </div>
              </div>
            )}

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Actualizado: {new Date(project.updatedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="tab-nav">
        <button
          className={`tab-button ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => onTabChange('summary')}
        >
          <Sparkles size={16} />
          <span>Resumen</span>
        </button>
        <button
          className={`tab-button ${activeTab === 'requirements' ? 'active' : ''}`}
          onClick={() => onTabChange('requirements')}
        >
          <CheckSquare size={16} />
          <span>Requisitos ({project.requirements?.length ?? 0})</span>
        </button>
        <button
          className={`tab-button ${activeTab === 'actors' ? 'active' : ''}`}
          onClick={() => onTabChange('actors')}
        >
          <Users size={16} />
          <span>Actores ({project.actors?.length ?? 0})</span>
        </button>
        <button
          className={`tab-button ${activeTab === 'model' ? 'active' : ''}`}
          onClick={() => onTabChange('model')}
        >
          <Database size={16} />
          <span>Modelo ({project.entities?.length ?? 0})</span>
        </button>
        <button
          className={`tab-button ${activeTab === 'prototype' ? 'active' : ''}`}
          onClick={() => onTabChange('prototype')}
        >
          <Layout size={16} />
          <span>Prototipo ({project.screens?.length ?? 0})</span>
        </button>
        <button
          className={`tab-button ${activeTab === 'navigation' ? 'active' : ''}`}
          onClick={() => onTabChange('navigation')}
        >
          <GitFork size={16} />
          <span>Navegación</span>
        </button>
        <button
          className={`tab-button ${activeTab === 'architecture' ? 'active' : ''}`}
          onClick={() => onTabChange('architecture')}
        >
          <Cpu size={16} />
          <span>Arquitectura</span>
        </button>
      </div>

      {/* Active Tab View */}
      <div>
        {activeTab === 'summary' && (
          <ProjectSummary
            project={project}
            onProjectUpdated={onProjectUpdated}
            onNavigateTo={onTabChange}
          />
        )}
        {activeTab === 'requirements' && (
          <ProjectRequirements
            project={project}
            onProjectUpdated={onProjectUpdated}
          />
        )}
        {activeTab === 'actors' && (
          <ProjectActors
            project={project}
            onProjectUpdated={onProjectUpdated}
          />
        )}
        {activeTab === 'model' && (
          <ProjectModel
            project={project}
          />
        )}
        {activeTab === 'prototype' && (
          <ProjectPrototype
            project={project}
          />
        )}
        {activeTab === 'navigation' && (
          <ProjectNavigation
            project={project}
          />
        )}
        {activeTab === 'architecture' && (
          <ProjectArchitecture
            project={project}
          />
        )}
      </div>
    </div>
  );
}
