const prisma = require('../config/prisma');
const versionHistoryService = require('./versionHistory.service');

class ActorService {
  async getActorsByProject(projectId) {
    return await this.consolidateProjectActors(projectId);
  }

  async consolidateProjectActors(projectId) {
    const deduplicationService = require('./analysis/deduplicationService');
    const actors = await prisma.actor.findMany({
      where: { projectId, isDeleted: false },
      orderBy: [{ reviewStatus: 'desc' }, { createdAt: 'asc' }]
    });

    if (actors.length === 0) return [];

    const groups = new Map();
    for (const a of actors) {
      const key = deduplicationService.getActorCanonicalKey(a.name);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(a);
    }

    let idx = 1;
    for (const [key, group] of groups.entries()) {
      const canonicalCode = `ACT-${String(idx).padStart(2, '0')}`;
      idx++;

      const primary = group[0];
      const displayName = deduplicationService.getPreferredActorDisplayName(primary.name, key);

      let mergedDesc = primary.description || '';
      const isAnyApproved = group.some(g => g.reviewStatus === 'APPROVED' || g.status === 'APPROVED');

      for (let i = 1; i < group.length; i++) {
        const dup = group[i];
        if (dup.description && !mergedDesc.includes(dup.description)) {
          mergedDesc = mergedDesc ? `${mergedDesc} · ${dup.description}`.slice(0, 500) : dup.description;
        }
      }

      const allGroupNames = group.map(g => g.name);
      const nextAliases = Array.from(new Set([...(primary.aliases || []), ...allGroupNames, displayName]));

      if (primary.codeId !== canonicalCode || primary.name !== displayName || (isAnyApproved && primary.reviewStatus !== 'APPROVED') || primary.description !== mergedDesc || (primary.aliases?.length || 0) < nextAliases.length) {
        await prisma.actor.update({
          where: { id: primary.id },
          data: {
            codeId: canonicalCode,
            name: displayName,
            description: mergedDesc || primary.description,
            aliases: nextAliases,
            reviewStatus: isAnyApproved ? 'APPROVED' : primary.reviewStatus,
            status: isAnyApproved ? 'APPROVED' : primary.status
          }
        });
      }

      if (group.length > 1) {
        const dupIds = group.slice(1).map(g => g.id);

        // Re-point references in requirements
        const reqs = await prisma.requirement.findMany({ where: { projectId } });
        for (const req of reqs) {
          const hasDup = req.actorIds.some(id => dupIds.includes(id));
          if (hasDup) {
            const updatedActorIds = Array.from(new Set(req.actorIds.map(id => dupIds.includes(id) ? primary.id : id)));
            await prisma.requirement.update({
              where: { id: req.id },
              data: { actorIds: updatedActorIds }
            });
          }
        }

        // Re-point references in use cases
        const ucs = await prisma.useCase.findMany({ where: { projectId } });
        for (const uc of ucs) {
          let needsUpdate = false;
          let pId = uc.primaryActorId;
          if (dupIds.includes(pId)) {
            pId = primary.id;
            needsUpdate = true;
          }
          const sec = uc.secondaryActorIds || [];
          if (sec.some(id => dupIds.includes(id))) {
            const updatedSec = Array.from(new Set(sec.map(id => dupIds.includes(id) ? primary.id : id)));
            needsUpdate = true;
            await prisma.useCase.update({
              where: { id: uc.id },
              data: { primaryActorId: pId, secondaryActorIds: updatedSec }
            });
          } else if (needsUpdate) {
            await prisma.useCase.update({
              where: { id: uc.id },
              data: { primaryActorId: pId }
            });
          }
        }

        // Remove duplicate records
        await prisma.actor.deleteMany({
          where: { id: { in: dupIds } }
        });
      }
    }

    return await prisma.actor.findMany({
      where: { projectId, isDeleted: false },
      orderBy: { codeId: 'asc' }
    });
  }

