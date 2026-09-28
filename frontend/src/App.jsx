import React, { useState, useEffect } from 'react';
import Sidebar from './components/common/Sidebar';
import TopHeader from './components/common/TopHeader';
import ProjectsDashboard from './pages/ProjectsDashboard';
import ProjectDetail from './pages/ProjectDetail';
import { projectsApi } from './api/projects.api';
import { candidatesApi } from './api/candidates.api';
import { mockupApi } from './api/mockup.api';

export default function App() {
  const [currentProject, setCurrentProject] = useState(null);
  const [activeView, setActiveView] = useState('projects');
  const [pendingCandidatesCount, setPendingCandidatesCount] = useState(0);
  const [activeActivity, setActiveActivity] = useState(null);

  // Estado global persistente para la generación de mockups en segundo plano
  const [mockupGeneration, setMockupGeneration] = useState({
    isGenerating: false,
    projectId: null,
    mode: 'stitch',
    screenCount: 0,
    startTime: null,
    error: null,
    success: null
  });

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
      return updated;
    } catch (err) {
      console.error('Error reloading project:', err);
    }
  }

  // Iniciar generación persistente de mockups (Google Stitch o Local)
  async function handleStartMockupGeneration(projectId, prompt, screenIds, mode = 'stitch') {
    if (mockupGeneration.isGenerating) return;

    setMockupGeneration({
      isGenerating: true,
      projectId,
      mode,
      screenCount: screenIds.length,
      startTime: Date.now(),
      error: null,
      success: null
    });

    setActiveActivity({
      label: mode === 'stitch' ? 'Generando en Google Stitch' : 'Generando mockups locales',
      progress: `${screenIds.length} pantalla${screenIds.length !== 1 ? 's' : ''}`,
      targetView: 'mockups'
    });

    try {
      const result = await mockupApi.generateMockup(projectId, prompt, screenIds, mode);
      await reloadCurrentProject();

      setMockupGeneration(prev => ({
        ...prev,
        isGenerating: false,
        error: null,
        success: mode === 'stitch'
          ? `¡Se generaron exitosamente ${screenIds.length} pantalla(s) con Google Stitch!`
          : `¡Se generaron exitosamente ${screenIds.length} pantalla(s) con el motor local!`
      }));

      return result;
    } catch (err) {
      console.error('Error en generación de mockups:', err);
      const isTimeout = err.message?.includes('504') || err.message?.includes('timeout') || err.message?.includes('tiempo límite');
      setMockupGeneration(prev => ({
        ...prev,
        isGenerating: false,
        error: {
          message: err.message || 'No se pudo generar el prototipo.',
          isTimeout
        },
        success: null
      }));
      throw err;
    } finally {
      setActiveActivity(null);
    }
  }

  function handleClearMockupFeedback() {
    setMockupGeneration(prev => ({ ...prev, error: null, success: null }));
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
              <footer className="app-footer" style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                <span className="footer-brand">ICASE Studio</span>
                <span style={{ margin: '0 6px', color: 'var(--outline)' }}>·</span>
                <span>Ingeniería de Software Asistida por Computadora</span>
                <span style={{ margin: '0 6px', color: 'var(--outline)' }}>·</span>
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
              mockupGeneration={mockupGeneration}
              onStartMockupGeneration={handleStartMockupGeneration}
              onClearMockupFeedback={handleClearMockupFeedback}
            />
          )}
        </div>
      </div>
    </div>
  );
}
