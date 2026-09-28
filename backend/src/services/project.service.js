const prisma = require('../config/prisma');

class ProjectService {
  async getAllProjects(filterArchived = true) {
    return await prisma.project.findMany({

      where: filterArchived ? { status: { not: 'ARCHIVED' } } : undefined,

      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: {
            requirements: true,
            actors: true,
            entities: true,
            screens: true
          }
        }
      }
    });
  }

  async getProjectById(id, allowArchived = false) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        requirements: {
          orderBy: { code: 'asc' }
        },
        actors: {
          orderBy: { name: 'asc' }
        },
        entities: {
          include: {
            attributes: { orderBy: { name: 'asc' } }
          },
          orderBy: { name: 'asc' }
        },
        relationships: {
          orderBy: { createdAt: 'asc' }
        },
        screens: {
          include: {
            components: {
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { route: 'asc' }
        },
        navigationNodes: {
          orderBy: { createdAt: 'asc' }
        },
        architectures: {
          include: {
            components: true
          },
          orderBy: { createdAt: 'desc' }
        },
        useCases: {
          orderBy: { codeId: 'asc' }
        },
        classModels: {
          orderBy: { name: 'asc' }
        },
        files: {
          orderBy: { createdAt: 'desc' }
        },
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    });

    if (!project || (!allowArchived && project.status === 'ARCHIVED')) {
      return null;
    }

    return project;
  }

  async createProject(data) {
    const { name, description, systemDescription, status } = data;
    if (!name || name.trim() === '') {
      const error = new Error('Project name is required');
      error.statusCode = 400;
      throw error;
    }

    return await prisma.project.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        systemDescription: systemDescription ? systemDescription.trim() : null,
        status: status || 'PLANNING'
      }
    });
  }

  async updateProject(id, data) {
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Project with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    const { name, description, systemDescription, status } = data;
    return await prisma.project.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description ? description.trim() : null }),
        ...(systemDescription !== undefined && { systemDescription: systemDescription ? systemDescription.trim() : null }),
        ...(status !== undefined && { status })
      },
      include: {
        requirements: true,
        actors: true,
        entities: { include: { attributes: true } },
        relationships: true,
        screens: { include: { components: true } },
        navigationNodes: true,
        architectures: { include: { components: true } }
      }
    });
  }

  async replaceProjectScreens() {
    throw Object.assign(new Error('Las pantallas generadas requieren revisi?n como ArtifactVersion. Usa el servicio de mockups versionados.'), { code: 'IMPACT_CONFIRMATION_REQUIRED', statusCode: 409 });
  }

  async deleteProject(id) {
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Project with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Limpiar SourceVersion y Source para evitar referencias cruzadas
      const sources = await tx.source.findMany({ where: { projectId: id }, select: { id: true } });
      const sourceIds = sources.map(s => s.id);
      if (sourceIds.length > 0) {
        await tx.source.updateMany({ where: { id: { in: sourceIds } }, data: { currentVersionId: null } });
        await tx.sourceVersion.deleteMany({ where: { sourceId: { in: sourceIds } } });
      }

      // 2. Desvincular referencias en RequirementCandidate y NeedCandidate
      await tx.requirementCandidate.updateMany({
        where: { projectId: id },
        data: { promotedRequirementId: null, needCandidateId: null }
      });

      // 3. Eliminar el proyecto físicamente (PostgreSQL cascade borrará todos los elementos hijos asociados)
      return await tx.project.delete({
        where: { id }
      });
    });
  }

  async restoreProject(id) {
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Project with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    return await prisma.project.update({
      where: { id },
      data: { status: 'PLANNING' }
    });
  }
}

module.exports = new ProjectService();
