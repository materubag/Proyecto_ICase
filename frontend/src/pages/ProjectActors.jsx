import React, { useState } from 'react';
import { UserPlus, Edit2, Trash2, Users, Check, X, RotateCcw } from 'lucide-react';
import { actorsApi } from '../api/actors.api';
import { historyApi } from '../api/history.api';
import Modal from '../components/common/Modal';

export default function ProjectActors({ project, onProjectUpdated }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [editingActor, setEditingActor] = useState(null);
  const [name, setName] = useState('');
  const [codeId, setCodeId] = useState('');
  const [description, setDescription] = useState('');
  const [reviewStatus, setReviewStatus] = useState('APPROVED');
  const [saving, setSaving] = useState(false);

  const actors = project.actors || [];

  function openNewModal() {
    setEditingActor(null);
    setName('');
    setCodeId(`ACT-0${actors.length + 1}`);
    setDescription('');
    setReviewStatus('APPROVED');
    setModalOpen(true);
  }

  function openEditModal(actor) {
    setEditingActor(actor);
    setName(actor.name);
    setCodeId(actor.codeId || '');
    setDescription(actor.description || '');
    setReviewStatus(actor.reviewStatus || 'APPROVED');
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        codeId: codeId.trim() || null,
        description: description.trim() || null,
        reviewStatus
      };

      if (editingActor) {
        await actorsApi.update(editingActor.id, payload);
      } else {
        await actorsApi.create(project.id, payload);
      }
      setModalOpen(false);
      await onProjectUpdated();
    } catch (err) {
      alert(`Error al guardar actor: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStatus(id, newStatus) {
    try {
      await actorsApi.updateStatus(id, newStatus);
      await onProjectUpdated();
    } catch (err) {
      alert(`Error al actualizar estado: ${err.message}`);
    }
  }

  async function handleDelete(actor) {
    const confirmMessage = `¿Está seguro de eliminar el actor "${actor.name}"?\n\n` +
      `⚠️ IMPACTO EN CASCADA:\n` +
      `- Se removerá de los Requerimientos, Casos de Uso y Pantallas asociadas.\n` +
      `- Se guardará una versión de recuperación en el Historial para poder restaurarlo si fue un error.`;

    if (!window.confirm(confirmMessage)) return;

    try {
      await actorsApi.delete(actor.id);
      await onProjectUpdated();
    } catch (err) {
      alert(`Error al eliminar actor: ${err.message}`);
    }
  }

  async function handleOpenHistory() {
    setHistoryModalOpen(true);
    try {
      setLoadingHistory(true);
      const history = await historyApi.getByProject(project.id);
      setHistoryItems(history.filter(h => h.entityType === 'ACTOR'));
    } catch (err) {
      alert(`Error al cargar historial: ${err.message}`);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleRestoreHistory(historyId) {
    try {
      await historyApi.restore(historyId);
      alert('Actor recuperado exitosamente.');
      const updatedHistory = await historyApi.getByProject(project.id);
      setHistoryItems(updatedHistory.filter(h => h.entityType === 'ACTOR'));
      await onProjectUpdated();
    } catch (err) {
      alert(`Error al restaurar actor: ${err.message}`);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={20} color="var(--primary)" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>
              Catálogo de Actores y Roles del Sistema
            </h2>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Identificación de roles de usuario, sistemas externos y agentes que interactúan con el sistema.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleOpenHistory}>
            <RotateCcw size={14} />
            <span>Papelera de Actores</span>
          </button>
          <button className="btn btn-primary btn-sm" onClick={openNewModal}>
            <UserPlus size={14} />
            <span>Nuevo Actor</span>
          </button>
        </div>
      </div>

      {actors.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            No hay actores identificados para este proyecto.
          </p>
          <button className="btn btn-primary btn-sm" onClick={openNewModal}>
            <UserPlus size={14} />
            <span>Crear Primer Actor</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {actors.map((actor) => (
            <div key={actor.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>👤</span>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
                      {actor.name}
                    </h3>
                  </div>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: actor.reviewStatus === 'APPROVED' ? '#dcfce7' : actor.reviewStatus === 'DISCARDED' ? '#fee2e2' : '#fef3c7',
                      color: actor.reviewStatus === 'APPROVED' ? '#15803d' : actor.reviewStatus === 'DISCARDED' ? '#b91c1c' : '#b45309'
                    }}
                  >
                    {actor.reviewStatus === 'APPROVED' ? 'Aprobado' : actor.reviewStatus === 'DISCARDED' ? 'Rechazado' : 'Pendiente'}
                  </span>
                </div>

                {actor.codeId && (
                  <code style={{ fontSize: '0.75rem', color: 'var(--primary)', marginBottom: '0.5rem', display: 'inline-block' }}>
                    {actor.codeId}
                  </code>
                )}

                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: '0 0 1rem 0' }}>
                  {actor.description || 'Sin descripción detallada.'}
                </p>
              </div>

              {/* Gobernanza */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '3px 8px', color: '#16a34a' }}
                    onClick={() => handleUpdateStatus(actor.id, 'APPROVED')}
                    title="Aprobar actor"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '3px 8px', color: '#dc2626' }}
                    onClick={() => handleUpdateStatus(actor.id, 'DISCARDED')}
                    title="Rechazar actor"
                  >
                    <X size={13} />
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(actor)} title="Editar">
                    <Edit2 size={13} />
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(actor)} title="Eliminar en cascada">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear / Editar Actor */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingActor ? 'Editar Actor' : 'Nuevo Actor'}
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar Actor'}
            </button>
          </>
        )}
      >
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Código ID</label>
              <input
                type="text"
                className="form-control"
                value={codeId}
                onChange={(e) => setCodeId(e.target.value)}
                placeholder="ACT-01"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Nombre del Rol / Actor *</label>
              <input
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Administrador, Cliente..."
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Descripción de Responsabilidades</label>
            <textarea
              className="form-control"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Funciones y permisos asignados a este actor..."
            />
          </div>
        </form>
      </Modal>

      {/* Modal Historial / Papelera Actores */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Papelera de Actores Eliminados"
        footer={(
          <button className="btn btn-secondary" onClick={() => setHistoryModalOpen(false)}>Cerrar</button>
        )}
      >
        {loadingHistory ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando historial...</div>
        ) : historyItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            No hay actores eliminados en el historial.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {historyItems.map((item) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'var(--bg-secondary)'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    👤 {item.snapshot?.name || 'Actor'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Eliminado: {new Date(item.createdAt).toLocaleString()}
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleRestoreHistory(item.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RotateCcw size={13} />
                  <span>Restaurar</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
