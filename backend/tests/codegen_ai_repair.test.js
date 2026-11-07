const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const codegenAiRepairService = require('../src/services/codegen/codegenAiRepair.service');

test('Codegen AI Repair: 1. Analyzes project coherence between entities, operations, and screens', async () => {
  const specWithGaps = {
    entities: [
      { id: 'ent_1', modelName: 'Producto', name: 'Producto' },
      { id: 'ent_2', modelName: 'Categoria', name: 'Categoria' }
    ],
    operations: [
      { operationId: 'op_prod', name: 'Listar Productos', entity: 'Producto', authorizedRoles: ['Admin', 'Desconocido'] }
    ],
    screens: [
      { id: 'scr_1', name: 'Ventas', title: 'Ventas', actions: [] }
    ],
    roles: ['Admin', 'Vendedor']
  };

  const report = await codegenAiRepairService.reviewProjectCoherence(specWithGaps);
  assert.equal(report.coherent, false);
  assert.ok(report.anomalies.some(a => a.type === 'UNCOVERED_ENTITY' && a.element === 'Categoria'));
  assert.ok(report.anomalies.some(a => a.type === 'UNDECLARED_ROLE'));
  assert.ok(report.anomalies.some(a => a.type === 'DISCONNECTED_SCREEN'));
});

test('Codegen AI Repair: 2. Proposes targeted fix for syntax and import errors', async () => {
  const tempDir = fs.mkdtempSync(path.join(__dirname, 'fixtures', 'repair_test_'));
  const dummyFile = path.join(tempDir, 'dummy.js');
  fs.writeFileSync(dummyFile, 'const a = 1;\nconsole.log(b);');

  const failure = {
    stage: 'SYNTAX_CHECK',
    message: 'SyntaxError: Unexpected token',
    file: 'dummy.js',
    line: 2
  };

  const repair = await codegenAiRepairService.proposeRepair(failure, tempDir);
  assert.equal(repair.success, true);
  assert.equal(repair.tokensUsed, 0);
  assert.ok(repair.durationMs >= 0);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Codegen AI Repair: 3. Controlled fix application strictly bounded to export directory', async () => {
  const tempDir = fs.mkdtempSync(path.join(__dirname, 'fixtures', 'repair_apply_'));
  const sampleFile = path.join(tempDir, 'server.js');
  fs.writeFileSync(sampleFile, "const PORT = 3000;\napp.listen(PORT);");

  // Attempt to escape sandbox directory must throw
  assert.throws(() => {
    codegenAiRepairService.applyFix(tempDir, {
      targetFile: '../escaped.js',
      targetString: 'PORT',
      replacementString: 'APP_PORT'
    });
  }, /fuera del directorio aislado/i);

  // Valid internal replacement succeeds
  const res = codegenAiRepairService.applyFix(tempDir, {
    targetFile: 'server.js',
    targetString: 'const PORT = 3000;',
    replacementString: 'const PORT = 8080;'
  });

  assert.equal(res.applied, true);
  const updatedContent = fs.readFileSync(sampleFile, 'utf8');
  assert.ok(updatedContent.includes('const PORT = 8080;'));

  // Cleanup
  fs.rmSync(tempDir, { recursive: true, force: true });
});

