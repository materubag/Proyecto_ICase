import React, { useState, useEffect, useMemo } from 'react';
import MockupRenderer from '../components/mockup-renderer/MockupRenderer';
import DiagramViewport from '../components/common/DiagramViewport';
import Modal from '../components/common/Modal';
import { mockupApi } from '../api/mockup.api';
import { screensApi } from '../api/screens.api';

export default function ProjectPrototype({
  project,
  onProjectUpdated,
  mockupGeneration = null,
  onStartGeneration = null,
  onClearFeedback = null
}) {
  const [screens, setScreens] = useState(project.screens || []);
  const [selectedScreenId, setSelectedScreenId] = useState(project.screens?.[0]?.id || null);
  const [selectedForStitch, setSelectedForStitch] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estados locales como fallback si no se inyecta mockupGeneration
  const [localIsGenerating, setLocalIsGenerating] = useState(false);
  const [localGeneratingMode, setLocalGeneratingMode] = useState('stitch'); // 'stitch' | 'local'
  const [localGenerationError, setLocalGenerationError] = useState(null);
  const [localGenerationSuccess, setLocalGenerationSuccess] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [customPrompt, setCustomPrompt] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('render'); // 'render' | 'sketch' | 'structure' | 'relations' | 'html'

  // Resolver estados activos (globales o locales)
  const isGenerating = Boolean(
    mockupGeneration
      ? (mockupGeneration.isGenerating && mockupGeneration.projectId === project.id)
      : localIsGenerating
  );
  const generatingMode = mockupGeneration?.mode || localGeneratingMode;
  const generationError = mockupGeneration?.error || localGenerationError;
  const generationSuccess = mockupGeneration?.success || localGenerationSuccess;

  // Contador de segundos transcurridos mientras se genera
  useEffect(() => {
    let interval;
    if (isGenerating) {
      const startTime = mockupGeneration?.startTime || Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
      interval = setInterval(() => {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating, mockupGeneration?.startTime]);

  // Cargar pantallas desde API o proyecto
  useEffect(() => {
    loadScreens();
  }, [project.id]);

  // Sincronizar pantallas cuando el proyecto se actualice en background
  useEffect(() => {
    if (Array.isArray(project.screens) && project.screens.length > 0) {
      setScreens(project.screens);
      // Si la pantalla seleccionada no tiene HTML y alguna sí tiene, seleccionar la primera con HTML
      const current = project.screens.find(s => s.id === selectedScreenId);
      if (!current?.html) {
        const withHtml = project.screens.find(s => s.html);
        if (withHtml) {
          setSelectedScreenId(withHtml.id);
        }
      }
    }
  }, [project.screens]);

  async function loadScreens() {
    try {
      const res = await screensApi.getByProject(project.id);
      const list = res?.data || res || [];
      if (Array.isArray(list) && list.length > 0) {
        setScreens(list);
        // Inicializar seleccionadas
        const alreadySelected = list.filter(s => s.selectedForGeneration !== false).map(s => s.id);
        setSelectedForStitch(alreadySelected.length > 0 ? alreadySelected : list.map(s => s.id));
        if (!selectedScreenId || !list.some(s => s.id === selectedScreenId)) {
          setSelectedScreenId(list[0].id);
        }
      } else if (project.screens && project.screens.length > 0) {
        setScreens(project.screens);
        setSelectedForStitch(project.screens.map(s => s.id));
        if (!selectedScreenId) setSelectedScreenId(project.screens[0].id);
      }
    } catch (err) {
      console.warn('Error loading screens:', err);
      if (project.screens && project.screens.length > 0) {
        setScreens(project.screens);
        setSelectedForStitch(project.screens.map(s => s.id));
        if (!selectedScreenId) setSelectedScreenId(project.screens[0].id);
      }
    }
  }

  // Asegurar selección de pantalla activa si cambian las pantallas
  useEffect(() => {
    if (screens.length > 0 && (!selectedScreenId || !screens.some(s => s.id === selectedScreenId))) {
      setSelectedScreenId(screens[0].id);
    }
  }, [screens]);

  // Alternar selección de una pantalla para Google Stitch
  function toggleScreenForStitch(screenId, e) {
    if (e) e.stopPropagation();
    setSelectedForStitch(prev => {
      if (prev.includes(screenId)) {
        return prev.filter(id => id !== screenId);
      } else {
        return [...prev, screenId];
      }
    });
  }

  function handleSelectAll() {
    setSelectedForStitch(screens.map(s => s.id));
  }

  function handleDeselectAll() {
    setSelectedForStitch([]);
  }

  function dismissError() {
    if (onClearFeedback) onClearFeedback();
    setLocalGenerationError(null);
  }

  function dismissSuccess() {
    if (onClearFeedback) onClearFeedback();
    setLocalGenerationSuccess(null);
  }

  // Ejecutar generación (Google Stitch o Local)
  async function handleGenerate(mode = 'stitch') {
    if (isGenerating) return;
    if (selectedForStitch.length === 0) {
      setLocalGenerationError('Por favor selecciona al menos una pantalla para generar con Google Stitch.');
      setIsModalOpen(true);
      return;
    }

    const promptText = customPrompt.trim()
      ? customPrompt
      : 'Quiero un estilo claro y no muy sobrecargado';

    // Si tenemos manejador global persistente, delegamos a él
    if (onStartGeneration) {
      try {
        setIsModalOpen(false);
        if (onClearFeedback) onClearFeedback();
        const res = await onStartGeneration(project.id, promptText, selectedForStitch, mode);
        const nextScreens = res?.screens || res?.data?.screens || [];
        if (nextScreens.length > 0) {
          setScreens(nextScreens);
          const firstGen = nextScreens.find(s => selectedForStitch.includes(s.id) && s.html) || nextScreens[0];
          if (firstGen) setSelectedScreenId(firstGen.id);
        }
      } catch (err) {
        console.warn('Error en onStartGeneration:', err);
      }
      return;
    }

    // Fallback local independiente
    try {
      setLocalIsGenerating(true);
      setLocalGeneratingMode(mode);
      setLocalGenerationError(null);
      setLocalGenerationSuccess(null);

      const result = await mockupApi.generateMockup(
        project.id,
        promptText,
        selectedForStitch,
        mode
      );

      const nextScreens = result?.screens || result?.data?.screens || result?.data?.allScreens || [];
      if (nextScreens.length === 0) {
        throw new Error('El backend no devolvió pantallas generadas.');
      }

      setScreens(nextScreens);
      const firstGenerated = nextScreens.find(s => selectedForStitch.includes(s.id) && s.html) || nextScreens[0];
      if (firstGenerated) {
        setSelectedScreenId(firstGenerated.id);
      }

      setLocalGenerationSuccess(
        mode === 'stitch'
          ? `¡Se generaron exitosamente ${selectedForStitch.length} pantalla(s) con Google Stitch!`
          : `¡Se generaron exitosamente ${selectedForStitch.length} pantalla(s) con el motor local!`
      );
      setIsModalOpen(false);

      if (onProjectUpdated) {
        await onProjectUpdated();
      }
    } catch (error) {
      console.error('Error generando mockups:', error);
      const isTimeout = error.message?.includes('504') || error.message?.includes('timeout') || error.message?.includes('tiempo límite');
      setLocalGenerationError({
        message: error.message || 'No se pudo generar el prototipo.',
        isTimeout
      });
    } finally {
      setLocalIsGenerating(false);
    }
  }

  const currentScreen = screens.find(s => s.id === selectedScreenId) || screens[0];

  // Diagrama de relaciones entre pantallas
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

  // Filtrar pantallas en el modal de selección
  const filteredScreens = useMemo(() => {
    if (!searchTerm.trim()) return screens;
    const term = searchTerm.toLowerCase();
    return screens.filter(s =>
      s.name?.toLowerCase().includes(term) ||
      s.route?.toLowerCase().includes(term) ||
      s.description?.toLowerCase().includes(term)
    );
  }, [screens, searchTerm]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Command Bar Header */}
      <div className="full-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 className="page-title" style={{ fontSize: '1.125rem', margin: 0 }}>
                Mockups & Prototipos
              </h2>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'linear-gradient(135deg, rgba(37,99,235,0.12), rgba(124,58,237,0.12))',
                  border: '1px solid rgba(37,99,235,0.25)',
                  color: '#2563eb',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.6875rem',
                  fontWeight: 600
                }}
              >
                <span className="ms ms-xs">auto_awesome</span>
                Google Stitch
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
              {screens.length} pantalla{screens.length !== 1 ? 's' : ''} disponibles · {selectedForStitch.length} seleccionada{selectedForStitch.length !== 1 ? 's' : ''} para generación
            </span>
          </div>
        </div>

        <div className="page-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                title="Estructura de organización de la información"
              >
                <span className="ms ms-xs">view_quilt</span><span>Estructura</span>
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
                title="Ver código HTML generado"
              >
                <span className="ms ms-xs">code</span><span>HTML</span>
              </button>
            </div>
          )}

          {/* Botón Seleccionar Pantallas */}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setIsModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span className="ms ms-xs">checklist</span>
            <span>Seleccionar Pantallas</span>
            <span
              style={{
                background: 'var(--primary)',
                color: '#ffffff',
                borderRadius: '10px',
                padding: '1px 6px',
                fontSize: '0.6875rem',
                fontWeight: 700
              }}
            >
              {selectedForStitch.length}
            </span>
          </button>

          {/* Botón Generar con Google Stitch */}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => handleGenerate('stitch')}
            disabled={isGenerating || selectedForStitch.length === 0}
            style={{
              background: 'linear-gradient(135deg, #1d4ed8, #4338ca)',
              border: 'none',
              boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isGenerating && generatingMode === 'stitch' ? (
              <>
                <span className="ms ms-sm spin">autorenew</span>
                <span>Generando en Stitch...</span>
              </>
            ) : (
              <>
                <span className="ms ms-sm">auto_awesome</span>
                <span>Generar con Google Stitch ({selectedForStitch.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Banner de Estado de Carga con Contador de Tiempo */}
      {isGenerating && (
        <div
          style={{
            margin: '12px 24px 0',
            padding: '12px 16px',
            background: 'linear-gradient(90deg, #eff6ff, #f5f3ff)',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 2px 8px rgba(37,99,235,0.08)'
          }}
        >
          <span className="ms ms-md spin" style={{ color: '#2563eb' }}>sync</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '0.875rem', color: '#1e3a8a' }}>
                {generatingMode === 'stitch'
                  ? 'Conectando con Google Stitch mediante n8n...'
                  : 'Generando prototipos interactivos locales...'}
              </strong>
              {elapsedSeconds > 0 && (
                <span
                  style={{
                    background: '#dbeafe',
                    color: '#1d4ed8',
                    padding: '1px 8px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    fontFamily: 'monospace'
                  }}
                >
                  ⏱️ {elapsedSeconds}s transcurridos
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#3b82f6', display: 'block', marginTop: '2px' }}>
              Enviando {selectedForStitch.length} pantalla(s) seleccionadas. Puedes cambiar de pestaña libremente; el proceso continuará ejecutándose hasta recibir respuesta.
            </span>
          </div>
        </div>
      )}

      {/* Alerta de Error / Timeout 504 */}
      {generationError && (
        <div
          className="alert alert-danger"
          style={{
            margin: '12px 24px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span className="ms ms-sm" style={{ marginTop: '2px' }}>error_outline</span>
            <div style={{ flex: 1 }}>
              <strong>Error en la generación:</strong>
              <p style={{ margin: '4px 0 0', fontSize: '0.8125rem' }}>
                {typeof generationError === 'string' ? generationError : generationError.message}
              </p>
            </div>
            <button
              className="btn btn-ghost btn-xs"
              onClick={dismissError}
              style={{ padding: '2px' }}
            >
              <span className="ms ms-xs">close</span>
            </button>
          </div>

          {/* Opciones de resolución ante Timeout 504 o fallas */}
          {generationError.isTimeout && (
            <div
              style={{
                marginTop: '4px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap'
              }}
            >
              <span style={{ fontSize: '0.75rem', color: '#991b1b' }}>
                El webhook de Google Stitch demoró más de 120s en responder. Puedes reintentar o generar los mockups de inmediato con el motor local:
              </span>
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={() => handleGenerate('stitch')}
                disabled={isGenerating}
                style={{ fontSize: '0.75rem' }}
              >
                <span className="ms ms-xs">replay</span> Reintentar Stitch
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => handleGenerate('local')}
                disabled={isGenerating}
                style={{ fontSize: '0.75rem', background: '#ffffff' }}
              >
                <span className="ms ms-xs">bolt</span> Generar con Motor Local (Inmediato)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Alerta de Éxito */}
      {generationSuccess && (
        <div
          className="alert alert-success"
          style={{
            margin: '12px 24px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="ms ms-sm">check_circle</span>
            <span>{generationSuccess}</span>
          </div>
          <button
            className="btn btn-ghost btn-xs"
            onClick={dismissSuccess}
            style={{ padding: '2px' }}
          >
            <span className="ms ms-xs">close</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {screens.length === 0 ? (
        <div className="page-scrollable">
          <div
            className="empty-state"
            style={{
              border: '1px dashed var(--outline-variant)',
              borderRadius: 'var(--radius-lg)',
              margin: '24px'
            }}
          >
            <div className="empty-state-icon">
              <span className="ms ms-xl">devices</span>
            </div>
            <p className="empty-state-title">Sin pantallas registradas</p>
            <p className="empty-state-desc">
              Importa o analiza documentos en la pestaña Resumen para extraer las pantallas del sistema, o pulsa generar para crearlas con Google Stitch.
            </p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleGenerate('stitch')}
              disabled={isGenerating}
            >
              <span className="ms ms-sm">auto_awesome</span>
              <span>{isGenerating ? 'Generando en Stitch...' : 'Generar pantallas con Google Stitch'}</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Screen Tabs Bar con checkboxes interactivos */}
          {viewMode !== 'relations' && (
            <div className="screen-selector" style={{ alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, overflowX: 'auto' }}>
                {screens.map(screen => {
                  const isCheckedForStitch = selectedForStitch.includes(screen.id);
                  const isScreenActive = selectedScreenId === screen.id;
                  const hasHtml = Boolean(screen.html);

                  return (
                    <div
                      key={screen.id}
                      className={`screen-tab ${isScreenActive ? 'active' : ''}`}
                      onClick={() => setSelectedScreenId(screen.id)}
                      style={{ position: 'relative', userSelect: 'none' }}
                    >
                      {/* Checkbox selector rápido para Stitch */}
                      <span
                        onClick={(e) => toggleScreenForStitch(screen.id, e)}
                        title={isCheckedForStitch ? 'Deseleccionar de Google Stitch' : 'Seleccionar para Google Stitch'}
                        style={{
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          color: isCheckedForStitch ? '#2563eb' : '#94a3b8'
                        }}
                      >
                        <span className="ms ms-xs">
                          {isCheckedForStitch ? 'check_box' : 'check_box_outline_blank'}
                        </span>
                      </span>

                      <span style={{ fontWeight: isScreenActive ? 600 : 500 }}>
                        {screen.name}
                      </span>

                      {/* Badge de estado del prototipo */}
                      {hasHtml ? (
                        <span
                          title="Prototipo generado disponible"
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: '#10b981',
                            display: 'inline-block'
                          }}
                        />
                      ) : (
                        <span
                          title="Sin prototipo generado aún"
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: '#f59e0b',
                            display: 'inline-block'
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Botón flotante para abrir modal de selección completa */}
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setIsModalOpen(true)}
                title="Gestionar selección de pantallas para Google Stitch"
                style={{ marginLeft: '8px', color: 'var(--primary)', flexShrink: 0 }}
              >
                <span className="ms ms-xs">settings</span>
                <span>Configurar Selección</span>
              </button>
            </div>
          )}

          {/* Área de Visualización */}
          <div className="page-scrollable" style={{ padding: '20px 24px' }}>
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
                      Identidad institucional, logo del sistema, título de la pantalla activa ({currentScreen?.name}), buscador global y panel de usuario.
                    </p>
                  </div>

                  <div className="info-card" style={{ borderLeft: '4px solid #0284c7' }}>
                    <strong style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="ms ms-xs">menu</span> 2. Navegación (Sidebar / Menú)
                    </strong>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '6px 0 0', lineHeight: 1.4 }}>
                      Árbol de navegación con enlaces a las vistas principales ({screens.map(s => s.name).join(', ')}), badges y acciones rápidas.
                    </p>
                  </div>

                  <div className="info-card" style={{ borderLeft: '4px solid #16a34a' }}>
                    <strong style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="ms ms-xs">dashboard</span> 3. Área Central de Trabajo
                    </strong>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '6px 0 0', lineHeight: 1.4 }}>
                      Muestra los datos primarios de la pantalla: tablas de datos, tarjetas de indicadores, formularios o gráficos interactivos.
                    </p>
                  </div>

                  <div className="info-card" style={{ borderLeft: '4px solid var(--tertiary)' }}>
                    <strong style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="ms ms-xs">touch_app</span> 4. Interacción & Formularios
                    </strong>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '6px 0 0', lineHeight: 1.4 }}>
                      Controles de formulario con validación, botones de acción primaria ("Guardar", "Confirmar") y notificaciones de estado.
                    </p>
                  </div>
                </div>

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
                    Diagrama que muestra cómo los usuarios transitan entre las diferentes vistas del sistema.
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <p className="detail-section-label" style={{ margin: 0 }}>
                    HTML de Google Stitch — {currentScreen?.name}
                  </p>
                  {currentScreen?.htmlUrl && (
                    <a
                      href={currentScreen.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-xs"
                    >
                      <span className="ms ms-xs">open_in_new</span> Abrir enlace HTML
                    </a>
                  )}
                </div>
                <pre
                  className="code-viewer"
                  style={{
                    background: '#0f172a',
                    color: '#f8fafc',
                    padding: '16px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    overflowX: 'auto',
                    maxHeight: '600px'
                  }}
                >
                  {currentScreen?.html || 'Esta pantalla aún no tiene HTML generado por Google Stitch.'}
                </pre>
              </div>
            ) : (
              <MockupRenderer screen={currentScreen} />
            )}
          </div>
        </>
      )}

      {/* Modal de Selección de Pantallas para Google Stitch */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Seleccionar Pantallas para Google Stitch"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              <strong>{selectedForStitch.length}</strong> de {screens.length} pantalla(s) seleccionadas
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleGenerate('stitch')}
                disabled={isGenerating || selectedForStitch.length === 0}
                style={{
                  background: 'linear-gradient(135deg, #1d4ed8, #4338ca)',
                  border: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span className="ms ms-sm">auto_awesome</span>
                <span>Generar con Google Stitch ({selectedForStitch.length})</span>
              </button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Banner descriptivo Google Stitch */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(124,58,237,0.06))',
              border: '1px solid rgba(37,99,235,0.18)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}
          >
            <span className="ms ms-md" style={{ color: '#2563eb', marginTop: '2px' }}>
              auto_awesome
            </span>
            <div style={{ fontSize: '0.8125rem', color: '#1e293b', lineHeight: 1.45 }}>
              <strong>Generación con Google Stitch:</strong> Selecciona las pantallas que deseas enviar a Google Stitch.
              El webhook orquestará la creación de interfaces interactivas con tablas, formularios y estilos empresariales.
            </div>
          </div>

          {/* Advertencia preventiva de timeout para lotes grandes */}
          {selectedForStitch.length > 3 && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.75rem',
                color: '#92400e'
              }}
            >
              <span className="ms ms-xs" style={{ color: '#d97706' }}>info</span>
              <span>
                <strong>Recomendación:</strong> Has seleccionado {selectedForStitch.length} pantallas. Como Google Stitch tarda ~20-30s por pantalla, se recomienda generar en lotes de <strong>1 a 3 pantallas</strong> a la vez para evitar que el webhook de ngrok/n8n alcance el tiempo límite (120s timeout 504).
              </span>
            </div>
          )}

          {/* Barra de Filtro y Selección Rápida */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Buscar pantalla por nombre o ruta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '0.8125rem' }}
              />
              <span
                className="ms ms-xs"
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8'
                }}
              >
                search
              </span>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={handleSelectAll}
              >
                Seleccionar todas
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={handleDeselectAll}
              >
                Deseleccionar todas
              </button>
            </div>
          </div>

          {/* Listado de Pantallas con Checkboxes */}
          <div
            style={{
              maxHeight: '340px',
              overflowY: 'auto',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              padding: '6px'
            }}
          >
            {filteredScreens.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--secondary)', fontSize: '0.8125rem' }}>
                No se encontraron pantallas que coincidan con la búsqueda.
              </div>
            ) : (
              filteredScreens.map(scr => {
                const isChecked = selectedForStitch.includes(scr.id);
                const hasHtml = Boolean(scr.html);

                return (
                  <div
                    key={scr.id}
                    onClick={() => toggleScreenForStitch(scr.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      background: isChecked ? 'rgba(37, 99, 235, 0.04)' : '#ffffff',
                      border: isChecked ? '1px solid rgba(37, 99, 235, 0.25)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      marginBottom: '4px'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // Manejado por onClick del contenedor
                      style={{ marginTop: '3px', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>
                          {scr.name}
                        </span>
                        <code
                          style={{
                            fontSize: '0.7rem',
                            padding: '1px 6px',
                            background: '#f1f5f9',
                            borderRadius: '4px',
                            color: '#475569'
                          }}
                        >
                          {scr.route || '/'}
                        </code>
                        {hasHtml ? (
                          <span
                            style={{
                              marginLeft: 'auto',
                              fontSize: '0.6875rem',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              background: '#dcfce7',
                              color: '#15803d',
                              fontWeight: 600
                            }}
                          >
                            ✓ Prototipo listo
                          </span>
                        ) : (
                          <span
                            style={{
                              marginLeft: 'auto',
                              fontSize: '0.6875rem',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              background: '#fef3c7',
                              color: '#b45309',
                              fontWeight: 600
                            }}
                          >
                            Pendiente
                          </span>
                        )}
                      </div>
                      {scr.description && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.35 }}>
                          {scr.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Campo opcional de instrucciones personalizadas para Stitch */}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface)', display: 'block', marginBottom: '4px' }}>
              Instrucciones de diseño opcionales para Google Stitch:
            </label>
            <textarea
              className="form-control"
              placeholder="Ej. Estilo minimalista, paleta azul corporativa, tablas con buscador y botones de exportación..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={2}
              style={{ fontSize: '0.8125rem' }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
