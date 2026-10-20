import React, { useState, useRef, useEffect } from 'react';
import MermaidDiagram from '../diagrams/MermaidDiagram';
import ChenDiagram from '../diagrams/ChenDiagram';

/**
 * DiagramViewport
 *
 * Contenedor reutilizable para diagramas Mermaid con:
 * - Zoom inicial configurable (40 % por defecto).
 * - Zoom manual para acercar y alejar.
 * - Ajuste al espacio disponible.
 * - Pantalla completa dentro de la aplicación.
 * - Vista del diagrama y del código Mermaid.
 * - Copia del código.
 * - Confirmación antes de regenerar.
 * - Indicadores de generación y errores de renderizado.
 */

const clampZoom = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 1;
  }

  return Math.min(2.5, Math.max(0.4, numericValue));
};

export default function DiagramViewport({
  code,
  type = 'flowchart',
  title = '',
  minHeight = '480px',
  maxHeight = 'calc(100vh - 240px)',
  className = '',
  initialZoom = 1,
  onValidated,
  onRegenerate,
  isGenerating = false,
  isOutdated = false,
  canGenerate = true,
  missingInfo = []
}) {
  // Estados del componente
  const [zoom, setZoom] = useState(() => clampZoom(initialZoom));
  const [fitMode, setFitMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState('diagram');
  const [copied, setCopied] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [renderError, setRenderError] = useState(null);

  // Referencias
  const viewportRef = useRef(null);
  const copyTimeoutRef = useRef(null);

  // Valores derivados
  const hasCode =
    typeof code === 'string' && code.trim().length > 0;

  // Restablecer el visor cuando cambia el código o el zoom inicial.
  useEffect(() => {
    setFitMode(false);
    setZoom(clampZoom(initialZoom));
    setRenderError(null);
    setCopied(false);

    if (viewportRef.current) {
      viewportRef.current.scrollTop = 0;
      viewportRef.current.scrollLeft = 0;
    }

    if (copyTimeoutRef.current !== null) {
      window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }
  }, [code, initialZoom]);

  // Limpiar el temporizador al desmontar el componente.
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // Mantener el scroll del documento bloqueado en pantalla completa.
  useEffect(() => {
    if (!isFullscreen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  // Zoom de acercamiento.
  const handleZoomIn = () => {
    setFitMode(false);
    setZoom((prev) => clampZoom(prev + 0.15));
  };

  // Zoom de alejamiento.
  const handleZoomOut = () => {
    setFitMode(false);
    setZoom((prev) => clampZoom(prev - 0.15));
  };

  // Restablecer el zoom inicial.
  const handleResetZoom = () => {
    setFitMode(false);
    setZoom(clampZoom(initialZoom));
  };

  // Activar o desactivar el modo de ajuste.
  const handleToggleFit = () => {
    setFitMode((prev) => !prev);
  };

  // Entrar o salir de pantalla completa.
  const handleToggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  // Gestionar Escape para cerrar el modal o salir de pantalla completa.
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (showConfirmModal) {
        setShowConfirmModal(false);
        return;
      }

      if (isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showConfirmModal, isFullscreen]);

  // Copiar el código Mermaid.
  const copyMermaidCode = async () => {
    if (!hasCode) {
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error(
          'El portapapeles no está disponible en este navegador.'
        );
      }

      await navigator.clipboard.writeText(code);

      setCopied(true);

      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }

      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimeoutRef.current = null;
      }, 2000);
    } catch (error) {
      console.error(
        'No se pudo copiar el código Mermaid:',
        error
      );
    }
  };

  // Solicitar confirmación antes de regenerar.
  const handleRegenerateClick = () => {
    if (isGenerating || !canGenerate || !onRegenerate) {
      return;
    }

    if (hasCode) {
      setShowConfirmModal(true);
      return;
    }

    setRenderError(null);
    onRegenerate(true);
  };

  // Confirmar la regeneración.
  const handleConfirmRegenerate = () => {
    if (isGenerating || !canGenerate || !onRegenerate) {
      return;
    }

    setShowConfirmModal(false);
    setRenderError(null);

    onRegenerate(true);
  };

  // Recibir el resultado de validación del diagrama.
  const handleDiagramValidated = (isValid, error) => {
    if (isValid) {
      setRenderError(null);
    } else {
      setRenderError(
        error || 'Error desconocido al renderizar el diagrama.'
      );
    }

    if (typeof onValidated === 'function') {
      onValidated(isValid, error);
    }
  };

  return (
    <div
      className={`diagram-viewport-wrapper ${
        isFullscreen ? 'diagram-fullscreen' : ''
      } ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: isFullscreen
          ? 0
          : 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        background: 'var(--surface-container-lowest)',
        boxShadow: isFullscreen
          ? 'none'
          : 'var(--shadow-xs)',
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
      {/* Barra de herramientas */}
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
        {/* Título y selector de vista */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap'
          }}
        >
          <span
            className="ms ms-xs"
            style={{ color: 'var(--primary)' }}
            aria-hidden="true"
          >
            schema
          </span>

          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--on-surface)'
            }}
          >
            {title || 'Diagrama Mermaid'}
          </span>

          {isOutdated && hasCode && (
            <span
              role="status"
              style={{
                fontSize: '0.7rem',
                color: '#92400e',
                background: 'rgba(245, 158, 11, 0.12)',
                borderRadius: '4px',
                padding: '3px 7px'
              }}
            >
              Diagrama desactualizado
            </span>
          )}

          {hasCode && (
            <div
              className="view-toggle"
              style={{
                transform: 'scale(0.9)',
                transformOrigin: 'left center'
              }}
            >
              <button
                type="button"
                className={`view-toggle-btn ${
                  viewMode === 'diagram' ? 'active' : ''
                }`}
                onClick={() => setViewMode('diagram')}
                aria-pressed={viewMode === 'diagram'}
                style={{
                  padding: '2px 10px',
                  fontSize: '0.75rem'
                }}
              >
                Diagrama
              </button>

              <button
                type="button"
                className={`view-toggle-btn ${
                  viewMode === 'code' ? 'active' : ''
                }`}
                onClick={() => setViewMode('code')}
                aria-pressed={viewMode === 'code'}
                style={{
                  padding: '2px 10px',
                  fontSize: '0.75rem'
                }}
              >
                Código Mermaid
              </button>
            </div>
          )}
        </div>

        {/* Controles */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap'
          }}
        >
          {onRegenerate && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleRegenerateClick}
              disabled={isGenerating || !canGenerate}
              style={{
                fontSize: '0.75rem',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title={
                hasCode
                  ? 'Regenerar diagrama'
                  : 'Generar diagrama'
              }
            >
              <span
                className={`ms ms-xs ${
                  isGenerating ? 'spin' : ''
                }`}
                aria-hidden="true"
              >
                {isGenerating
                  ? 'autorenew'
                  : hasCode
                    ? 'sync'
                    : 'auto_fix_high'}
              </span>

              <span>
                {isGenerating
                  ? 'Generando...'
                  : hasCode
                    ? 'Regenerar'
                    : 'Generar diagrama'}
              </span>
            </button>
          )}

          {hasCode && viewMode === 'diagram' && (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                onClick={handleZoomOut}
                disabled={zoom <= 0.4 || fitMode}
                title="Reducir zoom"
                aria-label="Reducir zoom"
              >
                <span className="ms ms-xs" aria-hidden="true">
                  zoom_out
                </span>
              </button>

              <span
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--secondary)',
                  background: 'var(--surface-container)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-xs)',
                  fontFamily: 'var(--font-mono)'
                }}
                aria-live="polite"
              >
                {fitMode
                  ? 'Ajustado'
                  : `${Math.round(zoom * 100)}%`}
              </span>

              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                onClick={handleZoomIn}
                disabled={zoom >= 2.5 || fitMode}
                title="Aumentar zoom"
                aria-label="Aumentar zoom"
              >
                <span className="ms ms-xs" aria-hidden="true">
                  zoom_in
                </span>
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResetZoom}
                disabled={
                  !fitMode &&
                  Math.abs(zoom - clampZoom(initialZoom)) < 0.001
                }
                title="Restablecer zoom"
                style={{
                  fontSize: '0.7rem',
                  padding: '0 6px',
                  height: '26px'
                }}
              >
                Restablecer
              </button>

              <div
                style={{
                  width: '1px',
                  height: '16px',
                  background: 'var(--border-default)',
                  margin: '0 2px'
                }}
              />

            </>
          )}

          {hasCode && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              onClick={copyMermaidCode}
              title={
                copied
                  ? 'Copiado'
                  : 'Copiar código Mermaid'
              }
              aria-label="Copiar código Mermaid"
            >
              <span className="ms ms-xs" aria-hidden="true">
                {copied ? 'done' : 'content_copy'}
              </span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={handleToggleFullscreen}
            title={
              isFullscreen
                ? 'Salir de pantalla completa'
                : 'Pantalla completa'
            }
            aria-label={
              isFullscreen
                ? 'Salir de pantalla completa'
                : 'Pantalla completa'
            }
            aria-pressed={isFullscreen}
          >
            <span className="ms ms-xs" aria-hidden="true">
              {isFullscreen
                ? 'close_fullscreen'
                : 'open_in_full'}
            </span>
          </button>
        </div>
      </div>

      {/* Estado vacío o generación inicial */}
      {!hasCode ? (
        <div
          style={{
            padding: '60px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: isFullscreen
              ? 'calc(100vh - 60px)'
              : minHeight
          }}
        >
          {isGenerating ? (
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
                role="status"
                aria-label="Generando"
              />

              <h4
                style={{
                  margin: '0 0 6px',
                  fontSize: '1rem',
                  color: 'var(--on-surface)'
                }}
              >
                Generando diagrama...
              </h4>

              <p
                style={{
                  margin: 0,
                  fontSize: '0.8125rem',
                  color: 'var(--secondary)',
                  maxWidth: '400px'
                }}
              >
                El diagrama aparecerá aquí cuando termine
                la generación.
              </p>
            </>
          ) : (
            <>
              <span
                className="ms"
                aria-hidden="true"
                style={{
                  fontSize: '48px',
                  color: 'var(--outline)',
                  marginBottom: '12px'
                }}
              >
                schema
              </span>

              <h4
                style={{
                  margin: '0 0 6px',
                  fontSize: '1rem',
                  color: 'var(--on-surface)'
                }}
              >
                Este diagrama todavía no ha sido generado
              </h4>

              <p
                style={{
                  margin: '0 0 16px',
                  fontSize: '0.8125rem',
                  color: 'var(--secondary)',
                  maxWidth: '440px'
                }}
              >
                {canGenerate
                  ? 'Puedes generar el diagrama a partir de la información del proyecto.'
                  : 'La información disponible no es suficiente para generar este diagrama.'}
              </p>

              {!canGenerate && missingInfo.length > 0 && (
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

                  <ul
                    style={{
                      margin: '4px 0 0 16px',
                      padding: 0
                    }}
                  >
                    {missingInfo.map((item, index) => (
                      <li key={`${item}-${index}`}>
                        {item}
                      </li>
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
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span className="ms ms-xs" aria-hidden="true">
                    auto_fix_high
                  </span>
                  <span>Generar diagrama</span>
                </button>
              )}
            </>
          )}
        </div>
      ) : viewMode === 'code' ? (
        /* Visor del código Mermaid */
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            minHeight: isFullscreen ? 0 : minHeight,
            maxHeight: isFullscreen ? 'none' : maxHeight,
            background: 'var(--surface-container-lowest)',
            padding: '20px'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--secondary)',
                textTransform: 'uppercase'
              }}
            >
              Código Mermaid
            </span>

            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={copyMermaidCode}
              style={{ fontSize: '0.72rem' }}
            >
              <span className="ms ms-xs" aria-hidden="true">
                {copied ? 'done' : 'content_copy'}
              </span>

              <span style={{ marginLeft: '4px' }}>
                {copied ? 'Copiado' : 'Copiar'}
              </span>
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
        /* Área del diagrama */
        <div
          ref={viewportRef}
          className="diagram-viewport-canvas"
          style={{
            flex: 1,
            overflow: 'auto',
            minHeight: isFullscreen ? 0 : minHeight,
            maxHeight: isFullscreen ? 'none' : maxHeight,
            background:
              'radial-gradient(var(--border-default) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            backgroundColor: '#fafcff',
            padding: '24px',
            position: 'relative',
            display: 'block'
          }}
        >
          {/* Indicador de regeneración */}
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
              role="status"
              aria-live="polite"
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
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    color: 'var(--on-surface)'
                  }}
                >
                  Generando diagrama
                </p>

                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '0.78rem',
                    color: 'var(--secondary)'
                  }}
                >
                  Esto puede tardar unos segundos...
                </p>
              </div>
            </div>
          )}

          {/* Error de renderizado */}
          {renderError && (
            <div
              role="alert"
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
                gap: '12px',
                flexWrap: 'wrap'
              }}
            >
              <div>
                <strong>
                  No se pudo renderizar el diagrama.
                </strong>{' '}
                Comprueba la sintaxis del código Mermaid.
                {typeof renderError === 'string' && (
                  <p
                    style={{
                      margin: '6px 0 0',
                      overflowWrap: 'anywhere'
                    }}
                  >
                    {renderError}
                  </p>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap'
                }}
              >
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setViewMode('code')}
                  style={{
                    fontSize: '0.72rem',
                    color: '#b42318',
                    borderColor: '#b42318'
                  }}
                >
                  Ver código
                </button>

                {onRegenerate && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleRegenerateClick}
                    disabled={isGenerating || !canGenerate}
                    style={{ fontSize: '0.72rem' }}
                  >
                    Regenerar
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Diagrama escalado */}
          <div
            className={`diagram-viewport-content ${
              fitMode ? 'fit-mode' : ''
            }`}
            style={{
              transform: fitMode ? 'none' : `scale(${zoom})`,
              transformOrigin: 'top left',
              transition: 'transform 0.15s ease-out',
              width: fitMode
                ? '100%'
                : type === 'erDiagram'
                  ? 'max-content'
                  : 'fit-content',
              minWidth: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start'
            }}
          >
            {type === 'erDiagram' ? (
              <ChenDiagram
                code={code}
                fit={fitMode}
                onValidated={handleDiagramValidated}
              />
            ) : (
              <MermaidDiagram
                code={code}
                type={type}
                onValidated={handleDiagramValidated}
              />
            )}
          </div>
        </div>
      )}

      {/* Modal de confirmación */}
      {showConfirmModal && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !isGenerating
            ) {
              setShowConfirmModal(false);
            }
          }}
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
            zIndex: 10000,
            padding: '16px'
          }}
        >
          <div
            className="modal-card panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="regenerate-dialog-title"
            aria-describedby="regenerate-dialog-description"
            onMouseDown={(event) => event.stopPropagation()}
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: 'var(--primary)',
                marginBottom: '10px'
              }}
            >
              <span
                className="ms"
                aria-hidden="true"
                style={{ fontSize: '24px' }}
              >
                sync
              </span>

              <h4
                id="regenerate-dialog-title"
                style={{
                  margin: 0,
                  fontSize: '0.95rem',
                  fontWeight: 600
                }}
              >
                ¿Regenerar diagrama?
              </h4>
            </div>

            <p
              id="regenerate-dialog-description"
              style={{
                margin: '0 0 16px',
                fontSize: '0.8125rem',
                color: 'var(--on-surface)',
                lineHeight: 1.45
              }}
            >
              Se solicitará una nueva versión del diagrama.
              El resultado dependerá de la información
              disponible en el proyecto y de la respuesta
              del servidor.
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px'
              }}
            >
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowConfirmModal(false)}
                disabled={isGenerating}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleConfirmRegenerate}
                disabled={isGenerating || !canGenerate}
              >
                {isGenerating
                  ? 'Generando...'
                  : 'Regenerar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}