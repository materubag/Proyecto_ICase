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
   * Genera casos de uso consolidados a partir de los requisitos funcionales del proyecto,
   * agrupando operaciones relacionadas (ej. CRUD sobre la misma entidad) y vinculando
   * cada caso de uso con su actor canónico correspondiente y requisitos fuente.
   */
  async generateFundamentalUseCases(projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        requirements: { where: { isDeleted: false } },
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

    // Mapeo de actores por ID y canonicalName
    const actorById = new Map();
    const actorByCode = new Map();
    for (const a of actors) {
      if (a.id) actorById.set(a.id, a);
      if (a.codeId) actorByCode.set(a.codeId, a);
    }

    // Helper para identificar el actor principal de un requisito
    const findActorForReq = (req) => {
      if (Array.isArray(req.actorIds) && req.actorIds.length > 0) {
        for (const actRef of req.actorIds) {
          const found = actorByCode.get(actRef) || actorById.get(actRef);
          if (found) return found;
        }
      }
      // Inferir por mención en nombre o descripción
      const text = `${req.name} ${req.description || ''}`.toLowerCase();
      for (const a of actors) {
        const aName = a.name.toLowerCase();
        if (text.includes(aName)) return a;
      }
      return actors[0] || null;
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
      const actor = findActorForReq(req);
      const actorKey = actor ? (actor.codeId || actor.name) : 'GENERAL';
      const clusterKey = `${topic}__${actorKey}`;

      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, {
          topic,
          defaultVerb,
          actor,
          requirements: []
        });
      }
      clusters.get(clusterKey).requirements.push(req);
    }

    // Conservar use cases existentes si tenían status APPROVED o personalizar si se regenera
    const existingUseCases = await prisma.useCase.findMany({ where: { projectId } });
    const approvedMap = new Map();
    for (const euc of existingUseCases) {
      if (euc.reviewStatus === 'APPROVED') {
        approvedMap.set(euc.name.toLowerCase().trim(), true);
      }
    }

    await prisma.useCase.deleteMany({ where: { projectId } });

    const createdList = [];
    let ucCounter = 1;

    for (const [, cluster] of clusters) {
      const codeId = `UC-${String(ucCounter).padStart(2, '0')}`;
      ucCounter++;

      const reqCodes = cluster.requirements.map(r => r.code || `RF-${r.id}`).filter(Boolean);
      const primaryActorCode = cluster.actor ? (cluster.actor.codeId || cluster.actor.name) : 'Usuario';
      const actorName = cluster.actor ? cluster.actor.name : 'Usuario';
      const ucName = `${cluster.defaultVerb} ${cluster.topic}`;

      const reqNames = cluster.requirements.map(r => r.name).slice(0, 3).join(', ');
      const description = `Permite al rol ${actorName} llevar a cabo la funcionalidad de ${cluster.topic.toLowerCase()}. Abarca operaciones: ${reqNames}.`;

      const isPreviouslyApproved = approvedMap.has(ucName.toLowerCase().trim());

      const created = await prisma.useCase.create({
        data: {
          projectId,
          codeId,
          name: ucName,
          processType: 'CORE_OPERATION',
          description,
          primaryActorId: primaryActorCode,
          secondaryActorIds: [],
          preconditions: `El actor ${actorName} debe tener acceso y permisos en el módulo correspondiente.`,
          postconditions: `Las transacciones de ${cluster.topic.toLowerCase()} quedan registradas de manera consistente.`,
          mainFlow: cluster.requirements.slice(0, 4).map((r, idx) => ({
            step: idx + 1,
            action: `${actorName} ejecuta: ${r.name}`
          })),
          altFlows: [
            { step: '1a', action: 'Datos incompletos o inválidos: el sistema alerta el error antes de persistir.' }
          ],
          requirementIds: reqCodes,
          reviewStatus: isPreviouslyApproved ? 'APPROVED' : 'PENDING',
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

      // Match primary actor by codeId, id, or name
      const matchedActor = actors.find(a => 
        a.codeId === uc.primaryActorId ||
        a.id === uc.primaryActorId ||
        a.name.toLowerCase() === (uc.primaryActorId || '').toLowerCase()
      );
      const pActorNode = matchedActor
        ? (matchedActor.codeId || matchedActor.name).replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()
        : (declaredActors.has(uc.primaryActorId?.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()) ? uc.primaryActorId.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase() : defaultActorId);

      if (declaredActors.has(pActorNode)) {
        lines.push(`    ${pActorNode} --- ${ucNodeId}`);
      } else {
        lines.push(`    ${defaultActorId} --- ${ucNodeId}`);
      }

      if (Array.isArray(uc.secondaryActorIds)) {
        for (const sActor of uc.secondaryActorIds) {
          const matchedSec = actors.find(a => 
            a.codeId === sActor ||
            a.id === sActor ||
            a.name.toLowerCase() === (sActor || '').toLowerCase()
          );
          const sId = matchedSec
            ? (matchedSec.codeId || matchedSec.name).replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()
            : sActor.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();

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
