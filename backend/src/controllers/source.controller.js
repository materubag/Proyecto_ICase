const sourceService = require('../services/source.service');
const analysisPipeline = require('../services/analysis/analysisPipeline');

class SourceController {
  async list(req, res, next) {
    try { res.json({ success: true, data: await sourceService.listByProject(req.params.projectId, req.query) }); } catch (error) { next(error); }
  }

  async upload(req, res, next) {
    try {
      if (!req.files?.length) return res.status(400).json({ success: false, error: { message: 'Debe proporcionar al menos un archivo PDF.' } });
      res.status(201).json({ success: true, data: await sourceService.createPdfSources(req.params.projectId, req.files) });
    } catch (error) { next(error); }
  }

  async uploadAudio(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ success: false, error: { message: 'Debe proporcionar un archivo de audio.' } });
      res.status(201).json({ success: true, data: await sourceService.createAudioSource(req.params.projectId, req.file) });
    } catch (error) { next(error); }
  }

  async retryAudio(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ success: false, error: { message: 'Debe proporcionar el archivo de audio para reintentar la transcripción.' } });
      res.status(200).json({ success: true, data: await sourceService.retryAudioSource(req.params.sourceId, req.file) });
    } catch (error) { next(error); }
  }

  async analyze(req, res, next) {
    try {
      const result = await analysisPipeline.run({
        sourceId: req.params.sourceId,
        sourceVersionId: req.body?.sourceVersionId,
        force: req.body?.force === true
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      const source = await sourceService.getById(req.params.sourceId);
      if (!source) return res.status(404).json({ success: false, error: { message: 'Fuente no encontrada.' } });
      res.json({ success: true, data: source });
    } catch (error) { next(error); }
  }

  async getVersion(req, res, next) {
    try {
      const version = await sourceService.getVersion(req.params.sourceId, req.params.version);
      if (!version) return res.status(404).json({ success: false, error: { message: 'Versión de fuente no encontrada.' } });
      res.json({ success: true, data: version });
    } catch (error) { next(error); }
  }
}

module.exports = new SourceController();