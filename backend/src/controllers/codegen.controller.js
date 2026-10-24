/**
 * Code Generation Controller
 * Handles preview and ZIP download requests
 */

const codeGeneratorService = require('../services/codegen/codeGenerator.service');

exports.getPreview = async (req, res) => {
  try {
    const { projectId } = req.params;
    const includeDocker = req.query.includeDocker !== 'false';

    const result = await codeGeneratorService.generateProjectFiles(projectId, {
      includeDocker
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error en codegen.getPreview:', error);
    return res.status(error.message.includes('no encontrado') ? 404 : 400).json({
      success: false,
      error: { message: error.message }
    });
  }
};

exports.downloadZip = async (req, res) => {
  try {
    const { projectId } = req.params;
    const includeDocker = req.query.includeDocker !== 'false';

    const { filename, buffer, size } = await codeGeneratorService.generateZipArchive(projectId, {
      includeDocker
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', size);

    return res.end(buffer);
  } catch (error) {
    console.error('Error en codegen.downloadZip:', error);
    return res.status(400).json({
      success: false,
      error: { message: error.message }
    });
  }
};
