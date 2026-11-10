import React, { useState, useEffect, useMemo } from 'react';
import DiagramViewport from '../components/common/DiagramViewport';
import Modal from '../components/common/Modal';
import { generateArchitectureDiagram } from '../utils/mermaidGenerators';
import { diagramsApi } from '../api/diagrams.api';

export default function ProjectArchitecture({ project, onProjectUpdated }) {
  const [archType, setArchType] = useState('software'); // 'software' | 'system'
  const [showCode, setShowCode] = useState(false);

  const [storedSystemDiagram, setStoredSystemDiagram] = useState('');
  const [storedArchDiagram, setStoredArchDiagram] = useState('');
  const [isOutdated, setIsOutdated] = useState(false);
  const [documentedStack, setDocumentedStack] = useState([]);
  const [archError, setArchError] = useState('');
  const [generatingArch, setGeneratingArch] = useState(false);

  // Estado para datos de arquitectura editables
  const [architectureData, setArchitectureData] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingArch, setIsSavingArch] = useState(false);
  const [editForm, setEditForm] = useState({
    style: '',
    frontend: '',
    backend: '',
    database: ''
  });

  useEffect(() => {
    loadArchDiagram();
    loadArchitectureData();
  }, [project.id]);

  async function loadArchitectureData() {
    try {
      const res = await fetch(`/api/projects/${project.id}/architecture`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setArchitectureData(json.data);
        }
      }
    } catch (e) {
      console.warn('Error loading project architecture:', e);
    }
  }

  async function loadArchDiagram() {
    try {
      const [avail, res] = await Promise.allSettled([
        diagramsApi.getAvailability(project.id),
        diagramsApi.getDiagram(project.id, 'ARCHITECTURE')
      ]);

      if (res.status === 'fulfilled') {
        setDocumentedStack(res.value?.architectureProposal?.documentedTechnologies || []);
        setStoredSystemDiagram(res.value?.architectureProposal?.systemCode || '');
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
      setGeneratingArch(true);
      setArchError('');
      const isForce = typeof force === 'object' ? Boolean(force.force) : Boolean(force);
      const avail = await diagramsApi.getAvailability(project.id);
      const archCheck = avail?.diagrams?.ARCHITECTURE;
      if (archCheck?.status === 'INSUFFICIENT' && !isForce) {
        setArchError((archCheck.missing || []).join('; '));
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

  // Tecnologías detectadas en el documento
  const documentedFe = documentedStack.filter(t => t.category === 'frontend').map(t => t.name).join(' + ');
  const documentedBe = documentedStack.filter(t => t.category === 'backend').map(t => t.name).join(' + ');
  const documentedDb = documentedStack.filter(t => t.category === 'database').map(t => t.name).join(' + ');

  const currentArch = architectureData || (project.architectures && project.architectures.length > 0 ? project.architectures[0] : null);

  const effectiveStyle = currentArch?.style || 'Columnas de Responsabilidad (Estilo Kanban / 4 Columnas)';
  const effectiveFrontend = currentArch?.frontend || documentedFe || 'React';
  const effectiveBackend = currentArch?.backend || documentedBe || 'Node.js + Express';
  const effectiveDatabase = currentArch?.database || documentedDb || 'PostgreSQL';

  // Manejador para abrir modal de edición
  const handleOpenEdit = () => {
    setEditForm({
      style: effectiveStyle,
      frontend: effectiveFrontend,
      backend: effectiveBackend,
      database: effectiveDatabase
    });
    setIsEditModalOpen(true);
  };

  // Guardar cambios de arquitectura
  const handleSaveArch = async () => {
    try {
      setIsSavingArch(true);
      const res = await fetch(`/api/projects/${project.id}/architecture`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      const json = await res.json();
      if (json.success && json.data) {
        setArchitectureData(json.data);
        setIsEditModalOpen(false);
        if (onProjectUpdated) await onProjectUpdated();
        // Regenerar el diagrama para reflejar las nuevas tecnologías
        await handleGenerateArch(true);
      }
    } catch (err) {
      setArchError('Error al guardar la arquitectura: ' + err.message);
    } finally {
      setIsSavingArch(false);
    }
  };

  // Software Architecture Diagram (Columnas de Responsabilidad / Estilo Kanban)
  const softwareArchCode = useMemo(() => {
    if (currentArch?.softwareDiagram) return currentArch.softwareDiagram;
    const fe = effectiveFrontend || 'React';
    const be = effectiveBackend || 'Node.js + Express';
    const db = effectiveDatabase || 'PostgreSQL';

    let code = `flowchart LR\n`;
    code += `  subgraph COL1 ["USUARIOS"]\n`;
    code += `    direction TB\n`;
    code += `    U_REC["Recepción (PC / Laptop)"]\n`;
    code += `  end\n\n`;

    code += `  subgraph COL2 ["INTERFAZ"]\n`;
    code += `    direction TB\n`;
    code += `    UI_APP["Interfaz web (${fe})"]\n`;
    code += `  end\n\n`;

    code += `  subgraph COL3 ["API · MÓDULOS"]\n`;
    code += `    direction TB\n`;
    code += `    API_AUTH["Autenticación y Acceso"]\n`;
    code += `    API_VEH["Clientes y Vehículos"]\n`;
    code += `    API_CITAS["Atención y Citas"]\n`;
    code += `    API_DIAG["Diagnóstico OBD"]\n`;
    code += `    API_COT["Cotizaciones y Presupuestos"]\n`;
    code += `  end\n\n`;

    code += `  subgraph COL4 ["DATOS"]\n`;
    code += `    direction TB\n`;
    code += `    DB_STORE["${db}"]\n`;
    code += `    OBJ_STORE["Almacén de evidencias"]\n`;
    code += `    SVC_BACKUP["Servicio de respaldos"]\n`;
    code += `    DB_STORE -.->|copias de seguridad| SVC_BACKUP\n`;
    code += `    OBJ_STORE -.->|copias de seguridad| SVC_BACKUP\n`;
    code += `  end\n\n`;

    code += `  U_REC --> UI_APP\n\n`;

    code += `  UI_APP --> API_AUTH\n`;
    code += `  UI_APP --> API_VEH\n`;
    code += `  UI_APP --> API_CITAS\n`;
    code += `  UI_APP --> API_DIAG\n`;
    code += `  UI_APP --> API_COT\n\n`;

    code += `  API_AUTH --> DB_STORE\n`;
    code += `  API_VEH --> DB_STORE\n`;
    code += `  API_CITAS --> DB_STORE\n`;
    code += `  API_DIAG --> DB_STORE\n`;
    code += `  API_DIAG --> OBJ_STORE\n`;
    code += `  API_COT --> DB_STORE\n`;

    return code;
  }, [currentArch, effectiveFrontend, effectiveBackend, effectiveDatabase]);

  // System Architecture Diagram (Physical deployment of the analyzed project)
  const systemArchCode = useMemo(() => {
    if (currentArch?.deploymentDiagram) return currentArch.deploymentDiagram;
    const fe = effectiveFrontend || 'Frontend';
    const be = effectiveBackend || 'Servidor Backend API';
    const db = effectiveDatabase || 'Base de datos';

    let code = `flowchart TB\n`;
    code += `  CLIENT["Dispositivo del Usuario (Navegador Web / Móvil)"]\n\n`;

    code += `  subgraph SERVER ["Infraestructura del Sistema (${effectiveStyle})"]\n`;
    code += `    PROXY["Proxy Inverso HTTPS Seguro (Nginx / SSL - RNF-04)"]\n`;
    code += `    WEB_SRV["Contenedor Web (${fe})"]\n`;
    code += `    APP_SRV["Contenedor Backend (${be})"]\n`;
    code += `    DB_SRV[("Contenedor Base de Datos (${db})")]\n`;
    code += `    BACKUP_DAEMON["Servicio Automatizado de Respaldos (RNF-08: Backup Daemon / Cron)"]\n`;
    code += `    BACKUP_VOL[("Volumen de Respaldos Seguros (Snapshots & Dumps)")]\n`;
    code += `  end\n\n`;

    code += `  CLIENT -->|Acceso HTTPS Cifrado| PROXY\n`;
    code += `  PROXY -->|Servir Assets UI| WEB_SRV\n`;
    code += `  PROXY -->|Rutas API REST| APP_SRV\n`;
    code += `  APP_SRV -->|Transacciones SQL / Driver| DB_SRV\n`;
    code += `  BACKUP_DAEMON -->|Extracción Periódica de Volcados| DB_SRV\n`;
    code += `  BACKUP_DAEMON -->|Almacenar Copias de Seguridad| BACKUP_VOL\n`;

    return code;
  }, [currentArch, effectiveFrontend, effectiveBackend, effectiveDatabase, effectiveStyle]);

  const effectiveSoftwareArchCode = storedArchDiagram || softwareArchCode;
  const activeDiagramCode = archType === 'software' ? effectiveSoftwareArchCode : (storedSystemDiagram || systemArchCode);

  const specItems = [
    { label: 'Estilo de Arquitectura', value: effectiveStyle, icon: 'layers', field: 'style' },
    { label: 'Frontend', value: effectiveFrontend, icon: 'web', field: 'frontend' },
    { label: 'Backend', value: effectiveBackend, icon: 'dns', field: 'backend' },
    { label: 'Base de Datos', value: effectiveDatabase, icon: 'storage', field: 'database' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: '#FFFFFF', padding: '32px 40px' }}>
      {archError && <div role="alert" className="alert alert-danger" style={{ marginBottom: '16px' }}>{archError}</div>}
      
      {/* Mockup Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Arquitectura
            </h1>
            <span style={{
              background: '#EEF2FF',
              color: '#4F46E5',
              border: '1px solid #E0E7FF',
              fontSize: '0.75rem',
              fontWeight: 500,
              padding: '2px 10px',
              borderRadius: '9999px'
            }}>
              Planificación
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: '6px 0 0 0' }}>
            Cómo se organiza el sistema en capas.
          </p>

          {/* Technology Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
            <span style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#334155',
              fontSize: '0.75rem',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontWeight: 500
            }}>
              {effectiveStyle || 'Clean architecture'}
            </span>
            <span style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#334155',
              fontSize: '0.75rem',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontWeight: 500
            }}>
              {effectiveFrontend || 'React'}
            </span>
            <span style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#334155',
              fontSize: '0.75rem',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontWeight: 500
            }}>
              {effectiveBackend || 'Node.js + Express'}
            </span>
            <span style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#334155',
              fontSize: '0.75rem',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontWeight: 500
            }}>
              {effectiveDatabase || 'PostgreSQL'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Capsule Switcher: Software | Sistema */}
          <div style={{
            display: 'inline-flex',
            background: '#F1F5F9',
            padding: '3px',
            borderRadius: '8px'
          }}>
            <button
              type="button"
              onClick={() => setArchType('software')}
              style={{
                background: archType === 'software' ? '#0F172A' : 'transparent',
                color: archType === 'software' ? '#FFFFFF' : '#64748B',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 16px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Software
            </button>
            <button
              type="button"
              onClick={() => setArchType('system')}
              style={{
                background: archType === 'system' ? '#0F172A' : 'transparent',
                color: archType === 'system' ? '#FFFFFF' : '#64748B',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 16px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Sistema
            </button>
          </div>

          {/* Regenerar Button */}
          <button
            type="button"
            onClick={() => handleGenerateArch(true)}
            disabled={generatingArch}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#334155',
              borderRadius: '8px',
              padding: '8px 18px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
              transition: 'all 0.15s ease'
            }}
          >
            {generatingArch ? 'Regenerando...' : 'Regenerar'}
          </button>

          {/* Modificar Button */}
          <button
            type="button"
            onClick={handleOpenEdit}
            style={{
              background: '#4F46E5',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 20px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(79, 70, 229, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            Modificar
          </button>
        </div>
      </div>

      {/* Main Diagram Card (Clean Mockup Container) */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '24px',
        padding: '28px',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
        minHeight: '560px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {showCode ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="detail-section-label">Código Mermaid ({archType === 'software' ? 'Software' : 'Sistema'})</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(activeDiagramCode)}>
                  <span className="ms ms-sm">content_copy</span><span>Copiar</span>
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setShowCode(false)}>
                  Volver al Diagrama
                </button>
              </div>
            </div>
            <textarea className="diagram-raw-editor" rows={18} readOnly value={activeDiagramCode} />
          </div>
        ) : (
          <>
            <DiagramViewport
              code={activeDiagramCode}
              type="flowchart"
              title=""
              minHeight="500px"
              isOutdated={archType === 'software' ? isOutdated : false}
              onRegenerate={() => handleGenerateArch(true)}
              canGenerate={true}
              isGenerating={generatingArch}
            />
            <div style={{ position: 'absolute', bottom: '16px', right: '20px' }}>
              <button
                type="button"
                onClick={() => setShowCode(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                Ver código Mermaid
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modal para Modificar Arquitectura */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !isSavingArch && setIsEditModalOpen(false)}
        title="Modificar Arquitectura del Sistema"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSavingArch}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveArch}
              disabled={isSavingArch}
            >
              {isSavingArch ? (
                <><span className="ms ms-xs spin">progress_activity</span><span>Guardando...</span></>
              ) : (
                <><span className="ms ms-xs">save</span><span>Guardar cambios</span></>
              )}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: 0 }}>
            Configura el estilo arquitectónico y las tecnologías principales de la solución. Al guardar, los diagramas se actualizarán para reflejar los cambios.
          </p>

          {/* Campo: Estilo de Arquitectura */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
              Estilo de Arquitectura
            </label>
            <input
              type="text"
              className="form-control"
              value={editForm.style}
              onChange={e => setEditForm({ ...editForm, style: e.target.value })}
              placeholder="Ej. Arquitectura en 3 Capas (Presentación, Servicios y Datos)"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-default)', fontSize: '0.875rem' }}
            />
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
              {['Columnas de Responsabilidad (Estilo Kanban)', '3 Capas (Cliente-Servidor)', 'Arquitectura Limpia / Hexagonal', 'Microservicios', 'Modular Monolith'].map(s => (
                <button
                  key={s}
                  type="button"
                  className="btn btn-xs btn-outline"
                  style={{ fontSize: '0.6875rem', padding: '2px 8px' }}
                  onClick={() => setEditForm({ ...editForm, style: s })}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Campo: Frontend */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
              Tecnología Frontend (Capa de Presentación)
            </label>
            <input
              type="text"
              className="form-control"
              value={editForm.frontend}
              onChange={e => setEditForm({ ...editForm, frontend: e.target.value })}
              placeholder="Ej. React, Vue.js, Angular, Next.js"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-default)', fontSize: '0.875rem' }}
            />
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
              {['React', 'Next.js', 'Vue.js', 'Angular', 'React Native (Móvil)'].map(f => (
                <button
                  key={f}
                  type="button"
                  className="btn btn-xs btn-outline"
                  style={{ fontSize: '0.6875rem', padding: '2px 8px' }}
                  onClick={() => setEditForm({ ...editForm, frontend: f })}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Campo: Backend */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
              Tecnología Backend (Capa de Negocio / API)
            </label>
            <input
              type="text"
              className="form-control"
              value={editForm.backend}
              onChange={e => setEditForm({ ...editForm, backend: e.target.value })}
              placeholder="Ej. Node.js + Express, NestJS, FastAPI (Python)"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-default)', fontSize: '0.875rem' }}
            />
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
              {['Node.js + Express', 'NestJS (Node.js)', 'FastAPI (Python)', 'Spring Boot (Java)', '.NET Core'].map(b => (
                <button
                  key={b}
                  type="button"
                  className="btn btn-xs btn-outline"
                  style={{ fontSize: '0.6875rem', padding: '2px 8px' }}
                  onClick={() => setEditForm({ ...editForm, backend: b })}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Campo: Base de Datos */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
              Motor de Base de Datos (Capa de Persistencia)
            </label>
            <input
              type="text"
              className="form-control"
              value={editForm.database}
              onChange={e => setEditForm({ ...editForm, database: e.target.value })}
              placeholder="Ej. PostgreSQL, MySQL, MongoDB, Redis"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-default)', fontSize: '0.875rem' }}
            />
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
              {['PostgreSQL', 'MySQL', 'MongoDB', 'SQL Server', 'SQLite'].map(d => (
                <button
                  key={d}
                  type="button"
                  className="btn btn-xs btn-outline"
                  style={{ fontSize: '0.6875rem', padding: '2px 8px' }}
                  onClick={() => setEditForm({ ...editForm, database: d })}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
