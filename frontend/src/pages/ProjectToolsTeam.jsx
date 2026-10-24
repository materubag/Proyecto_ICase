import React, { useState } from 'react';

const TEAM_EVIDENCES = [
  {
    id: 'EVID-01',
    type: 'AUDIO / REUNIÓN',
    icon: 'mic',
    date: '2026-09-24',
    title: 'Entrevista de Levantamiento con el Stakeholder Principal',
    participants: ['Líder de Proyecto', 'Analista de Negocio', 'Cliente / Experto de Dominio'],
    channel: 'Google Meet / Grabación de Audio (.mp3)',
    summary: 'Discusión sobre los objetivos del negocio, necesidades funcionales, reglas de negocio y restricciones operativas. Audio cargado a Fuentes y procesado mediante webhook n8n para transcripción automática con Whisper.',
    linkTab: 'sources'
  },
  {
    id: 'EVID-02',
    type: 'REUNIÓN TÉCNICA',
    icon: 'groups',
    date: '2026-09-25',
    title: 'Sesión de Arquitectura y Modelado de Datos E/R',
    participants: ['Arquitecto de Software', 'Desarrollador Backend', 'Arquitecto de Datos'],
    channel: 'Discord Voice & Screen Share',
    summary: 'Definición de entidades clave, normalización en 3FN, cardinalidades y selección de Clean Architecture en 3 capas. Acta de acuerdos generada y subida en PDF a Fuentes.',
    linkTab: 'sources'
  },
  {
    id: 'EVID-03',
    type: 'CHAT CONTEXTUAL',
    icon: 'chat',
    date: '2026-09-26',
    title: 'Discusión y Refinamiento Asistido por IA en el Proyecto',
    participants: ['Equipo de Desarrollo', 'Motor LLM ICASE (Ollama / GPT)'],
    channel: 'Chat Contextual del Sistema ICASE',
    summary: 'Consultas sobre el impacto de cambios en requerimientos, verificación de dependencias e identificación de requisitos no funcionales críticos.',
    linkTab: 'chat'
  },
  {
    id: 'EVID-04',
    type: 'CONTROL DE VERSIONES',
    icon: 'code',
    date: '2026-09-27',
    title: 'Revisión por Pares (Pull Requests) y Baselines de Ingeniería',
    participants: ['Todo el Equipo de Software'],
    channel: 'GitHub Repository & Git Flow',
    summary: 'Gestión de ramas feature/, revisión de código, creación de Baselines inmutables y trazabilidad directa de cambios sobre requisitos aprobados.',
    linkTab: 'versions'
  }
];

const TOOLS_ANALYSIS = [
  {
    tool: 'React 18 + Vite',
    role: 'Frontend & Interfaz de Usuario',
    badge: 'FRONTEND',
    justification: 'Vite ofrece arranque instantáneo y Hot Module Replacement (HMR) ultrarrápido con compilación optimizada en producción. React permite una arquitectura basada en componentes modulares, reactividad fluida para diagramas interactivos y bajo consumo de memoria.',
    contribution: 'Permite construir una Single Page Application (SPA) responsiva con carga inmediata de los prototipos y renderizado dinámico de diagramas Mermaid.'
  },
  {
    tool: 'Node.js + Express',
    role: 'Backend REST API',
    badge: 'BACKEND',
    justification: 'Entorno de ejecución asíncrono y no bloqueante idóneo para I/O intensivo como la recepción de archivos PDF, procesamiento de audios en streaming y orquestación de webhooks.',
    contribution: 'Centraliza la lógica de negocio, middlewares de validación ISO 29148, gestión de transacciones ACID y API REST consumida por el frontend.'
  },
  {
    tool: 'PostgreSQL + Prisma ORM',
    role: 'Persistencia & Modelado de Datos',
    badge: 'DATABASE',
    justification: 'PostgreSQL garantiza integridad referencial estricta, soporte para tipos JSON estructurados y robustez transaccional. Prisma ORM provee seguridad de tipos en tiempo de compilación (Type-Safety) y migraciones declarativas.',
    contribution: 'Almacena con estricta trazabilidad cada requisito, versión de artefacto, segmento de audio y estado de aprobación con relaciones CASCADE y claves foráneas verificadas.'
  },
  {
    tool: 'Docker & Docker Compose',
    role: 'Infraestructura & Contenedores',
    badge: 'DEVOPS',
    justification: 'Aislamiento completo de dependencias en contenedores ligeros (PostgreSQL, Backend Node, Frontend Nginx, Ollama), eliminando el problema clásico de "en mi máquina sí funciona".',
    contribution: 'Permite al equipo y al evaluador levantar todo el ecosistema (BD, API, Frontend, LLM y n8n) con un solo comando: docker compose up -d.'
  },
  {
    tool: 'n8n Workflow Automation',
    role: 'Orquestación & Pipelines de IA',
    badge: 'AUTOMATIZACIÓN',
    justification: 'Plataforma líder de automatización basada en nodos sin código / bajo código para conectar webhooks, procesar audios con Whisper y generar prototipos visuales de forma declarativa.',
    contribution: 'Desacopla el procesamiento pesado de transcripción y generación de mockups del backend principal, aumentando la resiliencia del sistema.'
  },
  {
    tool: 'Mermaid.js',
    role: 'Diagramación como Código (DaC)',
    badge: 'DIAGRAMAS',
    justification: 'Generación declarativa de diagramas UML, GANTT, PERT y Entidad-Relación a partir de texto estructurado, permitiendo versionar diagramas en Git.',
    contribution: 'Sincroniza en tiempo real los modelos aprobados con diagramas visuales descargables en SVG sin depender de herramientas externas propietarias.'
  }
];

