const requirementService = require('../services/requirement.service');

class RequirementController {
  async getByProject(req, res, next) {
    try {
      const { projectId } = req.params;
      const requirements = await requirementService.getRequirementsByProject(projectId);
      res.status(200).json({
        success: true,
        data: requirements
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { projectId } = req.params;
      const requirement = await requirementService.createRequirement(projectId, req.body);
      res.status(201).json({
        success: true,
        data: requirement
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await requirementService.updateRequirement(id, req.body);
      res.status(200).json({
        success: true,
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const updated = await requirementService.updateStatus(id, status);
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
      const result = await requirementService.deleteRequirement(id);
      res.status(200).json({
        success: true,
        data: result,
        message: `Requirement ${id} successfully deleted`
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RequirementController();
