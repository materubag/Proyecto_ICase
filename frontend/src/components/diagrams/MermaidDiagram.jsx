import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Initialize mermaid once with clean modern theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'strict',
  fontFamily: 'Inter, system-ui, sans-serif'
});

function sanitizeMermaidCode(rawCode) {
  if (!rawCode || typeof rawCode !== 'string') return '';
  let clean = rawCode.trim();

  // If erDiagram, fix any union types or invalid symbols in attribute lines
  if (/^\s*erDiagram/m.test(clean)) {
    // Replace lines like: "    string|null motivo" -> "    string motivo"
    clean = clean.replace(/^(\s*)([a-zA-Z0-9_]+)\s*\|[^\s{}]*(\s+[a-zA-Z0-9_]+)/gm, '$1$2$3');
    // Replace any remaining pipe or invalid types inside entity brackets
    const lines = clean.split('\n');
    let insideEntity = false;
    clean = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.endsWith('{')) insideEntity = true;
      if (trimmed === '}' || trimmed.startsWith('}')) insideEntity = false;
      if (insideEntity && line.includes('|')) {
        return line.replace(/([a-zA-Z0-9_]+)\s*\|[a-zA-Z0-9_]+/g, '$1');
      }
      return line;
    }).join('\n');
  }

  return clean;
}

export default function MermaidDiagram({ code, type = 'flowchart', className = '', onValidated }) {
  const validationCallback = useRef(onValidated);
  validationCallback.current = onValidated;
  const containerRef = useRef(null);
  const [svgContent, setSvgContent] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function renderChart() {
      const sanitizedCode = sanitizeMermaidCode(code);
      if (!sanitizedCode) {
        setSvgContent('');
        return;
      }

      const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;

      try {
        setError(null);
        setSvgContent('');
        await mermaid.parse(sanitizedCode);
        const { svg } = await mermaid.render(id, sanitizedCode);
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
