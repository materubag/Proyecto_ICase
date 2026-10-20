const env = require('../../config/env');
const MockMockupProvider = require('./mock.mockup.provider');

class MockupService {
  constructor() {
    this.mockProvider = new MockMockupProvider();
  }

  selectRelevantRequirements(requirements = []) {
    const priorityWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const typeWeight = { FUNCTIONAL: 2, NON_FUNCTIONAL: 1 };
    const statusWeight = { APPROVED: 2, PENDING: 1, IMPLEMENTED: 1, DISCARDED: 0 };
    const limit = Math.max(1, env.MOCKUP_MAX_REQUIREMENTS || 12);

    return requirements
      .filter((requirement) => requirement.status === 'APPROVED')
      .sort((first, second) => {
        const firstScore =
          (priorityWeight[first.priority] || 0) * 10 +
          (typeWeight[first.type] || 0) * 3 +
          (statusWeight[first.status] || 0);
        const secondScore =
          (priorityWeight[second.priority] || 0) * 10 +
          (typeWeight[second.type] || 0) * 3 +
          (statusWeight[second.status] || 0);
        return secondScore - firstScore;
      })
      .slice(0, requirements.length)
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

  buildScreenPlan(project, requirements) {
    return (project.navigationNodes || []).map(node => ({
      id: node.id, name: node.name, title: node.name, route: node.route,
      deviceType: (node.platform === 'MOBILE' ? 'MOBILE' : 'DESKTOP'),
      platform: node.platform === 'UNKNOWN' ? project.platform : node.platform,
      description: requirements.filter(r => node.requirementIds.includes(r.id)).map(r => r.description).join('\n'),
      actors: (project.actors || []).filter(a => node.actorIds.includes(a.id)).map(a => a.name),
      requirements: requirements.filter(r => node.requirementIds.includes(r.id))
    }));
  }

  /**
   * Generates mockups either via n8n webhook (if configured) or via MockMockupProvider
   * @param {Object} project - Project data
   * @param {string} prompt - Optional prompt or focus for the mockup
   */
  async generateLocalMockups(project) {
    const { generateHtmlMockup } = require('./mockupGenerator');
    const requirements = this.selectRelevantRequirements(project.requirements || []);
    const screens = this.buildScreenPlan(project, requirements).map(screen => ({
      ...screen,
      components: [
        { type: 'heading', label: screen.name, description: screen.description }
      ]
    }));
    return {
      provider: 'local-interactive',
      screens: screens.map(screen => ({ ...screen, html: generateHtmlMockup(screen) })),
      count: screens.length
    };
  }

  async generateMockup(project, prompt = '') {
    const relevantRequirements = this.selectRelevantRequirements(project.requirements);
    const screens = this.buildScreenPlan(project, relevantRequirements);
    const structuredPrompt = [
      prompt,
      `Generar exactamente ${screens.length} pantallas profesionales y minimalistas para ${project.name}.`,
      '1. DISEÑO MINIMALISTA: Interfaz limpia, espacios despejados, sin sobrecarga visual ni componentes saturados.',
      '2. ESTRICTAMENTE EN ESPAÑOL: Todo el contenido, botones, campos, títulos, tablas y placeholders deben estar 100% en español.',
      '3. CERO SOBRECARGA VISUAL: Formularios concretos con solo los campos indispensables. Máximo 1 acción principal clara por vista. Tablas concisas y legibles.',
      '4. COHERENCIA DE DATOS ENTRE PANTALLAS: Los datos de ejemplo (identificadores, códigos de órdenes, nombres de clientes, estados y roles) deben ser consistentes y coordinados en todas las pantallas.',
      '5. Respetar estrictamente los nombres y rutas de screens recibidos.'
    ].join('\n');

    // 1. Conexión DIRECTA con Google Stitch API (Sin intermediarios de n8n ni ngrok)
    const mockupProvider = (env.MOCKUP_PROVIDER || 'stitch').toLowerCase();
    if (mockupProvider === 'stitch' && env.GOOGLE_STITCH_API_KEY) {
      try {
        console.log(`[MockupService] Iniciando generación directa con Google Stitch API (MCP)...`);
        const stitchService = require('./GoogleStitchService');
        return await stitchService.generateMockups(project, screens, relevantRequirements, prompt);
      } catch (stitchErr) {
        console.warn(`[MockupService] Error en Google Stitch directo (${stitchErr.message}). Activando respaldo de IA...`);
      }
    }

    // 2. Si N8N_MOCKUP_WEBHOOK está definido y se configuró como proveedor, intentar delegar al flujo n8n
    if (mockupProvider === 'n8n' && env.N8N_MOCKUP_WEBHOOK && env.N8N_MOCKUP_WEBHOOK.trim().length > 0) {
      console.log(`[MockupService] Delegating mockup generation to n8n webhook: ${env.N8N_MOCKUP_WEBHOOK}`);
      try {
        const response = await fetch(env.N8N_MOCKUP_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(env.N8N_TIMEOUT || 900000),
          body: JSON.stringify({
            projectId: project.id,
            projectName: project.name,
            platform: project.platform,
            actors: project.actors,
            useCases: project.useCases,
            requirements: relevantRequirements,
            requirementsTotal: (project.requirements || []).length,
            screens,
            targetScreens: screens,
            deviceType: project.platform === 'MOBILE' ? 'MOBILE' : 'DESKTOP',
            instructions: structuredPrompt,
            prompt: structuredPrompt
          })
        });

        if (response.ok) {
          const n8nResult = await response.json();
          return {
            provider: 'n8n-webhook',
            ...await this.normalizeN8nResult(n8nResult, screens)
          };
        } else {
          console.warn(`[MockupService] n8n retornó HTTP ${response.status}. Usando generador inteligente de IA...`);
        }
      } catch (err) {
        console.warn(`[MockupService] Error contactando n8n webhook (${err.message}). Usando generador inteligente de IA...`);
      }
    }

    // 3. Generación asistida por IA derivada de los requisitos aprobados (OpenAI o Gemini)
    return this.generateWithAI(project, screens, relevantRequirements, prompt);
  }

