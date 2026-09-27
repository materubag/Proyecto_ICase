import React, { useState, useEffect, useMemo } from 'react';
import DiagramViewport from '../components/common/DiagramViewport';
import { generateArchitectureDiagram } from '../utils/mermaidGenerators';
import { diagramsApi } from '../api/diagrams.api';

export default function ProjectArchitecture({ project, onProjectUpdated }) {
  const [archType, setArchType] = useState('software'); // 'software' | 'system'
  const [showCode, setShowCode] = useState(false);

  const [storedArchDiagram, setStoredArchDiagram] = useState('');
  const [isOutdated, setIsOutdated] = useState(false);
  const [generatingArch, setGeneratingArch] = useState(false);

  useEffect(() => {
    loadArchDiagram();
  }, [project.id]);

  async function loadArchDiagram() {
    try {
      const [avail, res] = await Promise.allSettled([
        diagramsApi.getAvailability(project.id),
        diagramsApi.getDiagram(project.id, 'ARCHITECTURE')
      ]);

      if (res.status === 'fulfilled' && res.value?.artifact?.mermaidCode) {
        setStoredArchDiagram(res.value.artifact.mermaidCode);
        setIsOutdated(!!res.value.isOutdated);
      }
      if (avail.status === 'fulfilled') {
        const d = avail.value?.diagrams?.ARCHITECTURE;
        if (d?.isOutdated) setIsOutdated(true);
      }
    } catch (err) {
      console.error('Error loading architecture diagram:', err);
    }
  }

  async function handleGenerateArch(force = false) {
    try {
      setGeneratingArch(true);
      const avail = await diagramsApi.getAvailability(project.id);
      const archCheck = avail?.diagrams?.ARCHITECTURE;
      if (archCheck?.status === 'INSUFFICIENT' && !force) {
        alert(`Información arquitectónica insuficiente:\n• ${archCheck.missing?.join('\n• ')}`);
        return;
      }

      const res = await diagramsApi.generateDiagram(project.id, 'ARCHITECTURE', { force });
      if (res.diagram?.mermaidCode) {
        setStoredArchDiagram(res.diagram.mermaidCode);
        setIsOutdated(false);
      }
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al generar arquitectura: ${err.message}`);
    } finally {
      setGeneratingArch(false);
    }
  }

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
    code += `    POSTGRES_DB[("Base de Datos PostgreSQL 16<br/>Puerto :5433")]:::db\n`;
    code += `    WHISPER_SVC["Servicio Faster-Whisper Local<br/>Puerto :8001 (CPU int8)"]:::service\n`;
    code += `    OLLAMA["Motor Ollama (LLM Local Opcional)<br/>Puerto :11434"]:::ext\n`;
    code += `  end\n\n`;

    code += `  subgraph EXTERNAL["SERVICIOS EXTERNOS & IA"]\n`;
    code += `    GEMINI_API["Google Gemini API<br/>(gemini-3.1-flash-lite)"]:::ext\n`;
    code += `    N8N_ENGINE["Servidor n8n Workflow<br/>(Generación de Mockups)"]:::ext\n`;
    code += `  end\n\n`;

    code += `  CLIENT -->|"HTTP / SPA :3001"| NGINX\n`;
    code += `  CLIENT -->|"API REST / JSON :8080"| NODE_API\n`;
    code += `  NODE_API -->|"TCP / Prisma Client"| POSTGRES_DB\n`;
    code += `  NODE_API -->|"HTTP / Transcripción Local"| WHISPER_SVC\n`;
    code += `  NODE_API -->|"HTTPS / Análisis Semántico"| GEMINI_API\n`;
    code += `  NODE_API -.->|"HTTP / LLM Local"| OLLAMA\n`;
    code += `  NODE_API -.->|"Webhooks HTTP Mockups"| N8N_ENGINE\n`;

    return code;
  }, []);

  const effectiveSoftwareArchCode = storedArchDiagram || softwareArchCode;
  const activeDiagramCode = archType === 'software' ? effectiveSoftwareArchCode : systemArchCode;

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
          {archType === 'software' && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => handleGenerateArch(true)}
              disabled={generatingArch}
              title="Generar o regenerar arquitectura de software con IA"
            >
              <span className={`ms ms-xs ${generatingArch ? 'spin' : ''}`}>
                {generatingArch ? 'autorenew' : 'auto_awesome'}
              </span>
              <span>{generatingArch ? 'Generando...' : storedArchDiagram ? 'Regenerar Arquitectura' : 'Generar arquitectura'}</span>
            </button>
          )}

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'var(--surface-container-low)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', marginBottom: '16px', fontSize: '0.8125rem' }}>
          <span className="ms ms-sm" style={{ color: 'var(--primary)' }}>layers</span>
          <span style={{ color: 'var(--on-surface)' }}>
            <strong>{archType === 'software' ? 'Arquitectura de Software:' : 'Arquitectura del Sistema & Despliegue:'}</strong>{' '}
            {archType === 'software'
              ? 'Presentación React SPA ➔ Negocio & ISO 29148 ➔ Datos Prisma & PostgreSQL'
              : 'Orquestación de Contenedores Docker (Nginx, Node/Express, PostgreSQL, Whisper, Ollama/Gemini)'}
          </span>
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
          <DiagramViewport
            code={activeDiagramCode}
            type="flowchart"
            title={archType === 'software' ? 'Arquitectura de Software (Clean Architecture)' : 'Arquitectura del Sistema (Despliegue Docker)'}
            minHeight="520px"
            isOutdated={archType === 'software' ? isOutdated : false}
            onRegenerate={archType === 'software' ? () => handleGenerateArch(true) : undefined}
            canGenerate={archType === 'software'}
          />
        )}
      </div>
    </div>
  );
}
