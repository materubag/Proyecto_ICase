const { AIService } = require('../services/ai/AIService');

class AIController {
  async analyze(req, res, next) {
    try {
      const { projectId } = req.params;
      const { description, systemDescription, context, providerOverride, modelOverride, model } = req.body;

      // Construir el input unificado
      const input = {
        projectId,
        description: description || systemDescription,
        context: context || {},
        providerOverride,
        modelOverride: modelOverride || model
      };

      const structuredResult = await AIService.analyzeProject(input);

      res.status(200).json({
        success: true,
        data: structuredResult
      });
    } catch (error) {
      // Manejo centralizado limpio de errores
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: {
          message: error.message || 'Error al procesar el análisis del proyecto.'
        }
      });
    }
  }
}

module.exports = new AIController();
