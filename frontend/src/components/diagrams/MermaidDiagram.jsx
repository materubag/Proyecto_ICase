import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Initialize mermaid once with clean modern theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'strict',
  fontFamily: 'Inter, system-ui, sans-serif'
});


/**
 * Client-side emergency sanitization for Mermaid syntax errors (accents, reserved words).
 */
function sanitizeClientMermaid(rawCode, type) {
  if (!rawCode || typeof rawCode !== 'string') return '';
  let text = rawCode.trim();

  const isER = /^erdiagram/i.test(text) || String(type).toUpperCase() === 'ER' || /erdiagram/i.test(text);
  if (isER) {
    // 1. Strip comments
    text = text.replace(/%%.*$/gm, '');

    // 2. Process each entity block
    text = text.replace(/([a-zA-Z0-9_]+)\s*\{([^}]*)\}/g, (match, ent, attrs) => {
      const attrLines = [];
      attrs.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        // Split concatenated attributes e.g. "string código PK string categoría"
        const tokens = trimmed.split(/(?=\b(?:string|int|integer|float|double|decimal|boolean|bool|date|datetime|number)\b)/i)
          .map(t => t.trim())
          .filter(Boolean);
        attrLines.push(...tokens);
      });

      const cleanAttrs = attrLines
        .map(attrLine => {
          let line = attrLine
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\bdecimal\b/gi, 'float')
            .replace(/\binteger\b/gi, 'int')
            .replace(/\bnumber\b/gi, 'int')
            .replace(/[^a-zA-Z0-9_\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          const parts = line.split(' ');
          if (parts.length >= 2) {
            const t = parts[0].toLowerCase();
            const n = parts[1].toLowerCase();
            const keys = parts.slice(2).map(k => k.toUpperCase()).filter(k => ['PK', 'FK', 'UK'].includes(k));
            return `        ${t} ${n}${keys.length ? ' ' + keys.join(' ') : ''}`;
          }
          return null;
        })
        .filter(Boolean)
        .join('\n');

      return `${ent} {\n${cleanAttrs}\n    }`;
    });
  }

  // Sanitize reserved keyword 'end' as node ID in flowcharts
  text = text.replace(/\bend(?=\s*\[|\s*\()(?!\s*-->)/gi, 'NODE_END');
  text = text.replace(/(?:-->|---\s*)\s*end\b/gi, '--> NODE_END');

  return text;
}

export default function MermaidDiagram({ code, type = 'flowchart', className = '', onValidated }) {
  const validationCallback = useRef(onValidated);
  validationCallback.current = onValidated;
  const containerRef = useRef(null);
  const [svgContent, setSvgContent] = useState('');
  const [error, setError] = useState(null);
  const [showTechnicalError, setShowTechnicalError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function renderChart() {
      const sanitizedCode = sanitizeMermaidCode(code);
      if (!sanitizedCode) {
        setSvgContent('');
        setError(null);
        return;
      }

      const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
      let targetCode = code.trim();

      try {
        setError(null);
        setSvgContent('');


        // Attempt 1: Parse original code
        try {
          await mermaid.parse(targetCode);
        } catch (firstParseErr) {
          // Attempt 2: Try client-side sanitization
          console.warn('[MermaidDiagram] Primer parseo falló. Intentando normalización cliente...', firstParseErr.message);
          targetCode = sanitizeClientMermaid(targetCode, type);
          await mermaid.parse(targetCode);
        }

        const { svg } = await mermaid.render(id, targetCode);

        if (isMounted) {
          setSvgContent(svg);
          setError(null);
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
      <div
        style={{
          padding: '24px',
          background: 'var(--surface-container-low)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
          maxWidth: '600px',
          margin: '20px auto'
        }}
      >
        <div style={{ display: 'inline-flex', padding: '10px', background: 'rgba(180, 35, 24, 0.1)', borderRadius: '50%', color: '#b42318', marginBottom: '12px' }}>
          <span className="ms" style={{ fontSize: '28px' }}>warning</span>
        </div>
        <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--on-surface)' }}>
          El diagrama requiere revisión
        </h4>
        <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: 'var(--secondary)', lineHeight: 1.5 }}>
          Se detectaron inconsistencias de sintaxis en el código Mermaid generado. Puedes pulsar <strong>Regenerar</strong> para generar una versión corregida.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-outline btn-xs"
            onClick={() => setShowTechnicalError(!showTechnicalError)}
          >
            <span className="ms ms-xs">bug_report</span>
            <span>{showTechnicalError ? 'Ocultar detalle técnico' : 'Ver detalle técnico'}</span>
          </button>
        </div>

        {showTechnicalError && (
          <div style={{ marginTop: '14px', textAlign: 'left', background: 'var(--surface-container-lowest)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-default)' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#b42318', display: 'block', marginBottom: '4px' }}>
              Error del parser Mermaid:
            </span>
            <pre style={{ margin: 0, fontSize: '0.75rem', color: 'var(--on-surface)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '180px', overflowY: 'auto' }}>
              {error}
            </pre>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`mermaid-diagram-viewer ${className}`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
      style={{
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        overflowX: 'auto',
        overflowY: 'auto',
        padding: '16px'
      }}
    />
  );
}
