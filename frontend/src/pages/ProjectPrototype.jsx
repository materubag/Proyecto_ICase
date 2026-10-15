import React, { useState, useEffect, useMemo } from 'react';
import MockupRenderer from '../components/mockup-renderer/MockupRenderer';
import DiagramViewport from '../components/common/DiagramViewport';
import Modal from '../components/common/Modal';
import { screenOptions, getScreenCategories, SCREEN_CATEGORIES } from '../utils/mockupScreenOptions';
import { engineering } from '../api/engineering.api';
import { projectsApi } from '../api/projects.api';
import { mockupApi } from '../api/mockup.api';

export default function ProjectPrototype({ project, onProjectUpdated }) {
  const STORAGE_KEY = `icase_mockup_generating_${project.id}`;

  // 1. Estados
  const [detailsScreen, setDetailsScreen] = useState(null);
  const [loadingMockups, setLoadingMockups] = useState(true);
  const [localNodes, setLocalNodes] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const categories = useMemo(() => getScreenCategories(project), [project]);
  const availableScreens = screenOptions({ ...project, navigationNodes: localNodes || project.navigationNodes });
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const [generatedScreens, setGeneratedScreens] = useState([]);
  const [isGenerating, setIsGenerating] = useState(() => {
    try {
      const raw = localStorage.getItem(`icase_mockup_generating_${project.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Date.now() - (parsed.startedAt || 0) < 900000) return true;
        localStorage.removeItem(`icase_mockup_generating_${project.id}`);
      }
    } catch (e) {}
    return false;
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    try {
      const raw = localStorage.getItem(`icase_mockup_generating_${project.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.startedAt) return Math.max(0, Math.floor((Date.now() - parsed.startedAt) / 1000));
      }
    } catch (e) {}
    return 0;
  });
  const [generationError, setGenerationError] = useState(null);

  const screens = generatedScreens.length > 0 ? generatedScreens : (project.screens || []);
  const [selectedScreenId, setSelectedScreenId] = useState(null);
  const [selectorOpen, setSelectorOpen] = useState(!(project.screens || []).length);
  const [viewMode, setViewMode] = useState('render'); // 'render' | 'sketch' | 'structure' | 'relations' | 'html'

  // Cronómetro en vivo mientras genera
  useEffect(() => {
    if (!isGenerating) {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isGenerating]);

  // 2. Funciones auxiliares
  const handleSelectCore = () => {
    const coreIds = availableScreens.filter(s => s.isCore).map(s => s.id);
    setSelectedNodeIds(coreIds);
  };

  const handleSelectCategory = () => {
    if (selectedCategory === 'all') {
      setSelectedNodeIds(availableScreens.map(s => s.id));
    } else {
      const catIds = availableScreens.filter(s => s.category === selectedCategory).map(s => s.id);
      setSelectedNodeIds(prev => Array.from(new Set([...prev, ...catIds])));
    }
  };

  const handleSelectAll = () => {
    setSelectedNodeIds(availableScreens.map(s => s.id));
  };

  const handleClearSelection = () => {
    setSelectedNodeIds([]);
  };

  function setSelectedNodeIdReset() {
    setSelectedNodeIds([]);
    setSelectedScreenId(null);
  }

  const handleCancelGenerating = () => {
    setIsGenerating(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  // 3. Efectos
  useEffect(() => {
    setSelectedNodeIdReset();
    setLocalNodes(null);
  }, [project.id]);

  // Carga inicial de pantallas guardadas (no resetea isGenerating si el usuario inició una generación)
  useEffect(() => {
    let active = true;
    setLoadingMockups(true);
    mockupApi.list(project.id)
      .then(result => {
        if (!active) return;
        const stored = result.screens || [];
        setGeneratedScreens(stored);
        if (stored.length) {
          setSelectorOpen(false);
          setSelectedScreenId(prev => prev || stored[0]?.id || null);
        }
      })
      .catch(error => {
        if (active) setGenerationError('No se pudieron cargar los mockups guardados: ' + error.message);
      })
      .finally(() => {
        if (active) setLoadingMockups(false);
      });
    return () => { active = false; };
  }, [project.id]);

  // Polling si se está generando en segundo plano
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      // Validar si excedió el timeout de 15 minutos
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Date.now() - (parsed.startedAt || 0) > 900000) {
            setIsGenerating(false);
            localStorage.removeItem(STORAGE_KEY);
            setGenerationError('La generación en n8n superó el tiempo máximo de 15 minutos.');
            return;
          }
        }
      } catch (e) {}

      mockupApi.list(project.id)
        .then(result => {
          const stored = result.screens || [];
          if (!stored.length) return;
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
              const meta = JSON.parse(raw);
              const prevVersions = meta.prevVersions || {};
              // Detectar si alguna pantalla seleccionada tiene una versión más nueva
              const hasNewVersion = stored.some(s => {
                const prevVer = prevVersions[s.id] || 0;
                return (s.version || 1) > prevVer;
              });
              if (hasNewVersion) {
                setGeneratedScreens(stored);
                setSelectorOpen(false);
                setIsGenerating(false);
                localStorage.removeItem(STORAGE_KEY);
                setSelectedScreenId(stored[0]?.id || null);
              }
            }
          } catch (e) {}
        })
        .catch(err => {
          console.warn('[Mockup] Polling list error:', err.message);
        });
    }, 2500);

    return () => clearInterval(interval);
  }, [isGenerating, project.id, STORAGE_KEY]);

  useEffect(() => {
    if (screens.length > 0 && (!selectedScreenId || !screens.some(s => s.id === selectedScreenId))) {
      setSelectedScreenId(screens[0].id);
    }
  }, [screens, selectedScreenId]);

  // 4. Manejo de generacion
  async function handleGenerateMockup() {
    if (isGenerating) return;

    let targetNodeIds = [...selectedNodeIds];
    if (!targetNodeIds.length) {
      const coreIds = availableScreens.filter(s => s.isCore || s.category === 'workshop').map(s => s.id);
      targetNodeIds = coreIds.length ? coreIds : availableScreens.map(s => s.id);
      setSelectedNodeIds(targetNodeIds);
    }

    try {
      const prevVersions = {};
      screens.forEach(s => {
        if (s.id) prevVersions[s.id] = s.version || 1;
      });

      setIsGenerating(true);
      setElapsedSeconds(0);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        startedAt: Date.now(),
        targetCount: targetNodeIds.length,
        prevVersions
      }));
      setGenerationError(null);

      const selected = availableScreens.filter(n => targetNodeIds.includes(n.id));
      const ids = [];
      for (const node of selected) {
        if (!node.proposed) {
          ids.push(node.id);
          continue;
        }
        const candidate = await engineering(project.id, '/models', {
          kind: 'NavigationNode',
          name: node.name,
          content: {
            name: node.name,
            route: node.route,
            platform: node.platform,
            parentId: null,
            actorIds: [],
            useCaseIds: []
          },
          requirementIds: node.requirementIds
        });
        const promoted = await engineering(project.id, '/models/' + candidate.id, { status: 'APPROVED' }, 'PATCH');
        ids.push(promoted.promotedId);
      }

      const updated = await projectsApi.getById(project.id);
      setLocalNodes(updated.navigationNodes || []);
      setSelectedNodeIds(ids);
      await onProjectUpdated?.();

      const result = await mockupApi.generateMockup(
        project.id,
        `Generar un prototipo visual para: ${project.systemDescription || project.description || project.name}`,
        ids
      );

      const nextScreens = result?.screens || result?.data?.screens || [];
      if (nextScreens.length === 0) throw new Error('El backend no devolvió pantallas para mostrar.');

      const normalized = nextScreens.map((screen, index) => ({
        ...screen,
        id: screen.id || availableScreens.find(n => n.route === screen.route || n.name === screen.name)?.id || 'generated-' + index
      }));

      setGeneratedScreens(previous => [
        ...previous.filter(old => !normalized.some(n => n.route === old.route || n.id === old.id)),
        ...normalized
      ]);
      setSelectedScreenId(normalized[0]?.id || null);
      setSelectorOpen(false);
    } catch (error) {
      setGenerationError(error.message || 'No se pudo generar el prototipo.');
    } finally {
      setIsGenerating(false);
      localStorage.removeItem(STORAGE_KEY);
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

          <button className="btn btn-primary btn-sm" onClick={handleGenerateMockup} disabled={isGenerating}>
            {isGenerating ? (
              <><span className="ms ms-sm spin">progress_activity</span><span>Generando con Stitch ({Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60 < 10 ? '0' : ''}{elapsedSeconds % 60}s)...</span></>
            ) : (
              <><span className="ms ms-sm">auto_awesome</span><span>Generar con Stitch</span></>
            )}
          </button>
        </div>
      </div>

      <section style={{flexShrink:0,padding:'16px 24px',borderBottom:'1px solid var(--border-default)',background:'var(--surface-container-lowest)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <strong style={{fontSize:14}}>Pantallas para Prototipo</strong>
            <span style={{fontSize:12,color:'var(--secondary)',background:'var(--surface-container-low)',padding:'2px 8px',borderRadius:6}}>
              {selectedNodeIds.length} de {availableScreens.length} seleccionadas
            </span>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            <button type="button" className="btn btn-outline btn-xs" onClick={handleSelectCore} title="Selecciona las pantallas Core prioritarias">
              <span className="ms ms-xs">target</span><span>Pantallas Core</span>
            </button>
            {selectedCategory !== 'all' && (
              <button type="button" className="btn btn-outline btn-xs" onClick={handleSelectCategory} title="Selecciona todas las pantallas del actor actual">
                <span className="ms ms-xs">checklist</span><span>Actor ({categories.find(c=>c.id===selectedCategory)?.label || 'Actual'})</span>
              </button>
            )}
            <button type="button" className="btn btn-outline btn-xs" onClick={handleSelectAll}>
              <span className="ms ms-xs">select_all</span><span>Todas ({availableScreens.length})</span>
            </button>
            <button type="button" className="btn btn-ghost btn-xs" onClick={handleClearSelection} disabled={!selectedNodeIds.length}>
              <span className="ms ms-xs">clear</span><span>Limpiar</span>
            </button>
            <button type="button" className="btn btn-primary btn-sm" aria-expanded={selectorOpen} onClick={()=>setSelectorOpen(v=>!v)}>
              <span className="ms ms-xs">{selectorOpen ? 'expand_less' : 'tune'}</span>
              <span>{selectorOpen ? 'Ocultar catálogo' : 'Elegir pantallas'}</span>
            </button>
          </div>
        </div>
        {selectorOpen && (
          <div style={{marginTop:14}}>
            {/* Category tabs */}
            <div style={{display:'flex',gap:6,marginBottom:12,borderBottom:'1px solid var(--border-default)',paddingBottom:8,overflowX:'auto'}}>
              <button
                type="button"
                className={`btn btn-xs ${selectedCategory === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSelectedCategory('all')}
              >
                Todas ({availableScreens.length})
              </button>
              {categories.map(cat => {
                const catScreens = availableScreens.filter(s => s.category === cat.id);
                const count = catScreens.length;
                const catIds = catScreens.map(s => s.id);
                const isAllSelected = catIds.length > 0 && catIds.every(id => selectedNodeIds.includes(id));
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`btn btn-xs ${selectedCategory === cat.id ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{display:'flex',alignItems:'center',gap:4}}
                  >
                    <span className="ms ms-xs">{cat.icon}</span>
                    <span>{cat.label} ({count})</span>
                    {isAllSelected && <span style={{fontSize:10,color:'#10b981'}}>✓</span>}
                  </button>
                );
              })}
            </div>

            {/* Screens Grid */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(270px,1fr))',gap:10,maxHeight:260,overflowY:'auto',paddingRight:4}}>
              {availableScreens
                .filter(node => selectedCategory === 'all' || node.category === selectedCategory)
                .map(node => {
                  const isChecked = selectedNodeIds.includes(node.id);
                  return (
                    <div
                      key={node.id}
                      style={{
                        display:'flex',
                        flexDirection:'column',
                        justifyContent:'space-between',
                        padding:'10px 12px',
                        border: isChecked ? '1.5px solid var(--primary)' : '1px solid var(--border-default)',
                        borderRadius: 8,
                        background: isChecked ? 'rgba(37,99,235,0.04)' : 'var(--surface-container-lowest)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                        <input
                          type="checkbox"
                          disabled={isGenerating}
                          checked={isChecked}
                          onChange={event => setSelectedNodeIds(ids => event.target.checked ? [...ids, node.id] : ids.filter(id => id !== node.id))}
                          style={{marginTop:3,cursor:'pointer'}}
                        />
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,color:'var(--on-surface)',lineHeight:1.3}}>
                            {node.name}
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4,flexWrap:'wrap'}}>
                            <code style={{fontSize:11,color:'var(--primary)',background:'rgba(37,99,235,0.08)',padding:'1px 5px',borderRadius:4}}>
                              {node.route}
                            </code>
                            <span style={{fontSize:11,color:'var(--secondary)'}}>
                              {node.functionalities?.length || 0} RF{node.functionalities?.length === 1 ? '' : 's'}
                            </span>
                            {node.isCore && (
                              <span style={{fontSize:10,background:'#fef3c7',color:'#b45309',fontWeight:600,padding:'1px 5px',borderRadius:4}}>
                                Core
                              </span>
                            )}
                            {node.actorName && (
                              <span style={{fontSize:10,background:'rgba(2,132,199,0.08)',color:'var(--primary)',fontWeight:500,padding:'1px 5px',borderRadius:4}}>
                                {node.actorName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setDetailsScreen(node)} style={{fontSize:11,padding:'2px 6px'}}>
                          Ver detalles
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
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

      {isGenerating && (
        <div style={{ margin: '14px 24px 0', padding: '14px 18px', borderRadius: 8, background: '#eff6ff', border: '1px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="ms ms-md spin" style={{ color: '#2563eb', fontSize: 24 }}>progress_activity</span>
            <div>
              <div style={{ fontWeight: 600, color: '#1d4ed8', fontSize: 13 }}>
                Generando pantallas con Google Stitch ({Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60 < 10 ? '0' : ''}{elapsedSeconds % 60}s)
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                Google Stitch está construyendo el código HTML interactivo en alta fidelidad y en paralelo. Puedes cambiar de pestaña o esperar aquí; el progreso no se perderá.
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-outline btn-xs" onClick={handleCancelGenerating} style={{ borderColor: '#93c5fd', color: '#1e40af', background: '#fff' }}>
            Cancelar espera
          </button>
        </div>
      )}

      {loadingMockups ? (
        <div className="page-scrollable" style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:240}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
            <span className="ms ms-lg spin" style={{color:'var(--primary)'}}>autorenew</span>
            <span style={{color:'var(--secondary)',fontSize:13}}>Cargando prototipos guardados...</span>
          </div>
        </div>
      ) : isGenerating && screens.length === 0 ? (
        <div className="page-scrollable">
          <div className="empty-state" style={{ border: '1px solid rgba(37,99,235,0.3)', borderRadius: 'var(--radius-lg)', background: 'rgba(37,99,235,0.03)' }}>
            <div className="empty-state-icon"><span className="ms ms-xl spin" style={{color:'var(--primary)'}}>autorenew</span></div>
            <p className="empty-state-title" style={{color:'var(--primary)'}}>Construyendo prototipos de la aplicación con Google Stitch</p>
            <p className="empty-state-desc">
              Generando vistas de alta fidelidad, componentes y código HTML interactivo a partir de los requerimientos seleccionados...
            </p>
          </div>
        </div>
      ) : screens.length === 0 ? (
        <div className="page-scrollable">
          <div className="empty-state" style={{ border: '1px dashed var(--outline-variant)', borderRadius: 'var(--radius-lg)' }}>
            <div className="empty-state-icon"><span className="ms ms-xl">devices</span></div>
            <p className="empty-state-title">Sin pantallas generadas</p>
            <p className="empty-state-desc">
              Selecciona las pantallas de la lista superior y pulsa Generar con Stitch.
            </p>
            <button className="btn btn-primary btn-sm" onClick={handleGenerateMockup} disabled={isGenerating}>
              <span className="ms ms-sm">auto_awesome</span>
              <span>{isGenerating ? 'Generando...' : 'Generar con Stitch'}</span>
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
