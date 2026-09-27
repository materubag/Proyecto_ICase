const prisma = require('../config/prisma');

class ActorService {
  async getActorsByProject(projectId) {
    return await prisma.actor.findMany({
      where: { projectId },
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

    const { name, description } = data;
    if (!name || name.trim() === '') {
      const error = new Error('Actor name is required');
      error.statusCode = 400;
      throw error;
    }

    return await prisma.actor.create({
      data: {
        projectId,
        name: name.trim(),
        description: description ? description.trim() : null
      }
    });
  }

  async updateActor(id, data) {
    const existing = await prisma.actor.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Actor with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    if (existing.status === 'APPROVED' || existing.status === 'OUTDATED') {
      throw Object.assign(new Error('Edita este actor desde Cambios para revisar su impacto.'), { code: 'IMPACT_CONFIRMATION_REQUIRED', statusCode: 409 });
    }
    const { name, description } = data;
    return await prisma.actor.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description ? description.trim() : null })
      }
    });
  }

  async deleteActor(id) {
    const existing = await prisma.actor.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Actor with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    throw Object.assign(new Error('Desactiva este actor desde Cambios para conservar su historial.'), { code: 'IMPACT_CONFIRMATION_REQUIRED', statusCode: 409 });
  }
}

module.exports = new ActorService();
