/**
 * CandidateFragmentSelector
 * Filtra y selecciona únicamente los fragmentos que contienen señales de requisitos o necesidades,
 * descartando texto irrelevante (saludos, relleno, preámbulos genéricos).
 * Aplica chunking semántico por oraciones o párrafos evitando cortar frases por la mitad.
 */

const env = require('../../config/env');

const REQUIREMENT_SIGNALS = [
  // Obligación / Capacidad
  /\b(?:debe|deber[aá]|deber[ií]a|deben|deber[aá]n|deber[ií]an)\b/i,
  /\b(?:necesita|necesitamos|necesitar[aá]|requiere|requerimos|requerir[aá])\b/i,
  /\b(?:queremos|se\s+desea|deseamos|esperamos|se\s+espera)\b/i,
  /\b(?:permitir[aá]|permitir[aá]n|permite|permitir)\b/i,
  /\b(?:podr[aá]|podr[aá]n|puede|pueden|no\s+podr[aá]|no\s+puede)\b/i,
  /\b(?:capaz\s+de|posibilidad\s+de|funci[oó]n|funcionalidad)\b/i,

  // Restricciones / Reglas
  /\b(?:solo|s[oó]lo|[uú]nicamente|exclusivamente|solamente)\b/i,
  /\b(?:m[aá]ximo|m[ií]nimo|l[ií]mite|al\s+menos|como\s+m[aá]ximo)\b/i,
  /\b(?:siempre|nunca|jam[aá]s|en\s+ning[uú]n\s+caso|prohibido)\b/i,
  /\b(?:obligatorio|obligatoria|mandatorio|mandatoria|indispensable)\b/i,

  // Roles y Entorno
  /\b(?:usuario|administrador|cliente|empleado|operador|sistema)\b/i,
  /\b(?:seguridad|tiempo|disponibilidad|rendimiento|latencia|concurrencia)\b/i,
  /\b(?:interfaz|m[oó]vil|web|pantalla|notificaci[oó]n|alerta)\b/i,
  /\b(?:reporte|informe|exportar|importar|consultar|registrar|modificar|eliminar)\b/i
];

class CandidateFragmentSelector {
  /**
   * Evalúa si un fragmento de texto tiene señales suficientes para ser analizado por IA.
   * @param {string} text
   * @returns {{ hasSignals: boolean, matchedSignals: number }}
   */
  hasRequirementSignals(text) {
    if (!text || typeof text !== 'string') return { hasSignals: false, matchedSignals: 0 };
    const trimmed = text.trim();
    if (trimmed.length < 15) return { hasSignals: false, matchedSignals: 0 };

    let count = 0;
    for (const pattern of REQUIREMENT_SIGNALS) {
      if (pattern.test(trimmed)) {
        count++;
      }
    }

    return {
      hasSignals: count > 0,
      matchedSignals: count
    };
  }

  /**
   * Divide un texto en oraciones respetando puntos, signos de exclamación/interrogación
   * sin cortar abreviaturas comunes (ej. "ej.", "p.ej.", "RF-01.").
   * @param {string} text
   * @returns {string[]}
   */
  splitIntoSentences(text) {
    if (!text) return [];
    // Dividir por saltos de línea o puntos seguidos de espacio y mayúscula
    return text
      .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9])|\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);
  }

  /**
   * Filtra y agrupa fragmentos no estructurados en chunks pequeños orientados a IA.
   * @param {Array<{ text: string, type: string, lineIndex?: number, metadata?: any }>} blocks
   * @param {Object} [options]
   * @param {number} [options.maxChunkLength=350] - Máxima longitud en caracteres por chunk
   * @param {number} [options.maxChunks=10] - Máximo de chunks a enviar a IA
   * @returns {Array<{ chunkText: string, signals: number, originalIndex: number, metadata: any }>}
   */
  selectCandidateFragments(blocks = [], options = {}) {
    const maxChunkLength = options.maxChunkLength || env.AI_CHUNK_MAX_LENGTH || 350;
    const maxChunks = options.maxChunks || env.AI_MAX_CHUNKS || 12;

    const candidateChunks = [];

    for (const block of blocks) {
      const sentences = this.splitIntoSentences(block.text);

      let currentChunk = '';
      let currentSignals = 0;

      for (const sentence of sentences) {
        const signalCheck = this.hasRequirementSignals(sentence);
        if (!signalCheck.hasSignals && !currentChunk) {
          // Si la oración no tiene señales y no estamos acumulando, descartarla
          continue;
        }

        // Si agregar la oración excede el tamaño máximo, guardar el chunk actual
        if (currentChunk && (currentChunk.length + sentence.length + 1 > maxChunkLength)) {
          if (currentSignals > 0) {
            candidateChunks.push({
              chunkText: currentChunk.trim(),
              signals: currentSignals,
              originalIndex: block.lineIndex || 0,
              metadata: block.metadata || {}
            });
            if (candidateChunks.length >= maxChunks) break;
          }
          currentChunk = '';
          currentSignals = 0;
        }

        currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
        currentSignals += signalCheck.matchedSignals;
      }

      if (currentChunk && currentSignals > 0 && candidateChunks.length < maxChunks) {
        candidateChunks.push({
          chunkText: currentChunk.trim(),
          signals: currentSignals,
          originalIndex: block.lineIndex || 0,
          metadata: block.metadata || {}
        });
      }

      if (candidateChunks.length >= maxChunks) break;
    }

    return candidateChunks;
  }
}

module.exports = new CandidateFragmentSelector();
