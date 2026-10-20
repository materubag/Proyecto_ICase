// Hand-reviewed responses for flow tests. No model/API or AUTRON count in production logic.
module.exports = function fixtureProvider() {
  const calls = [];
  return { calls, async extractDocumentBatch(input) {
    calls.push(input);
    const actors = [], requirements = [], links = [], other = [];
    for (const s of input.segments) {
      for (const [name,quote,codes] of [
        ['Cliente','Cliente: gestiona citas, revisa cotizaciones y consulta el avance.',['RF-06','RF-20']],
        ['Recepción','Recepción: registra ingresos, coordina la agenda y mantiene datos operativos.',['RF-06','RF-07']],
        ['Mecánico','Mecánico: documenta diagnósticos, actividades, pruebas y repuestos utilizados.',['RF-08','RF-19']],
        ['Administrador','Administrador: configura usuarios, permisos, catálogos, inventario e indicadores.',['RF-02','RF-21']]
      ]) if (s.text.includes(quote)) {
        actors.push({ key: name, name, kind: 'HUMAN', explicit: true, segmentIds: [s.id], quote });
        for (const req of input.knownRequirements.filter(r => codes.includes(r.code))) links.push({
          requirementId: req.id, actorKey: name, role: 'EXECUTOR', segmentIds: [s.id], quote });
      }
      const emit = (quote, statement, extra = {}) => requirements.push({ segmentIds: [s.id], quote,
        statement, type: 'FUNCTIONAL', explicit: true, associations: [], pending: [], ...extra });
      if (s.mode === 'UNRESOLVED' && s.text.includes('Notificaciones internas.')) emit('Notificaciones internas.', 'Emitir notificaciones internas.');
      if (s.mode === 'UNRESOLVED' && s.text.includes('Dashboard y reportes básicos.')) {
        const targets = input.knownRequirements.filter(r => ['RF-32','RF-33'].includes(r.code));
        if (targets.length) emit('Dashboard y reportes básicos.', 'Dashboard y reportes básicos.', {
          matches: targets.map(r => r.id), relationship: 'REPEAT' });
      }
      if (s.text.includes('La operadora registra pedidos.')) {
        actors.push({ key: 'operator', name: 'Operadora', kind: 'HUMAN', explicit: true,
          segmentIds: [s.id], quote: 'La operadora registra pedidos.' });
        const known = input.knownRequirements.find(r => r.statement === 'Registrar pedidos.');
        if (known) links.push({ requirementId: known.id, actorKey: 'operator', role: 'EXECUTOR',
          segmentIds: [s.id], quote: 'La operadora registra pedidos.' });
        else emit('La operadora registra pedidos.', 'Registrar pedidos.', { associations: [{
          actorKey: 'operator', role: 'EXECUTOR', segmentIds: [s.id], quote: 'La operadora registra pedidos.' }] });
      }
      if (s.mode === 'UNRESOLVED' && s.text.includes('Se necesita exportar informes.')) emit('Se necesita exportar informes.', 'Exportar informes.');
      if (s.mode === 'UNRESOLVED' && s.text.includes('Posiblemente convenga archivar pedidos.')) emit(
        'Posiblemente convenga archivar pedidos.', 'Archivar pedidos.', { explicit: false, pending: ['Confirmar necesidad inferida'] });
      // Simulate an AI copy despite the prompt: exact identity still prevents insertion.
      for (const known of input.knownRequirements.filter(r => r.segmentIds.includes(s.id))) {
        requirements.push({ statement: known.statement, type: known.type, code: known.code,
          segmentIds: [s.id], quote: s.text.trim(), explicit: true, associations: [], pending: [] });
      }
    }
    return { data: { coveredSegmentIds: input.segments.map(s => s.id), actors, requirements, links, other } };
  } };
};
