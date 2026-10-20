const projectService = require('../services/project.service');

class MockupController {
  async list(req,res,next){try{const data=await require('../services/engineering/mockup-artifact.service').list(req.params.projectId);res.json({success:true,data});}catch(error){next(error);}}

  async generate(req, res, next) {
    try {
      // Permitir hasta 7 minutos de timeout para flujos extensos de n8n / Google Stitch
      if (req.setTimeout) req.setTimeout(420000);
      if (res.setTimeout) res.setTimeout(420000);

      const { projectId } = req.params;
      const { prompt, screenIds, mode = 'stitch' } = req.body;
      if (!['stitch', 'local'].includes(mode)) {
        return res.status(400).json({ success: false, error: { message: 'Modo de generación inválido.' } });
      }

      const project = await projectService.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: { message: `Project with ID ${projectId} not found` }
        });
      }

      const mockupData = await require('../services/engineering/mockup-artifact.service').generate(
        projectId, prompt, req.body.artifactId, req.body.navigationNodeIds, { mode, screenIds }
      );

      res.status(200).json({
        success: true,
        data: {
          ...mockupData,
          screens: mockupData.screens
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MockupController();
