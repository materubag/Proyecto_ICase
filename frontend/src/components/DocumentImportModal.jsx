import React, { useState, useRef } from 'react';
import {
  FileUp,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  Users,
  Database,
  Layout,
  Cpu,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight
} from 'lucide-react';
import { documentsApi } from '../api/documents.api';

export default function DocumentImportModal({
  isOpen,
  onClose,
  projectId,
  onImportSuccess
}) {
  const [file, setFile] = useState(null);
  // Estados requeridos: 'idle' | 'uploading' | 'extracting' | 'analyzing' | 'validating' | 'preview' | 'success' | 'error'
  const [status, setStatus] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  // Datos de extracción y análisis
  const [extractionData, setExtractionData] = useState(null);
  const [previewData, setPreviewData] = useState(null);

  // Vistas previas expandibles
  const [showReqsList, setShowReqsList] = useState(false);
  const [showActorsList, setShowActorsList] = useState(false);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  function handleFileChange(e) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Por favor seleccione únicamente un archivo con formato PDF (.pdf).');
      setStatus('error');
      return;
    }

    setFile(selected);
    setStatus('idle');
    setErrorMessage(null);
    setExtractionData(null);
    setPreviewData(null);
  }

  function handleDrop(e) {
    e.preventDefault();
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped && dropped.name.toLowerCase().endsWith('.pdf')) {
      setFile(dropped);
      setStatus('idle');
      setErrorMessage(null);
    } else {
      setErrorMessage('El archivo arrastrado debe ser un PDF válido.');
      setStatus('error');
    }
  }

  async function handleStartProcessing() {
    if (!file) return;

    try {
      // 1. Estado: uploading & extracting
      setStatus('uploading');
      setStatusMessage('Subiendo archivo PDF...');
      setErrorMessage(null);

      // Paso 1: Extracción determinística sin IA
      setStatus('extracting');
      setStatusMessage('Extrayendo texto plano, limpiando ruido y detectando secciones con reglas...');
      const extractRes = await documentsApi.extract(file);
      setExtractionData(extractRes);

      // Paso 2: Análisis inteligente con Ollama / Mock
      setStatus('analyzing');
      setStatusMessage('Analizando requisitos, actores y modelo con motor de IA (Ollama / Mock)...');
      const analyzeRes = await documentsApi.analyze(extractRes);

      // Paso 3: Validación de esquema y referencias
      setStatus('validating');
      setStatusMessage('Validando coherencia de datos, unicidad de IDs y referencias cruzadas...');
      await new Promise(r => setTimeout(r, 400)); // Pequeña transición fluida

      // Paso 4: Vista previa para confirmación del usuario
      setPreviewData(analyzeRes);
      setStatus('preview');
    } catch (err) {
      console.error('[DocumentImportModal] Error al procesar:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Error inesperado durante el procesamiento del documento.');
    }
  }

  async function handleConfirmImport() {
    if (!previewData || !projectId) return;

    try {
      setStatus('validating');
      setStatusMessage('Guardando información estructurada en el proyecto...');

      await documentsApi.importAnalysis(projectId, previewData);

      setStatus('success');
      setStatusMessage('¡Documento importado con éxito al proyecto!');

      if (onImportSuccess) {
        await onImportSuccess();
      }

      setTimeout(() => {
        handleResetAndClose();
      }, 1400);
    } catch (err) {
      console.error('[DocumentImportModal] Error al importar:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Error al persistir el análisis en la base de datos.');
    }
  }

  function handleResetAndClose() {
    setFile(null);
    setStatus('idle');
    setErrorMessage(null);
    setExtractionData(null);
    setPreviewData(null);
    onClose();
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={handleResetAndClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface, #ffffff)',
          color: 'var(--text-main, #1e293b)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-subtle, #e2e8f0)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-app, #f8fafc)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary, #2563eb)'
              }}
            >
              <FileUp size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>
                Importar documento PDF
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', margin: 0 }}>
                Extracción determinística de texto, detección de secciones y análisis estructurado con IA
              </p>
            </div>
          </div>

          <button
            onClick={handleResetAndClose}
            disabled={status === 'uploading' || status === 'extracting' || status === 'analyzing' || status === 'validating'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #64748b)',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* Error Banner */}
          {status === 'error' && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--danger, #dc2626)',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                fontSize: '0.875rem'
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success Banner */}
          {status === 'success' && (
            <div
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: 'var(--success, #16a34a)',
                padding: '1.5rem',
                borderRadius: '8px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem'
              }}
            >
              <CheckCircle size={42} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>
                {statusMessage}
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
                Se han actualizado los requisitos, actores, modelo de datos, prototipo y arquitectura.
              </p>
            </div>
          )}

          {/* Estado: IDLE (Selección de archivo) */}
          {status === 'idle' && (
            <div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-subtle, #cbd5e1)',
                  borderRadius: '10px',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: 'var(--bg-app, #f8fafc)',
                  transition: 'border-color 0.2s ease'
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,application/pdf"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem',
                    color: 'var(--primary, #2563eb)'
                  }}
                >
                  <FileUp size={24} />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  {file ? file.name : 'Arrastre su archivo PDF aquí o haga clic para seleccionarlo'}
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-muted, #64748b)', margin: 0 }}>
                  {file
                    ? `Tamaño: ${formatFileSize(file.size)} | Listo para procesar`
                    : 'Documentos de proyecto, propuestas técnicas o especificaciones (Máximo 10 MB)'}
                </p>
              </div>

              {/* Documento de referencia sugerido */}
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '0.85rem 1rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '8px',
                  fontSize: '0.825rem',
                  color: 'var(--text-muted, #475569)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <FileText size={16} color="var(--primary, #2563eb)" />
                <span>
                  <strong>Documento de referencia para pruebas:</strong> AUTRON_Propuesta_Overleaf.pdf (Taller automotriz).
                </span>
              </div>
            </div>
          )}

          {/* Estados de Carga: Uploading, Extracting, Analyzing, Validating */}
          {(status === 'uploading' || status === 'extracting' || status === 'analyzing' || status === 'validating') && (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
              <Loader2
                size={40}
                className="spin"
                style={{ margin: '0 auto 1.25rem', color: 'var(--primary, #2563eb)' }}
              />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                {status === 'uploading' && 'Cargando documento...'}
                {status === 'extracting' && 'Extrayendo texto y detectando patrones...'}
                {status === 'analyzing' && 'Estructurando arquitectura y modelo con IA...'}
                {status === 'validating' && 'Verificando contrato y referencias...'}
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted, #64748b)', maxWidth: '480px', margin: '0 auto' }}>
                {statusMessage}
              </p>

              {/* Pasos en progreso */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  marginTop: '1.75rem',
                  fontSize: '0.75rem',
                  flexWrap: 'wrap'
                }}
              >
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>1. Extracción</span>
                <span>→</span>
                <span style={{ color: status === 'analyzing' || status === 'validating' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                  2. Reglas
                </span>
                <span>→</span>
                <span style={{ color: status === 'analyzing' || status === 'validating' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                  3. IA / Ollama
                </span>
                <span>→</span>
                <span style={{ color: status === 'validating' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                  4. Validación
                </span>
              </div>
            </div>
          )}

          {/* Estado: PREVIEW (Vista Previa Estructurada) */}
          {status === 'preview' && previewData && (
            <div>
              {/* Resumen del Documento */}
              <div
                style={{
                  backgroundColor: 'var(--bg-app, #f8fafc)',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  borderRadius: '8px',
                  padding: '1rem 1.25rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}
              >
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
                    Documento Procesado
                  </span>
                  <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {previewData.documentAnalysis?.sourceFile || file?.name}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                    {previewData.documentAnalysis?.pageCount || 1} páginas
                  </span>
                  <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                    Texto extraíble válido
                  </span>
                </div>
              </div>

              {/* Métricas de Información Detectada */}
              <div style={{ marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Información Estructurada Detectada
                </span>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.75rem',
                    marginTop: '0.5rem'
                  }}
                >
                  <div className="card" style={{ padding: '0.85rem', textAlign: 'center' }}>
                    <FileText size={18} color="var(--primary)" style={{ margin: '0 auto 0.25rem' }} />
                    <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>
                      {previewData.requirements?.length || 0}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Requisitos ({previewData.documentAnalysis?.ruleRequirementsCount || 0} por regla)
                    </div>
                  </div>

                  <div className="card" style={{ padding: '0.85rem', textAlign: 'center' }}>
                    <Users size={18} color="var(--primary)" style={{ margin: '0 auto 0.25rem' }} />
                    <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>
                      {previewData.actors?.length || 0}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Perfiles / Actores
                    </div>
                  </div>

                  <div className="card" style={{ padding: '0.85rem', textAlign: 'center' }}>
                    <Database size={18} color="var(--primary)" style={{ margin: '0 auto 0.25rem' }} />
                    <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>
                      {previewData.entities?.length || 0}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Entidades E/R
                    </div>
                  </div>

                  <div className="card" style={{ padding: '0.85rem', textAlign: 'center' }}>
                    <Layout size={18} color="var(--primary)" style={{ margin: '0 auto 0.25rem' }} />
                    <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>
                      {previewData.screens?.length || 0}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Pantallas
                    </div>
                  </div>

                  <div className="card" style={{ padding: '0.85rem', textAlign: 'center' }}>
                    <Cpu size={18} color="var(--primary)" style={{ margin: '0 auto 0.25rem' }} />
                    <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>
                      1
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Arquitectura
                    </div>
                  </div>
                </div>
              </div>

              {/* Secciones Detectadas en el Documento */}
              {previewData.documentAnalysis?.detectedSections?.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Secciones Identificadas en el Documento
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.4rem',
                      marginTop: '0.5rem',
                      maxHeight: '90px',
                      overflowY: 'auto'
                    }}
                  >
                    {previewData.documentAnalysis.detectedSections.map((sec, idx) => (
                      <span
                        key={idx}
                        style={{
                          backgroundColor: 'var(--bg-app, #f1f5f9)',
                          border: '1px solid var(--border-subtle, #cbd5e1)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          color: 'var(--text-main, #334155)'
                        }}
                      >
                        {sec}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Desplegable de Requisitos Detectados */}
              <div
                style={{
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  borderRadius: '8px',
                  marginBottom: '0.75rem',
                  overflow: 'hidden'
                }}
              >
                <div
                  onClick={() => setShowReqsList(!showReqsList)}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--bg-app, #f8fafc)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.875rem',
                    fontWeight: 600
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={16} color="var(--primary)" />
                    <span>Ver Requisitos Detectados ({previewData.requirements?.length || 0})</span>
                  </div>
                  {showReqsList ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {showReqsList && (
                  <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '0.5rem' }}>
                    {previewData.requirements?.map((req, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderBottom: i < previewData.requirements.length - 1 ? '1px solid var(--border-subtle, #f1f5f9)' : 'none',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.75rem'
                        }}
                      >
                        <span
                          className="badge"
                          style={{
                            backgroundColor: req.source === 'rule' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: req.source === 'rule' ? '#15803d' : '#1d4ed8',
                            fontSize: '0.7rem',
                            fontWeight: 700
                          }}
                        >
                          {req.code}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>{req.name}</div>
                          {req.description && req.description !== req.name && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {req.description}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {req.source === 'rule' ? 'Regla' : 'Ollama'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Desplegable de Actores / Perfiles */}
              <div
                style={{
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  overflow: 'hidden'
                }}
              >
                <div
                  onClick={() => setShowActorsList(!showActorsList)}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--bg-app, #f8fafc)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.875rem',
                    fontWeight: 600
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={16} color="var(--primary)" />
                    <span>Ver Perfiles Contemplados ({previewData.actors?.length || 0})</span>
                  </div>
                  {showActorsList ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {showActorsList && (
                  <div style={{ maxHeight: '160px', overflowY: 'auto', padding: '0.5rem' }}>
                    {previewData.actors?.map((actor, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderBottom: i < previewData.actors.length - 1 ? '1px solid var(--border-subtle, #f1f5f9)' : 'none',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem'
                        }}
                      >
                        <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                          {actor.id || `ACT-0${i + 1}`}
                        </span>
                        <div>
                          <strong>{actor.name}:</strong>{' '}
                          <span style={{ color: 'var(--text-muted)' }}>{actor.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle, #e2e8f0)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: 'var(--bg-app, #f8fafc)'
          }}
        >
          {status === 'idle' && (
            <>
              <button className="btn btn-secondary" onClick={handleResetAndClose}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={!file}
                onClick={handleStartProcessing}
              >
                <FileUp size={16} />
                <span>Procesar Documento</span>
              </button>
            </>
          )}

          {status === 'preview' && (
            <>
              <button className="btn btn-secondary" onClick={handleResetAndClose}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmImport}
                style={{ backgroundColor: 'var(--success, #16a34a)' }}
              >
                <CheckCircle size={16} />
                <span>Importar al Proyecto</span>
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <button className="btn btn-secondary" onClick={handleResetAndClose}>
                Cerrar
              </button>
              <button className="btn btn-primary" onClick={() => setStatus('idle')}>
                Reintentar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
