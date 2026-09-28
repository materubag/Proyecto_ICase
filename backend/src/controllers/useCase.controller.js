const useCaseService = require('../services/useCase.service');

class UseCaseController {
  async getByProject(req, res, next) {
    try {
      const { projectId } = req.params;
      const data = await useCaseService.getUseCasesByProject(projectId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const { projectId } = req.params;
      const data = await useCaseService.createUseCase(projectId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const data = await useCaseService.updateUseCase(id, req.body);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { reviewStatus } = req.body;
      const data = await useCaseService.updateStatus(id, reviewStatus);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await useCaseService.deleteUseCase(id);
      res.status(200).json({ success: true, message: 'Caso de uso eliminado correctamente' });
    } catch (err) {
      next(err);
    }
  }

  async generate(req, res, next) {
    try {
      const { projectId } = req.params;
      const data = await useCaseService.generateFundamentalUseCases(projectId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getDiagram(req, res, next) {
    try {
      const { projectId } = req.params;
      const diagram = await useCaseService.getMermaidDiagram(projectId);
      res.status(200).json({ success: true, data: { diagram } });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UseCaseController();
