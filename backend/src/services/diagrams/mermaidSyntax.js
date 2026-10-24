const crypto = require('crypto');

/** Genera un ID de nodo Mermaid unico y estable a partir de cualquier valor. */
const id = value => 'N_' + crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 20);

/** Limpia texto para usarlo como etiqueta Mermaid. */
const label = value =>
  String(value || '')
    .replace(/[&<>"\n\r\\`]/g, ' ')
    .replace(/[^\p{L}\p{N} _.,:/()-]/gu, ' ')
    .trim()
    .slice(0, 180);

/** Convierte un nombre en token Mermaid valido (sin acentos, sin espacios). */
const token = value =>
  'T_' +
  String(value || 'unknown')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '_');

/**
 * Normaliza un nombre para comparacion semantica.
 * Elimina acentos, espacios, guiones; convierte a MAYUSCULAS.
 * Ej: "Vehiculos" -> "VEHICULOS", "orden_trabajo" -> "ORDENTRABAJO"
 */
const normalize = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();

/**
 * Busca un nombre (con posibles variaciones singular/plural) en un Map<normalizedKey -> originalName>.
 * Retorna el nombre original si hay match, null si no.
 */
const resolveEntityName = (rawName, normalizedNameMap) => {
  const key = normalize(rawName);
  if (normalizedNameMap.has(key)) return normalizedNameMap.get(key);
  if (key.endsWith('S') && normalizedNameMap.has(key.slice(0, -1)))
    return normalizedNameMap.get(key.slice(0, -1));
  if (normalizedNameMap.has(key + 'S'))
    return normalizedNameMap.get(key + 'S');
  if (key.endsWith('ES') && normalizedNameMap.has(key.slice(0, -2)))
    return normalizedNameMap.get(key.slice(0, -2));
  return null;
};

module.exports = { id, label, token, normalize, resolveEntityName };
