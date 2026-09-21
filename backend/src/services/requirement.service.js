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

    return await prisma.requirement.create({
      data: {
        projectId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        type: type || 'FUNCTIONAL',
        priority: priority || 'MEDIUM',
        status: status || 'PENDING',
        actorIds: Array.isArray(actorIds) ? actorIds : [],
        dependencies: Array.isArray(dependencies) ? dependencies : []
      }
    });
  }

  async updateRequirement(id, data) {
    const existing = await prisma.requirement.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Requisito con ID ${id} no encontrado`);
      error.statusCode = 404;
      throw error;
    }

    const { code, name, description, type, priority, status, actorIds, dependencies } = data;
    return await prisma.requirement.update({
      where: { id },
      data: {
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
  }

  async deleteRequirement(id) {
    const existing = await prisma.requirement.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Requisito con ID ${id} no encontrado`);
      error.statusCode = 404;
      throw error;
    }

    return await prisma.requirement.delete({
      where: { id }
    });
  }
}

module.exports = new RequirementService();
