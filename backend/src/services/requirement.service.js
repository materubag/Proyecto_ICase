const prisma = require('../config/prisma');
const versionHistoryService = require('./versionHistory.service');


async function validateActors(projectId, refs) {
  const actors = await prisma.actor.findMany({where:{projectId,isDeleted:false}});
  const unknown = refs.filter(ref => !actors.some(a => a.id === ref));
  if (unknown.length) { const error = new Error('Use IDs persistidos de actores: ' + unknown.join(', ')); error.statusCode=422; throw error; }
}

class RequirementService {
  async getRequirementsByProject(projectId) {
    try {
      const projectConsolidationService = require('./analysis/projectConsolidationService');
      await projectConsolidationService.consolidateProject(projectId);
    } catch (e) {
      console.warn('[RequirementService] Warning during project consolidation:', e.message);
    }

    return await prisma.requirement.findMany({
      where: { projectId, isDeleted: false, status: {not:'REMOVED'} },
      orderBy: { code: 'asc' }
    });
  }

  async createRequirement(projectId, data) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      const error = new Error(`Project with ID ${projectId} not found`);
      error.statusCode = 404;
      throw error;
    }

    await validateActors(projectId, data.actorIds || []);
    const { code, name, description, type, priority, status, actorIds, dependencies, preconditions, postconditions } = data;
    if (!code || !name || !description) {
      const error = new Error('Código, nombre y descripción son campos obligatorios');
      error.statusCode = 400;
      throw error;
    }

    const created = await prisma.requirement.create({
      data: {
        projectId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        type: type || 'FUNCTIONAL',
        priority: priority || 'MEDIUM',
        status: status || 'PENDING',
        actorIds: Array.isArray(actorIds) ? actorIds : [],
        dependencies: Array.isArray(dependencies) ? dependencies : [],
        preconditions: preconditions ? preconditions.trim() : null,
        postconditions: postconditions ? postconditions.trim() : null,
        isDeleted: false
      }
    });

    await versionHistoryService.recordSnapshot(
      projectId,
      'REQUIREMENT',
      created.id,
      'CREATED',
      created,
      `Creación de requisito ${created.code}: ${created.name}`
    );

    return created;
  }

  async updateRequirement(id, data) {
    const existing = await prisma.requirement.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Requisito con ID ${id} no encontrado`);
      error.statusCode = 404;
      throw error;
    }

    await validateActors(existing.projectId, data.actorIds || []);
    const { code, name, description, type, priority, status, actorIds, dependencies, preconditions, postconditions } = data;
    
    // Si cambia el código, actualizar en cascada referencias en otros requisitos, casos de uso y pantallas
    const oldCode = existing.code;
    const newCode = code ? code.trim().toUpperCase() : oldCode;

    // Regla: Si se edita un requisito aprobado, pasa a NEEDS_REVIEW si no se especifica estado explícito
    let nextStatus = status !== undefined ? status : existing.status;
    if (existing.status === 'APPROVED' && status === undefined) {
      const nameChanged = name !== undefined && name.trim() !== existing.name;
      const descChanged = description !== undefined && description.trim() !== existing.description;
      if (nameChanged || descChanged) {
        nextStatus = 'NEEDS_REVIEW';
      }
    }

    const updated = await prisma.requirement.update({
      where: { id },
      data: {
        ...(code !== undefined && { code: newCode }),
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(type !== undefined && { type }),
        ...(priority !== undefined && { priority }),
        status: nextStatus,
        ...(actorIds !== undefined && { actorIds: Array.isArray(actorIds) ? actorIds : [] }),
        ...(dependencies !== undefined && { dependencies: Array.isArray(dependencies) ? dependencies : [] }),
        ...(preconditions !== undefined && { preconditions: preconditions ? preconditions.trim() : null }),
        ...(postconditions !== undefined && { postconditions: postconditions ? postconditions.trim() : null })
      }
    });

    await versionHistoryService.recordSnapshot(
      existing.projectId,
      'REQUIREMENT',
      id,
      'UPDATED',
      updated,
      `Modificación de requisito ${updated.code}: ${updated.name} (Estado: ${nextStatus})`
    );

    if (oldCode !== newCode) {
      // Cascada de actualización de código en otros requerimientos
      const allReqs = await prisma.requirement.findMany({
        where: { projectId: existing.projectId, dependencies: { has: oldCode } }
      });
      for (const r of allReqs) {
        const nextDeps = r.dependencies.map(d => d === oldCode ? newCode : d);
        await prisma.requirement.update({
          where: { id: r.id },
          data: { dependencies: nextDeps }
        });
      }

      // Cascada en Casos de Uso
      const allUC = await prisma.useCase.findMany({
        where: { projectId: existing.projectId, requirementIds: { has: oldCode } }
      });
      for (const uc of allUC) {
        const nextReqIds = uc.requirementIds.map(d => d === oldCode ? newCode : d);
        await prisma.useCase.update({
          where: { id: uc.id },
          data: { requirementIds: nextReqIds }
        });
      }

      // Cascada en Pantallas
      const allScreens = await prisma.screen.findMany({
        where: { projectId: existing.projectId, requirementIds: { has: oldCode } }
      });
      for (const sc of allScreens) {
        const nextReqIds = sc.requirementIds.map(d => d === oldCode ? newCode : d);
        await prisma.screen.update({
          where: { id: sc.id },
          data: { requirementIds: nextReqIds }
        });
      }
    }

    return updated;
  }

  async updateStatus(id, status) {
    const validStatuses = ['PENDING', 'APPROVED', 'NEEDS_REVIEW', 'REJECTED', 'DISCARDED', 'IMPLEMENTED'];
    if (!validStatuses.includes(status)) {
      const err = new Error(`Estado '${status}' no válido`);
      err.statusCode = 400;
      throw err;
    }

    return await prisma.requirement.update({
      where: { id },
      data: { status }
    });
  }

  /**
   * Eliminación con eliminación/actualización en cascada y guardado en historial recuperable.
   */
  async deleteRequirement(id) {
    const existing = await prisma.requirement.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Requisito con ID ${id} no encontrado`);
      error.statusCode = 404;
      throw error;
    }

    const { projectId, code } = existing;

    // 1. Guardar Snapshot para recuperación
    await versionHistoryService.recordSnapshot(
      projectId,
      'REQUIREMENT',
      id,
      'DELETED',
      existing,
      `Eliminación en cascada del requisito ${code}: ${existing.name}`
    );

    const cascadedEffects = {
      otherRequirementsUpdated: 0,
      useCasesUpdated: 0,
      screensUpdated: 0
    };

    // 2. Cascada: remover de dependencias de otros requisitos
    const reqsWithDep = await prisma.requirement.findMany({
      where: { projectId, dependencies: { has: code } }
    });
    for (const r of reqsWithDep) {
      await prisma.requirement.update({
        where: { id: r.id },
        data: { dependencies: r.dependencies.filter(d => d !== code) }
      });
      cascadedEffects.otherRequirementsUpdated++;
    }

    // 3. Cascada: remover de Casos de Uso
    const ucsWithReq = await prisma.useCase.findMany({
      where: { projectId, requirementIds: { has: code } }
    });
    for (const uc of ucsWithReq) {
      await prisma.useCase.update({
        where: { id: uc.id },
        data: { requirementIds: uc.requirementIds.filter(r => r !== code) }
      });
      cascadedEffects.useCasesUpdated++;
    }

    // 4. Cascada: remover de Pantallas/Mockups
    const screensWithReq = await prisma.screen.findMany({
      where: { projectId, requirementIds: { has: code } }
    });
    for (const sc of screensWithReq) {
      await prisma.screen.update({
        where: { id: sc.id },
        data: { requirementIds: sc.requirementIds.filter(r => r !== code) }
      });
      cascadedEffects.screensUpdated++;
    }

    // 5. Eliminar el requisito
    await prisma.requirement.delete({
      where: { id }
    });

    return {
      deletedRequirement: existing,
      cascadedEffects
    };
  }
}

module.exports = new RequirementService();
