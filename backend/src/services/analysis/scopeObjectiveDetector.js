/**
 * ScopeObjectiveDetector
 * Extractor determinista de:
 * - Nombre de proyecto e identificación general
 * - Objetivo General y Objetivos Específicos
 * - Alcance Incluido y Alcance Excluido
 * - Problema Principal y Situación Actual
 */

class ScopeObjectiveDetector {
  /**
   * Extrae objetivos, alcance e información básica del proyecto.
   * @param {string} text
   * @param {Array<Object>} sections
   * @returns {{
   *   projectName: string|null,
   *   proponent: string|null,
   *   solutionType: string|null,
   *   sector: string|null,
   *   location: string|null,
   *   objectives: { general: string|null, specific: Array<{ id: string, text: string }> },
   *   scope: { included: Array<{ id: string, text: string }>, excluded: Array<{ id: string, text: string }> },
   *   problemStatement: { currentSituation: string|null, mainProblem: string|null, specificProblems: Array<string> },
   *   team: Array<string>
   * }}
   */
  detect(text = '', sections = []) {
    const result = {
      projectName: null,
      proponent: null,
      solutionType: null,
      sector: null,
      location: null,
      objectives: {
        general: null,
        specific: []
      },
      scope: {
        included: [],
        excluded: []
      },
      problemStatement: {
        currentSituation: null,
        mainProblem: null,
        specificProblems: []
      },
      team: []
    };

    if (!text) return result;

    // 1. Identificación básica de datos generales
    const projMatch = text.match(/Solución\s+([A-Z0-9_\-]+)/i) || text.match(/\b([A-Z]{4,15})\s+CONTROL\s+INTELIGENTE/i);
    if (projMatch) {
      result.projectName = projMatch[1].trim();
    } else {
      const titleMatch = text.match(/SISTEMA\s+(?:WEB\s+)?PARA\s+(?:LA\s+)?([^\n]+)/i);
      if (titleMatch) result.projectName = titleMatch[1].trim();
    }

    const propMatch = text.match(/Empresa\s+proponente\s+([^\n]+)/i) || text.match(/PROPUESTA\s+CREADA\s+POR\s+([^\n]+)/i);
    if (propMatch) result.proponent = propMatch[1].trim();

    const solTypeMatch = text.match(/Tipo\s+de\s+solución\s+([^\n]+)/i) || text.match(/Modalidad\s+([^\n]+)/i);
    if (solTypeMatch) result.solutionType = solTypeMatch[1].trim();

    const sectorMatch = text.match(/Sector\s+([^\n]+)/i);
    if (sectorMatch) result.sector = sectorMatch[1].trim();

    const locMatch = text.match(/Ubicación\s+([^\n]+)/i);
    if (locMatch) result.location = locMatch[1].trim();

    // 2. Objetivos
    // Objetivo General
    const objGenSec = sections.find(s => /OBJETIVO\s+GENERAL/i.test(s.title) && s.content?.trim().length > 0);
    if (objGenSec) {
      result.objectives.general = objGenSec.content.replace(/^[0-9.]+\s*OBJETIVO\s+GENERAL\s*/i, '').trim();
    } else {
      const match = text.match(/OBJETIVO\s+GENERAL\s*\n+([^\n]+(?:\n[^\n]+){1,3})/i);
      if (match) result.objectives.general = match[1].replace(/\n+/g, ' ').trim();
    }

    // Objetivos Específicos
    const objEspSec = sections.find(s => /OBJETIVOS?\s+ESPEC[IÍ]FICOS?/i.test(s.title) && s.content?.trim().length > 0);
    const espSource = objEspSec ? objEspSec.content : text;
    const numObjMatches = [...espSource.matchAll(/^[ \t]*([0-9]{1,2})\.\s*([^\n]+(?:\n[ \t]+[^\n0-9•\-*]+)*)/gm)];
    if (numObjMatches.length > 0 && objEspSec) {
      numObjMatches.forEach((m, idx) => {
        const clean = m[2].replace(/\s+/g, ' ').trim();
        if (clean.length > 10 && !/OBJETIVO/i.test(clean)) {
          result.objectives.specific.push({
            id: `OE-${String(idx + 1).padStart(2, '0')}`,
            text: clean
          });
        }
      });
    }

    // 3. Alcance
    // Alcance Incluido
    const incSec = sections.find(s => /INCLUIDO\s+EN\s+EL\s+ALCANCE/i.test(s.title) && s.content?.trim().length > 0);
    if (incSec) {
      const bullets = [...incSec.content.matchAll(/^[•\-*]\s*([^\n]+)/gm)];
      bullets.forEach((b, idx) => {
        result.scope.included.push({
          id: `INC-${String(idx + 1).padStart(2, '0')}`,
          text: b[1].trim()
        });
      });
      if (result.scope.included.length === 0) {
        incSec.content.split('\n').map(l => l.trim()).filter(l => l.length > 15).forEach((line, idx) => {
          result.scope.included.push({ id: `INC-${String(idx + 1).padStart(2, '0')}`, text: line });
        });
      }
    }

    // Alcance Excluido
    const excSec = sections.find(s => /FUERA\s+DEL\s+ALCANCE/i.test(s.title) && s.content?.trim().length > 0);
    if (excSec) {
      const bullets = [...excSec.content.matchAll(/^[•\-*]\s*([^\n]+)/gm)];
      bullets.forEach((b, idx) => {
        result.scope.excluded.push({
          id: `EXC-${String(idx + 1).padStart(2, '0')}`,
          text: b[1].trim()
        });
      });
      if (result.scope.excluded.length === 0) {
        excSec.content.split('\n').map(l => l.trim()).filter(l => l.length > 15).forEach((line, idx) => {
          result.scope.excluded.push({ id: `EXC-${String(idx + 1).padStart(2, '0')}`, text: line });
        });
      }
    }

    // 4. Problema y Contexto
    const sitSec = sections.find(s => /SITUACI[OÓ]N\s+ACTUAL/i.test(s.title) && s.content?.trim().length > 0);
    if (sitSec) result.problemStatement.currentSituation = sitSec.content.trim();

    const probSec = sections.find(s => /PROBLEMA\s+PRINCIPAL/i.test(s.title) && s.content?.trim().length > 0);
    if (probSec) result.problemStatement.mainProblem = probSec.content.trim();

    const probEspSec = sections.find(s => /PROBLEMAS\s+ESPEC[IÍ]FICOS/i.test(s.title) && s.content?.trim().length > 0);
    if (probEspSec) {
      const bullets = [...probEspSec.content.matchAll(/^[•\-*]\s*([^\n]+)/gm)];
      result.problemStatement.specificProblems = bullets.map(b => b[1].trim());
    }

    // 5. Equipo responsable
    const teamSec = sections.find(s => /EQUIPO\s+RESPONSABLE/i.test(s.title) && s.content?.trim().length > 0);
    if (teamSec) {
      // Nombres en múltiples columnas o líneas
      const names = teamSec.content
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 5 && !/EQUIPO|NEXORA/i.test(l));
      names.forEach(line => {
        // En LaTeX dos nombres en la misma línea separados por espacios amplios
        const parts = line.split(/\s{3,}/).map(p => p.trim()).filter(p => p.length > 5);
        if (parts.length > 0) result.team.push(...parts);
        else result.team.push(line);
      });
    }

    return result;
  }
}

module.exports = new ScopeObjectiveDetector();
