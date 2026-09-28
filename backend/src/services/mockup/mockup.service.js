const env = require('../../config/env');
const MockMockupProvider = require('./mock.mockup.provider');
const prisma = require('../../config/prisma');
const { generateHtmlMockup } = require('./mockupGenerator');

class MockupService {
  constructor() {
    this.mockProvider = new MockMockupProvider();
  }

  selectRelevantRequirements(requirements = []) {
    const priorityWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const typeWeight = { FUNCTIONAL: 2, NON_FUNCTIONAL: 1 };
    const limit = Math.max(1, env.MOCKUP_MAX_REQUIREMENTS || 12);

    return requirements
      .filter((requirement) => requirement.status === 'APPROVED' || requirement.status === 'PENDING')
      .sort((first, second) => {
        const firstScore =
          (priorityWeight[first.priority] || 0) * 10 +
          (typeWeight[first.type] || 0) * 3;
        const secondScore =
          (priorityWeight[second.priority] || 0) * 10 +
          (typeWeight[second.type] || 0) * 3;
        return secondScore - firstScore;
      })
      .slice(0, limit)
      .map((requirement) => ({
        id: requirement.id,
        code: requirement.code,
        name: requirement.name,
        description: requirement.description,
        type: requirement.type,
        priority: requirement.priority,
        status: requirement.status
      }));
  }

