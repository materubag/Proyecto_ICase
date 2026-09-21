import React, { useState } from 'react';
import { UserPlus, Edit2, Trash2, Users } from 'lucide-react';
import { actorsApi } from '../api/actors.api';
import Modal from '../components/common/Modal';

export default function ProjectActors({ project, onProjectUpdated }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingActor, setEditingActor] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const actors = project.actors || [];

  function openNewModal() {
    setEditingActor(null);
    setName('');
    setDescription('');
    setModalOpen(true);
  }

  function openEditModal(actor) {
    setEditingActor(actor);
    setName(actor.name);
    setDescription(actor.description || '');
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);
      const payload = { name: name.trim(), description: description.trim() };
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

  async function handleDelete(id) {
    if (!window.confirm('¿Está seguro de eliminar este actor?')) return;
    try {
      await actorsApi.delete(id);
      await onProjectUpdated();
    } catch (err) {
      alert(`Error al eliminar actor: ${err.message}`);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Actores del Sistema</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Roles y agentes que interactúan con los procesos del sistema.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNewModal}>
          <UserPlus size={14} />
          <span>Registrar Actor</span>
        </button>
      </div>

      {actors.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Users size={32} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem auto' }} />
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            No hay actores registrados para este proyecto.
          </p>
          <button className="btn btn-primary btn-sm" onClick={openNewModal}>
            <UserPlus size={14} />
            <span>Registrar Primer Actor</span>
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '90px' }}>ID</th>
                <th style={{ width: '220px' }}>Nombre del Actor</th>
                <th>Descripción y Responsabilidades</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {actors.map((actor) => (
                <tr key={actor.id}>
                  <td>
                    <code style={{ color: 'var(--primary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {actor.codeId || 'ACT'}
                    </code>
                  </td>
                  <td style={{ fontWeight: 600 }}>{actor.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{actor.description || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px' }}
                        onClick={() => openEditModal(actor)}
                        title="Editar"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px', color: 'var(--danger)' }}
                        onClick={() => handleDelete(actor.id)}
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Actor */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingActor ? 'Editar Actor' : 'Registrar Nuevo Actor'}
        footer={(
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving ? 'Guardando...' : 'Guardar Actor'}
            </button>
          </>
        )}
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Nombre del Actor *</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ej: Bibliotecario, Médico, Administrador"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción del Rol</label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="Describa el rol y las responsabilidades del actor en el sistema..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