export default function ProjectToolsTeam({ project, onNavigateTo }) {
  const [activeTab, setActiveTab] = useState('team'); // 'team' | 'tools'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="full-page-header" style={{ borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface)' }}>
        <div>
          <h2 className="page-title" style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="ms ms-sm" style={{ color: 'var(--primary)' }}>handshake</span>
            Evaluación: Trabajo en Equipo y Análisis de Herramientas
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
            Evidencias documentadas de discusiones colaborativas y justificación técnica del stack tecnológico
          </span>
        </div>

        <div className="view-toggle">
          <button
            className={`view-toggle-btn ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            <span className="ms ms-xs">groups</span>
            <span>Evidencias Trabajo en Equipo</span>
          </button>
          <button
            className={`view-toggle-btn ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            <span className="ms ms-xs">layers</span>
            <span>Análisis de Herramientas</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="page-scrollable" style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
        {activeTab === 'team' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--on-surface)', margin: 0 }}>
                Constancia de Discusiones y Medios de Comunicación
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '2px 0 0' }}>
                Registro cronológico que evidencia el trabajo coordinado mediante reuniones virtuales, entrevistas grabadas, chat contextual y control de versiones.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {TEAM_EVIDENCES.map(evid => (
                <div
                  key={evid.id}
                  className="info-card"
                  style={{
                    background: 'var(--surface-container-lowest)',
                    border: '1px solid var(--outline-variant)',
                    borderRadius: 'var(--radius-md)',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-xs)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="code-tag code-tag-primary" style={{ fontSize: '0.6875rem' }}>{evid.id}</span>
                      <span className="tag" style={{ fontSize: '0.6875rem' }}>{evid.date}</span>
                    </div>

                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--on-surface)', margin: '4px 0 8px' }}>
                      {evid.title}
                    </h4>

                    <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 500, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="ms ms-xs">{evid.icon}</span>
                      <span>{evid.channel}</span>
                    </div>

                    <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.5, margin: '8px 0 12px' }}>
                      {evid.summary}
                    </p>

                    <div style={{ borderTop: '1px solid var(--outline-variant)', paddingTop: '10px', marginTop: '10px' }}>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--outline)', display: 'block', marginBottom: '4px' }}>
                        Participantes:
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {evid.participants.map((p, idx) => (
                          <span key={idx} className="tag" style={{ fontSize: '0.6875rem', background: 'var(--surface-container)' }}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {evid.linkTab && onNavigateTo && (
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ marginTop: '14px', width: '100%', justifyContent: 'center' }}
                      onClick={() => onNavigateTo(evid.linkTab)}
                    >
                      <span className="ms ms-xs">visibility</span>
                      <span>Ver evidencia en pestaña {evid.linkTab.toUpperCase()}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--on-surface)', margin: 0 }}>
                Análisis y Justificación Técnica de las Herramientas Seleccionadas
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '2px 0 0' }}>
                Evaluación del impacto y aporte de cada componente tecnológico al desarrollo ágil y confiable del sistema.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
              {TOOLS_ANALYSIS.map((item, idx) => (
                <div
                  key={idx}
                  className="info-card"
                  style={{
                    background: 'var(--surface-container-lowest)',
                    border: '1px solid var(--outline-variant)',
                    borderRadius: 'var(--radius-md)',
                    padding: '18px',
                    boxShadow: 'var(--shadow-xs)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>{item.badge}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', fontWeight: 500 }}>{item.role}</span>
                  </div>

                  <h4 style={{ fontSize: '1.0625rem', fontWeight: 600, color: 'var(--on-surface)', margin: '4px 0 10px' }}>
                    {item.tool}
                  </h4>

                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'block', marginBottom: '2px' }}>
                      Justificación de la Selección:
                    </strong>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.5, margin: 0 }}>
                      {item.justification}
                    </p>
                  </div>

                  <div style={{ background: 'var(--surface-container-low)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--primary)' }}>
                    <strong style={{ fontSize: '0.75rem', color: 'var(--on-surface)', display: 'block', marginBottom: '2px' }}>
                      Aporte Directo al Proyecto / Equipo:
                    </strong>
                    <p style={{ fontSize: '0.75rem', color: 'var(--secondary)', margin: 0, lineHeight: 1.4 }}>
                      {item.contribution}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
