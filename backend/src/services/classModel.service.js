const prisma = require('../config/prisma');
const versionHistoryService = require('./versionHistory.service');

class ClassModelService {
  async getClassesByProject(projectId) {
    return await prisma.classModel.findMany({
      where: { projectId, isDeleted: false },
      orderBy: { name: 'asc' }
    });
  }

  async createClass(projectId, data) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Proyecto no encontrado');

    const created = await prisma.classModel.create({
      data: {
        projectId,
        codeId: data.codeId || null,
        name: data.name.trim(),
        description: data.description ? data.description.trim() : null,
        attributes: data.attributes || [],
        methods: data.methods || [],
        relationships: data.relationships || [],
        reviewStatus: data.reviewStatus || 'PENDING',
        isDeleted: false
      }
    });

    await versionHistoryService.recordSnapshot(
      projectId,
      'CLASS',
      created.id,
      'CREATED',
      created,
      `Creación de clase ${created.name}`
    );

    return created;
  }

  async updateClass(id, data) {
    const existing = await prisma.classModel.findUnique({ where: { id } });
    if (!existing) throw new Error('Clase no encontrada');

    return await prisma.classModel.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description ? data.description.trim() : null }),
        ...(data.attributes !== undefined && { attributes: data.attributes }),
        ...(data.methods !== undefined && { methods: data.methods }),
        ...(data.relationships !== undefined && { relationships: data.relationships }),
        ...(data.reviewStatus !== undefined && { reviewStatus: data.reviewStatus })
      }
    });
  }

  async updateStatus(id, reviewStatus) {
    return await prisma.classModel.update({
      where: { id },
      data: { reviewStatus }
    });
  }

  async deleteClass(id) {
    const existing = await prisma.classModel.findUnique({ where: { id } });
    if (!existing) throw new Error('Clase no encontrada');

    await versionHistoryService.recordSnapshot(
      existing.projectId,
      'CLASS',
      id,
      'DELETED',
      existing,
      `Eliminación de clase ${existing.name}`
    );

    return await prisma.classModel.delete({ where: { id } });
  }

  /**
   * Genera el modelado de clases orientado a objetos a partir de las entidades y arquitectura.
   */
  async generateClassesFromEntities(projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        entities: { include: { attributes: true } },
        relationships: true
      }
    });

    if (!project) throw new Error('Proyecto no encontrado');

    // Limpiar clases previas
    await prisma.classModel.deleteMany({ where: { projectId } });

    const classesToCreate = [];

    // 1. Clases de Entidades de Dominio documentadas en el proyecto
    for (const ent of project.entities) {
      const cleanClassName = ent.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_]/g, ' ').trim();
      const pascalName = cleanClassName.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('') || 'Entidad';

      const attrs = (ent.attributes || []).map(a => {
        const rawName = a.name || 'attr';
        const cleanName = rawName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_]/g, ' ').trim();
        const camelName = cleanName.split(/\s+/).map((word, idx) => idx === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('') || 'attr';
        return {
          name: camelName,
          displayName: rawName,
          type: a.type || 'String',
          visibility: '+'
        };
      });

      // Métodos del dominio (estrictamente vacíos si no hay evidencia documental de operaciones POO)
      const methods = [];

      // Relaciones dirigidas de esta entidad (solo donde es source, para evitar aristas bidireccionales arbitrarias)
      const related = project.relationships.filter(r => r.source === ent.name);
      const rels = related.map(r => ({
        targetClass: r.target,
        type: 'association',
        label: r.description || '',
        cardinality: r.cardinality || '1..*'
      }));

      classesToCreate.push({
        codeId: ent.codeId || `CLS-${pascalName.toUpperCase()}`,
        name: pascalName,
        description: `Clase de Entidad del Dominio: ${ent.description || ent.name}`,
        attributes: attrs,
        methods,
        relationships: rels
      });
    }

    const result = [];
    for (const c of classesToCreate) {
      const created = await prisma.classModel.create({
        data: {
          projectId,
          codeId: c.codeId,
          name: c.name,
          description: c.description,
          attributes: c.attributes,
          methods: c.methods,
          relationships: c.relationships,
          reviewStatus: 'APPROVED',
          isDeleted: false
        }
      });
      result.push(created);
    }

    return result;
  }

  /**
   * Genera el diagrama de clases en sintaxis Mermaid (classDiagram).
   */
  async getMermaidDiagram(projectId) {
    const classes = await this.getClassesByProject(projectId);
    if (classes.length === 0) {
      return `classDiagram
    class Sistema {
      +String nombre
      +iniciar() void
    }`;
    }

    const lines = ['classDiagram'];
    const renderedNames = new Set();

    for (const cls of classes) {
      const cName = cls.name.replace(/[^a-zA-Z0-9_]/g, '');
      renderedNames.add(cName);
      lines.push(`    class ${cName} {`);

      const attrs = Array.isArray(cls.attributes) ? cls.attributes : [];
      for (const a of attrs) {
        const vis = a.visibility || '+';
        const cleanAttrName = (a.name || 'attr').normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_]/g, '');
        lines.push(`        ${vis}${a.type || 'String'} ${cleanAttrName}`);
      }

      const methods = Array.isArray(cls.methods) ? cls.methods : [];
      for (const m of methods) {
        const vis = m.visibility || '+';
        lines.push(`        ${vis}${m.name}() ${m.returnType || 'void'}`);
      }

      lines.push(`    }`);
    }

    // Renderizar relaciones dirigidas sin duplicados ni aristas bidireccionales arbitrarias
    const seenEdges = new Set();
    for (const cls of classes) {
      const source = cls.name.replace(/[^a-zA-Z0-9_]/g, '');
      const rels = Array.isArray(cls.relationships) ? cls.relationships : [];
      for (const r of rels) {
        const target = (r.targetClass || '').replace(/[^a-zA-Z0-9_]/g, '');
        if (target && renderedNames.has(target) && source !== target) {
          const edgeKey = `${source}->${target}`;
          const reverseKey = `${target}->${source}`;
          if (seenEdges.has(edgeKey) || seenEdges.has(reverseKey)) continue;
          seenEdges.add(edgeKey);

          const lbl = r.label ? ` : "${r.label}"` : '';
          if (r.type === 'aggregation') {
            lines.push(`    ${source} o-- ${target}${lbl}`);
          } else if (r.type === 'composition') {
            lines.push(`    ${source} *-- ${target}${lbl}`);
          } else if (r.type === 'inheritance') {
            lines.push(`    ${target} <|-- ${source}${lbl}`);
          } else {
            lines.push(`    ${source} --> ${target}${lbl}`);
          }
        }
      }
    }

    return lines.join('\n');
  }
}

module.exports = new ClassModelService();
