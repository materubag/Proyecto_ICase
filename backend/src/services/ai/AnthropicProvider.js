const AIProvider = require('./AIProvider');
const env = require('../../config/env');

/**
 * Proveedor Nativo para Anthropic (Claude 3.5 Sonnet / Haiku)
 * Implementa llamadas nativas fetch a la API oficial v1/messages
 */
class AnthropicProvider extends AIProvider {
  constructor() {
    super();
    this.apiKey = env.ANTHROPIC_API_KEY;
    this.model = env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    this.endpoint = 'https://api.anthropic.com/v1/messages';
  }

  /**
   * Ejecuta un prompt libre y devuelve el resultado parseado como JSON o texto
   */
  async executePrompt({ system, prompt, maxTokens = 4096, model = null, images = [] }) {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error('El proveedor Anthropic no está configurado (ANTHROPIC_API_KEY no definida en el archivo .env).');
    }

    const selectedModel = model || this.model;
    const bodyPayload = {
      model: selectedModel,
      max_tokens: maxTokens,
      system: system || 'Eres un arquitecto de software de alto nivel. Responde ÚNICAMENTE en JSON válido sin explicaciones adicionales.',
      messages: [
        { role: 'user', content: images.length ? [
          ...images.map(image => ({type:'image',source:{type:'base64',media_type:image.mediaType,data:image.data}})),
          {type:'text',text:typeof prompt === 'string' ? prompt : JSON.stringify(prompt)}
        ] : typeof prompt === 'string' ? prompt : JSON.stringify(prompt) }
      ]
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(120000),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(bodyPayload)
    });

    if (!response.ok) {
      let errText = '';
      try { errText = typeof response.text === 'function' ? await response.text() : ''; } catch (e) {}
      throw new Error(`Anthropic HTTP ${response.status}; modelo: ${selectedModel}; detalle: ${errText.slice(0, 300)}`);
    }

    const result = await response.json();
    if (result.stop_reason !== 'end_turn') throw Object.assign(new Error('Respuesta Sonnet incompleta'), { usage: result.usage });
    const rawContent = (result.content || []).filter(c => c.type === 'text').map(c => c.text).join('');

    // Extracción limpia de JSON si viene envuelto en markdown
    let cleanJson = rawContent.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const match = cleanJson.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) {
      throw Object.assign(new Error('Anthropic no devolvió un JSON reconocible en su respuesta'), {
        raw: rawContent,
        usage: result.usage
      });
    }

    try {
      const parsedData = JSON.parse(match[0]);
      return {
        data: parsedData,
        usage: result.usage,
        model: selectedModel
      };
    } catch (parseError) {
      throw Object.assign(new Error(`Error al parsear JSON devuelto por Claude: ${parseError.message}`), {
        raw: match[0],
        usage: result.usage
      });
    }
  }

  /**
   * Implementación de extracción de documentos por lotes (análisis de requerimientos y actores)
   */
  async extractDocumentBatch(input, options = {}) {
    const system = options.prompt || require('../analysis/extractionContract').prompt;
    const prompt = JSON.stringify(input);
    const result = await this.executePrompt({
      system,
      prompt,
      maxTokens: options.max_tokens || 4096,
      model: options.model || this.model
    });
    return result;
  }

  /**
   * Estructura completa de análisis de proyecto bajo la norma ISO/IEC/IEEE 29148:2018
   */
  async analyzeProject(input) {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error('El proveedor Anthropic no está configurado (ANTHROPIC_API_KEY no definida en el archivo .env).');
    }

    const systemPrompt = `Eres un arquitecto de software senior ICASE. Analiza la especificación bajo la norma ISO/IEC/IEEE 29148:2018.
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
- Asigna obligatoriamente cada requisito a su actor responsable en "actorIds".
- No agregues texto explicativo fuera del bloque JSON.`;

    const cleanDescription = (input.description || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .slice(0, 12000);

    const userMessage = input.customPrompt || `Proyecto: ${input.name}\nEspecificación:\n${cleanDescription}`;

    const { data } = await this.executePrompt({
      system: systemPrompt,
      prompt: userMessage,
      maxTokens: 5000,
      model: this.model
    });

    return data;
  }

  async analyze(description, context = {}) {
    return this.analyzeProject({
      name: context.name,
      description,
      context
    });
  }
}

module.exports = AnthropicProvider;

