import React, { useState, useEffect } from 'react';
import { Plus, FolderOpen, Trash2, Clock, AlertCircle, Edit2 } from 'lucide-react';
import { projectsApi } from '../api/projects.api';
import Modal from '../components/common/Modal';

export default function ProjectsDashboard({ onOpenProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      setLoading(true);
      setError(null);
      const data = await projectsApi.getAll();
      setProjects(data || []);
    } catch (err) {
      setError(err.message || 'Error al cargar los proyectos');
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingProject(null);
    setFormName('');
    setFormDesc('');
    setIsModalOpen(true);
  }

  function openEditModal(e, proj) {
    e.stopPropagation();
    setEditingProject(proj);
    setFormName(proj.name || '');
    setFormDesc(proj.description || '');
    setIsModalOpen(true);
  }

  async function handleSaveProject(e) {
    e.preventDefault();
    if (!formName.trim()) return;

    try {
      setSaving(true);
      if (editingProject) {
        await projectsApi.update(editingProject.id, {
          name: formName.trim(),
          description: formDesc.trim(),
          systemDescription: formDesc.trim()
        });
        setIsModalOpen(false);
        setEditingProject(null);
        await loadProjects();
      } else {
        const newProj = await projectsApi.create({
          name: formName.trim(),
          description: formDesc.trim(),
          systemDescription: formDesc.trim()
        });
        setIsModalOpen(false);
        setFormName('');
        setFormDesc('');
        await loadProjects();
        onOpenProject(newProj);
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProject(e, id) {
    e.stopPropagation();
    if (!window.confirm('¿Está seguro de eliminar este proyecto y todos sus requisitos asociados?')) {
      return;
    }
    try {
      await projectsApi.delete(id);
      await loadProjects();
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
    }
  }

  const formatStatus = (status) => {
    switch (status) {
      case 'IN_PROGRESS': return <span className="badge badge-in-progress">En Progreso</span>;
      case 'COMPLETED': return <span className="badge badge-completed">Completado</span>;
      default: return <span className="badge badge-planning">Planificación</span>;
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Proyectos de Software</h1>
          <p className="page-description">
            Gestión y diseño asistido de sistemas mediante ingeniería de software automatizada.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={16} />
          <span>Nuevo Proyecto</span>
        </button>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Cargando proyectos...
        </div>
      ) : projects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            No hay proyectos registrados en el sistema.
          </p>
          <button className="btn btn-primary" onClick={openCreateModal}>
            Crear el primer proyecto
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="project-card"
              onClick={() => onOpenProject(proj)}
              style={{ cursor: 'pointer' }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 className="project-card-title">{proj.name}</h3>
                  {formatStatus(proj.status)}
                </div>
                <p className="project-card-desc">
                  {proj.description || 'Sin descripción asignada.'}
                </p>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  <strong>{proj._count?.requirements ?? 0}</strong> requisitos • <strong>{proj._count?.actors ?? 0}</strong> actores
                </div>
              </div>

              <div>
                <div className="project-card-meta">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} />
                    {new Date(proj.updatedAt).toLocaleDateString()}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => openEditModal(e, proj)}
                      title="Editar Proyecto"
                    >
                      <Edit2 size={13} />
                      <span>Editar</span>
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onOpenProject(proj)}
                      title="Abrir Proyecto"
                    >
                      <FolderOpen size={14} />
                      <span>Abrir</span>
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => handleDeleteProject(e, proj.id)}
                      style={{ color: 'var(--danger)' }}
                      title="Eliminar Proyecto"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear / Editar Proyecto */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProject ? "Editar Proyecto" : "Crear Nuevo Proyecto"}
        footer={(
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveProject}
              disabled={saving || !formName.trim()}
            >
              {saving ? 'Guardando...' : editingProject ? 'Guardar Cambios' : 'Crear Proyecto'}
            </button>
          </>
        )}
      >
        <form onSubmit={handleSaveProject}>
          <div className="form-group">
            <label className="form-label">Nombre del Proyecto *</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ej: Sistema de Gestión de Biblioteca"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción General</label>
            <textarea
              className="form-control"
              placeholder="Breve resumen del objetivo y alcance del sistema..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              style={{ minHeight: '110px' }}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
