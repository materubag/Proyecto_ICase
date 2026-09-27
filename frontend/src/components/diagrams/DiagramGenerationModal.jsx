import React, { useState, useEffect } from 'react';
import { diagramsApi } from '../../api/diagrams.api';

const DIAGRAM_METADATA = {
  USE_CASE: {
    label: 'Diagrama de Casos de Uso',
    icon: 'account_tree',
    description: 'Actores del sistema, casos de uso derivados de requisitos y relaciones <<include>> / <<extend>>.'
  },
  ER: {
    label: 'Diagrama Entidad-Relación',
    icon: 'table_chart',
    description: 'Entidades detectadas, claves primarias, atributos y cardinalidades de base de datos.'
  },
  CLASS: {
    label: 'Diagrama de Clases',
    icon: 'schema',
    description: 'Estructuras POO, atributos tipados, métodos y relaciones de herencia o asociación.'
  },
  NAVIGATION: {
    label: 'Árbol de Navegación',
    icon: 'fork_right',
    description: 'Jerarquía de pantallas, mapa del sitio y transiciones del usuario entre vistas.'
  },
  ARCHITECTURE: {
    label: 'Diagrama de Arquitectura',
    icon: 'layers',
    description: 'Arquitectura en capas (Clean Architecture), tecnologías frontend/backend y componentes.'
  }
};

