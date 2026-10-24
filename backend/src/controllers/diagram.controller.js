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
      const isForce = typeof force === 'object' ? Boolean(force.force) : Boolean(force);

      if (Array.isArray(types) && types.length > 0) {
        const batchResults = await diagramAiService.generateBatch(projectId, types.map(t => t.toUpperCase()), { force: isForce });
        return res.json({ success: true, data: batchResults });
      }

      if (!type) {
        return res.status(400).json({
          success: false,
          error: 'Debe especificar el parámetro "type" o "types" para la generación.'
        });
      }

      const result = await diagramAiService.generateDiagram(projectId, type.toUpperCase(), { force: isForce });
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

  /**
   * Validates diagram syntax and semantic constraints without saving.
   * POST /api/projects/:projectId/diagrams/:type/validate
   * Body: { code: string, crossCompareCode?: string }
   */
  async validate(req, res, next) {
    try {
      const { type } = req.params;
      const { code, crossCompareCode } = req.body;
      const report = diagramAiService.validateDiagram(type.toUpperCase(), code || '', crossCompareCode || null);
      return res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Saves and versions user-edited Mermaid diagram code.
   * PUT /api/projects/:projectId/diagrams/:type
   * Body: { code: string }
   */
  async updateDiagram(req, res, next) {
    try {
      const { projectId, type } = req.params;
      const { code } = req.body;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ success: false, error: 'Se requiere el código Mermaid en el campo "code".' });
      }
      const saved = await diagramAiService.saveCustomDiagram(projectId, type.toUpperCase(), code);
      return res.json({ success: true, data: saved });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Cross-validates relational ER model vs OOP Class model.
   * POST /api/projects/:projectId/diagrams/cross-validate
   * Body: { erCode: string, classCode: string }
   */
  async crossValidate(req, res, next) {
    try {
      const { erCode, classCode } = req.body;
      const diagramSemanticValidator = require('../services/diagrams/diagramSemanticValidator');
      const report = diagramSemanticValidator.crossValidate(erCode || '', classCode || '');
      return res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DiagramController();
