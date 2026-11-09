// Match PDF line wrapping/NBSP without inventing text; map back to exact source spans.
function normalizedWithOffsets(text) {
  let value = '', positions = [], inWhitespace = false;
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) {
      if (!inWhitespace) { value += ' '; positions.push(i); }
      inWhitespace = true;
    } else { value += text[i]; positions.push(i); inWhitespace = false; }
  }
  return { value, positions };
}
function locate(item, allSegments) {
  if (!Array.isArray(item.segmentIds) || !item.segmentIds.length || typeof item.quote !== 'string' || !item.quote.trim()) throw new Error('Evidencia ausente');
  const parts = item.segmentIds.map(id => {
    const s = allSegments.find(s => s.id === id);
    if (!s) throw new Error('Referencia de segmento inválida');
    return s;
  }).sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  const needle = item.quote.replace(/\s+/g, ' ').trim();
  const groups = [];
  for (const part of parts) {
    const last = groups.at(-1);
    if (last && last.at(-1).end === part.start && part.start != null &&
        last.at(-1).documentHash === part.documentHash && last.at(-1).sourceVersionId === part.sourceVersionId) last.push(part);
    else groups.push([part]);
  }
  for (const group of groups) {
    const joined = group.map(s => s.text).join('');
    const { value, positions } = normalizedWithOffsets(joined);
    const index = value.indexOf(needle);
    if (index < 0) continue;
    const from = positions[index], to = positions[index + needle.length - 1] + 1;
    let offset = 0;
    const matched = group.flatMap(s => {
      const begin = Math.max(0, from - offset), end = Math.min(s.text.length, to - offset);
      offset += s.text.length;
      return end > begin ? [{ ...s, quote: s.text.substring(begin, end),
        quoteStart: s.start == null ? null : s.start + begin,
        quoteEnd: s.start == null ? null : s.start + end }] : [];
    });
    if (matched.length !== parts.length) throw new Error('Referencia de segmento sin evidencia correspondiente');
    return matched;
  }
  throw new Error('Evidencia ausente o no literal');
}
module.exports = { locate };
