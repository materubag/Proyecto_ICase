import React, { useState, useMemo } from 'react';
import DiagramViewport from '../components/common/DiagramViewport';
import { generateNavigationDiagram } from '../utils/mermaidGenerators';

export default function ProjectNavigation({ project }) {
  const [activeTab, setActiveTab] = useState('diagram'); // 'diagram' | 'hierarchy' | 'matrix' | 'code'
  const navigation = project.navigationNodes || [];
  const screens = project.screens || [];
  const generatedCode = useMemo(() => generateNavigationDiagram(navigation, screens), [navigation, screens]);

  // Derived transitions list
  const transitions = useMemo(() => {
    if (navigation && navigation.length > 0) {
      return navigation.map((n, idx) => ({
        id: `TRANS-${idx + 1}`,
        from: n.from || 'Inicio',
        to: n.to || 'Destino',
        action: n.action || 'Navegación / Clic',
        route: screens.find(s => s.name === n.to)?.route || '/vista'
      }));
    }
    // Fallback: connect sequentially or default
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
      { id: 'TRANS-2', from: 'Dashboard Principal', to: 'Módulo de Catálogo', action: 'Clic en Menú', route: '/catalogo' },
      { id: 'TRANS-3', from: 'Dashboard Principal', to: 'Módulo de Operaciones', action: 'Clic en Menú', route: '/operaciones' },
      { id: 'TRANS-4', from: 'Módulo de Operaciones', to: 'Modal de Registro', action: 'Botón Crear Nuevo', route: '/operaciones/nuevo' },
      { id: 'TRANS-5', from: 'Módulo de Catálogo', to: 'Detalle de Elemento', action: 'Seleccionar Fila', route: '/catalogo/:id' },
    ];
  }, [navigation, screens]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header bar */}
      <div className="full-page-header" style={{ borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div>
            <h2 className="page-title" style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="ms ms-sm" style={{ color: 'var(--primary)' }}>account_tree</span>
              Árbol de Navegación de la Aplicación
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
              Estructura jerárquica de vistas, mapa del sitio y matriz de transiciones entre pantallas
            </span>
          </div>
          <div className="vdivider" />
          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              <strong style={{ color: 'var(--on-surface)', fontWeight: 600 }}>{screens.length || 4}</strong> pantallas
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              <strong style={{ color: 'var(--on-surface)', fontWeight: 600 }}>{transitions.length}</strong> transiciones
            </span>
          </div>
        </div>

        {/* View Toggle */}
        <div className="view-toggle" style={{ background: 'var(--surface-container-high)' }}>
          <button
            className={`view-toggle-btn ${activeTab === 'diagram' ? 'active' : ''}`}
            onClick={() => setActiveTab('diagram')}
          >
            <span className="ms ms-xs">fork_right</span>
            <span>Diagrama de Flujo</span>
          </button>
          <button
            className={`view-toggle-btn ${activeTab === 'hierarchy' ? 'active' : ''}`}
            onClick={() => setActiveTab('hierarchy')}
          >
            <span className="ms ms-xs">list_alt</span>
            <span>Jerarquía de Pantallas</span>
          </button>
          <button
            className={`view-toggle-btn ${activeTab === 'matrix' ? 'active' : ''}`}
            onClick={() => setActiveTab('matrix')}
          >
            <span className="ms ms-xs">swap_horiz</span>
            <span>Matriz de Transiciones</span>
          </button>
          <button
            className={`view-toggle-btn ${activeTab === 'code' ? 'active' : ''}`}
            onClick={() => setActiveTab('code')}
          >
            <span className="ms ms-xs">code</span>
            <span>Código Mermaid</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="page-scrollable" style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
        {activeTab === 'diagram' && (
          <div>
            <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                  Diagrama de Flujo y Rutas de Navegación
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                  Representación gráfica del recorrido del usuario a través de las diferentes pantallas y diálogos.
                </p>
              </div>
            </div>

            <DiagramViewport
              code={generatedCode}
              type="flowchart"
              title="Diagrama de Flujo y Rutas de Navegación"
              minHeight="500px"
            />
          </div>
        )}

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
              {/* Level 1 */}
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
                        <strong style={{ fontSize: '0.875rem', color: '#1e293b' }}>Página de Inicio / Login & Acceso</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Ruta: <code>/login</code> · Control de sesiones y autenticación de usuarios</div>
                      </div>
                    </div>
                    <span className="badge badge-success">Público / Entrada</span>
                  </div>
                </div>
              </div>

              {/* Level 2 */}
              <div style={{ border: '1px solid #86efac', borderRadius: 'var(--radius-md)', background: '#f0fdf4', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>Nivel 2: Tablero Principal y Navegación Global</span>
                  <span style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>Estructura de Menú y Dashboard</span>
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

        {activeTab === 'matrix' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                Matriz de Transiciones de Pantalla
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                Detalle técnico de enlaces, eventos disparadores y rutas de navegación entre pantallas del sistema.
              </p>
            </div>

            <div style={{ background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline-variant)', overflowX: 'auto', boxShadow: 'var(--shadow-xs)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-container-low)', borderBottom: '2px solid var(--primary)', color: 'var(--on-surface)' }}>
                    <th style={{ padding: '10px 14px', width: '100px', fontWeight: 700 }}>ID</th>
                    <th style={{ padding: '10px 14px', width: '220px', fontWeight: 700 }}>Pantalla de Origen</th>
                    <th style={{ padding: '10px 14px', width: '220px', fontWeight: 700 }}>Evento / Disparador</th>
                    <th style={{ padding: '10px 14px', width: '220px', fontWeight: 700 }}>Pantalla de Destino</th>
                    <th style={{ padding: '10px 14px', fontWeight: 700 }}>Ruta URI</th>
                  </tr>
                </thead>
                <tbody>
                  {transitions.map((tr, idx) => (
                    <tr key={tr.id} style={{ borderBottom: '1px solid var(--outline-variant)', background: idx % 2 === 0 ? 'var(--surface)' : 'var(--surface-container-lowest)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary)' }}>{tr.id}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--on-surface)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span className="ms ms-xs" style={{ color: 'var(--secondary)' }}>radio_button_checked</span>
                          {tr.from}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--secondary)' }}>
                        <span className="badge badge-outline" style={{ fontSize: '0.75rem' }}>
                          {tr.action}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--primary)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span className="ms ms-xs" style={{ color: 'var(--primary)' }}>arrow_forward</span>
                          {tr.to}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
                        <code>{tr.route}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="detail-section-label">Código Mermaid Generado (Flowchart)</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(generatedCode)}>
                <span className="ms ms-sm">content_copy</span><span>Copiar Código</span>
              </button>
            </div>
            <textarea className="diagram-raw-editor" rows={16} readOnly value={generatedCode} />
          </div>
        )}
      </div>
    </div>
  );
}
