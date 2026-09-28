/**
 * CandidateService
 * Gestión centralizada del ciclo de vida de TODOS los candidatos del proyecto:
 * - Requisitos (RequirementCandidate y NeedCandidate bajo ISO 29148)
 * - Actores, Procesos, Reglas, Tecnologías, Arquitectura, Entidades, Pantallas, Fechas, Restricciones (ModelCandidate)
 * - Listado universal con filtros y agrupación por categorías
 * - Aprobación individual y en lote (promoción a tablas oficiales de dominio)
 * - Rechazo (persistencia de motivo sin eliminación física)
 * - Edición humana antes de aprobación
 * - Estadísticas globales por categoría
 */

const prisma = require('../../config/prisma');
const requirementQualityService = require('./requirementQualityService');

class CandidateService {
  /**
   * Lista candidatos de un proyecto aplicando filtros de estado, tipo o categoría.
   */
  async listByProject(projectId, filters = {}) {
    const status = filters.status || 'PENDING_REVIEW';
    const kind = (filters.kind || filters.category || 'ALL').toUpperCase();

    const reqWhere = { projectId };
    if (status !== 'ALL') reqWhere.status = status;
    if (filters.type && ['FUNCTIONAL', 'NON_FUNCTIONAL'].includes(filters.type)) reqWhere.type = filters.type;
    if (filters.origin) reqWhere.origin = filters.origin;
    if (filters.sourceId) reqWhere.sourceId = filters.sourceId;

    let reqList = [];
    if (kind === 'ALL' || kind === 'REQUIREMENT' || kind === 'REQUISITOS' || kind === 'FUNCTIONAL' || kind === 'NON_FUNCTIONAL') {
      const candidates = await prisma.requirementCandidate.findMany({
        where: reqWhere,
        include: {
          source: { select: { id: true, name: true, type: true } },
          sourceVersion: { select: { id: true, version: true } },
          sourceSegment: true,
          promotedRequirement: { select: { id: true, code: true, name: true, status: true } }
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }]
      });

      reqList = candidates.map(c => ({
        id: c.id,
        projectId: c.projectId,
        kind: 'REQUIREMENT',
        categoryGroup: 'REQUISITOS',
        temporaryCode: c.temporaryCode,
        title: c.title,
        statement: c.statement,
        originalStatement: c.originalStatement,
        type: c.type,
        category: c.category,
        priority: c.priority,
        origin: c.origin,
        confidence: c.confidence ?? 1.0,
        status: c.status,
        rejectionReason: c.rejectionReason,
        evidence: c.evidence,
        qualityReport: c.qualityReport,
        source: c.source,
        sourceVersion: c.sourceVersion,
        promotedId: c.promotedRequirementId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }));

      // Filtros de calidad calculados
      if (filters.hasConflicts === 'true' || filters.hasConflicts === true) {
        reqList = reqList.filter(c => c.evidence?.relationship?.relation === 'CONFLICT');
      }
      if (filters.hasWarnings === 'true' || filters.hasWarnings === true) {
        reqList = reqList.filter(c => c.qualityReport?.warnings?.length > 0);
      }
      if (filters.ambiguous === 'true' || filters.ambiguous === true) {
        reqList = reqList.filter(c => !c.qualityReport?.criteria?.ambiguity?.pass);
      }
    }

    // Consultar ModelCandidates (Actores, Procesos, Reglas, Tecnologías, Arquitectura, Entidades, etc.)
    let modelList = [];
    const modelWhere = { projectId };
    if (status !== 'ALL') modelWhere.status = status;
    if (kind !== 'ALL' && kind !== 'REQUIREMENT' && kind !== 'REQUISITOS') {
      modelWhere.kind = kind;
    }

