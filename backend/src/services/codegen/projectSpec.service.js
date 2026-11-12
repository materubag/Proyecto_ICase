/**
 * Project Specification Service
 * Manages the lifecycle of project specifications: build, validation, transactional persistence,
 * hash integrity verification, and freshness checking against project dependencies.
 */

const prisma = require('../../config/prisma');
const { buildProjectSpec, computeCanonicalHash, verifySpecHash } = require('./projectSpecBuilder');
const { validateProjectSpec } = require('./projectSpecValidator');
const { applyApprovedProposals } = require('./aiProposalStore');

class ProjectSpecService {
  /**
   * Builds and validates a project specification in-memory without mutating the DB.
   */
  async getSpecificationDiagnostics(projectId, options = {}) {
    const rawSpec = await buildProjectSpec(projectId, options);
    let spec = rawSpec;
    try {
      const { spec: mergedSpec } = applyApprovedProposals(projectId, rawSpec);
      spec = mergedSpec;
    } catch (_) {}
    const diagnostics = validateProjectSpec(spec, options);

    return {
      spec,
      diagnostics
    };
  }

  /**
   * Builds, validates, and if valid, atomically saves an approved snapshot in ProjectBaseline & ArtifactVersion.
   */
  async approveAndPersistSpec(projectId, options = {}) {
    const { spec, diagnostics } = await this.getSpecificationDiagnostics(projectId, options);

    if (!diagnostics.ready) {
      const error = new Error('No se puede aprobar la especificación: contiene errores bloqueantes.');
      error.code = 'SPEC_VALIDATION_FAILED';
      error.details = diagnostics.errors;
      throw error;
    }

    // Persist via atomic transaction
    return await prisma.$transaction(async (tx) => {
      const lastBaseline = await tx.projectBaseline.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' }
      });

      const nextVersion = (lastBaseline?.version || 0) + 1;
      const stampedSpec = {
        ...spec,
        specVersion: nextVersion,
        approvedAt: new Date().toISOString()
      };
      // computeCanonicalHash strictly ignores root .hash
      stampedSpec.hash = computeCanonicalHash(stampedSpec);

      // 1. Immutable ProjectBaseline snapshot
      const baseline = await tx.projectBaseline.create({
        data: {
          projectId,
          version: nextVersion,
          name: options.name || `Especificación Aprobada v${nextVersion}`,
          description: options.description || `Snapshot inmutable con hash ${stampedSpec.hash}`,
          snapshot: stampedSpec
        }
      });

      // 2. Artifact record
      const artifact = await tx.artifact.upsert({
        where: {
          projectId_type_name: {
            projectId,
            type: 'PROJECT_SPEC',
            name: 'APPROVED_SPECIFICATION'
          }
        },
        create: {
          projectId,
          type: 'PROJECT_SPEC',
          name: 'APPROVED_SPECIFICATION',
          status: 'APPROVED',
          revision: nextVersion
        },
        update: {
          status: 'APPROVED',
          revision: nextVersion
        }
      });

      // 3. ArtifactVersion record
      const versionRecord = await tx.artifactVersion.create({
        data: {
          artifactId: artifact.id,
          version: nextVersion,
          structuredContent: stampedSpec,
          renderedContent: JSON.stringify(stampedSpec, null, 2),
          status: 'APPROVED',
          validationStatus: 'VALID'
        }
      });

      // 4. Keep approvedVersionId coherent
      await tx.artifact.update({
        where: { id: artifact.id },
        data: {
          approvedVersionId: versionRecord.id
        }
      });

      return {
        baselineId: baseline.id,
        versionId: versionRecord.id,
        version: nextVersion,
        hash: stampedSpec.hash,
        diagnostics,
        spec: stampedSpec
      };
    });
  }

  /**
   * Retrieves the approved specification snapshot, verifying it is a real specification.
   */
  async getLatestApprovedSpec(projectId) {
    // 1. Check Artifact with approvedVersionId
    const artifact = await prisma.artifact.findFirst({
      where: {
        projectId,
        type: 'PROJECT_SPEC',
        name: 'APPROVED_SPECIFICATION',
        status: 'APPROVED'
      }
    });

    if (artifact && artifact.approvedVersionId) {
      const versionRecord = await prisma.artifactVersion.findUnique({
        where: { id: artifact.approvedVersionId }
      });

      if (versionRecord?.structuredContent && versionRecord.status === 'APPROVED') {
        const spec = versionRecord.structuredContent;
        if (spec.schemaVersion === '1.0.0' && Array.isArray(spec.entities)) {
          return spec;
        }
      }
    }

    // 2. Check ProjectBaseline (only if it contains a valid spec schema)
    const baseline = await prisma.projectBaseline.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' }
    });

    if (baseline?.snapshot) {
      const snap = baseline.snapshot;
      if (snap.schemaVersion === '1.0.0' && Array.isArray(snap.entities)) {
        return snap;
      }
    }

    return null;
  }

  /**
   * Verifies hash integrity and freshness of the approved spec against current project state
   */
  async checkSpecFreshness(projectId, spec) {
    if (!spec || !spec.hash) {
      return { upToDate: false, reason: 'MISSING_SPEC_HASH' };
    }

    // 1. Hash verification using unified canonical verifySpecHash
    if (!verifySpecHash(spec)) {
      return {
        upToDate: false,
        reason: 'SPEC_HASH_INTEGRITY_FAILED',
        message: 'La especificación aprobada no supera la verificación de integridad criptográfica (snapshot alterado).'
      };
    }

    // 2. Real Freshness: compare against stored dependencyManifest
    const manifest = spec.dependencyManifest;
    if (manifest?.sourceFingerprint) {
      try {
        const current = await buildProjectSpec(projectId, { allowUnapproved: true, ignoreStale: true });
        if (current.dependencyManifest.sourceFingerprint !== manifest.sourceFingerprint) return { upToDate: false, reason: 'DEPENDENCY_MODIFIED', details: { message: 'Cambió el contenido de requisitos, contratos, permisos, navegación o mockups.' } };
      } catch (_) { return { upToDate: false, reason: 'SPEC_SOURCE_UNAVAILABLE' }; }
    }
    if (manifest) {
      // 2.1 Verify approved Entities & Attributes
      if (manifest.entities && manifest.entities.length > 0) {
        const entIds = manifest.entities.map(e => e.id);
        const currentEntities = await prisma.entity.findMany({
          where: { id: { in: entIds } },
          include: { attributes: true }
        });
        const currentEntMap = new Map(currentEntities.map(e => [e.id, e]));

        for (const snapEnt of manifest.entities) {
          const current = currentEntMap.get(snapEnt.id);
          if (!current || current.isDeleted) {
            return {
              upToDate: false,
              reason: 'DEPENDENCY_MODIFIED',
              element: `Entity:${snapEnt.name}`,
              changeType: 'DELETED',
              details: { id: snapEnt.id, message: `La entidad '${snapEnt.name}' fue eliminada del proyecto.` }
            };
          }
          const isApproved = current.status === 'APPROVED' || current.reviewStatus === 'APPROVED';
          if (!isApproved) {
            return {
              upToDate: false,
              reason: 'DEPENDENCY_MODIFIED',
              element: `Entity:${snapEnt.name}`,
              changeType: 'LOST_APPROVAL',
              details: { id: snapEnt.id, message: `La entidad '${snapEnt.name}' perdió su aprobación.` }
            };
          }
          if (current.revision !== snapEnt.revision) {
            return {
              upToDate: false,
              reason: 'DEPENDENCY_MODIFIED',
              element: `Entity:${snapEnt.name}`,
              changeType: 'REVISION_CHANGED',
              details: { id: snapEnt.id, expectedRevision: snapEnt.revision, currentRevision: current.revision, message: `La entidad '${snapEnt.name}' fue modificada.` }
            };
          }

          // Verify Attributes inside this entity
          const currentAttrMap = new Map((current.attributes || []).map(a => [a.id, a]));
          for (const snapAttr of (snapEnt.attributes || [])) {
            const currAttr = currentAttrMap.get(snapAttr.id);
            if (!currAttr) {
              return {
                upToDate: false,
                reason: 'DEPENDENCY_MODIFIED',
                element: `Attribute:${snapEnt.name}.${snapAttr.name}`,
                changeType: 'ATTRIBUTE_DELETED',
                details: { id: snapAttr.id, message: `El atributo '${snapAttr.name}' de '${snapEnt.name}' fue eliminado.` }
              };
            }
            if (currAttr.type !== snapAttr.type || currAttr.name !== snapAttr.name || currAttr.revision !== snapAttr.revision) {
              return {
                upToDate: false,
                reason: 'DEPENDENCY_MODIFIED',
                element: `Attribute:${snapEnt.name}.${snapAttr.name}`,
                changeType: 'ATTRIBUTE_MODIFIED',
                details: { id: snapAttr.id, message: `El atributo '${snapAttr.name}' de '${snapEnt.name}' fue modificado.` }
              };
            }
          }
          if ((current.attributes || []).length !== (snapEnt.attributes || []).length) {
            return {
              upToDate: false,
              reason: 'DEPENDENCY_MODIFIED',
              element: `Entity:${snapEnt.name}`,
              changeType: 'ATTRIBUTES_COUNT_CHANGED',
              details: { id: snapEnt.id, message: `Se añadieron o retiraron atributos en '${snapEnt.name}'.` }
            };
          }
        }
      }

      // 2.2 Verify Requirements
      if (manifest.requirements && manifest.requirements.length > 0) {
        const reqIds = manifest.requirements.map(r => r.id);
        const currentReqs = await prisma.requirement.findMany({
          where: { id: { in: reqIds } }
        });
        const currentReqMap = new Map(currentReqs.map(r => [r.id, r]));

        for (const snapReq of manifest.requirements) {
          const current = currentReqMap.get(snapReq.id);
          if (!current || current.isDeleted) {
            return {
              upToDate: false,
              reason: 'DEPENDENCY_MODIFIED',
              element: `Requirement:${snapReq.code || snapReq.name}`,
              changeType: 'DELETED',
              details: { id: snapReq.id, message: `El requisito '${snapReq.code || snapReq.name}' fue eliminado.` }
            };
          }
          if (current.status !== 'APPROVED') {
            return {
              upToDate: false,
              reason: 'DEPENDENCY_MODIFIED',
              element: `Requirement:${snapReq.code || snapReq.name}`,
              changeType: 'LOST_APPROVAL',
              details: { id: snapReq.id, message: `El requisito '${snapReq.code || snapReq.name}' perdió su estado de aprobación.` }
            };
          }
          if (current.revision !== snapReq.revision) {
            return {
              upToDate: false,
              reason: 'DEPENDENCY_MODIFIED',
              element: `Requirement:${snapReq.code || snapReq.name}`,
              changeType: 'REVISION_CHANGED',
              details: { id: snapReq.id, expectedRevision: snapReq.revision, currentRevision: current.revision, message: `El requisito '${snapReq.code || snapReq.name}' fue modificado.` }
            };
          }
        }
      }

      // 2.3 Verify Business Rules
      if (manifest.businessRules && manifest.businessRules.length > 0) {
        const ruleIds = manifest.businessRules.map(b => b.id);
        const currentRules = await prisma.businessRule.findMany({
          where: { id: { in: ruleIds } }
        });
        const currentRuleMap = new Map(currentRules.map(b => [b.id, b]));

        for (const snapRule of manifest.businessRules) {
          const current = currentRuleMap.get(snapRule.id);
          if (!current) {
            return {
              upToDate: false,
              reason: 'DEPENDENCY_MODIFIED',
              element: `BusinessRule:${snapRule.name}`,
              changeType: 'DELETED',
              details: { id: snapRule.id, message: `La regla '${snapRule.name}' fue eliminada.` }
            };
          }
          if (current.revision !== snapRule.revision || current.description !== snapRule.description) {
            return {
              upToDate: false,
              reason: 'DEPENDENCY_MODIFIED',
              element: `BusinessRule:${snapRule.name}`,
              changeType: 'MODIFIED',
              details: { id: snapRule.id, message: `La regla '${snapRule.name}' fue modificada.` }
            };
          }
        }
      }

      // 2.4 Verify Use Cases
      if (manifest.useCases && manifest.useCases.length > 0) {
        const ucIds = manifest.useCases.map(u => u.id);
        const currentUcs = await prisma.useCase.findMany({
          where: { id: { in: ucIds } }
        });
        const currentUcMap = new Map(currentUcs.map(u => [u.id, u]));

        for (const snapUc of manifest.useCases) {
          const current = currentUcMap.get(snapUc.id);
          if (!current || current.isDeleted) {
            return {
              upToDate: false,
              reason: 'DEPENDENCY_MODIFIED',
              element: `UseCase:${snapUc.name}`,
              changeType: 'DELETED',
              details: { id: snapUc.id, message: `El caso de uso '${snapUc.name}' fue eliminado.` }
            };
          }
          if (current.revision !== snapUc.revision) {
            return {
              upToDate: false,
              reason: 'DEPENDENCY_MODIFIED',
              element: `UseCase:${snapUc.name}`,
              changeType: 'REVISION_CHANGED',
              details: { id: snapUc.id, message: `El caso de uso '${snapUc.name}' fue modificado.` }
            };
          }
        }
      }
    } else {
      // Fallback count comparison if manifest was not recorded in legacy specs
      const [entCount, reqCount] = await Promise.all([
        prisma.entity.count({ where: { projectId, isDeleted: false, OR: [{ status: 'APPROVED' }, { reviewStatus: 'APPROVED' }] } }),
        prisma.requirement.count({ where: { projectId, isDeleted: false, type: 'FUNCTIONAL', status: 'APPROVED' } })
      ]);
      const specEntitiesCount = (spec.entities || []).length;
      const specReqsCount = (spec.requirements || []).filter(r => r.type === 'FUNCTIONAL').length;

      if (entCount !== specEntitiesCount || reqCount !== specReqsCount) {
        return {
          upToDate: false,
          reason: 'DEPENDENCIES_MODIFIED',
          element: 'Scope:CountMismatch',
          changeType: 'COUNT_MISMATCH',
          details: {
            current: { entities: entCount, requirements: reqCount },
            snapshot: { entities: specEntitiesCount, requirements: specReqsCount }
          }
        };
      }
    }

    return { upToDate: true };
  }
}

module.exports = new ProjectSpecService();
