const pdfExtractor = require('../document/PdfExtractor');
const extraction = require('./documentExtraction');
class AnalysisOrchestrator {
  async process(input, fileName = 'documento.pdf', options = {}) {
    const data = Buffer.isBuffer(input) ? await pdfExtractor.extractFromBuffer(input, fileName) : input;
    const text = typeof data === 'string' ? data : data.extractedText || data.rawText || data.text || '';
    return extraction.extract(text, { ...options, fileName, segments: data.segments || [] });
  }
}
module.exports = new AnalysisOrchestrator();
