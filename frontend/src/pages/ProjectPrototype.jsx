import React, { useState, useEffect, useMemo } from 'react';
import MockupRenderer from '../components/mockup-renderer/MockupRenderer';
import DiagramViewport from '../components/common/DiagramViewport';
import Modal from '../components/common/Modal';
import { screenOptions } from '../utils/mockupScreenOptions';
import { engineering } from '../api/engineering.api';
import { projectsApi } from '../api/projects.api';
import { mockupApi } from '../api/mockup.api';

export default function ProjectPrototype({ project, onProjectUpdated }) {
  const [selectorOpen,setSelectorOpen]=useState(!(project.screens||[]).length);
  const [detailsScreen,setDetailsScreen]=useState(null);
  const [loadingMockups,setLoadingMockups]=useState(true);
  const [localNodes,setLocalNodes]=useState(null);
  const availableScreens=screenOptions({...project,navigationNodes:localNodes || project.navigationNodes});
  const [selectedNodeIds,setSelectedNodeIds]=useState([]);
  useEffect(()=>{setGeneratedScreens([]);setSelectedNodeIdReset();setLocalNodes(null);},[project.id]);
  useEffect(()=>{
    let active=true;setLoadingMockups(true);
    mockupApi.list(project.id).then(result=>{if(!active)return;const stored=result.screens||[];setGeneratedScreens(stored);if(stored.length)setSelectorOpen(false);}).catch(error=>{if(active)setGenerationError('No se pudieron cargar los mockups guardados: '+error.message);}).finally(()=>{if(active)setLoadingMockups(false);});
    return ()=>{active=false;};
  },[project.id]);
  function setSelectedNodeIdReset(){setSelectedNodeIds([]);setSelectedScreenId(null);}
  const [generatedScreens, setGeneratedScreens] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const screens = generatedScreens.length > 0 ? generatedScreens : (project.screens || []);
  const [selectedScreenId, setSelectedScreenId] = useState(screens[0]?.id || null);
  const [viewMode, setViewMode] = useState('render'); // 'render' | 'sketch' | 'structure' | 'relations' | 'html'

  useEffect(() => {
    if (screens.length > 0 && (!selectedScreenId || !screens.some(s => s.id === selectedScreenId))) {
      setSelectedScreenId(screens[0].id);
    }
  }, [screens]);

  async function handleGenerateMockup() {
    if (isGenerating) return;
    if(!selectedNodeIds.length){setGenerationError('Selecciona las pantallas que quieres generar.');return;}
    try {
      setIsGenerating(true);
      setGenerationError(null);
      const selected=availableScreens.filter(n=>selectedNodeIds.includes(n.id));
      const ids=[];
      for(const node of selected){
        if(!node.proposed){ids.push(node.id);continue;}
        const candidate=await engineering(project.id,'/models',{kind:'NavigationNode',name:node.name,content:{name:node.name,route:node.route,platform:node.platform,parentId:null,actorIds:[],useCaseIds:[]},requirementIds:node.requirementIds});
        const promoted=await engineering(project.id,'/models/'+candidate.id,{status:'APPROVED'},'PATCH');
        ids.push(promoted.promotedId);
      }
      const updated=await projectsApi.getById(project.id);
      setLocalNodes(updated.navigationNodes||[]);setSelectedNodeIds(ids);
      await onProjectUpdated?.();
      const result = await mockupApi.generateMockup(
        project.id,
        `Generar un prototipo visual para: ${project.systemDescription || project.description || project.name}`,
        ids
      );
      const nextScreens = result?.screens || result?.data?.screens || [];
      if (nextScreens.length === 0) throw new Error('El backend no devolvió pantallas para mostrar.');
      const normalized=nextScreens.map((screen,index)=>({...screen,id:screen.id || availableScreens.find(n=>n.route===screen.route||n.name===screen.name)?.id || 'generated-'+index}));
      setGeneratedScreens(previous=>[...previous.filter(old=>!normalized.some(n=>n.route===old.route||n.id===old.id)),...normalized]);
      setSelectedScreenId(normalized[0]?.id || null);
      setSelectorOpen(false);
    } catch (error) {
      setGenerationError(error.message || 'No se pudo generar el prototipo.');
    } finally {
      setIsGenerating(false);
    }
  }

  const currentScreen = screens.find(s => s.id === selectedScreenId) || screens[0];

  // Generate Mermaid diagram for screen relations / navigation tree
  const screenRelationsDiagram = useMemo(() => {
    let code = `graph TD\n`;
    code += `  %% Estilos para el Mapa de Navegación\n`;
    code += `  classDef home fill:#2563eb,stroke:#1d4ed8,stroke-width:2px,color:#ffffff,font-weight:bold;\n`;
    code += `  classDef screen fill:#f8fafc,stroke:#0284c7,stroke-width:1.5px,color:#0f172a;\n`;
    code += `  classDef modal fill:#fef3c7,stroke:#d97706,stroke-width:1.5px,color:#78350f;\n\n`;

    if (screens.length === 0) {
      return `graph TD\n  NODATA["Sin pantallas en el prototipo"]`;
    }

    const root = screens[0];
    code += `  ROOT["<b>🏠 ${root.name}</b><br/>${root.route || '/'}"]:::home\n`;

    screens.slice(1).forEach((scr, idx) => {
      const scrId = `SCR_${idx + 1}`;
      code += `  ${scrId}["<b>📄 ${scr.name}</b><br/>${scr.route || '/vista'}"]:::screen\n`;
      code += `  ROOT -->|Navegación / Menú| ${scrId}\n`;
    });

    return code;
  }, [screens]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Command bar */}
      <div className="full-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <h2 className="page-title" style={{ fontSize: '1.125rem' }}>
              Prototipos de la Aplicación (Sketch & Mockup)
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
              {screens.length} pantalla{screens.length !== 1 ? 's' : ''} · Visualización, relaciones entre pantallas y estructura de organización
            </span>
          </div>
        </div>

        <div className="page-actions">
          {screens.length > 0 && (
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${viewMode === 'render' ? 'active' : ''}`}
                onClick={() => setViewMode('render')}
                title="Mockup interactivo en alta fidelidad"
              >
                <span className="ms ms-xs">palette</span><span>Mockup</span>
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'sketch' ? 'active' : ''}`}
                onClick={() => setViewMode('sketch')}
                title="Sketch / Wireframe en baja fidelidad"
              >
                <span className="ms ms-xs">draw</span><span>Sketch</span>
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'structure' ? 'active' : ''}`}
                onClick={() => setViewMode('structure')}
                title="Estructura de organización de la información de la vista"
              >
                <span className="ms ms-xs">view_quilt</span><span>Estructura de Información</span>
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'relations' ? 'active' : ''}`}
                onClick={() => setViewMode('relations')}
                title="Relaciones entre pantallas y árbol de navegación"
              >
                <span className="ms ms-xs">account_tree</span><span>Relaciones</span>
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'html' ? 'active' : ''}`}
                onClick={() => setViewMode('html')}
              >
                <span className="ms ms-xs">code</span><span>HTML</span>
              </button>
            </div>
          )}

          <button className="btn btn-primary btn-sm" onClick={handleGenerateMockup} disabled={isGenerating || !selectedNodeIds.length}>
            {isGenerating ? (
              <><span className="ms ms-sm spin">autorenew</span><span>Generando...</span></>
            ) : (
              <><span className="ms ms-sm">auto_awesome</span><span>Generar con n8n</span></>
            )}
          </button>
        </div>
      </div>

      <section style={{flexShrink:0,padding:'16px 24px',borderBottom:'1px solid var(--border-default)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
          <div><strong>Pantallas a generar</strong><span style={{marginLeft:12,fontSize:13,color:'var(--secondary)'}}>{selectedNodeIds.length} seleccionadas</span></div>
          <button type="button" className="btn btn-outline btn-sm" aria-expanded={selectorOpen} onClick={()=>setSelectorOpen(value=>!value)}>{selectorOpen?'Ocultar selector':'Seleccionar pantallas'}</button>
        </div>
        {selectorOpen && <>
        {availableScreens.length ? <>
          <p>Selecciona solo las pantallas que necesitas. Se enviaran {selectedNodeIds.length} al generador.</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:8,maxHeight:220,overflowY:'auto'}}>{availableScreens.map(node=><div key={node.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',border:selectedNodeIds.includes(node.id)?'1px solid var(--primary)':'1px solid var(--border-default)',borderRadius:8,background:'var(--surface-container-lowest)'}}>
            <label style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0,cursor:'pointer'}}><input type="checkbox" disabled={isGenerating} checked={selectedNodeIds.includes(node.id)} onChange={event=>setSelectedNodeIds(ids=>event.target.checked?[...ids,node.id]:ids.filter(id=>id!==node.id))}/><span style={{fontSize:13,fontWeight:600}}>{node.name}</span></label>
            <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setDetailsScreen(node)}>Ver detalles</button>
          </div>)}</div>
        </> : <p>No hay pantallas aprobadas con ruta y requisitos vinculados. No hay requisitos funcionales aprobados para proponer pantallas.</p>}
        </>}
      </section>
      <Modal isOpen={!!detailsScreen} onClose={()=>setDetailsScreen(null)} title={detailsScreen?.name||'Pantalla'}>
        <p>{detailsScreen?.description}</p><small>{detailsScreen?.route}</small>
        <h4>Funcionalidades</h4><ul>{detailsScreen?.functionalities.map(item=><li key={item.id}><strong>{item.code}</strong>: {item.text}</li>)}</ul>
      </Modal>
      {/* Error */}
      {generationError && (
        <div className="alert alert-danger" style={{ margin: '12px 24px 0' }}>
          <span className="ms ms-sm">error_outline</span>
          <span>{generationError}</span>
        </div>
      )}

      {loadingMockups ? <div className="page-scrollable">Cargando mockups guardados...</div> : screens.length === 0 ? (
        <div className="page-scrollable">
          <div className="empty-state" style={{ border: '1px dashed var(--outline-variant)', borderRadius: 'var(--radius-lg)' }}>
            <div className="empty-state-icon"><span className="ms ms-xl">devices</span></div>
            <p className="empty-state-title">Sin pantallas generadas</p>
            <p className="empty-state-desc">
              Selecciona las pantallas de la lista superior y pulsa Generar con n8n.
            </p>
            <button className="btn btn-primary btn-sm" onClick={handleGenerateMockup} disabled={isGenerating}>
              <span className="ms ms-sm">auto_awesome</span>
              <span>{isGenerating ? 'Generando...' : 'Generar prototipo'}</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Screen selector tabs */}
          {viewMode !== 'relations' && (
            <div className="screen-selector" style={{flexShrink:0}}>
              {screens.map(screen => (
                <button
                  key={screen.id}
                  className={`screen-tab ${selectedScreenId === screen.id ? 'active' : ''}`}
                  onClick={() => setSelectedScreenId(screen.id)}
                >
                  <span className="ms ms-xs">monitor</span>
                  <span>{screen.name}</span>
                  {screen.route && (
                    <span style={{ fontSize: '0.6875rem', opacity: 0.7 }}>{screen.route}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="page-scrollable" style={{ padding: '20px 24px', flex:1, minHeight:0 }}>
            {viewMode === 'structure' ? (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--on-surface)', margin: 0 }}>
                    Estructura de Organización de la Información — {currentScreen?.name}
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '2px 0 0' }}>
                    Explicación de la arquitectura de información, zonas visuales y jerarquía de componentes de esta vista.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                  <div className="info-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                    <strong style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="ms ms-xs">web</span> 1. Cabecera (Header)
                    </strong>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '6px 0 0', lineHeight: 1.4 }}>
                      Identidad institucional, logo del sistema, título de la pantalla activa ({currentScreen?.name}), buscador global y panel de usuario con avatar y rol.
                    </p>
                  </div>

                  <div className="info-card" style={{ borderLeft: '4px solid #0284c7' }}>
                    <strong style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="ms ms-xs">menu</span> 2. Navegación (Sidebar / Menú)
                    </strong>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '6px 0 0', lineHeight: 1.4 }}>
                      Árbol de navegación con enlaces a las vistas principales ({screens.map(s => s.name).join(', ')}), badges de notificación y botón de repliegue.
                    </p>
                  </div>

                  <div className="info-card" style={{ borderLeft: '4px solid #16a34a' }}>
                    <strong style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="ms ms-xs">dashboard</span> 3. Área Central de Trabajo
                    </strong>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '6px 0 0', lineHeight: 1.4 }}>
                      Muestra los datos primarios de la pantalla: tablas de datos, tarjetas de indicadores (KPIs), filtros dinámicos y estados de carga.
                    </p>
                  </div>

                  <div className="info-card" style={{ borderLeft: '4px solid #9333ea' }}>
                    <strong style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="ms ms-xs">touch_app</span> 4. Interacción & Formularios
                    </strong>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '6px 0 0', lineHeight: 1.4 }}>
                      Formularios con validaciones en tiempo real, modales de confirmación, botones de acción primaria ("Guardar", "Registrar") y avisos de estado.
                    </p>
                  </div>
                </div>

                {/* Live Preview with wireframe overlay */}
                <div style={{ background: 'var(--surface-container-lowest)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline-variant)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                    Previsualización de la Pantalla:
                  </span>
                  <MockupRenderer screen={currentScreen} />
                </div>
              </div>
            ) : viewMode === 'relations' ? (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--on-surface)', margin: 0 }}>
                    Relación entre Pantallas y Árbol de Navegación
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '2px 0 0' }}>
                    Diagrama que muestra cómo los usuarios navegan y transitan entre cada una de las vistas del sistema.
                  </p>
                </div>

                <DiagramViewport
                  code={screenRelationsDiagram}
                  type="flowchart"
                  title="Relación entre Pantallas y Rutas"
                  minHeight="500px"
                />
              </div>
            ) : viewMode === 'sketch' ? (
              <div>
                <div className="alert alert-info" style={{ marginBottom: '14px', fontSize: '0.75rem' }}>
                  <span className="ms ms-xs">draw</span>
                  <span><strong>Modo Sketch / Wireframe:</strong> Renderizado de baja fidelidad en escala de grises para validar la distribución de bloques sin distracción de color.</span>
                </div>
                <div style={{ filter: 'grayscale(1) contrast(1.15)', border: '2px dashed #94a3b8', borderRadius: '8px', padding: '10px', background: '#fafafa' }}>
                  <MockupRenderer screen={currentScreen} />
                </div>
              </div>
            ) : viewMode === 'html' ? (
              <div>
                <p className="detail-section-label" style={{ marginBottom: '8px' }}>
                  HTML — {currentScreen?.name}
                </p>
                <pre className="code-viewer" style={{ background: '#f8fafc', color: 'var(--on-surface)' }}>
                  {currentScreen?.html || 'Esta pantalla no contiene HTML.'}
                </pre>
              </div>
            ) : (
              <MockupRenderer screen={currentScreen} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
