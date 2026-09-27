import React, { useState, useEffect } from 'react';
import { Layout, Monitor, Code, Sparkles, Loader2, CheckSquare, Square, Check, X, Edit2, Play, ExternalLink } from 'lucide-react';
import { screensApi } from '../api/screens.api';
import MockupRenderer from '../components/mockup-renderer/MockupRenderer';
import Modal from '../components/common/Modal';

export default function ProjectPrototype({ project, onProjectUpdated }) {
  const [screens, setScreens] = useState(project.screens || []);
  const [selectedScreenId, setSelectedScreenId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState('interactive'); // 'interactive' | 'components'
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    loadScreens();
  }, [project.id]);

  async function loadScreens() {
    try {
      const data = await screensApi.getByProject(project.id);
      setScreens(data);
      if (data.length > 0 && !selectedScreenId) {
        setSelectedScreenId(data[0].id);
      }
    } catch (err) {
      console.error('Error loading screens:', err);
    }
  }

  // Toggle selección de una pantalla para generar
  async function handleToggleSelect(screenId, currentStatus) {
    try {
      await screensApi.toggleSelect(screenId, !currentStatus);
      setScreens(screens.map(s => s.id === screenId ? { ...s, selectedForGeneration: !currentStatus } : s));
    } catch (err) {
      alert(`Error al actualizar selección: ${err.message}`);
    }
  }

  // Seleccionar todas o deseleccionar todas
  async function handleSelectAll(select) {
    try {
      const ids = screens.map(s => s.id);
      await screensApi.selectMultiple(project.id, ids, select);
      setScreens(screens.map(s => ({ ...s, selectedForGeneration: select })));
    } catch (err) {
      alert(`Error al seleccionar pantallas: ${err.message}`);
    }
  }

  // Generar prototipos para las pantallas seleccionadas
  async function handleGenerateSelected() {
    const selectedCount = screens.filter(s => s.selectedForGeneration).length;
    if (selectedCount === 0) {
      alert('Por favor seleccione al menos una pantalla marcando la casilla de verificación.');
      return;
    }

    try {
      setIsGenerating(true);
      await screensApi.generateSelected(project.id);
      await loadScreens();
      if (onProjectUpdated) await onProjectUpdated();
      alert(`¡Se generaron exitosamente los prototipos de las ${selectedCount} pantallas seleccionadas!`);
    } catch (err) {
      alert(`Error al generar prototipos: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleUpdateStatus(screenId, reviewStatus) {
    try {
      await screensApi.updateStatus(screenId, reviewStatus);
      await loadScreens();
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al actualizar estado: ${err.message}`);
    }
  }

  function openEditModal(screen) {
    setEditData({
      id: screen.id,
      name: screen.name,
      route: screen.route,
      purpose: screen.purpose || screen.description || '',
      reviewStatus: screen.reviewStatus || 'APPROVED'
    });
    setEditModalOpen(true);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    try {
      await screensApi.update(editData.id, editData);
      setEditModalOpen(false);
      await loadScreens();
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al guardar cambios: ${err.message}`);
    }
  }

  const currentScreen = screens.find((s) => s.id === selectedScreenId) || screens[0];
  const selectedCount = screens.filter(s => s.selectedForGeneration).length;

  return (
    <div>
      {/* Barra de Encabezado y Acción de Generación */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layout size={20} color="var(--primary)" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>
              Prototipado Visual y Mockups Interactivos
            </h2>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Seleccione las pantallas que desea generar y renderice prototipos funcionales HTML.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={handleGenerateSelected}
            disabled={isGenerating || selectedCount === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {isGenerating ? (
              <>
                <Loader2 size={15} className="spin" />
                <span>Generando Prototipos...</span>
              </>
            ) : (
              <>
                <Sparkles size={15} />
                <span>Generar Seleccionadas ({selectedCount})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Panel de Selección de Pantallas a Generar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Selección de Pantallas a Construir ({selectedCount} de {screens.length} seleccionadas)
          </span>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => handleSelectAll(true)}>
              Seleccionar Todas
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleSelectAll(false)}>
              Deseleccionar Todas
            </button>
          </div>
        </div>

        {/* Checkbox Grid de Pantallas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
          {screens.map((scr) => {
            const isSelected = Boolean(scr.selectedForGeneration);
            const isCurrent = scr.id === selectedScreenId;
            return (
              <div
                key={scr.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '6px',
                  border: isCurrent ? '2px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: isCurrent ? 'rgba(37,99,235,0.04)' : 'var(--bg-secondary)',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedScreenId(scr.id)}
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSelect(scr.id, isSelected);
                  }}
                  style={{ display: 'flex', alignItems: 'center', color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}
                  title={isSelected ? 'Desmarcar' : 'Marcar para generar'}
                >
                  {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {scr.name}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {scr.route}
                  </div>
                </div>

                <span
                  className="badge"
                  style={{
                    fontSize: '0.65rem',
                    padding: '2px 5px',
                    backgroundColor: scr.html ? '#dcfce7' : '#f1f5f9',
                    color: scr.html ? '#15803d' : '#64748b'
                  }}
                >
                  {scr.html ? 'HTML' : 'Pendiente'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Visualizador del Mockup Seleccionado con Gobernanza */}
      {currentScreen && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
                  {currentScreen.name}
                </h3>
                <code style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>{currentScreen.route}</code>
                <span
                  className="badge"
                  style={{
                    backgroundColor: currentScreen.reviewStatus === 'APPROVED' ? '#dcfce7' : currentScreen.reviewStatus === 'DISCARDED' ? '#fee2e2' : '#fef3c7',
                    color: currentScreen.reviewStatus === 'APPROVED' ? '#15803d' : currentScreen.reviewStatus === 'DISCARDED' ? '#b91c1c' : '#b45309'
                  }}
                >
                  {currentScreen.reviewStatus === 'APPROVED' ? 'Aprobado' : currentScreen.reviewStatus === 'DISCARDED' ? 'Rechazado' : 'Pendiente'}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {currentScreen.purpose || currentScreen.description || 'Vista declarativa de usuario'}
              </p>
            </div>

            {/* Acciones de Gobernanza: Aprobar, Rechazar, Editar */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                className="btn btn-secondary btn-sm"
                style={{ color: '#16a34a' }}
                onClick={() => handleUpdateStatus(currentScreen.id, 'APPROVED')}
                title="Aprobar prototipo"
              >
                <Check size={14} />
                <span>Aprobar</span>
              </button>

              <button
                className="btn btn-secondary btn-sm"
                style={{ color: '#dc2626' }}
                onClick={() => handleUpdateStatus(currentScreen.id, 'DISCARDED')}
                title="Rechazar prototipo"
              >
                <X size={14} />
                <span>Rechazar</span>
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => openEditModal(currentScreen)}
                title="Editar información de pantalla"
              >
                <Edit2 size={14} />
                <span>Editar</span>
              </button>
            </div>
          </div>

          {/* Selector de Modo: Interactivo HTML vs Componentes */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              className={`btn ${viewMode === 'interactive' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setViewMode('interactive')}
            >
              <Monitor size={14} style={{ marginRight: '4px' }} />
              Vista Interactiva HTML
            </button>
            <button
              className={`btn ${viewMode === 'components' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setViewMode('components')}
            >
              <Code size={14} style={{ marginRight: '4px' }} />
              Componentes Estructurados
            </button>
          </div>

          {/* Renderizado */}
          {viewMode === 'interactive' ? (
            currentScreen.html ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', minHeight: '480px' }}>
                <iframe
                  title={currentScreen.name}
                  srcDoc={currentScreen.html}
                  style={{ width: '100%', height: '520px', border: 'none', backgroundColor: '#fff' }}
                  sandbox="allow-scripts"
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Esta pantalla aún no tiene el prototipo HTML generado.
                </p>
                <button className="btn btn-primary btn-sm" onClick={handleGenerateSelected} disabled={isGenerating}>
                  <Sparkles size={14} />
                  <span>Generar Prototipo HTML Ahora</span>
                </button>
              </div>
            )
          ) : (
            <MockupRenderer screen={currentScreen} />
          )}
        </div>
      )}

      {/* Modal Editar Pantalla */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Editar Pantalla / Mockup"
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSaveEdit}>Guardar Cambios</button>
          </>
        )}
      >
        <form onSubmit={handleSaveEdit}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Nombre de la Pantalla *</label>
            <input
              type="text"
              className="form-control"
              value={editData.name || ''}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Ruta de Navegación *</label>
            <input
              type="text"
              className="form-control"
              value={editData.route || ''}
              onChange={(e) => setEditData({ ...editData, route: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Propósito de la Vista</label>
            <textarea
              className="form-control"
              rows={3}
              value={editData.purpose || ''}
              onChange={(e) => setEditData({ ...editData, purpose: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