    if (kind !== 'REQUIREMENT' && kind !== 'REQUISITOS') {
      const models = await prisma.modelCandidate.findMany({
        where: modelWhere,
        orderBy: [{ status: 'asc' }, { kind: 'asc' }, { createdAt: 'desc' }]
      });

      modelList = models.map(m => {
        const ev = m.evidence || {};
        return {
          id: m.id,
          projectId: m.projectId,
          kind: m.kind,
          categoryGroup: this.mapKindToGroup(m.kind),
          temporaryCode: this.generateTemporaryCode(m.kind, m.name),
          title: m.name,
          statement: m.content?.statement || m.content?.description || m.content?.summary || m.name,
          originalStatement: m.name,
          type: m.kind,
          category: m.kind,
          priority: 'MEDIUM',
          origin: m.origin || 'RULE',
          confidence: m.confidence ?? (m.origin === 'INFERRED' ? 0.8 : 0.95),
          status: m.status,
          rejectionReason: null,
          evidence: {
            text: ev.snippet || m.name,
            sourceFile: ev.sourceFile || 'Documento',
            method: ev.method || m.origin || 'RULE',
            confidence: m.confidence ?? 0.95
          },
          content: m.content,
          source: { name: ev.sourceFile || 'Documento', type: 'PDF' },
          promotedId: m.promotedId,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt
        };
      });
    }

