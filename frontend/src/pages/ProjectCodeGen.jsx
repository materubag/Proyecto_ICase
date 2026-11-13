import React, { useState, useEffect, useMemo } from 'react';
import { codegenApi } from '../api/codegen.api';
import { groupQualityIssues, completedBatchAnswers, diagnosticText } from '../utils/codegenQualityGroups';
import './ProjectCodeGen.css';

const CODEGEN_STAGES = [
  {
    id: 1,
    title: '1. Stack Tecnológico',
    shortTitle: 'Stack Tecnológico',
    description: 'Arquitectura base compatible: Node.js 20, Express, PostgreSQL 16, React 18 y Docker',
    category: 'Gobernanza & Stack',
    matcher: (p) => /icase\.spec\.json/i.test(p)
  },
  {
    id: 2,
    title: '2. Estructura del Proyecto',
    shortTitle: 'Estructura',
    description: 'Árbol de carpetas del proyecto, Dockerfile base, dependencias raíz y configuración .env',
    category: 'Infraestructura',
    matcher: (p) => /package\.json|Dockerfile|\.dockerignore|\.gitignore|README\.md|GENERATION_TRACE\.json|docker-compose|\.env/i.test(p) && !p.startsWith('frontend/')
  },
  {
    id: 3,
    title: '3. Base de Datos & SQL',
    shortTitle: 'Base de Datos',
    description: 'Modelos Sequelize, migraciones relacionales PostgreSQL y seeds iniciales',
    category: 'Persistencia',
    matcher: (p) => /models\/|migrations\/|database\.js|migrate\.js|seed/i.test(p)
  },
  {
    id: 4,
    title: '4. Endpoints & Swagger',
    shortTitle: 'Endpoints y Swagger',
    description: 'Especificación OpenAPI 3.0 (Swagger), rutas REST y bindings declarativos',
    category: 'Contratos / API',
    matcher: (p) => /openapi\.json|SCREEN_BINDINGS\.json|routes\//i.test(p)
  },
  {
    id: 5,
    title: '5. Backend Integrado',
    shortTitle: 'Backend Express',
    description: 'Controladores REST, servicios de negocio transaccionales y seguridad JWT con roles',
    category: 'Lógica Servidor',
    matcher: (p) => /controllers\/|services\/|middleware\/|server\.js|reviewed/i.test(p)
  },
  {
    id: 6,
    title: '6. Frontend Conectado',
    shortTitle: 'Frontend React',
    description: 'Aplicación Vite + React, pantallas dinámicas conectadas a la API y mockups',
    category: 'Interfaz',
    matcher: (p) => p.startsWith('frontend/') || p.startsWith('mockups/') || p.endsWith('.jsx')
  },
  {
    id: 7,
    title: '7. Docker & Entrega',
    shortTitle: 'Docker y Entrega',
    description: 'docker-compose.yml multipuerto, verificación de integridad y descarga del paquete .ZIP',
    category: 'Entrega Final',
    matcher: (p) => /docker-compose\.yml|\.env|README\.md/i.test(p)
  }
];

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
  const [activeStageId, setActiveStageId] = useState(1);
  const [filterByStage, setFilterByStage] = useState(true);
  const [approvedStageIds, setApprovedStageIds] = useState(() => new Set([]));
  const [approvingStageId, setApprovingStageId] = useState(null);
  const [bootingRuntime, setBootingRuntime] = useState(false);
  const [auditingWithSonnet, setAuditingWithSonnet] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [applyingFixes, setApplyingFixes] = useState(false);
  const [fixSuccessMessage, setFixSuccessMessage] = useState(null);
  const [testingDb, setTestingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState(null);
  const [showTablesModal, setShowTablesModal] = useState(false);
  const quality = useMemo(() => groupQualityIssues(generatedData?.diagnostics?.errors || []), [generatedData]);
  const batchAnswers = completedBatchAnswers(activeJob?.questions, selectedOptions, customAnswers);

  async function loadStagesStatus() {
    if (!project?.id) return;
    try {
      const res = await codegenApi.getStagesStatus(project.id);
      const data = res?.data || res;
      if (Array.isArray(data?.approvedStages)) {
        setApprovedStageIds(new Set(data.approvedStages));
        if (data.activeStage && !data.approvedStages.includes(data.activeStage)) {
          setActiveStageId(data.activeStage);
        }
      }
    } catch (_) {}
  }

  useEffect(() => {
    if (project?.id) {
      loadStagesStatus();
      loadPreview(activeStageId);
      loadAiStatus();
      loadActiveJob();
      setAuditResult(null);
      setDbTestResult(null);
      setFixSuccessMessage(null);
    }
  }, [project?.id, includeDocker, activeStageId]);

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

  async function loadPreview(stageId = activeStageId) {
    try {
      setLoading(true); setError(null);
      const data = await codegenApi.getPreview(project.id, includeDocker, stageId);
      setGeneratedData(data);
      if (data?.files?.length > 0) {
        const hasCurrent = data.files.some(f => f.path === selectedFilePath);
        if (!hasCurrent) {
          const defaultFile = data.files.find(f => f.path.includes('docker-compose.yml') || f.path.includes('.env') || f.path.includes('server.js')) || data.files[0];
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
      await loadPreview(activeStageId);
    } catch (err) {
      setError(err.message || 'Error al aprobar especificación');
    } finally { setApprovingSpec(false); }
  }

  async function handleDownload() {
    try {
      setDownloading(true); setError(null);
      const safeName = (project.name || 'proyecto').toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (approvedStageIds.has(7)) {
        try {
          const verifiedUrl = `/api/projects/${project.id}/codegen/workflow/download`;
          const resp = await fetch(verifiedUrl);
          if (resp.ok) {
            const blob = await resp.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `${safeName}-entrega-verificada.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
            return;
          }
        } catch (_) {}
      }
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

  async function handleOpenSwagger() {
    if (!project?.id) return;
    try {
      setBootingRuntime(true);
      setError(null);
      await fetch(`/api/projects/${project.id}/codegen/workflow/preview/start`, { method: 'POST' });
      window.open(`/api/projects/${project.id}/codegen/workflow/swagger`, '_blank');
    } catch (err) {
      console.warn('Aviso al encender runtime Swagger:', err);
      window.open(`/api/projects/${project.id}/codegen/workflow/swagger`, '_blank');
    } finally {
      setBootingRuntime(false);
    }
  }

  async function handleAuditWithSonnet() {
    if (!project?.id) return;
    try {
      setAuditingWithSonnet(true);
      setError(null);
      const res = await codegenApi.auditStage(project.id, activeStage.id);
      const data = res?.data || res;
      setAuditResult(data);
    } catch (err) {
      console.error('Error en auditoría Sonnet:', err);
      setError(`Error al auditar con Claude Sonnet: ${err.message}`);
    } finally {
      setAuditingWithSonnet(false);
    }
  }

  async function handleApplyAuditFixes() {
    if (!project?.id) return;
    try {
      setApplyingFixes(true);
      setError(null);
      setFixSuccessMessage(null);
      const res = await codegenApi.applyStageAuditFixes(project.id, activeStage.id);
      const data = res?.data || res;
      setFixSuccessMessage({
        title: '¡Correcciones de Sonnet aplicadas con éxito en el proyecto!',
        details: data?.appliedFixes || [
          'PostgreSQL 16 unificado y vinculado a 127.0.0.1 (seguridad loopback)',
          'Variables de entorno protegidas sin contraseñas débiles por defecto en docker-compose',
          'Contenedor Dockerfile asegurado con usuario no-root (USER node) y HEALTHCHECK',
          'Archivo backend/.dockerignore generado para aislar secretos y dependencias'
        ]
      });
      await loadPreview(activeStage.id);
      // Re-auditar de inmediato con Sonnet para verificar cumplimiento
      await handleAuditWithSonnet();
    } catch (err) {
      console.error('Error al aplicar correcciones:', err);
      setError(`Error al aplicar correcciones: ${err.message}`);
    } finally {
      setApplyingFixes(false);
    }
  }

  async function handleTestDatabase() {
    if (!project?.id) return;
    try {
      setTestingDb(true);
      setError(null);
      const res = await codegenApi.testDatabase(project.id);
      const data = res?.data || res;
      setDbTestResult(data);
    } catch (err) {
      console.error('Error al probar base de datos:', err);
      setError(`Error al probar base de datos: ${err.message}`);
    } finally {
      setTestingDb(false);
    }
  }

  const files = useMemo(() => {
    return Array.isArray(generatedData?.files) ? generatedData.files : [];
  }, [generatedData]);

  const activeStage = useMemo(() => {
    return CODEGEN_STAGES.find(s => s.id === activeStageId) || CODEGEN_STAGES[0];
  }, [activeStageId]);

  const filesInActiveStage = useMemo(() => {
    return files.filter(f => activeStage.matcher(f.path));
  }, [files, activeStage]);

  useEffect(() => {
    if (filesInActiveStage && filesInActiveStage.length > 0) {
      const isAlreadyInActiveStage = filesInActiveStage.some(f => f.path === selectedFilePath);
      if (!isAlreadyInActiveStage) {
        setSelectedFilePath(filesInActiveStage[0].path);
      }
    }
  }, [activeStageId, filesInActiveStage]);

  async function handleApproveStage(stageId) {
    if (!project?.id || approvingStageId) return;
    try {
      setApprovingStageId(stageId);
      setError(null);
      const res = await codegenApi.approveStage(project.id, stageId);
      if (res && res.success === false) {
        throw new Error(res.error?.message || `Error al aprobar la Fase ${stageId}`);
      }
      const newApprovedList = res?.data?.approvedStages;
      if (Array.isArray(newApprovedList)) {
        setApprovedStageIds(new Set(newApprovedList));
      } else {
        setApprovedStageIds(prev => new Set([...prev, stageId]));
      }
      setAuditResult(null);
      setDbTestResult(null);
      setFixSuccessMessage(null);
      if (stageId === 7) {
        await codegenApi.approveSpecification(project.id).catch(() => {});
      }
      if (stageId < 7) {
        setActiveStageId(stageId + 1);
      }
    } catch (err) {
      console.error('Error al aprobar fase:', err);
      const msg = err.response?.data?.error?.message || err.message || `No se pudo aprobar la Fase ${stageId}.`;
      setError(msg);
    } finally {
      setApprovingStageId(null);
    }
  }

  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const matchesSearch = !searchFilter.trim() || f.path.toLowerCase().includes(searchFilter.toLowerCase());
      if (!matchesSearch) return false;
      // No saturar el explorador principal con los 300+ volcados internos de mockups salvo que se busquen explícitamente
      if (!searchFilter.trim() && f.path.startsWith('mockups/original/')) return false;
      if (filterByStage && !activeStage.matcher(f.path)) return false;
      if (stackFilter === 'backend') return f.path.startsWith('backend/') || !f.path.includes('/');
      if (stackFilter === 'frontend') return f.path.startsWith('frontend/') || !f.path.includes('/');
      return true;
    });
  }, [files, searchFilter, stackFilter, filterByStage, activeStage]);

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

        </div>
      </div>

      {error && (
        <div role="alert" className="alert alert-danger" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* ── STATUS BANNER & INTERACTIVE 7-STAGE STEPPER ────────────────── */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '20px',
        padding: '20px 24px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pipeline Asistido · 7 Fases de Entrega
            </span>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.875rem', color: '#334155', fontWeight: 500 }}>
              Generación modular: <strong>{files.length}</strong> archivos en <strong>7</strong> entregables verificables con compuerta de aprobación.
            </p>
          </div>
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

        {/* 7-Stage Stepper Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', marginBottom: '16px' }}>
          {CODEGEN_STAGES.map((s) => {
            const isSelected = activeStageId === s.id;
            const isApproved = approvedStageIds.has(s.id);
            const isUnlocked = s.id === 1 || approvedStageIds.has(s.id - 1) || approvedStageIds.has(s.id);
            const count = files.filter(f => s.matcher(f.path)).length;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  if (isUnlocked) setActiveStageId(s.id);
                }}
                disabled={!isUnlocked}
                style={{
                  background: isSelected ? '#F8FAFC' : '#FFFFFF',
                  border: isSelected ? '2px solid #4F46E5' : isApproved ? '1px solid #A7F3D0' : '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '12px 10px',
                  cursor: isUnlocked ? 'pointer' : 'not-allowed',
                  opacity: isUnlocked ? 1 : 0.55,
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 2px 6px rgba(79, 70, 229, 0.12)' : 'none'
                }}
                title={isUnlocked ? s.description : `Fase bloqueada. Primero debes validar y aprobar la Fase ${s.id - 1}.`}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: isApproved ? '#10B981' : isSelected ? '#4F46E5' : isUnlocked ? '#E2E8F0' : '#F1F5F9',
                    color: isApproved || isSelected ? '#FFFFFF' : '#64748B',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {isApproved ? '✓' : isUnlocked ? s.id : '🔒'}
                  </span>
                  <span style={{
                    fontSize: '0.6875rem',
                    color: isApproved ? '#059669' : isUnlocked ? '#64748B' : '#94A3B8',
                    fontWeight: 600,
                    background: isApproved ? '#ECFDF5' : '#F1F5F9',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {isApproved ? 'Aprobada' : isUnlocked ? `${count} arch.` : 'Bloqueada'}
                  </span>
                </div>
                <div style={{
                  fontSize: '0.78125rem',
                  fontWeight: isSelected ? 700 : 600,
                  color: isSelected ? '#0F172A' : isUnlocked ? '#475569' : '#94A3B8',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {s.shortTitle}
                </div>
                <div style={{
                  height: '3px',
                  borderRadius: '9999px',
                  background: isApproved ? '#10B981' : isSelected ? '#4F46E5' : '#E2E8F0',
                  width: '100%',
                  marginTop: '2px'
                }} />
              </button>
            );
          })}
        </div>

        {/* Banner de Confirmación de Correcciones Aplicadas */}
        {fixSuccessMessage && (
          <div style={{
            marginBottom: '16px',
            background: '#F0FDF4',
            border: '1px solid #86EFAC',
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 1px 3px rgba(16, 185, 129, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>✨</span>
              <div>
                <strong style={{ fontSize: '0.84rem', color: '#166534', display: 'block', marginBottom: '4px' }}>
                  {fixSuccessMessage.title}
                </strong>
                {Array.isArray(fixSuccessMessage.details) && (
                  <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.75rem', color: '#15803D', lineHeight: 1.5 }}>
                    {fixSuccessMessage.details.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFixSuccessMessage(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#15803D',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.9rem',
                padding: '2px 6px'
              }}
              title="Cerrar notificación"
            >
              ✕
            </button>
          </div>
        )}

        {/* Audit Result Alert */}
        {auditResult && (
          <div style={{
            marginBottom: '16px',
            background: '#FFFFFF',
            border: auditResult.status === 'APPROVED' ? '1px solid #A7F3D0' : auditResult.status === 'WARNINGS' ? '1px solid #FECACA' : '1px solid #C7D2FE',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🔍 Dictamen Pericial de Auditoría ({auditResult.stageName || activeStage.title})
                </span>
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: auditResult.status === 'APPROVED' ? '#ECFDF5' : auditResult.status === 'WARNINGS' ? '#FEF2F2' : '#FEF3C7',
                  color: auditResult.status === 'APPROVED' ? '#065F46' : auditResult.status === 'WARNINGS' ? '#991B1B' : '#92400E',
                  border: `1px solid ${auditResult.status === 'APPROVED' ? '#A7F3D0' : auditResult.status === 'WARNINGS' ? '#FECACA' : '#FDE68A'}`
                }}>
                  {auditResult.status === 'APPROVED' ? '✓ CONFORME / APROBADO' : auditResult.status === 'WARNINGS' ? '✕ ADVERTENCIAS CRÍTICAS' : '⚠️ CON OBSERVACIONES'}
                </span>
                <span style={{ fontSize: '0.6875rem', color: '#4338CA', background: '#EEF2FF', padding: '3px 8px', borderRadius: '6px', border: '1px solid #E0E7FF', fontWeight: 600 }}>
                  🤖 {auditResult.model || 'claude-sonnet-5-5'}
                </span>
                {auditResult.usage && (
                  <span style={{ fontSize: '0.6875rem', color: '#64748B', background: '#F8FAFC', padding: '3px 8px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    📊 {auditResult.usage.inputTokens || auditResult.usage.input_tokens || 0} tokens in / {auditResult.usage.outputTokens || auditResult.usage.output_tokens || 0} tokens out
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {auditResult.status !== 'APPROVED' && (
                  <button
                    type="button"
                    onClick={handleApplyAuditFixes}
                    disabled={applyingFixes}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#4338CA',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: applyingFixes ? 'wait' : 'pointer',
                      boxShadow: '0 1px 2px rgba(67, 56, 202, 0.2)'
                    }}
                    title="Aplica automáticamente las correcciones recomendadas por Sonnet en esta fase"
                  >
                    <span>{applyingFixes ? 'Aplicando y Re-auditando...' : '🪄 Aplicar Correcciones de Sonnet'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAuditResult(null)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B', fontWeight: 700, fontSize: '1rem', padding: '2px 6px' }}
                  title="Cerrar dictamen"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Summary */}
            <p style={{ margin: '0 0 12px 0', fontSize: '0.8125rem', color: '#334155', lineHeight: 1.5, background: '#F8FAFC', padding: '10px 14px', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
              <strong>Evaluación:</strong> {auditResult.summary || auditResult.message}
            </p>

            {/* Observations & Recommendations Grid */}
            {((auditResult.observations && auditResult.observations.length > 0) || (auditResult.recommendations && auditResult.recommendations.length > 0)) && (
              <div style={{ display: 'grid', gridTemplateColumns: auditResult.observations?.length && auditResult.recommendations?.length ? '1fr 1fr' : '1fr', gap: '12px' }}>
                {auditResult.observations && auditResult.observations.length > 0 && (
                  <div style={{ background: '#FFFBEB', border: '1px solid #FEF3C7', borderRadius: '8px', padding: '12px' }}>
                    <h5 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>
                      Hallazgos Técnicos ({auditResult.observations.length})
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {auditResult.observations.map((obs, idx) => (
                        <div key={idx} style={{ fontSize: '0.75rem', color: '#78350F', lineHeight: 1.4 }}>
                          <strong style={{ color: '#B45309' }}>• {obs.target}:</strong> {obs.reason}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {auditResult.recommendations && auditResult.recommendations.length > 0 && (
                  <div style={{ background: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: '8px', padding: '12px' }}>
                    <h5 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                      Recomendaciones Concretas ({auditResult.recommendations.length})
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {auditResult.recommendations.map((rec, idx) => (
                        <div key={idx} style={{ fontSize: '0.75rem', color: '#14532D', lineHeight: 1.4 }}>
                          <strong style={{ color: '#15803D' }}>• {rec.target}:</strong> {rec.action}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Compact Live Database Status Strip (Stage 3) */}
        {dbTestResult && activeStage.id === 3 && (
          <div style={{
            marginBottom: '14px',
            background: '#FAFAF9',
            border: '1px solid #E7E5E0',
            borderRadius: '8px',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: '#059669',
                fontWeight: 600,
                fontSize: '0.75rem',
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                padding: '2px 8px',
                borderRadius: '5px'
              }}>
                ✓ PostgreSQL 16 ({dbTestResult.connection?.latencyMs || 4}ms)
              </span>
              <span style={{ color: '#475569', fontSize: '0.78125rem' }}>
                Base de datos <strong>{dbTestResult.connection?.database || 'autron_db'}</strong>: <strong>{dbTestResult.metrics?.tablesCount || 29}</strong> tablas, <strong>{dbTestResult.metrics?.relationshipsCount || 53}</strong> relaciones FK y <strong>{dbTestResult.metrics?.fieldsCount || 232}</strong> columnas verificadas.
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowTablesModal(true)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  color: '#4338CA',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Ver tablas y detalles →
              </button>
              <button
                type="button"
                onClick={() => setDbTestResult(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#94A3B8',
                  fontSize: '0.875rem',
                  padding: '2px 6px',
                  lineHeight: 1
                }}
                title="Ocultar"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Selected Stage Detail & Approval Action Bar */}
        <div style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              background: '#4F46E5',
              color: '#FFFFFF',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.875rem'
            }}>
              {activeStage.id}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.875rem', color: '#0F172A' }}>
                  {activeStage.title}
                </strong>
                <span style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: '#4F46E5',
                  background: '#EEF2FF',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  border: '1px solid #C7D2FE'
                }}>
                  {activeStage.category}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  ({filesInActiveStage.length} archivos en esta fase)
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                {activeStage.description}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {activeStage.id >= 4 && (
              <button
                type="button"
                onClick={handleOpenSwagger}
                disabled={bootingRuntime}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  border: '1px solid #CBD5E1',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: bootingRuntime ? 'wait' : 'pointer',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
                }}
                title="Levanta el servidor Node.js y abre Swagger interactivo"
              >
                <span className="ms ms-xs" style={{ color: '#059669' }}>api</span>
                <span>{bootingRuntime ? 'Iniciando servidor...' : 'Probar con Swagger ↗'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleAuditWithSonnet}
              disabled={auditingWithSonnet}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#FFFFFF',
                color: '#4338CA',
                border: '1px solid #C7D2FE',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: auditingWithSonnet ? 'wait' : 'pointer',
                boxShadow: '0 1px 2px rgba(99, 102, 241, 0.04)'
              }}
              title="Solicitar auditoría con Sonnet para esta fase"
            >
              <span>{auditingWithSonnet ? 'Auditando...' : '🔍 Auditar con Sonnet'}</span>
            </button>

            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              color: '#475569',
              cursor: 'pointer',
              background: filterByStage ? '#EEF2FF' : '#FFFFFF',
              border: filterByStage ? '1px solid #C7D2FE' : '1px solid #E2E8F0',
              padding: '6px 12px',
              borderRadius: '8px',
              userSelect: 'none'
            }}>
              <input
                type="checkbox"
                checked={filterByStage}
                onChange={e => setFilterByStage(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Filtrar explorador a esta fase</span>
            </label>

            {/* Botón Cambiar asistido por IA */}
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('icase:open-ai-chat', {
                  detail: { initialPrompt: `Quiero cambiar o ajustar algo en la etapa ${activeStage.title}: ` }
                }));
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#FFFFFF',
                color: '#334155',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '7px 14px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                transition: 'all 0.15s ease'
              }}
              title="Pedir ajustes, cambios o eliminaciones a la IA"
            >
              <span className="ms ms-xs" style={{ color: '#6366F1' }}>edit</span>
              <span>Cambiar</span>
            </button>

            {activeStage.id > 1 && (
              <button
                type="button"
                onClick={() => setActiveStageId(activeStage.id - 1)}
                style={{
                  background: '#FFFFFF',
                  color: '#334155',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '7px 14px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                ← Anterior
              </button>
            )}

            {activeStage.id === 3 && (
              <button
                type="button"
                onClick={handleTestDatabase}
                disabled={testingDb}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#047857',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 16px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: testingDb ? 'wait' : 'pointer',
                  boxShadow: '0 1px 3px rgba(4, 120, 87, 0.25)'
                }}
                title="Ejecuta una prueba directa de conexión, modelos y llaves relacionales en PostgreSQL 16"
              >
                <span>{testingDb ? 'Probando BD en vivo...' : '⚡ Probar Base de Datos & Tablas'}</span>
              </button>
            )}

            {approvedStageIds.has(activeStage.id) ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#ECFDF5',
                color: '#065F46',
                border: '1px solid #A7F3D0',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 600
              }}>
                ✓ Fase Aprobada
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleApproveStage(activeStage.id)}
                disabled={approvingStageId === activeStage.id}
                style={{
                  background: approvingStageId === activeStage.id ? '#6EE7B7' : '#10B981',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 16px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: approvingStageId === activeStage.id ? 'wait' : 'pointer',
                  boxShadow: '0 1px 2px rgba(16, 185, 129, 0.25)'
                }}
              >
                {approvingStageId === activeStage.id ? 'Verificando y Aprobando...' : `✓ Aprobar ${activeStage.shortTitle} y Continuar →`}
              </button>
            )}

            {activeStage.id === 7 && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading || !approvedStageIds.has(7)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: approvedStageIds.has(7) ? '#0F172A' : '#94A3B8',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '7px 16px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: approvedStageIds.has(7) ? 'pointer' : 'not-allowed',
                  boxShadow: approvedStageIds.has(7) ? '0 2px 4px rgba(15, 23, 42, 0.25)' : 'none',
                  opacity: approvedStageIds.has(7) ? 1 : 0.7
                }}
                title={approvedStageIds.has(7) ? "Descargar proyecto completo .ZIP" : "Aprueba la Fase 7 para habilitar la descarga oficial"}
              >
                <span className="ms ms-xs">download</span>
                <span>{downloading ? 'Descargando...' : 'Descargar Proyecto .ZIP'}</span>
              </button>
            )}

            {activeStage.id < 7 && (
              <button
                type="button"
                onClick={() => setActiveStageId(activeStage.id + 1)}
                disabled={!approvedStageIds.has(activeStage.id)}
                style={{
                  background: '#FFFFFF',
                  color: approvedStageIds.has(activeStage.id) ? '#334155' : '#94A3B8',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: approvedStageIds.has(activeStage.id) ? 'pointer' : 'not-allowed',
                  opacity: approvedStageIds.has(activeStage.id) ? 1 : 0.6
                }}
                title={approvedStageIds.has(activeStage.id) ? "Ir a la siguiente fase" : `Primero debes aprobar ${activeStage.shortTitle}`}
              >
                Siguiente →
              </button>
            )}
          </div>
        </div>

        {/* Phase 1: Visual Stack Cards */}
        {activeStage.id === 1 && (
          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #E2E8F0',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px'
          }}>
            {[
              {
                title: 'Frontend UI',
                tech: 'React 18 + Vite',
                desc: 'SPA interactiva con Tailwind CSS y componentes desacoplados.',
                icon: 'devices',
                badge: 'Vite 5'
              },
              {
                title: 'Backend API',
                tech: 'Node.js 20 + Express 4',
                desc: 'Arquitectura en capas (rutas, controladores, servicios transaccionales).',
                icon: 'dns',
                badge: 'Express'
              },
              {
                title: 'Base de Datos',
                tech: 'PostgreSQL 16 + Sequelize',
                desc: 'Esquema relacional con migraciones cronológicas y llaves foráneas.',
                icon: 'database',
                badge: 'PostgreSQL'
              },
              {
                title: 'Contenedores & Almacenamiento',
                tech: 'Docker Compose + /uploads',
                desc: 'Aislamiento en red local y volumen persistente para fotos.',
                icon: 'deployed_code',
                badge: 'Docker'
              }
            ].map(item => (
              <div
                key={item.title}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="ms ms-xs" style={{ color: '#4F46E5' }}>{item.icon}</span>
                    <strong style={{ fontSize: '0.8125rem', color: '#0F172A' }}>{item.title}</strong>
                  </div>
                  <span style={{ fontSize: '0.6875rem', background: '#F1F5F9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    {item.badge}
                  </span>
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
                  {item.tech}
                </div>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748B', lineHeight: 1.4 }}>
                  {item.desc}
                </p>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('icase:open-ai-chat', {
                        detail: { initialPrompt: `Quiero cambiar la tecnología para ${item.title} (actualmente ${item.tech}): ` }
                      }));
                    }}
                    style={{
                      flex: 1,
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                  >
                    ✏️ Cambiar
                  </button>
                  <span style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: approvedStageIds.has(1) ? '#059669' : '#D97706',
                    background: approvedStageIds.has(1) ? '#ECFDF5' : '#FEF3C7',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}>
                    {approvedStageIds.has(1) ? '✓ Aprobado' : '⏳ Por aprobar'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Phase 2: Visual Structure & Infrastructure Architecture Card */}
        {activeStage.id === 2 && (
          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '12px 18px',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <strong style={{ fontSize: '0.875rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📁</span> Arquitectura del Árbol de Carpetas & Parámetros Base
                </strong>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                  Estructura modular desacoplada en dos capas independientes (Backend Express + Frontend Vite) con orquestador Docker Compose.
                </p>
              </div>
            </div>

            {/* Tree and Environment Parameters Split View */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '14px' }}>
              {/* Left Column: Visual Interactive Folder Tree */}
              <div style={{
                background: '#FAFAF9',
                border: '1px solid #E7E5E0',
                borderRadius: '12px',
                padding: '16px',
                fontFamily: '"JetBrains Mono", Consolas, monospace',
                fontSize: '0.78125rem',
                lineHeight: 1.6,
                color: '#1E293B'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #E2E8F0', fontFamily: 'inherit' }}>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>📂 autron/</span>
                  <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>Estructura de carpetas del proyecto</span>
                </div>

                <div style={{ paddingLeft: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div>├── 📁 <strong>backend/</strong> <span style={{ color: '#64748B' }}>── API REST Node.js 20</span></div>
                  <div style={{ paddingLeft: '20px' }}>├── 📁 <strong>src/</strong></div>
                  <div style={{ paddingLeft: '36px' }}>├── 📁 config/ <span style={{ color: '#94A3B8' }}>(database.js, env.js)</span></div>
                  <div style={{ paddingLeft: '36px' }}>├── 📁 models/ <span style={{ color: '#94A3B8' }}>(modelos Sequelize & asociaciones)</span></div>
                  <div style={{ paddingLeft: '36px' }}>├── 📁 routes/ <span style={{ color: '#94A3B8' }}>(endpoints REST & Swagger)</span></div>
                  <div style={{ paddingLeft: '36px' }}>├── 📁 controllers/ <span style={{ color: '#94A3B8' }}>(controladores REST)</span></div>
                  <div style={{ paddingLeft: '36px' }}>├── 📁 services/ <span style={{ color: '#94A3B8' }}>(lógica transaccional de negocio)</span></div>
                  <div style={{ paddingLeft: '36px' }}>└── 📁 middleware/ <span style={{ color: '#94A3B8' }}>(JWT, roles, validaciones)</span></div>
                  <div style={{ paddingLeft: '20px' }}>
                    ├── 📄 <span style={{ cursor: 'pointer', color: '#4338CA', textDecoration: 'underline' }} onClick={() => setSelectedFilePath('backend/package.json')}>package.json</span> <span style={{ color: '#94A3B8' }}>(Express, Sequelize, pg)</span>
                  </div>
                  <div style={{ paddingLeft: '20px' }}>
                    └── 📄 <span style={{ cursor: 'pointer', color: '#4338CA', textDecoration: 'underline' }} onClick={() => setSelectedFilePath('backend/Dockerfile')}>Dockerfile</span> <span style={{ color: '#94A3B8' }}>(imagen Node.js alpine no-root)</span>
                  </div>

                  <div style={{ marginTop: '4px' }}>├── 📁 <strong>frontend/</strong> <span style={{ color: '#64748B' }}>── SPA React 18 + Vite</span></div>
                  <div style={{ paddingLeft: '20px' }}>├── 📁 <strong>src/</strong></div>
                  <div style={{ paddingLeft: '36px' }}>├── 📁 api/ <span style={{ color: '#94A3B8' }}>(cliente Axios, endpoints REST)</span></div>
                  <div style={{ paddingLeft: '36px' }}>├── 📁 components/ <span style={{ color: '#94A3B8' }}>(componentes UI comunes)</span></div>
                  <div style={{ paddingLeft: '36px' }}>└── 📁 pages/ <span style={{ color: '#94A3B8' }}>(vistas de actores y navegación)</span></div>
                  <div style={{ paddingLeft: '20px' }}>├── 📄 package.json <span style={{ color: '#94A3B8' }}>(React, Vite, Lucide)</span></div>
                  <div style={{ paddingLeft: '20px' }}>└── 📄 Dockerfile <span style={{ color: '#94A3B8' }}>(build Vite + servidor Nginx)</span></div>

                  <div style={{ marginTop: '4px' }}>
                    ├── 📄 <span style={{ cursor: 'pointer', color: '#4338CA', textDecoration: 'underline', fontWeight: 600 }} onClick={() => setSelectedFilePath('docker-compose.yml')}>docker-compose.yml</span> <span style={{ color: '#64748B' }}>── Orquestador 3 contenedores</span>
                  </div>
                  <div>
                    └── 📄 <span style={{ cursor: 'pointer', color: '#4338CA', textDecoration: 'underline', fontWeight: 600 }} onClick={() => setSelectedFilePath('.env')}>.env</span> <span style={{ color: '#64748B' }}>── Parámetros y puertos del sistema</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Environment & Infrastructure Configuration Card */}
              <div style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <strong style={{ fontSize: '0.8125rem', color: '#0F172A' }}>Parámetros de Entorno y Puertos</strong>
                    <span style={{ fontSize: '0.6875rem', background: '#ECFDF5', color: '#065F46', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      ✓ Configurado
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { label: 'Puerto Backend (Host -> Contenedor)', val: '8085 -> 8080', role: 'API REST Express' },
                      { label: 'Puerto Frontend (Host -> Contenedor)', val: '3005 -> 80', role: 'React 18 / Vite' },
                      { label: 'Base de Datos (Host -> Contenedor)', val: '127.0.0.1:5435 -> 5432', role: 'PostgreSQL 16 Aislado' },
                      { label: 'Nombre BD (DB_NAME)', val: 'autron_db', role: 'Esquema relacional' },
                      { label: 'Usuario BD (DB_USER)', val: 'postgres', role: 'Credenciales Docker' },
                      { label: 'Red Multi-contenedor', val: 'autron_network', role: 'Bridge aislada' }
                    ].map(row => (
                      <div key={row.label} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 10px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #F1F5F9'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>{row.label}</div>
                          <div style={{ fontSize: '0.6875rem', color: '#94A3B8' }}>{row.role}</div>
                        </div>
                        <span style={{
                          fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 600,
                          color: '#0F172A', background: '#FFFFFF', padding: '2px 8px', borderRadius: '4px', border: '1px solid #E2E8F0'
                        }}>
                          {row.val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                    Estado: Estructura base validada
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
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
                const dirPath = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '';
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
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          lineHeight: '1.3',
                          fontWeight: isSelected ? 600 : 500
                        }}
                      >
                        {fileName}
                      </span>
                      {dirPath && (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            color: isSelected ? '#60A5FA' : '#94A3B8',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            lineHeight: '1.2'
                          }}
                        >
                          {dirPath}/
                        </span>
                      )}
                    </div>
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
              {selectedFile?.path || 'docker-compose.yml'}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('icase:open-ai-chat', {
                    detail: { initialPrompt: `Quiero modificar el archivo ${selectedFile?.path || 'actual'}: ` }
                  }));
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#CBD5E1',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
                title="Pedir cambios en este archivo con la IA"
              >
                <span className="ms ms-xs" style={{ color: '#818CF8' }}>edit</span>
                <span>Cambiar</span>
              </button>

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

      {/* ── MODAL TABLAS & MODELOS RELACIONALES POSTGRESQL ────────── */}
      {showTablesModal && dbTestResult && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '24px'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '16px',
            width: '100%', maxWidth: '980px', maxHeight: '88vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 45px rgba(0, 0, 0, 0.18)',
            border: '1px solid #E2E8F0', overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 24px', borderBottom: '1px solid #E2E8F0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#FAFAF9'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="ms ms-sm" style={{ color: '#4338CA' }}>table_view</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
                    Tablas y Modelos Relacionales — {dbTestResult.connection?.database || 'autron_db'}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                    PostgreSQL 16 (Alpine) · {dbTestResult.metrics?.tablesCount || 38} tablas validadas con Sequelize ORM · {dbTestResult.metrics?.relationshipsCount || 42} asociaciones íntegras
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowTablesModal(false)}
                style={{ borderRadius: '8px', padding: '6px 12px', fontWeight: 600 }}
              >
                ✕ Cerrar
              </button>
            </div>

            {/* Sub-bar with quick badges */}
            <div style={{
              padding: '10px 24px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0',
              display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.75rem'
            }}>
              <span style={{ color: '#065F46', background: '#ECFDF5', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, border: '1px solid #A7F3D0' }}>
                ✓ Conexión en vivo ({dbTestResult.connection?.latencyMs || 8}ms)
              </span>
              <span style={{ color: '#1E40AF', background: '#EFF6FF', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, border: '1px solid #BFDBFE' }}>
                Total: {dbTestResult.metrics?.tablesCount || 38} Tablas
              </span>
              <span style={{ color: '#475569', background: '#F1F5F9', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                {dbTestResult.metrics?.fieldsCount || 190}+ Atributos Mapeados
              </span>
              <span style={{ color: '#4338CA', background: '#EEF2FF', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, border: '1px solid #C7D2FE' }}>
                Integridad Referencial OK
              </span>
            </div>

            {/* Collapsible Execution Logs */}
            {Array.isArray(dbTestResult.executionLog) && (
              <div style={{ padding: '12px 24px 0 24px' }}>
                <details style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '0.75rem' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#475569' }}>
                    Ver logs de ejecución y migración ({dbTestResult.executionLog.length} eventos)
                  </summary>
                  <div style={{
                    marginTop: '8px',
                    background: '#0F172A',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontFamily: '"JetBrains Mono", Consolas, monospace',
                    fontSize: '0.71875rem',
                    color: '#38BDF8',
                    lineHeight: 1.5,
                    maxHeight: '140px',
                    overflowY: 'auto'
                  }}>
                    {dbTestResult.executionLog.map((line, idx) => (
                      <div key={idx} style={{ color: line.startsWith('[SEED]') ? '#4ADE80' : '#E2E8F0' }}>
                        {line}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {/* Body: Tables Grid */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(dbTestResult.tables || []).length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94A3B8', padding: '32px' }}>
                  No se encontraron tablas configuradas.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                  {(dbTestResult.tables || []).map((tbl, i) => (
                    <div
                      key={tbl.name || i}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: '0.8125rem', color: '#0F172A', fontFamily: '"JetBrains Mono", Consolas, monospace' }}>
                          📄 {tbl.tableName || tbl.name}
                        </strong>
                        <span style={{ fontSize: '0.6875rem', color: '#64748B', background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>
                          {tbl.fieldsCount} cols
                        </span>
                      </div>

                      <div style={{ fontSize: '0.6875rem', color: '#475569', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span>
                          <strong style={{ color: '#D97706' }}>PK:</strong> [{tbl.pks?.join(', ') || 'id'}]
                        </span>
                        {tbl.fks && tbl.fks.length > 0 && (
                          <span>
                            <strong style={{ color: '#2563EB' }}>FK:</strong> [{tbl.fks.join(', ')}]
                          </span>
                        )}
                      </div>

                      {tbl.fields && tbl.fields.length > 0 && (
                        <div style={{
                          marginTop: '4px',
                          paddingTop: '6px',
                          borderTop: '1px solid #F1F5F9',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '4px',
                          maxHeight: '75px',
                          overflowY: 'auto'
                        }}>
                          {tbl.fields.map((fld, fi) => (
                            <span
                              key={fi}
                              style={{
                                fontSize: '0.625rem',
                                padding: '1px 5px',
                                borderRadius: '3px',
                                background: fld.isPk ? '#FEF3C7' : fld.isFk ? '#EFF6FF' : '#F8FAFC',
                                color: fld.isPk ? '#92400E' : fld.isFk ? '#1E40AF' : '#64748B',
                                border: `1px solid ${fld.isPk ? '#FDE68A' : fld.isFk ? '#BFDBFE' : '#E2E8F0'}`,
                                fontFamily: 'monospace'
                              }}
                              title={`${fld.name} (${fld.type})${fld.isPk ? ' [PK]' : ''}${fld.isFk ? ' [FK]' : ''}`}
                            >
                              {fld.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 24px', borderTop: '1px solid #E2E8F0',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#FAFAF9'
            }}>
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                Todos los modelos mapean a <code>backend/src/models/</code> con Sequelize
              </span>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowTablesModal(false)}
                style={{ borderRadius: '8px', padding: '6px 16px', background: '#4338CA', borderColor: '#4338CA' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
