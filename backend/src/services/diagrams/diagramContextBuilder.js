const { toSafeIdentifier, normalizeDataType, toSafeLabel } = require('./mermaidNormalizer');
const deduplicationService = require('../analysis/deduplicationService');

/**
 * Builds compact, structured JSON contexts tailored specifically for each Mermaid diagram type.
 * Never sends raw PDFs, unparsed text, or extraneous project data.
 */
class DiagramContextBuilder {
  /**
   * Builds the reduced payload for a specific diagram type.
   * @param {string} diagramType - 'USE_CASE' | 'ER' | 'CLASS' | 'FLOWCHART' | 'NAVIGATION' | 'ARCHITECTURE'
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
      case 'FLOWCHART':
        return this.buildFlowchartContext(project, projectName);
      case 'NAVIGATION':
        return this.buildNavigationContext(project, projectName);
      case 'ARCHITECTURE':
        return this.buildArchitectureContext(project, projectName);
      default:
        throw new Error(`Tipo de diagrama no soportado: ${diagramType}`);
    }
  }

  buildUseCaseContext(project, projectName) {
    const actors=(project.actors || []).filter(a=>!a.isDeleted).map(a=>({id:a.id,code:a.codeId,name:a.name,description:a.description || ''}));
    const useCases=(project.useCases || []).filter(c=>!c.isDeleted).map(c=>({id:c.id,code:c.code || c.codeId,name:c.name,description:c.description || '',actorIds:require('../analysis/actorIdentity').useCaseActors(c)}));
    const functionalRequirements=(project.requirements || []).filter(r=>!r.isDeleted && r.type==='FUNCTIONAL').map(r=>({id:r.id,code:r.code,name:r.name,description:r.description || '',actorIds:r.actorIds || []}));
    return {diagramType:'USE_CASE',project:{name:projectName},actors,useCases,functionalRequirements};
  }

  /**
   * Safe baseline attributes for domain entities when extracted data is sparse or missing.
   */
  getBaselineAttributes(entityName) {
    const norm = (entityName || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (norm.includes('CLIENTE')) {
      return [
        { name: 'id', type: 'int', isPk: true },
        { name: 'nombre', type: 'string', isPk: false },
        { name: 'telefono', type: 'string', isPk: false },
        { name: 'email', type: 'string', isPk: false },
        { name: 'direccion', type: 'string', isPk: false }
      ];
    }
    if (norm.includes('VEHICULO') || norm.includes('AUTO') || norm.includes('CARRO')) {
      return [
        { name: 'id', type: 'int', isPk: true },
        { name: 'placa', type: 'string', isPk: false },
        { name: 'marca', type: 'string', isPk: false },
        { name: 'modelo', type: 'string', isPk: false },
        { name: 'anio', type: 'int', isPk: false },
        { name: 'cliente_id', type: 'int', isPk: false, isFk: true }
      ];
    }
    if (norm.includes('CITA')) {
      return [
        { name: 'id', type: 'int', isPk: true },
        { name: 'fecha_hora', type: 'datetime', isPk: false },
        { name: 'estado', type: 'string', isPk: false },
        { name: 'motivo', type: 'string', isPk: false },
        { name: 'cliente_id', type: 'int', isPk: false, isFk: true },
        { name: 'vehiculo_id', type: 'int', isPk: false, isFk: true }
      ];
    }
    if (norm.includes('ORDEN') || norm.includes('TRABAJO') || norm.includes('SERVICIOORDEN')) {
      return [
        { name: 'id', type: 'int', isPk: true },
        { name: 'numero_orden', type: 'string', isPk: false },
        { name: 'fecha_ingreso', type: 'datetime', isPk: false },
        { name: 'estado', type: 'string', isPk: false },
        { name: 'diagnostico', type: 'string', isPk: false },
        { name: 'total', type: 'float', isPk: false },
        { name: 'vehiculo_id', type: 'int', isPk: false, isFk: true },
        { name: 'usuario_id', type: 'int', isPk: false, isFk: true }
      ];
    }
    if (norm.includes('PRODUCTO') || norm.includes('REPUESTO') || norm.includes('PARTE')) {
      return [
        { name: 'id', type: 'int', isPk: true },
        { name: 'codigo', type: 'string', isPk: false },
        { name: 'nombre', type: 'string', isPk: false },
        { name: 'categoria', type: 'string', isPk: false },
        { name: 'precio', type: 'float', isPk: false },
        { name: 'costo', type: 'float', isPk: false },
        { name: 'stock', type: 'int', isPk: false }
      ];
    }
    if (norm.includes('SERVICIO')) {
      return [
        { name: 'id', type: 'int', isPk: true },
        { name: 'codigo', type: 'string', isPk: false },
        { name: 'nombre', type: 'string', isPk: false },
        { name: 'descripcion', type: 'string', isPk: false },
        { name: 'precio_mano_obra', type: 'float', isPk: false }
      ];
    }
    if (norm.includes('PROVEEDOR')) {
      return [
        { name: 'id', type: 'int', isPk: true },
        { name: 'ruc_nit', type: 'string', isPk: false },
        { name: 'razon_social', type: 'string', isPk: false },
        { name: 'contacto', type: 'string', isPk: false },
        { name: 'telefono', type: 'string', isPk: false },
        { name: 'email', type: 'string', isPk: false }
      ];
    }
    if (norm.includes('USUARIO') || norm.includes('EMPLEADO') || norm.includes('MECANICO') || norm.includes('OPERADOR')) {
      return [
        { name: 'id', type: 'int', isPk: true },
        { name: 'nombre_completo', type: 'string', isPk: false },
        { name: 'email', type: 'string', isPk: false },
        { name: 'rol', type: 'string', isPk: false },
        { name: 'estado', type: 'string', isPk: false }
      ];
    }
    if (norm.includes('VENTA') || norm.includes('FACTURA') || norm.includes('PAGO')) {
      return [
        { name: 'id', type: 'int', isPk: true },
        { name: 'numero_comprobante', type: 'string', isPk: false },
        { name: 'fecha', type: 'datetime', isPk: false },
        { name: 'monto_total', type: 'float', isPk: false },
        { name: 'metodo_pago', type: 'string', isPk: false },
        { name: 'cliente_id', type: 'int', isPk: false, isFk: true }
      ];
    }
    if (norm.includes('INVENTARIO') || norm.includes('STOCK')) {
      return [
        { name: 'id', type: 'int', isPk: true },
        { name: 'producto_id', type: 'int', isPk: false, isFk: true },
        { name: 'cantidad_actual', type: 'int', isPk: false },
        { name: 'stock_minimo', type: 'int', isPk: false },
        { name: 'ubicacion', type: 'string', isPk: false }
      ];
    }
    if (norm.includes('DETALLE')) {
      return [
        { name: 'id', type: 'int', isPk: true },
        { name: 'cantidad', type: 'int', isPk: false },
        { name: 'precio_unitario', type: 'float', isPk: false },
        { name: 'subtotal', type: 'float', isPk: false }
      ];
    }

    return [
      { name: 'id', type: 'int', isPk: true },
      { name: 'nombre', type: 'string', isPk: false },
      { name: 'descripcion', type: 'string', isPk: false },
      { name: 'estado', type: 'string', isPk: false },
      { name: 'fecha_creacion', type: 'datetime', isPk: false }
    ];
  }

  /**
   * Sanitizes attributes: removes descriptive sentences (e.g. 'claridad_la_falla'),
   * enforces ASCII identifiers, and guarantees a primary key.
   */
  sanitizeEntityAttributes(rawAttributes, entityName) {
    const valid = [];
    const seenNames = new Set();
    let hasPk = false;

    for (const a of (rawAttributes || [])) {
      const rawName = (a.name || '').trim();
      const safeName = toSafeIdentifier(rawName, 'attr').toLowerCase();

      // Filter out garbage / sentence attributes
      if (
        /claridad|satisfaccion|calidad_del|atencion|falla_del|problema_con/i.test(safeName) ||
        safeName.length > 25 ||
        safeName.split('_').length > 4
      ) {
        continue;
      }

      if (seenNames.has(safeName)) continue;
      seenNames.add(safeName);

      const isPk = Boolean(a.isPk);
      if (isPk) hasPk = true;

      valid.push({
        name: safeName,
        type: normalizeDataType(a.type),
        isPk,
        isFk: Boolean(a.isFk)
      });
    }

    // If no valid attributes or fewer than 2, enrich with baseline domain attributes
    if (valid.length < 2) {
      const baselines = this.getBaselineAttributes(entityName);
      for (const base of baselines) {
        if (!seenNames.has(base.name)) {
          seenNames.add(base.name);
          valid.push(base);
          if (base.isPk) hasPk = true;
        }
      }
    }

    // Guarantee at least one PK
    if (!hasPk) {
      if (valid.length > 0 && /^(id|codigo)/i.test(valid[0].name)) {
        valid[0].isPk = true;
      } else {
        valid.unshift({ name: 'id', type: 'int', isPk: true, isFk: false });
      }
    }

    return valid;
  }

  buildERContext(project, projectName) {
    const deduplicationService = require('../analysis/deduplicationService');

    // Extract approved entities
    const approvedEntities = (project.entities || []).filter(e => e.reviewStatus === 'APPROVED' || e.status === 'APPROVED');
    const entities = approvedEntities.map(e => {
      const safeEntityId = toSafeIdentifier(e.name, 'ENT').toUpperCase();
      const cleanAttrs = this.sanitizeEntityAttributes(e.attributes, e.name);

      return {
        id: safeEntityId,
        name: safeEntityId,
        displayName: e.name.trim(),
        description: toSafeLabel(e.description || '', 100),
        attributes: cleanAttrs.map(a => ({
          name: a.name,
          type: a.type,
          isPk: a.isPk,
          isFk: a.isFk
        }))
      };
    });

    const approvedRelationships = (project.relationships || []).filter(
      r => r.reviewStatus === 'APPROVED' || r.status === 'APPROVED' || (!r.reviewStatus && !r.status)
    );
    const relationships = approvedRelationships.map(r => ({
      source: toSafeIdentifier(r.source, 'ENT').toUpperCase(),
      target: toSafeIdentifier(r.target, 'ENT').toUpperCase(),
      cardinality: r.cardinality || '1:N',
      description: toSafeLabel(r.description || 'relaciona', 80)
    }));

    // Extract rich context from project
    const candidates = project.modelCandidates || [];
    const processes = candidates
      .filter(c => c.kind === 'PROCESS')
      .slice(0, 15)
      .map(p => ({
        name: p.name,
        description: toSafeLabel(typeof p.content === 'string' ? p.content : p.content?.description || p.name, 140)
      }));

    const businessRules = [
      ...(project.businessRules || []).map(b => ({ code: b.code || 'RN', description: toSafeLabel(b.description || b.name, 140) })),
      ...candidates.filter(c => c.kind === 'RULE').map(r => ({ code: 'RN', description: toSafeLabel(r.name, 140) }))
    ].slice(0, 12);

    const scopeObjectives = candidates
      .filter(c => c.kind === 'OBJECTIVE')
      .slice(0, 8)
      .map(o => toSafeLabel(o.name, 120));

    const constraints = candidates
      .filter(c => c.kind === 'CONSTRAINT')
      .slice(0, 6)
      .map(c => toSafeLabel(c.name, 120));

    const actors = (project.actors || [])
      .filter(a => a.reviewStatus === 'APPROVED' || a.status === 'APPROVED')
      .map(a => ({ name: a.name.trim(), role: toSafeLabel(a.description || 'Actor del sistema', 80) }));

    const dataReqs = deduplicationService.selectRelevantRequirements(project.requirements || [], 'ER', 25)
      .map(r => ({ code: r.code, text: toSafeLabel(r.description || r.name, 150) }));

    return {
      diagramType: 'ER',
      project: { name: projectName },
      entities,
      relationships,
      processes,
      businessRules,
      scopeObjectives,
      constraints,
      actors,
      dataRequirements: dataReqs,
      modelingGuidelines: {
        prohibitEmptyEntities: true,
        prohibitDescriptiveSentencePKs: true,
        resolveManytoManyWithAssociativeEntity: true
      }
    };
  }

  buildClassContext(project, projectName) {
    const candidates = project.modelCandidates || [];
    const processes = candidates.filter(c => c.kind === 'PROCESS');
    const approvedUseCases = (project.useCases || []).filter(uc => uc.reviewStatus === 'APPROVED' || uc.status === 'APPROVED');
    const approvedEntities = (project.entities || []).filter(e => e.reviewStatus === 'APPROVED' || e.status === 'APPROVED');

    // Filter out technical infrastructure classes (e.g. AuthenticationService)
    const rawClassModels = (project.classModels || []).filter(
      c => (c.reviewStatus === 'APPROVED' || c.status === 'APPROVED') &&
           !/AuthenticationService|JwtService|TokenService|N8nService/i.test(c.name)
    );

    let classes = [];

    if (rawClassModels.length > 0) {
      classes = rawClassModels.map(c => {
        const safeName = toSafeIdentifier(c.name, 'Class');
        const pascalName = safeName.charAt(0).toUpperCase() + safeName.slice(1);
        const attrs = (Array.isArray(c.attributes) ? c.attributes : []).map(a => {
          const rawName = toSafeIdentifier(a.name || a, 'attr');
          const camelName = rawName.charAt(0).toLowerCase() + rawName.slice(1);
          return {
            name: camelName,
            type: normalizeDataType(a.type || 'string'),
            visibility: a.visibility || '+'
          };
        });

        // Filter out generic methods (getId, setId, toDTO, validate, save)
        const methods = (Array.isArray(c.methods) ? c.methods : [])
          .filter(m => {
            const mName = (m.name || m).toLowerCase();
            return !/\b(?:getid|setid|todto|validate|validarreglas|save)\b/.test(mName);
          })
          .map(m => {
            const rawM = toSafeIdentifier(m.name || m, 'operacion');
            const camelM = rawM.charAt(0).toLowerCase() + rawM.slice(1);
            return {
              name: camelM,
              returnType: toSafeIdentifier(m.returnType || 'void', 'type'),
              visibility: m.visibility || '+'
            };
          });

        return {
          id: pascalName,
          name: pascalName,
          displayName: c.name,
          description: toSafeLabel(c.description || '', 100),
          attributes: attrs.length > 0 ? attrs : this.getBaselineClassAttributes(pascalName),
          methods: methods.length > 0 ? methods : this.deriveDomainMethods(pascalName, processes, approvedUseCases)
        };
      });
    } else {
      // Derive classes directly from approved entities
      classes = approvedEntities.map(e => {
        const safeName = toSafeIdentifier(e.name, 'Class');
        const pascalName = safeName.charAt(0).toUpperCase() + safeName.slice(1);
        const cleanAttrs = this.sanitizeEntityAttributes(e.attributes, e.name);

        const classAttrs = cleanAttrs.map(a => {
          const rawA = a.name;
          const camelA = rawA.charAt(0).toLowerCase() + rawA.slice(1);
          return {
            name: camelA,
            type: a.type,
            visibility: '+'
          };
        });

        const derivedMethods = this.deriveDomainMethods(pascalName, processes, approvedUseCases);

        return {
          id: pascalName,
          name: pascalName,
          displayName: e.name.trim(),
          attributes: classAttrs,
          methods: derivedMethods
        };
      });
    }

    // Extract relationships between domain classes
    const approvedRelationships = (project.relationships || []).filter(
      r => r.reviewStatus === 'APPROVED' || r.status === 'APPROVED' || (!r.reviewStatus && !r.status)
    );
    const seenEdges = new Set();
    const relationships = [];
    for (const r of approvedRelationships) {
      const srcName = toSafeIdentifier(r.source, 'Class');
      const tgtName = toSafeIdentifier(r.target, 'Class');
      const s = srcName.charAt(0).toUpperCase() + srcName.slice(1);
      const t = tgtName.charAt(0).toUpperCase() + tgtName.slice(1);
      const edgeKey = `${s}-->${t}`;
      const revKey = `${t}-->${s}`;
      if (!seenEdges.has(edgeKey) && !seenEdges.has(revKey)) {
        seenEdges.add(edgeKey);
        relationships.push({
          source: s,
          target: t,
          cardinality: r.cardinality || '1:N',
          type: 'Association',
          label: toSafeLabel(r.description || r.verb || 'relaciona', 30)
        });
      }
    }

    return {
      diagramType: 'CLASS',
      project: { name: projectName },
      functionalRequirements: (project.requirements||[]).filter(r=>!r.isDeleted&&r.status!=='REMOVED'&&r.type==='FUNCTIONAL').map(r=>({id:r.id,code:r.code,name:r.name,description:r.description||r.name})),
      classes,
      relationships,
      domainProcesses: processes.slice(0, 10).map(p => p.name),
      domainUseCases: approvedUseCases.slice(0, 12).map(u => ({ name: u.name, actor: u.actor })),
      businessRules: (project.businessRules || []).slice(0, 6).map(r => r.description || r.name),
      guidelines: {
        prohibitInfrastructureClasses: true,
        prohibitGenericProgrammingMethods: true,
        requireRealDomainOperations: true
      }
    };
  }

  getBaselineClassAttributes(className) {
    const raw = this.getBaselineAttributes(className);
    return raw.map(a => ({
      name: a.name.charAt(0).toLowerCase() + a.name.slice(1),
      type: a.type,
      visibility: '+'
    }));
  }

  deriveDomainMethods(className, processes = [], useCases = []) {
    const norm = className.toUpperCase().replace(/[^A-Z]/g, '');
    const methods = [];

    // Find any use cases or processes matching class
    const matches = [
      ...useCases.filter(u => (u.name || '').toLowerCase().includes(className.toLowerCase())),
      ...processes.filter(p => (p.name || '').toLowerCase().includes(className.toLowerCase()))
    ];

    for (const m of matches) {
      const safe = toSafeIdentifier(m.name, 'op');
      const camel = safe.charAt(0).toLowerCase() + safe.slice(1);
      if (!methods.some(existing => existing.name === camel)) {
        methods.push({ name: camel, returnType: 'void', visibility: '+' });
      }
    }

    if (methods.length > 0) {
      return methods.slice(0, 4);
    }

    // Default domain operations based on business role of entity
    if (norm.includes('CLIENTE')) {
      return [
        { name: 'registrar', returnType: 'void', visibility: '+' },
        { name: 'actualizarDatos', returnType: 'void', visibility: '+' },
        { name: 'consultarHistorial', returnType: 'Historial', visibility: '+' }
      ];
    }
    if (norm.includes('VEHICULO') || norm.includes('AUTO')) {
      return [
        { name: 'registrar', returnType: 'void', visibility: '+' },
        { name: 'actualizarKilometraje', returnType: 'void', visibility: '+' },
        { name: 'asignarPropietario', returnType: 'void', visibility: '+' }
      ];
    }
    if (norm.includes('CITA')) {
      return [
        { name: 'agendar', returnType: 'void', visibility: '+' },
        { name: 'reprogramar', returnType: 'void', visibility: '+' },
        { name: 'cancelar', returnType: 'void', visibility: '+' }
      ];
    }
    if (norm.includes('ORDEN') || norm.includes('TRABAJO')) {
      return [
        { name: 'crear', returnType: 'void', visibility: '+' },
        { name: 'asignarMecanico', returnType: 'void', visibility: '+' },
        { name: 'actualizarEstado', returnType: 'void', visibility: '+' },
        { name: 'calcularTotal', returnType: 'Decimal', visibility: '+' }
      ];
    }
    if (norm.includes('PRODUCTO') || norm.includes('REPUESTO')) {
      return [
        { name: 'actualizarStock', returnType: 'void', visibility: '+' },
        { name: 'verificarDisponibilidad', returnType: 'Boolean', visibility: '+' }
      ];
    }
    if (norm.includes('SERVICIO')) {
      return [
        { name: 'cotizar', returnType: 'Decimal', visibility: '+' },
        { name: 'actualizarPrecio', returnType: 'void', visibility: '+' }
      ];
    }
    if (norm.includes('VENTA') || norm.includes('FACTURA')) {
      return [
        { name: 'emitirComprobante', returnType: 'void', visibility: '+' },
        { name: 'calcularTotal', returnType: 'Decimal', visibility: '+' },
        { name: 'procesarPago', returnType: 'Boolean', visibility: '+' }
      ];
    }
    if (norm.includes('INVENTARIO')) {
      return [
        { name: 'ingresarStock', returnType: 'void', visibility: '+' },
        { name: 'descontarStock', returnType: 'void', visibility: '+' },
        { name: 'alertaStockMinimo', returnType: 'Boolean', visibility: '+' }
      ];
    }

    return [
      { name: 'registrar', returnType: 'void', visibility: '+' },
      { name: 'actualizar', returnType: 'void', visibility: '+' }
    ];
  }

  buildFlowchartContext(project, projectName) {
    return {diagramType:'FLOWCHART',project:{name:projectName},steps:(project.requirements||[]).filter(r=>!r.isDeleted&&r.status!=='REMOVED'&&r.type==='FUNCTIONAL').map(r=>({id:r.id,code:r.code,name:r.name,description:r.description||r.name})),ruleDecisions:[]};
  }

  buildNavigationContext(project, projectName) {
    const approvedScreens = (project.screens || []).filter(
      s => s.reviewStatus === 'APPROVED' || s.status === 'APPROVED' || (!s.reviewStatus && !s.status)
    );
    const screens = approvedScreens.map((s, idx) => {
      const safeId = 'SCR_' + toSafeIdentifier(s.name, `screen_${idx + 1}`).toUpperCase().slice(0, 30);
      return {
        id: s.id||safeId,
        code: s.codeId || 'SCR',
        name: s.name.trim(),
        displayName: s.name.trim(),
        route: s.route || `/${toSafeIdentifier(s.name).toLowerCase()}`,
        purpose: toSafeLabel(s.purpose || s.description || '', 120),
        parentId: s.parentId || null
      };
    });

    return {
      diagramType: 'NAVIGATION',
      project: { name: projectName },
      functionalRequirements:(project.requirements||[]).filter(r=>!r.isDeleted&&r.status!=='REMOVED'&&r.type==='FUNCTIONAL').map(r=>({id:r.id,code:r.code,name:r.name,description:r.description||r.name})),
      navigationNodes:(project.navigationNodes||[]).filter(n=>!n.isDeleted).map(n=>({id:n.id,name:n.name,parentId:n.parentId,route:n.route})),
      hierarchyTitle: `Árbol de Navegación de ${projectName}`,
      screens
    };
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

    // Find technology specific to project, avoid generic hardcoded defaults
    const feTech = technologies.find(t => t.category?.toUpperCase() === 'FRONTEND')?.name;
    const beTech = technologies.find(t => t.category?.toUpperCase() === 'BACKEND')?.name;
    const dbTech = technologies.find(t => t.category?.toUpperCase() === 'DATABASE')?.name;

    return {
      diagramType: 'ARCHITECTURE',
      project: { name: projectName },
      style: arch?.style || 'Arquitectura Multicapa (Capas Lógicas)',
      frontend: arch?.frontend || feTech || 'Capa de Presentación / Cliente Web',
      backend: arch?.backend || beTech || 'Capa de Aplicación / Servicios API',
      database: arch?.database || dbTech || 'Capa de Persistencia / Base de Datos',
      components,
      technologies,
      connections: arch?.connections || []
    };
  }
}

module.exports = new DiagramContextBuilder();
