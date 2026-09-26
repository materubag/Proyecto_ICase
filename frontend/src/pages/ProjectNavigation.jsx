import React, { useState, useMemo } from 'react';
import MermaidDiagram from '../components/diagrams/MermaidDiagram';
import { generateNavigationDiagram } from '../utils/mermaidGenerators';

export default function ProjectNavigation({ project }) {
  const [showCode, setShowCode] = useState(false);
  const navigation = project.navigationNodes || [];
  const screens = project.screens || [];
  const generatedCode = useMemo(() => generateNavigationDiagram(navigation, screens), [navigation, screens]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="full-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 className="page-title">Árbol de Navegación</h2>
          <div className="vdivider" />
          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              <strong style={{ color: 'var(--on-surface)', fontWeight: 600 }}>{navigation.length}</strong> nodos
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              <strong style={{ color: 'var(--on-surface)', fontWeight: 600 }}>{screens.length}</strong> pantallas
            </span>
          </div>
        </div>
        <div className="page-actions">
          <div className="view-toggle">
            <button className={`view-toggle-btn ${!showCode ? 'active' : ''}`} onClick={() => setShowCode(false)}>
              <span className="ms ms-xs">fork_right</span><span>Diagrama</span>
            </button>
            <button className={`view-toggle-btn ${showCode ? 'active' : ''}`} onClick={() => setShowCode(true)}>
              <span className="ms ms-xs">code</span><span>Código</span>
            </button>
          </div>
        </div>
      </div>

      <div className="page-scrollable">
        {showCode ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="detail-section-label">Código Mermaid Generado</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(generatedCode)}>
                <span className="ms ms-sm">content_copy</span><span>Copiar</span>
              </button>
            </div>
            <textarea className="diagram-raw-editor" rows={14} readOnly value={generatedCode} />
          </div>
        ) : (
          <>
            {navigation.length === 0 && screens.length === 0 ? (
              <div className="empty-state" style={{ border: '1px dashed var(--outline-variant)', borderRadius: 'var(--radius-lg)' }}>
                <div className="empty-state-icon"><span className="ms ms-xl">fork_right</span></div>
                <p className="empty-state-title">Sin datos de navegación</p>
                <p className="empty-state-desc">Ejecuta el análisis IA en la pestaña Resumen para generar el árbol de navegación.</p>
              </div>
            ) : (
              <div className="diagram-container">
                <MermaidDiagram code={generatedCode} type="flowchart" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
