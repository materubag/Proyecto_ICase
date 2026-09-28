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
  ArrowRight,
  Server,
  Boxes,
  GitBranch,
  Copy,
  Sparkles
} from 'lucide-react';
import { documentsApi } from '../api/documents.api';
import MermaidDiagram from './diagrams/MermaidDiagram';

function SourceBadge({ source }) {
  const s = (source || '').toLowerCase();
  if (s === 'explicit' || s === 'pdf' || s === 'rule') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '0.7rem',
          fontWeight: 600,
          backgroundColor: 'rgba(34, 197, 94, 0.12)',
          color: '#15803d',
          border: '1px solid rgba(34, 197, 94, 0.25)'
        }}
      >
        Explícito
      </span>
    );
  }
  if (s === 'inferred' || s === 'ai') {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '0.7rem',
          fontWeight: 600,
          backgroundColor: 'rgba(59, 130, 246, 0.12)',
          color: '#1d4ed8',
          border: '1px solid rgba(59, 130, 246, 0.25)'
        }}
      >
        Inferido (IA)
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.7rem',
        fontWeight: 600,
        backgroundColor: 'rgba(100, 116, 139, 0.12)',
        color: '#475569',
        border: '1px solid rgba(100, 116, 139, 0.25)'
      }}
    >
      Predeterminado
    </span>
  );
}

