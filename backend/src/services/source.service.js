const fs = require('fs');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const documentAnalyzer = require('./document/DocumentAnalyzer');
const n8nTranscriptionService = require('./n8n/transcription.service');
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
   * Procesa la subida de documentos PDF.
   */
  async createPdfSources(projectId, files) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) {
      const error = new Error(`Proyecto con ID ${projectId} no encontrado.`);
      error.statusCode = 404;
      throw error;
    }

    const results = [];
    for (const file of files) {
      const name = sanitizeFilename(file.originalname);
      const fileHash = sha256FromBuffer(file.buffer);

      const existingVersion = await prisma.sourceVersion.findFirst({
        where: { fileHash, source: { projectId } },
        select: { sourceId: true }
      });

      if (existingVersion) {
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

      const extraction = await documentAnalyzer.extractDocument(file.buffer, name);

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
    return results;
  }

  /**
   * Procesa la subida de un archivo de audio como Source.
   * Flujo: Upload -> Temp File -> Hash -> Source/SourceVersion -> n8n -> AudioSegment -> Unlink Temp.
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

    // Calcular hash SHA-256 (desde archivo en disco o buffer de memoria)
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
      // Eliminar temporal si existe
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

    // 2. Verificar si existe una fuente previa con el mismo nombre (versionado v2, v3...)
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

    // 4. Contactar n8n para transcripción
    let transcription;
    try {
      transcription = await n8nTranscriptionService.transcribeAudio({
        filePath,
        filename: name,
        mimeType,
        projectId
      });
    } catch (transcriptionErr) {
      console.error(`[SourceService] Error en transcripción n8n para fuente ${sourceRecord.id}:`, transcriptionErr.message);

      // Si falla la transcripción, actualizar estado a TRANSCRIPTION_ERROR
      // NO eliminar la Source ni sus SourceVersions anteriores
      await prisma.source.update({
        where: { id: sourceRecord.id },
        data: { status: 'TRANSCRIPTION_ERROR' }
      });

      // Si es una fuente nueva sin versiones previas, crear una SourceVersion con error registrado
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

      // Asegurar limpieza de temporal antes de relanzar
      if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath).catch(() => {});
      }

      const err = new Error(`Error en transcripción de audio: ${transcriptionErr.message}`);
      err.statusCode = transcriptionErr.statusCode || 502;
      err.sourceId = sourceRecord.id;
      throw err;
    } finally {
      // 5. Eliminar archivo temporal de audio una vez finalizada la comunicación
      if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath).catch((err) => {
          console.warn(`[SourceService] No se pudo eliminar archivo temporal ${filePath}:`, err.message);
        });
      }
    }

    // 6. Transcripción exitosa: Guardar texto completo y segmentos en transacción
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
            provider: 'n8n',
            duration: transcription.duration,
            segmentsCount: transcription.segments.length,
            transcribedAt: new Date().toISOString()
          },
          previousVersionId: sameName?.currentVersionId || null
        }
      });

      if (transcription.segments && transcription.segments.length > 0) {
        await tx.audioSegment.createMany({
          data: transcription.segments.map((segment) => ({
            sourceVersionId: newSourceVersion.id,
            sequence: segment.sequence,
            startTime: segment.startTime,
            endTime: segment.endTime,
            text: segment.text,
            speaker: segment.speaker,
            confidence: segment.confidence
          }))
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

  /**
   * Reintenta la transcripción para una fuente que falló (status: TRANSCRIPTION_ERROR).
   * Requiere el archivo de audio para reejecutar el proceso.
   */
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

    // Reutilizar el flujo normal de createAudioSource para el mismo proyecto y archivo
    return this.createAudioSource(source.projectId, file);
  }
}

module.exports = new SourceService();