import React, { useState, useEffect } from 'react';
import { Layout, Monitor, Code, FileCode2, Sparkles, Loader2 } from 'lucide-react';
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
      if (nextScreens.length === 0) {
        throw new Error('El backend respondió correctamente, pero no devolvió pantallas para mostrar.');
      }
      setGeneratedScreens(nextScreens);
      setSelectedScreenId(nextScreens[0]?.id || null);
    } catch (error) {
      setGenerationError(error.message || 'No se pudo generar el prototipo.');
    } finally {
      setIsGenerating(false);
    }
  }

  const currentScreen = screens.find((s) => s.id === selectedScreenId) || screens[0];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layout size={18} color="var(--primary)" />
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Prototipado Declarativo (Mockups)</h2>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleGenerateMockup}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            <span>{isGenerating ? 'Generando...' : 'Generar con n8n'}</span>
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'render' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('render')}
          >
            <Monitor size={14} />
            <span>Ver Render</span>
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'html' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('html')}
          >
            <FileCode2 size={14} />
            <span>Ver HTML</span>
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'json' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('json')}
          >
            <Code size={14} />
            <span>Ver JSON</span>
          </button>
        </div>
      </div>

      {generationError && (
        <div className="card" style={{ color: 'var(--danger)', marginBottom: '1rem' }}>
          {generationError}
        </div>
      )}

      {screens.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>
            No hay pantallas registradas aún. Ejecute el análisis en la pestaña <strong>Resumen</strong> para generarlas.
          </p>
        </div>
      ) : (
        <>
          {/* Selector de Pantallas */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            {screens.map((screen) => (
              <button
                key={screen.id}
                className={`btn btn-sm ${selectedScreenId === screen.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedScreenId(screen.id)}
              >
                <Monitor size={13} />
                <span>{screen.name}</span>
                <span style={{ fontSize: '0.7rem', opacity: 0.8, marginLeft: '4px' }}>({screen.route})</span>
              </button>
            ))}
          </div>

          {viewMode === 'html' ? (
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Código HTML: {currentScreen?.name}
              </h3>
              <pre style={{
                backgroundColor: '#0f172a',
                color: '#d1fae5',
                padding: '1.25rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                maxHeight: '620px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {currentScreen?.html || 'Esta pantalla no contiene HTML.'}
              </pre>
            </div>
          ) : viewMode === 'json' ? (
            <div className="card">
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Definición Declarativa de la Pantalla: {currentScreen?.name}
              </h3>
              <pre style={{
                backgroundColor: '#0f172a',
                color: '#a7f3d0',
                padding: '1.25rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-mono)',
                maxHeight: '450px',
                overflowY: 'auto'
              }}>
                {JSON.stringify(currentScreen || {}, null, 2)}
              </pre>
            </div>
          ) : (
            <div>
              <MockupRenderer screen={currentScreen} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
