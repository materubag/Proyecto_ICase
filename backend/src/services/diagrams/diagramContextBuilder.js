/**
 * Builds compact, structured JSON contexts tailored specifically for each Mermaid diagram type.
 * Never sends raw PDFs, unparsed text, or extraneous project data.
 */
class DiagramContextBuilder {
  /**
   * Builds the reduced payload for a specific diagram type.
   * @param {string} diagramType - 'USE_CASE' | 'ER' | 'CLASS' | 'NAVIGATION' | 'ARCHITECTURE'
   * @param {Object} project - Loaded project with relations
   * @returns {Object} Clean compact context
   */
  buildContext(diagramType, project) {
    const projectName = project.name || 'Sistema de Software';

    switch (diagramType) {
      case 'USE_CASE':
        return this.buildUseCaseContext(project, projectName);
      case 'ER':
        return this.buildERContext(project, projectName);
      case 'CLASS':
        return this.buildClassContext(project, projectName);
      case 'NAVIGATION':
        return this.buildNavigationContext(project, projectName);
      case 'ARCHITECTURE':
        return this.buildArchitectureContext(project, projectName);
      default:
        throw new Error(`Tipo de diagrama no soportado: ${diagramType}`);
    }
  }

  buildUseCaseContext(project, projectName) {
    // Only approved actors
    const approvedActors = (project.actors || []).filter(a => a.reviewStatus === 'APPROVED' || a.status === 'APPROVED');
    const actors = approvedActors.map(a => ({
      code: a.codeId || `ACT-${a.name.slice(0, 3).toUpperCase()}`,
      name: a.name.trim(),
      description: (a.description || '').slice(0, 140)
    }));

    // Prioritize approved use cases
    const useCases = (project.useCases || [])
      .filter(uc => uc.reviewStatus === 'APPROVED' || uc.status === 'APPROVED')
      .map(uc => ({
        code: uc.code || uc.codeId || 'CU',
        name: uc.name,
        actor: uc.actor || 'Usuario',
        description: (uc.description || '').slice(0, 140)
      }));

    // Only approved functional requirements
    let functionalReqs = (project.requirements || [])
      .filter(r => r.status === 'APPROVED' && (r.type === 'FUNCTIONAL' || !r.type))
      .slice(0, 30)
      .map(r => ({
        code: r.code || 'RF',
        name: r.name,
        description: (r.description || '').slice(0, 160),
        actorIds: r.actorIds || []
      }));

    // Fallback: also check approved candidates if regular requirements are empty
    if (functionalReqs.length === 0 && project.requirementCandidates) {
      functionalReqs = project.requirementCandidates
        .filter(c => c.status === 'APPROVED' && (c.type === 'FUNCTIONAL' || !c.type))
        .slice(0, 30)
        .map(c => ({
          code: c.temporaryCode || 'RF',
          name: c.title || c.statement?.slice(0, 60),
          description: (c.statement || '').slice(0, 160),
          actorIds: []
        }));
    }

    return {
      diagramType: 'USE_CASE',
      project: { name: projectName },
      actors: actors.length > 0 ? actors : [{ code: 'ACT-01', name: 'Usuario del Sistema', description: 'Operador principal' }],
      useCases: useCases.length > 0 ? useCases : undefined,
      functionalRequirements: functionalReqs
    };
  }

  buildERContext(project, projectName) {
    // Only approved entities
    const approvedEntities = (project.entities || []).filter(e => e.reviewStatus === 'APPROVED' || e.status === 'APPROVED');
    const entities = approvedEntities.map(e => ({
      name: e.name.trim(),
      description: (e.description || '').slice(0, 100),
      attributes: (e.attributes || []).map(a => ({
        name: a.name.trim(),
        type: a.type || 'String',
        isPk: Boolean(a.isPk)
      }))
    }));

    const approvedRelationships = (project.relationships || []).filter(r => r.reviewStatus === 'APPROVED' || r.status === 'APPROVED' || (!r.reviewStatus && !r.status));
    const relationships = approvedRelationships.map(r => ({
      source: r.source.trim(),
      target: r.target.trim(),
      cardinality: r.cardinality || '1:N',
      description: (r.description || '').slice(0, 100)
    }));

    return {
      diagramType: 'ER',
      project: { name: projectName },
      entities,
      relationships
    };
  }

