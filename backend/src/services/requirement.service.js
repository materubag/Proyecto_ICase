const prisma = require('../config/prisma');

class RequirementService {
  async getRequirementsByProject(projectId) {
    return await prisma.requirement.findMany({
      where: { projectId },
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

    const { code, name, description, type, priority, status, actorIds, dependencies } = data;
    if (!code || !name || !description) {
      const error = new Error('Código, nombre y descripción son campos obligatorios');
      error.statusCode = 400;
      throw error;
    }

    return require('./engineering/domain').transaction(async tx => {
    const created = await tx.requirement.create({
      data: {
        projectId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        type: type || 'FUNCTIONAL',
        priority: priority || 'MEDIUM',
        status: status || 'PENDING',
        qualityReport: require('./engineering/change.service').requirementData(data).qualityReport,
        actorIds: Array.isArray(actorIds) ? actorIds : [],
        dependencies: Array.isArray(dependencies) ? dependencies : []
      }
    });
    await require('./engineering/change.service').remember(tx, created);
    return created;
    });
  }

  async updateRequirement(id, data) {
    const existing = await prisma.requirement.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Requisito con ID ${id} no encontrado`);
      error.statusCode = 404;
      throw error;
    }

    if (existing.status === 'APPROVED' || existing.status === 'IMPLEMENTED' || existing.revision > 1) {
      const error = new Error('Este requisito requiere revisión de impacto. Crea una solicitud en Cambios.');
      error.code = 'IMPACT_CONFIRMATION_REQUIRED'; error.statusCode = 409; throw error;
    }
    const { code, name, description, type, priority, status, actorIds, dependencies } = data;
    const qualityReport = require('./engineering/change.service').requirementData(data, existing).qualityReport;
    return require('./engineering/domain').transaction(async tx => {
    const current = await tx.requirement.findUnique({ where: { id } });
    if (current.revision !== existing.revision || current.status !== existing.status) throw Object.assign(new Error('El requisito cambió. Actualiza la vista.'), { statusCode: 409, code: 'VERSION_CONFLICT' });
    await require('./engineering/change.service').remember(tx, current);
    const updated = await tx.requirement.update({
      where: { id },
      data: {
        qualityReport,
        revision: { increment: 1 },
        ...(code !== undefined && { code: code.trim().toUpperCase() }),
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(type !== undefined && { type }),
        ...(priority !== undefined && { priority }),
        ...(status !== undefined && { status }),
        ...(actorIds !== undefined && { actorIds: Array.isArray(actorIds) ? actorIds : [] }),
        ...(dependencies !== undefined && { dependencies: Array.isArray(dependencies) ? dependencies : [] })
      }
    });
    await require('./engineering/change.service').remember(tx, updated);
    return updated;
    });
  }

  async deleteRequirement(id) {
    const existing = await prisma.requirement.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Requisito con ID ${id} no encontrado`);
      error.statusCode = 404;
      throw error;
    }

    const error = new Error('La eliminación conserva el historial y requiere una solicitud en Cambios.');
    error.code = 'IMPACT_CONFIRMATION_REQUIRED'; error.statusCode = 409; throw error;
  }
}

module.exports = new RequirementService();
