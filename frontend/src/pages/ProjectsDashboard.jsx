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

  // Compute global KPI stats
  const totalReqs = projects.reduce((sum, p) => sum + (p._count?.requirements ?? 0), 0);
  const totalActors = projects.reduce((sum, p) => sum + (p._count?.actors ?? 0), 0);
  const inProgressCount = projects.filter(p => p.status === 'IN_PROGRESS').length;
  const completedCount = projects.filter(p => p.status === 'COMPLETED').length;

  const statusLabel = (status) => {
    switch (status) {
      case 'IN_PROGRESS': return { text: 'En Progreso', cls: 'badge-in-progress' };
      case 'COMPLETED':   return { text: 'Completado', cls: 'badge-success' };
      default:            return { text: 'Planificación', cls: 'badge-planning' };
    }
  };

  // Calculate a fake "completeness" score for each project
  function getProjectProgress(proj) {
    const reqs = proj._count?.requirements ?? 0;
    const actors = proj._count?.actors ?? 0;
    const entities = proj._count?.entities ?? 0;
    const screens = proj._count?.screens ?? 0;
    let score = 0;
    if (reqs > 0) score += 30;
    if (actors > 0) score += 20;
    if (entities > 0) score += 25;
    if (screens > 0) score += 25;
    return Math.min(score, 100);
  }

  // Clean description: strip PDF dump markers and truncate
  function cleanDescription(desc) {
    if (!desc) return 'Sin descripción asignada.';
    let clean = desc
      .replace(/\[PÁGINA\s*\d+\]/gi, '')
      .replace(/---\s*\[SALTO_PAGINA\]\s*---/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (clean.length > 160) clean = clean.substring(0, 160).trim() + '…';
    return clean || 'Sin descripción asignada.';
  }

  return (
    <div>
      {/* ── Welcome Hero / KPI Section ── */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-left">
          <h1 className="dashboard-title">
            <span className="ms" style={{ fontSize: '28px', marginRight: '10px' }}>engineering</span>
            Workspace
          </h1>
          <p className="dashboard-subtitle">
            Ingeniería de Software Asistida · ISO 29148
          </p>
        </div>
        <div className="dashboard-hero-actions">
          <div className="search-bar" style={{ width: '260px' }}>
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

      {/* ── KPI Summary Cards ── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-blue">
            <span className="ms">folder_special</span>
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{projects.length}</span>
            <span className="kpi-label">Proyectos</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-violet">
            <span className="ms">checklist</span>
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{totalReqs}</span>
            <span className="kpi-label">Requisitos</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-emerald">
            <span className="ms">groups</span>
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{totalActors}</span>
            <span className="kpi-label">Actores</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-amber">
            <span className="ms">trending_up</span>
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{inProgressCount}</span>
            <span className="kpi-label">En progreso</span>
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

      {/* ── Section heading ── */}
      <div className="dashboard-section-head">
        <h2 className="dashboard-section-title">
          Mis Proyectos
          <span className="dashboard-count-pill">{filtered.length}</span>
        </h2>
        {projects.length > 0 && (
          <div className="dashboard-legend">
            <span className="legend-dot legend-dot-blue" /> En progreso ({inProgressCount})
            <span className="legend-dot legend-dot-green" style={{ marginLeft: 12 }} /> Completados ({completedCount})
          </div>
        )}
      </div>

      {/* ── Content ── */}
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
            <span className="ms ms-xl">rocket_launch</span>
          </div>
          <p className="empty-state-title">
            {search ? 'Sin resultados' : 'Comienza tu primer proyecto'}
          </p>
          <p className="empty-state-desc">
            {search
              ? `No se encontraron proyectos para "${search}".`
              : 'Crea un proyecto de ingeniería de software y deja que la IA te asista en el análisis, diseño y documentación.'}
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
          {filtered.map((proj) => {
            const progress = getProjectProgress(proj);
            const st = statusLabel(proj.status);
            return (
              <div
                key={proj.id}
                className="project-card"
                onClick={() => onOpenProject(proj)}
              >
                {/* Progress bar at top of card */}
                <div className="project-card-progress-bar">
                  <div
                    className="project-card-progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="project-card-body">
                  {/* Header row */}
                  <div className="project-card-header-row">
                    <div className="project-card-icon-wrap">
                      <span className="ms">inventory_2</span>
                    </div>
                    <div className="project-card-header-info">
                      <h3 className="project-card-title">{proj.name}</h3>
                      <span className={`badge ${st.cls}`}>{st.text}</span>
                    </div>
                    <span className="project-card-progress-text">{progress}%</span>
                  </div>

                  {/* Description */}
                  <p className="project-card-desc">
                    {cleanDescription(proj.description)}
                  </p>

                  {/* Stats row */}
                  <div className="project-card-stats-row">
                    <div className="project-card-stat-chip">
                      <span className="ms ms-xs">checklist</span>
                      <strong>{proj._count?.requirements ?? 0}</strong>
                      <span>Req.</span>
                    </div>
                    <div className="project-card-stat-chip">
                      <span className="ms ms-xs">people</span>
                      <strong>{proj._count?.actors ?? 0}</strong>
                      <span>Actores</span>
                    </div>
                    <div className="project-card-stat-chip">
                      <span className="ms ms-xs">schema</span>
                      <strong>{proj._count?.entities ?? 0}</strong>
                      <span>Entid.</span>
                    </div>
                    <div className="project-card-stat-chip">
                      <span className="ms ms-xs">devices</span>
                      <strong>{proj._count?.screens ?? 0}</strong>
                      <span>Pant.</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="project-card-meta" onClick={e => e.stopPropagation()}>
                  <span className="project-card-date">
                    <span className="ms ms-xs">schedule</span>
                    {new Date(proj.updatedAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <div className="project-card-actions">
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={(e) => openEditModal(e, proj)} title="Editar proyecto">
                      <span className="ms ms-sm">edit</span>
                    </button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onOpenProject(proj)} title="Abrir proyecto">
                      <span className="ms ms-sm">arrow_forward</span>
                    </button>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--error)' }} onClick={(e) => handleDeleteProject(e, proj.id)} title="Eliminar proyecto">
                      <span className="ms ms-sm">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* "New Project" ghost card */}
          <div className="project-card project-card-new" onClick={openCreateModal}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
              <div className="kpi-icon-wrap kpi-icon-blue" style={{ width: 48, height: 48 }}>
                <span className="ms" style={{ fontSize: 22 }}>add</span>
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)' }}>Nuevo Proyecto</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--outline)', textAlign: 'center', lineHeight: 1.5, maxWidth: 200 }}>
                Crea un proyecto y comienza el análisis asistido por IA
              </span>
            </div>
          </div>
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
