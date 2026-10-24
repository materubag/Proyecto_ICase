const fs = require('fs');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const documentAnalyzer = require('./document/DocumentAnalyzer');
const whisperService = require('./audio/WhisperService');
const crossDocumentDeduplicator = require('./document/crossDocumentDeduplicator');
const { sanitizeFilename } = require('../utils/fileSecurity');

function sha256FromBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function sha256FromFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

class SourceService {
  async listByProject(projectId, filters = {}) {
    return prisma.source.findMany({
      where: {
        projectId,
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.status ? { status: filters.status } : {})
      },
      include: {
        currentVersion: {
          include: {
            segments: { orderBy: { startTime: 'asc' } },
            requirementCandidates: {
              select: {
                id: true,
                temporaryCode: true,
                title: true,
                statement: true,
                type: true,
                category: true,
                status: true,
                origin: true,
                qualityReport: true
              }
            }
          }
        },
        versions: {
          orderBy: { version: 'desc' },
          select: {
            id: true,
            version: true,
            createdAt: true,
            analyzedAt: true,
            metadata: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getById(id) {
    return prisma.source.findUnique({
      where: { id },
      include: {
        currentVersion: {
          include: {
            segments: { orderBy: { startTime: 'asc' } }
          }
        },
        versions: {
          orderBy: { version: 'desc' },
          include: {
            segments: { orderBy: { startTime: 'asc' } }
          }
        }
      }
    });
  }

  async getVersion(sourceId, version) {
    return prisma.sourceVersion.findFirst({
      where: { sourceId, version: Number(version) },
      include: {
        segments: { orderBy: { startTime: 'asc' } }
      }
    });
  }

  /**
   * Procesa la subida secuencial de documentos PDF con liberación inmediata de disco/memoria.
   */
  async createPdfSources(projectId, files) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) {
      // Limpiar temporales si existen
      for (const file of files) {
        if (file?.path && fs.existsSync(file.path)) {
          await fs.promises.unlink(file.path).catch(() => {});
        }
      }
      const error = new Error(`Proyecto con ID ${projectId} no encontrado.`);
      error.statusCode = 404;
      throw error;
    }

    const results = [];
    let pdfsReceived = files.length;
    let duplicateFiles = 0;
    let totalRf = 0, totalRnf = 0, totalRules = 0, totalActors = 0;

    for (const file of files) {
      const name = sanitizeFilename(file.originalname);
      const filePath = file.path;
      let buffer = file.buffer;

      let fileHash;
      try {
        if (filePath && fs.existsSync(filePath)) {
          fileHash = await sha256FromFile(filePath);
          if (!buffer) {
            buffer = await fs.promises.readFile(filePath);
          }
        } else if (buffer) {
          fileHash = sha256FromBuffer(buffer);
        } else {
          throw new Error(`No se pudo leer el archivo PDF ${name}`);
        }
      } catch (hashErr) {
        if (filePath && fs.existsSync(filePath)) await fs.promises.unlink(filePath).catch(() => {});
        throw hashErr;
      }

      // Comprobar si ya existe la misma versión exacta por hash
      const existingVersion = await prisma.sourceVersion.findFirst({
        where: { fileHash, source: { projectId } },
        select: { sourceId: true }
      });

      if (existingVersion) {
        duplicateFiles++;
        if (filePath && fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath).catch(() => {});
        }
        results.push({
          duplicate: true,
          message: 'El documento ya existe en el proyecto (SHA-256 coincidente).',
          source: await this.getById(existingVersion.sourceId)
        });
        continue;
      }

      const sameName = await prisma.source.findFirst({
        where: { projectId, name },
        orderBy: { updatedAt: 'desc' }
      });

      let extraction;
      try {
        extraction = await documentAnalyzer.extractDocument(buffer, name);
      } finally {
        // Liberar archivo temporal en disco de inmediato
        if (filePath && fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath).catch(() => {});
        }
      }

      totalRf += (extraction.functionalRequirements || []).length;
      totalRnf += (extraction.nonFunctionalRequirements || []).length;
      totalRules += (extraction.businessRules || []).length;
      totalActors += (extraction.actors || []).length;

      const source = await prisma.$transaction(async (tx) => {
        const sourceRecord = sameName
          ? sameName
          : await tx.source.create({
              data: {
                projectId,
                name,
                type: 'PDF',
                mimeType: file.mimetype || 'application/pdf',
                fileSize: file.size,
                fileHash,
                status: 'EXTRACTED'
              }
            });

        const maxVersion = sameName
          ? (await tx.sourceVersion.aggregate({ where: { sourceId: sameName.id }, _max: { version: true } }))._max.version || 0
          : 0;

        const version = await tx.sourceVersion.create({
          data: {
            sourceId: sourceRecord.id,
            version: maxVersion + 1,
            fileHash,
            extractedText: extraction.extractedText,
            normalizedText: extraction.normalizedText,
            metadata: {
              pageCount: extraction.pageCount,
              pagesWithoutText: extraction.pagesWithoutText || []
            },
            previousVersionId: sameName?.currentVersionId || null
          }
        });

        return tx.source.update({
          where: { id: sourceRecord.id },
          data: {
            fileSize: file.size,
            fileHash,
            status: 'EXTRACTED',
            currentVersionId: version.id
          },
          include: { currentVersion: true, versions: true }
        });
      });

      results.push({ duplicate: false, newVersion: Boolean(sameName), source });
    }

    const pdfsUnique = pdfsReceived - duplicateFiles;
    console.log(`[ANALYSIS] pdfsReceived=${pdfsReceived} pdfsUnique=${pdfsUnique} duplicateFiles=${duplicateFiles}`);
    console.log(`[RULES] rfDetected=${totalRf} rnfDetected=${totalRnf} businessRulesDetected=${totalRules} actorsDetected=${totalActors}`);

    return results;
  }

  /**
   * Procesa la subida de un archivo de audio como Source utilizando Faster-Whisper local.
   * Flujo: Upload -> Temp File -> Hash -> Source/SourceVersion -> Faster-Whisper -> Unlink Temp.
   */
  async createAudioSource(projectId, file) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) {
      if (file?.path && fs.existsSync(file.path)) {
        await fs.promises.unlink(file.path).catch(() => {});
      }
      const error = new Error(`Proyecto con ID ${projectId} no encontrado.`);
      error.statusCode = 404;
      throw error;
    }

