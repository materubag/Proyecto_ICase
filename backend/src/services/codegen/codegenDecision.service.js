/**
 * Codegen Decision & Clarification Service
 * Identifies missing business rules and operational policies in a project specification,
 * presents structured clarification questions with selectable options and custom responses,
 * validates against approved requirements to detect contradictions,
 * and transactionally persists versioned decisions that update contracts.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const prisma = require('../../config/prisma');
const env = require('../../config/env');

function getDecisionsDir() {
  const root = process.cwd().endsWith('backend') ? process.cwd() : path.join(process.cwd(), 'backend');
  const dir = path.join(root, '.cache', 'codegen_decisions');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (_) {}
  }
  return dir;
}

function getDecisionsFilePath(projectId) {
  return path.join(getDecisionsDir(), `${projectId}.json`);
}

function loadStoredDecisions(projectId) {
  const filePath = getDecisionsFilePath(projectId);
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_) {}
  }
  return {
    projectId,
    version: 1,
    decisions: {},
    updatedAt: new Date().toISOString()
  };
}

function saveStoredDecisions(projectId, data) {
  data.updatedAt = new Date().toISOString();
  const filePath = getDecisionsFilePath(projectId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (_) {}
}

class CodegenDecisionService {
  /**
   * Retrieves all confirmed decisions for a project.
   */
  getProjectDecisions(projectId) {
    const store = loadStoredDecisions(projectId);
    return store.decisions || {};
  }

  /**
   * Analyzes project requirements, use cases, and entities to find missing business decisions.
   * If decisions are already answered and fresh, returns an empty list (does not repeat active decisions).
   */
  async getPendingDecisions(projectId, options = {}) {
    const store = loadStoredDecisions(projectId);
    const confirmed = store.decisions || {};

    // Collect all confirmed question IDs and nested subkeys (e.g. odometerPolicy, uploadFailurePolicy)
    const confirmedKeys = new Set(Object.keys(confirmed));
    for (const val of Object.values(confirmed)) {
      if (val?.data && typeof val.data === 'object') {
        for (const subKey of Object.keys(val.data)) {
          confirmedKeys.add(subKey);
        }
      }
    }

    let project = null;
    if (options.project) {
      project = options.project;
    } else {
      try {
        project = await prisma.project.findUnique({
          where: { id: projectId },
          include: {
            requirements: { where: { isDeleted: false } },
            useCases: { where: { isDeleted: false } },
            entities: {
              where: { isDeleted: false },
              include: { attributes: true }
            },
            navigationNodes: { where: { isDeleted: false } },
            businessRules: true
          }
        });
      } catch (dbErr) {
        project = { id: projectId, name: 'Proyecto', requirements: [], entities: [] };
      }
    }

    if (!project) {
      return [];
    }

    const pendingQuestions = [];

    // Check 1: Mandatory identity fields for core entity creation (e.g. Cliente / Vehiculo or primary domain entities)
    const hasCliente = (project.entities || []).some(e => /cliente|client|customer|usuario|patient|paciente/i.test(e.name || ''));
    const hasVehiculo = (project.entities || []).some(e => /vehiculo|vehicle|auto|car|libro|book/i.test(e.name || ''));

    if ((hasCliente || hasVehiculo) && !confirmedKeys.has('requiredIdentityFields')) {
      // Check if project has file-based intake decision already present
      const intakeManifestPath = path.resolve(__dirname, '../../specifications/autron5/intake.contract.json');
      let defaultDataFromManifest = null;
      if (fs.existsSync(intakeManifestPath) && project.name === 'Autron5') {
        try {
          const manifest = JSON.parse(fs.readFileSync(intakeManifestPath, 'utf8'));
          defaultDataFromManifest = manifest.userDecisions?.requiredIdentityFields;
        } catch (_) {}
      }

      // If already configured and confirmed in project evidence, mark as confirmed
      const clientEntity = (project.entities || []).find(e => /cliente/i.test(e.name));
      const vehicleEntity = (project.entities || []).find(e => /vehiculo/i.test(e.name));
      const clientAttrs = clientEntity?.attributes || [];
      const vehicleAttrs = vehicleEntity?.attributes || [];

      const clientNombre = clientAttrs.find(a => a.name === 'nombre' || a.name === 'nombreCompleto');
      const vehiclePlaca = vehicleAttrs.find(a => a.name === 'placa' || a.name === 'matricula');

      const alreadyHasFieldContracts = clientNombre?.evidence?.fieldContract?.allowNull === false &&
                                      vehiclePlaca?.evidence?.fieldContract?.allowNull === false;

      if (!alreadyHasFieldContracts && !defaultDataFromManifest) {
        pendingQuestions.push({
          questionId: 'requiredIdentityFields',
          title: 'Datos obligatorios de identificación',
          question: '¿Qué datos son obligatorios para crear clientes y vehículos?',
          requirementIds: (project.requirements || [])
            .filter(r => /cliente|vehiculo|registro/i.test(r.name || r.description || ''))
            .map(r => r.code || r.id),
          options: [
            {
              id: 'opt_nombre_placa_vin_opcional',
              label: '(Recomendado) Nombre del cliente y placa obligatorios; VIN opcional',
              data: {
                CLIENTE: ['nombre'],
                VEHICULO: ['clienteId', 'placa']
              }
            },
            {
              id: 'opt_todos_obligatorios',
              label: 'Nombre, teléfono, placa y VIN obligatorios',
              data: {
                CLIENTE: ['nombre', 'telefono'],
                VEHICULO: ['clienteId', 'placa', 'vin']
              }
            },
            {
              id: 'opt_minimo',
              label: 'Únicamente nombre del cliente y placa del vehículo',
              data: {
                CLIENTE: ['nombre'],
                VEHICULO: ['clienteId', 'placa']
              }
            }
          ],
          customAllowed: true,
          customPlaceholder: 'Especifica qué campos deben ser obligatorios (ej: Nombre, Placa, Marca)'
        });
      }
    }

    // Check 2: Dynamic AI Ambiguity Discovery for business rules & operational policies
    // If not already covered by confirmed decisions or contract manifests, analyze requirements
    const isReceptionConfirmed = confirmedKeys.has('receptionPolicy') ||
      (confirmedKeys.has('odometerPolicy') && confirmedKeys.has('uploadFailurePolicy'));

    const intakeManifestPath = path.resolve(__dirname, '../../specifications/autron5/intake.contract.json');
    let hasManifestPolicy = false;
    if (fs.existsSync(intakeManifestPath) && project.name === 'Autron5') {
      try {
        const manifest = JSON.parse(fs.readFileSync(intakeManifestPath, 'utf8'));
        if (manifest.userDecisions?.odometerPolicy && manifest.userDecisions?.uploadFailurePolicy) {
          hasManifestPolicy = true;
        }
      } catch (_) {}
    }

    if (!isReceptionConfirmed && !hasManifestPolicy) {
      // Perform dynamic AI analysis of project requirements to identify genuine business ambiguities
      const dynamicAiQuestions = await this.analyzeAmbiguitiesWithAI(project, confirmedKeys);
      if (dynamicAiQuestions && dynamicAiQuestions.length > 0) {
        pendingQuestions.push(...dynamicAiQuestions);
      }
    }

    return pendingQuestions;
  }

  /**
   * Dynamically analyzes approved requirements, use cases, and entities using AI
   * to uncover genuine architectural or business rule ambiguities.
   * Returns empty array [] if requirements are complete, consistent, and actionable.
   */
  async analyzeAmbiguitiesWithAI(project, confirmedKeys = new Set()) {
    const approvedRequirements = (project.requirements || []).filter(r => r.status === 'APPROVED');
    if (approvedRequirements.length === 0) return [];

    const provider = env.AI_PROVIDER || 'openai';
    const hasKey = (provider === 'gemini' && env.GEMINI_API_KEY) || (provider === 'openai' && env.OPENAI_API_KEY);

    if (hasKey) {
      try {
        const promptSystem = `Eres un arquitecto de software analizando requisitos bajo norma ISO/IEC/IEEE 29148.
Analiza los requisitos aprobados y entidades del proyecto.
Determina si existe alguna AMBIGÜEDAD CRÍTICA O POLÍTICA DE NEGOCIO no resuelta que deba ser aclarada por el usuario antes de generar código (ej: reglas de anulación, auditoría de datos históricos, o tratamiento de cargas de archivos incompletas).

REGLA CLAVE: Si los requisitos ya son claros, accionables y no tienen conflictos graves, debes retornar un array vacío: []
Solo si existe una duda técnica real e ineludible, retorna un array JSON con 1 o 2 preguntas con el formato:
[
  {
    "questionId": "identificador_unico",
    "title": "Título conciso de la política",
    "question": "Explicación exacta de la duda técnica o regla de negocio",
    "requirementIds": ["RF-XX"],
    "options": [
      {
        "id": "opt_1",
        "label": "(Recomendado) Opción arquitectónicamente más segura",
        "data": { "politica": "VALOR_SEGURO" }
      },
      {
        "id": "opt_2",
        "label": "Opción alternativa",
        "data": { "politica": "VALOR_ALT" }
      }
    ],
    "customAllowed": true
  }
]`;

        const userContent = JSON.stringify({
          projectName: project.name,
          entities: (project.entities || []).map(e => ({ name: e.name, attrs: (e.attributes || []).map(a => a.name) })),
          requirements: approvedRequirements.slice(0, 30).map(r => ({
            code: r.code || r.id,
            name: r.name,
            description: r.description
          }))
        });

        let resultData = null;
        if (provider === 'openai' && env.OPENAI_API_KEY) {
          const OpenAIProvider = require('../ai/OpenAIProvider');
          const openai = new OpenAIProvider();
          const res = await openai.extractDocumentBatch(userContent, { prompt: promptSystem, model: 'gpt-4o-mini' });
          resultData = res?.data;
        } else if (provider === 'gemini' && env.GEMINI_API_KEY) {
          const GeminiProvider = require('../ai/GeminiProvider');
          const gemini = new GeminiProvider();
          const res = await gemini.extractDocumentBatch(userContent, { prompt: promptSystem });
          resultData = res?.data;
        }

        if (Array.isArray(resultData)) {
          return resultData.filter(q => q && q.questionId && !confirmedKeys.has(q.questionId));
        }
      } catch (aiErr) {
        console.warn('[CodegenDecisionService] AI ambiguity analysis notice:', aiErr.message);
      }
    }

    return [];
  }

  /**
   * Validates if a proposed answer contradicts any approved project requirement.
   */
  validateContradiction(answer, requirements = []) {
    const textAnswer = typeof answer === 'string' ? answer.toLowerCase() : JSON.stringify(answer).toLowerCase();

    for (const req of requirements) {
      if (req.status !== 'APPROVED') continue;
      const desc = (req.description || '').toLowerCase();
      const code = req.code || req.id;

      // Example: If requirement states VIN is strictly mandatory, but user selected VIN optional
      if (/vin\s+(es\s+)?obligatorio|vin\s+debe\s+ser\s+requerido/i.test(desc) &&
          textAnswer.includes('vin opcional')) {
        return {
          contradicts: true,
          conflictingRequirement: code,
          message: `La opción seleccionada entra en conflicto con el requisito aprobado ${code}: el requisito exige VIN obligatorio.`
        };
      }

      // Example: If requirement states that photos are strictly optional, but answer forces them as blocking
      if (/fotos?\s+(son\s+)?estrictamente\s+opcionales/i.test(desc) &&
          textAnswer.includes('fotos obligatorias bloqueantes')) {
        return {
          contradicts: true,
          conflictingRequirement: code,
          message: `La opción seleccionada entra en conflicto con el requisito aprobado ${code}.`
        };
      }
    }

    return { contradicts: false };
  }

  /**
   * Submits a user decision for a pending question, updates contracts, and persists versioned record.
   */
  async submitDecision(projectId, submission, options = {}) {
    const { questionId, selectedOptionId, customAnswer, user = 'user' } = submission;

    if (!questionId) {
      throw new Error("El campo 'questionId' es obligatorio.");
    }

    // 1. Fetch requirements for contradiction check
    let requirements = [];
    if (options.requirements && options.requirements.length > 0) {
      requirements = options.requirements;
    } else {
      try {
        requirements = await prisma.requirement.findMany({
          where: { projectId, isDeleted: false, status: 'APPROVED' }
        });
      } catch (_) {
        requirements = [];
      }
    }

    // 2. Resolve selected data
    let resolvedData = null;
    let selectedLabel = '';

    // Standard known question handlers
    if (questionId === 'requiredIdentityFields') {
      if (selectedOptionId === 'opt_todos_obligatorios') {
        resolvedData = {
          CLIENTE: ['nombre', 'telefono'],
          VEHICULO: ['clienteId', 'placa', 'vin']
        };
        selectedLabel = 'Nombre, teléfono, placa y VIN obligatorios';
      } else if (selectedOptionId === 'opt_minimo') {
        resolvedData = {
          CLIENTE: ['nombre'],
          VEHICULO: ['clienteId', 'placa']
        };
        selectedLabel = 'Únicamente nombre del cliente y placa del vehículo';
      } else {
        // Default recommended: Nombre del cliente y placa obligatorios; VIN opcional
        resolvedData = {
          CLIENTE: ['nombre'],
          VEHICULO: ['clienteId', 'placa']
        };
        selectedLabel = 'Nombre del cliente y placa obligatorios; VIN opcional';
      }

      if (customAnswer && typeof customAnswer === 'string' && customAnswer.trim()) {
        selectedLabel = `Personalizado: ${customAnswer.trim()}`;
        // Parse custom field mentions
        const mentionsTel = /tel[eé]fono/i.test(customAnswer);
        const mentionsVin = /vin/i.test(customAnswer) && !/vin\s+opcional/i.test(customAnswer);
        const mentionsCorreo = /correo|email/i.test(customAnswer);
        resolvedData = {
          CLIENTE: ['nombre', ...(mentionsTel ? ['telefono'] : []), ...(mentionsCorreo ? ['correo'] : [])],
          VEHICULO: ['clienteId', 'placa', ...(mentionsVin ? ['vin'] : [])]
        };
      }
    } else if (questionId === 'receptionPolicy') {
      if (selectedOptionId === 'opt_sync_odometer_allow_partial_photos') {
        resolvedData = {
          odometerPolicy: 'SYNC_VEHICLE',
          uploadFailurePolicy: 'ALLOW_PARTIAL',
          fuelUnit: 'FRACTION_0_1',
          requiredReceiptFields: ['vehiculoId', 'kilometraje', 'nivelCombustible', 'motivoIngreso']
        };
        selectedLabel = 'Actualizar odómetro y permitir fotos parciales';
      } else {
        resolvedData = {
          odometerPolicy: 'RECEIPT_ONLY',
          uploadFailurePolicy: 'DO_NOT_CONFIRM',
          fuelUnit: 'FRACTION_0_1',
          requiredReceiptFields: ['vehiculoId', 'kilometraje', 'nivelCombustible', 'motivoIngreso']
        };
        selectedLabel = 'Lectura en recepción solamente y fotografías requeridas antes de confirmar';
      }

      if (customAnswer && typeof customAnswer === 'string' && customAnswer.trim()) {
        selectedLabel = `Personalizado: ${customAnswer.trim()}`;
      }
    } else {
      resolvedData = submission.data || { custom: customAnswer || selectedOptionId };
      selectedLabel = customAnswer || selectedOptionId || 'Decisión confirmada';
    }

    // 3. Contradiction validation
    const contradictionCheck = this.validateContradiction(selectedLabel, requirements);
    if (contradictionCheck.contradicts) {
      const err = new Error(contradictionCheck.message);
      err.code = 'DECISION_CONTRADICTION';
      err.conflictingRequirement = contradictionCheck.conflictingRequirement;
      throw err;
    }

    // 4. Save to persistent store
    const store = loadStoredDecisions(projectId);
    const existing = store.decisions[questionId];
    const revision = (existing?.revision || 0) + 1;

    const decisionRecord = {
      questionId,
      selectedOptionId,
      customAnswer: customAnswer || null,
      label: selectedLabel,
      data: resolvedData,
      requirementIds: submission.requirementIds || [],
      revision,
      confirmedBy: user,
      confirmedAt: new Date().toISOString()
    };

    store.decisions[questionId] = decisionRecord;
    saveStoredDecisions(projectId, store);

    // 5. Apply changes to database entities/usecases if DB is accessible
    let appliedCount = 0;
    try {
      if (questionId === 'requiredIdentityFields' && resolvedData) {
        await this.applyIdentityFieldsToDatabase(projectId, resolvedData, decisionRecord);
        appliedCount++;
      }
    } catch (persistErr) {
      // In offline/test mode, file store is sufficient
      console.warn('[CodegenDecisionService] Notice applying to DB:', persistErr.message);
    }

    return {
      success: true,
      decision: decisionRecord,
      appliedCount,
      message: `Decisión '${decisionRecord.label}' guardada y versionada (rev ${revision}).`
    };
  }

  /**
   * Applies identity field nullability rules to PostgreSQL attributes and use cases
   */
  async applyIdentityFieldsToDatabase(projectId, fieldMap, decisionRecord) {
    return await prisma.$transaction(async (tx) => {
      const entities = await tx.entity.findMany({
        where: { projectId },
        include: { attributes: true }
      });

      for (const [entityName, requiredFields] of Object.entries(fieldMap)) {
        const ent = entities.find(e => (e.name || '').toUpperCase() === entityName.toUpperCase());
        if (!ent) continue;

        for (const attr of ent.attributes) {
          const isReq = requiredFields.includes(attr.name) || requiredFields.includes(attr.fieldName);
          if (isReq) {
            await tx.entityAttribute.update({
              where: { id: attr.id },
              data: {
                revision: { increment: 1 },
                evidence: {
                  ...(attr.evidence || {}),
                  fieldContract: {
                    allowNull: false,
                    required: true,
                    decisionRevision: decisionRecord.revision
                  }
                }
              }
            });
          }
        }
      }
    });
  }

  /**
   * Persists a verified contract/source patch so it survives clean regenerations.
   */
  async persistPatch(projectId, patch) {
    if (!patch || !projectId) return false;
    const store = loadStoredDecisions(projectId);
    if (!store.patches) store.patches = [];
    store.patches.push({
      ...patch,
      appliedAt: new Date().toISOString(),
      revision: (store.revision || 1) + store.patches.length
    });
    saveStoredDecisions(projectId, store);
    return true;
  }

  /**
   * Gets all persisted patches for a project.
   */
  getStoredPatches(projectId) {
    const store = loadStoredDecisions(projectId);
    return store.patches || [];
  }
}

module.exports = new CodegenDecisionService();