  /**
   * Generación de mockups asistida por IA (OpenAI o Gemini) con enfoque minimalista y en español.
   */
  async generateWithAI(project, screens, requirements, prompt = '') {
    const { generateHtmlMockup } = require('./mockupGenerator');
    const providerName = (env.AI_PROVIDER || 'openai').toLowerCase();

    const actorsList = (project.actors || []).map(a => a.name).join(', ') || 'Usuarios del sistema';

    const promptText = `Eres un diseñador UX/UI de software empresarial enfocado en interfaces minimalistas y modernas.
Genera prototipos visuales limpios, elegantes y minimalistas para las siguientes ${screens.length} pantallas del sistema "${project.name}":

ACTORES Y ROLES DEL SISTEMA:
${actorsList}

PANTALLAS A GENERAR:
${screens.map((s, i) => `PANTALLA ${i + 1}:
- ID: "${s.id}"
- Nombre: "${s.name}"
- Ruta: "${s.route}"
- Requisitos cubiertos:
${(s.requirements || []).map(r => `  * [${r.code}] ${r.name || r.description}`).join('\n') || '  * Operaciones del módulo'}
`).join('\n')}

REGLAS ESTRICTAS DE DISEÑO:
1. MINIMALISMO ABSOLUTO: Diseño despejado, espaciado generoso, sin saturación visual ni elementos innecesarios.
2. 100% EN ESPAÑOL: Todos los textos, botones, etiquetas, encabezados, tablas y estados deben estar exclusivamente en español (sin anglicismos).
3. CERO SOBRECARGA: 
   - Formularios limpios con solo 2 a 4 campos indispensables.
   - Máximo 1 botón de acción principal ("Guardar", "Registrar", "Confirmar") y 1 secundario ("Cancelar" o "Limpiar").
   - Tablas concisas de 3 a 5 columnas con 2 a 3 filas de datos representativos.
4. COHERENCIA DE DATOS: Los identificadores (ej: "ORD-001", "CLI-101"), nombres de personas, estados ("Completado", "En Proceso", "Pendiente") y fechas deben guardar perfecta coherencia entre todas las pantallas del sistema.
5. Mantén exactamente los IDs, nombres y rutas recibidos.

Devuelve ÚNICAMENTE un JSON válido con esta estructura:
{
  "screens": [
    {
      "id": "identificador_recibido",
      "name": "nombre_recibido",
      "route": "ruta_recibida",
      "description": "descripción concreta y breve",
      "components": [
        { "type": "navbar", "label": "Nombre del Módulo" },
        { "type": "heading", "label": "Título de la Pantalla", "description": "Breve explicación" },
        { "type": "card", "label": "Resumen Clave", "description": "Métricas o estado principal" },
        { "type": "form", "label": "Registro de Datos", "meta": { "fields": [{ "label": "Campo", "type": "text", "placeholder": "Ejemplo..." }] } },
        { "type": "table", "label": "Listado Principal", "meta": { "headers": ["Código", "Concepto", "Estado"], "rows": [["001", "Dato coherente", "Completado"]] } }
      ]
    }
  ]
}`;

    let generatedScreens = [];

    // Intento con OpenAI si está configurado
    if (providerName === 'openai' && env.OPENAI_API_KEY) {
      try {
        const OpenAIProvider = require('../ai/OpenAIProvider');
        const openai = new OpenAIProvider();
        const aiResponse = await openai.extractDocumentBatch(
          { screens, project: { name: project.name, actors: project.actors } },
          { prompt: promptText }
        );
        const data = aiResponse?.data;
        generatedScreens = Array.isArray(data) ? data : (data?.screens || data?.data?.screens || []);
      } catch (openAiErr) {
        console.warn('[MockupService] Error en llamada OpenAI para mockups:', openAiErr.message);
      }
    }

    // Fallback o elección directa Gemini
    if (generatedScreens.length === 0 && (providerName === 'gemini' || env.GEMINI_API_KEY)) {
      try {
        const GeminiProvider = require('../ai/GeminiProvider');
        const gemini = new GeminiProvider();
        const payload = {
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 8192,
            temperature: 0.1
          }
        };
        const rawText = await gemini.callGeminiApi(payload);
        const parsed = gemini.parseOrRepairJson(rawText);
        generatedScreens = Array.isArray(parsed) ? parsed : (parsed.screens || parsed.data?.screens || []);
      } catch (geminiErr) {
        console.warn('[MockupService] Error en llamada Gemini para mockups:', geminiErr.message);
      }
    }

