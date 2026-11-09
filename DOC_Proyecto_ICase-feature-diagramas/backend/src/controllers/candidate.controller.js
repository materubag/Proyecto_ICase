const candidateService = require('../services/analysis/candidate.service');

class CandidateController {
  async listByProject(req, res, next) {
    try {
      const candidates = await candidateService.listByProject(req.params.projectId, req.query);
      res.json({ success: true, data: candidates });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const candidate = await candidateService.getById(req.params.candidateId);
      if (!candidate) {
        return res.status(404).json({ success: false, error: { message: 'Candidato no encontrado.' } });
      }
      res.json({ success: true, data: candidate });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const updated = await candidateService.update(req.params.candidateId, req.body);
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  async approve(req, res, next) {
    try {
      const result = await candidateService.approve(req.params.candidateId);
      const codeOrName = result.requirement?.code || result.promotedItem?.code || result.promotedItem?.name || result.candidate?.name || '';
      res.json({
        success: true,
        data: result,
        message: `Candidato promovido a información oficial (${codeOrName}).`
      });
    } catch (error) {
      next(error);
    }
  }

  async reject(req, res, next) {
    try {
      const rejected = await candidateService.reject(req.params.candidateId, req.body.reason);
      res.json({
        success: true,
        data: rejected,
        message: 'Candidato rechazado.'
      });
    } catch (error) {
      next(error);
    }
  }

  async approveBatch(req, res, next) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: { message: 'Debe proporcionar un array de IDs.' } });
      }
      const results = await candidateService.approveBatch(ids);
      res.json({ success: true, data: results });
    } catch (error) {
      next(error);
    }
  }

  async rejectBatch(req, res, next) {
    try {
      const { ids, reason } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: { message: 'Debe proporcionar un array de IDs.' } });
      }
      const results = await candidateService.rejectBatch(ids, reason);
      res.json({ success: true, data: results });
    } catch (error) {
      next(error);
    }
  }

  async approveCategory(req, res, next) {
    try {
      const { projectId } = req.params;
      const { categoryGroup } = req.body;
      const results = await candidateService.approveAllCategory(projectId, categoryGroup);
      res.json({ success: true, data: results });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req, res, next) {
    try {
      const stats = await candidateService.getStats(req.params.projectId);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CandidateController();
