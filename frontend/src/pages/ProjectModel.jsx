import React, { useState, useMemo } from 'react';
import MermaidDiagram from '../components/diagrams/MermaidDiagram';
import { generateERDiagram } from '../utils/mermaidGenerators';

export default function ProjectModel({ project }) {
  const [showCode, setShowCode] = useState(false);
  const entities = project.entities || [];
  const relationships = project.relationships || [];
  const generatedCode = useMemo(() => generateERDiagram(entities, relationships), [entities, relationships]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Command bar */}
      <div className="full-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 className="page-title">Modelo de Datos</h2>
          <div className="vdivider" />
          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              <strong style={{ color: 'var(--on-surface)', fontWeight: 600 }}>{entities.length}</strong> entidades
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              <strong style={{ color: 'var(--on-surface)', fontWeight: 600 }}>{relationships.length}</strong> relaciones
            </span>
          </div>
        </div>
        <div className="page-actions">
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${!showCode ? 'active' : ''}`}
              onClick={() => setShowCode(false)}
            >
              <span className="ms ms-xs">account_tree</span>
              <span>Diagrama</span>
            </button>
            <button
              className={`view-toggle-btn ${showCode ? 'active' : ''}`}
              onClick={() => setShowCode(true)}
            >
              <span className="ms ms-xs">code</span>
              <span>Código Mermaid</span>
            </button>
          </div>
        </div>
      </div>

      <div className="page-scrollable">
        {showCode ? (
          <div>
            <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="detail-section-label">Código Mermaid Generado</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigator.clipboard?.writeText(generatedCode)}
                title="Copiar al portapapeles"
              >
                <span className="ms ms-sm">content_copy</span>
                <span>Copiar</span>
              </button>
            </div>
            <textarea
              className="diagram-raw-editor"
              rows={16}
              readOnly
              value={generatedCode}
            />
          </div>
        ) : (
          <>
            {entities.length === 0 ? (
              <div className="empty-state" style={{ border: '1px dashed var(--outline-variant)', borderRadius: 'var(--radius-lg)' }}>
                <div className="empty-state-icon"><span className="ms ms-xl">account_tree</span></div>
                <p className="empty-state-title">Sin entidades generadas</p>
                <p className="empty-state-desc">Ejecuta el análisis IA en la pestaña Resumen para generar el modelo de datos.</p>
              </div>
            ) : (
              <div className="diagram-container">
                <MermaidDiagram code={generatedCode} type="erDiagram" />
              </div>
            )}

            {/* Entity list summary */}
            {entities.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <p className="detail-section-label" style={{ marginBottom: '10px' }}>Entidades del Sistema ({entities.length})</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {entities.map(ent => (
                    <div key={ent.id} className="info-card" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px' }}>
                      <span className="ms ms-sm" style={{ color: 'var(--secondary)' }}>table_chart</span>
                      <div>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-surface)' }}>{ent.name}</span>
                        {ent.attributes && ent.attributes.length > 0 && (
                          <span style={{ fontSize: '0.6875rem', color: 'var(--outline)', marginLeft: '6px' }}>{ent.attributes.length} atributos</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
