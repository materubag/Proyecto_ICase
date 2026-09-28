const prisma = require('../config/prisma');
const versionHistoryService = require('./versionHistory.service');

class ActorService {
  async getActorsByProject(projectId) {
    return await prisma.actor.findMany({
      where: { projectId, isDeleted: false },
      orderBy: { name: 'asc' }
    });
  }

  async createActor(projectId, data) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      const error = new Error(`Project with ID ${projectId} not found`);
      error.statusCode = 404;
      throw error;
    }

    const { name, description, codeId, reviewStatus } = data;
    if (!name || name.trim() === '') {
      const error = new Error('Actor name is required');
      error.statusCode = 400;
      throw error;
    }

    const created = await prisma.actor.create({
      data: {
        projectId,
        codeId: codeId ? codeId.trim().toUpperCase() : null,
        name: name.trim(),
        description: description ? description.trim() : null,
        reviewStatus: reviewStatus || 'PENDING',
        isDeleted: false
      }
    });

    await versionHistoryService.recordSnapshot(
      projectId,
      'ACTOR',
      created.id,
      'CREATED',
      created,
      `Creación de actor ${created.name}`
    );

    return created;
  }

  async updateActor(id, data) {
    const existing = await prisma.actor.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Actor with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    const { name, description, codeId, reviewStatus } = data;
    return await prisma.actor.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description ? description.trim() : null }),
        ...(codeId !== undefined && { codeId: codeId ? codeId.trim().toUpperCase() : null }),
        ...(reviewStatus !== undefined && { reviewStatus })
      }
    });
  }

  async updateStatus(id, reviewStatus) {
    return await prisma.actor.update({
      where: { id },
      data: { reviewStatus }
    });
  }

  async deleteActor(id) {
    const existing = await prisma.actor.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Actor with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    const { projectId, name, codeId } = existing;
    const actorRefIds = [id, name, codeId].filter(Boolean);

    // 1. Guardar Snapshot para recuperación
    await versionHistoryService.recordSnapshot(
      projectId,
      'ACTOR',
      id,
      'DELETED',
      existing,
      `Eliminación en cascada del actor ${name}`
    );

    const cascadedEffects = {
      requirementsUpdated: 0,
      useCasesUpdated: 0,
      screensUpdated: 0,
      navigationUpdated: 0
    };

    // 2. Cascada en Requisitos: remover actor de actorIds
    const allReqs = await prisma.requirement.findMany({ where: { projectId } });
    for (const req of allReqs) {
      const filtered = req.actorIds.filter(a => !actorRefIds.includes(a));
      if (filtered.length !== req.actorIds.length) {
        await prisma.requirement.update({
          where: { id: req.id },
          data: { actorIds: filtered }
        });
        cascadedEffects.requirementsUpdated++;
      }
    }

    // 3. Cascada en Casos de Uso
    const allUCs = await prisma.useCase.findMany({ where: { projectId } });
    for (const uc of allUCs) {
      let modified = false;
      let newPrimary = uc.primaryActorId;
      if (actorRefIds.includes(uc.primaryActorId)) {
        newPrimary = null;
        modified = true;
      }
      const newSecondary = uc.secondaryActorIds.filter(a => !actorRefIds.includes(a));
      if (newSecondary.length !== uc.secondaryActorIds.length) {
        modified = true;
      }
      if (modified) {
        await prisma.useCase.update({
          where: { id: uc.id },
          data: { primaryActorId: newPrimary, secondaryActorIds: newSecondary }
        });
        cascadedEffects.useCasesUpdated++;
      }
    }

    // 4. Cascada en Pantallas / Mockups
    const allScreens = await prisma.screen.findMany({ where: { projectId } });
    for (const sc of allScreens) {
      const filtered = sc.actorIds.filter(a => !actorRefIds.includes(a));
      if (filtered.length !== sc.actorIds.length) {
        await prisma.screen.update({
          where: { id: sc.id },
          data: { actorIds: filtered }
        });
        cascadedEffects.screensUpdated++;
      }
    }

    // 5. Eliminar actor
    await prisma.actor.delete({
      where: { id }
    });

    return {
      deletedActor: existing,
      cascadedEffects
    };
  }
}

module.exports = new ActorService();
