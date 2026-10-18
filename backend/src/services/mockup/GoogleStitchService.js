/**
 * Google Stitch Direct MCP Service
 * Conexión directa y concurrente con la API de Google Stitch (sin intermediarios ni n8n ni Ngrok).
 */

const env = require('../../config/env');
const { generateHtmlMockup } = require('./mockupGenerator');

class GoogleStitchService {
  constructor() {
    this.apiUrl = 'https://stitch.googleapis.com/mcp';
    this.apiKey = env.GOOGLE_STITCH_API_KEY || '';
    this.concurrency = parseInt(env.STITCH_CONCURRENCY || '4', 10);
  }

  /**
   * Crea un proyecto nuevo en Google Stitch
   */
  async createProject(projectName = 'Proyecto ICASE') {
    if (!this.apiKey) {
      throw new Error('Configura GOOGLE_STITCH_API_KEY en el entorno para utilizar Google Stitch.');
    }
    console.log(`[GoogleStitch] Creando proyecto en Stitch: "${projectName}"...`);
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'create_project',
          arguments: {
            title: projectName
          }
        },
        id: 1
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Stitch create_project error HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const structuredName = data?.result?.structuredContent?.name || '';
    let stitchProjectId = structuredName.replace('projects/', '').trim();

    if (!stitchProjectId) {
      // Intentar extraer de content[0].text
      const text = data?.result?.content?.[0]?.text;
      if (text) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.name) {
            stitchProjectId = parsed.name.replace('projects/', '').trim();
          }
        } catch (_) {}
      }
    }

    if (!stitchProjectId) {
      throw new Error('Google Stitch no devolvió el identificador del proyecto.');
    }

    console.log(`[GoogleStitch] Proyecto creado exitosamente en Stitch con ID: ${stitchProjectId}`);
    return stitchProjectId;
  }

  /**
   * Construye el prompt exacto de diseño minimalista en español para una pantalla
   */
  buildScreenPrompt(screen, project, totalScreens, screenIndex, userPrompt = '') {
    const title = screen.title || screen.name || `Pantalla ${screenIndex}`;
    const route = screen.route || '';
    const description = screen.description || '';
    const actors = Array.isArray(screen.actors) ? screen.actors.filter(Boolean) : [];
    const requirements = Array.isArray(screen.requirements) ? screen.requirements.filter(Boolean) : [];

    const formattedReqs = requirements.map(req => {
      if (typeof req === 'object' && req !== null) {
        const code = req.code || req.id || '';
        const desc = req.description || req.name || req.text || '';
        return code && desc ? `- ${code}: ${desc}` : (desc ? `- ${desc}` : (code ? `- ${code}` : null));
      }
      return `- ${String(req)}`;
    }).filter(Boolean);

    const sections = [];

    sections.push(`Diseña UNA ÚNICA pantalla profesional, limpia y moderna para el sistema "${project.name}".
Esta pantalla forma parte de un conjunto de ${totalScreens} pantallas.
Debes diseñar únicamente la pantalla indicada a continuación.

PANTALLA ${screenIndex} DE ${totalScreens}:
${title}`);

    if (route) {
      sections.push(`RUTA:\n${route}`);
    }

    if (description) {
      sections.push(`PROPÓSITO:\n${description}`);
    }

    if (actors.length > 0) {
      sections.push(`ACTORES Y ROLES:\n${actors.map(a => `- ${a}`).join('\n')}`);
    }

    if (formattedReqs.length > 0) {
      sections.push(`REQUISITOS RELACIONADOS:\n${formattedReqs.join('\n')}`);
    }

    if (userPrompt && userPrompt.trim()) {
      sections.push(`INSTRUCCIONES ADICIONALES:\n${userPrompt.trim()}`);
    }

    sections.push(`SISTEMA DE DISEÑO GLOBAL OBLIGATORIO (COHERENCIA TOTAL ENTRE TODAS LAS PANTALLAS):
- Esta pantalla pertenece a una aplicación web unificada de nivel corporativo para "${project.name}".
- PALETA DE COLORES GLOBAL:
  * Color Primario / Acento: Índigo (#4F46E5 / Tailwind indigo-600) para botones principales, enlaces activos y badges destacados.
  * Fondo General: Slate muy suave (#F8FAFC / bg-slate-50).
  * Tarjetas y Paneles: Blanco puro (#FFFFFF / bg-white) con borde fino (border border-slate-200) y sombra suave (shadow-sm rounded-xl).
  * Textos: Slate oscuro (#0F172A / text-slate-900) para títulos y Slate (#64748B / text-slate-500) para subtítulos y etiquetas.
- CONTENIDO DEDICADO SIN BARRAS EXTERNAS DUPLICADAS:
  * NO generes barras de navegación externas oscuras ni menús inventados en esta vista.
  * Diseña exclusivamente el ÁREA DE TRABAJO del módulo "${title}" (la tarjeta principal con formulario, tabla de registros, filtros y botones de acción).
- 100% EN ESPAÑOL: Todos los textos, botones, formularios, tablas, placeholders y estados deben estar exclusivamente en español (sin anglicismos).
- FORMULARIOS MODERNOS Y ESTANDARIZADOS:
  * Inputs con borde gris sutil (border-slate-300), bordes redondeados (rounded-lg), padding cómodo (px-3 py-2) y focus con anillo índigo (focus:ring-2 focus:ring-indigo-500).
- BOTONES HOMOGÉNEOS:
  * Acción principal: bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm.
  * Acción secundaria: bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2.5 rounded-lg border border-slate-300.
- TABLAS Y LISTADOS UNIFORMES:
  * Encabezados claros en bg-slate-100 con texto en mayúsculas pequeñas (text-xs uppercase tracking-wider font-semibold text-slate-600).
  * Filas con hover:bg-slate-50 y bordes inferiores finos.
  * Badges de estado estilizados (ej. verde suave para completado, amarillo suave para en proceso).
- COHERENCIA DE DATOS: Usa exclusivamente el dominio, actores y capacidades documentados en el contexto del proyecto. Los datos visuales de ejemplo no constituyen requisitos aprobados.`);

    return sections.join('\n\n');
  }

  /**
   * Genera una pantalla en Google Stitch mediante llamada directa MCP
   */
  async generateSingleScreen(stitchProjectId, screen, project, totalScreens, screenIndex, userPrompt) {
    const prompt = this.buildScreenPrompt(screen, project, totalScreens, screenIndex, userPrompt);
    const deviceType = screen.deviceType || (project.platform === 'MOBILE' ? 'MOBILE' : 'DESKTOP');

    console.log(`[GoogleStitch] [${screenIndex}/${totalScreens}] Generando "${screen.name}"...`);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'generate_screen_from_text',
            arguments: {
              projectId: stitchProjectId,
              prompt,
              deviceType
            }
          },
          id: 1
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[GoogleStitch] Error en "${screen.name}" HTTP ${response.status}: ${errText}`);
        return this.createFallbackScreen(screen, project);
      }

      const resJson = await response.json();
      const text = resJson?.result?.content?.[0]?.text;
      if (!text) {
        console.warn(`[GoogleStitch] "${screen.name}" respondió sin contenido de texto.`);
        return this.createFallbackScreen(screen, project);
      }

      let parsed = {};
      try {
        parsed = JSON.parse(text);
      } catch (parseErr) {
        console.warn(`[GoogleStitch] Error parseando JSON de Stitch para "${screen.name}":`, parseErr.message);
        return this.createFallbackScreen(screen, project);
      }

      const outputComponents = Array.isArray(parsed.outputComponents) ? parsed.outputComponents : [];
      let htmlUrl = null;
      let screenshotUrl = null;
      let screenTitle = screen.name;

      for (const component of outputComponents) {
        const screens = Array.isArray(component?.design?.screens) ? component.design.screens : [];
        for (const sc of screens) {
          const htmlResource = sc?.html || sc?.htmlCode || sc?.code || {};
          htmlUrl = htmlResource.downloadUrl || htmlResource.url || sc?.htmlUrl || sc?.downloadUrl || null;

          const screenshot = sc?.screenshot || {};
          screenshotUrl = screenshot.downloadUrl || screenshot.url || null;

          if (sc?.title || sc?.displayName) {
            screenTitle = sc.title || sc.displayName;
          }

          if (htmlUrl) break;
        }
        if (htmlUrl) break;
      }

      let html = null;
      if (htmlUrl) {
        try {
          const htmlRes = await fetch(htmlUrl);
          if (htmlRes.ok) {
            html = await htmlRes.text();
            html = html
              .replace(/\\r\\n/g, '\n')
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r');
          }
        } catch (fetchHtmlErr) {
          console.warn(`[GoogleStitch] Error descargando HTML de ${htmlUrl}:`, fetchHtmlErr.message);
        }
      }

      if (!html) {
        html = generateHtmlMockup({
          ...screen,
          name: screenTitle || screen.name
        });
      }

      console.log(`[GoogleStitch] ✓ "${screen.name}" generada exitosamente (${html ? 'con HTML interactivo' : 'básico'}).`);

      return {
        id: screen.id,
        name: screen.name,
        title: screenTitle || screen.name,
        route: screen.route,
        description: screen.description,
        deviceType,
        html,
        htmlUrl,
        screenshotUrl,
        components: screen.components || [],
        layout: { type: 'grid' }
      };
    } catch (err) {
      console.error(`[GoogleStitch] Excepción en "${screen.name}":`, err.message);
      return this.createFallbackScreen(screen, project);
    }
  }

  /**
   * Pantalla de respaldo si una vista en particular falla
   */
  createFallbackScreen(screen, project) {
    const screenObj = {
      id: screen.id,
      name: screen.name,
      title: screen.name,
      route: screen.route,
      description: screen.description,
      components: screen.components || [],
      layout: { type: 'grid' }
    };
    screenObj.html = generateHtmlMockup(screenObj);
    return screenObj;
  }

  /**
   * Ejecuta la generación concurrente de todas las pantallas
   */
  async generateMockups(project, screens, relevantRequirements, prompt = '') {
    const totalScreens = screens.length;
    console.log(`[GoogleStitch] Iniciando generación directa para ${totalScreens} pantallas con concurrencia de ${this.concurrency}...`);

    // 1. Crear el proyecto en Stitch
    const stitchProjectId = await this.createProject(project.name);

    // 2. Ejecutar peticiones en paralelo con límite de concurrencia
    const results = new Array(totalScreens);
    let currentIndex = 0;

    const worker = async () => {
      while (currentIndex < totalScreens) {
        const idx = currentIndex++;
        const screen = screens[idx];
        results[idx] = await this.generateSingleScreen(
          stitchProjectId,
          screen,
          project,
          totalScreens,
          idx + 1,
          prompt
        );
      }
    };

    const workerCount = Math.min(this.concurrency, totalScreens);
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);

    console.log(`[GoogleStitch] Finalizadas las ${totalScreens} pantallas exitosamente.`);

    return {
      provider: 'google-stitch-direct',
      success: true,
      screens: results
    };
  }
}

module.exports = new GoogleStitchService();
