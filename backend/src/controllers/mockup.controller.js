const projectService = require('../services/project.service');

class MockupController {
  async list(req,res,next){try{const data=await require('../services/engineering/mockup-artifact.service').list(req.params.projectId);res.json({success:true,data});}catch(error){next(error);}}

  async generate(req, res, next) {
    try {
      const { projectId } = req.params;
      const { prompt } = req.body;

      const project = await projectService.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: { message: `Project with ID ${projectId} not found` }
        });
      }

      const mockupData = await require('../services/engineering/mockup-artifact.service').generate(projectId, prompt, req.body.artifactId, req.body.navigationNodeIds);
      const screens = mockupData.screens;

      res.status(200).json({
        success: true,
        data: {
          ...mockupData,
          screens
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MockupController();
