/**
 * Google Stitch Direct MCP Service
 * Conexión directa y concurrente con la API de Google Stitch (sin intermediarios ni n8n ni Ngrok).
 */

const env = require('../../config/env');
const { generateHtmlMockup } = require('./mockupGenerator');
const designSystemService = require('./designSystemService');

class GoogleStitchService {
  constructor() {
    this.apiUrl = 'https://stitch.googleapis.com/mcp';
    this.apiKey = env.GOOGLE_STITCH_API_KEY || '';
    this.concurrency = parseInt(env.STITCH_CONCURRENCY || '4', 10);
  }

  extractHtmlFromStitchDownload(raw) {
    if (!raw) return null;
    const trimmed = String(raw).trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        const encoded = parsed.dataString || parsed.html || parsed.content || parsed.data || parsed.fileContent;
        if (typeof encoded === 'string' && encoded.trim()) {
          return this.extractHtmlFromStitchDownload(encoded);
        }
      } catch (_) { /* no es JSON de descarga */ }
    }
    if (/<!DOCTYPE html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
      return trimmed
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r');
    }
    return null;
  }

  async downloadStitchHtml(htmlUrl) {
    if (!htmlUrl) return null;
    const response = await fetch(htmlUrl, {
      headers: { 'X-Goog-Api-Key': this.apiKey }
    });
    const raw = await response.text();
    if (!response.ok) {
      console.warn(`[GoogleStitch] Descarga HTML HTTP ${response.status}: ${raw.slice(0, 180)}`);
      return null;
    }
    return this.extractHtmlFromStitchDownload(raw);
  }

  /**
   * Crea un proyecto nuevo en Google Stitch
   */
  async createProject(projectName = 'Proyecto ICASE') {
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
    const description = screen.purpose || screen.description || '';
    const actors = Array.isArray(screen.actors) ? screen.actors.filter(Boolean) : [];
    const requirements = Array.isArray(screen.requirements) ? screen.requirements.filter(Boolean) : [];
    const fields = Array.isArray(screen.fields) ? screen.fields.filter(Boolean) : [];
    const nav = Array.isArray(screen.nav) ? screen.nav.filter(Boolean) : [];
    const sampleRows = Array.isArray(screen.sampleRows) ? screen.sampleRows : [];
    const primaryAction = screen.primaryAction || '';
    const archetype = screen.archetype || ( /login|acceso/i.test(title) ? 'A' : 'B');

    const formattedReqs = requirements.slice(0, 6).map(req => {
      if (typeof req === 'object' && req !== null) {
        const desc = req.description || req.name || req.text || '';
        return desc ? `- ${desc}` : null;
      }
      return `- ${String(req)}`;
    }).filter(Boolean);

    const sections = [];
    sections.push(`Diseña UNA ÚNICA pantalla para "${project.name}".
No diseñes el resto del sistema. Esta vista es la ${screenIndex} de ${totalScreens}.

PANTALLA: ${title}
RUTA: ${route || '/'}`);

    if (actors.length) sections.push(`ACTOR QUE USA ESTA PANTALLA:\n${actors.map(actor => `- ${actor}`).join('\n')}\nDiseña el menú y el contenido para ese rol, no para todos.`);
    if (description) sections.push(`PROPÓSITO (qué debe poder hacer el usuario aquí):\n${description}`);
    if (fields.length) sections.push(`CAMPOS VISIBLES (usa estas etiquetas, no "Código / Identificador"):\n${fields.map(field => `- ${field}`).join('\n')}`);
    if (primaryAction) sections.push(`ACCIÓN PRINCIPAL:\n${primaryAction}`);
    if (nav.length) sections.push(`MENÚ SUPERIOR DE ESTE ROL (mismos enlaces en todas sus pantallas; marca "${title}" como activa):\n${nav.map(item => `- ${item}`).join('\n')}`);
    if (sampleRows.length) {
      sections.push(`DATOS DE EJEMPLO OBLIGATORIOS (coherentes con el resto del taller):\n${sampleRows.map(row => `- ${Array.isArray(row) ? row.join(' · ') : row}`).join('\n')}`);
    }
    if (formattedReqs.length) sections.push(`EVIDENCIA FUNCIONAL (tradúcela a UI, no copies el texto técnico):\n${formattedReqs.join('\n')}`);
    if (userPrompt && userPrompt.trim() && !/^generar un prototipo visual para:/i.test(userPrompt.trim())) {
      sections.push(`INSTRUCCIONES ADICIONALES:\n${userPrompt.trim()}`);
    }
    sections.push(designSystemService.getStitchScreenVisualRules(archetype, project.name, project.description));
    return sections.join('\n\n');
  }

  /**
   * Informa de las capacidades y límites de la integración con Google Stitch
   */
  getCapabilities() {
    return designSystemService.getStitchCapabilities(this.apiKey);
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
          html = await this.downloadStitchHtml(htmlUrl);
        } catch (fetchHtmlErr) {
          console.warn(`[GoogleStitch] Error descargando HTML de ${htmlUrl}:`, fetchHtmlErr.message);
        }
      }

      const usedFallback = !html;
      if (usedFallback) {
        html = generateHtmlMockup({
          ...screen,
          name: screenTitle || screen.name
        });
      }

      console.log(`[GoogleStitch] ✓ "${screen.name}" generada exitosamente (${usedFallback ? 'fallback ICASE' : `HTML Stitch ${html.length} chars`}).`);

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
      ...screen,
      id: screen.id,
      name: screen.name,
      title: screen.name,
      route: screen.route,
      description: screen.purpose || screen.description,
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
