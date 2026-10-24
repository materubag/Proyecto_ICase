const versionHistoryService = require('../services/versionHistory.service');

class VersionHistoryController {
  async getByProject(req, res, next) {
    try {
      const { projectId } = req.params;
      const data = await versionHistoryService.getHistoryByProject(projectId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async restore(req, res, next) {
    try {
      const { historyId } = req.params;
      const result = await versionHistoryService.restoreSnapshot(historyId);
      res.status(200).json({ success: true, data: result, message: 'Elemento recuperado exitosamente' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new VersionHistoryController();
