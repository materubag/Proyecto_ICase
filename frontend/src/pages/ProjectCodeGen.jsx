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
  const [stackFilter, setStackFilter] = useState('all');
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoadingBindings, setAiLoadingBindings] = useState(false);
  const [aiMessage, setAiMessage] = useState(null);
  const [useLiveAi, setUseLiveAi] = useState(true);
  const [activeJob, setActiveJob] = useState(null);
  const [jobLoading, setJobLoading] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [customAnswers, setCustomAnswers] = useState({});
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showQualityGateErrors, setShowQualityGateErrors] = useState(false);
  const quality = useMemo(() => groupQualityIssues(generatedData?.diagnostics?.errors || []), [generatedData]);
  const batchAnswers = completedBatchAnswers(activeJob?.questions, selectedOptions, customAnswers);

  useEffect(() => {
    if (project?.id) {
      loadPreview();
      loadAiStatus();
      loadActiveJob();
    }
  }, [project?.id, includeDocker]);

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
          if (['COMPLETED', 'WAITING_FOR_INPUT', 'BLOCKED'].includes(job.status)) loadPreview();
        }
      } catch (_) {}
    }, 1500);
    return () => clearInterval(interval);
  }, [project?.id, activeJob?.status]);

  async function loadActiveJob() {
    try {
      const res = await codegenApi.getActiveJob(project.id);
      const job = (res && res.id) ? res : (res?.data || null);
      if (job) setActiveJob(job);
    } catch (_) {}
  }

  async function handleStartGenerationJob() {
    try {
      setJobLoading(true); setError(null);
      const res = await codegenApi.startGenerationJob(project.id, {
        scope: 'Requisitos, operaciones y pantallas del proyecto',
        maxRepairAttempts: 3, enableAI: useLiveAi, includeDocker
      });
      const job = (res && res.id) ? res : (res?.data || null);
      if (job) setActiveJob(job);
    } catch (err) {
      setError(err.message || 'Error al iniciar generación asistida');
    } finally { setJobLoading(false); }
  }

  async function handleAnswerClarification(questionId) {
    if (!activeJob?.id) return;
    try {
      setSubmittingAnswer(true); setError(null);
      const optId = selectedOptions[questionId];
      const custom = customAnswers[questionId];
      const q = (activeJob.questions || []).find(item => item.questionId === questionId);
      await codegenApi.submitJobInput(project.id, activeJob.id, {
        questionId, selectedOptionId: optId, customAnswer: custom, requirementIds: q?.requirementIds || []
      });
      const updated = await codegenApi.getActiveJob(project.id);
      const job = (updated && updated.id) ? updated : (updated?.data || null);
      if (job) setActiveJob(job);
    } catch (err) {
      setError(err.message || 'Error al registrar respuesta');
    } finally { setSubmittingAnswer(false); }
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
    } catch (err) { setError(err.message || 'No se pudo iniciar la revisión'); }
    finally { setJobLoading(false); }
  }

  async function handleSaveBatchAnswers() {
    if (!activeJob?.id || !batchAnswers.length) return;
    setSubmittingAnswer(true); setError(null);
    try {
      for (const answer of batchAnswers) await codegenApi.submitJobInput(project.id, activeJob.id, answer);
    } catch (err) { setError(err.message || 'Error al guardar respuestas'); }
    finally { await loadActiveJob(); setSubmittingAnswer(false); }
  }

  async function loadAiStatus() {
    try {
      const res = await codegenApi.getAiStatus(project.id);
      setAiStatus(res || null);
    } catch (err) { setAiMessage(`No se pudo cargar el estado: ${err.message}`); }
  }

  async function handleProposeOperations() {
    try {
      setAiLoading(true); setAiMessage(null);
      const created = await codegenApi.proposeOperations(project.id, [], { useLiveAi });
      const count = Array.isArray(created) ? created.length : (created?.length || 0);
      setAiMessage(count ? `Se generaron ${count} propuestas. Revise y apruebe las adecuadas.` : 'No había operaciones incompletas.');
      await loadAiStatus();
    } catch (err) { setAiMessage(`Error: ${err.message}`); }
    finally { setAiLoading(false); }
  }

  async function handleProposeBindings() {
    try {
      setAiLoadingBindings(true); setAiMessage(null);
      const results = await codegenApi.proposeBindings(project.id, [], { useLiveAi });
      const entries = Array.isArray(results) ? results : results?.data || [];
      setAiMessage(`Vinculaciones válidas: ${entries.filter(e => e.valid).length}/${entries.length}.`);
      await loadAiStatus();
    } catch (err) { setAiMessage(`Error: ${err.message}`); }
    finally { setAiLoadingBindings(false); }
  }

  async function handleReviewProposal(proposalId, status) {
    try {
      setAiLoading(true);
      await codegenApi.reviewProposal(project.id, { proposalId, status });
      await loadAiStatus();
    } catch (err) { setAiMessage(`Error: ${err.message}`); }
    finally { setAiLoading(false); }
  }

  async function handleApplyProposals() {
    try {
      setAiLoading(true);
      const res = await codegenApi.applyApprovedProposals(project.id);
      const appliedCount = res?.appliedCount ?? res?.data?.appliedCount ?? 0;
      setAiMessage(appliedCount ? `Se aplicaron ${appliedCount} propuestas.` : 'No había propuestas aprobadas.');
      await loadPreview(); await loadAiStatus();
    } catch (err) { setAiMessage(`Error: ${err.message}`); }
    finally { setAiLoading(false); }
  }

  async function loadPreview() {
    try {
      setLoading(true); setError(null);
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
      setError(err.message || 'Error al generar código');
    } finally { setLoading(false); }
  }

  async function handleApproveSpec() {
    try {
      setApprovingSpec(true); setError(null);
      await codegenApi.approveSpecification(project.id);
      await loadPreview();
    } catch (err) {
      setError(err.message || 'Error al aprobar especificación');
    } finally { setApprovingSpec(false); }
  }

  async function handleDownload() {
    try {
      setDownloading(true); setError(null);
      const safeName = (project.name || 'proyecto').toLowerCase().replace(/[^a-z0-9]/g, '_');
      await codegenApi.downloadZip(project.id, includeDocker, `${safeName}-fullstack.zip`, activeJob?.id || null);
    } catch (err) {
      setError(err.message || 'Error al descargar');
    } finally { setDownloading(false); }
  }

  function handleCopy() {
    if (!selectedFile?.content) return;
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const files = generatedData?.files || [];

  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const matchesSearch = !searchFilter.trim() || f.path.toLowerCase().includes(searchFilter.toLowerCase());
      if (!matchesSearch) return false;
      if (stackFilter === 'backend') return f.path.startsWith('backend/') || !f.path.includes('/');
      if (stackFilter === 'frontend') return f.path.startsWith('frontend/') || !f.path.includes('/');
      return true;
    });
  }, [files, searchFilter, stackFilter]);

  const selectedFile = useMemo(() => {
    return files.find(f => f.path === selectedFilePath) || filteredFiles[0] || files[0] || null;
  }, [files, filteredFiles, selectedFilePath]);

  const categorizedFiles = useMemo(() => {
    const rootFiles = [], backendRootFiles = [], backendModels = [], backendMigrations = [],
      backendControllers = [], backendRoutes = [], frontendRootFiles = [], frontendPages = [], frontendOrmPages = [];
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
    entitiesCount: activeJob?.bundleManifest?.entitiesCount || project.entities?.length || 0,
    relationshipsCount: activeJob?.bundleManifest?.relationshipsCount || project.relationships?.length || 0,
    filesCount: activeJob?.generatedFilesCount || files.length
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

  const isJobRunning = activeJob && ['ANALYZING', 'GENERATING', 'VALIDATING', 'REPAIRING'].includes(activeJob.status);
  const jobStatusColor = {
    COMPLETED: { bg: 'rgba(16,185,129,0.08)', color: '#059669' },
    WAITING_FOR_INPUT: { bg: 'rgba(245,158,11,0.08)', color: '#d97706' },
    BLOCKED: { bg: 'rgba(198,40,40,0.08)', color: '#c62828' },
    FAILED: { bg: 'rgba(198,40,40,0.08)', color: '#c62828' },
  };
  const jsc = jobStatusColor[activeJob?.status] || { bg: 'rgba(41,82,217,0.08)', color: '#2952d9' };

  const STEPS = [
    { key: 'ANALYZING', label: '1. Análisis' },
    { key: 'WAITING_FOR_INPUT', label: '2. Aclaraciones' },
    { key: 'GENERATING', label: '3. Generación' },
    { key: 'VALIDATING', label: '4. Validación' },
    { key: 'REPAIRING', label: '5. Reparación' },
    { key: 'COMPLETED', label: '6. Verificado' },
  ];
  const stageOrder = STEPS.map(s => s.key);

  // ── File tree helper ──────────────────────────────────────────────────────
  function FileItem({ file, indent = 0, icon, iconColor, labelTransform }) {
    const isSelected = selectedFilePath === file.path;
    const label = labelTransform ? labelTransform(file.path) : file.path;
    return (
      <div
        onClick={() => setSelectedFilePath(file.path)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '4px 8px', paddingLeft: `${8 + indent * 10}px`,
          borderRadius: '5px', cursor: 'pointer',
          background: isSelected ? 'rgba(41,82,217,0.08)' : 'transparent',
          color: isSelected ? 'var(--primary)' : 'var(--on-surface-variant)',
          fontWeight: isSelected ? 600 : 400,
          fontSize: '0.78rem',
          transition: 'background 0.1s',
        }}
      >
        <span className="ms ms-xs" style={{ fontSize: '13px', color: isSelected ? 'var(--primary)' : (iconColor || 'var(--outline)'), flexShrink: 0 }}>
          {icon || getFileIcon(file.path)}
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </div>
    );
  }

  function TreeSection({ label, color, children, indent = 0 }) {
    return (
      <div style={{ marginTop: '8px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '3px 8px', paddingLeft: `${8 + indent * 10}px`,
          fontSize: '0.72rem', fontWeight: 600,
          color: color || 'var(--secondary)',
          textTransform: 'uppercase', letterSpacing: '0.05em'
        }}>
          <span className="ms ms-xs" style={{ fontSize: '13px' }}>folder</span>
          {label}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="codegen-page" tabIndex={0} aria-label="Generación de código">

      {/* ── HEADER BAR ─────────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--border-default)',
        background: '#ffffff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '10px', flexShrink: 0
      }}>
        {/* Left: title */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="ms ms-sm" style={{ color: 'var(--primary)' }}>terminal</span>
            <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--on-surface)', letterSpacing: '-0.01em' }}>
              Generador Full-Stack
            </h2>
            <span style={{
              fontSize: '0.6875rem', fontWeight: 500, padding: '2px 8px',
              borderRadius: '999px',
              background: activeJob?.ready ? 'rgba(16,185,129,0.1)' : 'rgba(41,82,217,0.07)',
              color: activeJob?.ready ? '#059669' : 'var(--primary)'
            }}>
              {activeJob?.ready ? 'Verificada' : 'Pendiente'}
            </span>
          </div>
          <p style={{ margin: '1px 0 0', fontSize: '0.78rem', color: 'var(--outline)' }}>
            React · Express · Sequelize{includeDocker ? ' · Docker' : ''}
          </p>
        </div>

        {/* Right: controls + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Checkboxes */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: 'var(--secondary)', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={useLiveAi} onChange={e => setUseLiveAi(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
            Usar IA
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: 'var(--secondary)', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={includeDocker} onChange={e => setIncludeDocker(e.target.checked)} disabled={loading} style={{ accentColor: 'var(--primary)' }} />
            Docker
          </label>

          <div style={{ width: '1px', height: '20px', background: 'var(--border-default)' }} />

          {/* Generar */}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleStartGenerationJob}
            disabled={jobLoading || isJobRunning}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            title="Iniciar generación asistida por IA"
          >
            <span className={`ms ms-xs ${isJobRunning || jobLoading ? 'spin' : ''}`}>
              {isJobRunning ? 'sync' : 'auto_fix_high'}
            </span>
            <span>
              {isJobRunning
                ? 'Generando...'
                : activeJob?.status === 'INTERRUPTED' || (activeJob?.status === 'BLOCKED')
                  ? 'Reanudar'
                  : useLiveAi ? 'Generar con IA' : 'Generar'}
            </span>
          </button>

          {/* Previsualizar */}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadPreview}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <span className={`ms ms-xs ${loading ? 'spin' : ''}`}>sync</span>
            <span>{loading ? 'Cargando...' : 'Previsualizar'}</span>
          </button>

          {/* Completar con IA */}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => { setShowAiModal(true); loadAiStatus(); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <span className="ms ms-xs">auto_awesome</span>
            <span>Completar con IA</span>
            {aiStatus?.incompleteOperations?.length > 0 && (
              <span style={{
                background: 'rgba(245,158,11,0.12)', color: '#d97706',
                borderRadius: '999px', padding: '0 5px', fontSize: '0.6875rem', fontWeight: 600
              }}>
                {aiStatus.incompleteOperations.length}
              </span>
            )}
          </button>

          {/* Chat IA */}
          {onNavigateTo && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onNavigateTo('chat')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <span className="ms ms-xs">chat</span>
              <span>Chat IA</span>
            </button>
          )}

          <div style={{ width: '1px', height: '20px', background: 'var(--border-default)' }} />

          {/* Descargar */}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleDownload}
            disabled={downloading || loading || (activeJob ? !activeJob.zipSha256 || !['COMPLETED', 'BLOCKED'].includes(activeJob.status) : files.length === 0)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <span className="ms ms-xs">download</span>
            <span>{downloading ? 'Descargando...' : activeJob?.ready ? 'Descargar verificada (.ZIP)' : 'Descargar (.ZIP)'}</span>
          </button>
        </div>
      </div>

      {/* ── METRICS BAR ────────────────────────────────────────────────── */}
      <div style={{
        padding: '6px 20px',
        background: 'var(--surface-container-low)',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '8px', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--secondary)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="ms ms-xs" style={{ color: 'var(--outline)' }}>account_tree</span>
            <strong style={{ color: 'var(--on-surface)' }}>{stats.entitiesCount}</strong> entidades
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="ms ms-xs" style={{ color: 'var(--outline)' }}>link</span>
            <strong style={{ color: 'var(--on-surface)' }}>{stats.relationshipsCount}</strong> relaciones
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span className="ms ms-xs" style={{ color: 'var(--outline)' }}>description</span>
            <strong style={{ color: 'var(--on-surface)' }}>{files.length}</strong> archivos
          </span>
          <span style={{ color: '#0284c7', fontSize: '0.72rem', fontWeight: 500 }}>React 18 + Vite</span>
          <span style={{ color: '#16a34a', fontSize: '0.72rem', fontWeight: 500 }}>Express + Sequelize</span>
          {includeDocker && <span style={{ color: '#059669', fontSize: '0.72rem', fontWeight: 500 }}>Docker (3 contenedores)</span>}
        </div>

        {/* Stack filter */}
        <div className="seg-control">
          {[['all', `Todo (${files.length})`], ['frontend', 'Frontend'], ['backend', 'Backend']].map(([val, label]) => (
            <button
              key={val}
              type="button"
              className={`seg-btn ${stackFilter === val ? 'active' : ''}`}
              onClick={() => setStackFilter(val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── ACTIVE JOB PANEL ───────────────────────────────────────────── */}
      {activeJob && (
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-default)',
          background: '#ffffff', flexShrink: 0
        }}>
          {/* Job header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span className="ms ms-xs" style={{ color: 'var(--primary)' }}>auto_awesome</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                Trabajo de Generación Asistida
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--outline)' }}>
                {activeJob.id}
              </span>
              <span style={{
                fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px',
                borderRadius: '999px', background: jsc.bg, color: jsc.color,
                textTransform: 'uppercase'
              }}>
                {activeJob.status}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--secondary)' }}>
              <span>Reintentos: <strong style={{ color: 'var(--on-surface)' }}>{activeJob.metrics?.repairAttempts || 0} / {activeJob.budget?.maxRepairAttempts || 3}</strong></span>
              <span>Tokens IA: <strong style={{ color: 'var(--on-surface)' }}>{activeJob.metrics?.totalTokens || 0}</strong></span>
              {isJobRunning && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleCancelJob}
                  style={{ color: 'var(--error)', fontSize: '0.75rem' }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>

          {/* Batch review note */}
          {activeJob.batchReview && (
            <p style={{ fontSize: '0.78rem', color: 'var(--secondary)', marginBottom: '10px' }}>
              Revisión en lote:{' '}
              {activeJob.batchReview.phase === 'COMPLETE'
                ? 'terminada'
                : `${activeJob.batchReview.phase === 'SCREENS' ? 'pantallas' : 'operaciones'} ${activeJob.batchReview.completed}/${activeJob.batchReview.total}`}.
              {' '}{activeJob.batchReview.questions?.length || 0} aclaraciones reunidas;{' '}
              {activeJob.batchReview.blockers?.length || 0} contratos con fallos técnicos.
            </p>
          )}

          {/* Stage stepper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {STEPS.map((step, idx) => {
              const isCurrent = activeJob.status === step.key;
              const currentIdx = stageOrder.indexOf(activeJob.status);
              const isDone = currentIdx > idx || activeJob.status === 'COMPLETED';
              return (
                <div key={step.key} style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '3px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 500,
                  background: isCurrent ? 'var(--primary)' : isDone ? 'rgba(16,185,129,0.1)' : 'var(--surface-container-low)',
                  color: isCurrent ? '#ffffff' : isDone ? '#059669' : 'var(--secondary)',
                  transition: 'all 0.2s'
                }}>
                  <span className="ms ms-xs" style={{ fontSize: '12px' }}>{isDone ? 'check' : isCurrent ? 'sync' : 'radio_button_unchecked'}</span>
                  {step.label}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--secondary)', marginBottom: '4px' }}>
              <span>{activeJob.stageMessage || 'Procesando...'}</span>
              <strong style={{ color: 'var(--on-surface)' }}>{activeJob.progress || 0}%</strong>
            </div>
            <div style={{ height: '4px', background: 'var(--surface-container)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${activeJob.progress || 0}%`,
                background: activeJob.status === 'COMPLETED' ? '#10b981' : activeJob.status === 'BLOCKED' ? 'var(--error)' : 'var(--primary)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* Planning blockers */}
          {['BLOCKED', 'WAITING_FOR_INPUT'].includes(activeJob.status) && activeJob.planningBlockers?.length > 0 && (
            <div style={{
              marginTop: '10px', padding: '12px 14px',
              background: 'rgba(198,40,40,0.05)', border: '1px solid rgba(198,40,40,0.15)',
              borderRadius: '8px', color: 'var(--error)', fontSize: '0.8125rem'
            }}>
              <strong>La propuesta no pasó la validación del contrato.</strong>
              {activeJob.planningBlockers.map(blocker => (
                <div key={blocker.operationId} style={{ marginTop: '6px' }}>
                  <p style={{ fontWeight: 600, margin: '0 0 2px' }}>{blocker.operationId}: {blocker.name}</p>
                  <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.78rem' }}>
                    {(blocker.errors || []).map((msg, i) => <li key={i}>{diagnosticText(msg)}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Clarification questions */}
          {activeJob.status === 'WAITING_FOR_INPUT' && activeJob.questions?.length > 0 && (
            <div style={{
              marginTop: '10px', padding: '14px 16px',
              background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span className="ms ms-sm" style={{ color: '#d97706' }}>help_outline</span>
                <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#92400e' }}>
                  Aclaración de Reglas de Negocio
                </h4>
              </div>

              {activeJob.questions.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <button
                    type="button" className="btn btn-primary btn-sm"
                    disabled={submittingAnswer || !batchAnswers.length}
                    onClick={handleSaveBatchAnswers}
                  >
                    Guardar respuestas del lote ({batchAnswers.length})
                  </button>
                  <span style={{ fontSize: '0.78rem', color: 'var(--secondary)' }}>Las respuestas incompletas quedan pendientes.</span>
                </div>
              )}

              {activeJob.questions.map(q => (
                <div key={q.questionId} style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(245,158,11,0.15)' }}>
                  {q.title && (
                    <h5 style={{ margin: '0 0 6px', fontSize: '0.875rem', color: '#78350f', fontWeight: 600 }}>{q.title}</h5>
                  )}
                  <p style={{ margin: '0 0 8px', fontSize: '0.8125rem', fontWeight: 500, color: '#78350f' }}>{q.question}</p>

                  {q.details?.length > 0 && (
                    <ol style={{ paddingLeft: '18px', color: '#78350f', fontSize: '0.78rem', lineHeight: 1.6, marginBottom: '10px' }}>
                      {q.details.map((d, i) => <li key={i}>{diagnosticText(d)}</li>)}
                    </ol>
                  )}

                  {q.requirementIds?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.72rem', color: '#92400e' }}>Requisitos:</span>
                      {q.requirementIds.map(rId => (
                        <span key={rId} className="tag" style={{ background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)', color: '#92400e' }}>{rId}</span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                    {(q.options || []).map(opt => (
                      <label key={opt.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '8px',
                        padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
                        fontSize: '0.8125rem',
                        background: selectedOptions[q.questionId] === opt.id ? 'rgba(245,158,11,0.08)' : '#ffffff',
                        border: `1px solid ${selectedOptions[q.questionId] === opt.id ? '#d97706' : 'var(--border-default)'}`,
                        transition: 'all 0.12s'
                      }}>
                        <input
                          type="radio" name={q.questionId}
                          checked={selectedOptions[q.questionId] === opt.id}
                          onChange={() => setSelectedOptions(prev => ({ ...prev, [q.questionId]: opt.id }))}
                          style={{ marginTop: '2px', accentColor: '#d97706' }}
                        />
                        <span style={{ fontWeight: 500, color: 'var(--on-surface)' }}>{opt.label}</span>
                      </label>
                    ))}
                  </div>

                  {q.customAllowed && (
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#78350f', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                        {q.options?.length ? 'O respuesta personalizada' : 'Tu respuesta'}
                      </label>
                      <textarea
                        rows={3} aria-label="Respuesta personalizada"
                        placeholder={q.customPlaceholder || 'Escribe tu regla personalizada...'}
                        value={customAnswers[q.questionId] || ''}
                        onChange={e => setCustomAnswers(prev => ({ ...prev, [q.questionId]: e.target.value }))}
                        className="form-control"
                        style={{ minHeight: 'auto', fontSize: '0.8125rem' }}
                      />
                    </div>
                  )}

                  <button
                    type="button" className="btn btn-sm"
                    onClick={() => handleAnswerClarification(q.questionId)}
                    disabled={submittingAnswer || (!customAnswers[q.questionId]?.trim() && !selectedOptions[q.questionId])}
                    style={{ background: '#d97706', color: '#fff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                  >
                    <span className="ms ms-xs">check</span>
                    {submittingAnswer ? 'Guardando...' : activeJob.questions.length > 1 ? 'Guardar respuesta' : 'Confirmar y Reanudar'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Verification report */}
          {activeJob.verificationReport && (
            <div style={{
              marginTop: '10px', padding: '10px 14px', borderRadius: '6px',
              background: 'var(--surface-container-low)', border: '1px solid var(--border-default)',
              fontSize: '0.78rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <strong style={{ color: activeJob.verificationReport.passed ? '#059669' : '#c62828' }}>
                  {activeJob.verificationReport.passed ? '✓ Verificación Superada' : '⚠ Verificación con Observaciones'}:
                  {' '}{activeJob.verificationReport.scope}
                </strong>
                <button
                  type="button" className="btn btn-ghost btn-sm"
                  onClick={() => setShowLogs(!showLogs)}
                  style={{ fontSize: '0.72rem' }}
                >
                  {showLogs ? 'Ocultar bitácora' : `Ver bitácora (${activeJob.logs?.length || 0})`}
                </button>
              </div>

              {activeJob.status === 'BLOCKED' && activeJob.verificationReport.errors?.some(e => e.code === 'UNRESOLVED_ACCEPTANCE_SCENARIOS') && (
                <p style={{ margin: '6px 0', color: '#92400e', fontSize: '0.78rem' }}>
                  No se generaron pruebas de aceptación ejecutables. Pulsa Reanudar para completar los contratos.
                </p>
              )}

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', color: 'var(--secondary)', marginTop: '4px' }}>
                <span>Comprobaciones superadas: <strong style={{ color: 'var(--on-surface)' }}>{activeJob.verificationReport.checks?.length || 0}</strong></span>
                {activeJob.verificationReport.screenshots?.length > 0 && (
                  <span>Capturas de navegador: <strong style={{ color: 'var(--on-surface)' }}>{activeJob.verificationReport.screenshots.length}</strong> (desktop/mobile)</span>
                )}
              </div>

              {showLogs && activeJob.logs && (
                <div style={{
                  marginTop: '8px', padding: '8px 12px',
                  background: '#0f172a', color: '#38bdf8',
                  borderRadius: '4px', maxHeight: '140px', overflowY: 'auto',
                  fontFamily: 'var(--font-mono)', fontSize: '0.72rem', lineHeight: 1.4
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

      {/* ── ERROR ALERT BANNER ─────────────────────────────────────────── */}
      {error && (
        <div style={{
          padding: '10px 20px',
          background: 'rgba(239, 68, 68, 0.08)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#b91c1c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span className="ms ms-sm" style={{ color: '#dc2626' }}>error_outline</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
              {error.includes("Can't reach database") || error.includes("localhost:5433")
                ? "No se puede conectar a la base de datos PostgreSQL (puerto 5433). Ejecuta en terminal: docker compose up -d postgres"
                : error}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadPreview}
            style={{ fontSize: '0.72rem', borderColor: 'rgba(239,68,68,0.3)', color: '#b91c1c' }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── DIAGNOSTIC / SPEC BANNER ───────────────────────────────────── */}
      {generatedData?.diagnostics && generatedData.diagnostics.errors?.length > 0 && !loading ? (
        <div style={{
          padding: '10px 20px',
          background: (generatedData.files || []).length ? 'rgba(245,158,11,0.05)' : 'rgba(198,40,40,0.05)',
          borderBottom: `1px solid ${(generatedData.files || []).length ? 'rgba(245,158,11,0.2)' : 'rgba(198,40,40,0.15)'}`,
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="ms ms-sm" style={{ color: (generatedData.files || []).length ? '#d97706' : 'var(--error)' }}>
                {(generatedData.files || []).length ? 'warning' : 'gpp_bad'}
              </span>
              <strong style={{ fontSize: '0.875rem', color: (generatedData.files || []).length ? '#92400e' : 'var(--error)' }}>
                {(generatedData.files || []).length
                  ? 'Paquete de revisión — contratos pendientes'
                  : 'Generación bloqueada por Quality Gates'}
              </strong>
              <span className="badge badge-warning" style={{ fontSize: '0.6875rem' }}>
                {generatedData.diagnostics.errors.length} observaciones
              </span>
            </div>
            {onNavigateTo && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn btn-outline btn-sm" onClick={() => onNavigateTo('modeling')} style={{ fontSize: '0.75rem' }}>Ir a Modelos</button>
                <button className="btn btn-outline btn-sm" onClick={() => onNavigateTo('requirements')} style={{ fontSize: '0.75rem' }}>Ir a Requisitos</button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--secondary)', marginBottom: '8px' }}>
            <span>{quality.totals.operations} mensajes en {quality.counts.operations} operaciones; {quality.counts.requirements} requisitos sin cobertura.</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowQualityGateErrors(!showQualityGateErrors)} style={{ fontSize: '0.75rem' }}>
              {showQualityGateErrors ? 'Ocultar' : `Ver ${quality.groups.length} elementos`}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: showQualityGateErrors ? '10px' : '0' }}>
            <button className="btn btn-primary btn-sm" onClick={handleReviewAll}
              disabled={jobLoading || !useLiveAi || isJobRunning}>
              Revisar todo en lote
            </button>
            <span style={{ fontSize: '0.78rem', color: 'var(--secondary)' }}>Reúne aclaraciones pendientes en una sola lista.</span>
          </div>

          {showQualityGateErrors && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
              {quality.groups.map(group => (
                <details key={group.key} style={{
                  background: '#ffffff', padding: '10px 12px', borderRadius: '6px',
                  border: '1px solid var(--border-default)', fontSize: '0.8125rem'
                }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--on-surface)' }}>
                    {group.element} · {group.issues.length} {group.issues.length === 1 ? 'detalle' : 'detalles'}
                  </summary>
                  {group.issues.map((err, idx) => (
                    <div key={idx} style={{ padding: '8px 0', borderTop: '1px solid var(--border-default)', marginTop: '6px' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--error)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>[{err.code}]</span>
                        <span style={{ fontWeight: 500, color: 'var(--secondary)', fontSize: '0.78rem' }}>{err.element}</span>
                      </div>
                      <div style={{ color: 'var(--on-surface)', fontSize: '0.78rem' }}>{diagnosticText(err.message)}</div>
                      {err.action && (
                        <div style={{ marginTop: '4px', color: 'var(--primary)', fontSize: '0.72rem' }}>
                          <strong>Acción:</strong> {diagnosticText(err.action)}
                        </div>
                      )}
                    </div>
                  ))}
                </details>
              ))}
            </div>
          )}
        </div>
      ) : generatedData?.ready && !loading ? (
        <div style={{
          padding: '8px 20px',
          background: generatedData.isApprovedSpec ? 'rgba(16,185,129,0.05)' : 'rgba(41,82,217,0.05)',
          borderBottom: `1px solid ${generatedData.isApprovedSpec ? 'rgba(16,185,129,0.15)' : 'rgba(41,82,217,0.15)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: '0.8125rem', flexWrap: 'wrap', gap: '8px', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="ms ms-sm" style={{ color: generatedData.isApprovedSpec ? '#10b981' : 'var(--primary)' }}>
              {generatedData.isApprovedSpec ? 'verified' : 'fact_check'}
            </span>
            <span style={{ color: generatedData.isApprovedSpec ? '#059669' : 'var(--primary)' }}>
              <strong>{generatedData.isApprovedSpec ? 'Especificación aprobada · Baseline congelado' : 'Previsualización de Especificación:'}</strong>
              {!generatedData.isApprovedSpec && ' Calidad validada sin errores. Apruebe para congelar el Baseline.'}
            </span>
            {generatedData.diagnostics?.coverage && (
              <span className="badge badge-success" style={{ fontSize: '0.6875rem' }}>
                {generatedData.diagnostics.coverage.coveragePercentage}% cobertura
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {!generatedData.isApprovedSpec && (
              <button className="btn btn-primary btn-sm" onClick={handleApproveSpec} disabled={approvingSpec || loading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                <span className={`ms ms-xs ${approvingSpec ? 'spin' : ''}`}>gavel</span>
                {approvingSpec ? 'Aprobando...' : 'Aprobar Especificación'}
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedFilePath('icase.spec.json')}
              style={{ fontSize: '0.75rem', color: generatedData.isApprovedSpec ? '#059669' : 'var(--primary)' }}>
              icase.spec.json
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedFilePath('openapi.json')}
              style={{ fontSize: '0.75rem', color: generatedData.isApprovedSpec ? '#059669' : 'var(--primary)' }}>
              OpenAPI 3.0
            </button>
          </div>
        </div>
      ) : !error && stats.entitiesCount === 0 && !loading ? (
        <div style={{
          padding: '12px 20px',
          background: 'rgba(41,82,217,0.05)', borderBottom: '1px solid rgba(41,82,217,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="ms ms-sm" style={{ color: 'var(--primary)' }}>info</span>
            <div>
              <strong style={{ fontSize: '0.8125rem', color: 'var(--on-surface)' }}>Sin entidades aprobadas en el modelo de datos.</strong>
              <p style={{ margin: '1px 0 0', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                Aprueba las entidades en Modelado para generar la aplicación Full-Stack.
              </p>
            </div>
          </div>
          {onNavigateTo && (
            <button className="btn btn-primary btn-sm" onClick={() => onNavigateTo('modeling')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <span className="ms ms-xs">schema</span>Ir a Modelado
            </button>
          )}
        </div>
      ) : null}

      {/* ── IDE WORKSPACE ──────────────────────────────────────────────── */}
      <div className="codegen-workspace">

        {/* File Explorer */}
        <div style={{
          width: '260px', minWidth: '220px',
          borderRight: '1px solid var(--border-default)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--surface-container-low)'
        }}>
          {/* Search */}
          <div style={{ padding: '8px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
            <div className="search-bar">
              <span className="ms">search</span>
              <input
                type="text" placeholder="Buscar archivo..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
              />
            </div>
          </div>

          {/* File tree */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 4px', fontSize: '0.78rem' }}>
            {files.length === 0 && !loading && (
              <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--outline)', fontSize: '0.78rem' }}>
                Sin archivos generados
              </div>
            )}

            {/* Root files */}
            {categorizedFiles.rootFiles.map(file => (
              <FileItem key={file.path} file={file} />
            ))}

            {/* Frontend section */}
            {(stackFilter === 'all' || stackFilter === 'frontend') && (
              <TreeSection label="frontend/" color="#0284c7">
                <div style={{ paddingLeft: '8px' }}>
                  {categorizedFiles.frontendRootFiles.map(file => (
                    <FileItem key={file.path} file={file} indent={1} labelTransform={p => p.replace('frontend/', '')} />
                  ))}
                  {categorizedFiles.frontendPages.length > 0 && (
                    <TreeSection label="src/pages/" color="#0369a1" indent={1}>
                      <div style={{ paddingLeft: '8px' }}>
                        {categorizedFiles.frontendPages.map(file => (
                          <FileItem key={file.path} file={file} indent={2} icon="preview" iconColor="#0284c7"
                            labelTransform={p => p.replace('frontend/src/pages/', '')} />
                        ))}
                      </div>
                    </TreeSection>
                  )}
                  {categorizedFiles.frontendOrmPages.length > 0 && (
                    <TreeSection label="src/pages/orm/" color="var(--secondary)" indent={1}>
                      <div style={{ paddingLeft: '8px' }}>
                        {categorizedFiles.frontendOrmPages.map(file => (
                          <FileItem key={file.path} file={file} indent={2} icon="table_chart" iconColor="var(--outline)"
                            labelTransform={p => p.replace('frontend/src/pages/orm/', '')} />
                        ))}
                      </div>
                    </TreeSection>
                  )}
                </div>
              </TreeSection>
            )}

            {/* Backend section */}
            {(stackFilter === 'all' || stackFilter === 'backend') && (
              <TreeSection label="backend/" color="#16a34a">
                <div style={{ paddingLeft: '8px' }}>
                  {categorizedFiles.backendRootFiles.map(file => (
                    <FileItem key={file.path} file={file} indent={1} labelTransform={p => p.replace('backend/', '')} />
                  ))}
                  {categorizedFiles.backendModels.length > 0 && (
                    <TreeSection label="src/models/" color="#15803d" indent={1}>
                      <div style={{ paddingLeft: '8px' }}>
                        {categorizedFiles.backendModels.map(file => (
                          <FileItem key={file.path} file={file} indent={2} icon="schema" iconColor="#16a34a"
                            labelTransform={p => p.replace('backend/src/models/', '')} />
                        ))}
                      </div>
                    </TreeSection>
                  )}
                  {categorizedFiles.backendControllers.length > 0 && (
                    <TreeSection label="src/controllers/" color="#15803d" indent={1}>
                      <div style={{ paddingLeft: '8px' }}>
                        {categorizedFiles.backendControllers.map(file => (
                          <FileItem key={file.path} file={file} indent={2} icon="code" iconColor="#16a34a"
                            labelTransform={p => p.replace('backend/src/controllers/', '')} />
                        ))}
                      </div>
                    </TreeSection>
                  )}
                  {categorizedFiles.backendRoutes.length > 0 && (
                    <TreeSection label="src/routes/" color="#15803d" indent={1}>
                      <div style={{ paddingLeft: '8px' }}>
                        {categorizedFiles.backendRoutes.map(file => (
                          <FileItem key={file.path} file={file} indent={2} icon="alt_route" iconColor="#d97706"
                            labelTransform={p => p.replace('backend/src/routes/', '')} />
                        ))}
                      </div>
                    </TreeSection>
                  )}
                </div>
              </TreeSection>
            )}
          </div>
        </div>

        {/* Code Viewer */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
          {/* File tab bar */}
          <div style={{
            padding: '0 16px', background: '#1e293b',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            height: '36px', flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span className="ms ms-xs" style={{ color: '#38bdf8', fontSize: '14px' }}>
                {getFileIcon(selectedFile?.path || '')}
              </span>
              <span style={{ fontWeight: 500, fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedFile?.path || 'Ningún archivo seleccionado'}
              </span>
              {selectedFile?.language && (
                <span style={{ fontSize: '0.6875rem', padding: '1px 6px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', color: '#94a3b8', flexShrink: 0 }}>
                  {selectedFile.language.toUpperCase()}
                </span>
              )}
            </div>
            {selectedFile && (
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '3px 8px', fontSize: '0.72rem',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '4px', cursor: 'pointer',
                  color: copied ? '#4ade80' : '#cbd5e1',
                  transition: 'color 0.15s'
                }}
              >
                <span className="ms ms-xs">{copied ? 'check' : 'content_copy'}</span>
                {copied ? '¡Copiado!' : 'Copiar'}
              </button>
            )}
          </div>

          {/* Code area */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 18px' }}>
            {loading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', gap: '10px' }}>
                <span className="ms spin" style={{ color: '#38bdf8' }}>sync</span>
                <span style={{ fontSize: '0.8125rem' }}>Generando arquitectura Full-Stack...</span>
              </div>
            ) : selectedFile ? (
              <pre style={{
                margin: 0,
                fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
                fontSize: '0.8rem', lineHeight: '1.65',
                color: '#e2e8f0', tabSize: 2, whiteSpace: 'pre'
              }}>
                <code>{selectedFile.content}</code>
              </pre>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: '0.8125rem' }}>
                Selecciona un archivo del explorador para previsualizarlo.
              </div>
            )}
          </div>

          {/* Terminal footer */}
          <div style={{
            padding: '5px 16px', background: '#020617',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '8px', flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: '#64748b' }}>
              <span className="ms ms-xs" style={{ color: '#22c55e', fontSize: '13px' }}>play_circle</span>
              <span>Descomprime el ZIP y ejecuta: <code style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>docker compose up --build -d</code></span>
              {onNavigateTo && (
                <button
                  type="button" onClick={() => onNavigateTo('chat')}
                  style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.72rem', textDecoration: 'underline' }}
                >
                  ¿Error? Chat IA
                </button>
              )}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#475569' }}>
              Frontend: <code style={{ color: '#94a3b8' }}>:3005</code> · API: <code style={{ color: '#94a3b8' }}>:8085</code> · DB: <code style={{ color: '#94a3b8' }}>:5435</code>
            </span>
          </div>
        </div>
      </div>

      {/* ── AI OPERATIONS MODAL ───────────────────────────────────────── */}
      {showAiModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(11,23,48,0.35)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '12px',
            width: '100%', maxWidth: '860px', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-xl)', overflow: 'hidden'
          }}>
            {/* Modal header */}
            <div style={{
              padding: '14px 20px', borderBottom: '1px solid var(--border-default)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="ms ms-sm" style={{ color: 'var(--primary)' }}>auto_awesome</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                    Asistente IA — Operaciones y Mockups
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--secondary)' }}>
                    Propone pasos ejecutables y vinculaciones para mockups conforme al contrato versionado.
                  </p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowAiModal(false)}>
                <span className="ms ms-sm">close</span>
              </button>
            </div>

            {/* Status message */}
            {aiMessage && (
              <div className="alert alert-success" style={{ margin: 0, borderRadius: 0 }}>
                {aiMessage}
              </div>
            )}

            {/* Body */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Options + Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8125rem', color: 'var(--secondary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={useLiveAi} onChange={e => setUseLiveAi(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
                  Usar proveedor IA (consume tokens)
                </label>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary btn-sm" onClick={handleProposeOperations} disabled={aiLoading || aiLoadingBindings}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span className="ms ms-xs">psychology</span>
                    {aiLoading ? 'Generando...' : 'Generar pasos para operaciones'}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={handleProposeBindings} disabled={aiLoading || aiLoadingBindings}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span className="ms ms-xs">link</span>
                    {aiLoadingBindings ? 'Vinculando...' : 'Vincular Mockups a la API'}
                  </button>
                </div>
              </div>

              {/* Incomplete operations */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)' }}>Operaciones Incompletas</h4>
                  <span className="badge badge-neutral">{aiStatus?.incompleteOperations?.length || 0}</span>
                </div>
                {(!aiStatus?.incompleteOperations || aiStatus.incompleteOperations.length === 0) ? (
                  <p style={{ fontSize: '0.8125rem', color: '#059669', margin: 0 }}>✓ Todas las operaciones tienen comportamiento ejecutable.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {aiStatus.incompleteOperations.map(op => (
                      <div key={op.operationId} style={{
                        padding: '8px 12px', border: '1px solid var(--border-default)',
                        background: 'var(--surface-container-low)', borderRadius: '6px', fontSize: '0.8125rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong style={{ color: 'var(--on-surface)' }}>{op.name}</strong>
                          <span className="badge badge-warning" style={{ fontSize: '0.6875rem' }}>Sin pasos</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', marginTop: '2px' }}>
                          Ruta: <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-container)', padding: '1px 4px', borderRadius: '3px' }}>{op.route}</code>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Proposals */}
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                  Propuestas de IA ({Object.keys(aiStatus?.proposals?.operations || {}).length + Object.keys(aiStatus?.proposals?.bindings || {}).length})
                </h4>
                {[...Object.values(aiStatus?.proposals?.operations || {}), ...Object.values(aiStatus?.proposals?.bindings || {})].map(entry => {
                  const isBinding = !!entry.proposal?.dataSources;
                  const statusColors = {
                    APPROVED: { bg: 'rgba(16,185,129,0.08)', color: '#059669' },
                    REJECTED: { bg: 'rgba(198,40,40,0.08)', color: 'var(--error)' },
                  };
                  const sc = statusColors[entry.status] || { bg: 'rgba(245,158,11,0.08)', color: '#d97706' };
                  return (
                    <div key={entry.id} style={{
                      marginBottom: '8px', padding: '12px 14px',
                      border: '1px solid var(--border-default)', borderRadius: '8px', background: '#ffffff'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ fontSize: '0.8125rem', color: 'var(--on-surface)' }}>
                            {isBinding ? `Mockup: ${entry.proposal?.title || entry.screenId}` : (entry.proposal?.name || entry.operationId)}
                          </strong>
                          <span style={{ fontSize: '0.6875rem', padding: '2px 7px', borderRadius: '999px', background: sc.bg, color: sc.color, fontWeight: 600 }}>
                            {entry.status} v{entry.version}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {entry.status !== 'APPROVED' && (
                            <button className="btn btn-sm" onClick={() => handleReviewProposal(entry.id, 'APPROVED')}
                              style={{ background: '#059669', color: '#fff', border: 'none', fontSize: '0.72rem', padding: '3px 8px' }}>
                              ✓ Aprobar
                            </button>
                          )}
                          {entry.status !== 'REJECTED' && (
                            <button className="btn btn-sm" onClick={() => handleReviewProposal(entry.id, 'REJECTED')}
                              style={{ background: 'var(--error)', color: '#fff', border: 'none', fontSize: '0.72rem', padding: '3px 8px' }}>
                              ✗ Rechazar
                            </button>
                          )}
                        </div>
                      </div>
                      {entry.proposal?.rationale && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--secondary)', margin: '0 0 4px', fontStyle: 'italic' }}>{entry.proposal.rationale}</p>
                      )}
                      {isBinding && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
                          Fuentes: {entry.proposal?.dataSources?.length || 0} · Tablas: {entry.proposal?.tableBindings?.length || 0} · Formularios: {entry.proposal?.formBindings?.length || 0}
                        </div>
                      )}
                      {!isBinding && entry.proposal?.steps?.length > 0 && (
                        <div style={{ marginTop: '6px', background: 'var(--surface-container-low)', padding: '8px 10px', borderRadius: '5px' }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pasos propuestos</div>
                          <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--on-surface)' }}>
                            {entry.proposal.steps.map((st, sIdx) => (
                              <li key={sIdx}><strong>{st.action}</strong> en <code style={{ fontFamily: 'var(--font-mono)' }}>{st.entity || 'Entidad'}</code>: {st.description}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 20px', borderTop: '1px solid var(--border-default)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <button className="btn btn-outline btn-md" onClick={() => setShowAiModal(false)}>Cerrar</button>
              <button className="btn btn-primary btn-md" onClick={handleApplyProposals} disabled={aiLoading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#059669', borderColor: '#059669' }}>
                <span className="ms ms-xs">done_all</span>
                Aplicar propuestas aprobadas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
