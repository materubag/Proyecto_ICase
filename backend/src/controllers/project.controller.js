const projectService = require('../services/project.service');

class ProjectController {
  async getAll(req, res, next) {
    try {
      const projects = await projectService.getAllProjects();
      res.status(200).json({
        success: true,
        data: projects
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const project = await projectService.getProjectById(id);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: { message: `Project with ID ${id} not found` }
        });
      }
      res.status(200).json({
        success: true,
        data: project
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const newProject = await projectService.createProject(req.body);
      res.status(201).json({
        success: true,
        data: newProject
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await projectService.updateProject(id, req.body);
      res.status(200).json({
        success: true,
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await projectService.deleteProject(id);
      res.status(200).json({
        success: true,
        data: { message: `Project ${id} successfully deleted` }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProjectController();
