const prisma = require('../config/prisma');
const versionHistoryService = require('../services/versionHistory.service');
const { generateHtmlMockup } = require('../services/mockup/mockupGenerator');

class ScreenController {
  async getByProject(req, res, next) {
    try {
      const { projectId } = req.params;
      const screens = await prisma.screen.findMany({
        where: { projectId, isDeleted: false },
        include: { components: { orderBy: { order: 'asc' } } },
        orderBy: { route: 'asc' }
      });
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
      const { screenIds, selected } = req.body;
      if (!Array.isArray(screenIds)) {
        return res.status(400).json({ success: false, message: 'screenIds debe ser un arreglo' });
      }
      await prisma.screen.updateMany({
        where: { id: { in: screenIds } },
        data: { selectedForGeneration: Boolean(selected) }
      });
      res.status(200).json({ success: true, message: 'Selección de pantallas actualizada' });
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
   */
  async generateSelectedMockups(req, res, next) {
    try {
      const { projectId } = req.params;
      const screens = await prisma.screen.findMany({
        where: { projectId, selectedForGeneration: true },
        include: { components: true }
      });

      if (screens.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No hay pantallas seleccionadas para generar prototipo. Por favor marque al menos una pantalla.'
        });
      }

      const generated = [];
      for (const screen of screens) {
        const html = generateHtmlMockup(screen);
        const updated = await prisma.screen.update({
          where: { id: screen.id },
          data: { html, reviewStatus: 'APPROVED' }
        });
        generated.push(updated);
      }

      res.status(200).json({
        success: true,
        data: generated,
        message: `Se generaron exitosamente ${generated.length} prototipos.`
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ScreenController();
