const AIProvider = require('./AIProvider');
const env = require('../../config/env');

class GeminiProvider extends AIProvider {
  constructor() {
    super();
    this.model = env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    this.apiKey = env.GEMINI_API_KEY || '';
    this.maxOutputTokens = env.GEMINI_MAX_OUTPUT_TOKENS || 384;
    this.temperature = env.GEMINI_TEMPERATURE ?? 0;
    this.thinkingLevel = env.GEMINI_THINKING_LEVEL || 'minimal';
    this.minRequestIntervalMs = env.GEMINI_MIN_REQUEST_INTERVAL_MS || 6000;
    this.lastRequestTimestamp = 0;
  }

  getEndpoint() {
    const key = this.apiKey || env.GEMINI_API_KEY;
    const model = this.model || env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  }

  /**
   * Respetar intervalo mínimo entre peticiones para no saturar RPM.
   */
  async throttle() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTimestamp;
    if (elapsed < this.minRequestIntervalMs && this.lastRequestTimestamp > 0) {
      const waitTime = this.minRequestIntervalMs - elapsed;
      await new Promise(r => setTimeout(r, waitTime));
    }
    this.lastRequestTimestamp = Date.now();
  }

  /**
   * Envía solicitud a la API de Gemini con manejo de cuota / 429 (máximo 1 reintento controlado).
   */
  async callGeminiApi(payload, retryCount = 0) {
    if (!this.apiKey && !env.GEMINI_API_KEY) {
      const error = new Error('El proveedor Gemini no está configurado (GEMINI_API_KEY no definida en variables de entorno).');
      error.statusCode = 503;
      error.code = 'GEMINI_NOT_CONFIGURED';
      throw error;
    }

    await this.throttle();
    const endpoint = this.getEndpoint();

    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (networkErr) {
      const error = new Error(`Error de conexión con la API de Google Gemini: ${networkErr.message}`);
      error.statusCode = 503;
      throw error;
    }

    // Manejo de cuota / 429
    if (response.status === 429) {
      console.warn('[GeminiProvider] HTTP 429 Too Many Requests recibido de Gemini.');
      if (retryCount === 0) {
        let retryAfterMs = 4000;
        const retryHeader = response.headers.get('retry-after');
        if (retryHeader) {
          const parsedSec = parseInt(retryHeader, 10);
          if (!isNaN(parsedSec)) retryAfterMs = Math.min(parsedSec * 1000, 10000);
        }
        console.log(`[GeminiProvider] Esperando ${retryAfterMs}ms antes del único reintento permitido...`);
        await new Promise(r => setTimeout(r, retryAfterMs));
        return this.callGeminiApi(payload, 1);
      }
      const quotaErr = new Error('Cuota de Gemini temporalmente agotada (HTTP 429). Se mantendrán los resultados deterministas.');
      quotaErr.statusCode = 429;
      quotaErr.code = 'QUOTA_EXHAUSTED';
      throw quotaErr;
    }

    // Si responde 400 por thinkingConfig no soportado en algún submodelo, reintentar sin thinkingConfig
    if (!response.ok && response.status === 400 && payload.generationConfig?.thinkingConfig) {
      console.warn('[GeminiProvider] API retornó 400 con thinkingConfig. Reintentando sin thinkingConfig...');
      const fallbackPayload = {
        ...payload,
        generationConfig: {
          ...payload.generationConfig,
          thinkingConfig: undefined
        }
      };
      return this.callGeminiApi(fallbackPayload, retryCount + 1);
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      const err = new Error(`Gemini API respondió con HTTP ${response.status}: ${errBody.slice(0, 300)}`);
      err.statusCode = response.status;
      throw err;
    }

    const resJson = await response.json();
    const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('La respuesta de Gemini no contuvo texto válido en parts[0].text.');
    }

    return rawText;
  }

  /**
   * Intenta parsear JSON y repara truncamientos si la respuesta fue cortada por límite de tokens.
   */
  parseOrRepairJson(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;
    let text = rawText.trim();

    // 1. Quitar markdown code blocks si existen
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      text = codeBlockMatch[1].trim();
    }

    // 2. Intento directo
    try {
      return JSON.parse(text);
    } catch {
      // Intentar delimitar bloque JSON
      const match = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {}
      }

      // 3. Reparación de JSON truncado (por token limit)
      try {
        let repaired = text;
        // Balancear comillas
        let inString = false;
        let escaped = false;
        for (let i = 0; i < repaired.length; i++) {
          const char = repaired[i];
          if (char === '\\' && !escaped) {
            escaped = true;
            continue;
          }
          if (char === '"' && !escaped) {
            inString = !inString;
          }
          escaped = false;
        }
        if (inString) repaired += '"';

        // Remover claves incompletas al final (ej: , "key": o ,)
        repaired = repaired.replace(/,\s*"?[^":,\{\}\[\]]*"?\s*:\s*"?[^",\{\}\[\]]*"?$/, '');
        repaired = repaired.replace(/,\s*$/, '');

        // Balancear llaves y corchetes abiertos
        const stack = [];
        inString = false;
        escaped = false;
        for (let i = 0; i < repaired.length; i++) {
          const char = repaired[i];
          if (char === '\\' && !escaped) {
            escaped = true;
            continue;
          }
          if (char === '"' && !escaped) {
            inString = !inString;
          }
          if (!inString) {
            if (char === '{' || char === '[') stack.push(char);
            else if (char === '}' && stack[stack.length - 1] === '{') stack.pop();
            else if (char === ']' && stack[stack.length - 1] === '[') stack.pop();
          }
          escaped = false;
        }

        while (stack.length > 0) {
          const open = stack.pop();
          if (open === '{') repaired += '}';
          else if (open === '[') repaired += ']';
        }

        return JSON.parse(repaired);
      } catch {
        // Último intento: recortar hasta la última coma válida y cerrar estructuras
        const lastComma = text.lastIndexOf(',');
        if (lastComma > 0) {
          try {
            let fallback = text.slice(0, lastComma);
            const stack = [];
            for (let i = 0; i < fallback.length; i++) {
              const char = fallback[i];
              if (char === '{' || char === '[') stack.push(char);
              else if (char === '}' && stack[stack.length - 1] === '{') stack.pop();
              else if (char === ']' && stack[stack.length - 1] === '[') stack.pop();
            }
            while (stack.length > 0) {
              const open = stack.pop();
              if (open === '{') fallback += '}';
              else if (open === '[') fallback += ']';
            }
            return JSON.parse(fallback);
          } catch {}
        }
        throw new Error('La respuesta de Gemini no es un JSON estructurado válido.');
      }
    }
  }

  /**
   * Clasifica lotes compactos de fragmentos ambiguos (Secciones 6, 10, 11, 12).
   * @param {Array<{ id: string, s: string }>} items
   * @param {Object} [options]
   * @returns {Promise<Array<{ id: string, t: string, s: string, c: number }>>}
   */
  async classifyAmbiguousBatches(items, options = {}) {
    if (!items || items.length === 0) return [];

    const modelName = this.model || env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    const batchIndex = options.batchIndex || 1;
    const inputChars = JSON.stringify(items).length;
    const estimatedInputTokens = Math.ceil(inputChars / 4);

    console.log(`[GEMINI] model=${modelName} batch=${batchIndex} items=${items.length} inputChars=${inputChars} estimatedInputTokens=${estimatedInputTokens} maxOutputTokens=${this.maxOutputTokens}`);

    const promptText = `Analiza solo estos fragmentos. No inventes información. Clasifica cada fragmento y devuelve JSON compacto. Usa solo FUNCTIONAL, NON_FUNCTIONAL, BUSINESS_RULE, ACTOR, ENTITY, PROCESS, OTHER, IGNORE. Conserva el significado original. No expliques nada. Cada objeto debe contener id,t,s,c.\n\n${JSON.stringify({ items })}`;

    const payload = {
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: this.maxOutputTokens,
        temperature: this.temperature,
        candidateCount: 1,
        thinkingConfig: this.thinkingLevel ? { thinkingLevel: this.thinkingLevel } : undefined
      }
    };

    const rawText = await this.callGeminiApi(payload);
    console.log(`[GEMINI] requestsUsed=1`);

    const parsed = this.parseOrRepairJson(rawText);

    const list = Array.isArray(parsed) ? parsed : (parsed.items || parsed.results || parsed.data || []);
    if (!Array.isArray(list)) {
      throw new Error('La respuesta de Gemini no contiene el array de resultados esperado.');
    }

    const inputIdSet = new Set(items.map(i => i.id));
    const validResults = [];

    for (const res of list) {
      if (!res || !res.id || !inputIdSet.has(res.id)) continue;
      const validTypes = ['FUNCTIONAL', 'NON_FUNCTIONAL', 'BUSINESS_RULE', 'ACTOR', 'ENTITY', 'PROCESS', 'OTHER', 'IGNORE'];
      const rawType = String(res.t || res.type || 'FUNCTIONAL').toUpperCase().trim();
      const type = validTypes.includes(rawType) ? rawType : 'FUNCTIONAL';

      validResults.push({
        id: String(res.id),
        t: type,
        s: String(res.s || res.statement || res.text || '').trim(),
        c: typeof res.c === 'number' ? Math.min(1, Math.max(0, res.c)) : 0.85
      });
    }

    return validResults;
  }

  /**
   * Análisis completo de proyecto canónico (compatible con AIService).
   * @param {Object} input - { projectId, name, description, context }
   */
  async analyzeProject(input) {
    const modelName = this.model || env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
    const cleanDescription = (input.description || '').slice(0, env.GEMINI_MAX_INPUT_CHARS || 16000);
    const inputChars = cleanDescription.length;
    const estimatedInputTokens = Math.ceil(inputChars / 4);
    // Para el esquema completo del proyecto, permitir hasta 4096 tokens de salida
    const projectOutputTokens = Math.max(this.maxOutputTokens * 8, 4096);

    console.log(`[GEMINI] model=${modelName} batch=1 items=1 inputChars=${inputChars} estimatedInputTokens=${estimatedInputTokens} maxOutputTokens=${projectOutputTokens}`);

    const systemPrompt = `Eres un arquitecto de software experto en metodologías ICASE. 
Analiza la siguiente especificación de sistema y responde ÚNICAMENTE con un objeto JSON válido (sin Markdown, sin explicaciones, sin código adicional) con este esquema exacto:
{
  "project": { "name": "${input.name}", "description": "${cleanDescription.slice(0, 500)}" },
  "actors": [{ "id": "ACT-01", "name": "", "description": "" }],
  "requirements": [{ "code": "RF-01 o RNF-01", "name": "", "description": "", "type": "FUNCIONAL o NO_FUNCIONAL", "priority": "ALTA" | "MEDIA" | "BAJA", "actorIds": ["ACT-01"], "dependencies": [] }],
  "entities": [{ "id": "ENT-01", "name": "", "description": "", "attributes": [{ "name": "id", "type": "Int" }] }],
  "relationships": [{ "id": "REL-01", "source": "", "target": "", "cardinality": "1:N", "description": "" }],
  "screens": [{ "id": "SCR-01", "name": "NombrePantalla", "description": "", "route": "/ruta", "purpose": "", "components": [] }],
  "navigation": [{ "from": "NombrePantallaOrigen", "to": "NombrePantallaDestino", "action": "" }],
  "architecture": { "style": "Clean Architecture", "frontend": "React", "backend": "Node.js Express", "database": "PostgreSQL", "components": [], "connections": [] }
}`;

    const payload = {
      contents: [{ parts: [{ text: `${systemPrompt}\n\nDescripción del sistema:\n${cleanDescription}` }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: projectOutputTokens,
        temperature: this.temperature,
        candidateCount: 1,
        thinkingConfig: this.thinkingLevel ? { thinkingLevel: this.thinkingLevel } : undefined
      }
    };

    const rawText = await this.callGeminiApi(payload);
    console.log(`[GEMINI] requestsUsed=1`);

    const parsed = this.parseOrRepairJson(rawText);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Respuesta de Gemini no contiene un objeto JSON válido');
    }
    return parsed;
  }

  async analyze(description, context = {}) {
    return this.analyzeProject({
      name: context.name || 'Proyecto',
      description,
      context
    });
  }
}

module.exports = GeminiProvider;
