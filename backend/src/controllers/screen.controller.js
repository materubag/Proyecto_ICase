const prisma = require('../config/prisma');
const versionHistoryService = require('../services/versionHistory.service');
const { generateHtmlMockup } = require('../services/mockup/mockupGenerator');
const projectService = require('../services/project.service');
const mockupService = require('../services/mockup/mockup.service');

class ScreenController {
  async getByProject(req, res, next) {
    try {
      const { projectId } = req.params;
      let screens = await prisma.screen.findMany({
        where: { projectId, isDeleted: false },
        include: { components: { orderBy: { order: 'asc' } } },
        orderBy: { route: 'asc' }
      });

      // Si no existen pantallas en la base de datos, auto-poblarlas a partir de NavigationNodes si existen
      if (screens.length === 0) {
        const nodes = await prisma.navigationNode.findMany({
          where: { projectId, isDeleted: false }
        });
        if (nodes.length > 0) {
          const uniqueNames = new Set();
          for (const node of nodes) {
            const screenName = node.to || node.name;
            if (screenName && !uniqueNames.has(screenName)) {
              uniqueNames.add(screenName);
              await prisma.screen.create({
                data: {
                  projectId,
                  name: screenName,
                  route: node.route || `/${screenName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
                  description: `Pantalla basada en el flujo de navegación ${screenName}`,
                  selectedForGeneration: true,
                  requirementIds: node.requirementIds || [],
                  actorIds: node.actorIds || []
                }
              });
            }
          }
          screens = await prisma.screen.findMany({
            where: { projectId, isDeleted: false },
            include: { components: { orderBy: { order: 'asc' } } },
            orderBy: { route: 'asc' }
          });
        }
      }

      res.status(200).json({ success: true, data: screens });
    } catch (err) {
      next(err);
    }
  }

  async toggleSelect(req, res, next) {
    try {
      const { id } = req.params;
      const { selected } = req.body;
      const updated = await prisma.screen.update({
        where: { id },
        data: { selectedForGeneration: Boolean(selected) }
      });
      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async selectMultiple(req, res, next) {
    try {
      const { projectId } = req.params;
      const { screenIds, selected } = req.body;
      if (!Array.isArray(screenIds)) {
        return res.status(400).json({ success: false, message: 'screenIds debe ser un arreglo' });
      }

      if (selected !== undefined) {
        await prisma.screen.updateMany({
          where: { projectId, id: { in: screenIds } },
          data: { selectedForGeneration: Boolean(selected) }
        });
      }

      const screens = await prisma.screen.findMany({
        where: { projectId, isDeleted: false },
        orderBy: { route: 'asc' }
      });

      res.status(200).json({ success: true, data: screens, message: 'Selección de pantallas actualizada' });
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { reviewStatus } = req.body;
      const updated = await prisma.screen.update({
        where: { id },
        data: { reviewStatus }
      });
      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await prisma.screen.update({
        where: { id },
        data: {
          ...(req.body.name && { name: req.body.name }),
          ...(req.body.description !== undefined && { description: req.body.description }),
          ...(req.body.route && { route: req.body.route }),
          ...(req.body.purpose !== undefined && { purpose: req.body.purpose }),
          ...(req.body.html !== undefined && { html: req.body.html }),
          ...(req.body.requirementIds && { requirementIds: req.body.requirementIds }),
          ...(req.body.actorIds && { actorIds: req.body.actorIds })
        }
      });
      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      const existing = await prisma.screen.findUnique({ where: { id } });
      if (!existing) throw new Error('Pantalla no encontrada');

      await versionHistoryService.recordSnapshot(
        existing.projectId,
        'SCREEN',
        id,
        'DELETED',
        existing,
        `Eliminación de la pantalla ${existing.codeId || existing.name}`
      );

      await prisma.screen.delete({ where: { id } });
      res.status(200).json({ success: true, message: 'Pantalla eliminada correctamente' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Genera el prototipo/mockup HTML para las pantallas seleccionadas.
   * Soporta generación mediante Google Stitch (n8n) o modo local inmediato.
   */
  async generateSelectedMockups(req, res, next) {
    try {
      const { projectId } = req.params;
      const { screenIds, mode = 'stitch', prompt = '' } = req.body;

      if (Array.isArray(screenIds) && screenIds.length > 0) {
        await prisma.screen.updateMany({
          where: { projectId, id: { in: screenIds } },
          data: { selectedForGeneration: true }
        });
      }

      const screens = await prisma.screen.findMany({
        where: {
          projectId,
          ...(Array.isArray(screenIds) && screenIds.length > 0
            ? { id: { in: screenIds } }
            : { selectedForGeneration: true }),
          isDeleted: false
        },
        include: { components: true }
      });

      if (screens.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No hay pantallas seleccionadas para generar prototipo. Por favor marque al menos una pantalla.'
        });
      }

      const project = await projectService.getProjectById(projectId);

      if (mode === 'stitch') {
        const result = await mockupService.generateMockup(project, prompt, screens.map(s => s.id));
        return res.status(200).json({
          success: true,
          data: result.screens,
          provider: result.provider,
          message: `Se generaron exitosamente ${result.screens.length} prototipos con Google Stitch.`
        });
      } else {
        const result = await mockupService.generateLocalMockups(project, screens.map(s => s.id));
        return res.status(200).json({
          success: true,
          data: result.screens,
          provider: 'local-interactive',
          message: `Se generaron exitosamente ${result.screens.length} prototipos interactivos.`
        });
      }
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ScreenController();
