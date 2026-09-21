import React, { useState, useEffect } from 'react';
import { Layout, Monitor, Code } from 'lucide-react';
import MockupRenderer from '../components/mockup-renderer/MockupRenderer';

export default function ProjectPrototype({ project }) {
  const screens = project.screens || [];
  const [selectedScreenId, setSelectedScreenId] = useState(screens[0]?.id || null);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    if (screens.length > 0 && (!selectedScreenId || !screens.some(s => s.id === selectedScreenId))) {
      setSelectedScreenId(screens[0].id);
    }
  }, [screens]);

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
            className="btn btn-secondary btn-sm"
            onClick={() => setShowJson(!showJson)}
          >
            <Code size={14} />
            <span>{showJson ? 'Ver Render de Pantalla' : 'Ver Estructura de Componentes'}</span>
          </button>
        </div>
      </div>

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

          {showJson ? (
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
