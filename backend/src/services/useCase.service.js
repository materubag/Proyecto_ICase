const prisma = require('../config/prisma');
const versionHistoryService = require('./versionHistory.service');
const useCaseGenerator = require('./diagrams/useCaseGenerator');


async function validateActors(projectId, refs) {
  const actors = await prisma.actor.findMany({where:{projectId,isDeleted:false}});
  const unknown = refs.filter(ref => !actors.some(a => a.id === ref));
  if (unknown.length) { const error = new Error('Use IDs persistidos de actores: ' + unknown.join(', ')); error.statusCode=422; throw error; }
}

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

    await validateActors(projectId, require('./analysis/actorIdentity').useCaseActors(data));
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

    await validateActors(existing.projectId, require('./analysis/actorIdentity').useCaseActors(data));
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
   * Genera casos de uso consolidados a partir de los requisitos funcionales del proyecto,
   * agrupando operaciones relacionadas (ej. CRUD sobre la misma entidad) y vinculando
   * cada caso de uso con su actor canónico correspondiente y requisitos fuente.
   */
  async generateFundamentalUseCases(projectId, db = prisma) {
    if (db === prisma) return prisma.$transaction(tx => this.generateFundamentalUseCases(projectId, tx));
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: {
        requirements: { where: { isDeleted: false, status: {not:'REMOVED'} } },
        actors: { where: { isDeleted: false } }
      }
    });

    if (!project) throw new Error('Proyecto no encontrado');

    const actors = project.actors || [];
    const allReqs = project.requirements || [];
    const fnReqs = allReqs.filter(r => r.type === 'FUNCTIONAL' || !r.type);

    if (fnReqs.length === 0) {
      throw new Error('No hay requisitos funcionales disponibles para generar casos de uso');
    }

    const identity = require('./analysis/actorIdentity');
    const actorsForReq = req => {
      const mapped = identity.canonical(req.actorIds || [], actors);
      if (mapped.pending.length) { const error = new Error('Referencias pendientes en ' + req.code + ': ' + mapped.pending.join(', ')); error.statusCode=422; throw error; }
      return mapped.ids;
    };

    // Diccionario de entidades / tópicos para agrupar requisitos en casos de uso
    const extractTopic = (title) => {
      const lower = title.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar tildes
        .replace(/^(el|la|los|las|un|una)\s+/i, '')
        .replace(/^(sistema\s+(debe|puede)\s+(permitir\s+)?)/i, '');

      const keywords = [
        { topic: 'Vehículos', match: /(vehiculo|auto|coche|automovil|matricula|placa)/i, verb: 'Gestionar' },
        { topic: 'Citas y Reservas', match: /(cita|reserva|agenda|horario|calendario)/i, verb: 'Gestionar' },
        { topic: 'Diagnósticos e Inspecciones', match: /(diagnostico|inspeccion|falla|revision)/i, verb: 'Registrar' },
        { topic: 'Órdenes de Trabajo y Reparaciones', match: /(orden|trabajo|reparacion|mantenimiento|servicio)/i, verb: 'Gestionar' },
        { topic: 'Repuestos e Inventario', match: /(repuesto|inventario|stock|pieza|material|proveedor)/i, verb: 'Gestionar' },
        { topic: 'Facturación y Cobros', match: /(factura|pago|cobro|precio|cotizacion|costo|presupuesto)/i, verb: 'Gestionar' },
        { topic: 'Clientes', match: /(cliente|propietario|titular)/i, verb: 'Gestionar' },
        { topic: 'Usuarios y Seguridad', match: /(usuario|autentic|login|sesion|rol|perfil|permiso|acceso)/i, verb: 'Gestionar' },
        { topic: 'Reportes e Indicadores', match: /(reporte|informe|estadistica|indicador|metrica|dashboard)/i, verb: 'Consultar' },
        { topic: 'Notificaciones y Alertas', match: /(notific|alerta|mensaje|aviso|correo|sms)/i, verb: 'Enviar' }
      ];

      for (const k of keywords) {
        if (k.match.test(lower)) {
          return { topic: k.topic, defaultVerb: k.verb };
        }
      }

      // Si no coincide con un topic conocido, usar las 2 palabras clave principales del nombre
      const words = lower.split(/\s+/).filter(w => w.length > 3 && !['sistema', 'debe', 'puede', 'permitir', 'para', 'como'].includes(w));
      const fallbackTopic = words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Operaciones Generales';
      return { topic: fallbackTopic, defaultVerb: 'Gestionar' };
    };

    // Agrupar requisitos por Topic + Actor
    const clusters = new Map();
    for (const req of fnReqs) {
      const { topic, defaultVerb } = extractTopic(req.name);
      const linkedActors = actorsForReq(req);
      const actor = actors.find(a => a.id === linkedActors[0]);
      const actorKey = [...linkedActors].sort().join(',') || 'PENDING';
      const clusterKey = `${topic}__${actorKey}`;

      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, {
          topic,
          defaultVerb,
          actor,
          linkedActors,
          requirements: []
        });
      }
      clusters.get(clusterKey).requirements.push(req);
    }

    // Conservar use cases existentes si tenían status APPROVED o personalizar si se regenera
    const existingUseCases = await db.useCase.findMany({ where: { projectId } });
    const approvedMap = new Map();
    for (const euc of existingUseCases) {
      if (euc.reviewStatus === 'APPROVED') {
        approvedMap.set(euc.name.toLowerCase().trim(), true);
      }
    }

    // Preserve existing IDs and reviewed cases; update generated cases by their source requirements.

    const createdList = [];
    let ucCounter = Math.max(0, ...existingUseCases.map(c => Number((c.codeId || c.code || '').match(/(\d+)$/)?.[1]) || 0)) + 1;

    for (const [, cluster] of clusters) {
      const codeId = `UC-${String(ucCounter).padStart(2, '0')}`;
      ucCounter++;

      const reqCodes = cluster.requirements.map(r => r.code || `RF-${r.id}`).filter(Boolean);
      const primaryActorCode = cluster.actor?.id || null;
      const actorName = cluster.actor ? cluster.actor.name : 'Responsable pendiente de revision';
      const ucName = `${cluster.defaultVerb} ${cluster.topic}`;

      const reqNames = cluster.requirements.map(r => r.name).slice(0, 3).join(', ');
      const description = `Permite al rol ${actorName} llevar a cabo la funcionalidad de ${cluster.topic.toLowerCase()}. Abarca operaciones: ${reqNames}.`;

      const isPreviouslyApproved = approvedMap.has(ucName.toLowerCase().trim());

      const existing = existingUseCases.find(c => !c.isDeleted && JSON.stringify([...(c.requirementIds || [])].sort()) === JSON.stringify(cluster.requirements.map(r => r.id).sort()));
      const generatedData = {
          projectId,
          codeId,
          name: ucName,
          processType: 'CORE_OPERATION',
          description,
          primaryActorId: primaryActorCode,
          secondaryActorIds: cluster.linkedActors.slice(1),
          actorIds: cluster.linkedActors,
          preconditions: null,
          postconditions: `Las transacciones de ${cluster.topic.toLowerCase()} quedan registradas de manera consistente.`,
          mainFlow: cluster.requirements.slice(0, 4).map((r, idx) => ({
            step: idx + 1,
            action: `${actorName} ejecuta: ${r.name}`
          })),
          altFlows: [
            { step: '1a', action: 'Datos incompletos o inválidos: el sistema alerta el error antes de persistir.' }
          ],
          requirementIds: cluster.requirements.map(r => r.id),
          reviewStatus: 'PENDING',
          isDeleted: false
        };
      const created = existing
        ? await db.useCase.update({where:{id:existing.id},data:{primaryActorId:primaryActorCode,secondaryActorIds:cluster.linkedActors.slice(1),actorIds:cluster.linkedActors}})
        : await db.useCase.create({data:generatedData});
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

    return useCaseGenerator.generate(actors, useCases);
  }
}
module.exports = new UseCaseService();
