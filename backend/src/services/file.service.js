const prisma = require('../config/prisma');
const env = require('../config/env');
const pdfExtractor = require('./document/PdfExtractor');

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
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Proyecto no encontrado');

    if (!files || files.length === 0) {
      return [];
    }

    const savedFiles = [];

    for (const file of files) {
      const isAudio = file.mimetype.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(file.originalname);
      const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
      const fileType = isAudio ? 'AUDIO' : 'DOCUMENT';

      let extractedText = '';
      let fileStatus = 'UPLOADED';
      let summary = '';

      if (isAudio) {
        // Análisis de audio mediante webhook estricto de n8n
        const n8nAudioUrl = env.N8N_AUDIO_WEBHOOK;
        if (!n8nAudioUrl || n8nAudioUrl.trim() === '') {
          throw new Error('N8N_AUDIO_WEBHOOK no está configurado en las variables de entorno para procesar audios.');
        }

        console.log(`[FileService] Enviando audio "${file.originalname}" a n8n: ${n8nAudioUrl}`);

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), env.N8N_TIMEOUT || 60000);

          // Enviar payload multipart o JSON con base64 a n8n
          const base64Data = file.buffer.toString('base64');
          const response = await fetch(n8nAudioUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              fileName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
              audioBase64: base64Data
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`El webhook de n8n respondió con error HTTP ${response.status}: ${response.statusText}`);
          }

          const n8nResult = await response.json();
          extractedText = n8nResult.transcription || n8nResult.text || n8nResult.content || JSON.stringify(n8nResult);
          summary = n8nResult.summary || 'Transcripción y análisis generado por n8n';
          fileStatus = 'ANALYZED';
        } catch (n8nErr) {
          console.error('[FileService] Error en n8n audio webhook:', n8nErr.message);
          throw new Error(`Error en el análisis de audio con n8n: ${n8nErr.message}`);
        }
      } else if (isPdf) {
        try {
          const extraction = await pdfExtractor.extractFromBuffer(file.buffer, file.originalname);
          extractedText = extraction.extractedText || '';
          summary = `Documento PDF extraído (${extraction.pageCount || 1} páginas)`;
          fileStatus = 'ANALYZED';
        } catch (pdfErr) {
          console.warn('[FileService] Error extrayendo PDF:', pdfErr.message);
          extractedText = '';
          fileStatus = 'ERROR';
          summary = `Error de extracción: ${pdfErr.message}`;
        }
      } else {
        // Texto plano, markdown o doc
        try {
          extractedText = file.buffer.toString('utf8');
          summary = `Documento de texto (${extractedText.length} caracteres)`;
          fileStatus = 'ANALYZED';
        } catch (txtErr) {
          extractedText = '';
          fileStatus = 'ERROR';
        }
      }

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
