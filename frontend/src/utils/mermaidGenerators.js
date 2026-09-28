/**
 * Transformadores Puros de Datos Estructurados hacia Sintaxis Mermaid
 * (Sin consumir tokens de IA, generación 100% determinística y local)
 */

function stripAccents(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function sanitizeId(str, prefix = 'NODE') {
  if (!str) return `${prefix}_ITEM`;
  const clean = stripAccents(String(str))
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

  if (!clean || clean === 'END') return `${prefix}_${clean || 'ITEM'}`;
  return clean;
}

function sanitizeLabel(text) {
  if (!text) return '';
  return String(text).replace(/["\r\n\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Genera la sintaxis Mermaid de un diagrama Entidad-Relación (erDiagram)
 * a partir de las entidades y relaciones persistidas.
 */
export function generateERDiagram(entities = [], relationships = []) {
  if (!entities || entities.length === 0) {
    return `erDiagram
    direction TB
    SISTEMA {
        string estado "Sin entidades registradas"
    }`;
  }

  let lines = ['erDiagram', '    direction TB'];

  // 1. Declaración de entidades y atributos
  for (const ent of entities) {
    const entName = sanitizeId(ent.name, 'ENT');
    lines.push(`    ${entName} {`);
    if (ent.attributes && ent.attributes.length > 0) {
      for (const attr of ent.attributes) {
        const rawType = stripAccents(attr.type || 'string').toLowerCase();
        let type = 'string';
        if (/^(int|integer|number|entero|id)/.test(rawType)) type = 'int';
        else if (/^(float|double|decimal|precio|costo)/.test(rawType)) type = 'float';
        else if (/^(bool|boolean)/.test(rawType)) type = 'boolean';
        else if (/^(date|datetime|fecha)/.test(rawType)) type = 'date';

        const attrName = stripAccents(attr.name || 'campo').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
        const pk = attr.isPk ? 'PK' : (attr.isFk ? 'FK' : '');
        lines.push(`        ${type} ${attrName} ${pk}`.trimEnd());
      }
    } else {
      lines.push(`        string id PK`);
    }
    lines.push(`    }`);
  }

  // 2. Declaración de relaciones
  if (relationships && relationships.length > 0) {
    for (const rel of relationships) {
      const source = sanitizeId(rel.source, 'ENT');
      const target = sanitizeId(rel.target, 'ENT');
      const label = sanitizeLabel(rel.description || 'relaciona').slice(0, 60);

      let connector = '||--o{';
      if (rel.cardinality === '1:1') connector = '||--||';
      else if (rel.cardinality === 'N:M' || rel.cardinality === 'M:N') connector = '}o--o{';
      else if (rel.cardinality === '0:1' || rel.cardinality === '1:0') connector = '|o--||';
      else if (rel.cardinality === 'N:1' || rel.cardinality === 'M:1') connector = '}o--||';

      lines.push(`    ${source} ${connector} ${target} : "${label}"`);
    }
  }

  return lines.join('\n');
}

/**
 * Genera el Árbol de Navegación (flowchart TD con jerarquía padre -> hijo).
 * Representa la estructura jerárquica de la aplicación, NO un flujo operativo.
 */
export function generateNavigationDiagram(navigation = [], screens = [], projectName = 'Sistema') {
  let lines = ['flowchart TD'];
  const rootId = 'APP_ROOT';
  lines.push(`    ${rootId}["🌐 ${sanitizeLabel(projectName)}"]`);

  if (!screens || screens.length === 0) {
    lines.push(`    ${rootId} --> MOD_AUTH["Portal de Acceso"]`);
    lines.push(`    ${rootId} --> MOD_DASH["Panel Principal"]`);
    lines.push(`    MOD_AUTH --> SCR_LOGIN["Inicio de Sesión\\n/login"]`);
    lines.push(`    MOD_DASH --> SCR_DASH["Dashboard\\n/dashboard"]`);
    return lines.join('\n');
  }

  // Module buckets
  const authScreens = [];
  const dashboardScreens = [];
  const otherScreens = [];

  for (const scr of screens) {
    const safeId = 'SCR_' + sanitizeId(scr.name).slice(0, 25);
    const label = sanitizeLabel(scr.name);
    const route = scr.route ? `\\n${sanitizeLabel(scr.route)}` : '';
    const item = { safeId, label: `${label}${route}`, raw: scr.name.toLowerCase() };

    if (item.raw.includes('login') || item.raw.includes('acceso') || item.raw.includes('autentica')) {
      authScreens.push(item);
    } else if (item.raw.includes('dashboard') || item.raw.includes('indicador') || item.raw.includes('resumen')) {
      dashboardScreens.push(item);
    } else {
      otherScreens.push(item);
    }
  }

  if (authScreens.length > 0) {
    lines.push(`    ${rootId} --> MOD_AUTH["Portal de Acceso"]`);
    authScreens.forEach(s => lines.push(`    MOD_AUTH --> ${s.safeId}["${s.label}"]`));
  }

  let mainHub = rootId;
  if (dashboardScreens.length > 0) {
    const dash = dashboardScreens[0];
    lines.push(`    ${rootId} --> ${dash.safeId}["${dash.label}"]`);
    mainHub = dash.safeId;
    dashboardScreens.slice(1).forEach(s => lines.push(`    ${dash.safeId} --> ${s.safeId}["${s.label}"]`));
  }

  otherScreens.forEach(s => {
    lines.push(`    ${mainHub} --> ${s.safeId}["${s.label}"]`);
  });

  return lines.join('\n');
}

/**
 * Genera el Diagrama de Flujo de Procesos (flowchart TD con decisiones y ramas).
 * Representa el flujo operativo: Inicio -> Actividades -> Decisión -> Ramas -> Fin.
 */
export function generateFlowchartDiagram(requirements = [], useCases = [], projectName = 'Sistema') {
  let lines = ['flowchart TD'];
  lines.push(`    START(["Inicio: ${sanitizeLabel(projectName)}"])`);

  const steps = (useCases && useCases.length > 0)
    ? useCases.map((u, i) => ({ id: `STEP_${i + 1}`, label: sanitizeLabel(u.name) }))
    : requirements.slice(0, 7).map((r, i) => ({ id: `STEP_${i + 1}`, label: sanitizeLabel(r.name) }));

  if (steps.length === 0) {
    lines.push(`    START --> STEP1["1. Registrar datos de entrada"]`);
    lines.push(`    STEP1 --> DEC1{"¿Validación conforme?"}`);
    lines.push(`    DEC1 -->|Sí| STEP2["2. Procesar y guardar en base de datos"]`);
    lines.push(`    DEC1 -->|No| ERR["Notificar error de validación"]`);
    lines.push(`    ERR --> STEP1`);
    lines.push(`    STEP2 --> FIN(["Fin del Proceso"])`);
    return lines.join('\n');
  }

  let prev = 'START';
  steps.forEach((s, idx) => {
    lines.push(`    ${prev} --> ${s.id}["${idx + 1}. ${s.label}"]`);
    prev = s.id;

    // Insert decision at midpoint
    if (idx === Math.floor(steps.length / 2)) {
      const decId = `DEC_${idx + 1}`;
      lines.push(`    ${s.id} --> ${decId}{"¿Cumple reglas de negocio?"}`);
      lines.push(`    ${decId} -->|No| ERR_${idx + 1}["Rechazar / Solicitar corrección"]`);
      lines.push(`    ERR_${idx + 1} --> ${s.id}`);

      if (idx + 1 < steps.length) {
        lines.push(`    ${decId} -->|Sí| ${steps[idx + 1].id}`);
        // Advance prev to the next step
        prev = steps[idx + 1].id;
      } else {
        prev = decId;
      }
    }
  });

  lines.push(`    ${prev} --> FIN(["Fin del Proceso"])`);
  return lines.join('\n');
}

/**
 * Genera el diagrama de arquitectura Mermaid (flowchart LR o TB)
 */
export function generateArchitectureDiagram(architecture) {
  if (!architecture) {
    return `flowchart TB
    subgraph PRESENTATION ["1. Capa de Presentación"]
        FRONT["Frontend (React SPA)"]
    end
    subgraph DOMAIN ["2. Capa de Negocio"]
        BACK["Backend (Node.js Express API)"]
    end
    subgraph DATA ["3. Capa de Datos"]
        DB[("PostgreSQL 16")]
    end
    FRONT -->|HTTPS / REST API| BACK
    BACK -->|TCP / Prisma ORM| DB`;
  }

  let lines = ['flowchart TB'];

  const fe = sanitizeLabel(architecture.frontend || 'React SPA');
  const be = sanitizeLabel(architecture.backend || 'Node.js Express API');
  const db = sanitizeLabel(architecture.database || 'PostgreSQL 16');

  lines.push(`    subgraph PRESENTATION ["1. Capa de Presentación (Frontend)"]`);
  lines.push(`        FRONT["${fe}"]`);
  lines.push(`    end`);

  lines.push(`    subgraph DOMAIN ["2. Capa de Negocio y Dominio (Backend)"]`);
  lines.push(`        BACK["${be}"]`);
  lines.push(`    end`);

  lines.push(`    subgraph DATA ["3. Capa de Datos e Infraestructura"]`);
  lines.push(`        DB[("${db}")]`);
  lines.push(`    end`);

  lines.push(`    FRONT -->|HTTPS / REST API| BACK`);
  lines.push(`    BACK -->|TCP / Prisma ORM| DB`);

  return lines.join('\n');
}
