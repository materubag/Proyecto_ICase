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

  buildScreenPlan(project, requirements) {
    return (project.navigationNodes || []).map(node => ({
      name: node.name, title: node.name, route: node.route,
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
  async generateMockup(project, prompt = '') {
    const relevantRequirements = this.selectRelevantRequirements(project.requirements);
    const screens = this.buildScreenPlan(project, relevantRequirements);
    const structuredPrompt = [
      prompt,
      `Generar exactamente ${screens.length} pantallas profesionales para ${project.name}.`,
      'Respetar estrictamente los nombres y objetivos de screens recibidos.',
      'No agregar login, dashboard ni otros flujos sin requisitos aprobados.',
      'No generar pantallas absurdas, genericas, de configuracion o de contenido inventado.',
      'Usar los requisitos solo para definir contenido, campos, indicadores y acciones relevantes.',
      'Cada pantalla debe tener una jerarquia visual clara, navegacion coherente y datos de ejemplo realistas.'
    ].join('\n');

    // Si N8N_MOCKUP_WEBHOOK está definido, intentar delegar al flujo n8n
    if (env.N8N_MOCKUP_WEBHOOK && env.N8N_MOCKUP_WEBHOOK.trim().length > 0) {
      console.log(`[MockupService] Delegating mockup generation to n8n webhook: ${env.N8N_MOCKUP_WEBHOOK}`);
      try {
        const response = await fetch(env.N8N_MOCKUP_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(env.N8N_TIMEOUT),
          body: JSON.stringify({
            projectId: project.id,
            projectName: project.name,
            platform: project.platform,
            actors: project.actors,
            useCases: project.useCases,
            requirements: relevantRequirements,
            requirementsTotal: (project.requirements || []).length,
            screens,
            prompt: structuredPrompt
          })
        });

        if (response.ok) {
          const n8nResult = await response.json();
          return {
            provider: 'n8n-webhook',
            ...await this.normalizeN8nResult(n8nResult)
          };
        } else {
          throw new Error('n8n no pudo generar el mockup. HTTP ' + response.status);
        }
      } catch (err) {
        throw err;
      }
    }

    // Missing external workflow is an explicit error, never synthetic official content.
    throw Object.assign(new Error('Configura N8N_MOCKUP_WEBHOOK para generar mockups.'), { statusCode: 503 });
  }

  async normalizeN8nResult(result) {
    const payload = Array.isArray(result) ? result[0] : result;
    const screens = payload?.screens || payload?.data?.screens || [];

    if (!Array.isArray(screens)) {
      throw new Error('La respuesta de n8n no contiene un array screens.');
    }

    const normalizedScreens = await Promise.all(screens.map(async (screen, index) => {
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
        id: screen.id || screen.screenName || `n8n-screen-${index + 1}`,
        name: screen.name || screen.screenName || screen.title || `Pantalla ${index + 1}`,
        route: screen.route || `/${(screen.name || screen.screenName || `screen-${index + 1}`)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')}`,
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
