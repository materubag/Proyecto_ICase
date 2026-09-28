const fs = require('fs');
const env = require('../../config/env');

class N8nTranscriptionService {
  /**
   * Obtiene la URL efectiva del webhook de transcripción de n8n.
   * Resuelve URLs relativas contra N8N_BASE_URL si aplica.
   * @returns {string}
   */
  getWebhookUrl() {
    const webhook = env.N8N_TRANSCRIBE_WEBHOOK || env.N8N_TRANSCRIPTION_WEBHOOK || '';
    if (!webhook) return '';

    if (webhook.startsWith('http://') || webhook.startsWith('https://')) {
      return webhook;
    }

    const baseUrl = (env.N8N_BASE_URL || '').replace(/\/+$/, '');
    const cleanPath = webhook.startsWith('/') ? webhook : `/${webhook}`;
    return baseUrl ? `${baseUrl}${cleanPath}` : cleanPath;
  }

  /**
   * Envía un archivo de audio temporal a n8n para su transcripción.
   * @param {Object} params
   * @param {string} params.filePath - Ruta absoluta del archivo temporal en disco.
   * @param {string} params.filename - Nombre sanitizado del archivo original.
   * @param {string} params.mimeType - Tipo MIME del audio.
   * @param {string} params.projectId - ID del proyecto.
   * @returns {Promise<{ text: string, duration: number|null, segments: Array }>}
   */
  async transcribeAudio({ filePath, filename, mimeType, projectId }) {
    const webhookUrl = this.getWebhookUrl();
    if (!webhookUrl) {
      const error = new Error(
        'El webhook de transcripción n8n no está configurado (N8N_TRANSCRIBE_WEBHOOK o N8N_TRANSCRIPTION_WEBHOOK).'
      );
      error.statusCode = 503;
      throw error;
    }

    if (!fs.existsSync(filePath)) {
      const error = new Error(`El archivo de audio temporal no existe en disco: ${filePath}`);
      error.statusCode = 400;
      throw error;
    }

    const fileBuffer = await fs.promises.readFile(filePath);
    const audioBlob = new Blob([fileBuffer], { type: mimeType || 'audio/mpeg' });

    const form = new FormData();
    // Proveer claves comunes para nodos n8n (Webhook / Whisper / Read Binary File)
    form.append('audio', audioBlob, filename);
    form.append('file', audioBlob, filename);
    form.append('projectId', projectId);
    form.append('fileName', filename);
    form.append('mimeType', mimeType || 'audio/mpeg');

    const timeoutMs = env.N8N_TIMEOUT || 120000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    console.log(`[n8n-transcription] Enviando audio a n8n (${webhookUrl}) para proyecto ${projectId}...`);

    let response;
    try {
      response = await fetch(webhookUrl, {
        method: 'POST',
        body: form,
        signal: controller.signal
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        const timeoutError = new Error(
          `Tiempo de espera agotado (${Math.round(timeoutMs / 1000)}s) al transcribir el audio en n8n.`
        );
        timeoutError.statusCode = 504;
        throw timeoutError;
      }
      const connError = new Error(`Error de conexión con el servicio n8n: ${err.message}`);
      connError.statusCode = 502;
      throw connError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (ignored) {}
      const httpError = new Error(
        `El webhook de n8n respondió con error HTTP ${response.status}: ${errorBody.slice(0, 300) || response.statusText}`
      );
      httpError.statusCode = 502;
      throw httpError;
    }

    let payload;
    try {
      payload = await response.json();
    } catch (parseErr) {
      const rawText = await response.text().catch(() => '');
      if (rawText && rawText.trim().length > 0) {
        // Respuesta en texto plano directo
        return {
          text: rawText.trim(),
          duration: null,
          segments: [],
          raw: rawText
        };
      }
      throw new Error(`La respuesta de n8n no es un JSON válido: ${parseErr.message}`);
    }

    return this.normalizeTranscription(payload);
  }

  /**
   * Normaliza payloads variados de Whisper, OpenAI, Google Speech o n8n
   * a la estructura estándar { text, duration, segments }.
   * @param {any} payload
   * @returns {{ text: string, duration: number|null, segments: Array, raw: any }}
   */
  normalizeTranscription(payload) {
    // Si viene en array de n8n [{ ... }]
    const item = Array.isArray(payload) ? payload[0] : payload;
    const data = item?.data || item?.result || item || {};

    // 1. Extraer texto global
    let fullText =
      data.text ||
      data.transcription ||
      data.transcript ||
      data.output ||
      item?.text ||
      item?.transcription ||
      item?.transcript ||
      item?.output ||
      '';

    if (typeof fullText !== 'string') {
      fullText = String(fullText || '');
    }
    fullText = fullText.trim();

    // 2. Extraer segmentos / timestamps
    const rawSegments =
      data.segments ||
      data.words ||
      data.utterances ||
      item?.segments ||
      item?.words ||
      item?.utterances ||
      [];

    const segments = [];
    if (Array.isArray(rawSegments) && rawSegments.length > 0) {
      rawSegments.forEach((seg, index) => {
        const text = String(seg.text || seg.transcription || seg.word || '').trim();
        if (!text) return;

        let start = Number(seg.startTime ?? seg.start ?? seg.start_time ?? 0);
        let end = Number(seg.endTime ?? seg.end ?? seg.end_time ?? 0);

        // Si los timestamps viniesen en milisegundos y son excesivamente altos
        if (start > 10000 && end > start && !seg.inSeconds) {
          // Si claramente son ms (ej. 15000ms = 15s)
          if (start > 1000 && end < 86400000) {
            start = Number((start / 1000).toFixed(2));
            end = Number((end / 1000).toFixed(2));
          }
        }

        const speaker = seg.speaker || seg.speaker_id || seg.author || seg.role ? String(seg.speaker || seg.speaker_id || seg.author || seg.role).trim() : null;
        const confidence = typeof seg.confidence === 'number'
          ? seg.confidence
          : typeof seg.avg_logprob === 'number'
          ? Math.min(1, Math.max(0, Math.exp(seg.avg_logprob)))
          : null;

        segments.push({
          sequence: index + 1,
          startTime: Math.max(0, start),
          endTime: Math.max(start, end),
          text,
          speaker,
          confidence: confidence !== null ? Number(confidence.toFixed(3)) : null
        });
      });
    }

    // Si fullText estaba vacío pero tenemos segmentos, reconstruirlo
    if (!fullText && segments.length > 0) {
      fullText = segments.map((s) => s.text).join(' ');
    }

    const duration =
      typeof data.duration === 'number'
        ? data.duration
        : segments.length > 0
        ? segments[segments.length - 1].endTime
        : null;

    return {
      text: fullText,
      duration: duration !== null ? Number(duration.toFixed(2)) : null,
      segments,
      raw: payload
    };
  }
}

module.exports = new N8nTranscriptionService();
