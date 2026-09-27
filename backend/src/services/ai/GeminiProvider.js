const AIProvider = require('./AIProvider');
const env = require('../../config/env');

class GeminiProvider extends AIProvider {
  /**
   * Structure prepared for Google Gemini API.
   * Expects strictly canonical structured JSON without markdown wrappers or code fences.
   * @param {Object} input - { projectId, name, description, context }
   */
  async analyzeProject(input) {
    if (!env.GEMINI_API_KEY) {
      throw new Error('El proveedor Gemini no está configurado (GEMINI_API_KEY no definida en el archivo .env).');
    }

    const model = env.GEMINI_MODEL || 'gemini-1.5-pro';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

    const systemPrompt = `Eres un arquitecto de software experto en metodologías ICASE. 
Analiza la siguiente especificación de sistema y responde ÚNICAMENTE con un objeto JSON válido (sin Markdown, sin explicaciones, sin código adicional) con este esquema exacto:
{
  "project": { "name": "${input.name}", "description": "${input.description}" },
  "actors": [{ "id": "ACT-01", "name": "", "description": "" }],
  "requirements": [{ "code": "RF-01 o RNF-01", "name": "", "description": "", "type": "FUNCIONAL o NO_FUNCIONAL", "priority": "ALTA" | "MEDIA" | "BAJA", "actorIds": ["ACT-01"], "dependencies": [] }],
  "entities": [{ "id": "ENT-01", "name": "", "description": "", "attributes": [{ "name": "id", "type": "Int" }] }],
  "relationships": [{ "id": "REL-01", "source": "", "target": "", "cardinality": "1:N", "description": "" }],
  "screens": [{ "id": "SCR-01", "name": "NombrePantalla", "description": "", "route": "/ruta", "purpose": "", "components": [] }],
  "navigation": [{ "from": "NombrePantallaOrigen", "to": "NombrePantallaDestino", "action": "" }],
  "architecture": { "style": "Clean Architecture", "frontend": "React", "backend": "Node.js Express", "database": "PostgreSQL", "components": [], "connections": [] }
}
Reglas obligatorias:
- Debes incluir tanto Requisitos Funcionales (RF-01, RF-02... type "FUNCIONAL") como Requisitos No Funcionales (RNF-01, RNF-02... type "NO_FUNCIONAL", ej: seguridad, rendimiento, disponibilidad, respaldo).
- En "navigation", los campos "from" y "to" DEBEN coincidir exactamente con el "name" de una de las pantallas definidas en "screens" (ej: "Inicio de Sesión", "Tablero Principal"). No uses rutas "/..." en "from" ni en "to".`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nDescripción del sistema:\n${input.description}` }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API respondió con error de estado HTTP ${response.status}`);
      }

      const resJson = await response.json();
      const rawText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('La respuesta de Gemini no contenía datos de contenido.');
      }

      return JSON.parse(rawText);
    } catch (err) {
      throw new Error(`Error en el proveedor Gemini: ${err.message}`);
    }
  }

  // Alias para compatibilidad
  async analyze(description, context = {}) {
    return this.analyzeProject({
      name: context.name,
      description,
      context
    });
  }
}

module.exports = GeminiProvider;
