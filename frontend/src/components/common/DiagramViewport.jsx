import React, { useState, useRef, useEffect } from 'react';
import MermaidDiagram from '../diagrams/MermaidDiagram';

/**
 * DiagramViewport
 * Reusable viewport container for Mermaid diagrams with zoom, pan, fit, and scroll controls.
 * Ensures large diagrams remain legible at 100% browser zoom without forcing global page zoom.
 */
export default function DiagramViewport({
  code,
  type = 'flowchart',
  title = '',
  minHeight = '480px',
  maxHeight = 'calc(100vh - 240px)',
  className = '',
  onValidated
}) {
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewportRef = useRef(null);

  const handleZoomIn = () => {
    setFitMode(false);
    setZoom((prev) => Math.min(Number((prev + 0.15).toFixed(2)), 2.5));
  };

  const handleZoomOut = () => {
    setFitMode(false);
    setZoom((prev) => Math.max(Number((prev - 0.15).toFixed(2)), 0.4));
  };

  const handleResetZoom = () => {
    setFitMode(false);
    setZoom(1);
  };

  const handleToggleFit = () => {
    setFitMode((prev) => !prev);
    if (!fitMode) {
      setZoom(1);
    }
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  // Keyboard escape to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const copyMermaidCode = () => {
    if (code && navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
  };

  return (
    <div
      className={`diagram-viewport-wrapper ${isFullscreen ? 'diagram-fullscreen' : ''} ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: isFullscreen ? 0 : 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        background: 'var(--surface-container-lowest)',
        boxShadow: isFullscreen ? 'none' : 'var(--shadow-xs)',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : 'auto',
        zIndex: isFullscreen ? 9999 : 'auto',
        overflow: 'hidden'
      }}
    >
      {/* Viewport Toolbar */}
      <div
        className="diagram-viewport-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--surface-container-low)',
          flexShrink: 0,
          gap: '8px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="ms ms-xs" style={{ color: 'var(--primary)' }}>
            schema
          </span>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-surface)' }}>
            {title || 'Diagrama'}
          </span>
          <span
            style={{
              fontSize: '0.6875rem',
              color: 'var(--secondary)',
              background: 'var(--surface-container)',
              padding: '1px 6px',
              borderRadius: 'var(--radius-xs)',
              fontFamily: 'var(--font-mono)'
            }}
          >
            {fitMode ? 'Ajustado' : `${Math.round(zoom * 100)}%`}
          </span>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={handleZoomOut}
            disabled={zoom <= 0.4}
            title="Reducir zoom (-)"
            aria-label="Reducir zoom"
          >
            <span className="ms ms-xs">zoom_out</span>
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleResetZoom}
            style={{ fontSize: '0.75rem', padding: '0 6px', height: '26px' }}
            title="Restablecer tamaño real (100%)"
          >
            100%
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={handleZoomIn}
            disabled={zoom >= 2.5}
            title="Aumentar zoom (+)"
            aria-label="Aumentar zoom"
          >
            <span className="ms ms-xs">zoom_in</span>
          </button>

          <div style={{ width: '1px', height: '16px', background: 'var(--border-default)', margin: '0 2px' }} />

          <button
            type="button"
            className={`btn btn-sm ${fitMode ? 'btn-primary' : 'btn-ghost'}`}
            onClick={handleToggleFit}
            style={{ fontSize: '0.75rem', padding: '0 8px', height: '26px' }}
            title="Ajustar al ancho disponible"
          >
            <span className="ms ms-xs">fit_screen</span>
            <span style={{ marginLeft: '4px' }}>Ajustar</span>
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={copyMermaidCode}
            title="Copiar código Mermaid"
            aria-label="Copiar código"
          >
            <span className="ms ms-xs">content_copy</span>
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            aria-label="Pantalla completa"
          >
            <span className="ms ms-xs">{isFullscreen ? 'close_fullscreen' : 'open_in_full'}</span>
          </button>
        </div>
      </div>

      {/* Scrollable Diagram Canvas */}
      <div
        ref={viewportRef}
        className="diagram-viewport-canvas"
        style={{
          flex: 1,
          overflow: 'auto',
          minHeight: isFullscreen ? '0' : minHeight,
          maxHeight: isFullscreen ? 'none' : maxHeight,
          background: 'radial-gradient(var(--border-default) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          backgroundColor: '#fafcff',
          padding: '24px',
          position: 'relative',
          display: 'block'
        }}
      >
        <div
          className={`diagram-viewport-content ${fitMode ? 'fit-mode' : ''}`}
          style={{
            transform: fitMode ? 'none' : `scale(${zoom})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
            width: fitMode ? '100%' : 'fit-content',
            minWidth: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start'
          }}
        >
          <MermaidDiagram
            code={code}
            type={type}
            onValidated={onValidated}
          />
        </div>
      </div>
    </div>
  );
}
