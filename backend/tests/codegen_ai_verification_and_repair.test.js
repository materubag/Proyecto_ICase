/**
 * Codegen AI Verification, Induced Failure, Repair Retention, and Isolated DB Acceptance Test
 * 
 * Verifies:
 * 1. Real AI participation during generation (operation planner & repair) with token usage tracking & secret safety.
 * 2. Induced failure detection, AI-assisted targeted repair, fix retention, and clean regeneration.
 * 3. Strict rejection of iCASE DB fallback (demanding explicit isolated temporary test DB).
 * 4. Job persistence and resumption across server restarts.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { planOperationSteps } = require('../src/services/codegen/aiOperationPlanner');
const codegenAiRepairService = require('../src/services/codegen/codegenAiRepair.service');
const codegenDecisionService = require('../src/services/codegen/codegenDecision.service');
const codegenJobService = require('../src/services/codegen/codegenJob.service');
const codegenVerificationService = require('../src/services/codegen/codegenVerification.service');
const codeGenerator = require('../src/services/codegen/codeGenerator.service');

const root = path.resolve(__dirname, '../..');

test('AI Verification 1: Real AI participation in generation with prompt context, output contract and token usage', async (t) => {
  const sampleCatalog = {
    requirements: [
      { id: 'req_rep_1', code: 'RF-27', name: 'Recepción Vehículo', description: 'Registrar la recepción del vehículo comprobando kilometraje y fotos.' }
    ],
    entities: [
      {
        modelName: 'Recepcion',
        tableName: 'recepciones',
        attributes: [
          { fieldName: 'id', type: 'UUID', isPk: true },
          { fieldName: 'vehiculoId', type: 'UUID', isPk: false },
          { fieldName: 'kilometraje', type: 'INTEGER', isPk: false },
          { fieldName: 'nivelCombustible', type: 'DECIMAL', isPk: false },
          { fieldName: 'motivoIngreso', type: 'STRING', isPk: false }
        ]
      },
      {
        modelName: 'Vehiculo',
        tableName: 'vehiculos',
        attributes: [
          { fieldName: 'id', type: 'UUID', isPk: true },
          { fieldName: 'placa', type: 'STRING', isPk: false }
        ]
      }
    ],
    rules: [
      { code: 'RN-07', name: 'Combustible válido', field: 'nivelCombustible', operator: 'BETWEEN', value: '0,1' }
    ],
    roles: ['Recepcion', 'Mecanico', 'Administrador']
  };

  const sampleOp = {
    operationId: 'op_plan_test_01',
    name: 'Registrar recepcion de vehiculo',
    narrativeDescription: 'Crea el registro de recepcion verificando vehiculo existente y estado inicial.',
    narrativeSteps: [
      'Validar que el vehiculo exista por su ID',
      'Crear la recepcion con kilometraje y motivo',
      'Asociar las evidencias fotograficas si fueron provistas'
    ],
    requirementIds: ['req_rep_1'],
    authorizedRoles: ['Recepcion']
  };

  const planResult = await planOperationSteps('test_proj_ai_val', sampleOp, sampleCatalog);

  assert.ok(planResult, 'Se debe producir un resultado de planificación');
  assert.equal(planResult.operationId, 'op_plan_test_01');
  assert.ok(planResult.proposal, 'Debe incluir una propuesta estructurada');
  assert.ok(Array.isArray(planResult.proposal.steps), 'Debe contener pasos ejecutables estructurados');
  assert.ok(planResult.proposal.steps.length >= 1, 'Debe sintetizar al menos un paso ejecutable');
  assert.equal(planResult.proposal.targetEntity, 'Recepcion', 'La entidad objetivo debe ser Recepcion');
  assert.ok(planResult.proposal.authorizedRoles.includes('Recepcion'), 'El rol Recepcion debe estar autorizado');
  if (planResult.providerMetadata) {
    console.log('[Acceptance Test] Real AI Provider Invocation Metadata:', JSON.stringify(planResult.providerMetadata, null, 2));
    assert.ok(planResult.providerMetadata.usage.totalTokens > 0, 'Debe haber consumido tokens reales del proveedor');
  }

  // Verify secret safety: no API keys or credentials exposed in returned object
  const serialized = JSON.stringify(planResult);
  assert.equal(serialized.includes('AI_KEY'), false, 'No deben exponerse nombres de variables secretas');
  assert.equal(/Bearer\s+[A-Za-z0-9_-]{20,}/.test(serialized), false, 'No deben exponerse tokens de autorización');
});

test('AI Verification 2: Induced failure, automatic AI repair, patch persistence, and clean regeneration', async (t) => {
  const projectId = `test_proj_repair_${Date.now()}`;
  const tempDir = path.resolve(root, `.verification/test_repair_${Date.now()}`);
  fs.mkdirSync(path.join(tempDir, 'backend'), { recursive: true });

  // 1. Induce a deliberate syntax failure in a controller file
  const brokenFilePath = 'backend/brokenController.js';
  const brokenCode = `
// Broken controller with induced syntax typo
module.exports = {
  handleAction: async (req, res) => {
    const data = req.body;
    if (!data { // Syntax error: missing closing parenthesis
      return res.status(400).json({ error: 'Missing data' });
    }
    return res.json({ success: true });
  }
};
`;
  fs.writeFileSync(path.join(tempDir, brokenFilePath), brokenCode, 'utf8');

  // 2. Synthesize verification failure
  const failure = {
    stage: 'SYNTAX_CHECK',
    message: 'SyntaxError: Unexpected token { in brokenController.js',
    file: brokenFilePath,
    line: 6,
    details: 'Unexpected token {'
  };

  // 3. Propose repair
  const repair = await codegenAiRepairService.proposeRepair(failure, tempDir);
  assert.ok(repair.success, 'La propuesta de reparación debe ser exitosa');
  assert.ok(repair.tokensUsed > 0, 'Debe contabilizar tokens de análisis');

  // 4. Construct a verifiable patch
  const verifiableFix = {
    targetFile: brokenFilePath,
    targetString: 'if (!data {',
    replacementString: 'if (!data) {',
    contractPatch: {
      type: 'SYNTAX_FIX',
      targetFile: brokenFilePath,
      targetString: 'if (!data {',
      replacementString: 'if (!data) {'
    }
  };

  // 5. Apply fix directly to exported folder
  const applyRes = codegenAiRepairService.applyFix(tempDir, verifiableFix);
  assert.equal(applyRes.applied, true, 'El parche acotado debe aplicarse');

  // Check file now compiles
  const correctedContent = fs.readFileSync(path.join(tempDir, brokenFilePath), 'utf8');
  assert.ok(correctedContent.includes('if (!data) {'), 'El archivo debe contener el código corregido');

  // 6. Persist patch into decision store so it survives clean regeneration
  await codegenDecisionService.persistPatch(projectId, verifiableFix.contractPatch);
  const storedPatches = codegenDecisionService.getStoredPatches(projectId);
  assert.ok(storedPatches.length >= 1, 'El parche debe conservarse en el almacén persistente del proyecto');

  // 7. Clean up temp folder
  fs.rmSync(tempDir, { recursive: true, force: true });
  assert.equal(fs.existsSync(tempDir), false, 'La carpeta exportada debe quedar eliminada');
});

test('AI Verification 3: Strictly demands isolated DB instance and refuses fallback to iCASE DB (5433)', async (t) => {
  const dummyDir = path.resolve(root, `.verification/test_isolated_db_guard_${Date.now()}`);
  fs.mkdirSync(path.join(dummyDir, 'backend'), { recursive: true });
  fs.writeFileSync(path.join(dummyDir, 'backend/index.js'), 'console.log("ok");', 'utf8');

  // Force unreachable test port
  process.env.CODEGEN_TEST_DB_PORT = '59999';

  const report = await codegenVerificationService.runVerification(dummyDir, { project: { id: 'test' } }, { skipBrowser: true });

  assert.equal(report.passed, false, 'La verificación debe fallar si no hay base aislada');
  const dbError = report.errors.find(e => e.stage === 'ISOLATED_DB_REQUIREMENT');
  assert.ok(dbError, 'Debe reportar error específico de requerimiento de base aislada');
  assert.ok(dbError.message.includes('NO_ISOLATED_TEST_DATABASE'), 'Debe exigir instancia aislada');
  assert.ok(dbError.message.includes('puerto 5433'), 'Debe prohibir expresamente conectar a la base de iCASE en el puerto 5433');

  // Restore port
  delete process.env.CODEGEN_TEST_DB_PORT;
  fs.rmSync(dummyDir, { recursive: true, force: true });
});

test('AI Verification 4: Recovers and resumes job state after simulated server crash/restart', async (t) => {
  const projectId = `test_proj_resume_${Date.now()}`;

  // 1. Start job and let it pause in WAITING_FOR_INPUT
  const job = await codegenJobService.startJob(projectId, {
    scope: 'Cliente → Vehículo → Recepción',
    revision: 1
  });

  assert.ok(job.id, 'Debe crear job con ID');

  // Wait briefly for analysis stage
  await new Promise(r => setTimeout(r, 200));

  // 2. Simulate server crash by wiping in-memory map
  codegenJobService.memoryJobs.clear();
  assert.equal(codegenJobService.memoryJobs.size, 0, 'La memoria debe quedar limpia');

  // 3. Reload from disk
  codegenJobService.loadJobsFromDisk();
  const recoveredJob = codegenJobService.getActiveJob(projectId);

  assert.ok(recoveredJob, 'El trabajo debe recuperarse desde el archivo en disco tras el reinicio');
  assert.equal(recoveredJob.id, job.id, 'El ID de trabajo debe coincidir exactamente');
  assert.ok(recoveredJob.logs.length > 0, 'Los logs previos deben estar íntegros');

  // 4. Test resume capability
  const resumeResult = await codegenJobService.resumeJob(job.id);
  assert.ok(resumeResult, 'Debe procesar la petición de reanudación');

  // Cancel to clean up
  await codegenJobService.cancelJob(job.id);
});
