import React, { useState, useMemo } from 'react';
import { Database, Code2 } from 'lucide-react';
import MermaidDiagram from '../components/diagrams/MermaidDiagram';
import { generateERDiagram } from '../utils/mermaidGenerators';

export default function ProjectModel({ project }) {
  const [showCode, setShowCode] = useState(false);

  const entities = project.entities || [];
  const relationships = project.relationships || [];

  // Generación determinística independiente sin IA
  const generatedCode = useMemo(() => {
    return generateERDiagram(entities, relationships);
  }, [entities, relationships]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={18} color="var(--primary)" />
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Modelo de Datos (Diagrama Entidad-Relación)</h2>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Diagrama E/R generado automáticamente mediante la función <code>generateERDiagram(entities, relationships)</code> a partir de PostgreSQL.
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

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Entidades detectadas: </span>
            <span className="badge badge-planning" style={{ marginLeft: '4px' }}>{entities.length}</span>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', marginLeft: '1rem' }}>Relaciones: </span>
            <span className="badge badge-planning" style={{ marginLeft: '4px' }}>{relationships.length}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Sintaxis: <code>erDiagram</code>
          </div>
        </div>
      </div>

      {showCode && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <label className="form-label" style={{ fontWeight: 600 }}>Código Mermaid Generado</label>
          <textarea
            className="diagram-raw-editor"
            rows={10}
            readOnly
            value={generatedCode}
          />
        </div>
      )}

      <div className="diagram-container">
        <MermaidDiagram code={generatedCode} type="erDiagram" />
      </div>
    </div>
  );
}
