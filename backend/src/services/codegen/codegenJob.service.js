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
    this.loadPersistedActiveJobs();
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
    if (this.memoryJobs.has(jobId)) {
      return this.memoryJobs.get(jobId);
    }
    const filePath = getJobFilePath(jobId);
    if (fs.existsSync(filePath)) {
      try {
        const job = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.memoryJobs.set(job.id, job);
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
          if (job && !['CANCELLED', 'FAILED'].includes(job.status)) return job;
        }
      } catch (_) {}
    }

    // Fallback: search in memory
    for (const job of this.memoryJobs.values()) {
      if (job.projectId === projectId && !['CANCELLED', 'FAILED'].includes(job.status)) {
        return job;
      }
    }
    return null;
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
    // 1. Check for existing active job to avoid duplication
    const existing = this.getActiveJob(projectId);
    const inProgressStatuses = ['ANALYZING', 'WAITING_FOR_INPUT', 'GENERATING', 'VALIDATING', 'REPAIRING'];
    if (existing && inProgressStatuses.includes(existing.status)) {
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
      scope: options.scope || 'Cliente → Vehículo → Recepción',
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
        maxTokens: options.maxTokens || 250000,
        maxRepairAttempts: options.maxRepairAttempts || 5,
        timeoutMs: options.timeoutMs || 600000
      },
      error: null
    };

    this.log(job, `Trabajo de generación asistida creado para el proyecto ${projectId}.`);
    this.saveJob(job);

    // Run pipeline asynchronously
    setImmediate(() => {
      this.runPipeline(job.id).catch(err => {
        console.error('[CodegenJobService] Pipeline error:', err);
        const j = this.getJob(jobId);
        if (j) {
          j.status = 'FAILED';
          j.error = { message: err.message, stack: err.stack };
          j.stageMessage = `Fallo crítico: ${err.message}`;
          this.log(j, `Fallo crítico en el pipeline: ${err.message}`, 'ERROR');
          this.saveJob(j);
        }
      });
    });

    return job;
  }

  /**
   * Main asynchronous pipeline runner.
   */
  async runPipeline(jobId) {
    const job = this.getJob(jobId);
    if (!job || job.status === 'CANCELLED') return;

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
      const pendingQuestions = await codegenDecisionService.getPendingDecisions(job.projectId);

      if (pendingQuestions && pendingQuestions.length > 0) {
        job.status = 'WAITING_FOR_INPUT';
        job.progress = 25;
        job.questions = pendingQuestions;
        job.stageMessage = `Se requieren aclaraciones de negocio (${pendingQuestions.length} pendientes).`;
        this.log(job, `Etapa WAITING_FOR_INPUT: Esperando respuesta a ${pendingQuestions.length} aclaraciones.`);
        this.saveJob(job);
        return; // Pause pipeline until user submits decisions
      }

      // No pending decisions, transition to GENERATING
      job.status = 'GENERATING';
      this.saveJob(job);
    }

    // ==========================================
    // STAGE 2: GENERATING
    // ==========================================
    if (job.status === 'GENERATING') {
      const genStart = Date.now();
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
      const result = await codeGenerator.generateProjectFiles(job.projectId, {
        spec,
        reviewOnly: true
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

      const exportDir = fs.mkdtempSync(path.join(verifRoot, 'autron5-review-'));
      for (const file of result.files) {
        const target = path.resolve(exportDir, file.path);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, file.content || '');
      }

      const zipPath = exportDir + '.zip';
      fs.writeFileSync(zipPath, createZipBuffer(result.files));

      job.exportDirectory = exportDir;
      job.zipPath = zipPath;
      job.generatedFilesCount = result.files.length;
      job.metrics.stages.GENERATING = { durationMs: Date.now() - genStart };

      this.log(job, `Generados ${result.files.length} archivos en directorio aislado: ${path.basename(exportDir)}.`);

      // Update pointer file for last export
      const lastExportMeta = {
        directory: exportDir,
        zip: zipPath,
        ready: false,
        reviewOnly: true,
        files: result.files.length,
        blockers: result.diagnostics?.errors || []
      };
      try {
        fs.writeFileSync(path.join(verifRoot, 'autron5-last-export.json'), JSON.stringify(lastExportMeta, null, 2), 'utf8');
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

      let spec = null;
      try {
        spec = JSON.parse(fs.readFileSync(path.join(job.exportDirectory, 'icase.spec.json'), 'utf8'));
      } catch (_) {
        spec = await buildProjectSpec(job.projectId).catch(() => ({}));
      }

      const report = await codegenVerificationService.runVerification(job.exportDirectory, spec, {
        onProgress: update => {
          if (update.check) {
            this.log(job, `PASS: ${update.check}`);
          } else if (update.error) {
            this.log(job, `FAIL: [${update.error.stage}] ${update.error.message}`, 'WARN');
          }
        }
      });

      job.verificationReport = report;
      job.metrics.stages.VALIDATING = { durationMs: Date.now() - valStart };

      if (report.passed) {
        // Verification succeeded!
        job.status = 'COMPLETED';
        job.progress = 100;
        job.stageMessage = 'Aplicación generada y verificada exitosamente en entorno aislado.';
        job.metrics.finishedAt = new Date().toISOString();
        job.metrics.durationMs = Date.now() - startTime;

        this.log(job, `COMPLETED: Se completaron ${report.checks.length} comprobaciones exitosas. Scope: ${report.scope}.`);
        this.saveJob(job);
        return;
      }

      // Verification failed
      this.log(job, `Fallo en verificación (${report.errors.length} errores).`, 'WARN');

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

      const repairResult = await codegenAiRepairService.proposeRepair(firstError, job.exportDirectory);
      job.metrics.totalTokens += (repairResult.tokensUsed || 0);

      this.log(job, `IA Propuesta de reparación: ${repairResult.diagnosis}`);

      if (repairResult.canAutoApply) {
        const patchRes = codegenAiRepairService.applyFix(job.exportDirectory, repairResult);
        if (patchRes.applied) {
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
      setImmediate(() => this.runPipeline(job.id));
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

    // Persist decision via Decision Service
    const result = await codegenDecisionService.submitDecision(job.projectId, submission);

    // Save decision into job's record
    if (!job.decisions) job.decisions = {};
    job.decisions[submission.questionId] = result.decision;

    // Filter out answered question
    job.questions = (job.questions || []).filter(q => q.questionId !== submission.questionId);

    this.log(job, `Aclaración '${submission.questionId}' respondida: ${result.decision.label}`);

    // If all questions resolved, transition back to GENERATING and resume pipeline
    if (job.questions.length === 0) {
      job.status = 'GENERATING';
      job.progress = 35;
      job.stageMessage = 'Aclaraciones confirmadas. Reanudando generación de código...';
      this.saveJob(job);

      setImmediate(() => this.runPipeline(job.id));
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
  async resumeJob(jobId) {
    const job = this.getJob(jobId);
    if (!job) throw new Error(`Trabajo no encontrado con ID '${jobId}'.`);

    const resumableStatuses = ['ANALYZING', 'GENERATING', 'VALIDATING', 'REPAIRING'];
    if (resumableStatuses.includes(job.status)) {
      this.log(job, `Reanudando ejecución tras reinicio del servidor en estado ${job.status}...`);
      this.saveJob(job);
      setImmediate(() => {
        this.runPipeline(job.id).catch(err => {
          this.log(job, `Error al reanudar: ${err.message}`, 'ERROR');
          job.status = 'FAILED';
          this.saveJob(job);
        });
      });
      return { resumed: true, job };
    }

    return { resumed: false, job, message: `El trabajo está en estado ${job.status} y no requiere reanudación activa.` };
  }
}

module.exports = new CodegenJobService();

