const { id, label } = require('./mermaidSyntax');

/**
 * Generador determinista de diagramas de Arquitectura de Software y Despliegue del Sistema.
 * REGLA FUNDAMENTAL: Debe modelar EXCLUSIVAMENTE el sistema analizado (targetProjectId),
 * sin contaminar jamás el diagrama con la infraestructura o herramientas de ICASE Studio
 * (Ollama, Whisper, Gemini, n8n, puertos internos de Docker de ICASE).
 */

class ArchitectureGenerator {
  /**
   * Genera el diagrama de Arquitectura de Software (Capas lógicas y componentes).
   */
  generateSoftwareArchitecture(architecture = {}, technologies = {}) {
    const lines = ['flowchart TD'];

    const feTech = architecture.frontend || (technologies.frontend) || 'Interfaz Web / Vistas del Sistema';
    const beTech = architecture.backend || (technologies.backend) || 'Servicios de Negocio / API REST';
    const dbTech = architecture.database || (technologies.database) || 'Base de Datos Relacional';

    lines.push(`    subgraph PRESENTATION ["1. Capa de Presentación (Frontend)"]`);
    lines.push(`        UI["${label(feTech)}"]`);
    lines.push(`        ROUTER["Enrutamiento y Control de Navegación"]`);
    lines.push(`    end`);

    lines.push(`    subgraph DOMAIN ["2. Capa de Negocio y Dominio (Backend)"]`);
    lines.push(`        API["${label(beTech)}"]`);
    lines.push(`        RULES["Lógica de Negocio y Reglas Operativas"]`);
    lines.push(`    end`);

    lines.push(`    subgraph DATA ["3. Capa de Persistencia y Datos"]`);
    lines.push(`        DB[("${label(dbTech)}")]`);
    lines.push(`    end`);

    lines.push(`    UI -->|Peticiones HTTP / Vistas| ROUTER`);
    lines.push(`    ROUTER -->|Solicitudes JSON / REST| API`);
    lines.push(`    API -->|Ejecuta operaciones| RULES`);
    lines.push(`    RULES -->|Consultas y Persistencia| DB`);

    return lines.join('\n');
  }

  /**
   * Genera el diagrama de Arquitectura del Sistema / Despliegue Físico.
   * Representa los nodos de ejecución reales del proyecto analizado.
   */
  generateDeploymentArchitecture(architecture = {}, technologies = {}) {
    const lines = ['flowchart TB'];

    const feTech = architecture.frontend || 'Frontend Web';
    const beTech = architecture.backend || 'Servidor de Aplicaciones';
    const dbTech = architecture.database || 'Servidor de Base de Datos';
    const isDocker = /docker/i.test(architecture.deployment || '') || /docker/i.test(JSON.stringify(technologies || ''));

    lines.push(`    subgraph CLIENT_LAYER ["Nodos Clientes (Dispositivos)"]`);
    lines.push(`        CLIENT["🖥️ Navegador Web / Dispositivo del Usuario"]`);
    lines.push(`    end`);

    if (isDocker) {
      lines.push(`    subgraph HOST ["Servidor de Alojamiento (Entorno Contenerizado)"]`);
      lines.push(`        subgraph FE_BOX ["Contenedor Web"]`);
      lines.push(`            APP_FE["${label(feTech)}"]`);
      lines.push(`        end`);
      lines.push(`        subgraph BE_BOX ["Contenedor de Backend / Servicios"]`);
      lines.push(`            APP_BE["${label(beTech)}"]`);
      lines.push(`        end`);
      lines.push(`        subgraph DB_BOX ["Contenedor de Base de Datos"]`);
      lines.push(`            APP_DB[("${label(dbTech)}")]`);
      lines.push(`        end`);
      lines.push(`    end`);
      lines.push(`    CLIENT -->|HTTPS / Web| APP_FE`);
      lines.push(`    APP_FE -->|REST API / TCP| APP_BE`);
      lines.push(`    APP_BE -->|Conexión SQL / Driver| APP_DB`);
    } else {
      lines.push(`    subgraph SERVER_LAYER ["Servidor del Sistema"]`);
      lines.push(`        WEB_SRV["Servidor Web: ${label(feTech)}"]`);
      lines.push(`        APP_SRV["Servidor de Aplicación: ${label(beTech)}"]`);
      lines.push(`        DB_SRV[("Almacenamiento: ${label(dbTech)}")]`);
      lines.push(`    end`);
      lines.push(`    CLIENT -->|Acceso HTTP / HTTPS| WEB_SRV`);
      lines.push(`    WEB_SRV -->|Comunicación Interna / API| APP_SRV`);
      lines.push(`    APP_SRV -->|Consultas y Transacciones| DB_SRV`);
    }

    return lines.join('\n');
  }

