/**
 * Mermaid Repairer
 * Automatically repairs invalid or imperfect Mermaid code returned by LLM or user inputs.
 * Flow:
 * 1. Deterministic normalization & repair (strips accents, fixes delimiters, separates concatenated attributes, fixes reserved keywords).
 * 2. Validation.
 * 3. Targeted AI surgical repair (only if syntax errors persist and provider is active).
 * 4. Deterministic fallback as guaranteed safety net.
 */

const mermaidNormalizer = require('./mermaidNormalizer');
const mermaidValidator = require('./mermaidValidator');
const diagramSemanticValidator = require('./diagramSemanticValidator');

class MermaidRepairer {
  /**
   * Helper to check both syntax and critical semantic constraints for ER/Class.
   */
  evaluateQuality(code, diagramType) {
    const syntax = mermaidValidator.validate(code, diagramType);
    if (!syntax.isValid) {
      return { isValid: false, error: syntax.error, isSemantic: false };
    }

    if (diagramType === 'ER') {
      const sem = diagramSemanticValidator.validateER(code);
      if (!sem.isValid) {
        return { isValid: false, error: sem.errors.join('; '), isSemantic: true };
      }
    } else if (diagramType === 'CLASS') {
      const sem = diagramSemanticValidator.validateClass(code);
      if (!sem.isValid) {
        return { isValid: false, error: sem.errors.join('; '), isSemantic: true };
      }
    }

    return { isValid: true, error: null };
  }

  /**
   * Attempts to repair Mermaid code to guarantee a syntactically and semantically valid diagram.
   * Limits AI correction attempts to a maximum of 2.
   * @param {string} rawCode - Original raw Mermaid code
   * @param {string} diagramType - 'ER' | 'CLASS' | 'FLOWCHART' | 'USE_CASE' | 'NAVIGATION' | 'ARCHITECTURE'
   * @param {Object} context - Structured project context
   * @param {Object} aiProvider - Optional GeminiProvider instance for AI repair
   * @param {Function} fallbackGenerator - Fallback generator function
   * @returns {Promise<{ code: string, status: string, technicalError: string|null, repairMethod: string }>}
   */
  async repairAndValidate(rawCode, diagramType, context, aiProvider = null, fallbackGenerator = null) {
    if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
      const fallbackCode = fallbackGenerator ? fallbackGenerator() : 'flowchart TD\n  START([Inicio]) --> FIN([Fin])';
      return {
        code: fallbackCode,
        status: 'FALLBACK_GENERATED',
        technicalError: 'Código inicial vacío',
        repairMethod: 'DETERMINISTIC_FALLBACK'
      };
    }

    // Step 1: Initial Deterministic Normalization
    let code = mermaidNormalizer.normalize(rawCode, diagramType);
    let check = this.evaluateQuality(code, diagramType);

    if (check.isValid) {
      return {
        code,
        status: 'VALID',
        technicalError: null,
        repairMethod: 'NORMALIZED'
      };
    }

    console.warn(`[MermaidRepairer] Validación inicial falló para ${diagramType}: ${check.error}. Iniciando reparación...`);

    // Step 2: Second deterministic pass (aggressive sanitization)
    code = mermaidNormalizer.normalize(code, diagramType);
    check = this.evaluateQuality(code, diagramType);
    if (check.isValid) {
      return {
        code,
        status: 'REPAIRED_DETERMINISTICALLY',
        technicalError: null,
        repairMethod: 'DETERMINISTIC_PASS_2'
      };
    }

    // Step 3: Targeted AI surgical repair (maximum 2 attempts, no infinite loop)
    const MAX_AI_ATTEMPTS = 2;
    if (aiProvider && aiProvider.callGeminiApi && (aiProvider.apiKey || process.env.GEMINI_API_KEY)) {
      for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt++) {
        try {
          console.log(`[MermaidRepairer] Ejecutando intento ${attempt}/${MAX_AI_ATTEMPTS} de reparación quirúrgica con Gemini para ${diagramType}...`);
          const repairPrompt = `Eres un validador y corrector estricto de sintaxis y modelos de software en Mermaid.js (v10.9).
Corrige EXCLUSIVAMENTE los errores detectados del siguiente código Mermaid para el tipo '${diagramType}'.
Errores a corregir: ${check.error}

REGLAS CRÍTICAS DE REPARACIÓN:
1. En diagramas ER (erDiagram):
   - Prohibido dejar entidades vacías (ej: PROVEEDOR { }). Toda entidad debe tener atributos y clave primaria.
   - Prohibido usar frases o descripciones como PK (ej: NUNCA 'claridad_la_falla PK'). Usa 'int id PK' o 'string codigo PK'.
   - Atributos en ASCII simple sin tildes ni caracteres especiales.
2. En diagramas de Clases (classDiagram):
   - Prohibido incluir clases técnicas como AuthenticationService, JwtService.
   - Prohibido métodos genéricos de relleno (getId, setId, toDTO, validate, save).
   - Atributos en camelCase sin espacios ni tildes.
3. En Flowchart: NUNCA uses la palabra reservada 'end' como identificador de un nodo. Usa 'NODE_END' o 'FIN'.
4. Devuelve ÚNICAMENTE el código Mermaid reparado, sin bloques de markdown (\`\`\`) ni explicaciones.

Código erróneo a reparar:
${code}`;

          const payload = {
            contents: [{ role: 'user', parts: [{ text: repairPrompt }] }],
            generationConfig: { temperature: 0.0, maxOutputTokens: 2048 }
          };

          const aiResponse = await aiProvider.callGeminiApi(payload);
          const cleanedAiCode = aiResponse.replace(/```(?:mermaid)?/gi, '').replace(/```/g, '').trim();
          const normalizedAiCode = mermaidNormalizer.normalize(cleanedAiCode, diagramType);
          const aiCheck = this.evaluateQuality(normalizedAiCode, diagramType);

          if (aiCheck.isValid) {
            console.log(`[MermaidRepairer] Reparación con IA exitosa para ${diagramType} en intento ${attempt}.`);
            return {
              code: normalizedAiCode,
              status: 'REPAIRED_VIA_AI',
              technicalError: null,
              repairMethod: `SURGICAL_AI_ATTEMPT_${attempt}`
            };
          } else {
            console.warn(`[MermaidRepairer] Intento ${attempt} con IA falló: ${aiCheck.error}`);
            code = normalizedAiCode;
            check = aiCheck;
          }
        } catch (repairErr) {
          console.error(`[MermaidRepairer] Falló el intento ${attempt} de reparación IA: ${repairErr.message}`);
        }
      }
    }

    // Step 4: Deterministic fallback generator as guaranteed safety net
    if (fallbackGenerator) {
      console.log(`[MermaidRepairer] Usando generador determinista de respaldo para ${diagramType}...`);
      const fallbackCode = fallbackGenerator();
      const safeFallback = mermaidNormalizer.normalize(fallbackCode, diagramType);
      return {
        code: safeFallback,
        status: 'FALLBACK_GENERATED',
        technicalError: check.error,
        repairMethod: 'DETERMINISTIC_FALLBACK'
      };
    }

    return {
      code,
      status: 'REQUIRES_REVIEW',
      technicalError: check.error,
      repairMethod: 'NONE'
    };
  }
}

module.exports = new MermaidRepairer();