export default function DocumentImportModal({
  isOpen,
  onClose,
  projectId,
  onImportSuccess
}) {
  const [file, setFile] = useState(null);
  // Estados: 'idle' | 'uploading' | 'extracting' | 'analyzing' | 'validating' | 'preview' | 'success' | 'error'
  const [status, setStatus] = useState('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  // Datos de extracción y análisis
  const [extractionData, setExtractionData] = useState(null);
  const [previewData, setPreviewData] = useState(null);

  // Pestañas de la vista previa
  const [activeTab, setActiveTab] = useState('resumen');
  const [activeDiagramTab, setActiveDiagramTab] = useState('er');
  const [copiedCode, setCopiedCode] = useState(false);

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
      // 1. Subida
      setStatus('uploading');
      setStatusMessage('Subiendo archivo PDF...');
      setErrorMessage(null);

      // 2. Extracción determinista
      setStatus('extracting');
      setStatusMessage('Normalizando texto, eliminando duplicados y aplicando detectores...');
      const extractRes = await documentsApi.extract(file);
      setExtractionData(extractRes);

      // 3. Pipeline híbrido
      setStatus('analyzing');
      setStatusMessage('Ejecutando pipeline híbrido determinista + IA...');
      const analyzeRes = await documentsApi.analyze(extractRes);

      // 4. Validación canónica
      setStatus('validating');
      setStatusMessage('Validando coherencia de datos y generando diagramas Mermaid...');
      await new Promise(r => setTimeout(r, 400));

      setPreviewData(analyzeRes);
      setStatus('preview');
      setActiveTab('resumen');
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
    setActiveTab('resumen');
    onClose();
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDiagramCode = () => {
    if (!previewData?.diagrams) return '';
    if (activeDiagramTab === 'er') return previewData.diagrams.erDiagram || '';
    if (activeDiagramTab === 'navigation') return previewData.diagrams.navigationDiagram || '';
    if (activeDiagramTab === 'architecture') return previewData.diagrams.architectureDiagram || '';
    if (activeDiagramTab === 'useCase') return previewData.diagrams.useCaseDiagram || '';
    return '';
  };

  const copyCurrentDiagramCode = () => {
    const code = getDiagramCode();
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const functionalReqs = (previewData?.requirements || []).filter(r => r.type === 'FUNCTIONAL');
  const nonFunctionalReqs = (previewData?.requirements || []).filter(r => r.type === 'NON_FUNCTIONAL');

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem'
      }}
      onClick={handleResetAndClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '880px',
          maxHeight: '92vh',
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
                Importar Documento PDF
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', margin: 0 }}>
                Pipeline híbrido determinista + IA para extracción y modelado ICASE
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
                color: 'var(--danger, #f87171)',
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
                Se han importado los requisitos, actores, entidades, modelo de datos y arquitectura al proyecto.
              </p>
            </div>
          )}

          {/* Estado: IDLE */}
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
                    ? `Tamaño: ${formatFileSize(file.size)} | Listo para procesar con pipeline determinista`
                    : 'Documentos de especificación, propuestas técnicas o requerimientos en formato PDF'}
                </p>
              </div>

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
                  <strong>Pipeline inteligente:</strong> Aplica normalización, detectores deterministas, catálogos de tecnología y arquitectura. Ollama se invoca como último recurso únicamente ante fragmentos ambiguos.
                </span>
              </div>
            </div>
          )}

          {/* Estados de carga */}
          {(status === 'uploading' || status === 'extracting' || status === 'analyzing' || status === 'validating') && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem 1.5rem',
                textAlign: 'center',
                gap: '1rem'
              }}
            >
              <Loader2
                size={40}
                style={{
                  animation: 'spin 1.5s linear infinite',
                  color: 'var(--primary, #2563eb)'
                }}
              />
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Procesando documento...
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)', margin: 0 }}>
                  {statusMessage}
                </p>
              </div>
            </div>
          )}

          {/* Estado: PREVIEW (Resultados del Análisis) */}
          {status === 'preview' && previewData && (
            <div>
              {/* Encabezado del Documento */}
              <div
                style={{
                  backgroundColor: 'var(--bg-app, #f8fafc)',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  borderRadius: '8px',
                  padding: '0.85rem 1.25rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}
              >
                <div>
                  <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
                    Documento Procesado
                  </span>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {previewData.documentAnalysis?.sourceFile || file?.name}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                    {previewData.documentAnalysis?.pageCount || 1} páginas
                  </span>
                  <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                    Pipeline Completado
                  </span>
                </div>
              </div>

              {/* Barra de pestañas */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.25rem',
                  borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                  marginBottom: '1.25rem',
                  overflowX: 'auto'
                }}
              >
                {[
                  { id: 'resumen', label: 'Resumen' },
                  { id: 'requisitos', label: `Requisitos (${previewData.requirements?.length || 0})` },
                  { id: 'actores', label: `Actores (${previewData.actors?.length || 0})` },
                  { id: 'entidades', label: `Entidades (${previewData.entities?.length || 0})` },
                  { id: 'tecnologias', label: 'Tecnologías' },
                  { id: 'arquitectura', label: 'Arquitectura' },
                  { id: 'diagramas', label: 'Diagramas Mermaid' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '0.5rem 0.85rem',
                      fontSize: '0.8125rem',
                      fontWeight: activeTab === tab.id ? 600 : 500,
                      color: activeTab === tab.id ? 'var(--primary, #2563eb)' : 'var(--text-muted, #64748b)',
                      border: 'none',
                      background: 'none',
                      borderBottom: activeTab === tab.id ? '2px solid var(--primary, #2563eb)' : '2px solid transparent',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: RESUMEN */}
              {activeTab === 'resumen' && (
                <div>
                  {/* Tarjetas Cuantitativas */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '0.75rem',
                      marginBottom: '1.25rem'
                    }}
                  >
                    <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <FileText size={16} color="var(--primary)" style={{ margin: '0 auto 0.2rem' }} />
                      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                        {functionalReqs.length}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Requisitos Funcionales
                      </div>
                    </div>

                    <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <Layers size={16} color="#0284c7" style={{ margin: '0 auto 0.2rem' }} />
                      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                        {nonFunctionalReqs.length}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        No Funcionales
                      </div>
                    </div>

                    <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <Users size={16} color="#16a34a" style={{ margin: '0 auto 0.2rem' }} />
                      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                        {previewData.actors?.length || 0}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Actores
                      </div>
                    </div>

                    <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <Database size={16} color="#d97706" style={{ margin: '0 auto 0.2rem' }} />
                      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                        {previewData.entities?.length || 0}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Entidades
                      </div>
                    </div>

                    <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <Cpu size={16} color="#9333ea" style={{ margin: '0 auto 0.2rem' }} />
                      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                        {(previewData.technologies?.frontend?.length || 0) +
                         (previewData.technologies?.backend?.length || 0) +
                         (previewData.technologies?.database?.length || 0) +
                         (previewData.technologies?.infrastructure?.length || 0)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Tecnologías
                      </div>
                    </div>

                    <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <Server size={16} color="#475569" style={{ margin: '0 auto 0.2rem' }} />
                      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                        1
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Arquitectura
                      </div>
                    </div>
                  </div>

                  {/* Tarjeta de Estadísticas de Deduplicación y Optimización */}
                  <div
                    style={{
                      backgroundColor: 'var(--bg-app, #f8fafc)',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '1rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <Sparkles size={16} color="var(--primary)" />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        Métricas del Pipeline Híbrido Determinista
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '0.75rem',
                        fontSize: '0.8rem'
                      }}
                    >
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Fragmentos analizados: </span>
                        <strong>{previewData.statistics?.totalFragments || 0}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Duplicados eliminados: </span>
                        <strong style={{ color: '#16a34a' }}>{previewData.statistics?.duplicatesRemoved || 0}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Fragmentos enviados a Ollama: </span>
                        <strong>
                          {previewData.statistics?.aiFragments === 0
                            ? '0 (100% determinista)'
                            : `${previewData.statistics?.aiFragments} fragmentos`}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Origen de la arquitectura: </span>
                        <SourceBadge source={previewData.architecture?.source} />
                      </div>
                    </div>
                  </div>

                  {/* Resumen de Arquitectura */}
                  <div
                    style={{
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '8px',
                      padding: '1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Arquitectura Detectada
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                        {previewData.architecture?.name || 'Arquitectura Web Modular Cliente-Servidor'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {previewData.architecture?.description}
                      </div>
                    </div>
                    <div>
                      <SourceBadge source={previewData.architecture?.source} />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: REQUISITOS */}
              {activeTab === 'requisitos' && (
                <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {previewData.requirements?.map((req, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '0.75rem 1rem',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-surface, #fff)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem'
                      }}
                    >
                      <span
                        className="badge"
                        style={{
                          backgroundColor: req.type === 'NON_FUNCTIONAL' ? 'rgba(2, 132, 199, 0.12)' : 'rgba(37, 99, 235, 0.12)',
                          color: req.type === 'NON_FUNCTIONAL' ? '#0284c7' : '#1d4ed8',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}
                      >
                        {req.code}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{req.name}</div>
                        {req.description && req.description !== req.name && (
                          <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {req.description}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <SourceBadge source={req.source} />
                        <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>
                          {req.priority || 'ALTA'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: ACTORES */}
              {activeTab === 'actores' && (
                <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {previewData.actors?.map((actor, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '0.75rem 1rem',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'var(--bg-surface, #fff)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: 'rgba(22, 163, 74, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#16a34a'
                          }}
                        >
                          <Users size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{actor.name}</div>
                          <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>{actor.description}</div>
                        </div>
                      </div>
                      <SourceBadge source={actor.source} />
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: ENTIDADES */}
              {activeTab === 'entidades' && (
                <div style={{ maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {previewData.entities?.map((ent, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '0.75rem 1rem',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-surface, #fff)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Database size={15} color="#d97706" />
                          <strong style={{ fontSize: '0.875rem' }}>{ent.name}</strong>
                        </div>
                        <SourceBadge source={ent.source} />
                      </div>
                      <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                        {ent.description}
                      </div>
                      {Array.isArray(ent.attributes) && ent.attributes.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.4rem' }}>
                          {ent.attributes.map((attr, aIdx) => (
                            <span
                              key={aIdx}
                              style={{
                                backgroundColor: 'var(--bg-app, #f1f5f9)',
                                padding: '1px 6px',
                                borderRadius: '3px',
                                fontSize: '0.7rem',
                                color: 'var(--text-main)'
                              }}
                            >
                              {attr.name} {attr.isPk && <span style={{ color: '#d97706', fontWeight: 600 }}>[PK]</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 5: TECNOLOGÍAS */}
              {activeTab === 'tecnologias' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {[
                    { title: 'Frontend / Presentación', items: previewData.technologies?.frontend || [] },
                    { title: 'Backend / APIs', items: previewData.technologies?.backend || [] },
                    { title: 'Bases de Datos', items: previewData.technologies?.database || [] },
                    { title: 'Infraestructura / Despliegue', items: previewData.technologies?.infrastructure || [] }
                  ].map((cat, idx) => (
                    <div
                      key={idx}
                      style={{
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                        borderRadius: '6px',
                        padding: '0.75rem 1rem',
                        backgroundColor: 'var(--bg-surface, #fff)'
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                        {cat.title}
                      </div>
                      {cat.items.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {cat.items.map((techName, tIdx) => (
                            <span
                              key={tIdx}
                              className="badge badge-primary"
                              style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                            >
                              {techName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No se especificaron tecnologías explícitas</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 6: ARQUITECTURA */}
              {activeTab === 'arquitectura' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div
                    style={{
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      backgroundColor: 'var(--bg-surface, #fff)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
                        {previewData.architecture?.name}
                      </h3>
                      <SourceBadge source={previewData.architecture?.source} />
                    </div>

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>
                      {previewData.architecture?.description}
                    </p>

                    {/* Componentes de la arquitectura */}
                    {Array.isArray(previewData.architecture?.components) && previewData.architecture.components.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                          Componentes de la solución
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                          {previewData.architecture.components.map((comp, cIdx) => (
                            <div
                              key={cIdx}
                              style={{
                                padding: '0.5rem 0.75rem',
                                border: '1px solid var(--border-subtle, #e2e8f0)',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                backgroundColor: 'var(--bg-app, #f8fafc)'
                              }}
                            >
                              <strong>{comp.name}</strong>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Capa: {comp.layer || 'Aplicación'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 7: DIAGRAMAS MERMAID */}
              {activeTab === 'diagramas' && (
                <div>
                  {/* Selector de tipo de diagrama */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {[
                        { id: 'er', label: 'Diagrama ER' },
                        { id: 'navigation', label: 'Navegación' },
                        { id: 'architecture', label: 'Arquitectura' },
                        { id: 'useCase', label: 'Casos de Uso' }
                      ].map(d => (
                        <button
                          key={d.id}
                          onClick={() => setActiveDiagramTab(d.id)}
                          className={`btn ${activeDiagramTab === d.id ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={copyCurrentDiagramCode}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Copy size={13} />
                      <span>{copiedCode ? '¡Copiado!' : 'Copiar Mermaid'}</span>
                    </button>
                  </div>

                  {/* Renderizado de Mermaid */}
                  <div
                    style={{
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '8px',
                      padding: '1rem',
                      backgroundColor: 'var(--bg-surface, #fff)',
                      minHeight: '260px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflowX: 'auto'
                    }}
                  >
                    {getDiagramCode() ? (
                      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <MermaidDiagram code={getDiagramCode()} />
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        No hay diagrama generado para esta sección.
                      </span>
                    )}
                  </div>
                </div>
              )}
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
