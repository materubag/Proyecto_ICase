import React, { useState, useEffect } from 'react';
import MockupRenderer from '../components/mockup-renderer/MockupRenderer';
import { mockupApi } from '../api/mockup.api';

export default function ProjectPrototype({ project }) {
  const [generatedScreens, setGeneratedScreens] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const screens = generatedScreens.length > 0 ? generatedScreens : (project.screens || []);
  const [selectedScreenId, setSelectedScreenId] = useState(screens[0]?.id || null);
  const [viewMode, setViewMode] = useState('render');

  useEffect(() => {
    if (screens.length > 0 && (!selectedScreenId || !screens.some(s => s.id === selectedScreenId))) {
      setSelectedScreenId(screens[0].id);
    }
  }, [screens]);

  async function handleGenerateMockup() {
    if (isGenerating) return;
    try {
      setIsGenerating(true);
      setGenerationError(null);
      const result = await mockupApi.generateMockup(
        project.id,
        `Generar un prototipo visual para: ${project.systemDescription || project.description || project.name}`
      );
      const nextScreens = result?.screens || result?.data?.screens || [];
      if (nextScreens.length === 0) throw new Error('El backend no devolvió pantallas para mostrar.');
      setGeneratedScreens(nextScreens);
      setSelectedScreenId(nextScreens[0]?.id || null);
    } catch (error) {
      setGenerationError(error.message || 'No se pudo generar el prototipo.');
    } finally {
      setIsGenerating(false);
    }
  }

  const currentScreen = screens.find(s => s.id === selectedScreenId) || screens[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Command bar */}
      <div className="full-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 className="page-title">Prototipos</h2>
          <div className="vdivider" />
          <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
            {screens.length} pantalla{screens.length !== 1 ? 's' : ''} · Mockups declarativos
          </span>
        </div>
        <div className="page-actions">
          {screens.length > 0 && (
            <div className="view-toggle">
              <button className={`view-toggle-btn ${viewMode === 'render' ? 'active' : ''}`} onClick={() => setViewMode('render')}>
                <span className="ms ms-xs">monitor</span><span>Render</span>
              </button>
              <button className={`view-toggle-btn ${viewMode === 'html' ? 'active' : ''}`} onClick={() => setViewMode('html')}>
                <span className="ms ms-xs">code</span><span>HTML</span>
              </button>
              <button className={`view-toggle-btn ${viewMode === 'json' ? 'active' : ''}`} onClick={() => setViewMode('json')}>
                <span className="ms ms-xs">data_object</span><span>JSON</span>
              </button>
            </div>
          )}
          <button className="btn btn-primary btn-sm" onClick={handleGenerateMockup} disabled={isGenerating}>
            {isGenerating ? (
              <><span className="ms ms-sm spin">autorenew</span><span>Generando...</span></>
            ) : (
              <><span className="ms ms-sm">auto_awesome</span><span>Generar con n8n</span></>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {generationError && (
        <div className="alert alert-danger" style={{ margin: '12px 24px 0' }}>
          <span className="ms ms-sm">error_outline</span>
          <span>{generationError}</span>
        </div>
      )}

      {screens.length === 0 ? (
        <div className="page-scrollable">
          <div className="empty-state" style={{ border: '1px dashed var(--outline-variant)', borderRadius: 'var(--radius-lg)' }}>
            <div className="empty-state-icon"><span className="ms ms-xl">devices</span></div>
            <p className="empty-state-title">Sin pantallas generadas</p>
            <p className="empty-state-desc">
              Ejecuta el análisis IA en la pestaña Resumen o usa el botón "Generar con n8n" para crear los mockups.
            </p>
            <button className="btn btn-primary btn-sm" onClick={handleGenerateMockup} disabled={isGenerating}>
              <span className="ms ms-sm">auto_awesome</span>
              <span>{isGenerating ? 'Generando...' : 'Generar prototipo'}</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Screen selector tabs */}
          <div className="screen-selector">
            {screens.map(screen => (
              <button
                key={screen.id}
                className={`screen-tab ${selectedScreenId === screen.id ? 'active' : ''}`}
                onClick={() => setSelectedScreenId(screen.id)}
              >
                <span className="ms ms-xs">monitor</span>
                <span>{screen.name}</span>
                {screen.route && (
                  <span style={{ fontSize: '0.6875rem', opacity: 0.7 }}>{screen.route}</span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="page-scrollable">
            {viewMode === 'html' ? (
              <div>
                <p className="detail-section-label" style={{ marginBottom: '8px' }}>
                  HTML — {currentScreen?.name}
                </p>
                <pre className="code-viewer" style={{ background: '#f8fafc', color: 'var(--on-surface)' }}>
                  {currentScreen?.html || 'Esta pantalla no contiene HTML.'}
                </pre>
              </div>
            ) : viewMode === 'json' ? (
              <div>
                <p className="detail-section-label" style={{ marginBottom: '8px' }}>
                  Definición JSON — {currentScreen?.name}
                </p>
                <pre className="code-viewer">
                  {JSON.stringify(currentScreen || {}, null, 2)}
                </pre>
              </div>
            ) : (
              <MockupRenderer screen={currentScreen} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
