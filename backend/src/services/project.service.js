const prisma = require('../config/prisma');

class ProjectService {
  async getAllProjects() {
    return await prisma.project.findMany({
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

  async getProjectById(id) {
    return await prisma.project.findUnique({
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
        }
      }
    });
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

  async deleteProject(id) {
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Project with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    return await prisma.project.delete({
      where: { id }
    });
  }
}

module.exports = new ProjectService();
