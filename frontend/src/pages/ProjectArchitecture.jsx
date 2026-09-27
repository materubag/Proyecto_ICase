import React, { useState, useMemo } from 'react';
import MermaidDiagram from '../components/diagrams/MermaidDiagram';
import { generateArchitectureDiagram } from '../utils/mermaidGenerators';

export default function ProjectArchitecture({ project }) {
  const [archType, setArchType] = useState('software'); // 'software' | 'system'
  const [showCode, setShowCode] = useState(false);

  const architecture = project.architectures && project.architectures.length > 0
    ? project.architectures[0]
    : null;

  // Software Architecture Diagram (Clean Architecture 3-tier)
  const softwareArchCode = useMemo(() => {
    if (architecture?.softwareDiagram) return architecture.softwareDiagram;
    let code = `graph TD\n`;
    code += `  %% Estilos para Arquitectura de Software\n`;
    code += `  classDef presentation fill:#eff6ff,stroke:#2563eb,stroke-width:2px,color:#1e3a8a,font-weight:bold;\n`;
    code += `  classDef domain fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#14532d,font-weight:bold;\n`;
    code += `  classDef data fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f,font-weight:bold;\n\n`;

    code += `  subgraph PRESENTATION["1. CAPA DE PRESENTACIÓN (FRONTEND)"]\n`;
    code += `    UI_COMP["Componentes React SPA"]:::presentation\n`;
    code += `    UI_ROUTER["Enrutador & Vistas"]:::presentation\n`;
    code += `    UI_STATE["Gestores de Estado / Hooks"]:::presentation\n`;
    code += `  end\n\n`;

    code += `  subgraph DOMAIN["2. CAPA DE NEGOCIO & DOMINIO (BACKEND)"]\n`;
    code += `    SVC_CORE["Controladores REST & Middleware"]:::domain\n`;
    code += `    SVC_RULES["Servicios de Negocio & Reglas ISO"]:::domain\n`;
    code += `    SVC_PIPELINE["Pipeline de Análisis & Normalización"]:::domain\n`;
    code += `  end\n\n`;

    code += `  subgraph DATA["3. CAPA DE DATOS & INFRAESTRUCTURA"]\n`;
    code += `    ORM_PRISMA["Prisma ORM (Data Access Layer)"]:::data\n`;
    code += `    DB_POSTGRES["PostgreSQL Relacional (ACID)"]:::data\n`;
    code += `    EXT_AI["Proveedores de IA & Automatización (n8n/LLM)"]:::data\n`;
    code += `  end\n\n`;

    code += `  UI_COMP --> UI_ROUTER\n`;
    code += `  UI_ROUTER -->|Peticiones HTTP/REST| SVC_CORE\n`;
    code += `  SVC_CORE --> SVC_RULES\n`;
    code += `  SVC_RULES --> SVC_PIPELINE\n`;
    code += `  SVC_RULES --> ORM_PRISMA\n`;
    code += `  SVC_PIPELINE --> EXT_AI\n`;
    code += `  ORM_PRISMA -->|Consultas SQL Seguras| DB_POSTGRES\n`;

    return code;
  }, []);

  // System Architecture Diagram (Physical Infrastructure & Deployment)
  const systemArchCode = useMemo(() => {
    if (architecture?.deploymentDiagram) return architecture.deploymentDiagram;
    let code = `graph TB\n`;
    code += `  %% Estilos para Arquitectura del Sistema\n`;
    code += `  classDef client fill:#f1f5f9,stroke:#475569,stroke-width:2px,color:#0f172a,font-weight:bold;\n`;
    code += `  classDef docker fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0369a1,font-weight:bold;\n`;
    code += `  classDef service fill:#ffffff,stroke:#2563eb,stroke-width:1.5px,color:#1e3a8a;\n`;
    code += `  classDef db fill:#ecfdf5,stroke:#059669,stroke-width:2px,color:#065f46;\n`;
    code += `  classDef ext fill:#faf5ff,stroke:#9333ea,stroke-width:1.5px,color:#581c87;\n\n`;

    code += `  CLIENT["🌐 Navegador Web del Usuario<br/>(Desktop / Móvil)"]:::client\n\n`;

    code += `  subgraph DOCKER_COMPOSE["ENTORNO DE CONTENEDORES DOCKER"]\n`;
    code += `    NGINX["Servidor Nginx (Frontend)<br/>Puerto :3001"]:::service\n`;
    code += `    NODE_API["API REST Node.js / Express<br/>Puerto :8080"]:::service\n`;
    code += `    POSTGRES_DB[("Base de Datos PostgreSQL 16<br/>Puerto :5433 (interno :5432)")]:::db\n`;
    code += `    OLLAMA["Motor Ollama (LLM Local)<br/>Puerto :11434"]:::ext\n`;
    code += `  end\n\n`;

    code += `  subgraph EXTERNAL["SERVICIOS EXTERNOS & IA"]\n`;
    code += `    N8N_ENGINE["Servidor n8n Workflow<br/>(Transcripción & Mockup)"]:::ext\n`;
    code += `    OPENAI_API["OpenAI API / Whisper Cloud"]:::ext\n`;
    code += `  end\n\n`;

    code += `  CLIENT -->|HTTP / SPA (Puerto 3001)| NGINX\n`;
    code += `  CLIENT -->|API REST / JSON (Puerto 8080)| NODE_API\n`;
    code += `  NODE_API -->|TCP / Prisma Client| POSTGRES_DB\n`;
    code += `  NODE_API -->|HTTP REST| OLLAMA\n`;
    code += `  NODE_API -->|Webhooks HTTP| N8N_ENGINE\n`;
    code += `  N8N_ENGINE -->|Transcripción de audio| OPENAI_API\n`;

    return code;
  }, []);

  const activeDiagramCode = archType === 'software' ? softwareArchCode : systemArchCode;

  const specItems = [
    { label: 'Estilo de Arquitectura', value: architecture?.style || 'Clean Architecture en 3 Capas', icon: 'layers' },
    { label: 'Frontend', value: architecture?.frontend || 'React 18 + Vite SPA', icon: 'web' },
    { label: 'Backend', value: architecture?.backend || 'Node.js + Express REST API', icon: 'dns' },
    { label: 'Base de Datos', value: architecture?.database || 'PostgreSQL 16 + Prisma ORM', icon: 'storage' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="full-page-header" style={{ borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div>
            <h2 className="page-title" style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="ms ms-sm" style={{ color: 'var(--primary)' }}>layers</span>
              Diseño de la Arquitectura de la Aplicación
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
              Arquitectura de Software (patrón en capas) y Arquitectura del Sistema (infraestructura física y contenedores)
            </span>
          </div>
        </div>

        <div className="page-actions">
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${archType === 'software' ? 'active' : ''}`}
              onClick={() => setArchType('software')}
            >
              <span className="ms ms-xs">account_tree</span>
              <span>Arquitectura de Software</span>
            </button>
            <button
              className={`view-toggle-btn ${archType === 'system' ? 'active' : ''}`}
              onClick={() => setArchType('system')}
            >
              <span className="ms ms-xs">dns</span>
              <span>Arquitectura del Sistema</span>
            </button>
          </div>

          <div className="view-toggle">
            <button className={`view-toggle-btn ${!showCode ? 'active' : ''}`} onClick={() => setShowCode(false)}>
              <span className="ms ms-xs">visibility</span><span>Diagrama</span>
            </button>
            <button className={`view-toggle-btn ${showCode ? 'active' : ''}`} onClick={() => setShowCode(true)}>
              <span className="ms ms-xs">code</span><span>Código</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="page-scrollable" style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
        {/* Spec Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          {specItems.map(item => (
            <div key={item.label} className="info-card" style={{ background: 'var(--surface-container-lowest)', border: '1px solid var(--outline-variant)', boxShadow: 'var(--shadow-xs)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className="ms ms-xs" style={{ color: 'var(--primary)' }}>{item.icon}</span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--secondary)', textTransform: 'uppercase', fontWeight: 600 }}>{item.label}</span>
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)' }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Overview banner */}
        <div className="alert alert-info" style={{ marginBottom: '20px' }}>
          <span className="ms ms-sm">info</span>
          <div>
            <strong>{archType === 'software' ? 'Arquitectura de Software (Clean Architecture)' : 'Arquitectura del Sistema (Despliegue Físico)'}:</strong>{' '}
            {archType === 'software'
              ? 'Estructura modular dividida en Capa de Presentación (React SPA), Capa de Negocio (Controladores, Servicios de Dominio e ISO 29148) y Capa de Datos (Prisma ORM y PostgreSQL).'
              : 'Ecosistema de contenedores Docker que orquesta Nginx, Express REST API, PostgreSQL relacional, n8n para automatizaciones y Ollama/OpenAI para inteligencia artificial.'}
          </div>
        </div>

        {/* Diagram View or Code View */}
        {showCode ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="detail-section-label">Código Mermaid ({archType === 'software' ? 'Software' : 'Sistema'})</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(activeDiagramCode)}>
                <span className="ms ms-sm">content_copy</span><span>Copiar</span>
              </button>
            </div>
            <textarea className="diagram-raw-editor" rows={16} readOnly value={activeDiagramCode} />
          </div>
        ) : (
          <div>
            <div style={{ background: 'var(--surface-container-lowest)', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline-variant)', boxShadow: 'var(--shadow-xs)', overflowX: 'auto' }}>
              <MermaidDiagram code={activeDiagramCode} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
