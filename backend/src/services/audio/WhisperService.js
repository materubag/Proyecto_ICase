const fs = require('fs');
const env = require('../../config/env');

class WhisperService {
  constructor() {
    this.baseUrl = (env.WHISPER_BASE_URL || 'http://whisper:8001').replace(/\/+$/, '');
    this.timeout = parseInt(process.env.WHISPER_TIMEOUT || '180000', 10);
  }

  /**
   * Consulta el estado de salud del servicio local faster-whisper.
   */
  async health() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) return { status: 'error', code: response.status };
      return await response.json();
    } catch (err) {
      return { status: 'unavailable', error: err.message };
    }
  }

  /**
   * Envía un archivo de audio al microservicio local de faster-whisper.
   * @param {Object} params
   * @param {string} params.filePath - Ruta en disco del archivo temporal
   * @param {string} params.filename - Nombre original del archivo
   * @param {string} [params.mimeType] - Tipo MIME
   * @returns {Promise<{ success: boolean, text: string, language: string, duration: number|null }>}
   */
  async transcribeAudio({ filePath, filename = 'audio.mp3', mimeType = 'audio/mpeg' }) {
    if (!fs.existsSync(filePath)) {
      const error = new Error(`El archivo de audio temporal no existe en disco: ${filePath}`);
      error.statusCode = 400;
      throw error;
    }

    const fileStat = await fs.promises.stat(filePath);
    const audioSizeMB = (fileStat.size / (1024 * 1024)).toFixed(2);
    const startTime = Date.now();

    const fileBuffer = await fs.promises.readFile(filePath);
    const audioBlob = new Blob([fileBuffer], { type: mimeType });

    const formData = new FormData();
    formData.append('file', audioBlob, filename);

    console.log(`[WhisperService] Enviando audio (${audioSizeMB} MB) a ${this.baseUrl}/transcribe...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    let response;
    try {
      response = await fetch(`${this.baseUrl}/transcribe`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const timeoutError = new Error(`Tiempo de espera agotado (${Math.round(this.timeout / 1000)}s) en el servicio local de transcripción Whisper.`);
        timeoutError.statusCode = 504;
        throw timeoutError;
      }
      const connError = new Error(`No se pudo conectar al servicio local de Whisper en ${this.baseUrl}: ${err.message}. Verifique que el contenedor 'whisper' esté en ejecución.`);
      connError.statusCode = 503;
      throw connError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      let errText = '';
      try {
        const errJson = await response.json();
        errText = errJson.detail || JSON.stringify(errJson);
      } catch {
        errText = await response.text();
      }
      const httpError = new Error(`El servicio de Whisper respondió con error HTTP ${response.status}: ${errText}`);
      httpError.statusCode = response.status === 413 ? 413 : 502;
      throw httpError;
    }

    const result = await response.json();
    const transcriptionSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`[WHISPER] model=${env.WHISPER_MODEL || 'base'} device=${env.WHISPER_DEVICE || 'cpu'} computeType=${env.WHISPER_COMPUTE_TYPE || 'int8'} audioSizeMB=${audioSizeMB} transcriptionSeconds=${transcriptionSeconds}`);

    return {
      success: true,
      text: (result.text || '').trim(),
      language: result.language || 'es',
      duration: result.duration || null
    };
  }

  /**
   * Helper para transcribir un archivo pasando su ruta y opciones
   */
  async transcribeFile(filePath, options = {}) {
    return this.transcribeAudio({
      filePath,
      filename: options.originalName || options.filename || 'audio.mp3',
      mimeType: options.mimeType || 'audio/mpeg'
    });
  }
}

module.exports = new WhisperService();
