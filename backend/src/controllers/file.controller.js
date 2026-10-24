const fileService = require('../services/file.service');
const { AIService } = require('../services/ai/AIService');

class FileController {
  async getByProject(req, res, next) {
    try {
      const { projectId } = req.params;
      const data = await fileService.getFilesByProject(projectId);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async upload(req, res, next) {
    try {
      const { projectId } = req.params;
      const files = req.files || (req.file ? [req.file] : []);
      const saved = await fileService.uploadFiles(projectId, files);
      res.status(201).json({ success: true, data: saved });
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await fileService.deleteFile(id);
      res.status(200).json({ success: true, message: 'Archivo eliminado correctamente' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Consolida la descripción del proyecto con todos los documentos y audios subidos
   * y ejecuta el análisis integral ISO 29148 con gpt-5.4-nano / OpenAI.
   */
  async analyzeConsolidated(req, res, next) {
    try {
      const { projectId } = req.params;
      const consolidatedText = await fileService.getConsolidatedText(projectId);

      const result = await AIService.analyzeProject({
        projectId,
        description: consolidatedText,
        context: { isConsolidatedAnalysis: true }
      });

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new FileController();
