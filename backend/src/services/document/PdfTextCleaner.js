/**
 * PdfTextCleaner
 * Módulo determinístico para la normalización, reparación UTF-8 y limpieza de texto
 * extraído de documentos PDF.
 * Preserva estrictamente tildes, eñes y caracteres del español.
 */
class PdfTextCleaner {
  /**
   * Limpia y normaliza el texto extraído en UTF-8 canónico (NFC).
   * @param {string} rawText
   * @returns {string} Texto limpio, corregido y estructurado en párrafos
   */
  clean(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return '';
    }

    // 1. Normalizar Unicode a forma compuesta canónica (NFC)
    let text = rawText.normalize('NFC');

    // 2. Corregir Mojibake común (UTF-8 interpretado accidentalmente como Latin-1/Windows-1252)
    const mojibakeReplacements = [
      [/Ã¡/g, 'á'], [/Ã©/g, 'é'], [/Ã­/g, 'í'], [/Ã³/g, 'ó'], [/Ãº/g, 'ú'],
      [/Ã/g, 'Á'], [/Ã/g, 'É'], [/Ã/g, 'Í'], [/Ã/g, 'Ó'], [/Ã/g, 'Ú'],
      [/Ã±/g, 'ñ'], [/Ã/g, 'Ñ'],
      [/Ã¼/g, 'ü'], [/Ã/g, 'Ü'],
      [/â¢/g, '•'], [/â/g, '–'], [/â/g, '—'],
      [/â/g, '“'], [/â/g, '”'], [/â/g, '‘'], [/â/g, '’']
    ];

    for (const [regex, replacement] of mojibakeReplacements) {
      text = text.replace(regex, replacement);
    }

    // 3. Corregir caracteres de reemplazo (\uFFFD) en palabras comunes con tildes (ej: Administracin -> Administración)
    text = text.replace(/([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)\uFFFD([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)/g, (match, p1, p2) => {
      if (/ci$/i.test(p1) && /^n/i.test(p2)) return `${p1}ó${p2}`;
      if (/gesti$/i.test(p1) && /^n/i.test(p2)) return `${p1}ó${p2}`;
      if (/acci$/i.test(p1) && /^n/i.test(p2)) return `${p1}ó${p2}`;
      if (/operaci$/i.test(p1) && /^n/i.test(p2)) return `${p1}ó${p2}`;
      return match;
    });

    // 4. Eliminar caracteres de control no imprimibles (mantener \t, \n y caracteres Unicode)
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

    // 5. Normalizar retornos de carro
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 6. Remover marcas internas de páginas generadas por el extractor si están presentes
    text = text.replace(/--- \[SALTO_PAGINA\] ---/g, '\n');
    text = text.replace(/\[PÁGINA \d+\]/g, '');

    // 7. Corregir palabras divididas por guiones al final de línea (ej: cono- \ncimiento -> conocimiento)
    text = text.replace(/([a-záéíóúüñA-ZÁÉÍÓÚÜÑ])-[\t ]*\n[\t ]*([a-záéíóúüñA-ZÁÉÍÓÚÜÑ])/g, '$1$2');

    // 8. Eliminar encabezados y pies de página recurrentes
    text = text.replace(/^[ \t]*(?:NEXORA|AUTRON|SISTEMA WEB|PROPUESTA)[ \t·\-_–]+(?:SOLUCIONES DE SOFTWARE[ \t·\-_–]+)?(?:AUTRON)?[ \t·\-_–]*\d+[ \t]*$/gmi, '');
    text = text.replace(/^[ \t]*NEXORA[ \t]+AUTRON[ \t]*$/gmi, '');

    // 9. Eliminar números de página aislados en líneas individuales
    text = text.replace(/^[ \t]*(?:Página|Pág\.?|Page)?[ \t]*\d+[ \t]*$/gmi, '');

    // 10. Normalizar espacios horizontales continuos (preservando saltos de línea)
    const lines = text.split('\n');
    const cleanedLines = [];

    for (let line of lines) {
      const normalizedLine = line.replace(/[ \t]+/g, ' ').trim();
      if (normalizedLine.length > 0) {
        cleanedLines.push(normalizedLine);
      } else {
        if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== '') {
          cleanedLines.push('');
        }
      }
    }

    let result = cleanedLines.join('\n');

    // 11. Consolidar saltos de línea excesivos (máximo dos saltos de línea seguidos)
    result = result.replace(/\n{3,}/g, '\n\n');

    return result.trim().normalize('NFC');
  }
}

module.exports = new PdfTextCleaner();
