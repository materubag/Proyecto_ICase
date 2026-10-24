const prisma = require('../config/prisma');

class VersionHistoryService {
  /**
   * Registra un snapshot en el historial de versiones antes de una eliminación o cambio crítico.
   */
  async recordSnapshot(projectId, entityType, entityId, action, snapshot, summary = null) {
    try {
      return await prisma.projectVersionHistory.create({
        data: {
          projectId,
          entityType,
          entityId,
          action,
          snapshot: snapshot || {},
          summary: summary || `${action} en ${entityType} (${entityId})`
        }
      });
    } catch (err) {
      console.error('[VersionHistory] Error guardando snapshot:', err.message);
      return null;
    }
  }

  /**
   * Obtiene el historial de versiones y elementos eliminados de un proyecto.
   */
  async getHistoryByProject(projectId) {
    return await prisma.projectVersionHistory.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 60
    });
  }

  /**
   * Restaura un elemento eliminado a partir de su snapshot.
   */
  async restoreSnapshot(historyId) {
    const historyItem = await prisma.projectVersionHistory.findUnique({
      where: { id: historyId }
    });

    if (!historyItem) {
      const err = new Error(`Registro de historial con ID ${historyId} no encontrado`);
      err.statusCode = 404;
      throw err;
    }

    const { projectId, entityType, snapshot } = historyItem;
    let restoredEntity = null;

    if (entityType === 'REQUIREMENT') {
      const existing = await prisma.requirement.findFirst({
        where: { projectId, code: snapshot.code }
      });

      if (existing) {
        restoredEntity = await prisma.requirement.update({
          where: { id: existing.id },
          data: {
            name: snapshot.name,
            description: snapshot.description,
            type: snapshot.type || 'FUNCTIONAL',
            priority: snapshot.priority || 'MEDIUM',
            status: snapshot.status || 'APPROVED',
            actorIds: snapshot.actorIds || [],
            dependencies: snapshot.dependencies || [],
            preconditions: snapshot.preconditions || null,
            postconditions: snapshot.postconditions || null,
            isDeleted: false
          }
        });
      } else {
        restoredEntity = await prisma.requirement.create({
          data: {
            projectId,
            code: snapshot.code,
            name: snapshot.name,
            description: snapshot.description,
            type: snapshot.type || 'FUNCTIONAL',
            priority: snapshot.priority || 'MEDIUM',
            status: snapshot.status || 'APPROVED',
            actorIds: snapshot.actorIds || [],
            dependencies: snapshot.dependencies || [],
            preconditions: snapshot.preconditions || null,
            postconditions: snapshot.postconditions || null,
            isDeleted: false
          }
        });
      }
    } else if (entityType === 'ACTOR') {
      restoredEntity = await prisma.actor.create({
        data: {
          projectId,
          codeId: snapshot.codeId || null,
          name: snapshot.name,
          description: snapshot.description || null,
          reviewStatus: snapshot.reviewStatus || 'APPROVED',
          isDeleted: false
        }
      });
    } else if (entityType === 'USE_CASE') {
      restoredEntity = await prisma.useCase.create({
        data: {
          projectId,
          codeId: snapshot.codeId || null,
          name: snapshot.name,
          processType: snapshot.processType || 'CORE_OPERATION',
          description: snapshot.description || null,
          primaryActorId: snapshot.primaryActorId || null,
          secondaryActorIds: snapshot.secondaryActorIds || [],
          preconditions: snapshot.preconditions || null,
          postconditions: snapshot.postconditions || null,
          mainFlow: snapshot.mainFlow || null,
          altFlows: snapshot.altFlows || null,
          requirementIds: snapshot.requirementIds || [],
          reviewStatus: snapshot.reviewStatus || 'APPROVED',
          isDeleted: false
        }
      });
    } else if (entityType === 'SCREEN') {
      restoredEntity = await prisma.screen.create({
        data: {
          projectId,
          codeId: snapshot.codeId || null,
          name: snapshot.name,
          description: snapshot.description || null,
          route: snapshot.route || '/',
          purpose: snapshot.purpose || null,
          html: snapshot.html || null,
          htmlUrl: snapshot.htmlUrl || null,
          requirementIds: snapshot.requirementIds || [],
          actorIds: snapshot.actorIds || [],
          selectedForGeneration: snapshot.selectedForGeneration ?? false,
          reviewStatus: snapshot.reviewStatus || 'APPROVED',
          isDeleted: false
        }
      });
    } else if (entityType === 'CLASS') {
      restoredEntity = await prisma.classModel.create({
        data: {
          projectId,
          codeId: snapshot.codeId || null,
          name: snapshot.name,
          description: snapshot.description || null,
          attributes: snapshot.attributes || [],
          methods: snapshot.methods || [],
          relationships: snapshot.relationships || [],
          reviewStatus: snapshot.reviewStatus || 'APPROVED',
          isDeleted: false
        }
      });
    }

    // Marcar como restaurado
    await prisma.projectVersionHistory.update({
      where: { id: historyId },
      data: { isRestored: true }
    });

    return {
      success: true,
      restoredEntity,
      entityType
    };
  }
}

module.exports = new VersionHistoryService();
