import React, { useState, useEffect, useMemo } from 'react';
import DiagramViewport from '../components/common/DiagramViewport';
import { generateNavigationDiagram, generateFlowchartDiagram } from '../utils/mermaidGenerators';
import { diagramsApi } from '../api/diagrams.api';

export default function ProjectNavigation({ project, onProjectUpdated }) {
  const [activeTab, setActiveTab] = useState('tree'); // 'tree' | 'flow' | 'hierarchy' | 'matrix' | 'code'

  const screens = project.screens || [];
  const requirements = project.requirements || [];
  const useCases = project.useCases || [];
  const navigationNodes = project.navigationNodes || [];

  // Local fallback generators
  const localNavCode = useMemo(() => generateNavigationDiagram(navigationNodes, screens, project.name), [navigationNodes, screens, project.name]);
  const localFlowCode = useMemo(() => generateFlowchartDiagram(requirements, useCases, project.name), [requirements, useCases, project.name]);

  // Árbol de Navegación state
  const [storedNavDiagram, setStoredNavDiagram] = useState('');
  const [isNavOutdated, setIsNavOutdated] = useState(false);
  const [generatingNav, setGeneratingNav] = useState(false);

  // Diagrama de Flujo state
  const [storedFlowDiagram, setStoredFlowDiagram] = useState('');
  const [isFlowOutdated, setIsFlowOutdated] = useState(false);
  const [generatingFlow, setGeneratingFlow] = useState(false);

  useEffect(() => {
    loadDiagrams();
  }, [project.id]);

  async function loadDiagrams() {
    try {
      const [avail, navRes, flowRes] = await Promise.allSettled([
        diagramsApi.getAvailability(project.id),
        diagramsApi.getDiagram(project.id, 'NAVIGATION'),
        diagramsApi.getDiagram(project.id, 'FLOWCHART')
      ]);

      if (navRes.status === 'fulfilled') {
        const code = navRes.value?.code || navRes.value?.mermaidCode || navRes.value?.artifact?.mermaidCode;
        if (code) {
          setStoredNavDiagram(code);
          setIsNavOutdated(!!navRes.value.isOutdated);
        }
      }

      if (flowRes.status === 'fulfilled') {
        const code = flowRes.value?.code || flowRes.value?.mermaidCode || flowRes.value?.artifact?.mermaidCode;
        if (code) {
          setStoredFlowDiagram(code);
          setIsFlowOutdated(!!flowRes.value.isOutdated);
        }
      }

      if (avail.status === 'fulfilled') {
        const d = avail.value?.diagrams;
        if (d?.NAVIGATION?.isOutdated) setIsNavOutdated(true);
        if (d?.FLOWCHART?.isOutdated) setIsFlowOutdated(true);
      }
    } catch (err) {
      console.error('Error loading navigation/flow diagrams:', err);
    }
  }

  async function handleGenerateNav(force = false) {
    try {
      setGeneratingNav(true);
      const isForce = typeof force === 'object' ? Boolean(force.force) : Boolean(force);
      const res = await diagramsApi.generateDiagram(project.id, 'NAVIGATION', isForce);
      const code = res?.code || res?.mermaidCode || res?.diagram?.mermaidCode || res?.artifact?.mermaidCode;
      if (code) {
        setStoredNavDiagram(code);
        setIsNavOutdated(false);
      }
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al generar árbol de navegación: ${err.message}`);
    } finally {
      setGeneratingNav(false);
    }
  }

  async function handleGenerateFlow(force = false) {
    try {
      setGeneratingFlow(true);
      const isForce = typeof force === 'object' ? Boolean(force.force) : Boolean(force);
      const res = await diagramsApi.generateDiagram(project.id, 'FLOWCHART', isForce);
      const code = res?.code || res?.mermaidCode || res?.diagram?.mermaidCode || res?.artifact?.mermaidCode;
      if (code) {
        setStoredFlowDiagram(code);
        setIsFlowOutdated(false);
      }
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al generar diagrama de flujo: ${err.message}`);
    } finally {
      setGeneratingFlow(false);
    }
  }

  const effectiveNavCode = storedNavDiagram || localNavCode;
  const effectiveFlowCode = storedFlowDiagram || localFlowCode;

  // Transitions for technical matrix
  const transitions = useMemo(() => {
    if (navigationNodes && navigationNodes.length > 0) {
      return navigationNodes.map((n, idx) => ({
        id: `TRANS-${idx + 1}`,
        from: n.from || 'Inicio',
        to: n.to || 'Destino',
        action: n.action || 'Navegación / Clic',
        route: screens.find(s => s.name === n.to)?.route || '/vista'
      }));
    }
    if (screens && screens.length > 1) {
      return screens.slice(0, screens.length - 1).map((s, idx) => ({
        id: `TRANS-${idx + 1}`,
        from: s.name,
        to: screens[idx + 1].name,
        action: 'Selección de Menú / Enlace',
        route: screens[idx + 1].route || `/${screens[idx + 1].name.toLowerCase().replace(/\s+/g, '-')}`
      }));
    }
    return [
      { id: 'TRANS-1', from: 'Inicio / Login', to: 'Dashboard Principal', action: 'Autenticación Exitosa', route: '/dashboard' },
      { id: 'TRANS-2', from: 'Dashboard Principal', to: 'Módulo Principal', action: 'Acceso Directo', route: '/modulo' }
    ];
  }, [navigationNodes, screens]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header bar */}
      <div className="full-page-header" style={{ borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div>
            <h2 className="page-title" style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="ms ms-sm" style={{ color: 'var(--primary)' }}>account_tree</span>
              Navegación & Procesos
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
              Árbol jerárquico de pantallas de la aplicación y Diagrama de Flujo de procesos operativos
            </span>
          </div>
          <div className="vdivider" />
          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              <strong style={{ color: 'var(--on-surface)', fontWeight: 600 }}>{screens.length}</strong> pantallas
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              <strong style={{ color: 'var(--on-surface)', fontWeight: 600 }}>{requirements.length}</strong> requisitos
            </span>
          </div>
        </div>

        {/* View Toggle & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {activeTab === 'tree' && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => handleGenerateNav(true)}
              disabled={generatingNav}
              title="Generar o regenerar árbol de navegación con IA"
            >
              <span className={`ms ms-xs ${generatingNav ? 'spin' : ''}`}>
                {generatingNav ? 'autorenew' : 'auto_awesome'}
              </span>
              <span>{generatingNav ? 'Generando...' : storedNavDiagram ? 'Regenerar Árbol' : 'Generar Árbol'}</span>
            </button>
          )}

          {activeTab === 'flow' && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => handleGenerateFlow(true)}
              disabled={generatingFlow}
              title="Generar o regenerar diagrama de flujo operativo con IA"
            >
              <span className={`ms ms-xs ${generatingFlow ? 'spin' : ''}`}>
                {generatingFlow ? 'autorenew' : 'auto_awesome'}
              </span>
              <span>{generatingFlow ? 'Generando...' : storedFlowDiagram ? 'Regenerar Flujo' : 'Generar Flujo'}</span>
            </button>
          )}

          <div className="view-toggle" style={{ background: 'var(--surface-container-high)' }}>
            <button
              className={`view-toggle-btn ${activeTab === 'tree' ? 'active' : ''}`}
              onClick={() => setActiveTab('tree')}
              title="Estructura jerárquica de la aplicación (Padre → Hijo)"
            >
              <span className="ms ms-xs">account_tree</span>
              <span>1. Árbol de Navegación</span>
            </button>
            <button
              className={`view-toggle-btn ${activeTab === 'flow' ? 'active' : ''}`}
              onClick={() => setActiveTab('flow')}
              title="Flujo operativo de procesos de negocio"
            >
              <span className="ms ms-xs">alt_route</span>
              <span>2. Diagrama de Flujo</span>
            </button>
            <button
              className={`view-toggle-btn ${activeTab === 'hierarchy' ? 'active' : ''}`}
              onClick={() => setActiveTab('hierarchy')}
            >
              <span className="ms ms-xs">list_alt</span>
              <span>Jerarquía</span>
            </button>
            <button
              className={`view-toggle-btn ${activeTab === 'matrix' ? 'active' : ''}`}
              onClick={() => setActiveTab('matrix')}
            >
              <span className="ms ms-xs">swap_horiz</span>
              <span>Transiciones</span>
            </button>
            <button
              className={`view-toggle-btn ${activeTab === 'code' ? 'active' : ''}`}
              onClick={() => setActiveTab('code')}
            >
              <span className="ms ms-xs">code</span>
              <span>Mermaid</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="page-scrollable" style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
        {/* SUBTAB 1: ÁRBOL DE NAVEGACIÓN */}
        {activeTab === 'tree' && (
          <div>
            <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                  Árbol de Navegación
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                  Estructura jerárquica de la aplicación: organización multinivel desde la raíz del sistema hasta los módulos y pantallas.
                </p>
              </div>
            </div>

            <DiagramViewport
              code={effectiveNavCode}
              type="flowchart"
              title="Árbol de Navegación (Jerarquía Padre → Hijo)"
              minHeight="520px"
              isOutdated={isNavOutdated}
              onRegenerate={() => handleGenerateNav(true)}
              canGenerate={true}
              isGenerating={generatingNav}
            />
          </div>
        )}

        {/* SUBTAB 2: DIAGRAMA DE FLUJO */}
        {activeTab === 'flow' && (
          <div>
            <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                  Diagrama de Flujo
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                  Flujo secuencial de procesos operativos de negocio: inicio, pasos de procesamiento, decisiones con bifurcación y fin.
                </p>
              </div>
            </div>

            <DiagramViewport
              code={effectiveFlowCode}
              type="flowchart"
              title="Diagrama de Flujo (Procesos Operativos)"
              minHeight="520px"
              isOutdated={isFlowOutdated}
              onRegenerate={() => handleGenerateFlow(true)}
              canGenerate={true}
              isGenerating={generatingFlow}
            />
          </div>
        )}

        {/* SUBTAB 3: JERARQUÍA EN LISTA */}
        {activeTab === 'hierarchy' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                Estructura Jerárquica del Árbol de Navegación
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                Organización multinivel de la aplicación desde el punto de entrada hasta las vistas de detalle.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ border: '1px solid #93c5fd', borderRadius: 'var(--radius-md)', background: '#eff6ff', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>Nivel 1: Entrada y Autenticación</span>
                  <span style={{ fontSize: '0.8rem', color: '#1e40af', fontWeight: 600 }}>Ruta Raíz / Acceso Inicial</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '6px', border: '1px solid rgba(77,141,247,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="ms ms-sm" style={{ color: '#2563eb' }}>login</span>
                      <div>
                        <strong style={{ fontSize: '0.875rem', color: '#1e293b' }}>Página de Inicio / Login</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Ruta: <code>/login</code></div>
                      </div>
                    </div>
                    <span className="badge badge-success">Público / Entrada</span>
                  </div>
                </div>
              </div>

              <div style={{ border: '1px solid #86efac', borderRadius: 'var(--radius-md)', background: '#f0fdf4', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>Nivel 2: Módulos del Sistema</span>
                  <span style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 600 }}>Vistas Funcionales ({screens.length})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(52,211,153,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="ms ms-sm" style={{ color: '#16a34a' }}>dashboard</span>
                      <div>
                        <strong style={{ fontSize: '0.8125rem', color: '#0f172a' }}>Dashboard General</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Ruta: <code>/dashboard</code> · Métricas y accesos rápidos</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(52,211,153,0.2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="ms ms-sm" style={{ color: '#16a34a' }}>view_module</span>
                      <div>
                        <strong style={{ fontSize: '0.8125rem', color: '#0f172a' }}>Módulos Principales</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Gestión centralizada del dominio del proyecto</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Level 3 */}
              <div style={{ border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', background: '#fffbeb', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>Nivel 3: Pantallas Operativas y Listados</span>
                  <span style={{ fontSize: '0.8rem', color: '#854d0e', fontWeight: 600 }}>Vistas de Gestión de Datos</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                  {(screens.length > 0 ? screens : [
                    { name: 'Catálogo de Recursos', route: '/catalogo', desc: 'Listado con filtros y paginación' },
                    { name: 'Gestión de Préstamos / Transacciones', route: '/operaciones', desc: 'Registro y seguimiento de transacciones' },
                    { name: 'Administración de Usuarios', route: '/usuarios', desc: 'Control de cuentas y perfiles' },
                  ]).map((scr, idx) => (
                    <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(251,191,36,0.2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="ms ms-sm" style={{ color: '#d97706' }}>article</span>
                        <div>
                          <strong style={{ fontSize: '0.8125rem', color: '#0f172a' }}>{scr.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Ruta: <code>{scr.route || '/vista'}</code></div>
                          {scr.desc && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{scr.desc}</div>}
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              </div>


              {/* Level 4 */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', background: '#f8fafc', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="badge badge-outline" style={{ fontSize: '0.75rem' }}>Nivel 4: Modales, Formularios y Acciones</span>
                  <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>Diálogos Emergentes & Formularios CRUD</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--outline-variant)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="ms ms-xs" style={{ color: '#64748b' }}>add_circle</span>
                      <span style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 500 }}>Modal: Nuevo Registro / Alta</span>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--outline-variant)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="ms ms-xs" style={{ color: '#64748b' }}>edit_note</span>
                      <span style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 500 }}>Modal: Edición / Modificación</span>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--outline-variant)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="ms ms-xs" style={{ color: '#64748b' }}>help</span>
                      <span style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 500 }}>Diálogo de Confirmación de Baja / Eliminación</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 4: MATRIZ DE TRANSICIONES */}
        {activeTab === 'matrix' && (
          <div>
            <div style={{ marginBottom: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                Matriz de Transiciones entre Pantallas
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                Detalle técnico de enlaces, eventos disparadores y rutas de navegación entre pantallas del sistema.
              </p>
            </div>

            <div className="table-responsive" style={{ border: '1px solid var(--outline-variant)', borderRadius: 'var(--radius-md)' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Pantalla Origen</th>
                    <th>Evento / Acción</th>
                    <th>Pantalla Destino</th>
                    <th>Ruta Destino</th>
                  </tr>
                </thead>
                <tbody>
                  {transitions.map(t => (
                    <tr key={t.id}>
                      <td><code style={{ fontSize: '0.75rem' }}>{t.id}</code></td>
                      <td><strong>{t.from}</strong></td>
                      <td><span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>{t.action}</span></td>
                      <td><strong>{t.to}</strong></td>
                      <td><code style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{t.route}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBTAB 5: CÓDIGO MERMAID */}
        {activeTab === 'code' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h5 style={{ margin: '0 0 6px', fontSize: '0.875rem', fontWeight: 600 }}>Código: Árbol de Navegación</h5>
              <textarea
                className="diagram-raw-editor"
                rows={10}
                readOnly
                value={effectiveNavCode}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8125rem' }}
              />
            </div>
            <div>
              <h5 style={{ margin: '0 0 6px', fontSize: '0.875rem', fontWeight: 600 }}>Código: Diagrama de Flujo</h5>
              <textarea
                className="diagram-raw-editor"
                rows={10}
                readOnly
                value={effectiveFlowCode}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8125rem' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