export default function DiagramGenerationModal({ projectId, isOpen, onClose, onGenerated }) {
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState(null);
  const [selectedTypes, setSelectedTypes] = useState(new Set());
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [forceRegenerate, setForceRegenerate] = useState(false);

  useEffect(() => {
    if (isOpen && projectId) {
      loadAvailability();
    }
  }, [isOpen, projectId]);

  async function loadAvailability() {
    try {
      setLoading(true);
      setError(null);
      const data = await diagramsApi.getAvailability(projectId);
      setAvailability(data);

      // Pre-select all diagrams that can be generated (SUFFICIENT or PARTIAL)
      const initialSelected = new Set();
      Object.entries(data.diagrams || {}).forEach(([key, info]) => {
        if (info.canGenerate) {
          initialSelected.add(key);
        }
      });
      setSelectedTypes(initialSelected);
    } catch (err) {
      console.error('Error fetching diagram availability:', err);
      setError(err.message || 'No se pudo verificar la información disponible.');
    } finally {
      setLoading(false);
    }
  }

  function toggleType(type) {
    if (generating) return;
    const next = new Set(selectedTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    setSelectedTypes(next);
  }

  function selectOnlyAvailable() {
    if (!availability) return;
    const next = new Set();
    Object.entries(availability.diagrams).forEach(([key, info]) => {
      if (info.status === 'SUFFICIENT') {
        next.add(key);
      }
    });
    setSelectedTypes(next);
  }

  async function handleStartGeneration() {
    if (selectedTypes.size === 0) return;
    try {
      setGenerating(true);
      setError(null);
      setGenerationStep('Preparando contexto estructurado para los diagramas...');

      const typesList = Array.from(selectedTypes);
      const res = await diagramsApi.generateBatch(projectId, typesList, forceRegenerate);
      setResults(res);
      setGenerationStep('¡Generación completada con éxito!');

      if (onGenerated) {
        onGenerated(res);
      }
    } catch (err) {
      console.error('Error generating diagrams:', err);
      setError(err.message || 'Ocurrió un error al generar los diagramas.');
    } finally {
      setGenerating(false);
    }
  }

  if (!isOpen) return null;

  const hasInsufficientSelected = availability && Array.from(selectedTypes).some(
    type => availability.diagrams[type]?.status === 'INSUFFICIENT'
  );

  const totalAvailableCount = availability
    ? Object.values(availability.diagrams).filter(d => d.canGenerate).length
    : 0;

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(11, 23, 48, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '16px'
      }}
    >
      <div
        className="modal-card panel"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-default)',
          background: 'var(--surface-container-lowest)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-default)',
            background: 'var(--surface-container-low)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="ms" style={{ color: 'var(--primary)', fontSize: '24px' }}>
              auto_fix_high
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                Generación Inteligente de Diagramas Mermaid
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                Construye modelos visuales a partir de la información estructurada mediante Gemini
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={onClose}
            disabled={generating}
            aria-label="Cerrar modal"
          >
            <span className="ms ms-sm">close</span>
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <span className="ms spin" style={{ fontSize: '32px', color: 'var(--primary)' }}>
                autorenew
              </span>
              <p style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--secondary)' }}>
                Verificando completitud de información en el proyecto...
              </p>
            </div>
          ) : error && !availability ? (
            <div style={{ padding: '20px', background: 'rgba(180, 35, 24, 0.08)', borderRadius: '8px', color: '#b42318' }}>
              <strong>Error:</strong> {error}
            </div>
          ) : results ? (
            /* Results View */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#157347', marginBottom: '16px' }}>
                <span className="ms" style={{ fontSize: '28px' }}>check_circle</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Generación finalizada</h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--secondary)' }}>
                    Los diagramas solicitados fueron construidos y guardados como artefactos oficiales.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(results).map(([type, res]) => {
                  const meta = DIAGRAM_METADATA[type] || {};
                  return (
                    <div
                      key={type}
                      style={{
                        padding: '12px 14px',
                        background: 'var(--surface-container-low)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-default)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="ms ms-sm" style={{ color: 'var(--primary)' }}>{meta.icon || 'schema'}</span>
                        <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{meta.label || type}</span>
                      </div>
                      <span
                        className="badge"
                        style={{
                          background: res.success ? 'rgba(21, 115, 71, 0.12)' : 'rgba(180, 35, 24, 0.12)',
                          color: res.success ? '#157347' : '#b42318',
                          fontSize: '0.72rem'
                        }}
                      >
                        {res.success ? '✓ Generado' : `✕ ${res.error || 'Error'}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Diagram Selection List */
            <div>
              <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: 'var(--on-surface)' }}>
                Selecciona los diagramas que deseas generar. Se enviará únicamente el contexto estructurado relevante a Gemini:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
                {Object.entries(availability.diagrams).map(([type, info]) => {
                  const meta = DIAGRAM_METADATA[type] || {};
                  const isSelected = selectedTypes.has(type);
                  const isInsufficient = info.status === 'INSUFFICIENT';
                  const isPartial = info.status === 'PARTIAL';

                  return (
                    <div
                      key={type}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-default)',
                        background: isSelected ? 'rgba(41, 82, 217, 0.03)' : 'var(--surface-container-lowest)',
                        cursor: isInsufficient ? 'not-allowed' : 'pointer',
                        opacity: isInsufficient ? 0.65 : 1,
                        transition: 'all 0.15s ease'
                      }}
                      onClick={() => !isInsufficient && toggleType(type)}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0, flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isInsufficient || generating}
                            onChange={() => toggleType(type)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ marginTop: '3px' }}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                              <span className="ms ms-xs" style={{ color: 'var(--primary)' }}>{meta.icon}</span>
                              <strong style={{ fontSize: '0.875rem', color: 'var(--on-surface)' }}>{meta.label}</strong>

                              {/* Status Badge */}
                              {info.status === 'SUFFICIENT' ? (
                                <span className="badge badge-success" style={{ fontSize: '0.6875rem' }}>
                                  ✓ Información suficiente
                                </span>
                              ) : isPartial ? (
                                <span
                                  className="badge"
                                  style={{
                                    fontSize: '0.6875rem',
                                    background: 'rgba(217, 119, 6, 0.12)',
                                    color: '#b45309'
                                  }}
                                >
                                  ⚠ Información parcial
                                </span>
                              ) : (
                                <span
                                  className="badge"
                                  style={{
                                    fontSize: '0.6875rem',
                                    background: 'rgba(180, 35, 24, 0.12)',
                                    color: '#b42318'
                                  }}
                                >
                                  ✕ Información insuficiente
                                </span>
                              )}

                              {info.isGenerated && (
                                <span
                                  className="badge"
                                  style={{
                                    fontSize: '0.6875rem',
                                    background: 'var(--surface-container-high)',
                                    color: 'var(--secondary)'
                                  }}
                                >
                                  {info.isOutdated ? '● Desactualizado' : 'Ya generado'}
                                </span>
                              )}
                            </div>

                            <p style={{ margin: '0 0 4px', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                              {meta.description}
                            </p>

                            <div style={{ fontSize: '0.75rem', color: 'var(--on-surface)', fontWeight: 500 }}>
                              Datos disponibles: <span style={{ color: 'var(--primary)' }}>{info.summary}</span>
                            </div>

                            {/* Missing details if any */}
                            {info.missing && info.missing.length > 0 && (
                              <div style={{ marginTop: '6px', fontSize: '0.72rem', color: isInsufficient ? '#b42318' : '#b45309' }}>
                                <strong>{isInsufficient ? 'Falta información crítica:' : 'Advertencia:'}</strong> {info.missing.join(' · ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Force regenerate option */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--surface-container-low)', borderRadius: '6px', marginBottom: '14px' }}>
                <input
                  type="checkbox"
                  id="chk-force"
                  checked={forceRegenerate}
                  onChange={(e) => setForceRegenerate(e.target.checked)}
                  disabled={generating}
                />
                <label htmlFor="chk-force" style={{ fontSize: '0.78rem', color: 'var(--on-surface)', cursor: 'pointer' }}>
                  Regenerar y reemplazar diagramas ya existentes (si ya fueron generados antes)
                </label>
              </div>

              {/* Warning banner if insufficient items are selected */}
              {hasInsufficientSelected && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    background: 'rgba(180, 35, 24, 0.08)',
                    border: '1px solid rgba(180, 35, 24, 0.3)',
                    color: '#b42318',
                    fontSize: '0.78rem',
                    marginBottom: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <span>
                    <strong>Atención:</strong> Uno o más diagramas seleccionados tienen información insuficiente.
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={selectOnlyAvailable}
                    style={{ fontSize: '0.72rem', color: '#b42318', borderColor: '#b42318' }}
                  >
                    Seleccionar solo disponibles
                  </button>
                </div>
              )}

              {/* Generating progress state */}
              {generating && (
                <div
                  style={{
                    padding: '14px 18px',
                    borderRadius: '8px',
                    background: 'rgba(41, 82, 217, 0.06)',
                    border: '1px solid var(--primary)',
                    marginBottom: '14px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', marginBottom: '6px' }}>
                    <span className="ms spin" style={{ fontSize: '20px' }}>autorenew</span>
                    <strong style={{ fontSize: '0.85rem' }}>Generando con Gemini...</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
                    {generationStep}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 20px',
            borderTop: '1px solid var(--border-default)',
            background: 'var(--surface-container-low)'
          }}
        >
          <div>
            {!results && (
              <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
                {selectedTypes.size} de 5 diagramas seleccionados
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              disabled={generating}
            >
              {results ? 'Cerrar' : 'Cancelar'}
            </button>

            {!results && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleStartGeneration}
                disabled={generating || selectedTypes.size === 0 || hasInsufficientSelected}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {generating ? (
                  <>
                    <span className="ms ms-xs spin">autorenew</span>
                    <span>Generando...</span>
                  </>
                ) : (
                  <>
                    <span className="ms ms-xs">auto_fix_high</span>
                    <span>Generar seleccionados ({selectedTypes.size})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
