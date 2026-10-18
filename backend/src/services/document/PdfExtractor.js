const pdfParseModule = require('pdf-parse');
const PDF_EXTRACTION_VERSION='pdf-layout-v2';

class PdfExtractor {
  /**
   * Extrae texto plano, conteo de páginas y metadatos desde un Buffer de PDF.
   * @param {Buffer} buffer - Buffer con el contenido binario del PDF.
   * @param {string} [fileName='documento.pdf'] - Nombre del archivo.
   * @returns {Promise<Object>} Resultado con texto extraído, páginas y banderas de contenido.
   */
  async extractFromBuffer(buffer, fileName = 'documento.pdf') {
    require('../../utils/pdfFilePolicy').validate({originalname:fileName});
    require('../../utils/pdfFilePolicy').validateBuffer(buffer);
    if (!buffer || buffer.length === 0) {
      const err = new Error('El archivo PDF está vacío o no es válido.');
      err.statusCode = 400;
      throw err;
    }

    let extractedData;
    try {
      if (pdfParseModule.PDFParse) {
        // Adapter tested against the locked pdf-parse version; retain its parser lifecycle.
        class LayoutParser extends pdfParseModule.PDFParse {
          async getPageText(page,params,total){
            const raw=await super.getPageText(page,params,total);
            (this.rawPages ||= []).push(raw);
            const content=await page.getTextContent({disableNormalization:true});
            return require('./pdfLayout').reconstruct(content.items);
          }
        }
        const parser = new LayoutParser({ data: buffer });
        try {
          extractedData = await parser.getText({ cellSeparator: '\t', lineEnforce: true, pageJoiner: '' });
          extractedData.rawLayoutText=(parser.rawPages||[]).join('\n');
        } finally {
          await parser.destroy();
        }
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
        // Independent coded cells are separate columns, not metadata for one row.
        const readingText=(p.text||'').split('\n').map(line=>{
          const cells=line.split('\t').map(s=>s.trim()).filter(Boolean);
          return cells.length>1&&cells.every(c=>/^(?:RF|RNF)[ _-]*\d+\s+\S.+/i.test(c))?cells.join('\n'):line;
        }).join('\n');
        combinedPages.push(`[PÁGINA ${pageNum}]\n${readingText}`);
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
      extractionVersion:PDF_EXTRACTION_VERSION,
      fileName,
      pageCount,
      textLength: trimmedText.length,
      extractedText: fullText,
      rawLayoutText: extractedData.rawLayoutText || extractedData.text || pages.map(p=>p.text||'').join(pageBreakMarker),
      rawText: trimmedText,
      pagesWithoutText,
      isScanned: false
    };
  }
}

module.exports = new PdfExtractor();
module.exports.PDF_EXTRACTION_VERSION=PDF_EXTRACTION_VERSION;
