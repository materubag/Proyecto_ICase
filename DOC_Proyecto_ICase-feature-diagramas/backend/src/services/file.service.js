const prisma = require('../config/prisma');

class FileService {
  async getFilesByProject(projectId) {
    return await prisma.projectFile.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Procesa la subida opcional de múltiples archivos (documentos y audios).
   * @param {string} projectId
   * @param {Array<Express.Multer.File>} files
   */
  async uploadFiles(projectId, files) {
    for(const file of files || []) {
      require('../utils/pdfFilePolicy').validate(file);
      require('../utils/pdfFilePolicy').validateBuffer(file.buffer);
    }
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Proyecto no encontrado');

    if (!files || files.length === 0) {
      return [];
    }

    const sources=await require('./source.service').createPdfSources(projectId,files);
    const savedFiles = [];

    for (const [index,file] of files.entries()) {
      const fileType = 'DOCUMENT';

      let extractedText = '';
      let fileStatus = 'UPLOADED';
      let summary = '';

      const version=sources[index].source.currentVersion;
      extractedText = version.extractedText || '';
      summary = 'Documento PDF (' + (version.metadata?.pageCount||'?') + ' paginas)';
      fileStatus = 'ANALYZED';

      const existing=await prisma.projectFile.findFirst({where:{projectId,name:file.originalname,content:extractedText}});
      if(existing){savedFiles.push(existing);continue;}

      const created = await prisma.projectFile.create({
        data: {
          projectId,
          name: file.originalname,
          fileType,
          mimeType: file.mimetype,
          size: file.size,
          content: extractedText,
          status: fileStatus,
          summary
        }
      });

      savedFiles.push(created);
    }

    return savedFiles;
  }

  async deleteFile(id) {
    const existing = await prisma.projectFile.findUnique({ where: { id } });
    if (!existing) throw new Error('Archivo no encontrado');
    return await prisma.projectFile.delete({ where: { id } });
  }

  /**
   * Obtiene todo el texto consolidado de descripción del proyecto, documentos y audios para análisis.
   */
  async getConsolidatedText(projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { files: true }
    });

    if (!project) throw new Error('Proyecto no encontrado');

    const sections = [];
    if (project.description || project.systemDescription) {
      sections.push(`[DESCRIPCIÓN DEL PROYECTO]:\n${project.description || project.systemDescription}`);
    }

    for (const f of project.files) {
      if (f.content && f.content.trim()) {
        const typeLabel = f.fileType === 'AUDIO' ? 'TRANSCRIPCIÓN DE AUDIO' : 'CONTENIDO DE DOCUMENTO';
        sections.push(`[${typeLabel} - ${f.name}]:\n${f.content.trim()}`);
      }
    }

    return sections.join('\n\n---\n\n');
  }
}

module.exports = new FileService();
