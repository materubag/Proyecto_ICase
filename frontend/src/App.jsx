import React, { useState } from 'react';
import Navbar from './components/common/Navbar';
import ProjectsDashboard from './pages/ProjectsDashboard';
import ProjectDetail from './pages/ProjectDetail';
import { projectsApi } from './api/projects.api';

export default function App() {
  const [currentProject, setCurrentProject] = useState(null);
  const [activeView, setActiveView] = useState('projects'); // 'projects' | 'summary' | 'requirements' | 'actors' | 'model' | 'prototype' | 'navigation' | 'architecture'

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

  return (
    <div className="app-container">
      <Navbar
        activeView={activeView}
        onViewChange={handleViewChange}
        currentProject={currentProject}
      />

      <main className="main-content">
        {!currentProject ? (
          <ProjectsDashboard onOpenProject={handleOpenProject} />
        ) : (
          <ProjectDetail
            project={currentProject}
            onBack={handleBackToProjects}
            onProjectUpdated={reloadCurrentProject}
            activeTab={activeView}
            onTabChange={setActiveView}
          />
        )}
      </main>

      <footer className="footer">
        <div>
          <strong>ICASE</strong> • Plataforma Asistida por Software (MVP) • Universidad Nacional de Ingeniería
        </div>
      </footer>
    </div>
  );
}
