/**
 * Navigation Tree Generator (Árbol de Navegación)
 * Models the hierarchical parent-child structure of the application:
 * Root (Sistema) -> Main Modules / Portals -> Screens -> Detail / Sub-screens.
 * Does NOT model operational process flows (that belongs in Diagrama de Flujo).
 */

const { toSafeIdentifier, toSafeLabel } = require('./mermaidNormalizer');

module.exports = {
  /**
   * Generates a hierarchical navigation tree (flowchart TD).
   * @param {Array} screens - Array of Screen models { id, name, route, purpose, parentId }
   * @param {string} projectName - Name of the project
   */
  generate(screens = [], projectName = 'Sistema de Información') {
    const lines = ['flowchart TD'];

    const rootId = 'APP_ROOT';
    const safeProjectName = toSafeLabel(projectName, 40) || 'Sistema';
    lines.push(`  ${rootId}["🌐 ${safeProjectName}"]`);

    if (!screens || screens.length === 0) {
      lines.push(`  ${rootId} --> MOD_AUTH["Módulo de Autenticación"]`);
      lines.push(`  ${rootId} --> MOD_MAIN["Módulo Principal"]`);
      lines.push(`  MOD_AUTH --> SCR_LOGIN["Inicio de Sesión\\n/login"]`);
      lines.push(`  MOD_MAIN --> SCR_DASH["Panel Principal / Dashboard\\n/dashboard"]`);
      return lines.join('\n');
    }

    // Clean and normalize screens
    const normalizedScreens = screens.map((s, idx) => {
      const safeId = 'SCR_' + toSafeIdentifier(s.name, `screen_${idx + 1}`).toUpperCase().slice(0, 30);
      const name = toSafeLabel(s.name, 50);
      const route = s.route ? `\\n${toSafeLabel(s.route, 30)}` : '';
      return {
        id: s.id,
        safeId,
        name,
        route,
        label: `${name}${route}`,
        parentId: s.parentId,
        rawName: s.name.toLowerCase()
      };
    });

    // Grouping by modules/functional areas
    const authScreens = [];
    const dashboardScreens = [];
    const domainScreens = [];

    normalizedScreens.forEach(s => {
      if (s.rawName.includes('login') || s.rawName.includes('autentica') || s.rawName.includes('registro') || s.rawName.includes('acceso')) {
        authScreens.push(s);
      } else if (s.rawName.includes('dashboard') || s.rawName.includes('indicador') || s.rawName.includes('resumen') || s.rawName.includes('inicio')) {
        dashboardScreens.push(s);
      } else {
        domainScreens.push(s);
      }
    });

    // 1. Auth Branch (Portal de Acceso)
    if (authScreens.length > 0) {
      const authModId = 'MOD_AUTH';
      lines.push(`  ${rootId} --> ${authModId}["Portal de Acceso"]`);
      authScreens.forEach(s => {
        lines.push(`  ${authModId} --> ${s.safeId}["${s.label}"]`);
      });
    }

    // 2. Main Workspace / Dashboard
    let mainHubId = rootId;
    if (dashboardScreens.length > 0) {
      const dash = dashboardScreens[0];
      lines.push(`  ${rootId} --> ${dash.safeId}["${dash.label}"]`);
      mainHubId = dash.safeId;
      // Any extra dashboard screens
      dashboardScreens.slice(1).forEach(s => {
        lines.push(`  ${dash.safeId} --> ${s.safeId}["${s.label}"]`);
      });
    }

    // 3. Domain Modules and Screens
    // Group remaining domain screens by logical cluster or connect them hierarchically
    if (domainScreens.length > 0) {
      domainScreens.forEach(s => {
        lines.push(`  ${mainHubId} --> ${s.safeId}["${s.label}"]`);
      });
    }

    return lines.join('\n');
  }
};
