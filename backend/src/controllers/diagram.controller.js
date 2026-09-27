const diagramAvailabilityService = require('../services/diagrams/diagramAvailabilityService');
const diagramAiService = require('../services/diagrams/diagramAiService');

class DiagramController {
  /**
   * Evaluates and returns availability of all 5 diagram types for a project.
   * GET /api/projects/:projectId/diagrams/availability
   */
  async getAvailability(req, res, next) {
    try {
      const { projectId } = req.params;
      const report = await diagramAvailabilityService.checkAvailability(projectId);
      return res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves current stored diagram for a specific type.
   * GET /api/projects/:projectId/diagrams/:type
   */
  async getDiagram(req, res, next) {
    try {
      const { projectId, type } = req.params;
      const diagram = await diagramAiService.getStoredDiagram(projectId, type.toUpperCase());
      return res.json({ success: true, data: diagram });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Generates a diagram or multiple diagrams via Gemini.
   * POST /api/projects/:projectId/diagrams/generate
   * Body: { type: 'USE_CASE', force: false } or { types: ['USE_CASE', 'ER'], force: false }
   */
  async generate(req, res, next) {
    try {
      const { projectId } = req.params;
      const { type, types, force = false } = req.body;

      if (Array.isArray(types) && types.length > 0) {
        const batchResults = await diagramAiService.generateBatch(projectId, types.map(t => t.toUpperCase()), { force });
        return res.json({ success: true, data: batchResults });
      }

      if (!type) {
        return res.status(400).json({
          success: false,
          error: 'Debe especificar el parámetro "type" o "types" para la generación.'
        });
      }

      const result = await diagramAiService.generateDiagram(projectId, type.toUpperCase(), { force });
      return res.json({ success: true, data: result });
    } catch (err) {
      if (err.code === 'INSUFFICIENT_DATA') {
        return res.status(422).json({
          success: false,
          code: 'INSUFFICIENT_DATA',
          error: err.message,
          details: err.details
        });
      }
      next(err);
    }
  }
}

module.exports = new DiagramController();