  buildClassContext(project, projectName) {
    // Only approved classModels
    const approvedClasses = (project.classModels || []).filter(c => c.reviewStatus === 'APPROVED' || c.status === 'APPROVED');
    if (approvedClasses.length > 0) {
      const classes = approvedClasses.map(c => ({
        name: c.name,
        description: (c.description || '').slice(0, 100),
        attributes: Array.isArray(c.attributes) ? c.attributes : [],
        methods: Array.isArray(c.methods) ? c.methods : [],
        relationships: Array.isArray(c.relationships) ? c.relationships : []
      }));
      return {
        diagramType: 'CLASS',
        project: { name: projectName },
        classes
      };
    }

    // Otherwise derive from approved entities
    const approvedEntities = (project.entities || []).filter(e => e.reviewStatus === 'APPROVED' || e.status === 'APPROVED');
    const classes = approvedEntities.map(e => ({
      name: e.name.trim(),
      attributes: (e.attributes || []).map(a => ({
        name: a.name,
        type: a.type || 'String',
        visibility: '+'
      })),
      methods: [
        { name: `crear${e.name}`, returnType: 'boolean', visibility: '+' },
        { name: `obtener${e.name}`, returnType: e.name, visibility: '+' }
      ]
    }));

    const approvedRelationships = (project.relationships || []).filter(r => r.reviewStatus === 'APPROVED' || r.status === 'APPROVED' || (!r.reviewStatus && !r.status));
    const relationships = approvedRelationships.map(r => ({
      source: r.source.trim(),
      target: r.target.trim(),
      cardinality: r.cardinality || '1:N',
      type: r.cardinality?.includes('N') ? 'Association' : 'Composition'
    }));

    return {
      diagramType: 'CLASS',
      project: { name: projectName },
      classes,
      relationships
    };
  }

  buildNavigationContext(project, projectName) {
    const approvedScreens = (project.screens || []).filter(
      s => s.reviewStatus === 'APPROVED' || s.status === 'APPROVED' || (!s.reviewStatus && !s.status)
    );
    const screens = approvedScreens.map(s => ({
      code: s.codeId || 'SCR',
      name: s.name.trim(),
      route: s.route || `/${s.name.toLowerCase().replace(/\s+/g, '-')}`,
      purpose: (s.purpose || s.description || '').slice(0, 120)
    }));

    const transitions = (project.navigationNodes || []).map(n => ({
      from: n.from.trim(),
      to: n.to.trim(),
      action: n.action || 'Navegacion'
    }));

    // Determine inference mode
    const hasTransitions = transitions.length > 0;

    // Include approved functional requirements for inference
    const approvedReqs = (project.requirements || [])
      .filter(r => r.status === 'APPROVED' && (r.type === 'FUNCTIONAL' || !r.type))
      .slice(0, 40)
      .map(r => ({
        code: r.code || r.codeId || 'RF',
        name: r.name,
        description: (r.description || '').slice(0, 160),
        screens: r.screenIds || []
      }));

    // Include approved use cases for inference
    const approvedUseCases = (project.useCases || [])
      .filter(uc => uc.reviewStatus === 'APPROVED' || uc.status === 'APPROVED')
      .slice(0, 20)
      .map(uc => ({
        code: uc.code || uc.codeId || 'CU',
        name: uc.name,
        actor: uc.actor || 'Usuario',
        description: (uc.description || '').slice(0, 120)
      }));

    // Include actors for context
    const approvedActors = (project.actors || [])
      .filter(a => a.reviewStatus === 'APPROVED' || a.status === 'APPROVED')
      .map(a => ({ name: a.name, description: (a.description || '').slice(0, 80) }));

    const ctx = {
      diagramType: 'NAVIGATION',
      project: { name: projectName },
      inferMode: hasTransitions ? 'EXPLICIT' : 'INFERRED',
      screens,
      transitions
    };

    // Only attach inference helpers when there are no explicit transitions
    if (!hasTransitions) {
      ctx.functionalRequirements = approvedReqs;
      ctx.useCases = approvedUseCases.length > 0 ? approvedUseCases : undefined;
      ctx.actors = approvedActors.length > 0 ? approvedActors : undefined;
      ctx.inferenceNote = [
        'No existen transiciones de navegacion registradas.',
        'Infiere el flujo a partir de las pantallas, requisitos funcionales y casos de uso.',
        'Usa logica de dominio para determinar como navega el usuario entre pantallas.',
        'Punto de entrada tipico: Login o pantalla principal.',
        'El Dashboard suele conectar a los modulos principales.',
        'Cada modulo de gestion conecta a una vista de detalle/formulario.',
        'No conectes arbitrariamente pantallas sin relacion funcional.'
      ];
    }

    return ctx;
  }

  buildArchitectureContext(project, projectName) {
    const arch = project.architectures?.[0];
    const technologies = (project.technologies || []).map(t => ({
      name: t.name,
      category: t.category
    }));

    const components = (arch?.components || []).map(c => ({
      name: c.name,
      layer: c.layer || 'Application',
      type: c.type || 'component'
    }));

    return {
      diagramType: 'ARCHITECTURE',
      project: { name: projectName },
      style: arch?.style || 'Clean Architecture en 3 Capas',
      frontend: arch?.frontend || 'React SPA',
      backend: arch?.backend || 'Node.js / Express REST API',
      database: arch?.database || 'PostgreSQL 16',
      components,
      technologies,
      connections: arch?.connections || []
    };
  }
}

module.exports = new DiagramContextBuilder();
