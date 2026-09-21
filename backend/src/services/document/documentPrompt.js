/**
 * documentPrompt.js
 * Construcción de contexto reducido y prompts de ingeniería de requisitos para Ollama / LLM.
 * Cumple con:
 * 1. Reducción drástica de tokens (no envía texto completo rawText).
 * 2. Formato estricto JSON sin Markdown ni explicaciones narrativas.
 * 3. Detección de ambigüedades, inconsistencias, dependencias y actores asociados.
 */

/**
 * Construye un contexto reducido y estructurado a partir del DTO intermedio de extracción.
 * Envía únicamente información esencial para no superar los límites de contexto de Ollama (< 1200 tokens).
 * @param {Object} extractedDocument
 * @returns {Object} Contexto compacto para el LLM
 */
function buildAIContext(extractedDocument) {
  const docName = extractedDocument.document?.name || extractedDocument.fileName || 'Sistema';
  const projectName = docName.replace(/\.pdf$/i, '').replace(/[_\-]+/g, ' ');

  // Extraer objetivo o alcance resumido (máx 200 chars)
  const rawObj = extractedDocument.contextSections?.objetivos ||
                 extractedDocument.contextSections?.problemPrincipal ||
                 extractedDocument.contextSections?.alcance ||
                 '';
  const objective = typeof rawObj === 'string' && rawObj.trim()
    ? rawObj.trim().slice(0, 200)
    : 'Sistema de software';

  // Actores detectados por reglas
  const actors = (extractedDocument.actors || extractedDocument.ruleActors || []).slice(0, 6).map(a => ({
    id: a.id,
    name: a.name,
    role: (a.description || a.name || '').slice(0, 60)
  }));

  // Requisitos funcionales detectados en formato compacto "RF-xx: Descripción"
  const functionalRequirements = (extractedDocument.functionalRequirements || extractedDocument.ruleRequirements?.filter(r => r.type === 'FUNCTIONAL') || [])
    .slice(0, 20)
    .map(r => `${r.code || r.id}: ${(r.name || r.text || '').slice(0, 75)}`);

  // Requisitos no funcionales detectados
  const nonFunctionalRequirements = (extractedDocument.nonFunctionalRequirements || extractedDocument.ruleRequirements?.filter(r => r.type === 'NON_FUNCTIONAL') || [])
    .slice(0, 8)
    .map(r => `${r.code || r.id}: ${(r.name || r.text || '').slice(0, 70)}`);

  // Reglas de negocio detectadas
  const businessRules = (extractedDocument.businessRules || [])
    .slice(0, 8)
    .map(r => `${r.code || r.id}: ${(r.text || r.description || '').slice(0, 70)}`);

  // Entidades detectadas
  const entities = (extractedDocument.entities || []).slice(0, 8).map(e => e.name);

  // Tecnologías detectadas
  const technologies = (extractedDocument.technologies || []).slice(0, 8);

  return {
    projectName,
    objective,
    actors,
    functionalRequirements,
    nonFunctionalRequirements,
    businessRules,
    entities,
    technologies
  };
}

const SYSTEM_INSTRUCTION = `Eres un asistente experto en ingeniería de requisitos de software (RF-02).
Tu tarea es analizar los requisitos, actores y reglas y devolver ÚNICAMENTE un JSON estructurado.

REGLAS ESTRICTAS:
1. No inventes información. Utiliza solamente los datos proporcionados.
2. Si un dato no existe, utiliza [] o null según corresponda.
3. No agregues explicaciones fuera del JSON ni utilices bloques markdown (\`\`\`json).
4. Conserva estrictamente los IDs originales de requisitos (ej: RF-01, RNF-01, RN-01).
5. Identifica ambigüedades e inconsistencias ÚNICAMENTE si existe evidencia en el texto.
6. Asocia los actores correspondientes a cada requisito.`;

/**
 * Genera el prompt estructurado y compacto para enviar a Ollama.
 * @param {Object} aiContext - Contexto reducido generado por buildAIContext
 * @returns {string} Prompt final seguro y de tamaño controlado
 */
function buildDocumentPrompt(aiContext) {
  const targetSchema = {
    projectName: aiContext.projectName || "Nombre",
    objective: aiContext.objective || "Objetivo",
    actors: [
      { id: "ACT-01", name: "NombreRol", description: "Responsabilidad" }
    ],
    functionalRequirements: [
      {
        id: "RF-01",
        name: "Nombre",
        actors: ["ACT-01"],
        dependencies: [],
        priority: "HIGH",
        ambiguities: [],
        inconsistencies: []
      }
    ],
    nonFunctionalRequirements: [
      {
        id: "RNF-01",
        name: "Nombre",
        priority: "MEDIUM",
        ambiguities: [],
        inconsistencies: []
      }
    ],
    businessRules: [
      { id: "RN-01", text: "Regla" }
    ],
    ambiguities: [],
    inconsistencies: []
  };

  return `${SYSTEM_INSTRUCTION}

DEVUELVE ÚNICAMENTE EL OBJETO JSON CON ESTE ESQUEMA EXACTO:
${JSON.stringify(targetSchema)}

DATOS EXTRAÍDOS DEL SISTEMA:
${JSON.stringify(aiContext)}`;
}

module.exports = {
  SYSTEM_INSTRUCTION,
  buildAIContext,
  buildDocumentPrompt
};
