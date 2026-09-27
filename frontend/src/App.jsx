import React, { useState, useEffect } from 'react';
import Sidebar from './components/common/Sidebar';
import TopHeader from './components/common/TopHeader';
import ProjectsDashboard from './pages/ProjectsDashboard';
import ProjectDetail from './pages/ProjectDetail';
import { projectsApi } from './api/projects.api';
import { candidatesApi } from './api/candidates.api';

export default function App() {
  const [currentProject, setCurrentProject] = useState(null);
  const [activeView, setActiveView] = useState('projects');
  const [pendingCandidatesCount, setPendingCandidatesCount] = useState(0);
  const [activeActivity, setActiveActivity] = useState(null);

  // Load pending candidates count whenever current project changes
  async function refreshProjectStats(projectId) {
    if (!projectId) {
      setPendingCandidatesCount(0);
      return;
    }
    try {
      const stats = await candidatesApi.getStats(projectId);
      setPendingCandidatesCount(stats?.pending || 0);
    } catch {
      setPendingCandidatesCount(0);
    }
  }

  async function handleOpenProject(projectSummary) {
    try {
      const fullProject = await projectsApi.getById(projectSummary.id);
      setCurrentProject(fullProject);
      setActiveView('summary');
      refreshProjectStats(fullProject.id);
    } catch (err) {
      alert(`Error al abrir proyecto: ${err.message}`);
    }
  }

  async function reloadCurrentProject() {
    if (!currentProject) return;
    try {
      const updated = await projectsApi.getById(currentProject.id);
      setCurrentProject(updated);
      refreshProjectStats(updated.id);
    } catch (err) {
      console.error('Error reloading project:', err);
    }
  }

  function handleBackToProjects() {
    setCurrentProject(null);
    setActiveView('projects');
    setPendingCandidatesCount(0);
    setActiveActivity(null);
  }

  function handleViewChange(viewName) {
    if (viewName === 'projects') {
      setCurrentProject(null);
      setActiveView('projects');
    } else {
      setActiveView(viewName);
    }
  }

  // Breadcrumb label per view
  const viewLabels = {
    projects: 'Dashboard',
    summary: 'Resumen',
    requirements: 'Requerimientos',
    planning: 'Planificación',
    modeling: 'Modelado del Sistema',
    navigation: 'Árbol de Navegación',
    mockups: 'Mockups & UI',
    prototype: 'Mockups & UI',
    architecture: 'Arquitectura',
    sources: 'Fuentes & Entrevistas',
    candidates: 'Revisión ISO 29148',
    actors: 'Actores del Sistema',
    model: 'Modelo de Datos',
    diagrams: 'Modelado & Diagramas',
    usecases: 'Casos de Uso',
    traceability: 'Trazabilidad',
    tools_team: 'Equipo & Herramientas',
    changes: 'Control de Cambios',
    versions: 'Historial de Versiones',
    chat: 'Chat IA Asistente',
  };

  return (
    <div className="app-shell">
      {/* Fixed Primary Sidebar */}
      <Sidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        currentProject={currentProject}
        pendingCandidatesCount={pendingCandidatesCount}
        activeActivity={activeActivity}
      />

      {/* Main workspace area */}
      <div className="main-area">
        {/* Top Header */}
        <TopHeader
          projectName={currentProject?.name}
          currentView={viewLabels[activeView] || activeView}
          onBack={currentProject ? handleBackToProjects : null}
          activeActivity={activeActivity}
          onActivityClick={() => {
            if (activeActivity?.targetView) {
              setActiveView(activeActivity.targetView);
            }
          }}
        />

        {/* Page Content */}
        <div className="page-content">
          {!currentProject ? (
            <div className="page-scrollable">
              <ProjectsDashboard onOpenProject={handleOpenProject} />
              <footer className="app-footer" style={{ marginTop: '2.5rem', textAlign: 'center', color: 'var(--outline)', fontSize: '0.75rem' }}>
                <span className="footer-brand" style={{ fontWeight: 600, color: 'var(--secondary)' }}>ICASE Studio</span>
                <span style={{ margin: '0 6px' }}>·</span>
                <span>Ingeniería de Software Asistida por Computadora</span>
                <span style={{ margin: '0 6px' }}>·</span>
                <span>ISO/IEC/IEEE 29148:2018</span>
              </footer>
            </div>
          ) : (
            <ProjectDetail
              project={currentProject}
              onBack={handleBackToProjects}
              onProjectUpdated={reloadCurrentProject}
              activeTab={activeView}
              onTabChange={setActiveView}
              pendingCandidatesCount={pendingCandidatesCount}
            />
          )}
        </div>
      </div>
    </div>
  );
}