  /**
   * Método de generación con soporte a componentes y compatibilidad.
   */
  generate(architecture = {}, technologies = {}) {
    if (architecture.components && architecture.components.length > 0) {
      const lines = ['flowchart TD'];
      const layers = {};
      const noLayer = [];

      for (const c of architecture.components) {
        const rawLayer = (c.layer || '').toUpperCase().trim();
        let groupKey = 'OTHER';
        if (rawLayer.includes('PRESENT') || rawLayer.includes('UI') || rawLayer.includes('VIEW')) {
          groupKey = 'PRESENTATION';
        } else if (rawLayer.includes('APP') || rawLayer.includes('LOGIC') || rawLayer.includes('DOMAIN') || rawLayer.includes('CORE') || rawLayer.includes('SERVICE')) {
          groupKey = 'DOMAIN';
        } else if (rawLayer.includes('DATA') || rawLayer.includes('PERSIST') || rawLayer.includes('DB') || rawLayer.includes('INFRA')) {
          groupKey = 'DATA';
        }

        if (c.layer) {
          if (!layers[groupKey]) layers[groupKey] = [];
          layers[groupKey].push(c);
        } else {
          noLayer.push(c);
        }
      }

      // Order layers logically: PRESENTATION -> DOMAIN -> DATA -> OTHER
      const layerOrder = ['PRESENTATION', 'DOMAIN', 'DATA', 'OTHER'];
      for (const key of layerOrder) {
        if (layers[key] && layers[key].length > 0) {
          lines.push(`    subgraph ${key} ["Capa de ${key === 'PRESENTATION' ? 'Presentación' : key === 'DOMAIN' ? 'Dominio / Aplicación' : key === 'DATA' ? 'Persistencia y Datos' : 'Servicios'}"]`);
          for (const c of layers[key]) {
            lines.push(`        ${id(c.name)}["${label(c.name)}"]`);
          }
          lines.push(`    end`);
        }
      }

      for (const c of noLayer) {
        lines.push(`    ${id(c.name)}["${label(c.name)}"]`);
      }

      const names = new Set(architecture.components.map(c => c.name));
      for (const r of architecture.connections || []) {
        if (names.has(r.from) && names.has(r.to)) {
          lines.push(`    ${id(r.from)} -->|"${label(r.type || '')}"| ${id(r.to)}`);
        }
      }

      // Sequential layer connection if no explicit connections
      if ((!architecture.connections || architecture.connections.length === 0) && layerOrder.length > 1) {
        const activeGroups = layerOrder.filter(k => layers[k] && layers[k].length > 0);
        for (let i = 0; i < activeGroups.length - 1; i++) {
          const fromNode = layers[activeGroups[i]][0];
          const toNode = layers[activeGroups[i+1]][0];
          if (fromNode && toNode) {
            lines.push(`    ${id(fromNode.name)} --> ${id(toNode.name)}`);
          }
        }
      }

      return lines.join('\n');
    }

    if (architecture.kind === 'SYSTEM_ARCHITECTURE' || architecture.type === 'ARCHITECTURE_SYSTEM') {
      return this.generateDeploymentArchitecture(architecture, technologies);
    }

    return this.generateSoftwareArchitecture(architecture, technologies);
  }
}

module.exports = new ArchitectureGenerator();
