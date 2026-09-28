function formatScreenTitle(str = '') {
  if (!str) return 'Pantalla';
  const clean = str.replace(/^[/#_]+/, '').replace(/[-_]+/g, ' ').trim();
  if (!clean) return 'Pantalla';
  return clean
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Normaliza y repara de manera segura cualquier salida de un proveedor de IA
 * antes de la validación estricta y persistencia en base de datos.
 * - Asegura la existencia de arreglos obligatorios.
 * - Resuelve referencias de navegación por ruta ("/login" -> "Login") o ID.
 * - Si una pantalla referenciada en navegación no fue creada en "screens", la autogenera.
 * - Normaliza nombres de entidades en relaciones.
 * - Normaliza IDs de actores en requisitos.
 * @param {Object} data
 * @returns {Object} Data normalizada
 */
function normalizeAIResponse(data) {
  if (!data || typeof data !== 'object') return data;

  // 1. Garantizar estructura y listas base
  if (!data.project || typeof data.project !== 'object') {
    data.project = { name: 'Sistema de Software', description: '' };
  }
  if (!Array.isArray(data.actors)) data.actors = [];
  if (!Array.isArray(data.requirements)) data.requirements = [];
  if (!Array.isArray(data.entities)) data.entities = [];
  if (!Array.isArray(data.relationships)) data.relationships = [];
  if (!Array.isArray(data.screens)) data.screens = [];
  if (!Array.isArray(data.navigation)) data.navigation = [];
  if (!data.architecture || typeof data.architecture !== 'object') {
    data.architecture = {
      style: 'Clean Architecture / 3 Capas',
      frontend: 'React',
      backend: 'Node.js Express',
      database: 'PostgreSQL'
    };
  }

  // 2. Normalizar Actores
  const actorMap = new Map();
  if (data.actors.length === 0) {
    data.actors.push({
      id: 'ACT-01',
      name: 'Usuario General',
      description: 'Usuario principal del sistema'
    });
  }

  data.actors.forEach((act, idx) => {
    if (!act.id) act.id = `ACT-${String(idx + 1).padStart(2, '0')}`;
    if (!act.name || typeof act.name !== 'string') act.name = `Actor ${idx + 1}`;
    act.name = act.name.trim();
    actorMap.set(act.id, act);
    actorMap.set(act.id.toLowerCase(), act);
    actorMap.set(act.name.toLowerCase(), act);
  });
  const defaultActorId = data.actors[0].id;

  // 3. Normalizar Requisitos
  data.requirements.forEach((req, idx) => {
    if (!req.code || typeof req.code !== 'string') {
      req.code = `RF-${String(idx + 1).padStart(2, '0')}`;
    }
    req.code = req.code.trim().toUpperCase();
    if (!req.name || typeof req.name !== 'string') {
      req.name = `Requisito ${req.code}`;
    }
    req.name = req.name.trim();

    // Normalizar tipo de requisito (RF vs RNF)
    const cleanType = String(req.type || '').toUpperCase();
    if (cleanType === 'NON_FUNCTIONAL' || cleanType === 'NO_FUNCIONAL' || cleanType === 'RNF' || req.code.startsWith('RNF')) {
      req.type = 'NON_FUNCTIONAL';
    } else {
      req.type = 'FUNCTIONAL';
    }

    // Normalizar prioridad
    const cleanPriority = String(req.priority || '').toUpperCase();
    if (cleanPriority === 'ALTA' || cleanPriority === 'HIGH') {
      req.priority = 'HIGH';
    } else if (cleanPriority === 'BAJA' || cleanPriority === 'LOW') {
      req.priority = 'LOW';
    } else {
      req.priority = 'MEDIUM';
    }

    // Normalizar referencias a actores
    if (Array.isArray(req.actorIds) && req.actorIds.length > 0) {
      req.actorIds = req.actorIds.map(ref => {
        if (typeof ref !== 'string') return defaultActorId;
        const matched = actorMap.get(ref) || actorMap.get(ref.toLowerCase().trim());
        return matched ? matched.id : ref;
      });
    } else {
      req.actorIds = [defaultActorId];
    }
  });

  // 4. Normalizar Entidades
  const entityMap = new Map();
  data.entities.forEach((ent, idx) => {
    if (!ent.id) ent.id = `ENT-${String(idx + 1).padStart(2, '0')}`;
    if (!ent.name || typeof ent.name !== 'string') ent.name = `Entidad${idx + 1}`;
    ent.name = ent.name.trim();
    entityMap.set(ent.id, ent);
    entityMap.set(ent.id.toLowerCase(), ent);
    entityMap.set(ent.name.toLowerCase(), ent);
  });

  // 5. Normalizar Relaciones
  const validRelationships = [];
  for (let i = 0; i < data.relationships.length; i++) {
    const rel = data.relationships[i];
    if (!rel || typeof rel !== 'object') continue;
    if (!rel.id) rel.id = `REL-${String(i + 1).padStart(2, '0')}`;
    let src = typeof rel.source === 'string' ? rel.source.trim() : '';
    let tgt = typeof rel.target === 'string' ? rel.target.trim() : '';

    if (!src || !tgt) continue;

    const matchSrc = entityMap.get(src) || entityMap.get(src.toLowerCase());
    if (matchSrc) {
      rel.source = matchSrc.name;
    } else {
      const newEnt = {
        id: `ENT-${String(data.entities.length + 1).padStart(2, '0')}`,
        name: src,
        description: `Entidad inferida: ${src}`,
        attributes: [{ name: 'id', type: 'Int' }]
      };
      data.entities.push(newEnt);
      entityMap.set(newEnt.id, newEnt);
      entityMap.set(newEnt.id.toLowerCase(), newEnt);
      entityMap.set(newEnt.name.toLowerCase(), newEnt);
      rel.source = newEnt.name;
    }

    const matchTgt = entityMap.get(tgt) || entityMap.get(tgt.toLowerCase());
    if (matchTgt) {
      rel.target = matchTgt.name;
    } else {
      const newEnt = {
        id: `ENT-${String(data.entities.length + 1).padStart(2, '0')}`,
        name: tgt,
        description: `Entidad inferida: ${tgt}`,
        attributes: [{ name: 'id', type: 'Int' }]
      };
      data.entities.push(newEnt);
      entityMap.set(newEnt.id, newEnt);
      entityMap.set(newEnt.id.toLowerCase(), newEnt);
      entityMap.set(newEnt.name.toLowerCase(), newEnt);
      rel.target = newEnt.name;
    }

    validRelationships.push(rel);
  }
  data.relationships = validRelationships;

  // 6. Normalizar Pantallas e indexar para resolución rápida
  const screenMap = new Map();
  function registerScreen(scr) {
    if (scr.id) {
      screenMap.set(scr.id, scr);
      screenMap.set(scr.id.toLowerCase(), scr);
    }
    if (scr.name) {
      const trimmed = scr.name.trim();
      const lower = trimmed.toLowerCase();
      screenMap.set(trimmed, scr);
      screenMap.set(lower, scr);
      screenMap.set(lower.replace(/^\//, ''), scr);
      screenMap.set('/' + lower.replace(/^\//, ''), scr);
    }
    if (scr.route) {
      const cleanR = scr.route.trim().toLowerCase();
      screenMap.set(cleanR, scr);
      screenMap.set(cleanR.replace(/^\//, ''), scr);
      screenMap.set('/' + cleanR.replace(/^\//, ''), scr);
    }
  }

  data.screens.forEach((scr, idx) => {
    if (!scr.id) scr.id = `SCR-${String(idx + 1).padStart(2, '0')}`;
    if (!scr.name || typeof scr.name !== 'string') {
      scr.name = scr.route ? formatScreenTitle(scr.route) : `Pantalla ${idx + 1}`;
    }
    scr.name = scr.name.trim();
    if (!scr.route || typeof scr.route !== 'string') {
      scr.route = '/' + scr.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    registerScreen(scr);
  });

  // 7. Normalizar Navegación (resolver referencias y autogenerar pantallas faltantes)
  const validNavigation = [];
  function resolveOrCreateScreen(ref) {
    if (!ref || typeof ref !== 'string') return null;
    const clean = ref.trim();
    const cleanLower = clean.toLowerCase();
    const stripped = cleanLower.replace(/^\//, '');

    const matched = screenMap.get(clean) ||
                    screenMap.get(cleanLower) ||
                    screenMap.get(stripped) ||
                    screenMap.get('/' + stripped);

    if (matched) {
      return matched.name;
    }

    // Si la pantalla no existe, autogenerarla con componentes inteligentes
    const screenTitle = formatScreenTitle(clean);
    const screenRoute = clean.startsWith('/') ? clean : `/${clean}`;
    const isLogin = cleanLower.includes('login') || cleanLower.includes('sesion') || cleanLower.includes('sesión') || cleanLower.includes('auth');
    const isDashboard = cleanLower.includes('dash') || cleanLower.includes('tablero') || cleanLower.includes('inicio') || cleanLower.includes('home');

    const newScreen = {
      id: `SCR-${String(data.screens.length + 1).padStart(2, '0')}`,
      name: screenTitle,
      route: screenRoute,
      purpose: isLogin ? 'Autenticación y acceso al sistema' : (isDashboard ? 'Panel principal e indicadores' : `Gestión de ${screenTitle}`),
      description: isLogin ? 'Pantalla de ingreso de credenciales de usuario' : `Vista de interfaz para ${screenTitle}`,
      components: isLogin
        ? [
            { type: 'heading', label: 'Inicio de Sesión' },
            { type: 'input', label: 'Correo o Usuario', placeholder: 'usuario@ejemplo.com' },
            { type: 'input', label: 'Contraseña', placeholder: '••••••••' },
            { type: 'button', label: 'Iniciar Sesión' }
          ]
        : [
            { type: 'heading', label: screenTitle },
            { type: 'card', label: `Contenido de ${screenTitle}`, placeholder: 'Información y acciones del módulo' }
          ],
      requirementIds: [],
      actorIds: [defaultActorId]
    };

    data.screens.push(newScreen);
    registerScreen(newScreen);
    return newScreen.name;
  }

  for (const nav of data.navigation) {
    if (!nav || typeof nav !== 'object') continue;
    if (!nav.from || !nav.to) continue;

    const fromResolved = resolveOrCreateScreen(nav.from);
    const toResolved = resolveOrCreateScreen(nav.to);

    if (fromResolved && toResolved) {
      nav.from = fromResolved;
      nav.to = toResolved;
      validNavigation.push(nav);
    }
  }
  data.navigation = validNavigation;

  return data;
}

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
      actorIds.add(id.toLowerCase());
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
        if (typeof actRef !== 'string') continue;
        const cleanRef = actRef.trim().toLowerCase();
        if (!actorIds.has(actRef) && !actorIds.has(cleanRef) && !actorNames.has(cleanRef)) {
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
    const lowerName = cleanName.toLowerCase();
    if (entityNames.has(lowerName)) {
      return { isValid: false, error: `La respuesta del proveedor de IA no cumple el contrato esperado (nombre duplicado de entidad: ${cleanName}).` };
    }
    entityNames.add(cleanName);
    entityNames.add(lowerName);

    if (ent.id) {
      if (entityIds.has(ent.id)) {
        return { isValid: false, error: `La respuesta del proveedor de IA no cumple el contrato esperado (ID duplicado de entidad: ${ent.id}).` };
      }
      entityIds.add(ent.id);
      entityIds.add(ent.id.toLowerCase());
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
    if (!entityNames.has(src) && !entityNames.has(src.toLowerCase()) && !entityIds.has(src) && !entityIds.has(src.toLowerCase())) {
      return {
        isValid: false,
        error: `La respuesta del proveedor de IA no cumple el contrato esperado (relación referencia una entidad origen inexistente: "${src}").`
      };
    }
    if (!entityNames.has(tgt) && !entityNames.has(tgt.toLowerCase()) && !entityIds.has(tgt) && !entityIds.has(tgt.toLowerCase())) {
      return {
        isValid: false,
        error: `La respuesta del proveedor de IA no cumple el contrato esperado (relación referencia una entidad destino inexistente: "${tgt}").`
      };
    }
  }

  // 8. Validar Pantallas y Coleccionar Nombres, IDs y Rutas
  const screenIds = new Set();
  const screenNames = new Set();
  const screenRoutes = new Set();
  for (const scr of data.screens) {
    if (!scr.name || typeof scr.name !== 'string') {
      return { isValid: false, error: 'La respuesta del proveedor de IA no cumple el contrato esperado (pantalla sin nombre válido).' };
    }
    if (scr.id) {
      if (screenIds.has(scr.id)) {
        return { isValid: false, error: `La respuesta del proveedor de IA no cumple el contrato esperado (ID duplicado de pantalla: ${scr.id}).` };
      }
      screenIds.add(scr.id);
      screenIds.add(scr.id.toLowerCase());
    }
    const cleanName = scr.name.trim();
    const lowerName = cleanName.toLowerCase();
    screenNames.add(cleanName);
    screenNames.add(lowerName);
    screenNames.add(lowerName.replace(/^\//, ''));

    if (scr.route && typeof scr.route === 'string') {
      const cleanRoute = scr.route.trim().toLowerCase();
      screenRoutes.add(cleanRoute);
      screenRoutes.add(cleanRoute.replace(/^\//, ''));
      screenRoutes.add('/' + cleanRoute.replace(/^\//, ''));
    }
  }

  // 9. Validar Referencias en Navegación (from y to deben existir en screens por nombre, ID o ruta)
  function matchScreenRef(ref) {
    if (!ref || typeof ref !== 'string') return false;
    const clean = ref.trim();
    const lower = clean.toLowerCase();
    const stripped = lower.replace(/^\//, '');
    const withSlash = '/' + stripped;

    return (
      screenNames.has(clean) ||
      screenNames.has(lower) ||
      screenNames.has(stripped) ||
      screenIds.has(clean) ||
      screenIds.has(lower) ||
      screenRoutes.has(lower) ||
      screenRoutes.has(stripped) ||
      screenRoutes.has(withSlash)
    );
  }

  for (const nav of data.navigation) {
    if (!nav.from || !nav.to) {
      return { isValid: false, error: 'La respuesta del proveedor de IA no cumple el contrato esperado (nodo de navegación sin "from" o "to").' };
    }
    const from = nav.from.trim();
    const to = nav.to.trim();
    if (!matchScreenRef(from)) {
      return {
        isValid: false,
        error: `La respuesta del proveedor de IA no cumple el contrato esperado (navegación referencia una pantalla origen inexistente: "${from}").`
      };
    }
    if (!matchScreenRef(to)) {
      return {
        isValid: false,
        error: `La respuesta del proveedor de IA no cumple el contrato esperado (navegación referencia una pantalla destino inexistente: "${to}").`
      };
    }
  }

  return { isValid: true, error: null };
}

module.exports = {
  validateAIResponse,
  normalizeAIResponse
};

