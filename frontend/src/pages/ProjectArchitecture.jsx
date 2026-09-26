import React, { useState, useMemo } from 'react';
import MermaidDiagram from '../components/diagrams/MermaidDiagram';
import { generateArchitectureDiagram } from '../utils/mermaidGenerators';

export default function ProjectArchitecture({ project }) {
  const [showCode, setShowCode] = useState(false);
  const architecture = project.architectures && project.architectures.length > 0
    ? project.architectures[0]
    : null;
  const generatedCode = useMemo(() => generateArchitectureDiagram(architecture), [architecture]);

  const specItems = [
    { label: 'Estilo de Arquitectura', value: architecture?.style || 'Clean Architecture 3 Capas', icon: 'layers' },
    { label: 'Frontend',  value: architecture?.frontend  || 'React SPA',               icon: 'web' },
    { label: 'Backend',   value: architecture?.backend   || 'Node.js Express REST API', icon: 'dns' },
    { label: 'Base de Datos', value: architecture?.database || 'PostgreSQL 16',         icon: 'storage' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="full-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 className="page-title">Arquitectura del Sistema</h2>
          <div className="vdivider" />
          <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
            {architecture?.components?.length ?? 0} componentes del dominio
          </span>
        </div>
        <div className="page-actions">
          <div className="view-toggle">
            <button className={`view-toggle-btn ${!showCode ? 'active' : ''}`} onClick={() => setShowCode(false)}>
              <span className="ms ms-xs">hub</span><span>Diagrama</span>
            </button>
            <button className={`view-toggle-btn ${showCode ? 'active' : ''}`} onClick={() => setShowCode(true)}>
              <span className="ms ms-xs">code</span><span>Código</span>
            </button>
          </div>
        </div>
      </div>

      <div className="page-scrollable">
        {/* Tech Spec */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p className="detail-section-label" style={{ marginBottom: '10px' }}>Especificación Tecnológica</p>
          <div className="spec-grid">
            {specItems.map(item => (
              <div key={item.label} className="info-card">
                <div className="spec-item-label">
                  <span className="ms ms-xs" style={{ color: 'var(--outline)' }}>{item.icon}</span>
                  {item.label}
                </div>
                <span className="spec-item-value">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Components */}
        {architecture?.components && architecture.components.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <p className="detail-section-label" style={{ marginBottom: '10px' }}>
              Componentes del Dominio ({architecture.components.length})
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {architecture.components.map(comp => (
                <div key={comp.id} className="info-card" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
                  <span className="ms ms-sm" style={{ color: 'var(--secondary)' }}>widgets</span>
                  <div>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-surface)' }}>{comp.name}</span>
                    {comp.layer && (
                      <span className="tag" style={{ marginLeft: '8px' }}>{comp.layer}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Diagram or Code */}
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
          <div>
            <p className="detail-section-label" style={{ marginBottom: '10px' }}>Diagrama de Arquitectura</p>
            <div className="diagram-container">
              <MermaidDiagram code={generatedCode} type="flowchart" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
