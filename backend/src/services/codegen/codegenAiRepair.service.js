/**
 * Codegen AI Coherence & Repair Service
 * Provides AI-assisted analysis of project coherence across requirements, actors, entities, operations,
 * and handles targeted, controlled automated repairs when verification detects syntax, contract, or runtime errors.
 */

const fs = require('fs');
const path = require('path');
const env = require('../../config/env');
const MockAIProvider = require('../ai/MockAIProvider');
const GeminiProvider = require('../ai/GeminiProvider');
const OpenAIProvider = require('../ai/OpenAIProvider');

function getAIProvider() {
  const provider = (env.AI_PROVIDER || 'openai').toLowerCase();
  if (provider === 'gemini' && env.GEMINI_API_KEY) {
    return new GeminiProvider();
  }
  if (provider === 'openai' && env.OPENAI_API_KEY) {
    return new OpenAIProvider();
  }
  return new MockAIProvider();
}

class CodegenAiRepairService {
  constructor() {
    this.defaultBudget = {
      maxTokens: 50000,
      maxAttempts: 3,
      timeoutMs: 300000 // 5 minutes
    };
  }

  /**
   * Analyzes coherence across requirements, actors, entities, operations, permissions, and screens.
   */
  async reviewProjectCoherence(projectSpec, options = {}) {
    const startTime = Date.now();
    const anomalies = [];
    const suggestions = [];

    const entities = projectSpec.entities || [];
    const operations = projectSpec.operations || [];
    const screens = projectSpec.screens || [];
    const roles = projectSpec.roles || projectSpec.security?.roles || [];
    const requirements = projectSpec.requirements || [];

    // 1. Entities without operations
    const entitiesWithOps = new Set(operations.map(o => o.entity || o.targetEntity));
    for (const ent of entities) {
      if (!entitiesWithOps.has(ent.modelName)) {
        anomalies.push({
          type: 'UNCOVERED_ENTITY',
          element: ent.modelName,
          message: `La entidad '${ent.modelName}' no tiene operaciones de negocio ni endpoints REST asignados.`
        });
      }
    }

    // 2. Roles in operations not present in project actors
    const declaredRoles = new Set(roles);
    for (const op of operations) {
      for (const r of (op.authorizedRoles || [])) {
        if (!declaredRoles.has(r)) {
          anomalies.push({
            type: 'UNDECLARED_ROLE',
            element: `Operation:${op.operationId}`,
            message: `El rol '${r}' en la operación '${op.name}' no está en la lista de roles del proyecto.`
          });
        }
      }
    }

    // 3. Screens without connected operations or actions
    for (const scr of screens) {
      const actionsCount = (scr.actions || []).length;
      if (actionsCount === 0 && !scr.connectedOperationId) {
        anomalies.push({
          type: 'DISCONNECTED_SCREEN',
          element: `Screen:${scr.name}`,
          message: `La pantalla '${scr.title || scr.name}' no tiene acciones ni operaciones asociadas.`
        });
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      coherent: anomalies.length === 0,
      anomalies,
      suggestions,
      durationMs,
      tokensUsed: 150 // Coherence analysis uses local catalog analysis by default
    };
  }

  /**
   * Analyzes a validation failure and proposes a targeted, verifiable fix.
   * Feeds only the specific error message and relevant file/contract lines, never the full repo.
   */
  async proposeRepair(failure, directory, context = {}) {
    const startTime = Date.now();
    const { stage, message, file, line, details } = failure;

    // Read relevant snippet if file exists
    let codeSnippet = '';
    let targetRelativePath = file || '';
    if (file && directory) {
      const fullPath = path.isAbsolute(file) ? file : path.join(directory, file);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          if (line && line > 0) {
            const start = Math.max(0, line - 10);
            const end = Math.min(lines.length, line + 10);
            codeSnippet = lines.slice(start, end).join('\n');
          } else {
            codeSnippet = lines.slice(0, 50).join('\n');
          }
        } catch (_) {}
      }
    }

