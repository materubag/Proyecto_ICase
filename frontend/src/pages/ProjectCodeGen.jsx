import React, { useState, useEffect, useMemo } from 'react';
import { codegenApi } from '../api/codegen.api';
import { groupQualityIssues, completedBatchAnswers, diagnosticText } from '../utils/codegenQualityGroups';
import './ProjectCodeGen.css';

export default function ProjectCodeGen({ project, onNavigateTo }) {
  const [includeDocker, setIncludeDocker] = useState(true);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [approvingSpec, setApprovingSpec] = useState(false);
  const [error, setError] = useState(null);
  const [generatedData, setGeneratedData] = useState(null);
  const [selectedFilePath, setSelectedFilePath] = useState('docker-compose.yml');
  const [copied, setCopied] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [stackFilter, setStackFilter] = useState('all'); // 'all' | 'frontend' | 'backend'
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoadingBindings, setAiLoadingBindings] = useState(false);
  const [aiMessage, setAiMessage] = useState(null);
  const [useLiveAi, setUseLiveAi] = useState(true);

  // Estados del Pipeline de Generación Asistida Persistente por IA
  const [activeJob, setActiveJob] = useState(null);
  const [jobLoading, setJobLoading] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [customAnswers, setCustomAnswers] = useState({});
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [activeTab, setActiveTab] = useState('files'); // 'files' | 'verification'
  const [showQualityGateErrors, setShowQualityGateErrors] = useState(false);
  const quality = useMemo(() => groupQualityIssues(generatedData?.diagnostics?.errors || []), [generatedData]);
  const batchAnswers = completedBatchAnswers(activeJob?.questions, selectedOptions, customAnswers);

  // Carga automática inicial de la previsualización y trabajo activo
  useEffect(() => {
    if (project?.id) {
      loadPreview();
      loadAiStatus();
      loadActiveJob();
    }
  }, [project?.id, includeDocker]);

  // Sondeo reactivo del trabajo activo
  useEffect(() => {
    if (!project?.id) return;

    const inProgress = activeJob && ['ANALYZING', 'WAITING_FOR_INPUT', 'GENERATING', 'VALIDATING', 'REPAIRING'].includes(activeJob.status);
    if (!inProgress || activeJob.status === 'WAITING_FOR_INPUT') return;

    const interval = setInterval(async () => {
      try {
        const res = await codegenApi.getActiveJob(project.id);
        const job = (res && res.id) ? res : (res?.data || null);
        if (job) {
          setActiveJob(job);
          if (['COMPLETED', 'WAITING_FOR_INPUT', 'BLOCKED'].includes(job.status)) {
            loadPreview();
          }
        }
      } catch (_) {}
    }, 1500);

    return () => clearInterval(interval);
  }, [project?.id, activeJob?.status]);

  async function loadActiveJob() {
    try {
      const res = await codegenApi.getActiveJob(project.id);
      const job = (res && res.id) ? res : (res?.data || null);
      if (job) {
        setActiveJob(job);
      }
    } catch (_) {}
  }

  async function handleStartGenerationJob() {
    try {
      setJobLoading(true);
      setError(null);
      const res = await codegenApi.startGenerationJob(project.id, {
        scope: 'Requisitos, operaciones y pantallas del proyecto',
        maxRepairAttempts: 3,
        enableAI: useLiveAi,
        includeDocker
      });
      const job = (res && res.id) ? res : (res?.data || null);
      if (job) {
        setActiveJob(job);
      }
    } catch (err) {
      console.error('Error al iniciar trabajo de generación:', err);
      setError(err.message || 'Error al iniciar generación asistida');
    } finally {
      setJobLoading(false);
    }
  }

  async function handleAnswerClarification(questionId) {
    if (!activeJob?.id) return;
    try {
      setSubmittingAnswer(true);
      setError(null);
      const optId = selectedOptions[questionId];
      const custom = customAnswers[questionId];
      const q = (activeJob.questions || []).find(item => item.questionId === questionId);

      await codegenApi.submitJobInput(project.id, activeJob.id, {
        questionId,
        selectedOptionId: optId,
        customAnswer: custom,
        requirementIds: q?.requirementIds || []
      });

      const updated = await codegenApi.getActiveJob(project.id);
      const job = (updated && updated.id) ? updated : (updated?.data || null);
      if (job) setActiveJob(job);
    } catch (err) {
      console.error('Error al responder aclaración:', err);
      setError(err.message || 'Error al registrar respuesta de aclaración');
    } finally {
      setSubmittingAnswer(false);
    }
  }

  async function handleCancelJob() {
    if (!activeJob?.id) return;
    try {
      await codegenApi.cancelJob(project.id, activeJob.id);
      const updated = await codegenApi.getActiveJob(project.id);
      if (updated?.data) setActiveJob(updated.data);
    } catch (_) {}
  }

  async function handleReviewAll() {
    if (!activeJob?.id) return handleStartGenerationJob();
    setJobLoading(true); setError(null);
    try {
      await codegenApi.reviewAll(project.id, activeJob.id);
      await loadActiveJob();
    } catch (err) { setError(err.message || 'No se pudo iniciar la revisión completa'); }
    finally { setJobLoading(false); }
  }

  async function handleSaveBatchAnswers() {
    if (!activeJob?.id || !batchAnswers.length) return;
    setSubmittingAnswer(true); setError(null);
    try {
      for (const answer of batchAnswers) await codegenApi.submitJobInput(project.id, activeJob.id, answer);
    } catch (err) { setError(err.message || 'No se pudieron guardar todas las respuestas'); }
    finally { await loadActiveJob(); setSubmittingAnswer(false); }
  }

  async function loadAiStatus() {
    try {
      const res = await codegenApi.getAiStatus(project.id);
      setAiStatus(res || null);
    } catch (err) {
      setAiMessage(`No se pudo cargar el estado de operaciones: ${err.message}`);
    }
  }

  async function handleProposeOperations() {
    try {
      setAiLoading(true);
      setAiMessage(null);
      const created = await codegenApi.proposeOperations(project.id, [], { useLiveAi });
      const count = Array.isArray(created) ? created.length : (created?.length || 0);
      setAiMessage(count
        ? `Se generaron ${count} propuestas. Revise, apruebe las adecuadas y pulse Aplicar.`
        : 'No había operaciones incompletas para proponer.');
      await loadAiStatus();
    } catch (err) {
      setAiMessage(`Error al generar propuestas: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleProposeBindings() {
    try {
      setAiLoadingBindings(true);
      setAiMessage(null);
      const results = await codegenApi.proposeBindings(project.id, [], { useLiveAi });
      const entries = Array.isArray(results) ? results : results?.data || [];
      setAiMessage(`Vinculaciones válidas: ${entries.filter(entry => entry.valid).length}/${entries.length}. Revise las propuestas y sus bloqueos antes de aplicar.`);
      await loadAiStatus();
    } catch (err) {
      setAiMessage(`Error al vincular mockups: ${err.message}`);
    } finally {
      setAiLoadingBindings(false);
    }
  }

  async function handleReviewProposal(proposalId, status) {
    try {
      setAiLoading(true);
      await codegenApi.reviewProposal(project.id, { proposalId, status });
      await loadAiStatus();
    } catch (err) {
      setAiMessage(`Error al revisar propuesta: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleApplyProposals() {
    try {
      setAiLoading(true);
      const res = await codegenApi.applyApprovedProposals(project.id);
      const appliedCount = res?.appliedCount ?? res?.data?.appliedCount ?? 0;
      setAiMessage(appliedCount
        ? `Se aplicaron ${appliedCount} propuestas aprobadas a la especificación.`
        : 'No había propuestas aprobadas para aplicar. Apruebe al menos una y vuelva a intentar.');
      await loadPreview();
      await loadAiStatus();
    } catch (err) {
      setAiMessage(`Error al aplicar propuestas: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  }

  async function loadPreview() {
    try {
      setLoading(true);
      setError(null);
      const data = await codegenApi.getPreview(project.id, includeDocker);
      setGeneratedData(data);
      if (data?.files?.length > 0) {
        const hasCurrent = data.files.some(f => f.path === selectedFilePath);
        if (!hasCurrent) {
          const defaultFile = data.files.find(f => f.path.includes('docker-compose.yml') || f.path.includes('server.js')) || data.files[0];
          setSelectedFilePath(defaultFile.path);
        }
      }
    } catch (err) {
      console.error('Error al generar previsualización de código:', err);
      setError(err.message || 'Error al generar código');
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveSpec() {
    try {
      setApprovingSpec(true);
      setError(null);
      await codegenApi.approveSpecification(project.id);
      await loadPreview();
    } catch (err) {
      console.error('Error al aprobar especificación:', err);
      setError(err.message || 'Error al aprobar especificación');
    } finally {
      setApprovingSpec(false);
    }
  }

  async function handleDownload() {
    try {
      setDownloading(true);
      setError(null);
      const safeName = (project.name || 'proyecto').toLowerCase().replace(/[^a-z0-9]/g, '_');
      await codegenApi.downloadZip(project.id, includeDocker, `${safeName}-fullstack.zip`, activeJob?.id || null);
    } catch (err) {
      console.error('Error al descargar ZIP:', err);
      setError(err.message || 'Error al descargar archivo');
    } finally {
      setDownloading(false);
    }
  }

  function handleCopy() {
    if (!selectedFile?.content) return;
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const files = generatedData?.files || [];

  // Filtrado de archivos por búsqueda y por capa (Full-Stack / Frontend / Backend)
  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const matchesSearch = !searchFilter.trim() || f.path.toLowerCase().includes(searchFilter.toLowerCase());
      if (!matchesSearch) return false;

      if (stackFilter === 'backend') {
        return f.path.startsWith('backend/') || !f.path.includes('/');
      }
      if (stackFilter === 'frontend') {
        return f.path.startsWith('frontend/') || !f.path.includes('/');
      }
      return true;
    });
  }, [files, searchFilter, stackFilter]);

  const selectedFile = useMemo(() => {
    return files.find(f => f.path === selectedFilePath) || filteredFiles[0] || files[0] || null;
  }, [files, filteredFiles, selectedFilePath]);

  // Agrupación de archivos Full-Stack por carpetas
  const categorizedFiles = useMemo(() => {
    const rootFiles = [];
    const backendRootFiles = [];
    const backendModels = [];
    const backendMigrations = [];
    const backendControllers = [];
    const backendRoutes = [];
    const frontendRootFiles = [];
    const frontendPages = [];
    const frontendOrmPages = [];

    for (const f of filteredFiles) {
      if (f.path.startsWith('backend/src/models/')) backendModels.push(f);
      else if (f.path.startsWith('backend/src/migrations/')) backendMigrations.push(f);
      else if (f.path.startsWith('backend/src/controllers/')) backendControllers.push(f);
      else if (f.path.startsWith('backend/src/routes/')) backendRoutes.push(f);
      else if (f.path.startsWith('backend/')) backendRootFiles.push(f);
      else if (f.path.startsWith('frontend/src/pages/orm/')) frontendOrmPages.push(f);
      else if (f.path.startsWith('frontend/src/pages/')) frontendPages.push(f);
      else if (f.path.startsWith('frontend/')) frontendRootFiles.push(f);
      else rootFiles.push(f);
    }

    return { rootFiles, backendRootFiles, backendModels, backendMigrations, backendControllers, backendRoutes, frontendRootFiles, frontendPages, frontendOrmPages };
  }, [filteredFiles]);

  const stats = generatedData?.stats || {
    entitiesCount: project.entities?.length || 0,
    relationshipsCount: project.relationships?.length || 0,
    filesCount: files.length
  };

  const getFileIcon = (path) => {
    if (path.endsWith('.json')) return 'data_object';
    if (path.endsWith('.jsx')) return 'code_blocks';
    if (path.endsWith('.js')) return 'javascript';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.html')) return 'html';
    if (path.endsWith('.md')) return 'article';
    if (path.includes('docker') || path.includes('nginx')) return 'deployed_code';
    if (path.endsWith('.example') || path.endsWith('.env')) return 'tune';
    return 'description';
  };

  return (
    <div className="codegen-page" tabIndex={0} aria-label="Generación de código">
      {/* 1. Header de Acción y Configuración */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--outline-variant, rgba(0,0,0,0.08))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'var(--surface-container-low, #fff)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="ms ms-md" style={{ color: 'var(--primary, #0056b3)' }}>terminal</span>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Generador Full-Stack (Frontend + Backend + BD)</h2>
            <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.72rem', fontWeight: 600 }}>
              {activeJob?.ready ? 'Aplicación verificada' : 'Verificación pendiente'}
            </span>
          </div>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--on-surface-variant, #666)' }}>
            Genera una aplicación completa: Vistas React con formularios, API REST Express, ORM Sequelize y Docker.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.82rem' }}>
            <input type="checkbox" checked={useLiveAi} onChange={event => setUseLiveAi(event.target.checked)} />
            {' '}Usar IA para generar y conectar (consume tokens)
          </label>
          {/* Switch Docker */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={includeDocker}
              onChange={(e) => setIncludeDocker(e.target.checked)}
              disabled={loading}
              style={{ cursor: 'pointer' }}
            />
            <span>Incluir Docker</span>
          </label>

          {/* Botón Principal: Generar Código Asistido por IA */}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleStartGenerationJob}
            disabled={jobLoading || (activeJob && ['ANALYZING', 'GENERATING', 'VALIDATING', 'REPAIRING'].includes(activeJob.status))}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #0284c7 100%)',
              border: 'none',
              color: '#ffffff',
              fontWeight: 700,
              padding: '6px 14px',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.35)',
              cursor: 'pointer'
            }}
            title="Iniciar generación asistida por IA: analiza coherencia, pregunta decisiones, genera código, valida en entorno aislado y repara automáticamente"
          >
            <span className={`ms ms-xs ${jobLoading || (activeJob && ['ANALYZING', 'GENERATING', 'VALIDATING', 'REPAIRING'].includes(activeJob.status)) ? 'spin' : ''}`}>
              {activeJob && ['ANALYZING', 'GENERATING', 'VALIDATING', 'REPAIRING'].includes(activeJob.status) ? 'sync' : 'auto_fix_high'}
            </span>
            <span>
              {activeJob && ['ANALYZING', 'GENERATING', 'VALIDATING', 'REPAIRING'].includes(activeJob.status)
                ? `Generando (${activeJob.status})...`
                : activeJob?.status === 'INTERRUPTED' || (activeJob?.status === 'BLOCKED' && (activeJob.planningBlockers?.length > 0 || activeJob.stageMessage?.startsWith('Se alcanzó el presupuesto de tiempo o tokens.') ||
                    activeJob.verificationReport?.errors?.some(error => error.code === 'UNRESOLVED_ACCEPTANCE_SCENARIOS')))
                  ? 'Reanudar generación'
                  : useLiveAi ? 'Generar y conectar con IA' : 'Generar desde contratos'}
            </span>
          </button>

          {/* Botón Regenerar */}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadPreview}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Volver a generar el código desde los modelos aprobados"
          >
            <span className={`ms ms-xs ${loading ? 'spin' : ''}`}>sync</span>
            <span>{loading ? 'Generando...' : 'Previsualizar'}</span>
          </button>

          {/* Botón Asistente IA Operaciones & Mockups */}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => { setShowAiModal(true); loadAiStatus(); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderColor: '#6366f1', color: '#4f46e5', fontWeight: 600 }}
            title="Abrir Asistente IA para completar operaciones de negocio y conectar mockups de Stitch"
          >
            <span className="ms ms-xs">auto_awesome</span>
            <span>Completar con IA</span>
            {aiStatus?.incompleteOperations?.length > 0 && (
              <span style={{ background: '#fef3c7', color: '#b45309', borderRadius: '10px', padding: '1px 6px', fontSize: '0.7rem' }}>
                {aiStatus.incompleteOperations.length}
              </span>
            )}
          </button>

          {/* Botón Chat IA Asistente */}
          {onNavigateTo && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onNavigateTo('chat')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary, #0056b3)' }}
              title="Abrir Chat IA Asistente para dudas o diagnóstico de errores"
            >
              <span className="ms ms-xs">chat</span>
              <span>Chat IA</span>
            </button>
          )}

          {/* Botón Descargar ZIP */}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleDownload}
            disabled={downloading || loading || (activeJob ? !activeJob.zipSha256 || !['COMPLETED', 'BLOCKED'].includes(activeJob.status) : files.length === 0)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
          >
            <span className="ms ms-xs">download</span>
            <span>{downloading ? 'Descargando...' : activeJob?.ready ? 'Descargar aplicación verificada (.ZIP)' : 'Descargar paquete de revisión (.ZIP)'}</span>
          </button>
        </div>
      </div>

      {/* 2. Barra de Métricas y Filtros de Capa */}
      <div style={{
        padding: '6px 20px',
        background: 'var(--surface-container-lowest, #f8fafc)',
        borderBottom: '1px solid var(--outline-variant, rgba(0,0,0,0.06))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        fontSize: '0.78rem',
        color: 'var(--on-surface-variant, #64748b)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span>📦 <strong>{stats.entitiesCount}</strong> Entidades convertidas</span>
          <span>🔗 <strong>{stats.relationshipsCount}</strong> Relaciones</span>
          <span>📄 <strong>{files.length}</strong> Archivos totales</span>
          <span style={{ color: '#0284c7' }}>🎨 React 18 + Vite</span>
          <span style={{ color: '#16a34a' }}>⚙️ Express + Sequelize</span>
          {includeDocker && <span style={{ color: '#059669' }}>🐳 Docker listo (3 contenedores)</span>}
        </div>

        {/* Selector de visualización de capa */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#e2e8f0', borderRadius: '4px', padding: '2px' }}>
          <button
            type="button"
            onClick={() => setStackFilter('all')}
            style={{
              border: 'none',
              padding: '3px 8px',
              borderRadius: '3px',
              fontSize: '0.72rem',
              cursor: 'pointer',
              background: stackFilter === 'all' ? '#fff' : 'transparent',
              fontWeight: stackFilter === 'all' ? 600 : 400
            }}
          >
            Todo ({files.length})
          </button>
          <button
            type="button"
            onClick={() => setStackFilter('frontend')}
            style={{
              border: 'none',
              padding: '3px 8px',
              borderRadius: '3px',
              fontSize: '0.72rem',
              cursor: 'pointer',
              background: stackFilter === 'frontend' ? '#fff' : 'transparent',
              color: stackFilter === 'frontend' ? '#0284c7' : 'inherit',
              fontWeight: stackFilter === 'frontend' ? 600 : 400
            }}
          >
            🎨 Frontend
          </button>
          <button
            type="button"
            onClick={() => setStackFilter('backend')}
            style={{
              border: 'none',
              padding: '3px 8px',
              borderRadius: '3px',
              fontSize: '0.72rem',
              cursor: 'pointer',
              background: stackFilter === 'backend' ? '#fff' : 'transparent',
              color: stackFilter === 'backend' ? '#16a34a' : 'inherit',
              fontWeight: stackFilter === 'backend' ? 600 : 400
            }}
          >
            ⚙️ Backend
          </button>
        </div>
      </div>

      {/* 2.5 Panel de Pipeline Persistente Asistido por IA */}
      {/* ANALYZING -> WAITING_FOR_INPUT -> GENERATING -> VALIDATING -> REPAIRING -> COMPLETED */}
      {activeJob && (
        <div style={{
          background: '#ffffff',
          borderBottom: '2px solid #e2e8f0',
          padding: '14px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          {/* Stepper Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
              <span className="ms ms-sm" style={{ color: '#4f46e5' }}>auto_awesome</span>
              <strong style={{ fontSize: '0.92rem', color: '#1e293b' }}>
                Trabajo de Generación Asistida: {activeJob.id}
              </strong>
              <span className="badge" style={{
                background: activeJob.status === 'COMPLETED' ? '#dcfce7'
                  : activeJob.status === 'WAITING_FOR_INPUT' ? '#fef3c7'
                  : activeJob.status === 'BLOCKED' ? '#fee2e2'
                  : activeJob.status === 'FAILED' ? '#fee2e2'
                  : '#e0e7ff',
                color: activeJob.status === 'COMPLETED' ? '#15803d'
                  : activeJob.status === 'WAITING_FOR_INPUT' ? '#b45309'
                  : activeJob.status === 'BLOCKED' ? '#b91c1c'
                  : activeJob.status === 'FAILED' ? '#b91c1c'
                  : '#4338ca',
                fontWeight: 700,
                fontSize: '0.72rem',
                textTransform: 'uppercase'
              }}>
                {activeJob.status}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.78rem', color: '#64748b' }}>
              <span>Reintentos: <strong>{activeJob.metrics?.repairAttempts || 0} / {activeJob.budget?.maxRepairAttempts || 3}</strong></span>
              <span>Tokens IA: <strong>{activeJob.metrics?.totalTokens || 0}</strong></span>
              {['ANALYZING', 'GENERATING', 'VALIDATING', 'REPAIRING'].includes(activeJob.status) && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={handleCancelJob}
                  style={{ color: '#ef4444', fontSize: '0.72rem', cursor: 'pointer' }}
                >
                  Cancelar trabajo
                </button>
              )}
            </div>
          </div>

          {activeJob.batchReview && <p style={{ color: '#4338ca', fontSize: '0.82rem', marginBottom: '12px' }}>
            Revisión en lote: {activeJob.batchReview.phase === 'COMPLETE' ? 'terminada' : `${activeJob.batchReview.phase === 'SCREENS' ? 'pantallas' : 'operaciones'} ${activeJob.batchReview.completed}/${activeJob.batchReview.total}`}.
            {' '}{activeJob.batchReview.questions?.length || 0} aclaraciones reunidas; {activeJob.batchReview.blockers?.length || 0} contratos con fallos técnicos.
          </p>}
          {/* Stage Progress Stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {[
              { key: 'ANALYZING', label: '1. Análisis', icon: 'psychology' },
              { key: 'WAITING_FOR_INPUT', label: '2. Aclaraciones', icon: 'quiz' },
              { key: 'GENERATING', label: '3. Generación', icon: 'code' },
              { key: 'VALIDATING', label: '4. Validación', icon: 'fact_check' },
              { key: 'REPAIRING', label: '5. Reparación', icon: 'build' },
              { key: 'COMPLETED', label: '6. Verificado', icon: 'check_circle' }
            ].map((step, idx) => {
              const isCurrent = activeJob.status === step.key;
              const stageOrder = ['ANALYZING', 'WAITING_FOR_INPUT', 'GENERATING', 'VALIDATING', 'REPAIRING', 'COMPLETED'];
              const currentIdx = stageOrder.indexOf(activeJob.status);
              const isDone = currentIdx > idx || activeJob.status === 'COMPLETED';

              return (
                <div key={step.key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '16px',
                  background: isCurrent ? '#4f46e5' : isDone ? '#ecfdf5' : '#f1f5f9',
                  color: isCurrent ? '#ffffff' : isDone ? '#059669' : '#64748b',
                  fontSize: '0.74rem',
                  fontWeight: isCurrent || isDone ? 600 : 400
                }}>
                  <span className="ms ms-xs">{isDone ? 'check' : step.icon}</span>
                  <span>{step.label}</span>
                </div>
              );
            })}
          </div>

          {/* Progress Bar & Message */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#475569', marginBottom: '4px' }}>
              <span>{activeJob.stageMessage || 'Procesando...'}</span>
              <span><strong>{activeJob.progress || 0}%</strong></span>
            </div>
            <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${activeJob.progress || 0}%`,
                background: activeJob.status === 'COMPLETED' ? '#10b981' : activeJob.status === 'BLOCKED' ? '#ef4444' : '#4f46e5',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* Clarification Questions Card (when WAITING_FOR_INPUT) */}
          {['BLOCKED', 'WAITING_FOR_INPUT'].includes(activeJob.status) && activeJob.planningBlockers?.length > 0 && (
            <div role="alert" style={{ marginTop: '14px', padding: '16px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', color: '#9f1239' }}>
              <strong>La propuesta no pasó la validación del contrato.</strong>
              {activeJob.planningBlockers.map(blocker => (
                <div key={blocker.operationId}>
                  <p>{blocker.operationId}: {blocker.name}</p>
                  <ul>{(blocker.errors || []).map((message, index) => <li key={index}>{diagnosticText(message)}</li>)}</ul>
                </div>
              ))}
            </div>
          )}
          {activeJob.status === 'WAITING_FOR_INPUT' && activeJob.questions?.length > 0 && (
            <div style={{
              marginTop: '14px',
              padding: '16px',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span className="ms ms-md" style={{ color: '#d97706' }}>help_outline</span>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#92400e' }}>
                  Aclaración de Reglas de Negocio Requerida
                </h4>
              </div>

              {activeJob.questions.length > 1 && <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <button type="button" className="btn btn-primary btn-sm" disabled={submittingAnswer || !batchAnswers.length} onClick={handleSaveBatchAnswers}>Guardar respuestas del lote ({batchAnswers.length})</button>
                <span style={{ fontSize: '0.8rem' }}>Se guardan las respuestas completadas. Las demás quedan pendientes.</span>
              </div>}
              {activeJob.questions.map(q => (
                <div key={q.questionId} style={{ marginTop: '10px' }}>
                  {q.title && <h5 style={{ margin: '16px 0 8px', color: '#78350f', fontSize: '0.95rem' }}>{q.title}</h5>}
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.88rem', fontWeight: 600, color: '#78350f' }}>
                    {q.question}
                  </p>
                  {q.details?.length > 0 && (
                    <ol style={{ paddingLeft: '20px', color: '#78350f', fontSize: '0.85rem', lineHeight: 1.6 }}>
                      {q.details.map((detail, index) => <li key={index}>{diagnosticText(detail)}</li>)}
                    </ol>
                  )}

                  {q.requirementIds?.length > 0 && (
                    <div className="codegen-requirements" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#92400e' }}>Requisitos vinculados:</span>
                      {q.requirementIds.map(rId => (
                        <span key={rId} className="badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.7rem' }}>
                          {rId}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Opciones */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {(q.options || []).map(opt => (
                      <label key={opt.id} style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '8px 12px',
                        background: selectedOptions[q.questionId] === opt.id ? '#fef3c7' : '#ffffff',
                        border: `1px solid ${selectedOptions[q.questionId] === opt.id ? '#d97706' : '#e5e7eb'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.82rem'
                      }}>
                        <input
                          type="radio"
                          name={q.questionId}
                          checked={selectedOptions[q.questionId] === opt.id}
                          onChange={() => setSelectedOptions(prev => ({ ...prev, [q.questionId]: opt.id }))}
                          style={{ marginTop: '2px' }}
                        />
                        <div>
                          <span style={{ fontWeight: 600, color: '#1e293b' }}>{opt.label}</span>
                        </div>
                      </label>
                    ))}
                  </div>

                  {/* Respuesta Personalizada */}
                  {q.customAllowed && (
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#78350f', marginBottom: '4px' }}>
                        {q.options?.length ? 'O respuesta personalizada:' : 'Tu respuesta a los puntos anteriores:'}
                      </label>
                      <textarea
                        rows={3}
                        aria-label="Respuesta personalizada"
                        placeholder={q.customPlaceholder || 'Escribe tu regla personalizada...'}
                        value={customAnswers[q.questionId] || ''}
                        onChange={e => setCustomAnswers(prev => ({ ...prev, [q.questionId]: e.target.value }))}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          resize: 'vertical',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          fontSize: '0.82rem'
                        }}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleAnswerClarification(q.questionId)}
                    disabled={submittingAnswer || (!customAnswers[q.questionId]?.trim() && !selectedOptions[q.questionId])}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#d97706',
                      border: 'none',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <span className="ms ms-xs">check</span>
                    <span>{submittingAnswer ? 'Guardando decisión...' : activeJob.planningBlockers?.length > 0 ? 'Guardar decisión' : activeJob.questions.length > 1 ? 'Guardar respuesta' : 'Confirmar Decisión y Reanudar Generación'}</span>
                  </button>
                  {activeJob.planningBlockers?.length > 0 && (
                    <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#78350f' }}>
                      Se guardará tu respuesta. La IA no se reanudará automáticamente porque quedan tareas técnicas pendientes.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Verification Report Summary (when COMPLETED or in progress) */}
          {activeJob.verificationReport && (
            <div style={{ marginTop: '12px', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <strong style={{ color: activeJob.verificationReport.passed ? '#15803d' : '#b91c1c' }}>
                  {activeJob.verificationReport.passed ? '✅ Verificación Superada' : '⚠️ Verificación con Observaciones'}: {activeJob.verificationReport.scope}
                </strong>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => setShowLogs(!showLogs)}
                  style={{ fontSize: '0.72rem', cursor: 'pointer' }}
                >
                  {showLogs ? 'Ocultar bitácora' : `Ver bitácora (${activeJob.logs?.length || 0})`}
                </button>
              </div>

              {activeJob.status === 'BLOCKED' && activeJob.verificationReport.errors?.some(error => error.code === 'UNRESOLVED_ACCEPTANCE_SCENARIOS') && (
                <p style={{ margin: '8px 0', color: '#92400e' }}>
                  No se generaron pruebas de aceptación ejecutables. Pulsa Reanudar generación para completar los contratos y volver a verificar.
                  Las migraciones aprobadas no comprueban por sí solas que las funciones de negocio operen correctamente.
                </p>
              )}

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', color: '#64748b', fontSize: '0.75rem' }}>
                <span>Comprobaciones superadas: <strong>{activeJob.verificationReport.checks?.length || 0}</strong></span>
                {activeJob.verificationReport.screenshots?.length > 0 && (
                  <span>Capturas de navegador: <strong>{activeJob.verificationReport.screenshots.length}</strong> (desktop/mobile)</span>
                )}
              </div>

              {/* Live logs terminal if expanded */}
              {showLogs && activeJob.logs && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  background: '#0f172a',
                  color: '#38bdf8',
                  borderRadius: '4px',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.72rem',
                  lineHeight: 1.4
                }}>
                  {activeJob.logs.map((l, i) => (
                    <div key={i} style={{ color: l.level === 'ERROR' ? '#f87171' : l.level === 'WARN' ? '#fbbf24' : '#38bdf8' }}>
                      [{new Date(l.timestamp).toLocaleTimeString()}] {l.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Panel de Diagnóstico de Quality Gates y Estado de Especificación */}
      {generatedData?.diagnostics && generatedData.diagnostics.errors?.length > 0 && !loading ? (
        <div style={{
          padding: '16px 20px',
          background: (generatedData.files || []).length ? '#fffbeb' : '#fff1f2',
          borderBottom: `1px solid ${(generatedData.files || []).length ? '#fde68a' : '#fecdd3'}`,
          color: (generatedData.files || []).length ? '#92400e' : '#9f1239'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="ms ms-md" style={{ color: (generatedData.files || []).length ? '#d97706' : '#e11d48' }}>{(generatedData.files || []).length ? 'warning' : 'gpp_bad'}</span>
              <strong style={{ fontSize: '0.95rem' }}>
                {(generatedData.files || []).length
                  ? 'Paquete de revisión generado: quedan contratos pendientes'
                  : 'Generación Bloqueada por Validación de Calidad (Quality Gates)'}
              </strong>
              <span className="badge" style={{ background: (generatedData.files || []).length ? '#fef3c7' : '#ffe4e6', color: (generatedData.files || []).length ? '#b45309' : '#be123c', fontSize: '0.72rem', fontWeight: 700 }}>
                {generatedData.diagnostics.errors.length} {generatedData.diagnostics.errors.length === 1 ? 'observación' : 'observaciones'}
              </span>
            </div>
            {onNavigateTo && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => onNavigateTo('modeling')}
                  style={{ fontSize: '0.75rem', borderColor: '#e11d48', color: '#be123c' }}
                >
                  Ir a Modelos
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => onNavigateTo('requirements')}
                  style={{ fontSize: '0.75rem', borderColor: '#e11d48', color: '#be123c' }}
                >
                  Ir a Requisitos
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: showQualityGateErrors ? '1px dashed #fecdd3' : 'none', marginBottom: showQualityGateErrors ? '10px' : '0' }}>
            <span style={{ fontSize: '0.8rem', color: (generatedData.files || []).length ? '#92400e' : '#881337' }}>
              {quality.totals.operations} mensajes en {quality.counts.operations} operaciones; {quality.totals.screens} en {quality.counts.screens} pantallas; {quality.counts.requirements} requisitos sin comportamiento comprobado.
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setShowQualityGateErrors(!showQualityGateErrors)}
              style={{ color: '#be123c', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
            >
              {showQualityGateErrors ? 'Ocultar detalles' : `Ver ${quality.groups.length} elementos (${quality.total} detalles)`}
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleReviewAll} disabled={jobLoading || !useLiveAi || (activeJob && ['ANALYZING', 'GENERATING', 'VALIDATING', 'REPAIRING'].includes(activeJob.status))}>Revisar todo en lote</button>
            <span style={{ fontSize: '0.8rem' }}>Revisa todos los casos y reúne las aclaraciones pendientes en una sola lista.</span>
          </div>

          {showQualityGateErrors && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {quality.groups.map(group => (
                <details key={group.key} style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '6px', border: '1px solid #fda4af', fontSize: '0.82rem' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 700 }}>{group.element} · {group.issues.length} {group.issues.length === 1 ? 'detalle' : 'detalles'}</summary>
                  {group.issues.map((err, idx) => <div key={idx} style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#be123c' }}>[{err.code}]</span>
                    <span style={{ color: '#475569', fontWeight: 600 }}>Elemento: {err.element}</span>
                  </div>
                  <div style={{ color: '#0f172a' }}>{diagnosticText(err.message)}</div>
                  {err.action && (
                    <div style={{ marginTop: '4px', color: '#0284c7', fontSize: '0.78rem' }}>
                      💡 <strong>Acción necesaria:</strong> {diagnosticText(err.action)}
                    </div>
                  )}
                  </div>)}
                </details>
              ))}
            </div>
          )}
        </div>
      ) : generatedData?.ready && !loading ? (
        <div style={{
          padding: '8px 20px',
          background: generatedData.isApprovedSpec ? '#f0fdf4' : '#eff6ff',
          borderBottom: `1px solid ${generatedData.isApprovedSpec ? '#bbf7d0' : '#bfdbfe'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.82rem',
          color: generatedData.isApprovedSpec ? '#166534' : '#1e40af',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="ms ms-sm" style={{ color: generatedData.isApprovedSpec ? '#16a34a' : '#2563eb' }}>
              {generatedData.isApprovedSpec ? 'verified' : 'fact_check'}
            </span>
            <span>
              <strong>
                {generatedData.isApprovedSpec ? 'Especificación Común Aprobada (icase.spec.json):' : 'Previsualización de Especificación:'}
              </strong>{' '}
              {generatedData.isApprovedSpec
                ? 'Calidad validada sin errores bloqueantes. Línea base congelada.'
                : 'Calidad validada sin errores. Apruebe la especificación para congelar el Baseline y habilitar la descarga.'}
            </span>
            {generatedData.diagnostics?.coverage && (
              <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.72rem' }}>
                {generatedData.diagnostics.coverage.coveragePercentage}% Cobertura de Requisitos
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!generatedData.isApprovedSpec && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleApproveSpec}
                disabled={approvingSpec || loading}
                style={{ fontSize: '0.75rem', height: '28px', background: '#2563eb', borderColor: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Aprobar formalmente y congelar la especificación en ProjectBaseline"
              >
                <span className={`ms ms-xs ${approvingSpec ? 'spin' : ''}`}>gavel</span>
                <span>{approvingSpec ? 'Aprobando...' : 'Aprobar Especificación (Baseline)'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedFilePath('icase.spec.json')}
              style={{ background: 'none', border: 'none', color: generatedData.isApprovedSpec ? '#15803d' : '#2563eb', cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'underline' }}
            >
              Ver icase.spec.json
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilePath('openapi.json')}
              style={{ background: 'none', border: 'none', color: generatedData.isApprovedSpec ? '#15803d' : '#2563eb', cursor: 'pointer', fontSize: '0.78rem', textDecoration: 'underline' }}
            >
              Ver OpenAPI 3.0
            </button>
          </div>
        </div>
      ) : stats.entitiesCount === 0 && !loading ? (
        <div style={{
          padding: '14px 20px',
          background: '#eff6ff',
          borderBottom: '1px solid #bfdbfe',
          color: '#1e40af',
          fontSize: '0.86rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="ms ms-md" style={{ color: '#2563eb' }}>info</span>
            <div>
              <strong>Este proyecto aún no tiene entidades aprobadas en el modelo de datos.</strong>
              <div style={{ fontSize: '0.78rem', color: '#3b82f6', marginTop: '2px' }}>
                Para generar la aplicación Full-Stack ejecutable, primero aprueba las entidades en la sección de Modelado.
              </div>
            </div>
          </div>
          {onNavigateTo && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onNavigateTo('modeling')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span className="ms ms-xs">schema</span>
              <span>Ir a Modelado de Datos</span>
            </button>
          )}
        </div>
      ) : error ? (
        <div style={{
          padding: '10px 20px',
          background: '#fef2f2',
          borderBottom: '1px solid #fecaca',
          color: '#991b1b',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span className="ms ms-sm">error</span>
          <span>{error}</span>
        </div>
      ) : null}

      {/* 3. Área Principal: Explorador estilo IDE (2 Columnas) */}
      <div className="codegen-workspace">
        {/* Panel Izquierdo: Explorador de Archivos */}
        <div style={{
          width: '290px',
          minWidth: '240px',
          borderRight: '1px solid var(--outline-variant, rgba(0,0,0,0.08))',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface-container-low, #fafbfc)'
        }}>
          {/* Cabecera del explorador con filtro */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--outline-variant, rgba(0,0,0,0.06))' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Buscar archivo..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  width: '100%',
                  fontSize: '0.76rem',
                  padding: '4px 6px 4px 24px',
                  borderRadius: '4px',
                  border: '1px solid rgba(0,0,0,0.15)',
                  boxSizing: 'border-box'
                }}
              />
              <span className="ms ms-xs" style={{ position: 'absolute', left: '6px', top: '7px', color: '#94a3b8', fontSize: '13px' }}>
                search
              </span>
            </div>
          </div>

          {/* Lista de archivos en árbol */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 4px', fontSize: '0.78rem' }}>
            {files.length === 0 && !loading && (
              <div style={{ padding: '20px 10px', textAlign: 'center', color: '#94a3b8' }}>
                No hay archivos generados.
              </div>
            )}

            {/* Raíz (docker-compose, README, etc.) */}
            {categorizedFiles.rootFiles.map(file => (
              <div
                key={file.path}
                onClick={() => setSelectedFilePath(file.path)}
                style={{
                  padding: '5px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  background: selectedFilePath === file.path ? 'rgba(0, 86, 179, 0.1)' : 'transparent',
                  color: selectedFilePath === file.path ? 'var(--primary, #0056b3)' : 'inherit',
                  fontWeight: selectedFilePath === file.path ? 600 : 400
                }}
              >
                <span className="ms ms-xs" style={{ fontSize: '14px', color: '#64748b' }}>
                  {getFileIcon(file.path)}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.path}
                </span>
              </div>
            ))}

            {/* SECCIÓN FRONTEND */}
            {(stackFilter === 'all' || stackFilter === 'frontend') && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ padding: '4px 8px', fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="ms ms-xs" style={{ fontSize: '15px' }}>folder_open</span>
                  <span>🎨 frontend/</span>
                </div>

                <div style={{ paddingLeft: '12px' }}>
                  {categorizedFiles.frontendRootFiles.map(file => (
                    <div
                      key={file.path}
                      onClick={() => setSelectedFilePath(file.path)}
                      style={{
                        padding: '4px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        background: selectedFilePath === file.path ? 'rgba(0, 86, 179, 0.1)' : 'transparent',
                        color: selectedFilePath === file.path ? 'var(--primary, #0056b3)' : 'inherit',
                        fontWeight: selectedFilePath === file.path ? 600 : 400
                      }}
                    >
                      <span className="ms ms-xs" style={{ fontSize: '13px', color: '#64748b' }}>
                        {getFileIcon(file.path)}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.path.replace('frontend/', '')}
                      </span>
                    </div>
                  ))}

                  {/* pages/ (Pantallas Funcionales según Requerimientos y Mockups) */}
                  {categorizedFiles.frontendPages.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ padding: '3px 6px', fontWeight: 600, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="ms ms-xs" style={{ fontSize: '13px' }}>folder</span>
                        <span>src/pages/ (Módulos Funcionales)</span>
                      </div>
                      <div style={{ paddingLeft: '10px' }}>
                        {categorizedFiles.frontendPages.map(file => (
                          <div
                            key={file.path}
                            onClick={() => setSelectedFilePath(file.path)}
                            style={{
                              padding: '3px 6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              background: selectedFilePath === file.path ? 'rgba(0, 86, 179, 0.1)' : 'transparent',
                              color: selectedFilePath === file.path ? 'var(--primary, #0056b3)' : 'inherit',
                              fontWeight: selectedFilePath === file.path ? 600 : 400
                            }}
                          >
                            <span className="ms ms-xs" style={{ fontSize: '13px', color: '#0284c7' }}>
                              preview
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.path.replace('frontend/src/pages/', '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* pages/orm/ (Tablas de Datos ORM) */}
                  {categorizedFiles.frontendOrmPages.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ padding: '3px 6px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="ms ms-xs" style={{ fontSize: '13px' }}>folder</span>
                        <span>src/pages/orm/ (Tablas ORM)</span>
                      </div>
                      <div style={{ paddingLeft: '10px' }}>
                        {categorizedFiles.frontendOrmPages.map(file => (
                          <div
                            key={file.path}
                            onClick={() => setSelectedFilePath(file.path)}
                            style={{
                              padding: '3px 6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              background: selectedFilePath === file.path ? 'rgba(0, 86, 179, 0.1)' : 'transparent',
                              color: selectedFilePath === file.path ? 'var(--primary, #0056b3)' : 'inherit',
                              fontWeight: selectedFilePath === file.path ? 600 : 400
                            }}
                          >
                            <span className="ms ms-xs" style={{ fontSize: '13px', color: '#64748b' }}>
                              table_chart
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.path.replace('frontend/src/pages/orm/', '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECCIÓN BACKEND */}
            {(stackFilter === 'all' || stackFilter === 'backend') && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ padding: '4px 8px', fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="ms ms-xs" style={{ fontSize: '15px' }}>folder_open</span>
                  <span>⚙️ backend/</span>
                </div>

                <div style={{ paddingLeft: '12px' }}>
                  {categorizedFiles.backendRootFiles.map(file => (
                    <div
                      key={file.path}
                      onClick={() => setSelectedFilePath(file.path)}
                      style={{
                        padding: '4px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        background: selectedFilePath === file.path ? 'rgba(0, 86, 179, 0.1)' : 'transparent',
                        color: selectedFilePath === file.path ? 'var(--primary, #0056b3)' : 'inherit',
                        fontWeight: selectedFilePath === file.path ? 600 : 400
                      }}
                    >
                      <span className="ms ms-xs" style={{ fontSize: '13px', color: '#64748b' }}>
                        {getFileIcon(file.path)}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.path.replace('backend/', '')}
                      </span>
                    </div>
                  ))}

                  {/* models/ */}
                  {categorizedFiles.backendModels.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ padding: '3px 6px', fontWeight: 600, color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="ms ms-xs" style={{ fontSize: '13px' }}>folder</span>
                        <span>src/models/ (Sequelize)</span>
                      </div>
                      <div style={{ paddingLeft: '10px' }}>
                        {categorizedFiles.backendModels.map(file => (
                          <div
                            key={file.path}
                            onClick={() => setSelectedFilePath(file.path)}
                            style={{
                              padding: '3px 6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              background: selectedFilePath === file.path ? 'rgba(0, 86, 179, 0.1)' : 'transparent',
                              color: selectedFilePath === file.path ? 'var(--primary, #0056b3)' : 'inherit',
                              fontWeight: selectedFilePath === file.path ? 600 : 400
                            }}
                          >
                            <span className="ms ms-xs" style={{ fontSize: '13px', color: '#16a34a' }}>
                              schema
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.path.replace('backend/src/models/', '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* controllers/ */}
                  {categorizedFiles.backendControllers.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ padding: '3px 6px', fontWeight: 600, color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="ms ms-xs" style={{ fontSize: '13px' }}>folder</span>
                        <span>src/controllers/</span>
                      </div>
                      <div style={{ paddingLeft: '10px' }}>
                        {categorizedFiles.backendControllers.map(file => (
                          <div
                            key={file.path}
                            onClick={() => setSelectedFilePath(file.path)}
                            style={{
                              padding: '3px 6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              background: selectedFilePath === file.path ? 'rgba(0, 86, 179, 0.1)' : 'transparent',
                              color: selectedFilePath === file.path ? 'var(--primary, #0056b3)' : 'inherit',
                              fontWeight: selectedFilePath === file.path ? 600 : 400
                            }}
                          >
                            <span className="ms ms-xs" style={{ fontSize: '13px', color: '#16a34a' }}>
                              code
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.path.replace('backend/src/controllers/', '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* routes/ */}
                  {categorizedFiles.backendRoutes.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ padding: '3px 6px', fontWeight: 600, color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="ms ms-xs" style={{ fontSize: '13px' }}>folder</span>
                        <span>src/routes/</span>
                      </div>
                      <div style={{ paddingLeft: '10px' }}>
                        {categorizedFiles.backendRoutes.map(file => (
                          <div
                            key={file.path}
                            onClick={() => setSelectedFilePath(file.path)}
                            style={{
                              padding: '3px 6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              background: selectedFilePath === file.path ? 'rgba(0, 86, 179, 0.1)' : 'transparent',
                              color: selectedFilePath === file.path ? 'var(--primary, #0056b3)' : 'inherit',
                              fontWeight: selectedFilePath === file.path ? 600 : 400
                            }}
                          >
                            <span className="ms ms-xs" style={{ fontSize: '13px', color: '#d97706' }}>
                              alt_route
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.path.replace('backend/src/routes/', '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel Derecho: Visor de Código */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
          {/* Barra de cabecera del archivo seleccionado */}
          <div style={{
            padding: '8px 16px',
            background: '#1e293b',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#f8fafc',
            fontSize: '0.8rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span className="ms ms-xs" style={{ color: '#38bdf8' }}>
                {getFileIcon(selectedFile?.path || '')}
              </span>
              <span style={{ fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.2px' }}>
                {selectedFile?.path || 'Ningún archivo seleccionado'}
              </span>
              {selectedFile?.language && (
                <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '3px', background: 'rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                  {selectedFile.language.toUpperCase()}
                </span>
              )}
            </div>

            {selectedFile && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCopy}
                style={{
                  color: copied ? '#4ade80' : '#cbd5e1',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  fontSize: '0.75rem',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.05)'
                }}
                title="Copiar código al portapapeles"
              >
                <span className="ms ms-xs">{copied ? 'check' : 'content_copy'}</span>
                <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
              </button>
            )}
          </div>

          {/* Área de código con números de línea */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 16px' }}>
            {loading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '8px' }}>
                <span className="ms spin">sync</span>
                <span>Generando arquitectura Full-Stack (Frontend React + Backend Sequelize)...</span>
              </div>
            ) : selectedFile ? (
              <pre style={{
                margin: 0,
                fontFamily: '"Fira Code", "Cascadia Code", "Source Code Pro", Consolas, monospace',
                fontSize: '0.82rem',
                lineHeight: '1.6',
                color: '#e2e8f0',
                tabSize: 2,
                whiteSpace: 'pre'
              }}>
                <code>{selectedFile.content}</code>
              </pre>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                Selecciona un archivo del explorador para previsualizarlo.
              </div>
            )}
          </div>

          {/* Guía de ejecución en terminal al pie */}
          <div style={{
            padding: '6px 16px',
            background: '#020617',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            color: '#94a3b8',
            fontSize: '0.74rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="ms ms-xs" style={{ color: '#22c55e' }}>play_circle</span>
              <span>Ejecución: Descomprime el ZIP y ejecuta: <code>docker compose up --build -d</code></span>
              {onNavigateTo && (
                <button
                  type="button"
                  onClick={() => onNavigateTo('chat')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    cursor: 'pointer',
                    fontSize: '0.74rem',
                    textDecoration: 'underline',
                    padding: '0 4px',
                    marginLeft: '8px'
                  }}
                  title="Preguntar a la IA si surge algún error al ejecutar"
                >
                  ¿Error en terminal? Diagnosticar con Chat IA
                </button>
              )}
            </div>
            <span>Frontend: <code>:3005</code> | API: <code>:8085/api</code> | PostgreSQL: <code>:5435</code> <span style={{ opacity: 0.6 }}>(Configurable en .env)</span></span>
          </div>
        </div>
      </div>

      {/* Modal Asistente IA para Operaciones y Mockups */}
      {showAiModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            {/* Cabecera del Modal */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="ms ms-md" style={{ color: '#4f46e5' }}>auto_awesome</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#0f172a' }}>
                    Asistente de IA: Operaciones de Negocio & Conexión de Mockups
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                    Propone pasos ejecutables y vinculaciones para mockups de Stitch conforme al contrato versionado.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Mensajes de Estado */}
            {aiMessage && (
              <div style={{ padding: '10px 24px', background: '#eff6ff', color: '#1d4ed8', fontSize: '0.85rem', borderBottom: '1px solid #dbeafe' }}>
                {aiMessage}
              </div>
            )}

            {/* Cuerpo del Modal */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Acciones Generales de Generación de Propuestas */}
              <label><input type="checkbox" checked={useLiveAi} onChange={event => setUseLiveAi(event.target.checked)} /> Usar proveedor de IA configurado (consume tokens). Desmarcado: análisis local.</label>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleProposeOperations}
                  disabled={aiLoading || aiLoadingBindings}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span className="ms ms-xs">psychology</span>
                  <span>{aiLoading ? 'Generando pasos...' : 'Generar Pasos para Operaciones Incompletas'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleProposeBindings}
                  disabled={aiLoading || aiLoadingBindings}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderColor: '#6366f1', color: '#4f46e5' }}
                >
                  <span className="ms ms-xs">link</span>
                  <span>{aiLoadingBindings ? 'Vinculando mockups...' : 'Vincular Mockups Stitch a la API'}</span>
                </button>
              </div>

              {/* Sección 1: Operaciones Incompletas */}
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Operaciones Incompletas</span>
                  <span style={{ fontSize: '0.75rem', background: '#e2e8f0', padding: '2px 8px', borderRadius: '10px' }}>
                    {aiStatus?.incompleteOperations?.length || 0}
                  </span>
                </h4>
                {(!aiStatus?.incompleteOperations || aiStatus.incompleteOperations.length === 0) ? (
                  <p style={{ fontSize: '0.85rem', color: '#16a34a', margin: 0 }}>✓ Todas las operaciones tienen comportamiento ejecutable definido.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {aiStatus.incompleteOperations.map(op => (
                      <div key={op.operationId} style={{ padding: '10px 14px', border: '1px solid #fed7aa', background: '#fffbeb', borderRadius: '6px', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong>{op.name}</strong>
                          <span style={{ fontSize: '0.75rem', color: '#c2410c' }}>Sin pasos estructurados</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#7c2d12', marginTop: '4px' }}>
                          Ruta: <code>{op.route}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sección 2: Propuestas Generadas por la IA */}
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                  Propuestas de IA Registradas ({Object.keys(aiStatus?.proposals?.operations || {}).length + Object.keys(aiStatus?.proposals?.bindings || {}).length})
                </h4>

                {/* Propuestas de Operaciones */}
                {Object.values(aiStatus?.proposals?.operations || {}).map(entry => (
                  <div key={entry.id} style={{ marginBottom: '12px', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div>
                        <strong>{entry.proposal?.name || entry.operationId}</strong>
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: entry.status === 'APPROVED' ? '#dcfce7' : entry.status === 'REJECTED' ? '#fee2e2' : '#fef3c7',
                          color: entry.status === 'APPROVED' ? '#166534' : entry.status === 'REJECTED' ? '#991b1b' : '#9a3412',
                          fontWeight: 600
                        }}>
                          {entry.status} (v{entry.version})
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {entry.status !== 'APPROVED' && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleReviewProposal(entry.id, 'APPROVED')}
                            style={{ background: '#16a34a', color: '#fff', padding: '4px 10px', fontSize: '0.75rem' }}
                          >
                            ✓ Aprobar
                          </button>
                        )}
                        {entry.status !== 'REJECTED' && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleReviewProposal(entry.id, 'REJECTED')}
                            style={{ background: '#dc2626', color: '#fff', padding: '4px 10px', fontSize: '0.75rem' }}
                          >
                            ✗ Rechazar
                          </button>
                        )}
                      </div>
                    </div>

                    <p style={{ fontSize: '0.8rem', color: '#475569', margin: '4px 0' }}>
                      {entry.providerMetadata?.mode || 'ORIGEN NO REGISTRADO'} · {entry.providerMetadata?.provider || 'local'} · {entry.providerMetadata?.model || 'sin modelo'} · {entry.providerMetadata?.outcome || 'sin resultado'} · validación: {entry.providerMetadata?.validation || 'pendiente'}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#475569', margin: '4px 0' }}>
                      <em>{entry.proposal?.rationale}</em>
                    </p>

                    {/* Pasos Estructurados */}
                    {entry.proposal?.steps && entry.proposal.steps.length > 0 && (
                      <div style={{ marginTop: '8px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Pasos Propuestos:</div>
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8rem', color: '#1e293b' }}>
                          {entry.proposal.steps.map((st, sIdx) => (
                            <li key={sIdx}>
                              <strong>{st.action}</strong> en <code>{st.entity || 'Entidad'}</code>: {st.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}

                {/* Propuestas de Mockup Bindings */}
                {Object.values(aiStatus?.proposals?.bindings || {}).map(entry => (
                  <div key={entry.id} style={{ marginBottom: '12px', padding: '12px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div>
                        <strong>Vinculación Mockup: {entry.proposal?.title || entry.screenId}</strong>
                        <span style={{
                          marginLeft: '8px',
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: entry.status === 'APPROVED' ? '#dcfce7' : entry.status === 'REJECTED' ? '#fee2e2' : '#fef3c7',
                          color: entry.status === 'APPROVED' ? '#166534' : entry.status === 'REJECTED' ? '#991b1b' : '#9a3412',
                          fontWeight: 600
                        }}>
                          {entry.status} (v{entry.version})
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {entry.status !== 'APPROVED' && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleReviewProposal(entry.id, 'APPROVED')}
                            style={{ background: '#16a34a', color: '#fff', padding: '4px 10px', fontSize: '0.75rem' }}
                          >
                            ✓ Aprobar
                          </button>
                        )}
                        {entry.status !== 'REJECTED' && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleReviewProposal(entry.id, 'REJECTED')}
                            style={{ background: '#dc2626', color: '#fff', padding: '4px 10px', fontSize: '0.75rem' }}
                          >
                            ✗ Rechazar
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                      Fuentes de datos conectadas: {entry.proposal?.dataSources?.length || 0} | Tablas vinculadas: {entry.proposal?.tableBindings?.length || 0} | Formularios: {entry.proposal?.formBindings?.length || 0}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pie del Modal */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowAiModal(false)}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleApplyProposals}
                disabled={aiLoading}
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
              >
                <span className="ms ms-xs">done_all</span>
                <span>Aplicar Propuestas Aprobadas y Regenerar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
