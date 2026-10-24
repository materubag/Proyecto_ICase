/**
 * Plantillas Mermaid prediseñadas para arquitecturas y artefactos estándar de ICASE.
 * Permiten generar diagramas visuales deterministas instantáneamente sin costo de IA.
 */

const MERMAID_TEMPLATES = {
  CLIENT_SERVER: (tech = {}) => {
    const fe = tech.frontend?.join(', ') || 'Cliente Web / SPA';
    const be = tech.backend?.join(', ') || 'Servidor API REST';
    const db = tech.database?.join(', ') || 'Base de Datos';

    return `flowchart LR
    CLIENT["${fe}"]
    API["${be}"]
    DB[("${db}")]

    CLIENT -->|Peticiones HTTP REST| API
    API -->|Consultas de Persistencia| DB`;
  },

  THREE_TIER: (tech = {}) => {
    const fe = tech.frontend?.join(', ') || 'Capa de Presentación (UI)';
    const be = tech.backend?.join(', ') || 'Capa de Negocio (Servicios)';
    const db = tech.database?.join(', ') || 'Capa de Datos (Persistencia)';

    return `flowchart TD
    subgraph Presentation ["Capa de Presentación"]
        UI["${fe}"]
    end
    subgraph Business ["Capa de Lógica de Negocio"]
        LOGIC["${be}"]
    end
    subgraph Data ["Capa de Acceso a Datos"]
        STORE[("${db}")]
    end

    UI -->|Peticiones de Usuario| LOGIC
    LOGIC -->|Transacciones de Datos| STORE`;
  },

  MVC: (tech = {}) => {
    const be = tech.backend?.join(' / ') || 'Controlador';
    const fe = tech.frontend?.join(' / ') || 'Vista';
    const db = tech.database?.join(' / ') || 'Modelo';

    return `flowchart TD
    USER["Usuario"]
    VIEW["Vista (${fe})"]
    CONTROLLER["Controlador (${be})"]
    MODEL["Modelo (${db})"]

    USER -->|Interactúa con la interfaz| VIEW
    VIEW -->|Envía acciones / eventos| CONTROLLER
    CONTROLLER -->|Manipula estado| MODEL
    MODEL -->|Suministra datos renderizados| VIEW`;
  }
};

module.exports = {
  MERMAID_TEMPLATES
};
