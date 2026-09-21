import React, { useState, useMemo } from 'react';
import { Cpu, Code2, Layers, Globe, Server, Database } from 'lucide-react';
import MermaidDiagram from '../components/diagrams/MermaidDiagram';
import { generateArchitectureDiagram } from '../utils/mermaidGenerators';

export default function ProjectArchitecture({ project }) {
  const [showCode, setShowCode] = useState(false);

  const architecture = project.architectures && project.architectures.length > 0
    ? project.architectures[0]
    : null;

  // Generación determinística independiente sin IA
  const generatedCode = useMemo(() => {
    return generateArchitectureDiagram(architecture);
  }, [architecture]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cpu size={18} color="var(--primary)" />
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Arquitectura del Sistema</h2>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Diagrama generado automáticamente mediante <code>generateArchitectureDiagram(architecture)</code> en Mermaid flowchart.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowCode(!showCode)}
          >
            <Code2 size={14} />
            <span>{showCode ? 'Ocultar Código Mermaid' : 'Ver Código Mermaid'}</span>
          </button>
        </div>
      </div>

      {/* Ficha de Especificación de Arquitectura */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={16} color="var(--primary)" />
          Especificación Tecnológica
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Estilo de Arquitectura</span>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{architecture?.style || 'Clean Architecture en 3 Capas'}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Globe size={12} /> Frontend
            </span>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{architecture?.frontend || 'React SPA'}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Server size={12} /> Backend
            </span>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{architecture?.backend || 'Node.js Express REST API'}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Database size={12} /> Base de Datos
            </span>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{architecture?.database || 'PostgreSQL 16 Engine'}</strong>
          </div>
        </div>

        {architecture?.components && architecture.components.length > 0 && (
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
              Componentes del Dominio ({architecture.components.length}):
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {architecture.components.map((comp) => (
                <span key={comp.id} className="badge badge-planning">
                  {comp.name} ({comp.layer || 'Capa'})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCode && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <label className="form-label" style={{ fontWeight: 600 }}>Código Mermaid Generado</label>
          <textarea
            className="diagram-raw-editor"
            rows={8}
            readOnly
            value={generatedCode}
          />
        </div>
      )}

      <div className="diagram-container">
        <MermaidDiagram code={generatedCode} type="flowchart" />
      </div>
    </div>
  );
}
