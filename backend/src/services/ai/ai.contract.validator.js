/**
 * AI Contract Validator
 * Ensures that the output of any AI Provider strictly conforms to the canonical ICASE contract,
 * including structural presence, field types, unique identifiers and referential integrity.
 */
function validateAIResponse(data) {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'La respuesta del proveedor de IA no cumple el contrato esperado (no es un objeto).' };
  }

  // 1. Validar Project
  if (!data.project || typeof data.project !== 'object' || typeof data.project.name !== 'string' || !data.project.name.trim()) {
    return { isValid: false, error: 'La respuesta del proveedor de IA no cumple el contrato esperado (objeto "project" inválido o sin nombre).' };
  }

  // 2. Validar Listas Obligatorias
  const requiredArrays = ['actors', 'requirements', 'entities', 'relationships', 'screens', 'navigation'];
  for (const field of requiredArrays) {
    if (!Array.isArray(data[field])) {
      return { isValid: false, error: `La respuesta del proveedor de IA no cumple el contrato esperado (campo "${field}" ausente o no es un arreglo).` };
    }
  }

  // 3. Validar Architecture
  if (!data.architecture || typeof data.architecture !== 'object') {
    return { isValid: false, error: 'La respuesta del proveedor de IA no cumple el contrato esperado (objeto "architecture" ausente o inválido).' };
  }

  // 4. Validar Unicidad de IDs en Actores y Coleccionar IDs
  const actorIds = new Set();
  const actorNames = new Set();
  for (const actor of data.actors) {
    if (!actor.name || typeof actor.name !== 'string') {
      return { isValid: false, error: 'La respuesta del proveedor de IA no cumple el contrato esperado (actor sin nombre válido).' };
    }
    const id = actor.id || actor.codeId;
    if (id) {
      if (actorIds.has(id)) {
        return { isValid: false, error: `La respuesta del proveedor de IA no cumple el contrato esperado (ID duplicado de actor: ${id}).` };
      }
      actorIds.add(id);
    }
    actorNames.add(actor.name.trim().toLowerCase());
  }

  // 5. Validar Unicidad de Códigos de Requisitos y Referencias a Actores
  const reqCodes = new Set();
  for (const req of data.requirements) {
    if (!req.code || typeof req.code !== 'string') {
      return { isValid: false, error: 'La respuesta del proveedor de IA no cumple el contrato esperado (requisito sin código).' };
    }
    const cleanCode = req.code.trim().toUpperCase();
    if (reqCodes.has(cleanCode)) {
      return { isValid: false, error: `La respuesta del proveedor de IA no cumple el contrato esperado (código duplicado de requisito: ${cleanCode}).` };
    }
    reqCodes.add(cleanCode);

    if (!req.name || typeof req.name !== 'string') {
      return { isValid: false, error: `La respuesta del proveedor de IA no cumple el contrato esperado (requisito ${cleanCode} sin nombre).` };
    }

    // Validar referencias de actorIds
    if (req.actorIds && Array.isArray(req.actorIds)) {
      for (const actRef of req.actorIds) {
        if (!actorIds.has(actRef) && !actorNames.has(actRef.trim().toLowerCase())) {
          return {
            isValid: false,
            error: `La respuesta del proveedor de IA no cumple el contrato esperado (requisito ${cleanCode} referencia un actor inexistente: "${actRef}").`
          };
        }
      }
    }
  }

  // 6. Validar Unicidad de Entidades y Coleccionar Nombres e IDs
  const entityIds = new Set();
  const entityNames = new Set();
  for (const ent of data.entities) {
    if (!ent.name || typeof ent.name !== 'string') {
      return { isValid: false, error: 'La respuesta del proveedor de IA no cumple el contrato esperado (entidad sin nombre válido).' };
    }
    const cleanName = ent.name.trim();
    if (entityNames.has(cleanName)) {
      return { isValid: false, error: `La respuesta del proveedor de IA no cumple el contrato esperado (nombre duplicado de entidad: ${cleanName}).` };
    }
    entityNames.add(cleanName);

    if (ent.id) {
      if (entityIds.has(ent.id)) {
        return { isValid: false, error: `La respuesta del proveedor de IA no cumple el contrato esperado (ID duplicado de entidad: ${ent.id}).` };
      }
      entityIds.add(ent.id);
    }
  }

  // 7. Validar Referencias en Relaciones (source y target deben existir en entities)
  const relIds = new Set();
  for (const rel of data.relationships) {
    if (!rel.source || !rel.target) {
      return { isValid: false, error: 'La respuesta del proveedor de IA no cumple el contrato esperado (relación sin origen o destino).' };
    }
    if (rel.id) {
      if (relIds.has(rel.id)) {
        return { isValid: false, error: `La respuesta del proveedor de IA no cumple el contrato esperado (ID duplicado de relación: ${rel.id}).` };
      }
      relIds.add(rel.id);
    }

    const src = rel.source.trim();
    const tgt = rel.target.trim();
    if (!entityNames.has(src) && !entityIds.has(src)) {
      return {
        isValid: false,
        error: `La respuesta del proveedor de IA no cumple el contrato esperado (relación referencia una entidad origen inexistente: "${src}").`
      };
    }
    if (!entityNames.has(tgt) && !entityIds.has(tgt)) {
      return {
        isValid: false,
        error: `La respuesta del proveedor de IA no cumple el contrato esperado (relación referencia una entidad destino inexistente: "${tgt}").`
      };
    }
  }

  // 8. Validar Pantallas y Coleccionar Nombres e IDs
  const screenIds = new Set();
  const screenNames = new Set();
  for (const scr of data.screens) {
    if (!scr.name || typeof scr.name !== 'string') {
      return { isValid: false, error: 'La respuesta del proveedor de IA no cumple el contrato esperado (pantalla sin nombre válido).' };
    }
    if (scr.id) {
      if (screenIds.has(scr.id)) {
        return { isValid: false, error: `La respuesta del proveedor de IA no cumple el contrato esperado (ID duplicado de pantalla: ${scr.id}).` };
      }
      screenIds.add(scr.id);
    }
    screenNames.add(scr.name.trim());
  }

  // 9. Validar Referencias en Navegación (from y to deben existir en screens)
  for (const nav of data.navigation) {
    if (!nav.from || !nav.to) {
      return { isValid: false, error: 'La respuesta del proveedor de IA no cumple el contrato esperado (nodo de navegación sin "from" o "to").' };
    }
    const from = nav.from.trim();
    const to = nav.to.trim();
    if (!screenNames.has(from) && !screenIds.has(from)) {
      return {
        isValid: false,
        error: `La respuesta del proveedor de IA no cumple el contrato esperado (navegación referencia una pantalla origen inexistente: "${from}").`
      };
    }
    if (!screenNames.has(to) && !screenIds.has(to)) {
      return {
        isValid: false,
        error: `La respuesta del proveedor de IA no cumple el contrato esperado (navegación referencia una pantalla destino inexistente: "${to}").`
      };
    }
  }

  return { isValid: true, error: null };
}

module.exports = {
  validateAIResponse
};
