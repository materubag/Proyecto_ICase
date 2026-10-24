import React, { useState, useEffect } from 'react';
import { projectsApi } from '../api/projects.api';
import Modal from '../components/common/Modal';

export default function ProjectsDashboard({ onOpenProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadProjects(); }, []);

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
    setFormName(''); setFormDesc('');
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
          name: formName.trim(), description: formDesc.trim(), systemDescription: formDesc.trim()
        });
        setIsModalOpen(false);
        setEditingProject(null);
        await loadProjects();
      } else {
        const newProj = await projectsApi.create({
          name: formName.trim(), description: formDesc.trim(), systemDescription: formDesc.trim()
        });
        setIsModalOpen(false);
        setFormName(''); setFormDesc('');
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
    if (!window.confirm('¿Está seguro de eliminar este proyecto y todos sus datos asociados?')) return;
    try {
      // Optimistic instant removal from UI
      setProjects(prev => prev.filter(p => p.id !== id));
      await projectsApi.delete(id);
      await loadProjects();
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
      await loadProjects();
    }
  }

  const filtered = projects.filter(p =>
    p.status !== 'ARCHIVED' && (
      !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(search.toLowerCase())
    )
  );

  const statusBadge = (status) => {
    switch (status) {
      case 'IN_PROGRESS': return <span className="badge badge-in-progress">En Progreso</span>;
      case 'COMPLETED':   return <span className="badge badge-success">Completado</span>;
      default:            return <span className="badge badge-planning">Planificación</span>;
    }
  };

  return (
    <div>
      {/* Dashboard header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--on-surface)', marginBottom: '4px' }}>
              Proyectos
            </h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              {projects.length} proyecto{projects.length !== 1 ? 's' : ''} · Ingeniería de Software Asistida
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div className="search-bar" style={{ width: '240px' }}>
              <span className="ms">search</span>
              <input
                type="text"
                placeholder="Buscar proyectos..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-primary btn-md" onClick={openCreateModal}>
              <span className="ms ms-sm">add</span>
              <span>Nuevo proyecto</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
          <span className="ms ms-sm">error_outline</span>
          <span>{error}</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="loading-state">
          <div className="loading-dots">
            <div className="loading-dot" />
            <div className="loading-dot" />
            <div className="loading-dot" />
          </div>
          <span>Cargando proyectos...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ border: '1px dashed var(--outline-variant)', borderRadius: 'var(--radius-lg)' }}>
          <div className="empty-state-icon">
            <span className="ms ms-xl">folder_open</span>
          </div>
          <p className="empty-state-title">
            {search ? 'Sin resultados' : 'Sin proyectos registrados'}
          </p>
          <p className="empty-state-desc">
            {search
              ? `No se encontraron proyectos para "${search}".`
              : 'Crea tu primer proyecto de ingeniería de software para comenzar.'}
          </p>
          {!search && (
            <button className="btn btn-primary btn-md" onClick={openCreateModal}>
              <span className="ms ms-sm">add</span>
              <span>Crear primer proyecto</span>
            </button>
          )}
        </div>
      ) : (
        <div className="projects-grid">
          {filtered.map((proj) => (
            <div
              key={proj.id}
              className="project-card"
              onClick={() => onOpenProject(proj)}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h3 className="project-card-title">{proj.name}</h3>
                  {statusBadge(proj.status)}
                </div>
                <p className="project-card-desc">
                  {proj.description || 'Sin descripción asignada.'}
                </p>
                <div className="project-card-stats">
                  <span className="project-card-stat">
                    <span className="ms ms-xs" style={{ color: 'var(--outline)' }}>checklist</span>
                    <strong>{proj._count?.requirements ?? 0}</strong> requisitos
                  </span>
                  <span className="project-card-stat">
                    <span className="ms ms-xs" style={{ color: 'var(--outline)' }}>people</span>
                    <strong>{proj._count?.actors ?? 0}</strong> actores
                  </span>
                </div>
              </div>

              <div className="project-card-meta" onClick={e => e.stopPropagation()}>
                <span className="project-card-date">
                  <span className="ms ms-xs">schedule</span>
                  {new Date(proj.updatedAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <div className="project-card-actions">
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={(e) => openEditModal(e, proj)}
                    title="Editar proyecto"
                  >
                    <span className="ms ms-sm">edit</span>
                  </button>
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => onOpenProject(proj)}
                    title="Abrir proyecto"
                  >
                    <span className="ms ms-sm">arrow_forward</span>
                  </button>
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    style={{ color: 'var(--error)' }}
                    onClick={(e) => handleDeleteProject(e, proj.id)}
                    title="Eliminar proyecto"
                  >
                    <span className="ms ms-sm">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear/Editar */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'}
        footer={(
          <>
            <button className="btn btn-outline btn-md" onClick={() => setIsModalOpen(false)} disabled={saving}>
              Cancelar
            </button>
            <button className="btn btn-primary btn-md" onClick={handleSaveProject} disabled={saving || !formName.trim()}>
              {saving ? 'Guardando...' : editingProject ? 'Guardar Cambios' : 'Crear Proyecto'}
            </button>
          </>
        )}
      >
        <form onSubmit={handleSaveProject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
              style={{ minHeight: '100px' }}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