    const finalScreens = screens.map((requested, idx) => {
      const found = generatedScreens.find(s => s.id === requested.id || s.route === requested.route || s.name === requested.name) || generatedScreens[idx];
      const components = (found?.components && found.components.length > 0) ? found.components : [
        { type: 'navbar', label: `${project.name} - ${requested.name}` },
        { type: 'heading', label: requested.name, description: requested.description },
        { type: 'card', label: requested.name, description: `Operación principal respaldada por los requisitos funcionales del sistema.` },
        { type: 'form', label: `Datos de Registro`, meta: { fields: [{ label: 'Código / Identificador', type: 'text', placeholder: 'Ej: REG-001' }, { label: 'Descripción', type: 'text', placeholder: 'Detalle...' }] } },
        { type: 'table', label: `Registros Activos`, meta: { headers: ['Código', 'Concepto', 'Responsable', 'Estado'], rows: [['REG-001', 'Atención registrada', 'Administrador', 'Completado'], ['REG-002', 'En revisión', 'Recepción', 'En Proceso']] } }
      ];

      const screenObj = {
        id: requested.id,
        name: requested.name,
        route: requested.route,
        description: requested.description || found?.description,
        components,
        layout: { type: 'grid' }
      };

      screenObj.html = generateHtmlMockup(screenObj);
      return screenObj;
    });

    return {
      provider: `${providerName}-intelligent`,
      success: true,
      screens: finalScreens
    };
  }

  async normalizeN8nResult(result, requestedScreens = []) {
    const payload = Array.isArray(result) ? result[0] : result;
    const screens = payload?.screens || payload?.data?.screens || [];

    if (!Array.isArray(screens)) {
      throw new Error('La respuesta de n8n no contiene un array screens.');
    }

    const seen=new Set();
    const normalizedScreens = await Promise.all(screens.map(async (screen, index) => {
      const identity=screen.sourceScreenId || screen.navigationNodeId || screen.id || screen.screenId;
      let requested=requestedScreens.find(s=>s.id===identity) || requestedScreens.find(s=>s.route&&s.route===screen.route) || requestedScreens.find(s=>s.name===(screen.name||screen.screenName||screen.title));
      // Legacy workflow emits one ordered screen-N.html per selected screen.
      // Use this contract only when the response is complete and indices are unique.
      if(!requested && !identity && !screen.route && !screen.name && !screen.screenName && !screen.title) {
        const legacyIndex=screen.fileName?.match(/^screen-([1-9][0-9]*)\.html$/i);
        const indices=screens.map(s=>s.fileName?.match(/^screen-([1-9][0-9]*)\.html$/i)?.[1]);
        const complete=screens.length===requestedScreens.length && indices.every(n=>n&&Number(n)<=requestedScreens.length) && new Set(indices).size===indices.length;
        if(legacyIndex && complete) requested=requestedScreens[Number(legacyIndex[1])-1];
      }
      if(requestedScreens.length && !requested)throw new Error('n8n devolvio una pantalla sin identificador original; conserva sourceScreenId y route en el workflow.');
      if(requested){if(seen.has(requested.id))throw new Error('n8n devolvio pantallas duplicadas.');seen.add(requested.id);}
      const htmlUrl = screen.htmlUrl || screen.htmlCode?.downloadUrl || null;
      let html = screen.html || null;

      if (!html && htmlUrl) {
        const htmlResponse = await fetch(htmlUrl);
        if (htmlResponse.ok) {
          html = await htmlResponse.text();
        }
      }

      return {
        ...screen,
        id: requested?.id || screen.id || screen.screenName || `n8n-screen-${index + 1}`,
        name: requested?.name || screen.name || screen.screenName || screen.title || `Pantalla ${index + 1}`,
        route: requested?.route || screen.route || `/${(screen.name || screen.screenName || `screen-${index + 1}`)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')}`,
        html,
        htmlUrl
      };
    }));

    if(requestedScreens.some(screen=>!seen.has(screen.id)))throw new Error('n8n no devolvio todas las pantallas seleccionadas.');
    return {
      ...payload,
      screens: normalizedScreens
    };
  }
}

module.exports = new MockupService();
