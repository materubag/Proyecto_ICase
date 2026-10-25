/**
 * Code Generator Orchestrator Service
 * Connects ICASE domain entities & relationships to Sequelize & Express code generation
 */

const prisma = require('../../config/prisma');
const { toPascalCase, toCamelCase } = require('./typeMapper');
const { generateModelFile, generateModelsIndexFile } = require('./modelGenerator');
const { generateControllerFile } = require('./controllerGenerator');
const { generateEntityRoutesFile, generateMasterRoutesIndexFile } = require('./routeGenerator');
const { generateDockerfile, generateDockerCompose, generateDockerIgnore } = require('./dockerGenerator');
const {
  generateServerFile,
  generateDatabaseConfig,
  generatePackageJson,
  generateEnvExample,
  generateReadme
} = require('./serverGenerator');
const frontendGen = require('./reactFrontendGenerator');
const { convertHtmlToJsx } = require('./mockupConverter');
const { createZipBuffer } = require('./zipHelper');

class CodeGeneratorService {
  /**
   * Loads project data and approved models
   */
  async getProjectArtifacts(projectId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        entities: {
          include: { attributes: true },
          orderBy: { name: 'asc' }
        },
        relationships: {
          orderBy: { source: 'asc' }
        },
        architectures: true,
        actors: {
          where: { isDeleted: false },
          orderBy: { name: 'asc' }
        }
      }
    });

    if (!project) {
      throw new Error('Proyecto no encontrado');
    }

    // Filter approved entities first, fallback to all active entities if none are explicitly approved yet
    const approvedEntities = project.entities.filter(e => !e.isDeleted && (e.reviewStatus === 'APPROVED' || e.status === 'APPROVED'));
    let finalEntities = approvedEntities.length > 0 ? approvedEntities : project.entities.filter(e => !e.isDeleted);
    let activeRelationships = project.relationships.filter(r => !r.isDeleted);

    // Fallback: Si la tabla de entidades está vacía pero existe un diagrama E/R aprobado o generado
    if (finalEntities.length === 0) {
      const erArtifact = await prisma.artifact.findFirst({
        where: { projectId, OR: [{ type: 'ER' }, { name: 'DIAGRAM_ER' }, { type: 'ER_DIAGRAM' }] },
        include: { versions: { orderBy: { version: 'desc' } } }
      });
      const latestER = erArtifact?.versions?.[0]?.renderedContent;
      if (latestER) {
        const parsed = this.parseEntitiesFromMermaidER(latestER);
        if (parsed.entities.length > 0) {
          finalEntities = parsed.entities;
          activeRelationships = parsed.relationships;
        }
      }
    }

    // Mockups visuales del proyecto almacenados en ArtifactVersion
    const mockupArtifacts = await prisma.artifact.findMany({
      where: {
        projectId,
        type: 'MOCKUP'
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });

    return {
      project,
      entities: finalEntities,
      relationships: activeRelationships,
      mockups: mockupArtifacts,
      isApprovedOnly: approvedEntities.length > 0
    };
  }

  /**
   * Extrae entidades, atributos y relaciones desde un diagrama Mermaid erDiagram
   */
  parseEntitiesFromMermaidER(erCode = '') {
    if (!erCode || typeof erCode !== 'string') return { entities: [], relationships: [] };
    const entities = new Map();
    const entityRegex = /^\s*([A-Za-z0-9_]+)\s*\{([\s\S]*?)\}/gm;
    let match;

    while ((match = entityRegex.exec(erCode)) !== null) {
      const entityName = match[1].trim();
      const rawBody = match[2].trim();
      const lines = rawBody.split('\n').map(l => l.trim()).filter(Boolean);

      const attributes = [];
      for (const line of lines) {
        const parts = line.split(/\s+/);
        const type = parts[0] || 'string';
        const name = parts[1] || '';
        const isPk = parts.slice(2).some(p => p.toUpperCase() === 'PK');
        if (name) {
          attributes.push({ name, type, isPk });
        }
      }

      entities.set(entityName, {
        name: entityName,
        attributes,
        status: 'APPROVED',
        reviewStatus: 'APPROVED'
      });
    }

    const relationships = [];
    const relRegex = /([A-Za-z0-9_]+)\s*([|}>o+]{1,2}(?:--|\.\.)[|{<o+]{1,2})\s*([A-Za-z0-9_]+)(?:\s*:\s*"?([^"\n]*)"?)?/g;
    while ((match = relRegex.exec(erCode)) !== null) {
      const source = match[1].trim();
      const card = match[2].trim();
      const target = match[3].trim();
      const label = (match[4] || '').trim();

      let cardinality = '1:N';
      if (card.includes('}') && card.includes('{')) cardinality = 'N:M';
      else if (card.includes('o{') || card.includes('|{') || card.includes('}{') || card.includes('}o') || card.includes('}|')) cardinality = '1:N';
      else if (card === '||--||' || (card.startsWith('||') && card.endsWith('||'))) cardinality = '1:1';

      relationships.push({ source, target, cardinality, description: label });
    }

    return {
      entities: Array.from(entities.values()),
      relationships
    };
  }

  /**
   * Generates all project files in memory for preview
   */
  async generateProjectFiles(projectId, options = {}) {
    const { includeDocker = true } = options;
    const { project, entities, relationships, mockups, isApprovedOnly } = await this.getProjectArtifacts(projectId);

    if (entities.length === 0) {
      return {
        projectId: project.id,
        projectName: project.name,
        isEmpty: true,
        stats: {
          entitiesCount: 0,
          relationshipsCount: 0,
          filesCount: 0,
          isApprovedOnly: false
        },
        files: []
      };
    }

    const files = [];

    // Helper to add files with language hint for UI
    const addFile = (path, content, language = 'javascript') => {
      files.push({ path, content, language });
    };

    // 1. Archivos Raíz del Proyecto Full-Stack
    addFile('README.md', generateReadme(project.name, entities), 'markdown');
    addFile('.env', `# Configuración de Puertos y Entorno para Docker Compose
# Modifica estos puertos si tienes otros servicios corriendo en tu equipo:
FRONTEND_PORT=3005
BACKEND_PORT=8085
DB_PORT=5435

DB_NAME=${project.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_db
DB_USER=postgres
DB_PASSWORD=postgres123
`, 'shell');
    if (includeDocker) {
      addFile('docker-compose.yml', generateDockerCompose(project.name), 'yaml');
      addFile('.dockerignore', generateDockerIgnore(), 'text');
    }

    // 2. BACKEND: Express + Sequelize + PostgreSQL
    addFile('backend/package.json', generatePackageJson(project.name), 'json');
    addFile('backend/.env.example', generateEnvExample(project.name), 'shell');
    if (includeDocker) {
      addFile('backend/Dockerfile', generateDockerfile(), 'dockerfile');
    }
    addFile('backend/src/server.js', generateServerFile(project.name), 'javascript');
    addFile('backend/src/config/database.js', generateDatabaseConfig(project.name), 'javascript');

    // Modelos de datos Sequelize
    for (const entity of entities) {
      const modelName = toPascalCase(entity.name);
      addFile(`backend/src/models/${modelName}.js`, generateModelFile(entity), 'javascript');
    }
    addFile('backend/src/models/index.js', generateModelsIndexFile(entities, relationships), 'javascript');

    // Controladores CRUD
    for (const entity of entities) {
      const varName = toCamelCase(entity.name);
      addFile(`backend/src/controllers/${varName}.controller.js`, generateControllerFile(entity), 'javascript');
    }

    // Rutas REST
    for (const entity of entities) {
      const varName = toCamelCase(entity.name);
      addFile(`backend/src/routes/${varName}.routes.js`, generateEntityRoutesFile(entity), 'javascript');
    }
    addFile('backend/src/routes/index.js', generateMasterRoutesIndexFile(entities), 'javascript');

    // 3. FRONTEND: Interfaz Visual React + Vite + SPA
    addFile('frontend/package.json', frontendGen.generateFrontendPackageJson(project.name), 'json');
    addFile('frontend/vite.config.js', frontendGen.generateViteConfig(), 'javascript');
    addFile('frontend/index.html', frontendGen.generateIndexHtml(project.name), 'html');
    if (includeDocker) {
      addFile('frontend/Dockerfile', frontendGen.generateFrontendDockerfile(), 'dockerfile');
      addFile('frontend/nginx.conf', frontendGen.generateFrontendNginxConf(), 'nginx');
    }
    addFile('frontend/src/main.jsx', frontendGen.generateMainJsx(), 'javascript');
    addFile('frontend/src/index.css', frontendGen.generateFrontendCss(), 'css');
    addFile('frontend/src/api/client.js', frontendGen.generateApiClientJs(), 'javascript');
    addFile('frontend/src/pages/Dashboard.jsx', frontendGen.generateDashboardJsx(project.name, entities), 'javascript');

    // Pantallas Funcionales del Sistema (Con lógica React interactiva, formularios y persistencia API)
    const funcPages = frontendGen.getFunctionalPages();
    for (const page of funcPages) {
      addFile(`frontend/src/pages/${page.fileName}`, page.content, 'javascript');
    }

    // 4. Compilación de Mockups Reales de la BD (Tailwind CSS a React JSX)
    const compiledMockups = [];
    if (mockups && mockups.length > 0) {
      for (const m of mockups) {
        const v = m.versions?.[0];
        const html = v?.renderedContent || v?.structuredContent?.screen?.html || '';
        const screen = v?.structuredContent?.screen || {};
        if (html) {
          const rawRoute = screen.route || '/' + (m.name || 'mockup').toLowerCase().replace(/[^a-z0-9]/g, '-');
          let baseName = rawRoute.replace(/^\//, '').replace(/[^a-zA-Z0-9]/g, ' ');
          if (!baseName.trim()) baseName = 'home';
          const compName = toPascalCase(baseName) + 'Mockup';
          const key = 'mockup_' + baseName.trim().replace(/\s+/g, '_').toLowerCase();
          const title = screen.title || m.name || compName;

          const convertedJsx = convertHtmlToJsx(html, compName, rawRoute);
          const mockupComponentCode = `import React from 'react';

/**
 * Mockup Compilado con Tailwind CSS
 * Origen: I-CASE Studio ArtifactVersion
 * Ruta: ${rawRoute}
 * Título: ${title}
 */
export default function ${compName}() {
  return (
    <div className="mockup-container" style={{ padding: '8px' }}>
      ${convertedJsx}
    </div>
  );
}
`;
          addFile(`frontend/src/pages/mockups/${compName}.jsx`, mockupComponentCode, 'javascript');
          compiledMockups.push({
            compName,
            key,
            title,
            route: rawRoute,
            fileName: `${compName}.jsx`
          });
        }
      }
    }

    addFile('frontend/src/App.jsx', frontendGen.generateAppJsx(project.name, entities, [], project.actors || [], compiledMockups), 'javascript');

    // Pantallas interactivas con tablas y formularios para cada entidad (Sequelize ORM)
    for (const entity of entities) {
      const pascalName = toPascalCase(entity.name);
      addFile(`frontend/src/pages/orm/${pascalName}Page.jsx`, frontendGen.generateEntityPageJsx(entity), 'javascript');
    }

    return {
      projectId: project.id,
      projectName: project.name,
      stats: {
        entitiesCount: entities.length,
        relationshipsCount: relationships.length,
        filesCount: files.length,
        isApprovedOnly
      },
      files
    };
  }

  /**
   * Generates a downloadable ZIP buffer
   */
  async generateZipArchive(projectId, options = {}) {
    const { files, projectName, isEmpty } = await this.generateProjectFiles(projectId, options);
    if (isEmpty || !files || files.length === 0) {
      throw new Error('El proyecto no tiene entidades registradas para empaquetar código.');
    }
    const zipBuffer = createZipBuffer(files);
    const safeName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    return {
      filename: `${safeName}-api.zip`,
      buffer: zipBuffer,
      size: zipBuffer.length
    };
  }
}

module.exports = new CodeGeneratorService();
