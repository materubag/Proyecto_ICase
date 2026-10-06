import React, { useState, useEffect, useMemo } from 'react';
import DiagramViewport from '../components/common/DiagramViewport';
import { generateArchitectureDiagram } from '../utils/mermaidGenerators';
import { diagramsApi } from '../api/diagrams.api';

export default function ProjectArchitecture({ project, onProjectUpdated }) {
  const [archType, setArchType] = useState('software'); // 'software' | 'system'
  const [showCode, setShowCode] = useState(false);

  const [storedSystemDiagram,setStoredSystemDiagram]=useState('');
  const [storedArchDiagram, setStoredArchDiagram] = useState('');
  const [isOutdated, setIsOutdated] = useState(false);
  const [documentedStack,setDocumentedStack]=useState([]);
  const [archError,setArchError]=useState('');
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

      if (res.status === 'fulfilled') {
        setDocumentedStack(res.value?.architectureProposal?.documentedTechnologies||[]);
        setStoredSystemDiagram(res.value?.architectureProposal?.systemCode||'');
        const code = res.value?.code || res.value?.mermaidCode || res.value?.artifact?.mermaidCode;
        if (code) {
          setStoredArchDiagram(code);
          setIsOutdated(!!res.value.isOutdated);
        }
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
      setGeneratingArch(true);setArchError('');
      const isForce = typeof force === 'object' ? Boolean(force.force) : Boolean(force);
      const avail = await diagramsApi.getAvailability(project.id);
      const archCheck = avail?.diagrams?.ARCHITECTURE;
      if (archCheck?.status === 'INSUFFICIENT' && !isForce) {
        setArchError((archCheck.missing||[]).join('; '));
        return;
      }

      const res = await diagramsApi.generateDiagram(project.id, 'ARCHITECTURE', isForce);
      const code = res?.code || res?.mermaidCode || res?.diagram?.mermaidCode || res?.artifact?.mermaidCode;
      if (code) {
        setStoredArchDiagram(code);
        setIsOutdated(false);
        await loadArchDiagram();
      }
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      setArchError(err.message);
    } finally {
      setGeneratingArch(false);
    }
  }

  const architecture = project.architectures && project.architectures.length > 0
    ? project.architectures[0]
    : null;

  // Software Architecture Diagram (Logical layers of the analyzed project)
  const softwareArchCode = useMemo(() => {
    if (architecture?.softwareDiagram) return architecture.softwareDiagram;
    const fe = architecture?.frontend || documentedStack.filter(t=>t.category==='frontend').map(t=>t.name).join(' + ') || 'Capa de Presentación (Interfaz de Usuario)';
    const be = architecture?.backend || documentedStack.filter(t=>t.category==='backend').map(t=>t.name).join(' + ') || 'Capa de Negocio y Lógica de Aplicación';
    const db = architecture?.database || documentedStack.filter(t=>t.category==='database').map(t=>t.name).join(' + ') || 'Capa de Persistencia y Base de Datos';

    let code = `flowchart TD\n`;
    code += `  subgraph PRESENTATION ["1. CAPA DE PRESENTACIÓN"]\n`;
    code += `    UI_COMP["${fe}"]\n`;
    code += `    ROUTER["Enrutador & Vistas del Sistema"]\n`;
    code += `  end\n\n`;

    code += `  subgraph DOMAIN ["2. CAPA DE NEGOCIO Y DOMINIO"]\n`;
    code += `    SVC_CORE["${be}"]\n`;
    code += `    SVC_RULES["Reglas de Negocio del Sistema"]\n`;
    code += `  end\n\n`;

    code += `  subgraph DATA ["3. CAPA DE DATOS Y PERSISTENCIA"]\n`;
    code += `    DB_STORE[("${db}")]\n`;
    code += `  end\n\n`;

    code += `  UI_COMP --> ROUTER\n`;
    code += `  ROUTER -->|Peticiones / Vistas| SVC_CORE\n`;
    code += `  SVC_CORE --> SVC_RULES\n`;
    code += `  SVC_RULES -->|Consultas y Persistencia| DB_STORE\n`;

    return code;
  }, [architecture, documentedStack]);

  // System Architecture Diagram (Physical deployment of the analyzed project)
  const systemArchCode = useMemo(() => {
    if (architecture?.deploymentDiagram) return architecture.deploymentDiagram;
    const fe = architecture?.frontend || documentedStack.filter(t=>t.category==='frontend').map(t=>t.name).join(' + ') || 'Frontend por confirmar';
    const be = architecture?.backend || documentedStack.filter(t=>t.category==='backend').map(t=>t.name).join(' + ') || 'Servidor de Aplicación';
    const db = architecture?.database || documentedStack.filter(t=>t.category==='database').map(t=>t.name).join(' + ') || 'Base de datos por confirmar';

    let code = `flowchart TB\n`;
    code += `  CLIENT["🌐 Dispositivo del Usuario (Navegador Web / Móvil)"]\n\n`;

    code += `  subgraph SERVER ["Infraestructura del Sistema Analizado"]\n`;
    code += `    WEB_SRV["Servidor Web (${fe})"]\n`;
    code += `    APP_SRV["Servidor Backend (${be})"]\n`;
    code += `    DB_SRV[("Almacén de Datos (${db})")]\n`;
    code += `  end\n\n`;

    code += `  CLIENT -->|Acceso HTTP / HTTPS| WEB_SRV\n`;
    code += `  WEB_SRV -->|Comunicación Interna / API| APP_SRV\n`;
    code += `  APP_SRV -->|Transacciones SQL / Driver| DB_SRV\n`;

    return code;
  }, [architecture]);

  const effectiveSoftwareArchCode = storedArchDiagram || softwareArchCode;
  const activeDiagramCode = archType === 'software' ? effectiveSoftwareArchCode : (storedSystemDiagram || systemArchCode);

  const specItems = [
    { label: 'Estilo de Arquitectura', value: architecture?.style || 'Arquitectura propuesta por confirmar', icon: 'layers' },
    { label: 'Frontend', value: architecture?.frontend || 'Capa de Presentación / Cliente Web', icon: 'web' },
    { label: 'Backend', value: architecture?.backend || 'Capa de Negocio / Servicios API', icon: 'dns' },
    { label: 'Base de Datos', value: architecture?.database || 'Capa de Persistencia / Almacenamiento', icon: 'storage' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {archError && <div role="alert" className="alert alert-danger">{archError}</div>}
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
          {(
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
            <strong>{archType === 'software' ? 'Arquitectura de Software:' : 'Arquitectura del Sistema:'}</strong>{' '}
            {archType === 'software'
              ? 'Organización lógica de los componentes del sistema.'
              : 'Infraestructura, nodos y comunicación donde se ejecuta el sistema.'}
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
            onRegenerate={() => handleGenerateArch(true)}
            canGenerate={true}
            isGenerating={generatingArch}
          />
        )}
      </div>
    </div>
  );
}
