const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const codegenDecisionService = require('../src/services/codegen/codegenDecision.service');

test('Codegen Decisions: 1. Identifies missing identity decisions for projects with Cliente / Vehiculo', async () => {
  const mockProject = {
    id: 'test_proj_decisions_1',
    name: 'Taller Mecánico Test',
    entities: [
      { id: 'ent_cli', name: 'Cliente', modelName: 'Cliente', attributes: [{ name: 'nombre' }, { name: 'telefono' }] },
      { id: 'ent_veh', name: 'Vehiculo', modelName: 'Vehiculo', attributes: [{ name: 'placa' }, { name: 'clienteId' }] }
    ],
    requirements: [
      { id: 'req_1', code: 'RF-01', name: 'Registro de Clientes', status: 'APPROVED' },
      { id: 'req_2', code: 'RF-02', name: 'Registro de Vehículos', status: 'APPROVED' }
    ]
  };

  const pending = await codegenDecisionService.getPendingDecisions('test_proj_decisions_1', { project: mockProject });
  assert.ok(pending.length >= 1, 'Should find pending decisions for unconfigured identity fields');

  const idQ = pending.find(q => q.questionId === 'requiredIdentityFields');
  assert.ok(idQ, 'Finds question for requiredIdentityFields');
  assert.ok(idQ.options.length >= 2, 'Has at least 2 selectable options');
  assert.ok(idQ.options[0].label.includes('Nombre del cliente y placa obligatorios'), 'Recommended option is present');
  assert.ok(idQ.customAllowed, 'Allows custom input');
});

test('Codegen Decisions: 2. Submitting a decision persists versioned record and does not repeat active decision', async () => {
  const projectId = 'test_proj_decisions_2_' + Date.now();

  const submission = {
    questionId: 'requiredIdentityFields',
    selectedOptionId: 'opt_nombre_placa_vin_opcional',
    user: 'QA_Engineer',
    requirementIds: ['RF-01', 'RF-02']
  };

  const result = await codegenDecisionService.submitDecision(projectId, submission, {
    requirements: [{ id: 'req_1', code: 'RF-01', status: 'APPROVED', description: 'Registro de clientes y vehículos' }]
  });

  assert.equal(result.success, true);
  assert.equal(result.decision.revision, 1);
  assert.deepEqual(result.decision.data.CLIENTE, ['nombre']);
  assert.deepEqual(result.decision.data.VEHICULO, ['clienteId', 'placa']);

  // Check store
  const stored = codegenDecisionService.getProjectDecisions(projectId);
  assert.ok(stored.requiredIdentityFields);
  assert.equal(stored.requiredIdentityFields.revision, 1);

  // Submitting an update increments revision
  const updateResult = await codegenDecisionService.submitDecision(projectId, {
    questionId: 'requiredIdentityFields',
    selectedOptionId: 'opt_todos_obligatorios',
    user: 'QA_Engineer'
  });
  assert.equal(updateResult.decision.revision, 2);
});

test('Codegen Decisions: 3. Detects contradictions against approved requirements and warns user', async () => {
  const projectId = 'test_proj_decisions_3_' + Date.now();

  const strictRequirements = [
    {
      id: 'req_vin',
      code: 'RF-04',
      status: 'APPROVED',
      description: 'El VIN es obligatorio para todos los registros vehiculares sin excepción.'
    }
  ];

  // Attempting to select "VIN opcional" when requirement strictly mandates VIN
  await assert.rejects(async () => {
    await codegenDecisionService.submitDecision(projectId, {
      questionId: 'requiredIdentityFields',
      selectedOptionId: 'opt_nombre_placa_vin_opcional'
    }, { requirements: strictRequirements });
  }, {
    name: 'Error',
    code: 'DECISION_CONTRADICTION'
  });
});

test('Codegen Decisions: 4. Supports custom decision responses', async () => {
  const projectId = 'test_proj_decisions_4_' + Date.now();

  const result = await codegenDecisionService.submitDecision(projectId, {
    questionId: 'requiredIdentityFields',
    customAnswer: 'Requerir nombre, teléfono y placa con validación personalizada'
  });

  assert.equal(result.success, true);
  assert.ok(result.decision.label.includes('Personalizado:'));
  assert.ok(result.decision.data.CLIENTE.includes('telefono'));
  assert.ok(result.decision.data.VEHICULO.includes('placa'));
});
