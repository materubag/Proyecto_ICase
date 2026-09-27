import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Initialize mermaid once with clean modern theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'strict',
  fontFamily: 'Inter, system-ui, sans-serif'
});

export default function MermaidDiagram({ code, type = 'flowchart', className = '', onValidated }) {
  const validationCallback = useRef(onValidated);
  validationCallback.current = onValidated;
  const containerRef = useRef(null);
  const [svgContent, setSvgContent] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function renderChart() {
      if (!code || !code.trim()) {
        setSvgContent('');
        return;
      }

      const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;

      try {
        setError(null);
        setSvgContent('');
        await mermaid.parse(code.trim());
        const { svg } = await mermaid.render(id, code.trim());
        if (isMounted) {
          setSvgContent(svg);
          validationCallback.current?.(true);
        }
      } catch (err) {
        console.error('[Mermaid Render Error]:', err);
        if (isMounted) {
          setError(err.message || 'Error al renderizar el diagrama de Mermaid.');
          setSvgContent('');
          validationCallback.current?.(false, err.message);
        }
      }
    }

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [code, type]);

  if (error) {
    return (
      <div style={{ padding: '1rem', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem' }}>
        <strong>Error en sintaxis de diagrama:</strong>
        <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{error}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`mermaid-diagram-viewer ${className}`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
      style={{ display: 'flex', justifyContent: 'center', width: '100%', overflowX: 'auto' }}
    />
  );
}
