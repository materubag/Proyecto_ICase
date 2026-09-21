import React, { useState, useMemo } from 'react';
import { GitFork, Code2 } from 'lucide-react';
import MermaidDiagram from '../components/diagrams/MermaidDiagram';
import { generateNavigationDiagram } from '../utils/mermaidGenerators';

export default function ProjectNavigation({ project }) {
  const [showCode, setShowCode] = useState(false);

  const navigation = project.navigationNodes || [];
  const screens = project.screens || [];

  // Generación determinística independiente sin IA
  const generatedCode = useMemo(() => {
    return generateNavigationDiagram(navigation, screens);
  }, [navigation, screens]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <GitFork size={18} color="var(--primary)" />
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Árbol de Navegación del Sistema</h2>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Diagrama generado automáticamente mediante <code>generateNavigationDiagram(navigation, screens)</code> con Mermaid flowchart.
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
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Nodos y transiciones registradas: </span>
            <span className="badge badge-planning" style={{ marginLeft: '4px' }}>{navigation.length}</span>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', marginLeft: '1rem' }}>Pantallas destino: </span>
            <span className="badge badge-planning" style={{ marginLeft: '4px' }}>{screens.length}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Sintaxis: <code>flowchart TD</code>
          </div>
        </div>
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
