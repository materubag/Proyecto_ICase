/**
 * AI Operation Planner and Proposal Store Test Suite
 * Tests multi-domain proposal synthesis, absence of hallucinations,
 * and review lifecycle (approve/reject/invalidate/apply).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  planOperationSteps,
  synthesizeSemanticSteps
} = require('../src/services/codegen/aiOperationPlanner');
const {
  saveOperationProposal,
  reviewProposal,
  checkAndInvalidateDependencies,
  applyApprovedProposals,
  computeDependencyHash
} = require('../src/services/codegen/aiProposalStore');

describe('AI Operation Planner Multi-Domain Tests', () => {
  // Domain 1: Clínica Médica (Non-Automotive)
  const clinicaCatalog = {
    entities: [
      {
        modelName: 'Paciente',
        tableName: 'pacientes',
        attributes: [
          { fieldName: 'id', type: 'integer', isPk: true },
          { fieldName: 'nombre', type: 'string', allowNull: false },
          { fieldName: 'historialClinico', type: 'string' }
        ]
      },
      {
        modelName: 'CitaMedica',
        tableName: 'citas_medicas',
        attributes: [
          { fieldName: 'id', type: 'integer', isPk: true },
          { fieldName: 'pacienteId', type: 'integer', allowNull: false },
          { fieldName: 'fecha', type: 'date', allowNull: false },
          { fieldName: 'estado', type: 'string', allowNull: false },
          { fieldName: 'motivo', type: 'string' }
        ]
      }
    ],
    rules: [
      { code: 'RN-CITA-01', name: 'Estado válido', field: 'estado', enum: ['PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'ATENDIDA'] }
    ],
    roles: ['Administrador', 'Medico', 'Recepcionista'],
    requirements: [
      { id: 'req_01', code: 'RF-01', name: 'Agendamiento de citas médicas' }
    ]
  };

  // Domain 2: Biblioteca (Non-Automotive)
  const bibliotecaCatalog = {
    entities: [
      {
        modelName: 'Libro',
        tableName: 'libros',
        attributes: [
          { fieldName: 'id', type: 'integer', isPk: true },
          { fieldName: 'titulo', type: 'string', allowNull: false },
          { fieldName: 'estado', type: 'string', allowNull: false }
        ]
      },
      {
        modelName: 'Prestamo',
        tableName: 'prestamos',
        attributes: [
          { fieldName: 'id', type: 'integer', isPk: true },
          { fieldName: 'libroId', type: 'integer', allowNull: false },
          { fieldName: 'fechaPrestamo', type: 'date', allowNull: false }
        ]
      }
    ],
    rules: [],
    roles: ['Bibliotecario', 'Lector'],
    requirements: []
  };

  test('Synthesizes valid steps for Clinica without automotive hallucinations', async () => {
    const incompleteOp = {
      operationId: 'op_agendar_cita',
      name: 'Agendar Cita Médica',
      narrativeDescription: 'El paciente solicita agendar una cita y se registra en estado PENDIENTE.',
      narrativeSteps: [
        'Crear cita médica con datos del paciente',
        'Cambiar estado a CONFIRMADA'
      ],
      requirementIds: ['req_01']
    };

    const result = await planOperationSteps('proj_clinica_test', incompleteOp, clinicaCatalog);
    assert.strictEqual(result.valid, true, `Validación falló: ${result.validationErrors.join(', ')}`);
    assert.strictEqual(result.proposal.targetEntity, 'CitaMedica');
    assert.ok(result.proposal.steps.length >= 2);

    // Verify all steps reference real models from clinica catalog
    const allowedModels = ['Paciente', 'CitaMedica'];
    for (const step of result.proposal.steps) {
      assert.ok(allowedModels.includes(step.entity), `Entidad '${step.entity}' no está en catálogo`);
    }

    // Verify no automotive terms leaked
    const serialized = JSON.stringify(result.proposal).toLowerCase();
    assert.ok(!serialized.includes('vehiculo'), 'No debe contener vehiculo');
    assert.ok(!serialized.includes('taller'), 'No debe contener taller');
    assert.ok(!serialized.includes('mecanico'), 'No debe contener mecanico');
  });

  test('Synthesizes valid steps for Biblioteca without cross-contamination', async () => {
    const incompleteOp = {
      operationId: 'op_prestar_libro',
      name: 'Prestar Libro',
      narrativeDescription: 'Registrar préstamo de libro y cambiar estado del libro.',
      narrativeSteps: [
        'Crear registro de préstamo',
        'Cambiar estado del libro a PRESTADO'
      ],
      requirementIds: []
    };

    const result = await planOperationSteps('proj_biblio_test', incompleteOp, bibliotecaCatalog);
    assert.strictEqual(result.valid, true, `Validación falló: ${result.validationErrors.join(', ')}`);
    assert.ok(['Prestamo', 'Libro'].includes(result.proposal.targetEntity));
    assert.ok(result.proposal.steps.some(s => s.action === 'CREATE'));
  });

  test('Full Review Lifecycle: Save -> Review Approve -> Apply into Spec', async () => {
    const projectId = 'proj_lifecycle_test';
    const incompleteOp = {
      operationId: 'op_agendar_cita_life',
      name: 'Agendar Cita',
      narrativeSteps: ['Crear cita médica']
    };

    const planRes = await planOperationSteps(projectId, incompleteOp, clinicaCatalog);
    const proposalId = planRes.proposalId;
    assert.strictEqual(planRes.status, 'PENDING_REVIEW');

    // Review approve
    const reviewed = reviewProposal(projectId, proposalId, { status: 'APPROVED', reviewer: 'Tester' });
    assert.strictEqual(reviewed.status, 'APPROVED');

    // Apply to dummy spec
    const mockSpec = {
      operations: [
        {
          operationId: 'op_agendar_cita_life',
          name: 'Agendar Cita',
          type: 'BUSINESS_LOGIC',
          steps: []
        }
      ],
      screens: []
    };

    const { spec: updatedSpec, appliedCount } = applyApprovedProposals(projectId, mockSpec);
    assert.strictEqual(appliedCount, 1);
    assert.ok(updatedSpec.operations[0].steps.length > 0, 'Debe haber aplicado los pasos a la operación');
  });

  test('Dependency Invalidation: changing entity attributes invalidates prior proposal', async () => {
    const projectId = 'proj_invalidation_test';
    const op = {
      operationId: 'op_cita_inval',
      name: 'Agendar Cita',
      narrativeSteps: ['Crear cita']
    };

    const planRes = await planOperationSteps(projectId, op, clinicaCatalog);
    const proposalId = planRes.proposalId;

    // Simulate entity change
    const alteredCatalogDeps = {
      op_cita_inval: {
        operationId: op.operationId,
        name: op.name,
        narrativeSteps: op.narrativeSteps,
        entities: [{ name: 'CitaMedica', attrs: ['id', 'pacienteId', 'fecha', 'NUEVO_CAMPO'] }],
        rules: [],
        roles: ['Administrador']
      }
    };

    const updatedData = checkAndInvalidateDependencies(projectId, alteredCatalogDeps);
    const entry = updatedData.operations['op_cita_inval'];
    assert.strictEqual(entry.status, 'INVALIDATED', 'Debe haber invalidado la propuesta por cambio de entidad');
  });
});