    return [...reqList, ...modelList];
  }

  mapKindToGroup(kind) {
    const k = (kind || '').toUpperCase();
    if (k === 'REQUIREMENT') return 'REQUISITOS';
    if (k === 'ACTOR') return 'ACTORES';
    if (k === 'PROCESS') return 'PROCESOS';
    if (k === 'BUSINESS_RULE') return 'REGLAS DE NEGOCIO';
    if (k === 'TECHNOLOGY') return 'TECNOLOGÍAS';
    if (k === 'ARCHITECTURE') return 'ARQUITECTURA';
    if (k === 'ENTITY' || k === 'RELATIONSHIP') return 'ENTIDADES';
    if (k === 'SCREEN') return 'PANTALLAS';
    if (k === 'DATE_MILESTONE') return 'FECHAS';
    if (k === 'CONSTRAINT') return 'RESTRICCIONES';
    if (k === 'OBJECTIVE' || k === 'SCOPE') return 'OBJETIVOS Y ALCANCE';
    if (k === 'PLATFORM') return 'PLATAFORMAS';
    return 'OTROS';
  }

  generateTemporaryCode(kind, name = '') {
    const k = (kind || '').toUpperCase();
    if (k === 'ACTOR') return `ACT-${name.slice(0, 8).trim()}`;
    if (k === 'PROCESS') return `PROC-${name.slice(0, 8).trim()}`;
    if (k === 'BUSINESS_RULE') return `RN-${name.slice(0, 8).trim()}`;
    if (k === 'TECHNOLOGY') return `TECH-${name.slice(0, 8).trim()}`;
    if (k === 'ARCHITECTURE') return `ARCH-${name.slice(0, 8).trim()}`;
    if (k === 'ENTITY') return `ENT-${name.slice(0, 8).trim()}`;
    if (k === 'RELATIONSHIP') return `REL-${name.slice(0, 8).trim()}`;
    if (k === 'SCREEN') return `SCR-${name.slice(0, 8).trim()}`;
    if (k === 'DATE_MILESTONE') return `PLAN-${name.slice(0, 8).trim()}`;
    if (k === 'CONSTRAINT') return `RES-${name.slice(0, 8).trim()}`;
    if (k === 'OBJECTIVE') return `OBJ-${name.slice(0, 8).trim()}`;
    if (k === 'SCOPE') return `ALC-${name.slice(0, 8).trim()}`;
    return `CAND-${name.slice(0, 8).trim()}`;
  }

  /**
   * Obtiene un candidato por ID (buscando en RequirementCandidate o ModelCandidate).
   */
  async getById(id) {
    const req = await prisma.requirementCandidate.findUnique({
      where: { id },
      include: {
        source: true,
        sourceVersion: true,
        sourceSegment: true,
        needCandidate: true,
        promotedRequirement: true
      }
    });
    if (req) return req;

    const model = await prisma.modelCandidate.findUnique({
      where: { id },
      include: { project: true }
    });
    return model;
  }

  /**
   * Edita un candidato antes de aprobarlo.
   */
  async update(id, updateData) {
    // 1. Intentar en RequirementCandidate
    const currentReq = await prisma.requirementCandidate.findUnique({ where: { id } });
    if (currentReq) {
      if (currentReq.status !== 'PENDING_REVIEW') {
        throw Object.assign(new Error('El candidato ya fue revisado.'), { statusCode: 409, code: 'VERSION_CONFLICT' });
      }
      const title = updateData.title ? updateData.title.trim() : currentReq.title;
      const statement = updateData.statement ? updateData.statement.trim() : currentReq.statement;
      const priority = updateData.priority || currentReq.priority;
      const type = updateData.type || currentReq.type;
      const category = updateData.category !== undefined ? updateData.category : currentReq.category;

      const qualityReport = requirementQualityService.evaluate({
        ...currentReq,
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
          originalStatement: currentReq.originalStatement || currentReq.statement,
          priority,
          type,
          category,
          qualityReport
        },
        include: { source: true, sourceVersion: true }
      });
    }

    // 2. Intentar en ModelCandidate
    const currentModel = await prisma.modelCandidate.findUnique({ where: { id } });
    if (currentModel) {
      if (currentModel.status !== 'PENDING_REVIEW') {
        throw Object.assign(new Error('El candidato ya fue revisado.'), { statusCode: 409, code: 'VERSION_CONFLICT' });
      }
      const name = updateData.title || updateData.name ? (updateData.title || updateData.name).trim() : currentModel.name;
      const updatedContent = {
        ...currentModel.content,
        ...(updateData.statement ? { description: updateData.statement, statement: updateData.statement } : {}),
        ...(updateData.content || {})
      };

      return prisma.modelCandidate.update({
        where: { id },
        data: {
          name,
          content: updatedContent,
          updatedAt: new Date()
        }
      });
    }

    const err = new Error(`Candidato ${id} no encontrado.`);
    err.statusCode = 404;
    throw err;
  }

  /**
   * Promueve un candidato aprobado a su correspondiente tabla oficial de dominio.
   */
  async approve(id) {
    // 1. Revisar si es RequirementCandidate
    const reqCandidate = await prisma.requirementCandidate.findUnique({
      where: { id },
      include: { project: true }
    });

    if (reqCandidate) {
      if (reqCandidate.status === 'APPROVED' && reqCandidate.promotedRequirementId) {
        const existingReq = await prisma.requirement.findUnique({ where: { id: reqCandidate.promotedRequirementId } });
        return { candidate: reqCandidate, promotedItem: existingReq, kind: 'REQUIREMENT' };
      }

      if (['CONFLICT', 'UPDATE'].includes(reqCandidate.evidence?.relationship?.relation) && reqCandidate.evidence?.relationship?.requirementId) {
        throw Object.assign(new Error('Este candidato propone un cambio a un requisito existente. Revísalo en Cambios.'), { code: 'IMPACT_CONFIRMATION_REQUIRED', statusCode: 409 });
      }

      return require('../engineering/domain').transaction(async (tx) => {
        const prefix = reqCandidate.type === 'NON_FUNCTIONAL' ? 'RNF' : 'RF';
        const existingReqs = await tx.requirement.findMany({
          where: { projectId: reqCandidate.projectId, code: { startsWith: prefix } },
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

        const requirement = await tx.requirement.create({
          data: {
            projectId: reqCandidate.projectId,
            code: nextCode,
            name: reqCandidate.title,
            description: reqCandidate.statement,
            type: reqCandidate.type === 'NON_FUNCTIONAL' ? 'NON_FUNCTIONAL' : 'FUNCTIONAL',
            priority: reqCandidate.priority,
            status: 'APPROVED',
            qualityReport: reqCandidate.qualityReport || requirementQualityService.evaluate(reqCandidate)
          }
        });

        const domain = require('../engineering/domain');
        await require('../engineering/change.service').remember(tx, requirement);
        for (const [kind, value] of [['Source', reqCandidate.sourceId], ['SourceVersion', reqCandidate.sourceVersionId], ['AudioSegment', reqCandidate.sourceSegmentId]]) {
          if (value) await domain.link(tx, reqCandidate.projectId, kind, value, 'Requirement', requirement.id, 'EVIDENCE');
        }

        const updated = await tx.requirementCandidate.update({
          where: { id },
          data: { status: 'APPROVED', promotedRequirementId: requirement.id }
        });

        return { candidate: updated, requirement, promotedItem: requirement, kind: 'REQUIREMENT' };
      });
    }

    // 2. Revisar si es ModelCandidate (Actores, Reglas, Procesos, etc.)
    const modelCandidate = await prisma.modelCandidate.findUnique({ where: { id } });
    if (!modelCandidate) {
      const err = new Error(`Candidato ${id} no encontrado.`);
      err.statusCode = 404;
      throw err;
    }

    if (modelCandidate.status === 'APPROVED') {
      return { candidate: modelCandidate, kind: modelCandidate.kind, message: 'Ya aprobado previamente.' };
    }

    return prisma.$transaction(async (tx) => {
      let promotedItem = null;
      const { projectId, kind, name, content } = modelCandidate;

      switch (kind) {
        case 'ACTOR': {
          promotedItem = await tx.actor.create({
            data: {
              projectId,
              name,
              description: content?.description || `Actor ${name}`,
              status: 'APPROVED',
              reviewStatus: 'APPROVED'
            }
          });
          break;
        }
        case 'BUSINESS_RULE': {
          promotedItem = await tx.businessRule.create({
            data: {
              projectId,
              name,
              description: content?.description || name,
              status: 'APPROVED'
            }
          });
          break;
        }
        case 'TECHNOLOGY': {
          promotedItem = await tx.technology.create({
            data: {
              projectId,
              name,
              category: content?.category || 'general',
              status: 'APPROVED'
            }
          });
          break;
        }
        case 'PROCESS': {
          promotedItem = await tx.useCase.create({
            data: {
              projectId,
              name,
              processType: 'CORE_OPERATION',
              description: content?.description || name,
              status: 'APPROVED',
              reviewStatus: 'APPROVED'
            }
          });
          break;
        }
        case 'ENTITY': {
          promotedItem = await tx.entity.create({
            data: {
              projectId,
              name,
              description: content?.description || `Entidad ${name}`,
              status: 'APPROVED',
              reviewStatus: 'APPROVED'
            }
          });
          if (content?.attributes && Array.isArray(content.attributes)) {
            for (const attr of content.attributes) {
              await tx.entityAttribute.create({
                data: {
                  entityId: promotedItem.id,
                  name: attr.name,
                  type: attr.type || 'String',
                  isPk: attr.isPk || false,
                  status: 'APPROVED'
                }
              });
            }
          }
          break;
        }
        case 'RELATIONSHIP': {
          promotedItem = await tx.entityRelationship.create({
            data: {
              projectId,
              source: content?.source || 'Source',
              target: content?.target || 'Target',
              cardinality: content?.cardinality || '1:N',
              description: content?.description || name,
              status: 'APPROVED'
            }
          });
          break;
        }
        case 'SCREEN': {
          promotedItem = await tx.screen.create({
            data: {
              projectId,
              name,
              description: content?.description || name,
              type: content?.screenType || 'STANDARD',
              status: 'APPROVED',
              reviewStatus: 'APPROVED'
            }
          });
          break;
        }
        case 'ARCHITECTURE': {
          promotedItem = await tx.architecture.create({
            data: {
              projectId,
              style: content?.style || name,
              frontend: content?.frontend || 'UNKNOWN',
              backend: content?.backend || 'UNKNOWN',
              database: content?.database || 'UNKNOWN',
              status: 'APPROVED',
              reviewStatus: 'APPROVED'
            }
          });
          break;
        }
        case 'PLATFORM': {
          if (content?.type) {
            await tx.project.update({
              where: { id: projectId },
              data: { platform: content.type }
            });
          }
          break;
        }
        default:
          break;
      }

      const updated = await tx.modelCandidate.update({
        where: { id },
        data: {
          status: 'APPROVED',
          promotedId: promotedItem?.id || null
        }
      });

      return {
        candidate: updated,
        promotedItem,
        kind
      };
    });
  }

  /**
   * Rechaza un candidato (en RequirementCandidate o ModelCandidate).
   */
  async reject(id, rejectionReason = '') {
    const req = await prisma.requirementCandidate.findUnique({ where: { id } });
    if (req) {
      return prisma.requirementCandidate.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: rejectionReason ? rejectionReason.trim() : null
        }
      });
    }

    const model = await prisma.modelCandidate.findUnique({ where: { id } });
    if (model) {
      return prisma.modelCandidate.update({
        where: { id },
        data: { status: 'REJECTED' }
      });
    }

    const err = new Error(`Candidato ${id} no encontrado.`);
    err.statusCode = 404;
    throw err;
  }

  /**
   * Aprueba un lote de candidatos seleccionados.
   */
  async approveBatch(ids = []) {
    const results = [];
    for (const id of ids) {
      try {
        const res = await this.approve(id);
        results.push({ id, success: true, res });
      } catch (err) {
        results.push({ id, success: false, error: err.message });
      }
    }
    return results;
  }

  /**
   * Rechaza un lote de candidatos seleccionados.
   */
  async rejectBatch(ids = [], reason = '') {
    const results = [];
    for (const id of ids) {
      try {
        const res = await this.reject(id, reason);
        results.push({ id, success: true, res });
      } catch (err) {
        results.push({ id, success: false, error: err.message });
      }
    }
    return results;
  }

  /**
   * Aprueba todos los elementos pendientes de un grupo o categoría.
   */
  async approveAllCategory(projectId, categoryGroup) {
    const candidates = await this.listByProject(projectId, { status: 'PENDING_REVIEW' });
    const matching = candidates.filter(c => c.categoryGroup === categoryGroup);
    return this.approveBatch(matching.map(m => m.id));
  }

  /**
   * Obtiene estadísticas exhaustivas de todas las categorías de candidatos para el proyecto.
   */
  async getStats(projectId) {
    const [reqs, models] = await Promise.all([
      prisma.requirementCandidate.findMany({
        where: { projectId },
        select: { id: true, type: true, status: true, origin: true, qualityReport: true, evidence: true }
      }),
      prisma.modelCandidate.findMany({
        where: { projectId },
        select: { id: true, kind: true, status: true, origin: true }
      })
    ]);

    const stats = {
      total: reqs.length + models.length,
      pending: reqs.filter(r => r.status === 'PENDING_REVIEW').length + models.filter(m => m.status === 'PENDING_REVIEW').length,
      approved: reqs.filter(r => r.status === 'APPROVED').length + models.filter(m => m.status === 'APPROVED').length,
      rejected: reqs.filter(r => r.status === 'REJECTED').length + models.filter(m => m.status === 'REJECTED').length,

      // Por categorías
      requirements: {
        total: reqs.length,
        pending: reqs.filter(r => r.status === 'PENDING_REVIEW').length,
        functional: reqs.filter(r => r.type === 'FUNCTIONAL').length,
        nonFunctional: reqs.filter(r => r.type === 'NON_FUNCTIONAL').length
      },
      actors: {
        total: models.filter(m => m.kind === 'ACTOR').length,
        pending: models.filter(m => m.kind === 'ACTOR' && m.status === 'PENDING_REVIEW').length
      },
      processes: {
        total: models.filter(m => m.kind === 'PROCESS').length,
        pending: models.filter(m => m.kind === 'PROCESS' && m.status === 'PENDING_REVIEW').length
      },
      businessRules: {
        total: models.filter(m => m.kind === 'BUSINESS_RULE').length,
        pending: models.filter(m => m.kind === 'BUSINESS_RULE' && m.status === 'PENDING_REVIEW').length
      },
      technologies: {
        total: models.filter(m => m.kind === 'TECHNOLOGY').length,
        pending: models.filter(m => m.kind === 'TECHNOLOGY' && m.status === 'PENDING_REVIEW').length
      },
      architecture: {
        total: models.filter(m => m.kind === 'ARCHITECTURE').length,
        pending: models.filter(m => m.kind === 'ARCHITECTURE' && m.status === 'PENDING_REVIEW').length
      },
      entities: {
        total: models.filter(m => m.kind === 'ENTITY' || m.kind === 'RELATIONSHIP').length,
        pending: models.filter(m => (m.kind === 'ENTITY' || m.kind === 'RELATIONSHIP') && m.status === 'PENDING_REVIEW').length
      },
      screens: {
        total: models.filter(m => m.kind === 'SCREEN').length,
        pending: models.filter(m => m.kind === 'SCREEN' && m.status === 'PENDING_REVIEW').length
      },
      dates: {
        total: models.filter(m => m.kind === 'DATE_MILESTONE').length,
        pending: models.filter(m => m.kind === 'DATE_MILESTONE' && m.status === 'PENDING_REVIEW').length
      },
      constraints: {
        total: models.filter(m => m.kind === 'CONSTRAINT').length,
        pending: models.filter(m => m.kind === 'CONSTRAINT' && m.status === 'PENDING_REVIEW').length
      },
      objectives: {
        total: models.filter(m => m.kind === 'OBJECTIVE' || m.kind === 'SCOPE').length,
        pending: models.filter(m => (m.kind === 'OBJECTIVE' || m.kind === 'SCOPE') && m.status === 'PENDING_REVIEW').length
      }
    };

    return stats;
  }
}

module.exports = new CandidateService();
