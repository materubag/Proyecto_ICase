const projectService = require('../services/project.service');
const mockupService = require('../services/mockup/mockup.service');
const prisma = require('../config/prisma');

class MockupController {
  async generate(req, res, next) {
    try {
      const { projectId } = req.params;
      const { prompt, screenIds, mode = 'stitch' } = req.body;

      const project = await projectService.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: { message: `Project with ID ${projectId} not found` }
        });
      }

      // Asegurar que las pantallas seleccionadas queden marcadas en la BD
      if (Array.isArray(screenIds) && screenIds.length > 0) {
        await prisma.screen.updateMany({
          where: { projectId, id: { in: screenIds } },
          data: { selectedForGeneration: true }
        });
      }

      let mockupData;
      if (mode === 'local') {
        mockupData = await mockupService.generateLocalMockups(project, screenIds);
      } else {
        // Generar mediante Google Stitch en n8n
        mockupData = await mockupService.generateMockup(project, prompt, screenIds);
      }

      // Obtener pantallas actualizadas desde la base de datos
      const updatedScreens = await prisma.screen.findMany({
        where: { projectId, isDeleted: false },
        include: { components: { orderBy: { order: 'asc' } } },
        orderBy: { route: 'asc' }
      });

      res.status(200).json({
        success: true,
        data: {
          ...mockupData,
          screens: mockupData.screens || updatedScreens,
          allScreens: updatedScreens
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MockupController();
