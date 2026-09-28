import React, { useState, useRef, useEffect } from 'react';
import MermaidDiagram from '../diagrams/MermaidDiagram';

/**
 * DiagramViewport
 * Reusable viewport container for Mermaid diagrams with zoom, pan, fit, scroll controls,
 * Diagram/Code toggle, regeneration confirmation, outdated banner, and empty/error states.
 */
export default function DiagramViewport({
  code,
  type = 'flowchart',
  title = '',
  minHeight = '480px',
  maxHeight = 'calc(100vh - 240px)',
  className = '',
  onValidated,
  onRegenerate,
  isGenerating = false,
  isOutdated = false,
  canGenerate = true,
  missingInfo = []
}) {
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState('diagram'); // 'diagram' | 'code'
  const [copied, setCopied] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [renderError, setRenderError] = useState(null);
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerateClick = () => {
    if (code && code.trim().length > 0) {
      setShowConfirmModal(true);
    } else if (onRegenerate) {
      onRegenerate(true);
    }
  };

  const handleConfirmRegenerate = () => {
    setShowConfirmModal(false);
    if (onRegenerate) {
      onRegenerate(true);
    }
  };

  const handleDiagramValidated = (isValid, err) => {
    if (!isValid && err) {
      setRenderError(err);
    } else {
      setRenderError(null);
    }
    if (onValidated) {
      onValidated(isValid, err);
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
          padding: '8px 14px',
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--surface-container-low)',
          flexShrink: 0,
          gap: '10px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="ms ms-xs" style={{ color: 'var(--primary)' }}>
            schema
          </span>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-surface)' }}>
            {title || 'Diagrama Mermaid'}
          </span>

          {code && (
            <span
              style={{
                fontSize: '0.6875rem',
                color: 'var(--secondary)',
                background: 'var(--surface-container)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-xs)',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {fitMode ? 'Ajustado' : `${Math.round(zoom * 100)}%`}
            </span>
          )}

          {/* Toggle [ Diagrama ] [ Código Mermaid ] */}
          {code && (
            <div className="view-toggle" style={{ transform: 'scale(0.9)', transformOrigin: 'left center' }}>
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'diagram' ? 'active' : ''}`}
                onClick={() => setViewMode('diagram')}
                style={{ padding: '2px 10px', fontSize: '0.75rem' }}
              >
                <span>Diagrama</span>
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${viewMode === 'code' ? 'active' : ''}`}
                onClick={() => setViewMode('code')}
                style={{ padding: '2px 10px', fontSize: '0.75rem' }}
              >
                <span>Código Mermaid</span>
              </button>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {onRegenerate && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleRegenerateClick}
              disabled={isGenerating || !canGenerate}
              style={{ fontSize: '0.75rem', height: '28px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title={code ? 'Regenerar diagrama con Gemini' : 'Generar diagrama con Gemini'}
            >
              <span className={`ms ms-xs ${isGenerating ? 'spin' : ''}`}>
                {isGenerating ? 'autorenew' : code ? 'sync' : 'auto_fix_high'}
              </span>
              <span>{isGenerating ? 'Generando...' : code ? 'Regenerar' : 'Generar diagrama'}</span>
            </button>
          )}

          {code && viewMode === 'diagram' && (
            <>
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
            </>
          )}

          {code && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              onClick={copyMermaidCode}
              title={copied ? '¡Copiado!' : 'Copiar código Mermaid'}
              aria-label="Copiar código"
            >
              <span className="ms ms-xs">{copied ? 'done' : 'content_copy'}</span>
            </button>
          )}

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

      {/* Main View Area */}
      {!code ? (
        /* Empty State / Loading State */
        <div
          style={{
            padding: '60px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: isFullscreen ? 'calc(100vh - 60px)' : minHeight
          }}
        >
          {isGenerating ? (
            /* Loading state — first generation */
            <>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  border: '3px solid var(--border-default)',
                  borderTopColor: 'var(--primary)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  marginBottom: '16px'
                }}
              />
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: 'var(--on-surface)' }}>
                Generando diagrama con Gemini…
              </h4>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--secondary)', maxWidth: '400px' }}>
                Esto puede tardar unos segundos. El diagrama aparecerá aquí cuando esté listo.
              </p>
            </>
          ) : (
            /* Empty state */
            <>
              <span className="ms" style={{ fontSize: '48px', color: 'var(--outline)', marginBottom: '12px' }}>
                schema
              </span>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: 'var(--on-surface)' }}>
                Este diagrama todavía no ha sido generado
              </h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.8125rem', color: 'var(--secondary)', maxWidth: '440px' }}>
                {canGenerate
                  ? 'Puedes solicitar su generación inteligente con Gemini basada en el análisis documental del proyecto.'
                  : 'La información del proyecto es insuficiente para construir este diagrama de forma fiable.'}
              </p>

              {!canGenerate && missingInfo && missingInfo.length > 0 && (
                <div
                  style={{
                    marginBottom: '16px',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    background: 'rgba(180, 35, 24, 0.08)',
                    color: '#b42318',
                    fontSize: '0.78rem',
                    maxWidth: '460px',
                    textAlign: 'left'
                  }}
                >
                  <strong>Falta información:</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {missingInfo.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {onRegenerate && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleRegenerateClick}
                  disabled={isGenerating || !canGenerate}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span className="ms ms-xs">auto_fix_high</span>
                  <span>Generar diagrama</span>
                </button>
              )}
            </>
          )}
        </div>
      ) : viewMode === 'code' ? (
        /* Mermaid Code Viewer */
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            minHeight: isFullscreen ? '0' : minHeight,
            maxHeight: isFullscreen ? 'none' : maxHeight,
            background: 'var(--surface-container-lowest)',
            padding: '20px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--secondary)', textTransform: 'uppercase' }}>
              Código Mermaid Generado
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={copyMermaidCode}
              style={{ fontSize: '0.72rem' }}
            >
              <span className="ms ms-xs">{copied ? 'done' : 'content_copy'}</span>
              <span style={{ marginLeft: '4px' }}>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              padding: '16px',
              borderRadius: '6px',
              background: 'var(--surface-container-low)',
              border: '1px solid var(--border-default)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8125rem',
              lineHeight: 1.5,
              color: 'var(--on-surface)',
              overflowX: 'auto',
              whiteSpace: 'pre'
            }}
          >
            {code}
          </pre>
        </div>
      ) : (
        /* Diagram Render View */
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
          {/* Loading overlay while regenerating */}
          {isGenerating && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 20,
                background: 'rgba(250, 252, 255, 0.82)',
                backdropFilter: 'blur(3px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '14px',
                pointerEvents: 'all'
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  border: '3px solid var(--border-default)',
                  borderTopColor: 'var(--primary)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}
              />
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                  Generando diagrama con Gemini
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--secondary)' }}>
                  Esto puede tardar unos segundos…
                </p>
              </div>
            </div>
          )}

          {renderError && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(180, 35, 24, 0.08)',
                border: '1px solid rgba(180, 35, 24, 0.3)',
                color: '#b42318',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <div>
                <strong>⚠ No se pudo renderizar el diagrama:</strong> El código Mermaid contiene un error sintáctico.
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setViewMode('code')}
                  style={{ fontSize: '0.72rem', color: '#b42318', borderColor: '#b42318' }}
                >
                  Ver código
                </button>
                {onRegenerate && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleRegenerateClick}
                    disabled={isGenerating}
                    style={{ fontSize: '0.72rem' }}
                  >
                    Reintentar generación
                  </button>
                )}
              </div>
            </div>
          )}

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
              onValidated={handleDiagramValidated}
            />
          </div>
        </div>
      )}

      {/* Regeneration Confirmation Modal */}
      {showConfirmModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(11, 23, 48, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1060,
            padding: '16px'
          }}
        >
          <div
            className="modal-card panel"
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '20px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-container-lowest)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', marginBottom: '10px' }}>
              <span className="ms" style={{ fontSize: '24px' }}>sync</span>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>¿Regenerar diagrama?</h4>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: 'var(--on-surface)', lineHeight: 1.45 }}>
              Este diagrama ya existe. Regenerarlo construirá una nueva versión con Gemini reemplazando la versión actual.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleConfirmRegenerate}
              >
                Regenerar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
