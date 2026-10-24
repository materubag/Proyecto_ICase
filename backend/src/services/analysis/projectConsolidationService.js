const prisma = require('../../config/prisma');
const deduplicationService = require('./deduplicationService');
const actorService = require('../actor.service');

class ProjectConsolidationService {
  /**
   * Consolidates all actors and requirements of a project:
   * - Eliminates duplicates before approval / cleans existing duplicates
   * - Preserves all provenance in `sources`
   * - Synchronizes status and references
   * - Returns clear metrics
   */
  async consolidateProject(projectId) {
    // 1. Consolidate actors first
    const consolidatedActors = await actorService.consolidateProjectActors(projectId);

    // 2. Fetch all requirements of the project
    const allRequirements = await prisma.requirement.findMany({
      where: { projectId, isDeleted: false },
      orderBy: [{ status: 'asc' }, { code: 'asc' }]
    });

    if (allRequirements.length === 0) {
      return {
        projectId,
        actorsCount: consolidatedActors.length,
        totalRequirements: 0,
        approvedCount: 0,
        pendingCount: 0,
        duplicatesConsolidated: 0
      };
    }

    // 3. Separate approved vs pending requirements
    const approvedReqs = allRequirements.filter(r => r.status === 'APPROVED');
    const pendingReqs = allRequirements.filter(r => r.status !== 'APPROVED');

    // Groups map: canonicalKey / cluster -> { canonical, sources: [], toDeleteIds: [] }
    const clusters = [];

    // Index approved requirements first (they are ground truth)
    for (const app of approvedReqs) {
      clusters.push({
        canonical: app,
        sources: Array.isArray(app.sources) ? [...app.sources] : [],
        toDeleteIds: [],
        isApproved: true
      });
    }

    // Process pending requirements against clusters or create new clusters
    for (const pend of pendingReqs) {
      let matchedCluster = null;

      for (const cl of clusters) {
        if (deduplicationService.isSemanticEquivalent(
          { statement: pend.description || pend.name },
          { statement: cl.canonical.description || cl.canonical.name }
        )) {
          matchedCluster = cl;
          break;
        }
      }

      const sourceEntry = {
        candidateId: pend.id,
        temporaryCode: pend.code,
        statement: pend.description || pend.name,
        originalStatement: pend.description || pend.name,
        sourceFile: 'Extracción del Proyecto',
        method: 'CONSOLIDATED_FROM_PENDING'
      };

      if (matchedCluster) {
        // Matched an approved or earlier pending cluster!
        matchedCluster.sources.push(sourceEntry);
        matchedCluster.toDeleteIds.push(pend.id);
      } else {
        // New unique pending requirement
        clusters.push({
          canonical: pend,
          sources: [sourceEntry],
          toDeleteIds: [],
          isApproved: false
        });
      }
    }

    // 4. Apply database updates inside a transaction
    let duplicatesConsolidated = 0;

    await prisma.$transaction(async (tx) => {
      for (const cl of clusters) {
        const dupIds = cl.toDeleteIds;
        if (dupIds.length > 0) {
          duplicatesConsolidated += dupIds.length;

          // Update dependencies in other requirements that referenced deleted duplicates
          const oldCodes = allRequirements.filter(r => dupIds.includes(r.id)).map(r => r.code);
          const canonicalCode = cl.canonical.code;

          for (const oldCode of oldCodes) {
            if (oldCode === canonicalCode) continue;

            // Re-point dependencies
            const depReqs = await tx.requirement.findMany({
              where: { projectId, dependencies: { has: oldCode } }
            });
            for (const dr of depReqs) {
              const updatedDeps = Array.from(new Set(dr.dependencies.map(d => d === oldCode ? canonicalCode : d)));
              await tx.requirement.update({
                where: { id: dr.id },
                data: { dependencies: updatedDeps }
              });
            }

            // Re-point in use cases
            const ucs = await tx.useCase.findMany({
              where: { projectId, requirementIds: { has: oldCode } }
            });
            for (const uc of ucs) {
              const updatedReqIds = Array.from(new Set(uc.requirementIds.map(d => d === oldCode ? canonicalCode : d)));
              await tx.useCase.update({
                where: { id: uc.id },
                data: { requirementIds: updatedReqIds }
              });
            }
          }

          // Delete the redundant requirements
          await tx.requirement.deleteMany({
            where: { id: { in: dupIds } }
          });
        }

        // Save updated sources traceability in canonical requirement
        if (cl.sources.length > 0) {
          await tx.requirement.update({
            where: { id: cl.canonical.id },
            data: {
              sources: cl.sources
            }
          });
        }
      }
    });

    // 5. Query final state
    const remaining = await prisma.requirement.findMany({
      where: { projectId, isDeleted: false },
      orderBy: { code: 'asc' }
    });

    const approvedCount = remaining.filter(r => r.status === 'APPROVED').length;
    const pendingCount = remaining.filter(r => r.status === 'PENDING').length;

    return {
      projectId,
      actorsCount: consolidatedActors.length,
      totalRequirements: remaining.length,
      approvedCount,
      pendingCount,
      duplicatesConsolidated,
      requirements: remaining
    };
  }
}

module.exports = new ProjectConsolidationService();
