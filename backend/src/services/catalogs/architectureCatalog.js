const { MERMAID_TEMPLATES } = require('./mermaidTemplates');

/**
 * Catálogo de arquitecturas conocidas para ICASE.
 * Permite reconocer estilos arquitectónicos en el documento o aplicar una arquitectura por defecto,
 * distinguiendo siempre entre source: "explicit" y source: "default".
 */

const ARCHITECTURES = [
  {
    name: 'Arquitectura Web Modular Cliente-Servidor',
    aliases: [
      'cliente-servidor',
      'cliente servidor',
      'web cliente servidor',
      'arquitectura cliente servidor',
      'arquitectura web modular cliente servidor',
      'client-server',
      'client server'
    ],
    description: 'Arquitectura distribuida donde la interfaz web desacoplada consume servicios backend mediante APIs.',
    components: [
      { name: 'Frontend SPA', layer: 'Presentation', type: 'Client' },
      { name: 'API Gateway / Backend', layer: 'Business', type: 'Server' },
      { name: 'Base de Datos Relacional', layer: 'Data', type: 'Database' }
    ],
    relations: [
      { from: 'Frontend SPA', to: 'API Gateway / Backend', type: 'HTTP REST' },
      { from: 'API Gateway / Backend', to: 'Base de Datos Relacional', type: 'SQL' }
    ],
    template: MERMAID_TEMPLATES.CLIENT_SERVER
  },
  {
    name: 'Arquitectura de Tres Capas',
    aliases: [
      'tres capas',
      '3 capas',
      'three tier',
      'three-tier',
      'arquitectura 3 capas',
      'arquitectura de tres capas'
    ],
    description: 'Separación estricta en capas de presentación, lógica de negocio y persistencia de datos.',
    components: [
      { name: 'Capa de Presentación', layer: 'Presentation', type: 'UI' },
      { name: 'Capa de Negocio', layer: 'Business', type: 'Logic' },
      { name: 'Capa de Datos', layer: 'Data', type: 'Storage' }
    ],
    relations: [
      { from: 'Capa de Presentación', to: 'Capa de Negocio', type: 'Llamadas a servicio' },
      { from: 'Capa de Negocio', to: 'Capa de Datos', type: 'DAO / Repositorio' }
    ],
    template: MERMAID_TEMPLATES.THREE_TIER
  },
  {
    name: 'MVC',
    aliases: [
      'mvc',
      'model view controller',
      'modelo vista controlador',
      'patron mvc',
      'patrón mvc'
    ],
    description: 'Patrón arquitectónico que separa los datos y la lógica de negocio (Modelo), la interfaz (Vista) y el flujo de control (Controlador).',
    components: [
      { name: 'Controlador', layer: 'Control', type: 'Controller' },
      { name: 'Vista', layer: 'Presentation', type: 'View' },
      { name: 'Modelo', layer: 'Domain', type: 'Model' }
    ],
    relations: [
      { from: 'Vista', to: 'Controlador', type: 'Acciones de usuario' },
      { from: 'Controlador', to: 'Modelo', type: 'Actualización de estado' },
      { from: 'Modelo', to: 'Vista', type: 'Suministro de datos' }
    ],
    template: MERMAID_TEMPLATES.MVC
  }
];

const DEFAULT_ARCHITECTURE_NAME = 'Arquitectura Web Modular Cliente-Servidor';

class ArchitectureCatalog {
  constructor(archList = ARCHITECTURES) {
    this.catalog = [...archList];
  }

  /**
   * Agrega una nueva arquitectura al catálogo de forma extensible.
   * @param {Object} arch
   */
  addArchitecture(arch) {
    if (!arch || !arch.name) return;
    this.catalog.push({
      ...arch,
      aliases: (arch.aliases || []).map(a => a.toLowerCase().trim())
    });
  }

  /**
   * Detecta la arquitectura en el texto normalizado o retorna la arquitectura por defecto.
   * IMPORTANTE: Distingue rigurosamente entre source: "explicit" y source: "default".
   * @param {string} text
   * @param {Object} [detectedTechnologies={}]
   * @returns {{
   *   name: string,
   *   description: string,
   *   components: Array<Object>,
   *   relations: Array<Object>,
   *   source: 'explicit' | 'default',
   *   mermaidDiagram: string
   * }}
   */
  detect(text = '', detectedTechnologies = {}) {
    const lower = text.toLowerCase();

    // 1. Búsqueda determinística de mención explícita
    for (const arch of this.catalog) {
      const searchTerms = [arch.name.toLowerCase(), ...(arch.aliases || [])];
      for (const term of searchTerms) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?:^|\\s|\\W)${escaped}(?:$|\\s|\\W)`, 'i');
        if (regex.test(lower)) {
          return {
            name: arch.name,
            description: arch.description,
            components: (detectedTechnologies.detected || []).map(t => ({ name: t.name, layer: t.category })),
            relations: [],
            source: 'explicit',
            mermaidDiagram: require('../diagrams/architectureGenerator').generate({ components: (detectedTechnologies.detected || []).map(t => ({ name: t.name, layer: t.category })) })
          };
        }
      }
    }

    // 2. Si no se especificó ninguna arquitectura, usar la arquitectura por defecto con source: "default"
    return {
      name: 'UNKNOWN',
      description: 'Arquitectura pendiente de confirmación.',
      components: [],
      relations: [],
      source: 'unknown',
      mermaidDiagram: ''
    };
  }

  /**
   * Obtiene una arquitectura por nombre exacto.
   * @param {string} name
   */
  getByName(name) {
    return this.catalog.find(a => a.name.toLowerCase() === (name || '').toLowerCase());
  }
}

module.exports = new ArchitectureCatalog();
