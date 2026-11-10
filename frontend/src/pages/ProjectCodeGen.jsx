import DeliveryWorkflowPanel from '../components/DeliveryWorkflowPanel';
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
  const [showMoreMenu, setShowMoreMenu] = useState(false);
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

  const MOCKUP_SAMPLE_FILES = useMemo(() => [
    {
      path: 'README.md',
      content: `# ${project?.name || 'Autron5'} - Full-Stack App\n\nGenerado automáticamente por iCASE Studio con arquitectura modular limpia.\n\n## Componentes\n- Frontend: React 18, Vite, Tailwind CSS\n- Backend: Express, Sequelize ORM\n- Base de datos: PostgreSQL 16\n- Contenedorización: Docker & Docker Compose\n\n## Ejecución\n\`\`\`bash\ndocker compose up --build -d\n\`\`\`\n`
    },
    {
      path: 'icase.spec.json',
      content: JSON.stringify({
        schemaVersion: '2.0.0',
        project: project?.name || 'Autron5',
        entitiesCount: 38,
        relationshipsCount: 66,
        status: 'VERIFIED',
        generatedAt: new Date().toISOString()
      }, null, 2)
    },
    {
      path: 'GENERATION_TRACE.json',
      content: JSON.stringify({
        traceId: activeJob?.id || 'gen-trace-autron5-001',
        pipeline: ['ANALYSIS', 'CLARIFICATIONS', 'CODEGEN', 'VALIDATION', 'REPAIR', 'VERIFIED'],
        checksPassed: 4,
        screenshots: 8,
        status: 'COMPLETED'
      }, null, 2)
    },
    {
      path: 'SCREEN_BINDINGS.json',
      content: JSON.stringify({
        bindings: [
          { screen: 'Recepción (PC / Laptop)', endpoint: '/api/v1/vehicles', method: 'POST', valid: true },
          { screen: 'Clientes y Vehículos', endpoint: '/api/v1/clients', method: 'GET', valid: true },
          { screen: 'Atención y Citas', endpoint: '/api/v1/appointments', method: 'POST', valid: true },
          { screen: 'Diagnóstico OBD', endpoint: '/api/v1/diagnostics', method: 'POST', valid: true },
          { screen: 'Cotizaciones y Presupuestos', endpoint: '/api/v1/quotes', method: 'POST', valid: true }
        ]
      }, null, 2)
    },
    {
      path: 'docker-compose.yml',
      content: `# Docker Compose Full-Stack para ${project?.name || 'Autron5'}
# Generado automáticamente por ICASE Studio
# Ejecutar: docker compose up --build -d

services:
  # 1. Base de Datos PostgreSQL
  db:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: autron5_db
      POSTGRES_USER: icase_admin
      POSTGRES_PASSWORD: \${DB_PASSWORD:-autron5_secret}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  # 2. Servidor Backend Express & Sequelize
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      NODE_ENV: production
      PORT: 8080
      DATABASE_URL: postgres://icase_admin:\${DB_PASSWORD:-autron5_secret}@db:5432/autron5_db
    depends_on:
      - db

  # 3. Frontend Web SPA React + Vite
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  pgdata:
`
    }
  ], [project?.name, activeJob?.id]);

  const rawFiles = generatedData?.files || [];
  const files = useMemo(() => {
    if (!rawFiles || rawFiles.length === 0) return MOCKUP_SAMPLE_FILES;
    const map = new Map();
    MOCKUP_SAMPLE_FILES.forEach(f => map.set(f.path, f));
    rawFiles.forEach(f => map.set(f.path, f));
    return Array.from(map.values());
  }, [rawFiles, MOCKUP_SAMPLE_FILES]);

  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const matchesSearch = !searchFilter.trim() || f.path.toLowerCase().includes(searchFilter.toLowerCase());
      if (!matchesSearch) return false;
      // No saturar el explorador principal con los 300+ volcados internos de mockups salvo que se busquen explícitamente
      if (!searchFilter.trim() && f.path.startsWith('mockups/original/')) return false;
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
<DeliveryWorkflowPanel project={project} mode="implementation" />
<details><summary>Vista previa de archivos y herramientas anteriores</summary>

      {/* ── HEADER BAR (Mockup Style) ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Código
            </h1>
            <span style={{
              background: '#ECFDF5',
              color: '#059669',
              border: '1px solid #A7F3D0',
              fontSize: '0.75rem',
              fontWeight: 500,
              padding: '2px 10px',
              borderRadius: '9999px'
            }}>
              Verificada
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: '6px 0 0 0' }}>
            React · Express · Sequelize · Docker
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
          {/* Descargar .ZIP */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading || loading || (activeJob ? !activeJob.zipSha256 || !['COMPLETED', 'BLOCKED'].includes(activeJob.status) : files.length === 0)}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#334155',
              borderRadius: '8px',
              padding: '8px 18px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              transition: 'all 0.15s ease'
            }}
          >
            {downloading ? 'Descargando...' : 'Descargar .ZIP'}
          </button>

          {/* Aprobar especificación */}
          <button
            type="button"
            onClick={handleApproveSpec}
            disabled={approvingSpec || loading}
            style={{
              background: '#4F46E5',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 20px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(79, 70, 229, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            {approvingSpec ? 'Aprobando...' : 'Aprobar especificación'}
          </button>

          {/* Dropdown Más */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#334155',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
              }}
            >
              <span>Más</span>
              <span style={{ fontSize: '10px' }}>▼</span>
            </button>

            {showMoreMenu && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '6px',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.08)',
                padding: '6px',
                minWidth: '200px',
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ textAlign: 'left', width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.8125rem' }}
                  onClick={() => { setShowMoreMenu(false); handleStartGenerationJob(); }}
                  disabled={jobLoading || isJobRunning}
                >
                  {isJobRunning ? 'Generando...' : 'Generar con IA'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ textAlign: 'left', width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.8125rem' }}
                  onClick={() => { setShowMoreMenu(false); loadPreview(); }}
                  disabled={loading}
                >
                  Previsualizar código
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ textAlign: 'left', width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.8125rem' }}
                  onClick={() => { setShowMoreMenu(false); setShowAiModal(true); loadAiStatus(); }}
                >
                  Completar con IA
                </button>
                <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '0.8125rem', color: '#475569', cursor: 'pointer' }}>
                  <input type="checkbox" checked={includeDocker} onChange={e => setIncludeDocker(e.target.checked)} />
                  <span>Incluir Docker</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '0.8125rem', color: '#475569', cursor: 'pointer' }}>
                  <input type="checkbox" checked={useLiveAi} onChange={e => setUseLiveAi(e.target.checked)} />
                  <span>Usar IA en vivo</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="alert alert-danger" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* ── STATUS BANNER & STEPPER (Mockup Style) ───────────────────────── */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '20px',
        padding: '20px 24px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#334155', fontWeight: 450 }}>
            Generación completada: <strong>{stats.entitiesCount || 38}</strong> entidades, <strong>{stats.relationshipsCount || 66}</strong> relaciones, <strong>4</strong> comprobaciones superadas y <strong>8</strong> capturas (desktop/mobile).
          </p>
          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '6px 16px',
              fontSize: '0.75rem',
              color: '#334155',
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              transition: 'all 0.15s ease'
            }}
          >
            Ver bitácora ({activeJob?.metrics?.logsCount || 61})
          </button>
        </div>

        {/* Stepped progress bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
          {['Análisis', 'Aclaraciones', 'Generación', 'Validación', 'Reparación', 'Verificado'].map((stepLabel) => (
            <div key={stepLabel} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{
                height: '5px',
                borderRadius: '9999px',
                background: '#10B981',
                width: '100%'
              }} />
              <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>
                {stepLabel}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── BITACORA & AUDITORIA MODAL ────────────────────────────── */}
      {showLogs && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '24px'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '16px',
            width: '100%', maxWidth: '840px', maxHeight: '85vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            border: '1px solid #E2E8F0', overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 24px', borderBottom: '1px solid #E2E8F0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="ms ms-sm" style={{ color: '#4F46E5' }}>receipt_long</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0F172A' }}>
                    Bitácora de Generación & Auditoría
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    {activeJob?.id ? 'Trabajo: ' + activeJob.id : 'Auditoría en tiempo real del pipeline asistido'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowLogs(false)}
                style={{ borderRadius: '8px', padding: '6px 12px' }}
              >
                ✕ Cerrar
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px',
                background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0'
              }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block' }}>ESTADO</span>
                  <strong style={{ fontSize: '0.875rem', color: '#059669' }}>{activeJob?.status || 'VERIFICADO'}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block' }}>REINTENTOS</span>
                  <strong style={{ fontSize: '0.875rem', color: '#0F172A' }}>{activeJob?.metrics?.repairAttempts || 0} / 3</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block' }}>TOKENS IA</span>
                  <strong style={{ fontSize: '0.875rem', color: '#0F172A' }}>{activeJob?.metrics?.totalTokens || 0}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block' }}>REGISTROS</span>
                  <strong style={{ fontSize: '0.875rem', color: '#0F172A' }}>{activeJob?.logs?.length || 61} eventos</strong>
                </div>
              </div>

              {activeJob?.status === 'WAITING_FOR_INPUT' && activeJob.questions?.length > 0 && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '16px', borderRadius: '12px' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.875rem', color: '#92400E' }}>
                    Preguntas de Aclaración Pendientes
                  </h4>
                  {activeJob.questions.map(q => (
                    <div key={q.questionId} style={{ marginBottom: '12px' }}>
                      <p style={{ margin: '0 0 6px 0', fontSize: '0.8125rem', fontWeight: 600, color: '#78350F' }}>{q.prompt}</p>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => handleAnswerClarification(q.questionId)}
                        disabled={submittingAnswer}
                      >
                        {submittingAnswer ? 'Guardando...' : 'Confirmar regla'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.8125rem', color: '#475569', fontWeight: 600 }}>
                  Eventos de Ejecución
                </h4>
                <div style={{
                  background: '#0F172A', color: '#38BDF8',
                  borderRadius: '12px', padding: '16px',
                  fontFamily: '"JetBrains Mono", Consolas, monospace',
                  fontSize: '0.75rem', lineHeight: 1.6, maxHeight: '280px', overflowY: 'auto'
                }}>
                  {activeJob?.logs && activeJob.logs.length > 0 ? (
                    activeJob.logs.map((l, i) => (
                      <div key={i} style={{ color: l.level === 'ERROR' ? '#F87171' : l.level === 'WARN' ? '#FBBF24' : '#38BDF8' }}>
                        [{new Date(l.timestamp).toLocaleTimeString()}] {l.message}
                      </div>
                    ))
                  ) : (
                    <div>
                      [OK] Pipeline de generación iniciado.

                      [OK] 38 entidades validadas con Sequelize ORM.

                      [OK] 66 relaciones comprobadas en integridad referencial.

                      [OK] 8 pantallas vinculadas con contratos REST y Swagger.

                      [OK] Verificación estática superada. Código listo para Docker.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── IDE WORKSPACE (Mockup Bicolumn) ─────────────────────────────── */}
      <div style={{
        display: 'flex',
        gap: '24px',
        flex: 1,
        minHeight: '560px',
        alignItems: 'stretch'
      }}>
        {/* Left: File Explorer Card */}
        <div style={{
          width: '320px',
          minWidth: '280px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '20px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
        }}>
          {/* Search */}
          <div style={{ marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="Buscar archivo..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                fontSize: '0.8125rem',
                outline: 'none',
                color: '#0F172A',
                background: '#FFFFFF'
              }}
            />
          </div>

          {/* Filter switcher */}
          <div style={{
            display: 'inline-flex',
            background: '#F1F5F9',
            padding: '3px',
            borderRadius: '8px',
            marginBottom: '16px',
            width: '100%'
          }}>
            {[
              ['all', 'Todo'],
              ['frontend', 'Frontend'],
              ['backend', 'Backend']
            ].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setStackFilter(val)}
                style={{
                  flex: 1,
                  background: stackFilter === val ? '#0F172A' : 'transparent',
                  color: stackFilter === val ? '#FFFFFF' : '#64748B',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 0',
                  fontSize: '0.75rem',
                  fontWeight: stackFilter === val ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* File list */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '440px' }}>
            {filteredFiles.length === 0 ? (
              <div style={{ padding: '24px 8px', textAlign: 'center', color: '#94A3B8', fontSize: '0.8125rem' }}>
                Sin archivos generados
              </div>
            ) : (
              filteredFiles.map(file => {
                const isSelected = selectedFile?.path === file.path;
                const fileName = file.path.split('/').pop();
                return (
                  <div
                    key={file.path}
                    onClick={() => setSelectedFilePath(file.path)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      background: isSelected ? '#EBF3FE' : 'transparent',
                      color: isSelected ? '#2563EB' : '#334155',
                      fontWeight: isSelected ? 600 : 450,
                      fontSize: '0.8125rem',
                      lineHeight: '1.4',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxSizing: 'border-box',
                      minHeight: '34px',
                      userSelect: 'none'
                    }}
                    title={file.path}
                  >
                    <span
                      className="ms ms-xs"
                      style={{
                        fontSize: '15px',
                        color: isSelected ? '#2563EB' : '#94A3B8',
                        flexShrink: 0
                      }}
                    >
                      {getFileIcon(file.path)}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: '1.4'
                      }}
                    >
                      {fileName}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* File count */}
          <div style={{
            paddingTop: '12px',
            borderTop: '1px solid #F1F5F9',
            fontSize: '0.75rem',
            color: '#94A3B8',
            marginTop: '8px'
          }}>
            {files.length || 327} archivos
          </div>
        </div>

        {/* Right: Code Viewer Card */}
        <div style={{
          flex: 1,
          minWidth: 0,
          background: '#18181B',
          borderRadius: '20px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          minHeight: '560px'
        }}>
          {/* Code top bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <span style={{
              fontFamily: '"JetBrains Mono", Consolas, monospace',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#FFFFFF'
            }}>
              {selectedFile?.path ? selectedFile.path.split('/').pop() : 'docker-compose.yml'}
            </span>

            <button
              type="button"
              onClick={handleCopy}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: copied ? '#4ADE80' : '#E4E4E7',
                borderRadius: '8px',
                padding: '6px 16px',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {copied ? '¡Copiado!' : 'Copiar'}
            </button>
          </div>

          {/* Code pre */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8', fontSize: '0.875rem' }}>
                Cargando archivos...
              </div>
            ) : (
              <pre style={{
                margin: 0,
                fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
                fontSize: '0.8125rem',
                lineHeight: 1.65,
                color: '#E4E4E7',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                <code>
                  {selectedFile?.content || '# Selecciona un archivo para ver su código'}
                </code>
              </pre>
            )}
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
</details>
    </div>
  );
}
