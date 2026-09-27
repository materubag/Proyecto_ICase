const prisma = require('../config/prisma');
const versionHistoryService = require('./versionHistory.service');
const useCaseGenerator = require('./diagrams/useCaseGenerator');

class UseCaseService {
  async getUseCasesByProject(projectId) {
    return await prisma.useCase.findMany({
      where: { projectId, isDeleted: false },
      orderBy: { codeId: 'asc' }
    });
  }

  async createUseCase(projectId, data) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      const error = new Error(`Project with ID ${projectId} not found`);
      error.statusCode = 404;
      throw error;
    }

    const {
      codeId,
      name,
      processType,
      description,
      primaryActorId,
      secondaryActorIds,
      preconditions,
      postconditions,
      mainFlow,
      altFlows,
      requirementIds,
      reviewStatus
    } = data;

    const count = await prisma.useCase.count({ where: { projectId } });
    const code = codeId || `CU-${String(count + 1).padStart(2, '0')}`;

    const created = await prisma.useCase.create({
      data: {
        projectId,
        codeId: code,
        name: (name || 'Caso de Uso').trim(),
        processType: processType || 'CORE_OPERATION',
        description: description ? description.trim() : null,
        primaryActorId: primaryActorId || null,
        secondaryActorIds: Array.isArray(secondaryActorIds) ? secondaryActorIds : [],
        preconditions: preconditions ? preconditions.trim() : null,
        postconditions: postconditions ? postconditions.trim() : null,
        mainFlow: mainFlow || [],
        altFlows: altFlows || [],
        requirementIds: Array.isArray(requirementIds) ? requirementIds : [],
        reviewStatus: reviewStatus || 'PENDING',
        isDeleted: false
      }
    });

    await versionHistoryService.recordSnapshot(
      projectId,
      'USE_CASE',
      created.id,
      'CREATED',
      created,
      `Creación de caso de uso ${created.codeId}: ${created.name}`
    );

    return created;
  }

  async updateUseCase(id, data) {
    const existing = await prisma.useCase.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Caso de uso con ID ${id} no encontrado`);
      error.statusCode = 404;
      throw error;
    }

    return await prisma.useCase.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.processType !== undefined && { processType: data.processType }),
        ...(data.description !== undefined && { description: data.description ? data.description.trim() : null }),
        ...(data.primaryActorId !== undefined && { primaryActorId: data.primaryActorId }),
        ...(data.secondaryActorIds !== undefined && { secondaryActorIds: Array.isArray(data.secondaryActorIds) ? data.secondaryActorIds : [] }),
        ...(data.preconditions !== undefined && { preconditions: data.preconditions ? data.preconditions.trim() : null }),
        ...(data.postconditions !== undefined && { postconditions: data.postconditions ? data.postconditions.trim() : null }),
        ...(data.mainFlow !== undefined && { mainFlow: data.mainFlow }),
        ...(data.altFlows !== undefined && { altFlows: data.altFlows }),
        ...(data.requirementIds !== undefined && { requirementIds: Array.isArray(data.requirementIds) ? data.requirementIds : [] }),
        ...(data.reviewStatus !== undefined && { reviewStatus: data.reviewStatus })
      }
    });
  }

  async updateStatus(id, reviewStatus) {
    return await prisma.useCase.update({
      where: { id },
      data: { reviewStatus }
    });
  }

  async deleteUseCase(id) {
    const existing = await prisma.useCase.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Caso de uso con ID ${id} no encontrado`);
      error.statusCode = 404;
      throw error;
    }

    await versionHistoryService.recordSnapshot(
      existing.projectId,
      'USE_CASE',
      id,
      'DELETED',
      existing,
      `Eliminación del caso de uso ${existing.codeId}: ${existing.name}`
    );

    return await prisma.useCase.delete({ where: { id } });
  }

  /**
   * Genera automáticamente los 4 Procesos Fundamentales para el proyecto.
   */
  async generateFundamentalUseCases(projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        requirements: { where: { type: 'FUNCTIONAL' } },
        actors: true
      }
    });

    if (!project) throw new Error('Proyecto no encontrado');

    const actors = project.actors || [];
    const reqs = project.requirements || [];
    const mainActor = actors[0] ? (actors[0].codeId || actors[0].name) : 'Usuario';
    const adminActor = actors.find(a => a.name.toLowerCase().includes('admin'))?.codeId || mainActor;

    // Eliminar casos de uso previos si se solicita regeneración
    await prisma.useCase.deleteMany({ where: { projectId } });

    // Definir los 4 Procesos Fundamentales solicitados
    const fundamentalProcesses = [
      {
        codeId: 'CU-01',
        processType: 'AUTH_ACCESS',
        name: 'Autenticación, Gestión de Perfiles y Control de Acceso',
        description: 'Permite a los usuarios y administradores autenticarse de forma segura, gestionar sus credenciales de acceso y validar los permisos de rol correspondientes.',
        primaryActorId: mainActor,
        secondaryActorIds: [adminActor].filter(a => a !== mainActor),
        preconditions: 'El usuario debe poseer una cuenta activa y credenciales registradas.',
        postconditions: 'El sistema emite una sesión autenticada con token de autorización activo.',
        mainFlow: [
          { step: 1, action: 'El usuario ingresa credenciales en el formulario de inicio.' },
          { step: 2, action: 'El sistema valida las credenciales contra la base de datos.' },
          { step: 3, action: 'El sistema carga el perfil y redirige al panel correspondiente.' }
        ],
        altFlows: [
          { step: '2a', action: 'Credenciales inválidas: el sistema alerta el error y bloquea tras 5 intentos fallidos.' }
        ],
        requirementIds: reqs.filter(r => r.name.toLowerCase().includes('autentic') || r.name.toLowerCase().includes('login') || r.name.toLowerCase().includes('perfil') || r.code === 'RF-01').map(r => r.code)
      },
      {
        codeId: 'CU-02',
        processType: 'CORE_OPERATION',
        name: 'Gestión y Operación Central del Dominio de Negocio',
        description: `Ejecución de los flujos de trabajo principales del sistema (${project.name}): registro, actualización, validación de reglas de negocio y transacciones operativas.`,
        primaryActorId: mainActor,
        secondaryActorIds: [],
        preconditions: 'Sesión activa con permisos operativos asignados.',
        postconditions: 'La entidad u operación de negocio queda registrada con persistencia transaccional.',
        mainFlow: [
          { step: 1, action: 'El actor inicia la transacción operativa principal.' },
          { step: 2, action: 'El sistema valida la integridad de los datos de entrada según reglas de negocio.' },
          { step: 3, action: 'El sistema persiste la transacción y emite confirmación de éxito.' }
        ],
        altFlows: [
          { step: '2a', action: 'Datos incompletos o fuera de rango: el sistema resalta los campos con error.' }
        ],
        requirementIds: reqs.slice(1, 4).map(r => r.code)
      },
      {
        codeId: 'CU-03',
        processType: 'REPORT_QUERY',
        name: 'Consultas Avanzadas, Búsquedas y Generación de Reportes',
        description: 'Capacidad de realizar filtros multicriterio, consulta de historiales, exportación de métricas y visualización de resúmenes consolidados.',
        primaryActorId: adminActor,
        secondaryActorIds: [mainActor].filter(a => a !== adminActor),
        preconditions: 'Existen registros previos en el almacén de datos del sistema.',
        postconditions: 'El sistema genera la vista o reporte con los datos consolidados solicitados.',
        mainFlow: [
          { step: 1, action: 'El usuario define los parámetros y filtros de consulta.' },
          { step: 2, action: 'El sistema procesa la consulta indexada en la base de datos.' },
          { step: 3, action: 'El sistema renderiza el informe y habilita la exportación.' }
        ],
        altFlows: [],
        requirementIds: reqs.filter(r => r.name.toLowerCase().includes('report') || r.name.toLowerCase().includes('consult') || r.name.toLowerCase().includes('historial')).map(r => r.code)
      },
      {
        codeId: 'CU-04',
        processType: 'NOTIFICATION_AUDIT',
        name: 'Notificaciones, Alertas y Auditoría de Trazabilidad',
        description: 'Supervisión de eventos clave, registro de logs de auditoría, avisos automáticos a los interesados y seguimiento de cambios de estado.',
        primaryActorId: adminActor,
        secondaryActorIds: [],
        preconditions: 'Ocurrencia de un evento crítico, cambio de estado o vencimiento de plazo en el sistema.',
        postconditions: 'Se registra la entrada de auditoría inmutable y se despacha la alerta correspondiente.',
        mainFlow: [
          { step: 1, action: 'El sistema detecta el evento o trigger de auditoría.' },
          { step: 2, action: 'Se almacena el log con sello de tiempo, usuario y detalles de la acción.' },
          { step: 3, action: 'Se notifica al actor interesado a través del canal establecido.' }
        ],
        altFlows: [],
        requirementIds: reqs.filter(r => r.name.toLowerCase().includes('notif') || r.name.toLowerCase().includes('alert') || r.name.toLowerCase().includes('audit')).map(r => r.code)
      }
    ];

    const createdList = [];
    for (const p of fundamentalProcesses) {
      const created = await prisma.useCase.create({
        data: {
          projectId,
          codeId: p.codeId,
          name: p.name,
          processType: p.processType,
          description: p.description,
          primaryActorId: p.primaryActorId,
          secondaryActorIds: p.secondaryActorIds,
          preconditions: p.preconditions,
          postconditions: p.postconditions,
          mainFlow: p.mainFlow,
          altFlows: p.altFlows,
          requirementIds: p.requirementIds,
          reviewStatus: 'APPROVED',
          isDeleted: false
        }
      });
      createdList.push(created);
    }

    return createdList;
  }

  /**
   * Genera el diagrama Mermaid de casos de uso para los casos creados.
   */
  async getMermaidDiagram(projectId) {
    const useCases = await this.getUseCasesByProject(projectId);
    const actors = await prisma.actor.findMany({ where: { projectId } });

    if (useCases.length === 0) {
      return useCaseGenerator.generate(actors, []);
    }

    const lines = ['flowchart LR'];
    const declaredActors = new Set();

    for (const a of actors) {
      const aId = (a.codeId || a.name).replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
      declaredActors.add(aId);
      lines.push(`    ${aId}["👤 ${a.name}"]`);
    }

    const defaultActorId = actors[0] ? (actors[0].codeId || actors[0].name).replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase() : 'ACT_USER';
    if (!declaredActors.has(defaultActorId)) {
      lines.push(`    ${defaultActorId}["👤 Usuario"]`);
      declaredActors.add(defaultActorId);
    }

    for (const uc of useCases) {
      const ucNodeId = `UC_${uc.codeId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      const title = uc.name.replace(/["\\]/g, '').slice(0, 40);
      lines.push(`    ${ucNodeId}(["${uc.codeId}: ${title}"])`);

      const pActor = uc.primaryActorId ? uc.primaryActorId.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase() : defaultActorId;
      if (declaredActors.has(pActor)) {
        lines.push(`    ${pActor} --- ${ucNodeId}`);
      } else {
        lines.push(`    ${defaultActorId} --- ${ucNodeId}`);
      }

      if (Array.isArray(uc.secondaryActorIds)) {
        for (const sActor of uc.secondaryActorIds) {
          const sId = sActor.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
          if (declaredActors.has(sId)) {
            lines.push(`    ${sId} -.-> ${ucNodeId}`);
          }
        }
      }
    }

    return lines.join('\n');
  }
}

module.exports = new UseCaseService();
