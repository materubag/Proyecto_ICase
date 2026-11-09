/**
 * ArchitectureDetector
 * Detector determinista de arquitectura que separa claramente:
 * - ARCHITECTURE_SOFTWARE (estilo de software, capas, componentes lógicos: Frontend, API REST, Lógica, Datos)
 * - ARCHITECTURE_SYSTEM (arquitectura de despliegue/infraestructura: Docker, Servidor/Cloud, Proxy HTTPS, Almacenamiento de objetos)
 */

class ArchitectureDetector {
  /**
   * Detecta arquitectura separando software y sistema.
   * @param {string} text
   * @param {Object} detectedTechnologies
   * @returns {{
   *   software: {
   *     style: string,
   *     frontend: string,
   *     backend: string,
   *     database: string,
   *     components: Array<{ name: string, layer: string, type: string }>,
   *     evidence: string,
   *     confidence: number
   *   }|null,
   *   system: {
   *     deployment: string,
   *     infrastructure: Array<string>,
   *     components: Array<{ name: string, layer: string, type: string }>,
   *     evidence: string,
   *     confidence: number
   *   }|null,
   *   all: Array<Object>
   * }}
   */
  detect(text = '', detectedTechnologies = {}) {
    const lower = text.toLowerCase();
    let software = null;
    let system = null;
    const all = [];

    // 1. Detección de Arquitectura de Software
    let softwareStyle = null;
    let softwareEvidence = null;

    if (/tres\s+capas|3\s+capas|three-tier/i.test(lower)) {
      softwareStyle = 'Arquitectura Web de Tres Capas (Presentación, Servicios, Datos)';
      softwareEvidence = 'Mención explícita a arquitectura web de tres capas: presentación, servicios y datos.';
    } else if (/microservicios/i.test(lower)) {
      softwareStyle = 'Arquitectura de Microservicios';
      softwareEvidence = 'Mención a arquitectura de microservicios.';
    } else if (/mvc|modelo\s+vista\s+controlador/i.test(lower)) {
      softwareStyle = 'Modelo-Vista-Controlador (MVC)';
      softwareEvidence = 'Mención a patrón MVC.';
    } else if (/cliente-servidor|cliente\s+servidor/i.test(lower)) {
      softwareStyle = 'Arquitectura Cliente-Servidor';
      softwareEvidence = 'Mención a arquitectura cliente-servidor.';
    } else if (/modular\s+monolith|monolito\s+modular/i.test(lower)) {
      softwareStyle = 'Monolito Modular';
      softwareEvidence = 'Mención a monolito modular.';
    } else if (/limpia|clean\s+architecture|hexagonal/i.test(lower)) {
      softwareStyle = 'Arquitectura Limpia / Hexagonal';
      softwareEvidence = 'Mención a Clean Architecture / Hexagonal.';
    }

    // Extraer componentes lógicos de software
    const techList = detectedTechnologies.detected || [];
    const frontendTech = techList.find(t => t.category === 'frontend')?.name || (/react/i.test(lower) ? 'React' : 'Frontend Web');
    const backendTech = techList.find(t => t.category === 'backend')?.name || (/node/i.test(lower) ? 'Node.js + Express' : 'Backend API');
    const dbTech = techList.find(t => t.category === 'database')?.name || (/postgres/i.test(lower) ? 'PostgreSQL' : 'Base de Datos');

    if (softwareStyle || /arquitectura\s+tecnol[oó]gica|capa\s+frontend|capa\s+backend/i.test(lower)) {
      const components = [
        { name: frontendTech, layer: 'Presentation', type: 'UI' },
        { name: backendTech, layer: 'Services', type: 'API REST' },
        { name: dbTech, layer: 'Data', type: 'Database' }
      ];

      software = {
        style: softwareStyle || 'Arquitectura Web en Capas',
        frontend: frontendTech,
        backend: backendTech,
        database: dbTech,
        components,
        evidence: softwareEvidence || 'Estructura deducida de capas y tecnologías principales.',
        confidence: softwareStyle ? 0.95 : 0.8
      };

      all.push({
        id: 'ARCH-SOFT-01',
        kind: 'ARCHITECTURE',
        type: 'ARCHITECTURE_SOFTWARE',
        name: `Arquitectura de Software: ${software.style}`,
        description: `Estilo: ${software.style}. Frontend: ${frontendTech}, Backend: ${backendTech}, Base de datos: ${dbTech}.`,
        content: software,
        source: 'pdf',
        evidence: software.evidence
      });
    }

    // 2. Detección de Arquitectura de Sistema / Despliegue
    const systemComponents = [];
    let systemEvidence = [];

    if (/docker/i.test(lower)) {
      systemComponents.push({ name: 'Contenedores Docker', layer: 'Deployment', type: 'Container' });
      systemEvidence.push('Contenedores Docker');
    }
    if (/proxy\s+https|nginx|apache/i.test(lower)) {
      systemComponents.push({ name: 'Proxy Inverso HTTPS (Nginx/Proxy)', layer: 'Security / Gateway', type: 'Proxy' });
      systemEvidence.push('Proxy HTTPS');
    }
    if (/almacenamiento\s+de\s+objetos|s3|archivos/i.test(lower)) {
      systemComponents.push({ name: 'Almacenamiento de Objetos / Evidencias', layer: 'Storage', type: 'ObjectStorage' });
      systemEvidence.push('Almacenamiento de evidencias y fotografías');
    }
    if (/servidor|hosting|cloud|servicios?\s+de\s+alojamiento/i.test(lower)) {
      systemComponents.push({ name: 'Servidor / Hosting en la Nube', layer: 'Infrastructure', type: 'Host' });
      systemEvidence.push('Servidor de alojamiento');
    }

    if (systemComponents.length > 0) {
      system = {
        deployment: 'Despliegue Contenerizado con Proxy Cifrado',
        infrastructure: systemComponents.map(c => c.name),
        components: systemComponents,
        evidence: `Componentes de infraestructura detectados: ${systemEvidence.join(', ')}.`,
        confidence: 0.92
      };

      all.push({
        id: 'ARCH-SYS-01',
        kind: 'ARCHITECTURE',
        type: 'ARCHITECTURE_SYSTEM',
        name: 'Arquitectura de Sistema y Despliegue',
        description: `Infraestructura: ${system.infrastructure.join(' + ')}.`,
        content: system,
        source: 'pdf',
        evidence: system.evidence
      });
    }

    return {
      software,
      system,
      all
    };
  }
}

module.exports = new ArchitectureDetector();
