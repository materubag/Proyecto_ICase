// Offline provider responses for the legacy pipeline fixtures; not production extraction.
const rules = require('../../src/services/document/RuleBasedExtractor');
module.exports = {
  async extractDocumentBatch({ segments }) {
    const requirements = [];
    for (const segment of segments) {
      const coded = [...rules.extractFunctionalRequirements(segment.text), ...rules.extractNonFunctionalRequirements(segment.text)];
      for (const r of coded) requirements.push({ segmentIds: [segment.id], statement: r.text,
        type: r.type, code: r.originalCode, quote: r.sourceText, explicit: true, associations: [], pending: [] });
      // These two statements are manually reviewed fixtures from fase3.test.js.
      if (segment.text.includes('queremos que los bibliotecarios')) requirements.push({ segmentIds: [segment.id],
        statement: 'Registrar préstamos desde el sistema', type: 'FUNCTIONAL', quote: segment.text.trim(), explicit: true, associations: [], pending: ['Rol pendiente de revisión'] });
      if (segment.text.includes('Necesitamos recuperar la contraseña')) requirements.push({ segmentIds: [segment.id],
        statement: segment.text.trim(), type: 'FUNCTIONAL', quote: segment.text.trim(), explicit: true, associations: [], pending: [] });
    }
    return { data: { coveredSegmentIds: segments.map(s => s.id), requirements, actors: [], other: [] } };
  }
};