  buildScreenPlan(project, requirements = [], screenSelection = null) {
    let sourceScreens = [];

    // 1. Usar pantallas explícitas si existen
    if (project.screens && project.screens.length > 0) {
      sourceScreens = project.screens.map(s => ({
        id: s.id,
        codeId: s.codeId,
        name: s.name,
        title: s.name,
        route: s.route || `/${s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        platform: s.platform || project.platform || 'web',
        description: s.description || s.purpose || (requirements.filter(r => (s.requirementIds || []).includes(r.id)).map(r => r.description).join('\n')) || `Pantalla para ${s.name}`,
        purpose: s.purpose || s.description,
        components: (s.components || []).map(c => ({
          type: c.type,
          label: c.label,
          placeholder: c.placeholder
        })),
        actors: (project.actors || []).filter(a => (s.actorIds || []).includes(a.id)).map(a => a.name),
        requirements: requirements.filter(r => (s.requirementIds || []).includes(r.id)),
        selectedForGeneration: s.selectedForGeneration
      }));
    } else if (project.navigationNodes && project.navigationNodes.length > 0) {
      // 2. Usar nodos de navegación
      sourceScreens = project.navigationNodes.map(node => {
        const scrName = node.to || node.name || 'Pantalla';
        return {
          id: node.id,
          name: scrName,
          title: scrName,
          route: node.route || `/${scrName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          platform: node.platform === 'UNKNOWN' ? (project.platform || 'web') : node.platform,
          description: requirements.filter(r => (node.requirementIds || []).includes(r.id)).map(r => r.description).join('\n') || `Pantalla de navegación ${scrName}`,
          actors: (project.actors || []).filter(a => (node.actorIds || []).includes(a.id)).map(a => a.name),
          requirements: requirements.filter(r => (node.requirementIds || []).includes(r.id))
        };
      });
    }

    // 3. Fallback inteligente a requisitos clave si no hay pantallas aún
    if (sourceScreens.length === 0) {
      const topReqs = requirements.slice(0, 4);
      if (topReqs.length > 0) {
        sourceScreens = topReqs.map((req, idx) => ({
          id: `screen-req-${idx + 1}`,
          name: req.name || `Pantalla ${idx + 1}`,
          title: req.name || `Pantalla ${idx + 1}`,
          route: `/${(req.code || req.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          platform: project.platform || 'web',
          description: req.description || req.name,
          requirements: [req]
        }));
      } else {
        sourceScreens = [
          {
            id: 'screen-dashboard',
            name: 'Panel Principal',
            title: 'Panel Principal',
            route: '/dashboard',
            platform: project.platform || 'web',
            description: project.systemDescription || project.description || 'Vista principal del sistema'
          }
        ];
      }
    }

    // Filtrar si el usuario seleccionó pantallas específicas
    if (screenSelection && Array.isArray(screenSelection) && screenSelection.length > 0) {
      const selectedSet = new Set(screenSelection);
      const filtered = sourceScreens.filter(s => selectedSet.has(s.id) || selectedSet.has(s.name) || selectedSet.has(s.codeId));
      if (filtered.length > 0) {
        return filtered;
      }
    }

    return sourceScreens;
  }

  /**
   * Genera mockups con Google Stitch vía n8n webhook
   * @param {Object} project - Datos del proyecto
   * @param {string} prompt - Prompt adicional opcional
   * @param {Array<string>} screenSelection - Lista de IDs o nombres de pantallas seleccionadas
   */
  async generateMockup(project, prompt = '', screenSelection = null) {
    const relevantRequirements = this.selectRelevantRequirements(project.requirements || []);
    const screens = this.buildScreenPlan(project, relevantRequirements, screenSelection);

    if (screens.length === 0) {
      throw Object.assign(new Error('No hay pantallas seleccionadas para generar con Google Stitch.'), { statusCode: 400 });
    }

    const screenNames = screens.map(s => s.name).join(', ');

    const screenDetailsText = screens.map((scr, idx) => {
      const comps = (scr.components || []).map(c => `${c.type}${c.label ? ` ("${c.label}")` : ''}`).join(', ') || 'cabecera, área de datos/formulario, botones de acción';
      const actors = (scr.actors || []).join(', ') || 'Usuarios autorizados';
      const reqs = (scr.requirements || []).map(r => r.code || r.name).join(', ') || 'Requisitos del sistema';
      return `[PANTALLA ${idx + 1}: ${scr.name} (Ruta: ${scr.route || '/'})]\n  - Propósito: ${scr.description || scr.purpose || 'Operación del sistema'}\n  - Actores: ${actors}\n  - Requisitos asociados: ${reqs}\n  - Elementos y componentes: ${comps}`;
    }).join('\n\n');

    const structuredPrompt = [
      prompt || `Generar prototipo visual para ${project.name}`,
      `Generar exactamente ${screens.length} pantallas profesionales en Google Stitch: ${screenNames}.`,
      'Respetar estrictamente los nombres, rutas y propósitos de cada pantalla recibida.',
      'Usar los requisitos solo para definir contenido, campos, indicadores y acciones relevantes.',
      'Cada pantalla debe tener una jerarquía visual clara, navegación coherente y diseño responsivo.',
      '\n--- DETALLE DE CONTENIDO POR PANTALLA ---',
      screenDetailsText
    ].join('\n');

    // Formatear targetScreens exactamente con el contrato solicitado
    const targetScreens = screens.map((scr, idx) => {
      const formattedId = scr.codeId || (scr.id && scr.id.startsWith('SCR-') ? scr.id : `SCR-${String(idx + 1).padStart(2, '0')}`);
      const actors = (Array.isArray(scr.actors) && scr.actors.length > 0)
        ? scr.actors
        : ['Usuarios autorizados'];
      const reqs = Array.isArray(scr.requirements)
        ? scr.requirements.map(r => (typeof r === 'string' ? r : (r.code || r.name)))
        : [];

      return {
        id: formattedId,
        title: scr.title || scr.name,
        route: scr.route || `/${(scr.name || scr.title || `pantalla-${idx + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        description: scr.description || scr.purpose || `Visualizar y administrar la información completa de ${scr.name || scr.title}.`,
        actors,
        requirements: reqs
      };
    });

    const instructions = prompt || 'Quiero un estilo claro y no muy sobrecargado';
    const deviceType = (project.platform || 'DESKTOP').toUpperCase() === 'MOBILE' ? 'MOBILE' : 'DESKTOP';

    const webhookPayload = {
      projectName: project.name,
      deviceType,
      instructions,
      targetScreens,
      // Campos adicionales para compatibilidad total con cualquier nodo n8n
      projectId: project.id,
      screens: targetScreens,
      prompt: instructions
    };

    // Si N8N_MOCKUP_WEBHOOK está definido, delegar a Google Stitch en n8n
    if (env.N8N_MOCKUP_WEBHOOK && env.N8N_MOCKUP_WEBHOOK.trim().length > 0) {
      console.log(`[MockupService] Delegating mockup generation to Google Stitch n8n webhook: ${env.N8N_MOCKUP_WEBHOOK}`);
      console.log('[MockupService] Webhook Payload:', JSON.stringify(webhookPayload, null, 2));
      try {
        const response = await fetch(env.N8N_MOCKUP_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(env.N8N_TIMEOUT || 120000),
          body: JSON.stringify(webhookPayload)
        });

        if (response.ok) {
          const rawText = await response.text();
          let n8nResult;
          try {
            n8nResult = JSON.parse(rawText);
          } catch {
            // n8n respondió directamente con el código HTML en bruto (<!DOCTYPE html>...)
            n8nResult = rawText;
          }

          const normalized = await this.normalizeN8nResult(n8nResult, targetScreens);

          // Persistir pantallas generadas en PostgreSQL
          await this.persistGeneratedScreens(project.id, normalized.screens);

          return {
            provider: 'google-stitch-n8n',
            screens: normalized.screens,
            count: normalized.screens.length
          };
        } else {
          throw new Error(`Google Stitch / n8n devolvió un error HTTP ${response.status} (${response.statusText})`);
        }
      } catch (err) {
        if (err.name === 'TimeoutError' || err.code === 23 || err.message?.includes('timeout') || err.message?.includes('504')) {
          const timeoutErr = new Error('Google Stitch / n8n excedió el tiempo límite de espera (Timeout 504). El flujo de Stitch demoró más de lo esperado.');
          timeoutErr.statusCode = 504;
          timeoutErr.isTimeout = true;
          throw timeoutErr;
        }
        throw err;
      }
    }

    throw Object.assign(new Error('Configura N8N_MOCKUP_WEBHOOK en el archivo .env para generar con Google Stitch.'), { statusCode: 503 });
  }

  /**
   * Generación local interactiva inmediata (fallback de alta fidelidad)
   */
  async generateLocalMockups(project, screenSelection = null) {
    const relevantRequirements = this.selectRelevantRequirements(project.requirements || []);
    const screensToGenerate = this.buildScreenPlan(project, relevantRequirements, screenSelection);

    const generated = [];
    for (const scr of screensToGenerate) {
      const html = generateHtmlMockup(scr);
      generated.push({
        ...scr,
        html,
        htmlUrl: null
      });
    }

    await this.persistGeneratedScreens(project.id, generated);

    return {
      provider: 'local-interactive',
      screens: generated,
      count: generated.length
    };
  }

  async persistGeneratedScreens(projectId, screens = []) {
    for (const scr of screens) {
      try {
        const idConditions = [];
        if (scr.id) idConditions.push({ id: scr.id });
        if (scr.id && scr.id.startsWith('SCR-')) idConditions.push({ codeId: scr.id });
        if (scr.codeId) idConditions.push({ codeId: scr.codeId });
        if (scr.name) idConditions.push({ name: scr.name });
        if (scr.title) idConditions.push({ name: scr.title });
        if (scr.route) idConditions.push({ route: scr.route });

        let existing = null;
        if (idConditions.length > 0) {
          existing = await prisma.screen.findFirst({
            where: {
              projectId,
              OR: idConditions
            }
          });
        }

        if (existing) {
          await prisma.screen.update({
            where: { id: existing.id },
            data: {
              codeId: existing.codeId || scr.codeId || (scr.id?.startsWith('SCR-') ? scr.id : null),
              html: scr.html || existing.html,
              htmlUrl: scr.htmlUrl || existing.htmlUrl,
              reviewStatus: 'APPROVED',
              selectedForGeneration: true
            }
          });
        } else {
          await prisma.screen.create({
            data: {
              projectId,
              codeId: scr.codeId || (scr.id?.startsWith('SCR-') ? scr.id : null),
              name: scr.name || scr.title || 'Nueva Pantalla',
              route: scr.route || `/${(scr.name || scr.title || 'pantalla').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
              description: scr.description || 'Generado con Google Stitch',
              html: scr.html || null,
              htmlUrl: scr.htmlUrl || null,
              selectedForGeneration: true,
              reviewStatus: 'APPROVED'
            }
          });
        }
      } catch (e) {
        console.warn(`[MockupService] No se pudo persistir pantalla ${scr.name || scr.title || scr.id}:`, e.message);
      }
    }
  }

  async normalizeN8nResult(result, targetScreens = []) {
    let rawScreens = [];
    let payload = result;

    const extractHtmlMetadata = (html) => {
      if (typeof html !== 'string') return {};
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : null;
      if (title) {
        title = title.replace(/\s*[-–—|]\s*[A-Za-z0-9_-]+\s*$/i, '').trim(); // e.g. "Gestión de Clientes - cmstock" -> "Gestión de Clientes"
      }
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : null;
      return { title: title || h1 || 'Pantalla Generada', h1 };
    };

    // Caso 1: result es directamente un string con HTML (<!DOCTYPE html>...)
    if (typeof result === 'string') {
      const trimmed = result.trim();
      if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.includes('<body') || trimmed.includes('<div')) {
        const meta = extractHtmlMetadata(trimmed);
        const matchedTarget = targetScreens.find(t =>
          (t.title && meta.title && meta.title.toLowerCase().includes(t.title.toLowerCase())) ||
          (t.name && meta.title && meta.title.toLowerCase().includes(t.name.toLowerCase())) ||
          (t.title && meta.h1 && meta.h1.toLowerCase().includes(t.title.toLowerCase())) ||
          (t.name && meta.h1 && meta.h1.toLowerCase().includes(t.name.toLowerCase()))
        ) || targetScreens[0] || {};

        rawScreens = [{
          ...matchedTarget,
          name: matchedTarget.title || matchedTarget.name || meta.title,
          title: matchedTarget.title || matchedTarget.name || meta.title,
          html: trimmed
        }];
        payload = { screens: rawScreens };
      }
    } else if (Array.isArray(result)) {
      // Caso 2: Verificar si cada item del array contiene .screens (ej: [ { success: true, screens: [...] }, { success: true, screens: [...] } ])
      const hasScreensInItems = result.some(item =>
        (Array.isArray(item?.screens) && item.screens.length > 0) ||
        (Array.isArray(item?.targetScreens) && item.targetScreens.length > 0) ||
        (Array.isArray(item?.json?.screens) && item.json.screens.length > 0)
      );

      if (hasScreensInItems) {
        rawScreens = result.flatMap(item => {
          if (Array.isArray(item?.screens)) return item.screens;
          if (Array.isArray(item?.targetScreens)) return item.targetScreens;
          if (Array.isArray(item?.json?.screens)) return item.json.screens;
          if (Array.isArray(item?.json?.targetScreens)) return item.json.targetScreens;
          return [item];
        });
        payload = { screens: rawScreens };
      } else if (result.length > 0 && typeof result[0] === 'string') {
        rawScreens = result.map((htmlStr, idx) => {
          const meta = extractHtmlMetadata(htmlStr);
          const matchedTarget = targetScreens[idx] || {};
          return {
            ...matchedTarget,
            id: matchedTarget.id || `SCR-${String(idx + 1).padStart(2, '0')}`,
            name: matchedTarget.title || matchedTarget.name || meta.title,
            title: matchedTarget.title || matchedTarget.name || meta.title,
            html: htmlStr
          };
        });
        payload = { screens: rawScreens };
      } else if (result.length > 0 && result[0]?.json) {
        if (Array.isArray(result[0].json?.screens) || Array.isArray(result[0].json?.targetScreens)) {
          rawScreens = result[0].json.screens || result[0].json.targetScreens;
          payload = result[0].json;
        } else {
          // Cada item en la lista es una pantalla
          rawScreens = result.map(item => item.json);
          payload = { screens: rawScreens };
        }
      } else if (result.length > 0 && (result[0]?.html || result[0]?.htmlUrl || result[0]?.title || result[0]?.name || result[0]?.id || result[0]?.route || result[0]?.output || result[0]?.text || result[0]?.code)) {
        rawScreens = result;
        payload = { screens: rawScreens };
      } else {
        payload = result[0] || {};
        rawScreens = payload?.screens || payload?.data?.screens || payload?.targetScreens || payload?.data?.targetScreens || [];
      }
    } else if (result && typeof result === 'object') {
      // Caso 3: Objeto donde una propiedad contiene el HTML en bruto
      const possibleHtml = result.html || result.output || result.data || result.text || result.content || result.body || result.code;
      if (typeof possibleHtml === 'string' && (possibleHtml.trim().startsWith('<!DOCTYPE') || possibleHtml.trim().startsWith('<html') || possibleHtml.includes('<body'))) {
        const meta = extractHtmlMetadata(possibleHtml);
        let fileIndex = -1;
        const fileNumMatch = (result.fileName || result.filename || '').match(/screen-(\d+)/i);
        if (fileNumMatch) fileIndex = parseInt(fileNumMatch[1], 10) - 1;

        const matchedTarget = (fileIndex >= 0 && targetScreens[fileIndex])
          ? targetScreens[fileIndex]
          : targetScreens.find(t =>
              (t.title && meta.title && meta.title.toLowerCase().includes(t.title.toLowerCase())) ||
              (t.name && meta.title && meta.title.toLowerCase().includes(t.name.toLowerCase()))
            ) || targetScreens[0] || {};

        rawScreens = [{
          ...matchedTarget,
          fileName: result.fileName || result.filename,
          name: matchedTarget.title || matchedTarget.name || meta.title,
          title: matchedTarget.title || matchedTarget.name || meta.title,
          html: possibleHtml
        }];
        payload = { screens: rawScreens };
      } else {
        rawScreens = result?.screens || result?.data?.screens || result?.targetScreens || result?.data?.targetScreens || [];
      }
    }

    if (!Array.isArray(rawScreens) || rawScreens.length === 0) {
      console.warn('[MockupService] Inspeccionando respuesta no estructurada de n8n:', JSON.stringify(result)?.slice(0, 300));
      if (payload && (payload.html || payload.htmlUrl)) {
        rawScreens = [payload];
      } else {
        throw new Error('La respuesta de n8n no contiene pantallas válidas con HTML generado.');
      }
    }

    const normalizedScreens = await Promise.all(rawScreens.map(async (screen, index) => {
      const htmlUrl = screen.htmlUrl || screen.htmlCode?.downloadUrl || screen.url || null;
      let html = screen.html || screen.htmlCode?.code || screen.code || screen.output || screen.text || screen.content || screen.body || screen.data || null;

      // 1. Decodificar si el HTML viene en Base64
      if (typeof html === 'string' && !html.includes('<') && (html.startsWith('data:') || html.length > 50)) {
        try {
          const cleanBase64 = html.includes('base64,') ? html.split('base64,')[1] : html;
          const decoded = Buffer.from(cleanBase64, 'base64').toString('utf-8');
          if (decoded.includes('<html') || decoded.includes('<!DOCTYPE') || decoded.includes('<div')) {
            html = decoded;
          }
        } catch {
          // Mantener original
        }
      }

      if (!html && htmlUrl) {
        try {
          const htmlResponse = await fetch(htmlUrl);
          if (htmlResponse.ok) {
            html = await htmlResponse.text();
          }
        } catch (fetchErr) {
          console.warn(`[MockupService] Error descargando htmlUrl (${htmlUrl}):`, fetchErr.message);
        }
      }

      const meta = html ? extractHtmlMetadata(html) : {};

      // 2. Extraer índice desde fileName (ej: "screen-2.html" -> 2 -> targetScreens[1])
      let fileIndex = -1;
      const fileNameStr = screen.fileName || screen.filename || screen.name || '';
      const fileNumMatch = fileNameStr.match(/screen-(\d+)/i);
      if (fileNumMatch) {
        fileIndex = parseInt(fileNumMatch[1], 10) - 1;
      }

      // 3. Vincular con targetScreens:
      // Prioridad A: Coincidencia semántica con el título / h1 extraído del HTML
      const cleanNorm = (str) => (str || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

      const normTitle = cleanNorm(meta.title);
      const normH1 = cleanNorm(meta.h1);

      let targetMatch = targetScreens.find(t => {
        const normName = cleanNorm(t.name);
        const normTTitle = cleanNorm(t.title);
        const normRoute = cleanNorm(t.route);
        return (
          (normName && (normTitle.includes(normName) || normH1.includes(normName))) ||
          (normTTitle && (normTitle.includes(normTTitle) || normH1.includes(normTTitle))) ||
          (normRoute && normRoute.length > 4 && (normTitle.includes(normRoute) || normH1.includes(normRoute))) ||
          (normName.includes('registr') && (normTitle.includes('registr') || normH1.includes('registr'))) ||
          (normName.includes('detall') && (normTitle.includes('detall') || normH1.includes('detall'))) ||
          (normName.includes('client') && (normTitle.includes('client') || normH1.includes('client'))) ||
          (normName.includes('panel') && (normTitle.includes('panel') || normTitle.includes('dashboard'))) ||
          (normName.includes('login') && (normTitle.includes('login') || normTitle.includes('sesion')))
        );
      });

      // Prioridad B: Coincidencia por ID o código
      if (!targetMatch && screen.id) {
        targetMatch = targetScreens.find(t => t.id === screen.id || t.codeId === screen.id);
      }

      // Prioridad C: Por fileName (ej: screen-2.html -> targetScreens[1])
      if (!targetMatch && fileIndex >= 0 && targetScreens[fileIndex]) {
        targetMatch = targetScreens[fileIndex];
      }

      // Prioridad D: Por orden secuencial en el array
      if (!targetMatch) {
        targetMatch = targetScreens[index] || {};
      }

      const id = screen.id || targetMatch.id || screen.codeId || `SCR-${String(index + 1).padStart(2, '0')}`;
      const name = screen.name || screen.title || targetMatch.title || targetMatch.name || meta.title || `Pantalla ${index + 1}`;
      const route = screen.route || targetMatch.route || `/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;

      return {
        ...targetMatch,
        ...screen,
        id,
        codeId: screen.codeId || targetMatch.id || (id.startsWith('SCR-') ? id : null),
        name,
        title: name,
        route,
        html,
        htmlUrl
      };
    }));

    return {
      ...payload,
      screens: normalizedScreens
    };
  }
}

module.exports = new MockupService();
