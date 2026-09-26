import React, { useState } from 'react';
import { requirementsApi } from '../api/requirements.api';
import Modal from '../components/common/Modal';

const PRIORITY_DOT = {
  HIGH:   'high',
  MEDIUM: 'medium',
  LOW:    'low',
};
const PRIORITY_LABEL = { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };
const STATUS_LABELS = { PENDING: 'Pendiente', APPROVED: 'Aprobado', IN_REVIEW: 'En revisión', REJECTED: 'Rechazado' };
const TYPE_LABELS = { FUNCTIONAL: 'Funcional', NON_FUNCTIONAL: 'No Funcional' };

export default function ProjectRequirements({ project, onProjectUpdated }) {
  const requirements = project.requirements || [];
  const actorsMap = new Map((project.actors || []).map(a => [a.codeId || a.id, a.name]));

  const [selected, setSelected] = useState(requirements[0] || null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [editingReq, setEditingReq] = useState(null);

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('FUNCTIONAL');
  const [priority, setPriority] = useState('MEDIUM');
  const [status, setStatus] = useState('PENDING');
  const [actorIdsStr, setActorIdsStr] = useState('');
  const [dependenciesStr, setDependenciesStr] = useState('');
  const [savingReq, setSavingReq] = useState(false);

  const counts = {
    all: requirements.length,
    FUNCTIONAL: requirements.filter(r => r.type === 'FUNCTIONAL').length,
    NON_FUNCTIONAL: requirements.filter(r => r.type === 'NON_FUNCTIONAL').length,
  };

  const filtered = requirements.filter(r => {
    const matchType = filterType === 'all' || r.type === filterType;
    const matchSearch = !search ||
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  function openNewModal() {
    setEditingReq(null);
    const n = requirements.length + 1;
    setCode(`RF-${n < 10 ? '0' + n : n}`);
    setName(''); setDescription('');
    setType('FUNCTIONAL'); setPriority('MEDIUM'); setStatus('PENDING');
    setActorIdsStr(''); setDependenciesStr('');
    setReqModalOpen(true);
  }

  function openEditModal(req, e) {
    e?.stopPropagation();
    setEditingReq(req);
    setCode(req.code); setName(req.name); setDescription(req.description);
    setType(req.type); setPriority(req.priority); setStatus(req.status);
    setActorIdsStr((req.actorIds || []).join(', '));
    setDependenciesStr((req.dependencies || []).join(', '));
    setReqModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!code || !name || !description) return;
    try {
      setSavingReq(true);
      const payload = {
        code, name, description, type, priority, status,
        actorIds: actorIdsStr.split(',').map(s => s.trim()).filter(Boolean),
        dependencies: dependenciesStr.split(',').map(s => s.trim()).filter(Boolean),
      };
      if (editingReq) {
        await requirementsApi.update(editingReq.id, payload);
      } else {
        await requirementsApi.create(project.id, payload);
      }
      setReqModalOpen(false);
      await onProjectUpdated();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSavingReq(false);
    }
  }

  async function handleDelete(id, e) {
    e?.stopPropagation();
    if (!window.confirm('¿Eliminar este requisito?')) return;
    try {
      await requirementsApi.delete(id);
      if (selected?.id === id) setSelected(null);
      await onProjectUpdated();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Command bar */}
      <div className="full-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <h2 className="page-title">Requisitos</h2>
          <div className="vdivider" />
          {/* Segmented filter */}
          <div className="seg-control">
            <button className={`seg-btn ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>
              <span>Todos</span>
              <span className="seg-btn-count">{counts.all}</span>
            </button>
            <button className={`seg-btn ${filterType === 'FUNCTIONAL' ? 'active' : ''}`} onClick={() => setFilterType('FUNCTIONAL')}>
              <span>Funcionales</span>
              <span className="seg-btn-count" style={{ color: 'var(--outline)' }}>{counts.FUNCTIONAL}</span>
            </button>
            <button className={`seg-btn ${filterType === 'NON_FUNCTIONAL' ? 'active' : ''}`} onClick={() => setFilterType('NON_FUNCTIONAL')}>
              <span>No Funcionales</span>
              <span className="seg-btn-count" style={{ color: 'var(--outline)' }}>{counts.NON_FUNCTIONAL}</span>
            </button>
          </div>
        </div>
        <div className="page-actions">
          <div className="search-bar" style={{ width: '260px' }}>
            <span className="ms">search</span>
            <input type="text" placeholder="Buscar por código o descripción..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="vdivider" />
          <button className="btn btn-outline btn-sm">
            <span className="ms ms-sm">tune</span>
            <span>Filtros</span>
          </button>
          <button className="btn btn-primary btn-sm" onClick={openNewModal}>
            <span className="ms ms-sm">add</span>
            <span>Nuevo requisito</span>
          </button>
        </div>
      </div>

      {/* Split view */}
      <div className="split-view">
        {/* LEFT: table */}
        <section className="split-left">
          {/* Table column headers */}
          <div
            className="table-header-bar"
            style={{ gridTemplateColumns: '90px 1fr 80px 110px 100px' }}
          >
            <div className="table-col-label">
              Código <span className="ms ms-xs">expand_more</span>
            </div>
            <div className="table-col-label">Título del Requisito</div>
            <div className="table-col-label">Prioridad</div>
            <div className="table-col-label">Estado</div>
            <div className="table-col-label">Tipo</div>
          </div>

          {/* Table body */}
          <div className="table-body">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <span className="ms ms-xl">checklist</span>
                </div>
                <p className="empty-state-title">Sin requisitos</p>
                <p className="empty-state-desc">
                  {search ? 'No se encontraron resultados.' : 'Usa el análisis IA en Resumen o crea uno manualmente.'}
                </p>
                {!search && (
                  <button className="btn btn-primary btn-sm" onClick={openNewModal}>
                    <span className="ms ms-sm">add</span>
                    <span>Crear requisito</span>
                  </button>
                )}
              </div>
            ) : filtered.map(req => (
              <div
                key={req.id}
                className={`table-row ${selected?.id === req.id ? 'selected' : ''}`}
                style={{ gridTemplateColumns: '90px 1fr 80px 110px 100px' }}
                onClick={() => setSelected(req)}
              >
                <div>
                  <span
                    className="code-tag"
                    style={{ color: selected?.id === req.id ? 'var(--primary)' : 'var(--secondary)' }}
                  >
                    {req.code}
                  </span>
                </div>
                <div style={{ paddingRight: '12px', minWidth: 0 }}>
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--on-surface)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight: selected?.id === req.id ? 500 : 400,
                  }}>
                    {req.name}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div className={`priority-dot ${PRIORITY_DOT[req.priority] || 'medium'}`} />
                  <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)', fontWeight: selected?.id === req.id ? 500 : 400 }}>
                    {PRIORITY_LABEL[req.priority]}
                  </span>
                </div>
                <div>
                  <span className={`badge ${
                    req.status === 'APPROVED' ? 'badge-success' :
                    req.status === 'IN_REVIEW' ? 'badge-warning' :
                    req.status === 'REJECTED' ? 'badge-error' : 'badge-neutral'
                  }`}>
                    {STATUS_LABELS[req.status] || req.status}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
                    {req.type === 'FUNCTIONAL' ? 'Funcional' : 'No Func.'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Table footer */}
          <footer className="table-footer">
            <span className="table-footer-text">
              Mostrando {filtered.length} de {requirements.length} requisitos
            </span>
            <div className="table-pagination">
              <span style={{ fontSize: '0.6875rem', color: 'var(--outline)', marginRight: '4px' }}>Página 1</span>
              <button className="pagination-btn" disabled><span className="ms ms-xs">chevron_left</span></button>
              <button className="pagination-btn" disabled><span className="ms ms-xs">chevron_right</span></button>
            </div>
          </footer>
        </section>

        {/* RIGHT: detail inspector */}
        <aside className="split-right">
          {selected ? (
            <>
              {/* Detail header */}
              <div className="detail-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="code-tag code-tag-primary">{selected.code}</span>
                    <span className={`badge ${
                      selected.status === 'APPROVED' ? 'badge-success' :
                      selected.status === 'IN_REVIEW' ? 'badge-warning' : 'badge-neutral'
                    }`}>
                      {STATUS_LABELS[selected.status] || selected.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="btn btn-outline btn-sm" onClick={(e) => openEditModal(selected, e)}>
                      <span className="ms ms-sm">edit</span>
                      <span>Editar</span>
                    </button>
                    <button className="btn btn-outline btn-sm" style={{ color: 'var(--error)' }} onClick={(e) => handleDelete(selected.id, e)}>
                      <span className="ms ms-sm">delete</span>
                    </button>
                  </div>
                </div>
                <div>
                  <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--on-surface)', lineHeight: 1.4 }}>
                    {selected.name}
                  </h2>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--secondary)', marginTop: '3px' }}>
                    {TYPE_LABELS[selected.type]} · Prioridad {PRIORITY_LABEL[selected.priority]}
                  </p>
                </div>
              </div>

              {/* Detail body */}
              <div className="detail-panel-body">
                {/* Description */}
                <div className="detail-section">
                  <span className="detail-section-label">Descripción del Requisito</span>
                  <p style={{ fontSize: '0.875rem', color: 'var(--on-surface)', lineHeight: 1.6 }}>
                    {selected.description}
                  </p>
                </div>

                {/* Actors */}
                {selected.actorIds && selected.actorIds.length > 0 && (
                  <div className="detail-section">
                    <span className="detail-section-label">Actores Involucrados</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {selected.actorIds.map((actId, i) => (
                        <div key={i} className="actor-card">
                          <span className="ms ms-sm" style={{ color: 'var(--secondary)' }}>person</span>
                          <div>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--on-surface)', display: 'block' }}>
                              {actorsMap.get(actId) || actId}
                            </span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--outline)' }}>Actor del sistema</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dependencies */}
                {selected.dependencies && selected.dependencies.length > 0 && (
                  <div className="detail-section">
                    <span className="detail-section-label">Dependencias</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {selected.dependencies.map((dep, i) => (
                        <span key={i} className="tag">{dep}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata grid */}
                <div className="detail-section">
                  <span className="detail-section-label">Metadatos</span>
                  <div className="grid-2" style={{ gap: '12px' }}>
                    <div className="info-card">
                      <span style={{ fontSize: '0.6875rem', color: 'var(--outline)' }}>Tipo</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                        {TYPE_LABELS[selected.type]}
                      </span>
                    </div>
                    <div className="info-card">
                      <span style={{ fontSize: '0.6875rem', color: 'var(--outline)' }}>Prioridad</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div className={`priority-dot ${PRIORITY_DOT[selected.priority]}`} />
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                          {PRIORITY_LABEL[selected.priority]}
                        </span>
                      </div>
                    </div>
                    <div className="info-card">
                      <span style={{ fontSize: '0.6875rem', color: 'var(--outline)' }}>Estado</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                        {STATUS_LABELS[selected.status] || selected.status}
                      </span>
                    </div>
                    <div className="info-card">
                      <span style={{ fontSize: '0.6875rem', color: 'var(--outline)' }}>Actores</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                        {selected.actorIds?.length ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ height: '100%', justifyContent: 'center' }}>
              <div className="empty-state-icon">
                <span className="ms ms-lg">checklist</span>
              </div>
              <p className="empty-state-title">Selecciona un requisito</p>
              <p className="empty-state-desc">Haz clic en un requisito de la tabla para ver sus detalles aquí.</p>
            </div>
          )}
        </aside>
      </div>

      {/* Modal Requisito */}
      <Modal
        isOpen={reqModalOpen}
        onClose={() => setReqModalOpen(false)}
        title={editingReq ? 'Editar Requisito' : 'Nuevo Requisito'}
        footer={(
          <>
            <button className="btn btn-outline btn-md" onClick={() => setReqModalOpen(false)} disabled={savingReq}>Cancelar</button>
            <button className="btn btn-primary btn-md" onClick={handleSave} disabled={savingReq || !code || !name || !description}>
              {savingReq ? 'Guardando...' : 'Guardar Requisito'}
            </button>
          </>
        )}
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Código *</label>
              <input type="text" className="form-control" placeholder="RF-01" value={code} onChange={e => setCode(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-control" value={type} onChange={e => setType(e.target.value)}>
                <option value="FUNCTIONAL">Funcional</option>
                <option value="NON_FUNCTIONAL">No Funcional</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Nombre del Requisito *</label>
            <input type="text" className="form-control" placeholder="Ej: Catálogo de Libros" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción Detallada *</label>
            <textarea className="form-control" rows={3} placeholder="Descripción del comportamiento esperado..." value={description} onChange={e => setDescription(e.target.value)} required />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Prioridad</label>
              <select className="form-control" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="HIGH">Alta</option>
                <option value="MEDIUM">Media</option>
                <option value="LOW">Baja</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select className="form-control" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="PENDING">Pendiente</option>
                <option value="APPROVED">Aprobado</option>
                <option value="IN_REVIEW">En revisión</option>
                <option value="REJECTED">Rechazado</option>
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Actores (separados por coma)</label>
              <input type="text" className="form-control" placeholder="ACT-01, ACT-02" value={actorIdsStr} onChange={e => setActorIdsStr(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Dependencias (códigos)</label>
              <input type="text" className="form-control" placeholder="RF-01, RF-02" value={dependenciesStr} onChange={e => setDependenciesStr(e.target.value)} />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
