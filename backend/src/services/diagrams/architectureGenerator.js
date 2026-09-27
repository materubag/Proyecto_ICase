const { id, label } = require('./mermaidSyntax');

/**
 * Generador determinista de diagramas de Arquitectura de Software y Despliegue del Sistema.
 */

class ArchitectureGenerator {
  /**
   * Genera el diagrama de Arquitectura de Software (Capas lógicas y componentes).
   */
  generateSoftwareArchitecture(architecture = {}, components = []) {
    const style = architecture.style || 'Clean Architecture / 3 Capas';
    const lines = ['flowchart TD'];

    lines.push(`    subgraph PRESENTATION ["Capas de Presentación"]`);
    lines.push(`        UI["Interfaz de Usuario (SPA / Vistas React)"]`);
    lines.push(`        CONTROLLERS["Controladores REST API / Routers"]`);
    lines.push(`    end`);

    lines.push(`    subgraph APPLICATION ["Capa de Lógica y Aplicación"]`);
    lines.push(`        AUTH_SRV["Servicio de Autenticación y Autorización"]`);
    lines.push(`        CORE_SRV["Servicio de Reglas de Negocio / Casos de Uso"]`);
    lines.push(`        ORCHESTRATOR["Orquestador de Procesos"]`);
    lines.push(`    end`);

    lines.push(`    subgraph DOMAIN ["Capa de Dominio y Modelos"]`);
    lines.push(`        ENTITIES["Entidades del Dominio / Validadores"]`);
    lines.push(`        CONTRACTS["Interfaces y Contratos de Servicio"]`);
    lines.push(`    end`);

    lines.push(`    subgraph INFRASTRUCTURE ["Capa de Datos e Infraestructura"]`);
    lines.push(`        ORM["Prisma ORM / Mapeador Relacional"]`);
    lines.push(`        N8N_ADAPTER["Adaptador Webhooks n8n (Audio/Flujos)"]`);
    lines.push(`        AI_ADAPTER["Proveedor de IA (gpt-5.4-nano / LLM)"]`);
    lines.push(`    end`);

    lines.push(`    UI -->|Peticiones HTTP JSON| CONTROLLERS`);
    lines.push(`    CONTROLLERS -->|Invoca| CORE_SRV`);
    lines.push(`    CONTROLLERS -->|Valida| AUTH_SRV`);
    lines.push(`    CORE_SRV -->|Aplica reglas| ENTITIES`);
    lines.push(`    CORE_SRV -->|Persistencia| ORM`);
    lines.push(`    CORE_SRV -->|Automatización| N8N_ADAPTER`);
    lines.push(`    ORCHESTRATOR -->|Consultas semánticas| AI_ADAPTER`);

    return lines.join('\n');
  }

  /**
   * Genera el diagrama de Arquitectura del Sistema / Despliegue Físico.
   */
  generateDeploymentArchitecture(technologies = {}) {
    const lines = ['flowchart TB'];

    lines.push(`    subgraph CLIENTS ["Dispositivos Clientes"]`);
    lines.push(`        BROWSER["🖥️ Navegador Web / Mobile Client (HTTPS)"]`);
    lines.push(`    end`);

    lines.push(`    subgraph DOCKER_HOST ["Servidor de Contenedores Docker (ICASE Infraestructura)"]`);
    lines.push(`        subgraph FRONTEND_CONTAINER ["Contenedor Frontend (icase_frontend)"]`);
    lines.push(`            NGINX["Servidor Nginx (Puerto 3001:80)"]`);
    lines.push(`            STATIC_FILES["Bundle React / Vite SPA"]`);
    lines.push(`        end`);

    lines.push(`        subgraph BACKEND_CONTAINER ["Contenedor Backend (icase_backend)"]`);
    lines.push(`            NODE["Node.js 20 Express API (Puerto 8080)"]`);
            lines.push(`            PRISMA["Prisma Client Engine"]`);
    lines.push(`        end`);

    lines.push(`        subgraph DB_CONTAINER ["Contenedor Base de Datos (icase_postgres)"]`);
    lines.push(`            PG["PostgreSQL 16 Alpine (Puerto 5433:5432)"]`);
    lines.push(`            VOLUME[("Volumen postgres_data")]`);
    lines.push(`        end`);

    lines.push(`        subgraph OLLAMA_CONTAINER ["Contenedor LLM Local (icase_ollama)"]`);
    lines.push(`            OLLAMA["Motor Ollama LLM (Puerto 11434)"]`);
    lines.push(`        end`);
    lines.push(`    end`);

    lines.push(`    subgraph EXTERNAL_SERVICES ["Servicios Externos / Integración"]`);
    lines.push(`        N8N["⚡ Plataforma n8n (Webhooks de Audio y Procesos)"]`);
    lines.push(`        OPENAI["🤖 OpenAI API (gpt-5.4-nano / gpt-4o)"]`);
    lines.push(`    end`);

    lines.push(`    BROWSER -->|HTTP 3001| NGINX`);
    lines.push(`    NGINX -.-> STATIC_FILES`);
    lines.push(`    BROWSER -->|REST API 8080| NODE`);
    lines.push(`    NODE --> PRISMA`);
    lines.push(`    PRISMA -->|TCP 5432 / SQL| PG`);
    lines.push(`    PG --- VOLUME`);
    lines.push(`    NODE -.->|HTTP 11434| OLLAMA`);
    lines.push(`    NODE -->|Webhooks HTTP/JSON| N8N`);
    lines.push(`    NODE -->|HTTPS Tokens Optimizados| OPENAI`);

    return lines.join('\n');
  }

  /**
   * Método de generación con soporte a componentes y compatibilidad.
   */
  generate(architecture = {}, technologies = {}) {
    if (architecture.components || architecture.connections) {
      const lines = ['flowchart TD'];
      const components = architecture.components || [];
      const names = new Set(components.map(c => c.name));
      for (const c of components) lines.push('    ' + id(c.name) + '["' + label(c.name) + (c.layer ? ' ' + label(c.layer) : '') + '"]');
      for (const r of architecture.connections || []) {
        if (names.has(r.from) && names.has(r.to) && r.evidence) lines.push('    ' + id(r.from) + ' -->|"' + label(r.type || '') + '"| ' + id(r.to));
      }
      return lines.join('\n');
    }
    if (architecture.style) {
      return this.generateSoftwareArchitecture(architecture);
    }
    return 'flowchart TD';
  }
}

module.exports = new ArchitectureGenerator();
