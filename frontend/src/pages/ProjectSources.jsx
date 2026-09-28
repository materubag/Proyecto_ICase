import React, { useEffect, useState } from 'react';
import {
  FileText,
  Upload,
  RefreshCw,
  CheckCircle2,
  Copy,
  AlertTriangle,
  Mic,
  FileAudio,
  Clock,
  ChevronDown,
  ChevronUp,
  Filter,
  Check,
  RotateCcw,
  Sparkles,
  ListChecks,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { sourcesApi } from '../api/sources.api';
import AudioTranscriptionViewer from '../components/sources/AudioTranscriptionViewer';
import FileUploadQueue from '../components/sources/FileUploadQueue';
import AnalysisCompletionModal from '../components/sources/AnalysisCompletionModal';

const statusConfig = {
  PENDING: { label: 'Pendiente', badgeClass: 'badge-planning', icon: Clock },
  UPLOADED: { label: 'Subido', badgeClass: 'badge-planning', icon: Upload },
  EXTRACTED: { label: 'Extraído', badgeClass: 'badge-completed', icon: CheckCircle2 },
  TRANSCRIBING: { label: 'Transcribiendo...', badgeClass: 'badge-in-progress', icon: RefreshCw, spin: true },
  TRANSCRIBED: { label: 'Transcrito', badgeClass: 'badge-completed', icon: CheckCircle2 },
  TRANSCRIPTION_ERROR: { label: 'Error transcripción', badgeClass: 'badge-archived', icon: AlertTriangle, error: true },
  ANALYZED: { label: 'Analizado', badgeClass: 'badge-completed', icon: CheckCircle2 },
  PENDING_REVIEW: { label: 'Pendiente revisión', badgeClass: 'badge-planning', icon: Clock },
  FAILED: { label: 'Error', badgeClass: 'badge-archived', icon: AlertTriangle, error: true }
};

export default function ProjectSources({ project, embedded = false, onNavigateToReview, onNavigateToSummary }) {
  const [sources, setSources] = useState([]);
  const [queueFiles, setQueueFiles] = useState([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [currentProcessingFile, setCurrentProcessingFile] = useState(null);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [completionSummary, setCompletionSummary] = useState({});

  const [typeFilter, setTypeFilter] = useState(''); // '' | 'PDF' | 'AUDIO'
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [analyzingSourceId, setAnalyzingSourceId] = useState(null);
  const [message, setMessage] = useState(null);
  const [selectedSourceId, setSelectedSourceId] = useState(null);
  const [selectedVersions, setSelectedVersions] = useState({}); // { [sourceId]: versionObj }
  const [copiedPdfId, setCopiedPdfId] = useState(null);
  const [sourceDetailTabs, setSourceDetailTabs] = useState({}); // { [sourceId]: 'text' | 'analysis' | 'evidence' }

  async function loadSources() {
    setLoading(true);
    try {
      const filters = {};
      if (typeFilter) filters.type = typeFilter;
      if (statusFilter) filters.status = statusFilter;
      const data = await sourcesApi.list(project.id, filters);
      setSources(data);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyzeSource(sourceId, force = false) {
    setAnalyzingSourceId(sourceId);
    setMessage(null);
    try {
      const res = await sourcesApi.analyze(sourceId, { force });
      const summary = res.data?.summary || {};
      setCompletionSummary({
        sourcesCount: 1,
        pdfCount: 1,
        audioCount: 0,
        ...summary,
        totalCandidates: summary.totalCandidates || 0,
        pendingReviewCount: summary.totalPendingReview || summary.totalCandidates || 0
      });
      setCompletionModalOpen(true);
      await loadSources();
    } catch (err) {
      setMessage({ type: 'error', text: `Error en análisis: ${err.message}` });
    } finally {
      setAnalyzingSourceId(null);
    }
  }

  async function handleStartBatchProcessing() {
    if (!queueFiles.length || isBatchProcessing) return;
    setIsBatchProcessing(true);
    setProcessedCount(0);
    setMessage(null);

    let totalCands = 0;
    let explicitCands = 0;
    let inferredCands = 0;
    let errors = 0;
    const uploadedSourceIds = [];

    const pdfQueue = queueFiles.filter((f) => f.type === 'PDF');
    const audioQueue = queueFiles.filter((f) => f.type === 'AUDIO');

    // 1. Process PDFs batch
    if (pdfQueue.length > 0) {
      setCurrentProcessingFile(`Subiendo ${pdfQueue.length} documento(s) PDF`);
      setQueueFiles((prev) =>
        prev.map((f) => (f.type === 'PDF' ? { ...f, status: 'UPLOADING' } : f))
      );
      try {
        const rawPdfs = pdfQueue.map((f) => f.rawFile);
        const result = await sourcesApi.uploadPdfs(project.id, rawPdfs);
        result.forEach((item) => {
          if (item.source?.id) uploadedSourceIds.push(item.source.id);
          else if (item.id) uploadedSourceIds.push(item.id);
        });
        setQueueFiles((prev) =>
          prev.map((f) => (f.type === 'PDF' ? { ...f, status: 'COMPLETED' } : f))
        );
        setProcessedCount((prev) => prev + pdfQueue.length);
      } catch (err) {
        errors += pdfQueue.length;
        setQueueFiles((prev) =>
          prev.map((f) =>
            f.type === 'PDF' ? { ...f, status: 'ERROR', error: err.message } : f
          )
        );
      }
    }

    // 2. Process Audios sequentially
    for (const audioItem of audioQueue) {
      setCurrentProcessingFile(`Transcribiendo "${audioItem.name}"...`);
      setQueueFiles((prev) =>
        prev.map((f) => (f.id === audioItem.id ? { ...f, status: 'PROCESSING' } : f))
      );
      try {
        const result = await sourcesApi.uploadAudio(project.id, audioItem.rawFile);
        if (result.source?.id) uploadedSourceIds.push(result.source.id);
        else if (result.id) uploadedSourceIds.push(result.id);
        setQueueFiles((prev) =>
          prev.map((f) => (f.id === audioItem.id ? { ...f, status: 'COMPLETED' } : f))
        );
        setProcessedCount((prev) => prev + 1);
      } catch (err) {
        errors++;
        setQueueFiles((prev) =>
          prev.map((f) =>
            f.id === audioItem.id ? { ...f, status: 'ERROR', error: err.message } : f
          )
        );
      }
    }

    // 3. Analyze newly uploaded sources
    let catTotals = {
      requirementsCount: 0,
      actorsCount: 0,
      processesCount: 0,
      businessRulesCount: 0,
      technologiesCount: 0,
      entitiesCount: 0,
      screensCount: 0,
      datesCount: 0,
      architectureCount: 0,
      constraintsCount: 0,
      objectivesCount: 0,
      scopeCount: 0,
      totalPendingReview: 0
    };

    if (uploadedSourceIds.length > 0) {
      setCurrentProcessingFile('Analizando fuentes para extracción integral...');
      for (const sourceId of uploadedSourceIds) {
        try {
          const res = await sourcesApi.analyze(sourceId, { force: true });
          const s = res.data?.summary || {};
          totalCands += s.totalCandidates || 0;
          explicitCands += s.explicitCount || 0;
          inferredCands += s.inferredCount || 0;
          catTotals.requirementsCount += s.requirementsCount || 0;
          catTotals.actorsCount += s.actorsCount || 0;
          catTotals.processesCount += s.processesCount || 0;
          catTotals.businessRulesCount += s.businessRulesCount || 0;
          catTotals.technologiesCount += s.technologiesCount || 0;
          catTotals.entitiesCount += s.entitiesCount || 0;
          catTotals.screensCount += s.screensCount || 0;
          catTotals.datesCount += s.datesCount || 0;
          catTotals.architectureCount += s.architectureCount || 0;
          catTotals.constraintsCount += s.constraintsCount || 0;
          catTotals.objectivesCount += s.objectivesCount || 0;
          catTotals.scopeCount += s.scopeCount || 0;
          catTotals.totalPendingReview += s.totalPendingReview || s.totalCandidates || 0;
        } catch (err) {
          console.error('Error analizando fuente:', sourceId, err);
        }
      }
    }

    await loadSources();
    setIsBatchProcessing(false);
    setCurrentProcessingFile(null);

    // Open completion modal with accurate metrics
    setCompletionSummary({
      sourcesCount: queueFiles.length,
      pdfCount: pdfQueue.length,
      audioCount: audioQueue.length,
      totalCandidates: totalCands,
      explicitCount: explicitCands,
      inferredCount: inferredCands,
      ...catTotals,
      pendingReviewCount: catTotals.totalPendingReview || totalCands,
      approvedCount: project.requirements?.filter((r) => r.status === 'APPROVED')?.length || 0,
      errorCount: errors
    });
    setCompletionModalOpen(true);
  }

  useEffect(() => {
    loadSources();
  }, [project.id, typeFilter, statusFilter]);

  async function handleRetryAudio(sourceId, file) {
    try {
      const result = await sourcesApi.retryAudio(sourceId, file);
      setMessage({
        type: 'success',
        text: `Transcripción completada exitosamente para "${result.data?.source?.name || 'la fuente'}".`
      });
      await loadSources();
    } catch (err) {
      setMessage({ type: 'error', text: `Fallo al reintentar: ${err.message}` });
      throw err;
    }
  }

  async function handleSelectVersion(sourceId, versionNumber) {
    try {
      const versionData = await sourcesApi.getVersion(sourceId, versionNumber);
      setSelectedVersions((prev) => ({ ...prev, [sourceId]: versionData }));
    } catch (err) {
      console.error('Error cargando versión:', err);
    }
  }

  const handleCopyText = async (text, sourceId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPdfId(sourceId);
      setTimeout(() => setCopiedPdfId(null), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={embedded ? '' : 'page-scrollable'} style={{ padding: embedded ? '0' : '24px', marginBottom: '24px' }}>
      <section className="panel" style={{ padding: embedded ? '18px' : '20px' }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--primary)',
                background: 'var(--surface-container-low)',
                border: '1px solid var(--outline-variant)',
                borderRadius: '8px'
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <h2 className="section-title" style={{ margin: 0, fontSize: '1.25rem' }}>
                Gestión de Fuentes del Proyecto
              </h2>
              <p className="section-subtitle" style={{ margin: '4px 0 0 0', fontSize: '0.85rem' }}>
                Documentos PDF y audios de entrevistas integrados como base de requisitos
              </p>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-icon"
            onClick={loadSources}
            title="Actualizar fuentes"
            aria-label="Actualizar fuentes"
          >
            <RefreshCw size={18} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {/* Zona de subida unificada con cola de archivos (PDF y Audio) */}
        <div style={{ marginBottom: '20px' }}>
          <FileUploadQueue
            files={queueFiles}
            onFilesChange={setQueueFiles}
            isProcessing={isBatchProcessing}
            processedCount={processedCount}
            currentProcessingFile={currentProcessingFile}
            onStartProcessing={handleStartBatchProcessing}
          />
        </div>

        {/* Mensajes de notificación */}
        {message && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '6px',
              marginBottom: '18px',
              fontSize: '0.85rem',
              background:
                message.type === 'error'
                  ? 'rgba(180, 35, 24, 0.1)'
                  : message.type === 'warning'
                  ? 'rgba(154, 103, 0, 0.1)'
                  : 'rgba(21, 115, 71, 0.1)',
              color:
                message.type === 'error'
                  ? '#f87171'
                  : message.type === 'warning'
                  ? '#9a6700'
                  : '#34d399',
              border: `1px solid ${
                message.type === 'error'
                  ? '#f87171'
                  : message.type === 'warning'
                  ? '#9a6700'
                  : '#34d399'
              }`
            }}
          >
            {message.text}
          </div>
        )}

        {/* Barra de Filtros */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--secondary)' }}>Tipo:</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className={`btn btn-sm ${typeFilter === '' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTypeFilter('')}
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              >
                Todos ({sources.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${typeFilter === 'PDF' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTypeFilter('PDF')}
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              >
                PDFs ({sources.filter((s) => s.type === 'PDF').length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${typeFilter === 'AUDIO' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTypeFilter('AUDIO')}
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              >
                Audios ({sources.filter((s) => s.type === 'AUDIO').length})
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Filter size={15} color="var(--secondary)" />
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '200px', fontSize: '0.82rem', padding: '5px 8px' }}
            >
              <option value="">Todos los estados</option>
              {Object.entries(statusConfig).map(([statusKey, cfg]) => (
                <option key={statusKey} value={statusKey}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Listado de Fuentes */}
        {loading ? (
          <div className="empty-state" style={{ padding: '32px' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '8px', color: 'var(--primary)' }} />
            <p>Cargando fuentes del proyecto...</p>
          </div>
        ) : !sources.length ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '24px',
              border: '1px solid var(--outline-variant)',
              borderRadius: '8px',
              color: 'var(--secondary)',
              background: 'var(--surface)'
            }}
          >
            <FileAudio size={28} />
            <div>
              <strong style={{ display: 'block', color: 'var(--on-surface)' }}>No hay fuentes registradas</strong>
              <span style={{ fontSize: '0.85rem' }}>
                Sube un documento PDF de especificación o un archivo de audio de entrevista para comenzar.
              </span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {sources.map((source) => {
              const isSelected = selectedSourceId === source.id;
              const isAudio = source.type === 'AUDIO';
              const cfg = statusConfig[source.status] || {
                label: source.status,
                badgeClass: 'badge-planning',
                icon: Clock
              };
              const StatusIcon = cfg.icon;
              const activeVersion = selectedVersions[source.id] || source.currentVersion;
              const segmentsCount = activeVersion?.segments?.length || 0;

              return (
                <article
                  key={source.id}
                  className="panel"
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    border: isSelected
                      ? '1px solid var(--primary, #6750A4)'
                      : '1px solid var(--outline-variant)',
                    background: 'var(--surface)',
                    transition: 'border-color 0.2s ease'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    {/* Icono y Detalles de la Fuente */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '8px',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          background: isAudio ? 'rgba(103, 80, 164, 0.12)' : 'rgba(21, 115, 71, 0.12)',
                          color: isAudio ? 'var(--primary, #6750A4)' : '#34d399'
                        }}
                      >
                        {isAudio ? <Mic size={20} /> : <FileText size={20} />}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '0.94rem' }}>{source.name}</strong>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: isAudio ? 'rgba(103, 80, 164, 0.15)' : 'rgba(0, 120, 212, 0.15)',
                              color: isAudio ? 'var(--primary, #6750A4)' : '#0078d4'
                            }}
                          >
                            {source.type}
                          </span>
                          <span
                            className={`badge ${cfg.badgeClass}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.74rem'
                            }}
                          >
                            <StatusIcon size={12} className={cfg.spin ? 'spin' : ''} />
                            {cfg.label}
                          </span>
                        </div>

                        <div
                          style={{
                            color: 'var(--on-surface-variant)',
                            fontSize: '0.78rem',
                            marginTop: '4px',
                            display: 'flex',
                            gap: '12px',
                            flexWrap: 'wrap'
                          }}
                        >
                          <span>Versión actual: v{source.currentVersion?.version || 1}</span>
                          <span>{source.versions?.length || 1} versión(es)</span>
                          {source.fileSize ? (
                            <span>{(source.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
                          ) : null}
                          {isAudio && segmentsCount > 0 ? (
                            <span style={{ color: 'var(--primary)', fontWeight: 500 }}>
                              {segmentsCount} segmentos transcritos
                            </span>
                          ) : null}
                        </div>

                        <div
                          style={{
                            color: 'var(--outline)',
                            fontSize: '0.72rem',
                            marginTop: '2px',
                            fontFamily: 'monospace'
                          }}
                        >
                          SHA-256: {source.fileHash ? `${source.fileHash.slice(0, 16)}...` : 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                      {source.status === 'TRANSCRIPTION_ERROR' && (
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: '#f87171',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <AlertTriangle size={14} /> Falló transcripción
                        </span>
                      )}

                      {/* Botón Revisar Candidatos si ya tiene candidatos */}
                      {(source.status === 'ANALYZED' || (activeVersion?.candidates && activeVersion.candidates.length > 0)) && (
                        <button
                          className="btn btn-outline btn-sm"
                          type="button"
                          onClick={() => onNavigateToReview?.()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            borderColor: 'var(--primary)',
                            color: 'var(--primary)',
                            fontWeight: 600
                          }}
                        >
                          <ListChecks size={14} />
                          <span>Revisar ({activeVersion?.candidates?.length || 0})</span>
                          <ArrowRight size={13} />
                        </button>
                      )}

                      {/* Botón Analizar / Reanalizar */}
                      <button
                        className={`btn ${source.status === 'ANALYZED' ? 'btn-outline' : 'btn-primary'} btn-sm`}
                        type="button"
                        disabled={analyzingSourceId === source.id || (!activeVersion?.extractedText && !activeVersion?.audioSegments?.length)}
                        onClick={() => handleAnalyzeSource(source.id, source.status === 'ANALYZED')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        title={source.status === 'ANALYZED' ? 'Volver a ejecutar el pipeline de análisis' : 'Ejecutar pipeline Fase 3'}
                      >
                        <Sparkles size={14} className={analyzingSourceId === source.id ? 'spin' : ''} />
                        <span>{analyzingSourceId === source.id ? 'Analizando...' : source.status === 'ANALYZED' ? 'Reanalizar' : 'Analizar'}</span>
                      </button>

                      {/* Toggle Expandir */}
                      <button
                        className="btn btn-outline btn-sm"
                        type="button"
                        onClick={() => setSelectedSourceId(isSelected ? null : source.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        {isSelected ? (
                          <>
                            <span>Cerrar</span>
                            <ChevronUp size={15} />
                          </>
                        ) : (
                          <>
                            <span>Detalle</span>
                            <ChevronDown size={15} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Vista expandida con Tabs (Texto / Análisis / Evidencias) */}
                  {isSelected && (
                    <div
                      style={{
                        marginTop: '14px',
                        background: 'var(--surface-container-lowest, #ffffff)',
                        border: '1px solid var(--outline-variant)',
                        borderRadius: '8px',
                        padding: '16px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                      }}
                    >
                      {/* Sub-tabs header */}
                      <div
                        style={{
                          display: 'flex',
                          gap: '6px',
                          borderBottom: '1px solid var(--outline-variant)',
                          paddingBottom: '10px',
                          marginBottom: '14px',
                          flexWrap: 'wrap'
                        }}
                      >
                        <button
                          type="button"
                          className={`btn btn-sm ${(sourceDetailTabs[source.id] || 'analysis') === 'analysis' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setSourceDetailTabs(prev => ({ ...prev, [source.id]: 'analysis' }))}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Sparkles size={14} />
                          <span>Análisis y Candidatos ({activeVersion?.candidates?.length || 0})</span>
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${sourceDetailTabs[source.id] === 'text' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => setSourceDetailTabs(prev => ({ ...prev, [source.id]: 'text' }))}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <FileText size={14} />
                          <span>Texto Extraído</span>
                        </button>
                        {isAudio && (
                          <button
                            type="button"
                            className={`btn btn-sm ${sourceDetailTabs[source.id] === 'evidence' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setSourceDetailTabs(prev => ({ ...prev, [source.id]: 'evidence' }))}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Mic size={14} />
                            <span>Segmentos y Timestamps</span>
                          </button>
                        )}
                      </div>

                      {/* Tab 1: Análisis Fase 3 */}
                      {(sourceDetailTabs[source.id] || 'analysis') === 'analysis' && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                            <div>
                              <strong style={{ fontSize: '0.95rem' }}>Resumen del Análisis de Requisitos</strong>
                              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--secondary)' }}>
                                Evaluación de calidad basada en criterios de ISO/IEC/IEEE 29148:2018
                              </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={analyzingSourceId === source.id}
                                onClick={() => handleAnalyzeSource(source.id, true)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              >
                                <RotateCcw size={13} className={analyzingSourceId === source.id ? 'spin' : ''} />
                                <span>{analyzingSourceId === source.id ? 'Procesando...' : 'Reanalizar Fuente'}</span>
                              </button>
                              {activeVersion?.candidates?.length > 0 && (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => onNavigateToReview?.()}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                >
                                  <span>Ir a Revisión Completa</span>
                                  <ArrowRight size={13} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Grid métricas */}
                          {(() => {
                            const cands = activeVersion?.candidates || [];
                            const rf = cands.filter(c => c.type === 'FUNCTIONAL').length;
                            const rnf = cands.filter(c => c.type === 'NON_FUNCTIONAL').length;
                            const rules = cands.filter(c => c.type === 'BUSINESS_RULE').length;
                            const conflicts = cands.filter(c => c.category === 'CONFLICT' || c.qualityReport?.issues?.some(i => i.type === 'CONFLICT')).length;
                            const warnings = cands.reduce((acc, c) => acc + (c.qualityReport?.issues?.length || 0), 0);

                            return (
                              <div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                                  <div style={{ padding: '10px 12px', background: 'var(--surface-container-low)', borderRadius: '6px', border: '1px solid var(--outline-variant)' }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--secondary)' }}>Candidatos Totales</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{cands.length}</div>
                                  </div>
                                  <div style={{ padding: '10px 12px', background: 'var(--surface-container-low)', borderRadius: '6px', border: '1px solid var(--outline-variant)' }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--secondary)' }}>RF (Funcionales)</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399' }}>{rf}</div>
                                  </div>
                                  <div style={{ padding: '10px 12px', background: 'var(--surface-container-low)', borderRadius: '6px', border: '1px solid var(--outline-variant)' }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--secondary)' }}>RNF (No Funcionales)</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#055160' }}>{rnf}</div>
                                  </div>
                                  <div style={{ padding: '10px 12px', background: 'var(--surface-container-low)', borderRadius: '6px', border: '1px solid var(--outline-variant)' }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--secondary)' }}>Reglas de Negocio</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#6f42c1' }}>{rules}</div>
                                  </div>
                                  <div style={{ padding: '10px 12px', background: 'var(--surface-container-low)', borderRadius: '6px', border: '1px solid var(--outline-variant)' }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--secondary)' }}>Conflictos</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: conflicts > 0 ? '#f87171' : 'var(--outline)' }}>{conflicts}</div>
                                  </div>
                                  <div style={{ padding: '10px 12px', background: 'var(--surface-container-low)', borderRadius: '6px', border: '1px solid var(--outline-variant)' }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--secondary)' }}>Observaciones ISO</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: warnings > 0 ? '#b54708' : 'var(--outline)' }}>{warnings}</div>
                                  </div>
                                </div>

                                {/* Listado breve de candidatos con evidencia */}
                                {cands.length === 0 ? (
                                  <div style={{ padding: '16px', background: 'var(--surface-container-low)', borderRadius: '6px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--secondary)' }}>
                                    Esta fuente aún no ha sido analizada o no produjo candidatos. Haz clic en "Analizar" para procesarla.
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                                    {cands.slice(0, 10).map((cand) => (
                                      <div
                                        key={cand.id}
                                        style={{
                                          padding: '8px 12px',
                                          background: 'var(--surface-container-low)',
                                          border: '1px solid var(--outline-variant)',
                                          borderRadius: '6px',
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          gap: '10px'
                                        }}
                                      >
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)' }}>{cand.temporaryCode || 'CAND'}</span>
                                            <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: 'var(--surface-variant)', color: 'var(--secondary)' }}>{cand.type}</span>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--outline)' }}>Origen: {cand.origin}</span>
                                          </div>
                                          <div style={{ fontSize: '0.82rem', color: 'var(--on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {cand.statement}
                                          </div>
                                        </div>
                                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: cand.status === 'APPROVED' ? '#d1e7dd' : cand.status === 'REJECTED' ? '#f8d7da' : '#fff3cd', color: cand.status === 'APPROVED' ? '#0f5132' : cand.status === 'REJECTED' ? '#842029' : '#664d03', fontWeight: 600 }}>
                                          {cand.status === 'PENDING_REVIEW' ? 'Pendiente' : cand.status === 'APPROVED' ? 'Aprobado' : 'Rechazado'}
                                        </span>
                                      </div>
                                    ))}
                                    {cands.length > 10 && (
                                      <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--secondary)', paddingTop: '4px' }}>
                                        + {cands.length - 10} candidatos adicionales. Abre la pantalla de revisión para gestionarlos todos.
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Tab 2: Texto Extraído */}
                      {sourceDetailTabs[source.id] === 'text' && (
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '10px'
                            }}
                          >
                            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                              Texto extraído (Versión v{source.currentVersion?.version || 1})
                            </span>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => handleCopyText(source.currentVersion?.extractedText || '', source.id)}
                            >
                              {copiedPdfId === source.id ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                              <span style={{ marginLeft: '4px' }}>
                                {copiedPdfId === source.id ? 'Copiado' : 'Copiar'}
                              </span>
                            </button>
                          </div>
                          <pre
                            style={{
                              whiteSpace: 'pre-wrap',
                              fontSize: '0.82rem',
                              lineHeight: '1.6',
                              fontFamily: 'inherit',
                              maxHeight: '320px',
                              overflowY: 'auto',
                              background: 'var(--surface-container-low, #f9f9f9)',
                              padding: '12px',
                              borderRadius: '6px'
                            }}
                          >
                            {source.currentVersion?.extractedText || 'No hay texto extraído disponible.'}
                          </pre>
                        </div>
                      )}

                      {/* Tab 3: Evidencias de Audio / Segmentos */}
                      {isAudio && sourceDetailTabs[source.id] === 'evidence' && (
                        <AudioTranscriptionViewer
                          source={source}
                          currentVersion={activeVersion}
                          onRetry={handleRetryAudio}
                          onSelectVersion={handleSelectVersion}
                        />
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal de Finalización del Análisis */}
      <AnalysisCompletionModal
        isOpen={completionModalOpen}
        onClose={() => setCompletionModalOpen(false)}
        onNavigateToReview={onNavigateToReview}
        onNavigateToSummary={onNavigateToSummary}
        summaryData={completionSummary}
      />
    </div>
  );
}
