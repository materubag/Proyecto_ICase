import React, { useState, useMemo } from 'react';
import { Cpu, Code2, Layers, Globe, Server, Database, Check, X, ServerCrash } from 'lucide-react';
import MermaidDiagram from '../components/diagrams/MermaidDiagram';

export default function ProjectArchitecture({ project }) {
  const [archTab, setArchTab] = useState('software'); // 'software' | 'deployment'
  const [showCode, setShowCode] = useState(false);
  const [reviewStatus, setReviewStatus] = useState('APPROVED');

  const architecture = project.architectures && project.architectures.length > 0
    ? project.architectures[0]
    : null;

  // Diagrama de Arquitectura de Software por defecto
  const defaultSoftwareDiagram = useMemo(() => {
    if (architecture?.softwareDiagram) return architecture.softwareDiagram;
    return `flowchart TD
    subgraph PRESENTATION ["Capas de Presentación"]
        UI["Interfaz de Usuario (SPA / Vistas React)"]
        CONTROLLERS["Controladores REST API / Routers"]
    end
    subgraph APPLICATION ["Capa de Lógica y Aplicación"]
        AUTH_SRV["Servicio de Autenticación y Autorización"]
        CORE_SRV["Servicio de Reglas de Negocio / Casos de Uso"]
        ORCHESTRATOR["Orquestador de Procesos ICASE"]
    end
    subgraph DOMAIN ["Capa de Dominio y Modelos"]
        ENTITIES["Entidades del Dominio / Validadores"]
        CONTRACTS["Interfaces y Contratos de Servicio"]
    end
    subgraph INFRASTRUCTURE ["Capa de Datos e Infraestructura"]
        ORM["Prisma ORM / Mapeador Relacional"]
        N8N_ADAPTER["Adaptador Webhooks n8n (Audio/Flujos)"]
        AI_ADAPTER["Proveedor de IA (gpt-5.4-nano / LLM)"]
    end
    UI -->|Peticiones HTTP JSON| CONTROLLERS
    CONTROLLERS -->|Invoca| CORE_SRV
    CONTROLLERS -->|Valida| AUTH_SRV
    CORE_SRV -->|Aplica reglas| ENTITIES
    CORE_SRV -->|Persistencia| ORM
    CORE_SRV -->|Automatización| N8N_ADAPTER
    ORCHESTRATOR -->|Consultas semánticas| AI_ADAPTER`;
  }, [architecture]);

  // Diagrama de Arquitectura del Sistema / Despliegue por defecto
  const defaultDeploymentDiagram = useMemo(() => {
    if (architecture?.deploymentDiagram) return architecture.deploymentDiagram;
    return `flowchart TB
    subgraph CLIENTS ["Dispositivos Clientes"]
        BROWSER["🖥️ Navegador Web / Mobile Client (HTTPS)"]
    end
    subgraph DOCKER_HOST ["Servidor de Contenedores Docker (ICASE Infraestructura)"]
        subgraph FRONTEND_CONTAINER ["Contenedor Frontend (icase_frontend)"]
            NGINX["Servidor Nginx (Puerto 3001:80)"]
            STATIC_FILES["Bundle React / Vite SPA"]
        end
        subgraph BACKEND_CONTAINER ["Contenedor Backend (icase_backend)"]
            NODE["Node.js 20 Express API (Puerto 8080)"]
            PRISMA["Prisma Client Engine"]
        end
        subgraph DB_CONTAINER ["Contenedor Base de Datos (icase_postgres)"]
            PG["PostgreSQL 16 Alpine (Puerto 5433:5432)"]
            VOLUME[("Volumen postgres_data")]
        end
        subgraph OLLAMA_CONTAINER ["Contenedor LLM Local (icase_ollama)"]
            OLLAMA["Motor Ollama LLM (Puerto 11434)"]
        end
    end
    subgraph EXTERNAL_SERVICES ["Servicios Externos / Integración"]
        N8N["⚡ Plataforma n8n (Webhooks de Audio y Procesos)"]
        OPENAI["🤖 OpenAI API (gpt-5.4-nano / gpt-4o)"]
    end
    BROWSER -->|HTTP 3001| NGINX
    NGINX -.-> STATIC_FILES
    BROWSER -->|REST API 8080| NODE
    NODE --> PRISMA
    PRISMA -->|TCP 5432 / SQL| PG
    PG --- VOLUME
    NODE -.->|HTTP 11434| OLLAMA
    NODE -->|Webhooks HTTP/JSON| N8N
    NODE -->|HTTPS Tokens Optimizados| OPENAI`;
  }, [architecture]);

  const activeDiagramCode = archTab === 'software' ? defaultSoftwareDiagram : defaultDeploymentDiagram;

  return (
    <div>
      {/* Botones de Selección de Vista: Software vs Despliegue */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn ${archTab === 'software' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setArchTab('software')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Layers size={15} />
            <span>1. Arquitectura de Software (Capas & Lógica)</span>
          </button>
          <button
            className={`btn ${archTab === 'deployment' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setArchTab('deployment')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Server size={15} />
            <span>2. Arquitectura del Sistema / Despliegue</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span
            className="badge"
            style={{
              backgroundColor: reviewStatus === 'APPROVED' ? '#dcfce7' : '#fee2e2',
              color: reviewStatus === 'APPROVED' ? '#15803d' : '#b91c1c'
            }}
          >
            {reviewStatus === 'APPROVED' ? 'Aprobado' : 'Rechazado'}
          </span>

          <button
            className="btn btn-secondary btn-sm"
            style={{ color: '#16a34a' }}
            onClick={() => setReviewStatus('APPROVED')}
            title="Aceptar arquitectura"
          >
            <Check size={14} />
            <span>Aceptar</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            style={{ color: '#dc2626' }}
            onClick={() => setReviewStatus('DISCARDED')}
            title="Rechazar arquitectura"
          >
            <X size={14} />
            <span>Rechazar</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowCode(!showCode)}
          >
            <Code2 size={14} />
            <span>{showCode ? 'Ocultar Mermaid' : 'Ver Código Mermaid'}</span>
          </button>
        </div>
      </div>

      {/* Ficha Tecnológica */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Cpu size={16} color="var(--primary)" />
          <span>Ficha Técnica y Stack del Sistema</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Estilo de Software</span>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{architecture?.style || 'Clean Architecture en 3 Capas'}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Globe size={12} /> Frontend
            </span>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{architecture?.frontend || 'React SPA / Nginx'}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Server size={12} /> Backend
            </span>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{architecture?.backend || 'Node.js 20 Express'}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Database size={12} /> Persistencia
            </span>
            <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{architecture?.database || 'PostgreSQL 16 Engine'}</strong>
          </div>
        </div>
      </div>

      {showCode && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <label className="form-label" style={{ fontWeight: 600 }}>
            Código Mermaid ({archTab === 'software' ? 'Arquitectura de Software' : 'Despliegue del Sistema'})
          </label>
          <textarea className="diagram-raw-editor" rows={10} readOnly value={activeDiagramCode} />
        </div>
      )}

      {/* Renderizado del Diagrama Mermaid */}
      <div className="diagram-container">
        <MermaidDiagram code={activeDiagramCode} type="flowchart" />
      </div>
    </div>
  );
}
