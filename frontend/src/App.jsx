import React, { useState } from 'react';
import Sidebar from './components/common/Sidebar';
import TopHeader from './components/common/TopHeader';
import ProjectsDashboard from './pages/ProjectsDashboard';
import ProjectDetail from './pages/ProjectDetail';
import { projectsApi } from './api/projects.api';

export default function App() {
  const [currentProject, setCurrentProject] = useState(null);
  const [activeView, setActiveView] = useState('projects');

  async function handleOpenProject(projectSummary) {
    try {
      const fullProject = await projectsApi.getById(projectSummary.id);
      setCurrentProject(fullProject);
      setActiveView('summary');
    } catch (err) {
      alert(`Error al abrir proyecto: ${err.message}`);
    }
  }

  async function reloadCurrentProject() {
    if (!currentProject) return;
    try {
      const updated = await projectsApi.getById(currentProject.id);
      setCurrentProject(updated);
    } catch (err) {
      console.error('Error reloading project:', err);
    }
  }

  function handleBackToProjects() {
    setCurrentProject(null);
    setActiveView('projects');
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
    planning: '1. Planificación (GANTT/PERT)',
    sources: 'Fuentes & Entrevistas',
    candidates: 'Revisión ISO 29148',
    requirements: '2. Requisitos (Tabla 1 UTA)',
    usecases: '2.2 Casos de Uso (4 Procesos)',
    prototype: '3.2 Prototipos (Mockup & Info)',
    actors: 'Actores',
    model: 'Modelo del Sistema',
    navigation: 'Navegación',
    architecture: 'Arquitectura',
    modeling: 'Modelado',
    diagrams: '3. Modelado & Diagramas',
    traceability: 'Trazabilidad',
    tools_team: 'Equipo & Herramientas',
    changes: 'Cambios',
    versions: 'Versiones',
    chat: 'Chat IA',
  };

  return (
    <div className="app-shell">
      {/* Fixed Sidebar */}
      <Sidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        currentProject={currentProject}
      />

      {/* Main area */}
      <div className="main-area">
        {/* Fixed Top Header */}
        <TopHeader
          projectName={currentProject?.name}
          currentView={viewLabels[activeView] || activeView}
          onBack={currentProject ? handleBackToProjects : null}
        />

        {/* Page Content */}
        <div className="page-content">
          {!currentProject ? (
            <div className="page-scrollable">
              <ProjectsDashboard onOpenProject={handleOpenProject} />
              <footer className="app-footer" style={{ marginTop: '2rem' }}>
                <span className="footer-brand">ICASE</span>
                <span>·</span>
                <span>Ingeniería de Software Asistida por Computadora</span>
                <span>·</span>
                <span>© {new Date().getFullYear()}</span>
              </footer>
            </div>
          ) : (
            <ProjectDetail
              project={currentProject}
              onBack={handleBackToProjects}
              onProjectUpdated={reloadCurrentProject}
              activeTab={activeView}
              onTabChange={setActiveView}
            />
          )}
        </div>
      </div>
    </div>
  );
}
