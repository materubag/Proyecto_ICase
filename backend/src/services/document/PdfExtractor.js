const pdfParseModule = require('pdf-parse');

class PdfExtractor {
  /**
   * Extrae texto plano, conteo de páginas y metadatos desde un Buffer de PDF.
   * @param {Buffer} buffer - Buffer con el contenido binario del PDF.
   * @param {string} [fileName='documento.pdf'] - Nombre del archivo.
   * @returns {Promise<Object>} Resultado con texto extraído, páginas y banderas de contenido.
   */
  async extractFromBuffer(buffer, fileName = 'documento.pdf') {
    if (!buffer || buffer.length === 0) {
      const err = new Error('El archivo PDF está vacío o no es válido.');
      err.statusCode = 400;
      throw err;
    }

    let extractedData;
    try {
      if (pdfParseModule.PDFParse) {
        const parser = new pdfParseModule.PDFParse({ data: buffer });
        extractedData = await parser.getText();
      } else if (typeof pdfParseModule === 'function') {
        extractedData = await pdfParseModule(buffer);
      } else if (typeof pdfParseModule.default === 'function') {
        extractedData = await pdfParseModule.default(buffer);
      } else {
        throw new Error('No se encontró un exportador ejecutable para pdf-parse.');
      }
    } catch (err) {
      console.error(`[PdfExtractor] Error al parsear PDF ${fileName}:`, err);
      const parseError = new Error(`Error al procesar el archivo PDF: ${err.message}`);
      parseError.statusCode = 400;
      throw parseError;
    }

    const pages = extractedData.pages || [];
    const pageCount = extractedData.total || pages.length || extractedData.numpages || 1;
    let fullText = extractedData.text || '';

    // Si pages tiene textos individuales, analizar páginas vacías
    const pagesWithoutText = [];
    const pageBreakMarker = '\n--- [SALTO_PAGINA] ---\n';

    if (pages.length > 0) {
      const combinedPages = [];
      pages.forEach((p, idx) => {
        const pageNum = p.num || idx + 1;
        const pageText = (p.text || '').trim();
        if (pageText.length === 0) {
          pagesWithoutText.push(pageNum);
        }
        combinedPages.push(`[PÁGINA ${pageNum}]\n${p.text || ''}`);
      });
      fullText = combinedPages.join(pageBreakMarker);
    }

    const trimmedText = fullText.replace(/\[PÁGINA \d+\]/g, '').replace(/--- \[SALTO_PAGINA\] ---/g, '').trim();

    // Comprobación de documento escaneado sin texto (sin OCR)
    if (!trimmedText || trimmedText.length === 0) {
      const emptyError = new Error('El documento no contiene texto extraíble. OCR será una funcionalidad futura.');
      emptyError.statusCode = 422;
      emptyError.isScanned = true;
      throw emptyError;
    }

    return {
      fileName,
      pageCount,
      textLength: trimmedText.length,
      extractedText: fullText,
      rawText: trimmedText,
      pagesWithoutText,
      isScanned: false
    };
  }
}

module.exports = new PdfExtractor();
