/**
 * Codegen Persistent Job Manager Service
 * Manages the asynchronous lifecycle of AI-assisted code generation:
 * ANALYZING -> WAITING_FOR_INPUT -> GENERATING -> VALIDATING -> REPAIRING -> COMPLETED
 * Includes BLOCKED, FAILED, and CANCELLED states.
 * Fully persists state to disk across reloads, tracks stage-by-stage token and time consumption,
 * and prevents concurrent duplicate jobs.
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const prisma = require('../../config/prisma');
const codeGenerator = require('./codeGenerator.service');
const { buildProjectSpec } = require('./projectSpecBuilder');
const { createZipBuffer } = require('./zipHelper');
const codegenDecisionService = require('./codegenDecision.service');
const codegenVerificationService = require('./codegenVerification.service');
const codegenAiRepairService = require('./codegenAiRepair.service');

function getJobsDir() {
  const root = process.cwd().endsWith('backend') ? process.cwd() : path.join(process.cwd(), 'backend');
  const dir = path.join(root, '.cache', 'codegen_jobs');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (_) {}
  }
  return dir;
}

function getJobFilePath(jobId) {
  return path.join(getJobsDir(), `${jobId}.json`);
}

function getActiveJobPointerPath(projectId) {
  return path.join(getJobsDir(), `active_${projectId}.json`);
}

class CodegenJobService {
  constructor() {
    this.memoryJobs = new Map();
    this.runningJobs = new Set();
    this.queuedJobs = new Set();
    this.loadPersistedActiveJobs();
  }

  recoverInterruptedJobs() {
    const recovered = [];
    for (const job of this.memoryJobs.values()) {
      if (!['ANALYZING', 'GENERATING', 'VALIDATING', 'REPAIRING'].includes(job.status) ||
          this.runningJobs.has(job.id) || this.queuedJobs.has(job.id)) continue;
      job.resumeStage = job.status;
      job.status = 'INTERRUPTED';
      job.stageMessage = 'La ejecución se interrumpió al reiniciarse el servidor. Puedes reanudar este trabajo conservando las decisiones guardadas.';
      this.log(job, job.stageMessage, 'WARN');
      recovered.push(job.id);
    }
    return recovered;
  }

  schedulePipeline(jobId) {
    if (this.queuedJobs.has(jobId)) return;
    this.queuedJobs.add(jobId);
    setImmediate(() => {
      this.queuedJobs.delete(jobId);
      this.runPipeline(jobId).catch(err => console.error('[CodegenJobService] Pipeline error:', err.message));
    });
  }

  loadPersistedActiveJobs() {
    try {
      const dir = getJobsDir();
      const files = fs.readdirSync(dir).filter(f => f.startsWith('job_') && f.endsWith('.json'));
      for (const f of files) {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
          if (content && content.id) {
            this.memoryJobs.set(content.id, content);
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  loadJobsFromDisk() {
    return this.loadPersistedActiveJobs();
  }

  saveJob(job) {
    job.updatedAt = new Date().toISOString();
    this.memoryJobs.set(job.id, job);

    const filePath = getJobFilePath(job.id);
    try {
      fs.writeFileSync(filePath, JSON.stringify(job, null, 2), 'utf8');
      const pointerPath = getActiveJobPointerPath(job.projectId);
      fs.writeFileSync(pointerPath, JSON.stringify({ activeJobId: job.id, updatedAt: job.updatedAt }), 'utf8');
    } catch (_) {}
  }

  getJob(jobId) {
    if (typeof jobId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(jobId)) return null;
    if (this.memoryJobs.has(jobId)) {
      const job = this.memoryJobs.get(jobId);
      if (require('./generationClarifications').reclassifyTechnicalQuestions(job)) this.saveJob(job);
      return job;
    }
    const filePath = getJobFilePath(jobId);
    if (fs.existsSync(filePath)) {
      try {
        const job = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.memoryJobs.set(job.id, job);
        if (require('./generationClarifications').reclassifyTechnicalQuestions(job)) this.saveJob(job);
        return job;
      } catch (_) {}
    }
    return null;
  }

  getActiveJob(projectId) {
    const pointerPath = getActiveJobPointerPath(projectId);
    if (fs.existsSync(pointerPath)) {
      try {
        const { activeJobId } = JSON.parse(fs.readFileSync(pointerPath, 'utf8'));
        if (activeJobId) {
          const job = this.getJob(activeJobId);
          if (job) return ['CANCELLED', 'FAILED'].includes(job.status) ? null : job;
        }
      } catch (_) {}
    }

    // Fallback: search in memory
    const latest = [...this.memoryJobs.values()].filter(job => job.projectId === projectId).sort((a, b) => String(b.updatedAt || b.metrics?.startedAt || '').localeCompare(String(a.updatedAt || a.metrics?.startedAt || '')))[0];
    return latest && !['CANCELLED', 'FAILED'].includes(latest.status) ? latest : null;
  }

  log(job, message, level = 'INFO') {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message
    };
    if (!job.logs) job.logs = [];
    job.logs.push(entry);
    this.saveJob(job);
  }

  /**
   * Starts a persistent generation job or returns existing active job.
   */
  async startJob(projectId, options = {}) {
    if (options.enableAI === true) require('./codegenAiHold').assertAllowed(projectId);
    if (typeof projectId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error('INVALID_PROJECT_ID');
    // 1. Check for existing active job to avoid duplication
    const existing = this.getActiveJob(projectId);
    if (existing?.status === 'BLOCKED' && existing.planningBlockers?.length) {
      const result = await this.resumeJob(existing.id);
      if (result.resumed) return existing;
    }
    if (existing?.status === 'INTERRUPTED') {
      await this.resumeJob(existing.id);
      return existing;
    }
    const inProgressStatuses = ['ANALYZING', 'WAITING_FOR_INPUT', 'GENERATING', 'VALIDATING', 'REPAIRING'];
    if (existing && inProgressStatuses.includes(existing.status)) {
      return existing;
    }

    // Older jobs can be resumed after exhausting the removed time/token budget.
    const missingScenarios = existing?.verificationReport?.errors?.some(error => error.code === 'UNRESOLVED_ACCEPTANCE_SCENARIOS');
    if (existing?.status === 'BLOCKED' && (existing.stageMessage?.startsWith('Se alcanzó el presupuesto de tiempo o tokens.') ||
        (existing.enableAI && missingScenarios && existing.metrics.repairAttempts < existing.budget.maxRepairAttempts))) {
      existing.budget.maxTokens = null;
      existing.budget.timeoutMs = null;
      existing.status = missingScenarios ? 'REPAIRING' : 'ANALYZING';
      existing.stageMessage = missingScenarios ? 'Preparando los escenarios de aceptación pendientes...' : 'Reanudando generación sin límite de tiempo ni tokens...';
      existing.error = null;
      existing.metrics.finishedAt = null;
      this.saveJob(existing);
      await this.resumeJob(existing.id);
      return existing;
    }

    // 2. Create new job object
    const jobId = `job_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const job = {
      id: jobId,
      projectId,
      revision: options.revision || 1,
      status: 'ANALYZING',
      progress: 5,
      stageMessage: 'Iniciando análisis del proyecto y coherencia de requisitos...',
      scope: options.scope || 'Contratos explícitos del proyecto',
      enableAI: options.enableAI === true,
        batchMode: options.batchMode !== false,
      includeDocker: options.includeDocker !== false,
      ready: false,
      trace: [],
      logs: [],
      questions: [],
      decisions: {},
      generatedFilesCount: 0,
      exportDirectory: null,
      zipPath: null,
      verificationReport: null,
      metrics: {
        startedAt: new Date().toISOString(),
        finishedAt: null,
        durationMs: 0,
        stages: {
          ANALYZING: { startedAt: new Date().toISOString(), durationMs: 0 },
          GENERATING: { durationMs: 0 },
          VALIDATING: { durationMs: 0 },
          REPAIRING: { durationMs: 0 }
        },
        totalTokens: 0,
        repairAttempts: 0
      },
      budget: {
        maxTokens: null,
        maxRepairAttempts: options.maxRepairAttempts || 5,
        timeoutMs: null
      },
      error: null
    };

    this.log(job, `Trabajo de generación asistida creado para el proyecto ${projectId}.`);
    this.saveJob(job);

    // Run pipeline asynchronously
    this.schedulePipeline(job.id);

    return job;
  }

  /**
   * Main asynchronous pipeline runner.
   */
  async runPipeline(jobId) {
    if (this.runningJobs.has(jobId)) return;
    this.runningJobs.add(jobId);
    try {
      return await this.executePipeline(jobId);
    } catch (err) {
      const job = this.getJob(jobId);
      if (job && job.status !== 'CANCELLED') {
        job.status = 'FAILED';
        job.error = { message: err.message, stack: err.stack };
        job.stageMessage = `La ejecución falló: ${err.message}`;
        this.log(job, job.stageMessage, 'ERROR');
      }
      throw err;
    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  async executePipeline(jobId) {
    const job = this.getJob(jobId);
    if (!job || job.status === 'CANCELLED') return;
    if (job.enableAI) require('./codegenAiHold').assertAllowed(job.projectId);

    const startTime = Date.now();

    // ==========================================
    // STAGE 1: ANALYZING
    // ==========================================
    if (job.status === 'ANALYZING') {
      job.progress = 10;
      job.stageMessage = 'Analizando coherencia del modelo y buscando decisiones faltantes...';
      this.log(job, 'Etapa ANALYZING: Verificando requisitos, actores y reglas de negocio.');
      this.saveJob(job);

      // Check missing decisions
      const pendingQuestions = await codegenDecisionService.getPendingDecisions(job.projectId, { skipLiveAi: !job.enableAI });
      job.decisionAnalysis = pendingQuestions.analysis || { status: 'NOT_ANALYZED' };
      job.metrics.totalTokens += job.decisionAnalysis.usage?.totalTokens || 0;
      job.trace.push({ stage: 'DECISION_ANALYSIS', ...job.decisionAnalysis, applied: false });

      if (pendingQuestions && pendingQuestions.length > 0 && !job.batchMode) {
        job.status = 'WAITING_FOR_INPUT';
        job.progress = 25;
        job.questions = pendingQuestions;
        job.stageMessage = `Se requieren aclaraciones de negocio (${pendingQuestions.length} pendientes).`;
        this.log(job, `Etapa WAITING_FOR_INPUT: Esperando respuesta a ${pendingQuestions.length} aclaraciones.`);
        this.saveJob(job);
        return; // Pause pipeline until user submits decisions
      }
      if (job.batchMode) job.analysisQuestions = pendingQuestions || [];

      // No pending decisions, transition to GENERATING
      job.status = 'GENERATING';
      this.saveJob(job);
    }

    // ==========================================
    // STAGE 2: GENERATING
    // ==========================================
    if (job.status === 'GENERATING') {
      const genStart = Date.now();
      // Previous review results are historical while a new pass is running.
      job.planningBlockers = [];
      job.progress = 40;
      job.stageMessage = 'Generando backend, frontend, migraciones y contratos de pantalla...';
      this.log(job, 'Etapa GENERATING: Compilando especificación y generando archivos de aplicación.');
      this.saveJob(job);

      // Build project specification
      let spec = null;
      try {
        spec = await buildProjectSpec(job.projectId);
      } catch (specErr) {
        job.status = 'BLOCKED';
        job.stageMessage = `Bloqueo al construir la especificación: ${specErr.message}`;
        this.log(job, `Bloqueo al construir especificación: ${specErr.message}`, 'ERROR');
        this.saveJob(job);
        return;
      }

      // Generate project files
      job.planningSpecHash = spec.hash || null;
      if (!job.enableAI && !job.analysisQuestions?.length && job.decisionAnalysis?.status === 'NOT_ANALYZED' && require('./reviewedAcceptanceRegistry').resolve(spec)) {
        job.decisionAnalysis = { status: 'REVIEWED_CONTRACTS', source: 'CONFIRMED_DECISIONS', specHash: spec.hash, questionIds: Object.keys(spec.confirmedDecisions || {}), acceptance: spec.reviewedAcceptance };
      }
      let planningTokens = 0;
      const trace = event => {
        const allowed = ['stage', 'mode', 'provider', 'model', 'outcome', 'reason', 'errorMessage', 'proposalId', 'validation', 'applied', 'operationId', 'screenId', 'tokensUsed', 'usage'];
        job.trace.push({ timestamp: new Date().toISOString(), ...Object.fromEntries(allowed.filter(key => event[key] !== undefined).map(key => [key, event[key]])) });
        if (['OPERATION_PLANNING', 'SCREEN_PLANNING'].includes(event.stage)) {
          const used = event.usage?.totalTokens || event.tokensUsed || 0;
          planningTokens += used;
          job.metrics.totalTokens += used;
          this.log(job, `${event.stage}: ${event.operationId || event.screenId} — ${event.validation || event.outcome}${event.reason ? ': ' + event.reason : ''}`);
        }
        this.saveJob(job);
      };
      trace({ stage: 'SPEC_BUILD', mode: 'DETERMINISTIC', outcome: 'SUCCEEDED' });
      const coherence = await codegenAiRepairService.reviewProjectCoherence(spec);
      trace({ stage: 'COHERENCE', mode: 'DETERMINISTIC', outcome: coherence.coherent ? 'PASSED' : 'UNRESOLVED', tokensUsed: 0 });
      const planning = await require('./aiGenerationPipeline').planGeneration(job.projectId, spec, {
        enableAI: job.enableAI,
        batchMode: job.batchMode,
        seedQuestions: job.batchMode ? job.analysisQuestions || [] : [],
        onCheckpoint: review => {
          job.batchReview = { ...review, updatedAt: new Date().toISOString() };
          this.saveJob(job);
        },
        repairFeedback: job.repairFeedback,
        isCancelled: () => job.status === 'CANCELLED', onTrace: trace,
        onProgress: message => {
          if (job.status !== 'CANCELLED') {
            job.stageMessage = message;
            this.log(job, message);
          }
        }
      });
      job.metrics.totalTokens += Math.max(0, planning.tokensUsed - planningTokens);
      if (job.status === 'CANCELLED') return;
      if (planning.questions?.length) {
        job.status = 'WAITING_FOR_INPUT';
        job.clarificationResumeStage = 'GENERATING';
        job.progress = 35;
        job.questions = planning.questions;
        job.planningBlockers = planning.blockers || [];
        job.stageMessage = job.batchMode
          ? `Revisión completa: ${planning.questions.length} aclaraciones reunidas y ${(planning.blockers || []).length} contratos con fallos técnicos.`
          : `La generación necesita tus respuestas (${planning.questions.length} aclaraciones pendientes).`;
        this.log(job, job.stageMessage);
        this.saveJob(job);
        return;
      }
      if (planning.blockers?.length) {
        job.status = 'BLOCKED';
        job.ready = false;
        job.planningBlockers = planning.blockers;
        job.stageMessage = job.batchMode ? `Revisión completa: ${planning.blockers.length} contratos requieren reparación técnica.` : `No se pudo completar el contrato de ${planning.blockers[0].operationId}. Revisa los detalles de generación.`;
        this.log(job, job.stageMessage, 'WARN');
        this.saveJob(job);
        return;
      }
      const result = await codeGenerator.generateProjectFiles(job.projectId, {
        spec,
        includeDocker: job.includeDocker,
        reviewOnly: true,
        onTrace: trace
      });

      if (!result.files || result.files.length === 0) {
        job.status = 'BLOCKED';
        job.stageMessage = 'No se produjeron archivos generados. Verifique las entidades aprobadas.';
        this.log(job, 'Bloqueo: Cero archivos generados en codeGenerator.', 'ERROR');
        this.saveJob(job);
        return;
      }

      // Write files to isolated temporary verification directory inside app root
      const appRoot = process.cwd().endsWith('backend') ? process.cwd() : (fs.existsSync(path.join(process.cwd(), 'backend')) ? path.join(process.cwd(), 'backend') : process.cwd());
      const verifRoot = path.join(appRoot, '.verification');
      if (!fs.existsSync(verifRoot)) {
        try { fs.mkdirSync(verifRoot, { recursive: true }); } catch (_) {}
      }

      result.files = result.files.filter(file => file.path !== 'GENERATION_TRACE.json');
      result.files.push({ path: 'GENERATION_TRACE.json', content: JSON.stringify(job.trace, null, 2) });
      job.diagnostics = result.diagnostics;
      job.temporaryExportRepairs = Boolean(result.persistedExportPatchesApplied);
      const exportDir = fs.mkdtempSync(path.join(verifRoot, 'codegen-review-'));
      for (const file of result.files) {
        const target = path.resolve(exportDir, file.path);
        if (!target.startsWith(exportDir + path.sep)) throw new Error('Ruta de exportación inválida');
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.content || '');
      }

      const zipPath = exportDir + '.zip';

      job.exportDirectory = exportDir;
      job.zipPath = zipPath;
      job.generatedFilesCount = result.files.length;
      job.generatedFilePaths = result.files.map(file => file.path);
      job.metrics.stages.GENERATING = { durationMs: Date.now() - genStart };

      this.log(job, `Generados ${result.files.length} archivos en directorio aislado: ${path.basename(exportDir)}.`);

      // Update pointer file for last export
      const lastExportMeta = {
        directory: exportDir,
        zip: null,
        ready: false,
        reviewOnly: true,
        files: result.files.length,
        blockers: result.diagnostics?.errors || []
      };
      try {
        fs.writeFileSync(path.join(verifRoot, `last-export-${job.projectId}.json`), JSON.stringify(lastExportMeta, null, 2), 'utf8');
      } catch (_) {}

      // Transition to VALIDATING
      job.status = 'VALIDATING';
      job.progress = 65;
      this.saveJob(job);
    }

    // ==========================================
    // STAGE 3: VALIDATING
    // ==========================================
    if (job.status === 'VALIDATING') {
      const valStart = Date.now();
      job.stageMessage = 'Ejecutando suite de verificación aislada (sintaxis, build Vite, PostgreSQL, navegador)...';
      this.log(job, 'Etapa VALIDATING: Iniciando comprobaciones sintácticas, migraciones y recorridos de navegador.');
      this.saveJob(job);

      try {
        const locks = await require('./exportDependencies').prepareExportDependencies(job.exportDirectory, {
          onProgress: update => this.log(job, update.check)
        });
        job.generatedFilePaths = [...new Set([...job.generatedFilePaths, ...locks])];
      } catch (error) {
        job.status = 'BLOCKED';
        job.stageMessage = 'No se pudieron preparar las dependencias del exportado: ' + (error.code || 'DEPENDENCY_INSTALL_FAILED');
        this.log(job, job.stageMessage, 'WARN'); this.saveJob(job); return;
      }
      if (job.status === 'CANCELLED') return;
      let spec = null;
      try {
        spec = JSON.parse(fs.readFileSync(path.join(job.exportDirectory, 'icase.spec.json'), 'utf8'));
      } catch (_) {
        spec = await buildProjectSpec(job.projectId).catch(() => ({}));
      }

      const report = await codegenVerificationService.runVerification(job.exportDirectory, spec, {
        filePaths: job.generatedFilePaths,
        onProgress: update => {
          if (update.check) {
            this.log(job, `PASS: ${update.check}`);
          } else if (update.error) {
            this.log(job, `FAIL: [${update.error.stage}] ${update.error.message}`, 'WARN');
          }
        }
      });

      job.verificationReport = report;
      if (job.status === 'CANCELLED') return;
      job.ready = report.ready === true && job.diagnostics?.ready === true && ['NO_PENDING_DECISIONS', 'REVIEWED_CONTRACTS'].includes(job.decisionAnalysis?.status) && !job.temporaryExportRepairs;
      const status = { ready: job.ready, contractReady: job.diagnostics?.ready === true, notForDeployment: !job.ready, diagnostics: job.diagnostics, decisionAnalysis: job.decisionAnalysis, temporaryExportRepairs: job.temporaryExportRepairs || false, verification: report };
      fs.writeFileSync(path.join(job.exportDirectory, 'REVIEW_STATUS.json'), JSON.stringify(status, null, 2));
      fs.writeFileSync(path.join(job.exportDirectory, 'GENERATION_TRACE.json'), JSON.stringify(job.trace || [], null, 2));
      const bundlePaths = [...new Set([...(job.generatedFilePaths || []), ...(report.screenshots || []), 'REVIEW_STATUS.json', 'acceptance-results.json', 'GENERATION_TRACE.json'])];
      const bundle = bundlePaths.map(relative => {
        const target = path.resolve(job.exportDirectory, relative);
        if (!target.startsWith(path.resolve(job.exportDirectory) + path.sep)) throw new Error('Ruta de paquete inválida');
        return { path: relative, content: fs.readFileSync(target) };
      });
      const sealed = require('./exportIntegrity').bundleVerifiedFiles(bundle.map(f => ({ ...f, content: Buffer.from(f.content) })), { tested: report.passed === true, ready: job.ready, testedSourceHash: report.testedSourceHash || null });
      fs.writeFileSync(job.zipPath, sealed.buffer);
      job.zipSha256 = sealed.sha256;
      job.bundleManifest = sealed.manifest;
      job.metrics.stages.VALIDATING = { durationMs: Date.now() - valStart };

      if (report.passed) {
        // Verification succeeded!
        job.status = 'COMPLETED';
        job.progress = 100;
        job.stageMessage = job.ready ? 'Aplicación verificada.' : 'Verificación del alcance ejecutada; ready=false. Consulte los bloqueos del proyecto.';
        job.metrics.finishedAt = new Date().toISOString();
        job.metrics.durationMs = Date.now() - startTime;

        this.log(job, `COMPLETED: Se completaron ${report.checks.length} comprobaciones exitosas. Scope: ${report.scope}.`);
        this.saveJob(job);
        return;
      }

      // Verification failed
      this.log(job, `Fallo en verificación (${report.errors.length} errores).`, 'WARN');
      if ((report.errors || []).some(error => /^(NO_ISOLATED|UNRESOLVED_|MISSING_EXPORTED|MISSING_BROWSER)/.test(error.code || '') &&
          !(job.enableAI && error.code === 'UNRESOLVED_ACCEPTANCE_SCENARIOS'))) {
        job.status = 'BLOCKED';
        job.stageMessage = 'Verificación pendiente: ' + report.errors.map(error => error.code || error.stage).join(', ');
        this.saveJob(job);
        return;
      }

      if (job.metrics.repairAttempts < job.budget.maxRepairAttempts) {
        job.status = 'REPAIRING';
        job.progress = 75;
        this.saveJob(job);
      } else {
        job.status = 'BLOCKED';
        job.stageMessage = `Límite de intentos de reparación alcanzado (${job.metrics.repairAttempts}/${job.budget.maxRepairAttempts}).`;
        job.metrics.finishedAt = new Date().toISOString();
        job.metrics.durationMs = Date.now() - startTime;
        this.log(job, `BLOCKED: No se pudieron resolver todos los fallos dentro del presupuesto de intentos.`, 'ERROR');
        this.saveJob(job);
        return;
      }
    }

    // ==========================================
    // STAGE 4: REPAIRING
    // ==========================================
    if (job.status === 'REPAIRING') {
      const repStart = Date.now();
      job.metrics.repairAttempts++;
      job.stageMessage = `Analizando fallos con IA y aplicando correcciones específicas (intento ${job.metrics.repairAttempts}/${job.budget.maxRepairAttempts})...`;
      this.log(job, `Etapa REPAIRING: Analizando error ${job.verificationReport?.errors?.[0]?.message || 'desconocido'}`);
      this.saveJob(job);

      const firstError = job.verificationReport?.errors?.[0] || {
        stage: 'UNKNOWN',
        message: 'Error de verificación no identificado'
      };

      if (job.enableAI && ['BEHAVIOR_NOT_PROVEN', 'UNRESOLVED_ACCEPTANCE_SCENARIOS'].includes(firstError.code)) {
        job.repairFeedback = [firstError.code, ...(job.verificationReport.behaviorFailures || [])];
        job.status = 'GENERATING';
        this.log(job, 'Replanificando contratos generados con los fallos reales. Se conservan permisos y expectativas de prueba; se regenerará un paquete limpio.');
        job.metrics.stages.REPAIRING = { durationMs: (job.metrics.stages.REPAIRING?.durationMs || 0) + Date.now() - repStart };
        this.saveJob(job);
        this.schedulePipeline(job.id);
        return;
      }

      const repairResult = await codegenAiRepairService.proposeRepair(firstError, job.exportDirectory, { skipLiveAi: !job.enableAI });
      job.metrics.totalTokens += (repairResult.tokensUsed || 0);
      job.trace.push({ stage: 'REPAIR_PROPOSAL', ...repairResult.providerMetadata, tokensUsed: repairResult.tokensUsed || 0, applied: false });

      this.log(job, `IA Propuesta de reparación: ${repairResult.diagnosis}`);

      if (repairResult.canAutoApply) {
        const patchRes = codegenAiRepairService.applyFix(job.exportDirectory, repairResult);
        if (patchRes.applied) {
          job.temporaryExportRepairs = true;
          this.log(job, 'El parche de salida es temporal; ready=false hasta corregir el contrato o generador y comprobar una regeneración limpia.', 'WARN');
          this.log(job, `Parche aplicado con éxito en ${repairResult.targetFile} (${patchRes.bytesModified || 0} bytes modificados).`);
          // Preserve fix in project contracts/decisions so clean regeneration retains it
          if (repairResult.contractPatch) {
            await codegenDecisionService.persistPatch(job.projectId, repairResult.contractPatch);
            this.log(job, `Corrección persistida en el contrato del proyecto para que sobreviva a regeneraciones limpias.`);
          }
        } else {
          this.log(job, `No se pudo aplicar el parche automático: ${patchRes.reason}`, 'WARN');
        }
      }

      // Loop back to VALIDATING
      job.status = 'VALIDATING';
      job.metrics.stages.REPAIRING = {
        durationMs: (job.metrics.stages.REPAIRING?.durationMs || 0) + (Date.now() - repStart)
      };
      this.saveJob(job);

      // Re-trigger pipeline for re-validation
      this.schedulePipeline(job.id);
    }
  }

  /**
   * Submits a user decision response to a pending clarification question.
   */
  async submitInput(jobId, submission) {
    const job = this.getJob(jobId);
    if (!job) {
      throw new Error(`Trabajo no encontrado con ID '${jobId}'.`);
    }

    if (job.status !== 'WAITING_FOR_INPUT') {
      throw new Error(`El trabajo actual no está esperando respuestas (estado actual: ${job.status}).`);
    }

    const question = (job.questions || []).find(q => q.questionId === submission.questionId);
    if (!question) throw new Error('La pregunta no pertenece a las aclaraciones pendientes de este trabajo.');
    const answer = typeof submission.customAnswer === 'string' ? submission.customAnswer.trim() : '';
    const selected = question.options?.find(option => option.id === submission.selectedOptionId);
    if (!answer && !selected) throw new Error('Escribe tu respuesta o selecciona una opción antes de confirmar.');
    // Use the server's pending question to bind an answer to its actual operation.
    const data = question.source === 'GENERATION'
      ? { source: 'GENERATION', targetKind: question.targetKind, targetId: question.targetId, details: question.details }
      : selected?.data;
    const result = await codegenDecisionService.submitDecision(job.projectId, {
      ...submission, customAnswer: answer, requirementIds: question.requirementIds || [], data
    });

    // Save decision into job's record
    if (!job.decisions) job.decisions = {};
    job.decisions[submission.questionId] = result.decision;

    // Filter out answered question
    job.questions = (job.questions || []).filter(q => q.questionId !== submission.questionId);

    this.log(job, `Aclaración '${submission.questionId}' respondida: ${result.decision.label}`);

    // Answers cannot implement pending technical contracts. Do not spend more
    // provider tokens automatically when these blockers are still outstanding.
    if (job.questions.length === 0 && job.planningBlockers?.length) {
      job.status = 'BLOCKED';
      job.stageMessage = 'Respuestas guardadas. Quedan tareas de implementación técnica; no se reanudará la IA automáticamente.';
      this.saveJob(job);
      return { success: true, jobStatus: job.status, pendingQuestions: 0, technicalBlockers: job.planningBlockers.length, decision: result.decision };
    }

    // If all questions resolved, transition back to GENERATING and resume pipeline
    if (job.questions.length === 0) {
      job.status = job.clarificationResumeStage || 'ANALYZING';
      delete job.clarificationResumeStage;
      job.progress = 35;
      job.stageMessage = 'Aclaraciones confirmadas. Reanudando generación de código...';
      this.saveJob(job);

      this.schedulePipeline(job.id);
    } else {
      this.saveJob(job);
    }

    return {
      success: true,
      jobStatus: job.status,
      remainingQuestionsCount: job.questions.length,
      decision: result.decision
    };
  }

  /**
   * Cancels a running job.
   */
  async cancelJob(jobId) {
    const job = this.getJob(jobId);
    if (!job) return null;

    job.status = 'CANCELLED';
    job.stageMessage = 'Generación cancelada por el usuario.';
    this.log(job, 'Trabajo cancelado por el usuario.', 'WARN');
    this.saveJob(job);

    const pointerPath = getActiveJobPointerPath(job.projectId);
    if (fs.existsSync(pointerPath)) {
      try { fs.unlinkSync(pointerPath); } catch (_) {}
    }

    return job;
  }

  /**
   * Resumes an in-progress job after server restart or crash.
   */
  async resumeJob(jobId, options = {}) {
    const job = this.getJob(jobId);
    if (!job) throw new Error(`Trabajo no encontrado con ID '${jobId}'.`);
    if (job.enableAI) require('./codegenAiHold').assertAllowed(job.projectId);
    if (this.runningJobs.has(jobId) || this.queuedJobs.has(jobId)) {
      return { resumed: false, job, message: 'El trabajo ya está en ejecución.' };
    }
    if (options.batchReview === true && ['WAITING_FOR_INPUT', 'BLOCKED', 'INTERRUPTED'].includes(job.status)) {
      job.batchMode = true;
      const existing = job.analysisQuestions || [];
      job.analysisQuestions = [...existing, ...(job.questions || []).filter(q => q.source !== 'GENERATION' && !existing.some(old => old.questionId === q.questionId))];
      job.questions = [];
      job.planningBlockers = [];
      job.batchReview = { phase: 'OPERATIONS', completed: 0, total: 0, questions: [], blockers: [] };
      job.status = 'GENERATING';
      job.clarificationResumeStage = 'GENERATING';
      job.ready = false; job.zipSha256 = null; job.bundleManifest = null;
      job.stageMessage = 'Revisando todas las operaciones y pantallas en un solo lote...';
      this.saveJob(job);
    }
    if (job.status === 'WAITING_FOR_INPUT' && job.questions?.length) {
      const updated = await buildProjectSpec(job.projectId);
      const pending = job.questions.filter(question => !(question.source === 'GENERATION' && question.targetKind === 'OPERATION' &&
        updated.commandGroups?.some(group => group.parentOperationId === question.targetId) &&
        !updated.operations.some(operation => operation.operationId === question.targetId)));
      if (pending.length !== job.questions.length) {
        job.questions = pending;
        if (!pending.length) {
          job.status = job.clarificationResumeStage || 'GENERATING';
          delete job.clarificationResumeStage;
          job.planningBlockers = [];
          job.ready = false; job.zipSha256 = null; job.bundleManifest = null;
          job.stageMessage = 'Contratos revisados implementados. Reanudando sin repetir aclaraciones resueltas...';
        }
        this.saveJob(job);
      }
    }
    if (job.status === 'BLOCKED' && job.planningBlockers?.length) {
      const updated = await buildProjectSpec(job.projectId);
      const questions = require('./aiGenerationPipeline').collectCachedQuestions?.(job.projectId, updated) || [];
      if (questions.length) {
        job.status = 'WAITING_FOR_INPUT';
        job.questions = questions;
        job.clarificationResumeStage = 'GENERATING';
        job.planningBlockers = [];
        job.progress = 35;
        job.stageMessage = `La generación necesita tus respuestas (${questions.length} aclaraciones pendientes).`;
        this.log(job, job.stageMessage);
        return { resumed: true, job, message: 'Se recuperaron las aclaraciones pendientes sin nuevas llamadas a la IA.' };
      }
      const replaced = job.planningBlockers.every(blocker => !(updated.operations || []).some(op => op.operationId === blocker.operationId));
      if (replaced || (job.planningSpecHash && updated.hash !== job.planningSpecHash)) {
        job.status = 'GENERATING';
        job.planningBlockers = [];
        job.ready = false;
        job.zipSha256 = null;
        job.bundleManifest = null;
        job.stageMessage = 'Contratos actualizados. Reanudando el mismo trabajo...';
      }
    }

    const resumableStatuses = ['ANALYZING', 'GENERATING', 'VALIDATING', 'REPAIRING'];
    if (job.status === 'INTERRUPTED' && resumableStatuses.includes(job.resumeStage)) {
      job.status = job.resumeStage;
      delete job.resumeStage;
    }
    if (resumableStatuses.includes(job.status)) {
      if (job.status === 'GENERATING') job.planningBlockers = [];
      this.log(job, `Reanudando ejecución tras reinicio del servidor en estado ${job.status}...`);
      this.saveJob(job);
      this.schedulePipeline(job.id);
      return { resumed: true, job };
    }

    return { resumed: false, job, message: `El trabajo está en estado ${job.status} y no requiere reanudación activa.` };
  }
}

module.exports = new CodegenJobService();