  async createActor(projectId, data) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      const error = new Error(`Project with ID ${projectId} not found`);
      error.statusCode = 404;
      throw error;
    }

    const { name, description, codeId, reviewStatus } = data;
    if (!name || name.trim() === '') {
      const error = new Error('Actor name is required');
      error.statusCode = 400;
      throw error;
    }

    const deduplicationService = require('./analysis/deduplicationService');
    const canonicalKey = deduplicationService.getActorCanonicalKey(name);
    const existing = await prisma.actor.findMany({ where: { projectId, isDeleted: false } });
    const match = existing.find(a =>
      deduplicationService.getActorCanonicalKey(a.name) === canonicalKey ||
      (a.aliases && a.aliases.includes(name.trim()))
    );

    if (match) {
      const currentAliases = match.aliases || [];
      const updatedAliases = Array.from(new Set([...currentAliases, name.trim()]));
      const updated = await prisma.actor.update({
        where: { id: match.id },
        data: {
          aliases: updatedAliases,
          reviewStatus: reviewStatus || match.reviewStatus || 'APPROVED',
          status: reviewStatus || match.status || 'APPROVED',
          description: match.description && description && !match.description.includes(description)
            ? `${match.description} · ${description}`.slice(0, 500)
            : (match.description || description)
        }
      });
      return updated;
    }

    const count = existing.length + 1;
    const finalCode = codeId ? codeId.trim().toUpperCase() : `ACT-${String(count).padStart(2, '0')}`;
    const displayName = deduplicationService.getPreferredActorDisplayName(name, canonicalKey);

    const created = await prisma.actor.create({
      data: {
        projectId,
        codeId: finalCode,
        name: displayName,
        description: description ? description.trim() : null,
        aliases: [name.trim(), displayName],
        status: reviewStatus || 'PENDING_REVIEW',
        reviewStatus: reviewStatus || 'PENDING',
        isDeleted: false
      }
    });

    await versionHistoryService.recordSnapshot(
      projectId,
      'ACTOR',
      created.id,
      'CREATED',
      created,
      `Creación de actor ${created.name}`
    );

    return created;
  }

  async updateActor(id, data) {
    const existing = await prisma.actor.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Actor with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    const { name, description, codeId, reviewStatus, aliases } = data;

    // Regla: Si se edita un actor aprobado, pasa a NEEDS_REVIEW si no se especifica estado
    let nextReviewStatus = reviewStatus !== undefined ? reviewStatus : existing.reviewStatus;
    if (existing.reviewStatus === 'APPROVED' && reviewStatus === undefined) {
      const nameChanged = name !== undefined && name.trim() !== existing.name;
      const descChanged = description !== undefined && description.trim() !== (existing.description || '');
      if (nameChanged || descChanged) {
        nextReviewStatus = 'NEEDS_REVIEW';
      }
    }

    const updated = await prisma.actor.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description ? description.trim() : null }),
        ...(codeId !== undefined && { codeId: codeId ? codeId.trim().toUpperCase() : null }),
        ...(aliases !== undefined && { aliases: Array.isArray(aliases) ? aliases : [aliases] }),
        reviewStatus: nextReviewStatus,
        status: nextReviewStatus
      }
    });

    await versionHistoryService.recordSnapshot(
      existing.projectId,
      'ACTOR',
      id,
      'UPDATED',
      updated,
      `Modificación de actor ${updated.name} (Estado: ${nextReviewStatus})`
    );

    return updated;
  }

  async updateStatus(id, reviewStatus) {
    return await prisma.actor.update({
      where: { id },
      data: { reviewStatus, status: reviewStatus }
    });
  }

  async deleteActor(id) {
    const existing = await prisma.actor.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Actor with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    const { projectId, name, codeId } = existing;
    const actorRefIds = [id, name, codeId].filter(Boolean);

    // 1. Guardar Snapshot para recuperación
    await versionHistoryService.recordSnapshot(
      projectId,
      'ACTOR',
      id,
      'DELETED',
      existing,
      `Eliminación en cascada del actor ${name}`
    );

    const cascadedEffects = {
      requirementsUpdated: 0,
      useCasesUpdated: 0,
      screensUpdated: 0,
      navigationUpdated: 0
    };

    // 2. Cascada en Requisitos: remover actor de actorIds
    const allReqs = await prisma.requirement.findMany({ where: { projectId } });
    for (const req of allReqs) {
      const filtered = req.actorIds.filter(a => !actorRefIds.includes(a));
      if (filtered.length !== req.actorIds.length) {
        await prisma.requirement.update({
          where: { id: req.id },
          data: { actorIds: filtered }
        });
        cascadedEffects.requirementsUpdated++;
      }
    }

    // 3. Cascada en Casos de Uso
    const allUCs = await prisma.useCase.findMany({ where: { projectId } });
    for (const uc of allUCs) {
      let modified = false;
      let newPrimary = uc.primaryActorId;
      if (actorRefIds.includes(uc.primaryActorId)) {
        newPrimary = null;
        modified = true;
      }
      const newSecondary = uc.secondaryActorIds.filter(a => !actorRefIds.includes(a));
      if (newSecondary.length !== uc.secondaryActorIds.length) {
        modified = true;
      }
      if (modified) {
        await prisma.useCase.update({
          where: { id: uc.id },
          data: { primaryActorId: newPrimary, secondaryActorIds: newSecondary }
        });
        cascadedEffects.useCasesUpdated++;
      }
    }

    // 4. Cascada en Pantallas / Mockups
    const allScreens = await prisma.screen.findMany({ where: { projectId } });
    for (const sc of allScreens) {
      const filtered = sc.actorIds.filter(a => !actorRefIds.includes(a));
      if (filtered.length !== sc.actorIds.length) {
        await prisma.screen.update({
          where: { id: sc.id },
          data: { actorIds: filtered }
        });
        cascadedEffects.screensUpdated++;
      }
    }

    // 5. Eliminar actor
    await prisma.actor.delete({
      where: { id }
    });

    return {
      deletedActor: existing,
      cascadedEffects
    };
  }
}

module.exports = new ActorService();
