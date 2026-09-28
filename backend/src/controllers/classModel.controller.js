const classModelService = require('../services/classModel.service');

class ClassModelController {
  async getByProject(req, res, next) {
    try {
      const { projectId } = req.params;
      const data = await classModelService.getClassesByProject(projectId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const { projectId } = req.params;
      const data = await classModelService.createClass(projectId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const data = await classModelService.updateClass(id, req.body);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { reviewStatus } = req.body;
      const data = await classModelService.updateStatus(id, reviewStatus);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await classModelService.deleteClass(id);
      res.status(200).json({ success: true, message: 'Clase eliminada correctamente' });
    } catch (err) {
      next(err);
    }
  }

  async generate(req, res, next) {
    try {
      const { projectId } = req.params;
      const data = await classModelService.generateClassesFromEntities(projectId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getDiagram(req, res, next) {
    try {
      const { projectId } = req.params;
      const diagram = await classModelService.getMermaidDiagram(projectId);
      res.status(200).json({ success: true, data: { diagram } });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ClassModelController();
