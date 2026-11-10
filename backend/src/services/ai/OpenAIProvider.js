const AIProvider = require('./AIProvider');
const env = require('../../config/env');

class OpenAIProvider extends AIProvider {
  // Responses API avoids temperature and legacy max_tokens for reasoning models.
  async executePrompt({ system, prompt, model, maxTokens = 8192 }) {
    if (!env.OPENAI_API_KEY) throw new Error('OpenAI no configurado');
    if (!model) throw new Error('Modelo Luna no configurado');
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', signal: AbortSignal.timeout(120000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model, instructions: system, input: JSON.stringify(prompt),
        max_output_tokens: maxTokens, store: false, text: { format: { type: 'json_object' } },
        ...(env.DOCUMENT_REASONING_EFFORT ? { reasoning: { effort: env.DOCUMENT_REASONING_EFFORT } } : {}) })
    });
    if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}: ${(await response.text()).slice(0, 250)}`);
    const result = await response.json();
    try {
      if (result.status !== 'completed') throw new Error('Respuesta OpenAI incompleta');
      const content = result.output?.flatMap(o => o.content || []).filter(o => o.type === 'output_text').map(o => o.text).join('');
      return { data: JSON.parse(content), usage: result.usage, model: result.model || model };
    } catch (e) { e.usage = result.usage; throw e; }
  }
  async extractDocumentBatch(input, options = {}) {
    if (!env.OPENAI_API_KEY) throw new Error('OpenAI no configurado');
    const model = options.model || env.OPENAI_MODEL || 'gpt-5.6-luna';
    const reasoningEffort = options.reasoning_effort || env.OPENAI_REASONING_EFFORT;

    const bodyPayload = {
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: options.prompt || require('../analysis/extractionContract').prompt },
        { role: 'user', content: JSON.stringify(input) }
      ],
      ...(reasoningEffort && (model.startsWith('o1') || model.startsWith('o3')) ? { reasoning_effort: reasoningEffort } : {})
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(120000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify(bodyPayload)
    });

    if (!response.ok) {
      let errText = '';
      try { errText = typeof response.text === 'function' ? await response.text() : ''; } catch (e) {}
      throw new Error(`OpenAI HTTP ${response.status}; modelo solicitado: ${model}${errText ? `; detalle: ${errText.slice(0, 300)}` : ''}`);
    }
    const result = await response.json();
    const choice = result.choices?.[0];
    if (choice?.finish_reason !== 'stop') throw Object.assign(new Error(`OpenAI respuesta incompleta: ${choice?.finish_reason}`), { usage: result.usage });
    try { return { data: JSON.parse(choice.message.content), usage: result.usage, model }; }
    catch (error) { error.usage = result.usage; throw error; }
  }
  /**
   * Structure prepared for OpenAI chat completions API with JSON Mode.
   * Optimized for ISO/IEC/IEEE 29148:2018 and minimum token consumption.
   * @param {Object} input - { projectId, name, description, context }
   */
  async analyzeProject(input) {
    if (!env.OPENAI_API_KEY) {
      throw new Error('El proveedor OpenAI no está configurado (OPENAI_API_KEY no definida en el archivo .env).');
    }

    const model = env.OPENAI_MODEL || 'gpt6-luna';
    const reasoningEffort = env.OPENAI_REASONING_EFFORT;
    const endpoint = 'https://api.openai.com/v1/chat/completions';

    // Prompt hiper-optimizado en tokens bajo ISO/IEC/IEEE 29148:2018
    const systemPrompt = `Eres un arquitecto de software ICASE. Analiza la especificación bajo la norma ISO/IEC/IEEE 29148:2018.
Genera un JSON conciso con las siguientes claves:
{
  "project": { "name": string, "description": string },
  "actors": [{ "id": "ACT-01", "name": string, "description": string }],
  "requirements": [
    {
      "code": "RF-01" o "RNF-01",
      "name": string,
      "description": "El sistema debe... (sintaxis ISO 29148, medible y verificable)",
      "type": "FUNCTIONAL" | "NON_FUNCTIONAL",
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "actorIds": ["ACT-01"],
      "dependencies": ["RF-01"],
      "preconditions": string,
      "postconditions": string
    }
  ],
  "entities": [{ "id": "ENT-01", "name": string, "attributes": [{ "name": string, "type": string }] }],
  "relationships": [{ "source": string, "target": string, "cardinality": "1:N" | "1:1" | "N:M" }],
  "screens": [{ "id": "SCR-01", "name": string, "route": "/ruta", "purpose": string, "requirementIds": ["RF-01"], "actorIds": ["ACT-01"] }],
  "navigation": [{ "from": "NombrePantallaOrigen", "to": "NombrePantallaDestino", "action": string }],
  "architecture": { "style": string, "frontend": string, "backend": string, "database": string }
}
Reglas:
- Requisitos atómicos, verificables, sin ambigüedades.
- DEBES incluir obligatoriamente tanto Requisitos Funcionales (códigos "RF-01", "RF-02"... con type "FUNCTIONAL") como Requisitos No Funcionales (códigos "RNF-01", "RNF-02"... con type "NON_FUNCTIONAL", cubriendo áreas como rendimiento, seguridad, disponibilidad, respaldo e integridad).
- Toda pantalla mencionada en "navigation" ('from' y 'to') DEBE estar declarada en el arreglo "screens" y su valor DEBE ser el campo "name" exacto de la pantalla (ej: "Inicio de Sesión", "Panel Principal", "Catálogo"). No uses rutas "/..." en "from" ni en "to".
- No agregues texto fuera del JSON.`;

    // Compactar descripción para no desperdiciar tokens
    const cleanDescription = (input.description || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .slice(0, 8000); // Límite de seguridad de tokens

    const userMessage = `Proyecto: ${input.name}\nEspecificación:\n${cleanDescription}`;

    async function sendRequest(modelName) {
      return await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: modelName,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: input.customPrompt || userMessage }
          ],
          ...(reasoningEffort && (model.startsWith('o1') || model.startsWith('o3')) ? { reasoning_effort: reasoningEffort } : {})
        })
      });
    }

    try {
      let response = await sendRequest(model);

      // Si el modelo específico (e.g. gpt-5.4-nano) no está disponible en la cuenta, fallback inmediato a gpt-4o-mini
      if (!response.ok && (response.status === 404 || response.status === 400)) {
        console.warn(`[OpenAIProvider] Modelo ${model} no disponible (HTTP ${response.status}). Reintentando con gpt-4o-mini...`);
        response = await sendRequest('gpt-4o-mini');
      }

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`OpenAI API respondió con HTTP ${response.status}: ${errBody}`);
      }

      const resJson = await response.json();
      const content = resJson.choices?.[0]?.message?.content;
      return JSON.parse(content);
    } catch (err) {
      throw new Error(`Error en el proveedor OpenAI: ${err.message}`);
    }
  }

  async analyze(description, context = {}) {
    return this.analyzeProject({
      name: context.name,
      description,
      context
    });
  }
}

module.exports = OpenAIProvider;
