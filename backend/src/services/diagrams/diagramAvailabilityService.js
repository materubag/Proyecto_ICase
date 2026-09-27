const prisma = require('../../config/prisma');

/**
 * Service to evaluate data availability and completeness for diagram generation.
 * Performs deterministic checks BEFORE any AI call, avoiding unnecessary token usage.
 */
class DiagramAvailabilityService {
  /**
   * Fetches all structured data for a project and checks availability for all 5 diagrams.
   * @param {string} projectId
   * @returns {Promise<Object>} Availability report per diagram type
   */
  async checkAvailability(projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        requirements: { where: { isDeleted: false } },
        requirementCandidates: true,
        actors: { where: { isDeleted: false } },
        entities: {
          where: { isDeleted: false },
          include: { attributes: true }
        },
        relationships: true,
        classModels: { where: { isDeleted: false } },
        screens: { where: { isDeleted: false } },
        navigationNodes: { where: { isDeleted: false } },
        architectures: {
          include: { components: true },
          orderBy: { createdAt: 'desc' }
        },
        technologies: true,
        artifacts: {
          include: {
            versions: { orderBy: { version: 'desc' }, take: 1 }
          }
        }
      }
    });

    if (!project) {
      const err = new Error(`Proyecto ${projectId} no encontrado`);
      err.statusCode = 404;
      throw err;
    }

    return this.evaluateProjectData(project);
  }

  /**
   * Pure evaluation function given loaded project data.
   */
  evaluateProjectData(project) {
    const actors = project.actors || [];
    const requirements = project.requirements || [];
    const requirementCandidates = project.requirementCandidates || [];
    const entities = project.entities || [];
    const relationships = project.relationships || [];
    const classModels = project.classModels || [];
    const screens = project.screens || [];
    const navigationNodes = project.navigationNodes || [];
    const architectures = project.architectures || [];
    const technologies = project.technologies || [];
    const artifacts = project.artifacts || [];

    // Helper to find latest artifact version for a diagram type
    const getArtifactInfo = (diagramType) => {
      const art = artifacts.find(a => a.type === diagramType);
      const latestVer = art?.versions?.[0];
      return {
        artifact: art,
        version: latestVer,
        isGenerated: Boolean(latestVer?.renderedContent),
        generatedAt: latestVer?.createdAt || null,
        renderedContent: latestVer?.renderedContent || null,
        validationStatus: latestVer?.validationStatus || null,
        technicalError: latestVer?.technicalError || null
      };
    };

    // Helper to check if any data was updated after the diagram was generated
    const checkIsOutdated = (generatedAt, items) => {
      if (!generatedAt) return false;
      const genTime = new Date(generatedAt).getTime();
      return items.some(item => {
        const itemTime = new Date(item.updatedAt || item.createdAt).getTime();
        return itemTime > genTime;
      });
    };

    // 1. USE_CASE
    const ucArtifact = getArtifactInfo('USE_CASE');
    const approvedActors = actors.filter(a => a.reviewStatus === 'APPROVED' || a.status === 'APPROVED');
    const approvedReqs = requirements.filter(r => r.status === 'APPROVED' && (r.type === 'FUNCTIONAL' || !r.type));
    const approvedCandidates = requirementCandidates.filter(c => c.status === 'APPROVED' && (c.type === 'FUNCTIONAL' || !c.type));
    const totalApprovedFunctional = Math.max(approvedReqs.length, approvedCandidates.length);
    const actorsCount = approvedActors.length;

    let ucStatus = 'INSUFFICIENT';
    const ucMissing = [];
    if (actors.length === 0) {
      ucMissing.push('No se han identificado actores en el sistema');
    } else if (approvedActors.length === 0) {
      ucMissing.push(`Se identificaron ${actors.length} actores, pero ninguno ha sido aprobado aún. Debes aprobar actores en Requerimientos → Actores antes de continuar.`);
    }

    if (requirements.length === 0 && requirementCandidates.length === 0) {
      ucMissing.push('No se han identificado requisitos funcionales');
    } else if (totalApprovedFunctional === 0) {
      ucMissing.push('Los requisitos funcionales detectados aún no han sido aprobados. Revisa y aprueba candidatos en Requerimientos antes de continuar.');
    }

    if (approvedActors.length >= 1 && totalApprovedFunctional >= 3) {
      ucStatus = 'SUFFICIENT';
    } else if (approvedActors.length >= 1 && totalApprovedFunctional >= 1) {
      ucStatus = 'PARTIAL';
      if (totalApprovedFunctional < 3) ucMissing.push('Se recomienda aprobar al menos 3 requisitos funcionales para un diagrama completo');
    }

    const ucOutdated = checkIsOutdated(ucArtifact.generatedAt, [...approvedActors, ...approvedReqs]);

    // 2. ER (Entidad-Relación)
    const erArtifact = getArtifactInfo('ER');
    const approvedEntities = entities.filter(e => e.reviewStatus === 'APPROVED' || e.status === 'APPROVED');
    const approvedRel = relationships.filter(r => r.reviewStatus === 'APPROVED' || r.status === 'APPROVED' || (!r.reviewStatus && !r.status));
    const entitiesCount = approvedEntities.length;
    const relCount = approvedRel.length;

    let erStatus = 'INSUFFICIENT';
    const erMissing = [];
    if (entities.length === 0) {
      erMissing.push('No se han identificado entidades en el sistema');
    } else if (entitiesCount < 2) {
      if (entities.length >= 2) {
        erMissing.push(`Se encontraron ${entities.length} entidades pero están pendientes de aprobación. Se requieren al menos 2 entidades aprobadas.`);
      } else {
        erMissing.push('Se requieren al menos 2 entidades aprobadas para construir el modelo de datos');
      }
    } else if (relCount === 0) {
      erStatus = 'PARTIAL';
      erMissing.push(`Se encontraron ${entitiesCount} entidades aprobadas, pero no existen relaciones suficientes para construir el modelo`);
    } else {
      erStatus = 'SUFFICIENT';
    }

    const erOutdated = checkIsOutdated(erArtifact.generatedAt, [...approvedEntities, ...approvedRel]);

    // 3. CLASS (Diagrama de clases)
    const classArtifact = getArtifactInfo('CLASS');
    const approvedClasses = classModels.filter(c => c.reviewStatus === 'APPROVED' || c.status === 'APPROVED');
    const classesCount = approvedClasses.length;

    let classStatus = 'INSUFFICIENT';
    const classMissing = [];
    if (classesCount === 0 && entitiesCount < 2) {
      if (classModels.length > 0 || entities.length >= 2) {
        classMissing.push('Las clases o entidades identificadas deben estar aprobadas antes de generar el diagrama');
      } else {
        classMissing.push('Faltan clases o entidades aprobadas para modelar las estructuras POO');
      }
    } else if (classesCount >= 2 || (classesCount >= 1 && approvedClasses.some(c => c.methods && Array.isArray(c.methods) && c.methods.length > 0))) {
      classStatus = 'SUFFICIENT';
    } else if (entitiesCount >= 2 || classesCount >= 1) {
      classStatus = 'PARTIAL';
      classMissing.push('Entidades aprobadas disponibles; los métodos y operaciones se inferirán de los requisitos aprobados');
    }

    const classOutdated = checkIsOutdated(classArtifact.generatedAt, [...approvedClasses, ...approvedEntities]);

    // 4. NAVIGATION (Árbol de navegación)
    const navArtifact = getArtifactInfo('NAVIGATION');
    const approvedScreens = screens.filter(s => s.reviewStatus === 'APPROVED' || s.status === 'APPROVED' || (!s.reviewStatus && !s.status));
    const screensCount = approvedScreens.length;
    const navNodesCount = navigationNodes.length;

    let navStatus = 'INSUFFICIENT';
    const navMissing = [];
    if (screens.length === 0 && navNodesCount === 0) {
      navMissing.push('No se identificaron pantallas o módulos suficientes para generar el árbol de navegación');
    } else if (screensCount === 0 && navNodesCount === 0) {
      navMissing.push('Las pantallas detectadas deben ser aprobadas antes de generar el árbol');
    } else if (screensCount >= 3 || navNodesCount >= 3) {
      navStatus = 'SUFFICIENT';
    } else {
      navStatus = 'PARTIAL';
      navMissing.push(`Solo se detectaron ${screensCount || navNodesCount} vistas / transiciones aprobadas`);
    }

    const navOutdated = checkIsOutdated(navArtifact.generatedAt, [...approvedScreens, ...navigationNodes]);

    // 5. ARCHITECTURE (Arquitectura)
    const archArtifact = getArtifactInfo('ARCHITECTURE');
    const arch = architectures[0];
    const techCount = technologies.length;
    const approvedComponents = (arch?.components || []).filter(c => c.reviewStatus === 'APPROVED' || c.status === 'APPROVED' || (!c.reviewStatus && !c.status));
    const compCount = approvedComponents.length;
    const hasStack = Boolean(arch?.frontend || arch?.backend || arch?.database);

    let archStatus = 'INSUFFICIENT';
    const archMissing = [];
    if (!arch && techCount === 0 && compCount === 0) {
      archMissing.push('La información arquitectónica es insuficiente (no hay componentes ni tecnologías)');
    } else if (compCount >= 3 || (techCount >= 3 && hasStack)) {
      archStatus = 'SUFFICIENT';
    } else {
      archStatus = 'PARTIAL';
      archMissing.push('Se identificaron tecnologías, pero faltan componentes o relaciones en capas');
    }

    const archOutdated = checkIsOutdated(archArtifact.generatedAt, [
      ...(arch ? [arch] : []),
      ...approvedComponents,
      ...technologies
    ]);

    return {
      projectId: project.id,
      projectName: project.name,
      evaluatedAt: new Date().toISOString(),
      diagrams: {
        USE_CASE: {
          key: 'USE_CASE',
          title: 'Diagrama de Casos de Uso',
          status: ucStatus,
          canGenerate: ucStatus !== 'INSUFFICIENT',
          summary: `${actorsCount} actor${actorsCount !== 1 ? 'es' : ''} aprobado${actorsCount !== 1 ? 's' : ''} · ${totalApprovedFunctional} requisito${totalApprovedFunctional !== 1 ? 's' : ''} aprobado${totalApprovedFunctional !== 1 ? 's' : ''}`,
          missing: ucMissing,
          metrics: { actors: actorsCount, functionalRequirements: totalApprovedFunctional },
          isGenerated: ucArtifact.isGenerated,
          generatedAt: ucArtifact.generatedAt,
          isOutdated: ucOutdated,
          technicalError: ucArtifact.technicalError
        },
        ER: {
          key: 'ER',
          title: 'Diagrama Entidad-Relación',
          status: erStatus,
          canGenerate: erStatus !== 'INSUFFICIENT',
          summary: `${entitiesCount} entidad${entitiesCount !== 1 ? 'es' : ''} aprobada${entitiesCount !== 1 ? 's' : ''} · ${relCount} relaci${relCount !== 1 ? 'ones' : 'ón'}`,
          missing: erMissing,
          metrics: { entities: entitiesCount, relationships: relCount },
          isGenerated: erArtifact.isGenerated,
          generatedAt: erArtifact.generatedAt,
          isOutdated: erOutdated,
          technicalError: erArtifact.technicalError
        },
        CLASS: {
          key: 'CLASS',
          title: 'Diagrama de Clases',
          status: classStatus,
          canGenerate: classStatus !== 'INSUFFICIENT',
          summary: classesCount > 0 ? `${classesCount} clases definidas` : `${entitiesCount} entidades base`,
          missing: classMissing,
          metrics: { classes: classesCount, entities: entitiesCount },
          isGenerated: classArtifact.isGenerated,
          generatedAt: classArtifact.generatedAt,
          isOutdated: classOutdated,
          technicalError: classArtifact.technicalError
        },
        NAVIGATION: {
          key: 'NAVIGATION',
          title: 'Árbol de Navegación',
          status: navStatus,
          canGenerate: navStatus !== 'INSUFFICIENT',
          summary: `${screensCount || navNodesCount} pantallas / módulos detectados`,
          missing: navMissing,
          metrics: { screens: screensCount, nodes: navNodesCount },
          isGenerated: navArtifact.isGenerated,
          generatedAt: navArtifact.generatedAt,
          isOutdated: navOutdated,
          technicalError: navArtifact.technicalError
        },
        ARCHITECTURE: {
          key: 'ARCHITECTURE',
          title: 'Diagrama de Arquitectura',
          status: archStatus,
          canGenerate: archStatus !== 'INSUFFICIENT',
          summary: compCount > 0 ? `${compCount} componentes en capas` : `${techCount} tecnologías identificadas`,
          missing: archMissing,
          metrics: { components: compCount, technologies: techCount },
          isGenerated: archArtifact.isGenerated,
          generatedAt: archArtifact.generatedAt,
          isOutdated: archOutdated,
          technicalError: archArtifact.technicalError
        }
      }
    };
  }
}

module.exports = new DiagramAvailabilityService();