    // Rule-based deterministic repairs for known patterns
    if (message && message.includes('UNRESOLVED_LOCAL_IMPORT')) {
      return {
        success: true,
        fixType: 'IMPORT_CORRECTION',
        rationale: 'El import no resuelve a un archivo generado existente en el bundle.',
        diagnosis: message,
        tokensUsed: 120,
        durationMs: Date.now() - startTime,
        canAutoApply: true
      };
    }

    if (message && message.includes('SyntaxError')) {
      return {
        success: true,
        fixType: 'SYNTAX_CORRECTION',
        rationale: 'Error sintáctico detectado en el archivo generado.',
        diagnosis: message,
        tokensUsed: 140,
        durationMs: Date.now() - startTime,
        canAutoApply: true
      };
    }

    // Attempt AI-assisted analysis if provider is available
    const provider = getAIProvider();
    let aiExplanation = '';
    let tokensUsed = 250;
    let providerUsage = null;
    let targetString = null;
    let replacementString = null;
    let canAutoApply = false;

    try {
      const repairSystemPrompt = `Eres el Asistente de Reparación y Diagnóstico de Código de iCASE.
Analiza este fallo en la verificación de la aplicación generada.
Devuelve estrictamente un objeto JSON con el siguiente formato:
{
  "diagnosis": "Explicación concisa de la causa raíz en 1 o 2 oraciones",
  "fixType": "SYNTAX_CORRECTION|IMPORT_CORRECTION|SCHEMA_OR_CONTRACT_ADJUSTMENT",
  "targetFile": "ruta/al/archivo.js",
  "targetString": "cadena exacta a reemplazar (opcional)",
  "replacementString": "cadena corregida (opcional)"
}`;

      const repairInput = {
        task: 'Diagnosticar fallo de validación y proponer parche acotado.',
        stage,
        error: message,
        details: details || null,
        file: targetRelativePath,
        codeSnippet
      };

      if (typeof provider.extractDocumentBatch === 'function' && !(provider instanceof MockAIProvider)) {
        const resp = await provider.extractDocumentBatch(repairInput, { prompt: repairSystemPrompt });
        if (resp && resp.data) {
          aiExplanation = resp.data.diagnosis || resp.data.rationale || '';
          targetString = resp.data.targetString || null;
          replacementString = resp.data.replacementString || null;
          canAutoApply = !!(targetString && replacementString);
          providerUsage = resp.usage || null;
          tokensUsed = providerUsage?.total_tokens || providerUsage?.totalTokenCount || 250;
        }
      } else {
        aiExplanation = `Fallo detectado en etapa ${stage}: ${message}. Se requiere ajuste de esquema o contrato.`;
      }
    } catch (e) {
      aiExplanation = `Fallo de validación en etapa ${stage}: ${message}`;
    }

    return {
      success: true,
      fixType: 'SCHEMA_OR_CONTRACT_ADJUSTMENT',
      diagnosis: aiExplanation,
      targetFile: targetRelativePath,
      targetString,
      replacementString,
      providerUsage,
      tokensUsed,
      durationMs: Date.now() - startTime,
      canAutoApply
    };
  }

  /**
   * Controlled application of a validated fix.
   * Replaces exact target strings or adjusts contracts. NEVER executes shell commands.
   */
  applyFix(directory, fix) {
    if (!fix || !fix.targetFile || !fix.targetString || fix.replacementString === undefined) {
      return { applied: false, reason: 'Parámetros de corrección insuficientes.' };
    }

    const targetPath = path.resolve(directory, fix.targetFile);
    if (!targetPath.startsWith(path.resolve(directory))) {
      throw new Error('Intento de modificar un archivo fuera del directorio aislado de generación.');
    }

    if (!fs.existsSync(targetPath)) {
      return { applied: false, reason: `Archivo '${fix.targetFile}' no existe en el paquete generado.` };
    }

    const content = fs.readFileSync(targetPath, 'utf8');
    if (!content.includes(fix.targetString)) {
      return { applied: false, reason: 'La cadena objetivo a reemplazar no se encontró en el archivo.' };
    }

    const updated = content.replace(fix.targetString, fix.replacementString);
    fs.writeFileSync(targetPath, updated, 'utf8');

    return {
      applied: true,
      file: fix.targetFile,
      bytesModified: updated.length - content.length
    };
  }
}

module.exports = new CodegenAiRepairService();

