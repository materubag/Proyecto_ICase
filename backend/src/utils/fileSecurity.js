const path = require('path');

const ALLOWED_AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.m4a',
  '.mp4',
  '.webm',
  '.ogg',
  '.aac',
  '.flac'
]);

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'video/mp4',
  'audio/webm',
  'video/webm',
  'audio/ogg',
  'application/ogg',
  'audio/aac',
  'audio/x-aac',
  'audio/flac',
  'audio/x-flac'
]);

/**
 * Sanitiza el nombre de un archivo para prevenir ataques de Directory Traversal
 * o caracteres de control, preservando caracteres acentuados y legibilidad.
 * @param {string} originalName
 * @returns {string}
 */
function sanitizeFilename(originalName) {
  if (!originalName || typeof originalName !== 'string') {
    return 'audio_source.mp3';
  }

  // Decodificar si viene con codificación latin1
  let decoded = originalName;
  try {
    const latinDecoded = Buffer.from(originalName, 'latin1').toString('utf8');
    if (!latinDecoded.includes('\uFFFD')) {
      decoded = latinDecoded;
    }
  } catch (err) {
    decoded = originalName;
  }

  decoded = decoded.normalize('NFC');

  // Extraer nombre base eliminando cualquier ruta relativa o absoluta
  const basename = path.basename(decoded).replace(/[\0\r\n\t]/g, '');

  // Reemplazar caracteres inseguros para sistemas de archivos
  const sanitized = basename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\.{2,}/g, '.') // prevenir ..
    .trim();

  return sanitized || 'audio_source.mp3';
}

/**
 * Valida si un archivo cumple con los requisitos de extensión y MIME type permitidos.
 * @param {string} filename
 * @param {string} mimeType
 * @returns {{ valid: boolean, error?: string }}
 */
function validateAudioFile(filename, mimeType) {
  if (!filename) {
    return { valid: false, error: 'Nombre de archivo requerido.' };
  }

  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_AUDIO_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Formato de archivo no soportado (${ext || 'sin extensión'}). Formatos válidos: ${Array.from(ALLOWED_AUDIO_EXTENSIONS).join(', ')}`
    };
  }

  if (mimeType) {
    const normalizedMime = mimeType.toLowerCase().trim();
    // Aceptamos cualquier audio/* o MIME explícito en la lista blanca
    const isAllowedMime = normalizedMime.startsWith('audio/') || ALLOWED_AUDIO_MIME_TYPES.has(normalizedMime);
    if (!isAllowedMime) {
      return {
        valid: false,
        error: `Tipo MIME no permitido (${mimeType}). Debe ser un archivo de audio válido.`
      };
    }
  }

  return { valid: true };
}

module.exports = {
  ALLOWED_AUDIO_EXTENSIONS,
  ALLOWED_AUDIO_MIME_TYPES,
  sanitizeFilename,
  validateAudioFile
};
