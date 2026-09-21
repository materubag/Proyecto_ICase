const documentAnalyzer = require('../services/document/DocumentAnalyzer');
const { AIService } = require('../services/ai/AIService');
const { validateAIResponse } = require('../services/ai/ai.contract.validator');
const prisma = require('../config/prisma');

function decodeFilename(name) {
  if (!name) return 'documento.pdf';
  try {
    // Multer (busboy) interpreta los headers de archivo como Latin-1 por defecto
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    if (!decoded.includes('\uFFFD') && /[\u00C0-\u024F]/.test(decoded)) {
      return decoded.normalize('NFC');
    }
  } catch (e) {}
  return name.normalize('NFC');
}

class DocumentController {
  /**
   * Endpoint: POST /api/documents/extract
   * Extrae texto plano, detecta secciones y requisitos por reglas sin llamar a IA.
   */
  async extract(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { message: 'Debe proporcionar un archivo PDF en el campo "file".' }
        });
      }

      if (!req.file.buffer || req.file.buffer.length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'El archivo subido está vacío.' }
        });
      }

      const safeFileName = decodeFilename(req.file.originalname);
      const extractionResult = await documentAnalyzer.extractDocument(
        req.file.buffer,
        safeFileName
      );

      return res.status(200).json({
        success: true,
        data: extractionResult
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Endpoint: POST /api/documents/analyze
   * Recibe el archivo PDF o los datos de extracción previos, reduce contexto y ejecuta análisis con IA/Ollama.
   */
  async analyze(req, res, next) {
    try {
      let extractionData;

      // Opción A: Viene un archivo directamente en multipart/form-data
      if (req.file) {
        if (!req.file.buffer || req.file.buffer.length === 0) {
          return res.status(400).json({
            success: false,
            error: { message: 'El archivo subido está vacío.' }
          });
        }
        const safeFileName = decodeFilename(req.file.originalname);
        extractionData = await documentAnalyzer.extractDocument(
          req.file.buffer,
          safeFileName
        );
      } else if (req.body && (req.body.extractedText || req.body.extractionData)) {
        // Opción B: Viene en el body el resultado de extracción previo
        extractionData = req.body.extractionData || req.body;
      } else {
        return res.status(400).json({
          success: false,
          error: { message: 'Debe enviar un archivo PDF o los datos de extracción previos para analizar.' }
        });
      }

      const analysisInput = documentAnalyzer.buildAnalysisInput(extractionData);
      const structuredResult = await documentAnalyzer.analyzeWithAI(
        analysisInput,
        req.body?.providerOverride
      );

      return res.status(200).json({
        success: true,
        data: structuredResult
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Endpoint: POST /api/projects/:projectId/import-analysis
   * Persiste transaccionalmente en PostgreSQL el análisis validado y confirmado por el usuario.
   */
  async importAnalysis(req, res, next) {
    try {
      const { projectId } = req.params;
      const analysisData = req.body.analysisData || req.body;

      if (!analysisData) {
        return res.status(400).json({
          success: false,
          error: { message: 'Debe enviar los datos estructurados del análisis para importar.' }
        });
      }

      // 1. Verificar existencia del proyecto
      const project = await prisma.project.findUnique({
        where: { id: projectId }
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          error: { message: `Proyecto con ID ${projectId} no encontrado.` }
        });
      }

      // 2. Validar estructura del contrato canónico
      const validation = validateAIResponse(analysisData);
      if (!validation.isValid) {
        return res.status(422).json({
          success: false,
          error: { message: `Estructura de datos inválida: ${validation.error}` }
        });
      }

      // 3. Persistencia transaccional sin duplicados
      await AIService.persistProjectAnalysis(projectId, analysisData);

      // 4. Actualizar descripción del proyecto si viene sugerida
      if (analysisData.project?.description) {
        await prisma.project.update({
          where: { id: projectId },
          data: {
            systemDescription: analysisData.project.description
          }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Análisis del documento importado exitosamente en el proyecto.',
        data: {
          projectId,
          requirementsCount: analysisData.requirements?.length || 0,
          actorsCount: analysisData.actors?.length || 0,
          entitiesCount: analysisData.entities?.length || 0,
          screensCount: analysisData.screens?.length || 0
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DocumentController();