    const name = sanitizeFilename(file.originalname);
    const mimeType = file.mimetype || 'audio/mpeg';
    const filePath = file.path;

    // Calcular hash SHA-256
    let fileHash;
    if (filePath && fs.existsSync(filePath)) {
      fileHash = await sha256FromFile(filePath);
    } else if (file.buffer) {
      fileHash = sha256FromBuffer(file.buffer);
    } else {
      const error = new Error('No se pudo acceder a los datos del archivo de audio.');
      error.statusCode = 400;
      throw error;
    }

    // 1. Detección de duplicado por SHA-256 dentro del proyecto
    const existingVersion = await prisma.sourceVersion.findFirst({
      where: { fileHash, source: { projectId } },
      select: { sourceId: true }
    });

    if (existingVersion) {
      if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath).catch(() => {});
      }
      const existingSource = await this.getById(existingVersion.sourceId);
      return {
        duplicate: true,
        message: 'El archivo de audio es idéntico a uno ya existente en el proyecto (mismo hash SHA-256). No se requiere nueva transcripción.',
        source: existingSource
      };
    }

    // 2. Verificar si existe una fuente previa con el mismo nombre
    const sameName = await prisma.source.findFirst({
      where: { projectId, name },
      orderBy: { updatedAt: 'desc' }
    });

    // 3. Crear o actualizar Source a estado TRANSCRIBING
    let sourceRecord;
    if (sameName) {
      sourceRecord = await prisma.source.update({
        where: { id: sameName.id },
        data: {
          status: 'TRANSCRIBING',
          mimeType,
          fileSize: file.size,
          fileHash
        }
      });
    } else {
      sourceRecord = await prisma.source.create({
        data: {
          projectId,
          name,
          type: 'AUDIO',
          mimeType,
          fileSize: file.size,
          fileHash,
          status: 'TRANSCRIBING'
        }
      });
    }

    // 4. Contactar servicio local faster-whisper (sin n8n ni Gemini)
    let transcription;
    try {
      transcription = await whisperService.transcribeAudio({
        filePath,
        filename: name,
        mimeType
      });
    } catch (transcriptionErr) {
      console.error(`[SourceService] Error en transcripción Whisper para fuente ${sourceRecord.id}:`, transcriptionErr.message);

      await prisma.source.update({
        where: { id: sourceRecord.id },
        data: { status: 'TRANSCRIPTION_ERROR' }
      });

      if (!sameName || !sameName.currentVersionId) {
        const count = await prisma.sourceVersion.count({ where: { sourceId: sourceRecord.id } });
        if (count === 0) {
          await prisma.sourceVersion.create({
            data: {
              sourceId: sourceRecord.id,
              version: 1,
              fileHash,
              extractedText: null,
              metadata: {
                error: transcriptionErr.message,
                failedAt: new Date().toISOString()
              }
            }
          });
        }
      }

      if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath).catch(() => {});
      }

      const err = new Error(`Error en transcripción de audio local: ${transcriptionErr.message}`);
      err.statusCode = transcriptionErr.statusCode || 502;
      err.sourceId = sourceRecord.id;
      throw err;
    } finally {
      // 5. Eliminar archivo temporal de audio en disco en finally
      if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath).catch((err) => {
          console.warn(`[SourceService] No se pudo eliminar archivo temporal ${filePath}:`, err.message);
        });
      }
    }

    // 6. Transcripción exitosa: Guardar texto completo en SourceVersion
    const updatedSource = await prisma.$transaction(async (tx) => {
      const maxVersionAgg = await tx.sourceVersion.aggregate({
        where: { sourceId: sourceRecord.id },
        _max: { version: true }
      });
      const nextVersion = (maxVersionAgg._max.version || 0) + 1;

      const newSourceVersion = await tx.sourceVersion.create({
        data: {
          sourceId: sourceRecord.id,
          version: nextVersion,
          fileHash,
          extractedText: transcription.text,
          normalizedText: transcription.text,
          metadata: {
            provider: 'faster-whisper',
            language: transcription.language,
            duration: transcription.duration,
            transcribedAt: new Date().toISOString()
          },
          previousVersionId: sameName?.currentVersionId || null
        }
      });

      // Crear un segmento para mantener compatibilidad con cualquier vista que consulte segments
      if (transcription.text && transcription.text.length > 0) {
        await tx.audioSegment.create({
          data: {
            sourceVersionId: newSourceVersion.id,
            sequence: 1,
            startTime: 0,
            endTime: transcription.duration || 10,
            text: transcription.text,
            speaker: 'Hablante',
            confidence: 0.95
          }
        });
      }

      return tx.source.update({
        where: { id: sourceRecord.id },
        data: {
          type: 'AUDIO',
          mimeType,
          fileSize: file.size,
          fileHash,
          status: 'TRANSCRIBED',
          currentVersionId: newSourceVersion.id
        },
        include: {
          currentVersion: {
            include: {
              segments: { orderBy: { startTime: 'asc' } }
            }
          },
          versions: true
        }
      });
    });

    return {
      duplicate: false,
      newVersion: Boolean(sameName),
      source: updatedSource
    };
  }

  async retryAudioSource(sourceId, file) {
    const source = await prisma.source.findUnique({
      where: { id: sourceId },
      include: { currentVersion: true }
    });

    if (!source) {
      if (file?.path && fs.existsSync(file.path)) {
        await fs.promises.unlink(file.path).catch(() => {});
      }
      const error = new Error(`Fuente con ID ${sourceId} no encontrada.`);
      error.statusCode = 404;
      throw error;
    }

    if (source.type !== 'AUDIO') {
      if (file?.path && fs.existsSync(file.path)) {
        await fs.promises.unlink(file.path).catch(() => {});
      }
      const error = new Error('Solo se puede reintentar la transcripción en fuentes de tipo AUDIO.');
      error.statusCode = 400;
      throw error;
    }

    if (!file) {
      const error = new Error('Debe adjuntar el archivo de audio para reintentar la transcripción.');
      error.statusCode = 400;
      throw error;
    }

    return this.createAudioSource(source.projectId, file);
  }
}

module.exports = new SourceService();