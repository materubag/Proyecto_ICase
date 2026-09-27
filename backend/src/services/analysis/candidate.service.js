/**
 * CandidateService
 * Gestión del ciclo de vida de los candidatos (RequirementCandidate y NeedCandidate):
 * - Listado con filtros
 * - Edición humana antes de aprobación
 * - Aprobación (promoción controlada a Requirement oficial)
 * - Rechazo (persistencia con motivo, sin eliminación física)
 * - Métricas de calidad y ahorro de IA
 */

const prisma = require('../../config/prisma');
const requirementQualityService = require('./requirementQualityService');

class CandidateService {
  async listByProject(projectId, filters = {}) {
    const where = { projectId };

    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.origin) where.origin = filters.origin;
    if (filters.sourceId) where.sourceId = filters.sourceId;

    const candidates = await prisma.requirementCandidate.findMany({
      where,
      include: {
        source: { select: { id: true, name: true, type: true } },
        sourceVersion: { select: { id: true, version: true } },
        sourceSegment: true,
        promotedRequirement: { select: { id: true, code: true, name: true, status: true } }
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    // Filtros calculados en memoria si aplica
    let result = candidates;
    if (filters.hasConflicts === 'true' || filters.hasConflicts === true) {
      result = result.filter(c => c.evidence?.relationship?.relation === 'CONFLICT');
    }
    if (filters.hasWarnings === 'true' || filters.hasWarnings === true) {
      result = result.filter(c => c.qualityReport?.warnings?.length > 0);
    }
    if (filters.ambiguous === 'true' || filters.ambiguous === true) {
      result = result.filter(c => !c.qualityReport?.criteria?.ambiguity?.pass);
    }

    return result;
  }

  async getById(id) {
    return prisma.requirementCandidate.findUnique({
      where: { id },
      include: {
        source: true,
        sourceVersion: true,
        sourceSegment: true,
        needCandidate: true,
        promotedRequirement: true
      }
    });
  }

  /**
   * Permite al usuario editar el candidato antes de aprobarlo,
   * preservando el enunciado original de la propuesta y actualizando la calidad.
   */
  async update(id, updateData) {
    const current = await prisma.requirementCandidate.findUnique({ where: { id } });
    if (!current) {
      const err = new Error(`Candidato ${id} no encontrado.`);
      err.statusCode = 404;
      throw err;
    }

    const statement = updateData.statement ? updateData.statement.trim() : current.statement;
    if (current.status !== 'PENDING_REVIEW') throw Object.assign(new Error('El candidato ya fue revisado.'), { statusCode: 409, code: 'VERSION_CONFLICT' });
    const title = updateData.title ? updateData.title.trim() : current.title;
    const priority = updateData.priority || current.priority;
    const type = updateData.type || current.type;
    const category = updateData.category !== undefined ? updateData.category : current.category;

    // Reevaluar calidad ISO 29148 con la nueva formulación
    const qualityReport = requirementQualityService.evaluate({
      ...current,
      title,
      statement,
      type,
      category
    });

    return prisma.requirementCandidate.update({
      where: { id },
      data: {
        title,
        statement,
        originalStatement: current.originalStatement || current.statement,
        priority,
        type,
        category,
        qualityReport
      },
      include: {
        source: true,
        sourceVersion: true
      }
    });
  }

  /**
   * Promueve un candidato aprobado a la tabla oficial Requirement.
   */
  async approve(id) {
    const candidate = await prisma.requirementCandidate.findUnique({
      where: { id },
      include: { project: true }
    });

    if (!candidate) {
      const err = new Error(`Candidato ${id} no encontrado.`);
      err.statusCode = 404;
      throw err;
    }

    if (candidate.status === 'APPROVED' && candidate.promotedRequirementId) {
      const existingReq = await prisma.requirement.findUnique({ where: { id: candidate.promotedRequirementId } });
      return { candidate, requirement: existingReq };
    }
    if (['CONFLICT', 'UPDATE'].includes(candidate.evidence?.relationship?.relation) && candidate.evidence?.relationship?.requirementId) throw Object.assign(new Error('Este candidato propone un cambio a un requisito existente. Revísalo en Cambios.'), { code: 'IMPACT_CONFIRMATION_REQUIRED', statusCode: 409 });

    if (candidate.status !== 'PENDING_REVIEW') throw Object.assign(new Error('El candidato ya fue revisado.'), { statusCode: 409, code: 'VERSION_CONFLICT' });
    return require('../engineering/domain').transaction(async (tx) => {
      const locked = await tx.requirementCandidate.findUnique({ where: { id } });
      if (locked.status !== 'PENDING_REVIEW') throw Object.assign(new Error('El candidato ya fue revisado.'), { statusCode: 409, code: 'VERSION_CONFLICT' });
      if (locked.updatedAt.getTime() !== candidate.updatedAt.getTime()) throw Object.assign(new Error('El candidato cambió. Actualiza la vista.'), { statusCode: 409, code: 'VERSION_CONFLICT' });
      // 1. Determinar el código secuencial oficial (ej. RF-01 o RNF-01)
      const prefix = candidate.type === 'NON_FUNCTIONAL' ? 'RNF' : 'RF';
      const existingReqs = await tx.requirement.findMany({
        where: {
          projectId: candidate.projectId,
          code: { startsWith: prefix }
        },
        select: { code: true }
      });

      let maxNum = 0;
      existingReqs.forEach(r => {
        const match = r.code.match(/-(?:0)?(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
      const nextCode = `${prefix}-${String(maxNum + 1).padStart(2, '0')}`;

      // 2. Crear el Requirement oficial
      const requirement = await tx.requirement.create({
        data: {
          projectId: candidate.projectId,
          code: nextCode,
          name: candidate.title,
          description: candidate.statement,
          type: candidate.type === 'NON_FUNCTIONAL' ? 'NON_FUNCTIONAL' : 'FUNCTIONAL',
          priority: candidate.priority,
          status: 'APPROVED',
          qualityReport: candidate.qualityReport || requirementQualityService.evaluate(candidate)
        }
      });

      // 3. Actualizar el candidato a APPROVED vinculando el ID oficial
      const domain = require('../engineering/domain');
      await require('../engineering/change.service').remember(tx, requirement);
      for (const [kind, value] of [['Source', candidate.sourceId], ['SourceVersion', candidate.sourceVersionId], ['AudioSegment', candidate.sourceSegmentId]]) {
        if (value) await domain.link(tx, candidate.projectId, kind, value, 'Requirement', requirement.id, 'EVIDENCE');
      }
      const updatedCandidate = await tx.requirementCandidate.update({
        where: { id },
        data: {
          status: 'APPROVED',
          promotedRequirementId: requirement.id
        }
      });

      return { candidate: updatedCandidate, requirement };
    });
  }

  /**
   * Rechaza un candidato (conservándolo físicamente con su motivo).
   */
  async reject(id, rejectionReason = '') {
    const candidate = await prisma.requirementCandidate.findUnique({ where: { id } });
    if (!candidate) {
      const err = new Error(`Candidato ${id} no encontrado.`);
      err.statusCode = 404;
      throw err;
    }

    if (candidate.status !== 'PENDING_REVIEW') throw Object.assign(new Error('El candidato ya fue revisado.'), { statusCode: 409, code: 'VERSION_CONFLICT' });
    return prisma.requirementCandidate.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: rejectionReason ? rejectionReason.trim() : null
      }
    });
  }

  /**
   * Obtiene estadísticas de candidatos para un proyecto.
   */
  async getStats(projectId) {
    const candidates = await prisma.requirementCandidate.findMany({
      where: { projectId },
      select: {
        id: true,
        type: true,
        status: true,
        origin: true,
        qualityReport: true,
        evidence: true
      }
    });

    const total = candidates.length;
    const pending = candidates.filter(c => c.status === 'PENDING_REVIEW').length;
    const approved = candidates.filter(c => c.status === 'APPROVED').length;
    const rejected = candidates.filter(c => c.status === 'REJECTED').length;

    const functional = candidates.filter(c => c.type === 'FUNCTIONAL').length;
    const nonFunctional = candidates.filter(c => c.type === 'NON_FUNCTIONAL').length;

    const explicit = candidates.filter(c => c.origin === 'EXPLICIT').length;
    const inferred = candidates.filter(c => c.origin === 'INFERRED').length;

    const conflicts = candidates.filter(c => c.evidence?.relationship?.relation === 'CONFLICT').length;
    const duplicates = candidates.filter(c => c.evidence?.relationship?.relation === 'DUPLICATE').length;

    let scoreSum = 0;
    let scoreCount = 0;
    candidates.forEach(c => {
      if (typeof c.qualityReport?.score === 'number') {
        scoreSum += c.qualityReport.score;
        scoreCount++;
      }
    });

    const averageQualityScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null;

    return {
      total,
      pending,
      approved,
      rejected,
      functional,
      nonFunctional,
      explicit,
      inferred,
      conflicts,
      duplicates,
      averageQualityScore
    };
  }
}

module.exports = new CandidateService();
