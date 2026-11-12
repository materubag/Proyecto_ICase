const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const codegenJobService = require('../src/services/codegen/codegenJob.service');
const codegenDecisionService = require('../src/services/codegen/codegenDecision.service');
const codeGenerator = require('../src/services/codegen/codeGenerator.service');
const { buildProjectSpec } = require('../src/services/codegen/projectSpecBuilder');
const { createZipBuffer } = require('../src/services/codegen/zipHelper');

const AUTRON_PROJECT_ID = '6ba45264-e3e6-4819-a0dd-18909f1fb674';

test('Autron5 Full Lifecycle Acceptance: Generar Código -> Decisión -> Generación -> Verificación -> Regeneración Idéntica', {
  skip: process.env.AUTRON5_LIVE_ACCEPTANCE !== 'true' && 'Requires AUTRON5_LIVE_ACCEPTANCE=true and an explicitly configured Autron5 database'
}, async () => {
  // 1. Iniciar trabajo persistente simulando presión del botón "Generar código"
  const job = await codegenJobService.startJob(AUTRON_PROJECT_ID, {
    scope: 'Cliente → Vehículo → Recepción',
    maxTokens: 50000,
    maxRepairAttempts: 3
  });

  assert.ok(job.id.startsWith('job_'), 'Trabajo creado con identificador persistente');
  assert.equal(job.projectId, AUTRON_PROJECT_ID);

  // 2. Responder aclaración real de negocio y comprobar que se conserva y versiona
  const clarificationResult = await codegenDecisionService.submitDecision(AUTRON_PROJECT_ID, {
    questionId: 'requiredIdentityFields',
    selectedOptionId: 'opt_nombre_placa_vin_opcional',
    user: 'Ingeniero_iCASE',
    requirementIds: ['RF-03', 'RF-04']
  });

  assert.equal(clarificationResult.success, true);
  assert.ok(clarificationResult.decision.revision >= 1);
  assert.deepEqual(clarificationResult.decision.data.CLIENTE, ['nombre']);
  assert.deepEqual(clarificationResult.decision.data.VEHICULO, ['clienteId', 'placa']);

  // Comprobar que la decisión se conserva en el almacén persistente
  const storedDecisions = codegenDecisionService.getProjectDecisions(AUTRON_PROJECT_ID);
  assert.ok(storedDecisions.requiredIdentityFields, 'Decisión conservada en el almacén');
  assert.equal(storedDecisions.requiredIdentityFields.selectedOptionId, 'opt_nombre_placa_vin_opcional');

  // 3. Generar Cliente -> Vehículo -> Recepción desde los contratos persistidos
  const spec = await buildProjectSpec(AUTRON_PROJECT_ID);
  const result = await codeGenerator.generateProjectFiles(AUTRON_PROJECT_ID, {
    spec,
    reviewOnly: true
  });

  assert.ok(result.files.length >= 200, `Generados ${result.files.length} archivos para Autron5`);
  assert.equal(result.reviewOnly, true);

  // 4. Escribir salida en directorio temporal aislado
  const verifRoot = path.resolve(__dirname, '../../.verification');
  fs.mkdirSync(verifRoot, { recursive: true });
  const exportDir = fs.mkdtempSync(path.join(verifRoot, 'autron5-acceptance-run-'));

  for (const f of result.files) {
    const target = path.resolve(exportDir, f.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, f.content || '', 'utf8');
  }

  // 5. Verificar sintaxis de todos los archivos del backend
  const backendJs = fs.readdirSync(path.join(exportDir, 'backend/src'), { recursive: true })
    .map(p => path.join(exportDir, 'backend/src', p))
    .filter(p => typeof p === 'string' && p.endsWith('.js') && fs.statSync(p).isFile());

  for (const file of backendJs) {
    const res = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(res.status, 0, `Error de compilación en ${path.relative(exportDir, file)}: ${res.stderr}`);
  }

  // 6. Borrar la salida y regenerarla sin modificaciones manuales posteriores
  fs.rmSync(exportDir, { recursive: true, force: true });
  assert.equal(fs.existsSync(exportDir), false, 'Directorio de salida borrado');

  // Regenerar desde la especificación persistida
  const regenerated = await codeGenerator.generateProjectFiles(AUTRON_PROJECT_ID, {
    spec,
    reviewOnly: true
  });

  assert.equal(regenerated.files.length, result.files.length, 'Genera exactamente el mismo número de archivos');
  for (let i = 0; i < result.files.length; i++) {
    assert.equal(regenerated.files[i].path, result.files[i].path, 'Ruta idéntica');
    assert.equal(regenerated.files[i].content, result.files[i].content, `Contenido idéntico para ${result.files[i].path}`);
  }

  // Verificar que el ZIP se crea limpiamente
  const zipBuffer = createZipBuffer(regenerated.files);
  assert.ok(zipBuffer.length > 500000, 'ZIP generado exitosamente con tamaño esperado');
});

