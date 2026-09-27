import React, { useState, useEffect } from 'react';
import { actorsApi } from '../api/actors.api';
import { diagramsApi } from '../api/diagrams.api';
import Modal from '../components/common/Modal';
import DiagramViewport from '../components/common/DiagramViewport';

export default function ProjectActors({ project, onProjectUpdated }) {
  const actors = project.actors || [];
  const [selected, setSelected] = useState(actors[0] || null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingActor, setEditingActor] = useState(null);
  const [codeId, setCodeId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Diagram states
  const [diagramModalOpen, setDiagramModalOpen] = useState(false);
  const [diagramCode, setDiagramCode] = useState('');
  const [diagramLoading, setDiagramLoading] = useState(false);
  const [diagramGenerating, setDiagramGenerating] = useState(false);
  const [diagramError, setDiagramError] = useState(null);
  const [diagramStatus, setDiagramStatus] = useState('idle'); // 'idle' | 'insufficient' | 'ready' | 'error'
  const [missingDetails, setMissingDetails] = useState([]);
  const [isOutdated, setIsOutdated] = useState(false);

  const filtered = actors.filter(a =>
    !search ||
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.codeId || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.description || '').toLowerCase().includes(search.toLowerCase())
  );

  function openNewModal() {
    setEditingActor(null);
    const n = actors.length + 1;
    setCodeId(`ACT-${n < 10 ? '0' + n : n}`);
    setName(''); setDescription(''); setModalOpen(true);
  }

  function openEditModal(actor, e) {
    e?.stopPropagation();
    setEditingActor(actor);
    setCodeId(actor.codeId || '');
    setName(actor.name); setDescription(actor.description || ''); setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSaving(true);
      const payload = {
        codeId: codeId.trim() || undefined,
        name: name.trim(),
        description: description.trim(),
        reviewStatus: editingActor ? (editingActor.reviewStatus || 'APPROVED') : 'APPROVED'
      };
      if (editingActor) {
        await actorsApi.update(editingActor.id, payload);
      } else {
        await actorsApi.create(project.id, payload);
      }
      setModalOpen(false);
      await onProjectUpdated();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateActorStatus(id, newStatus) {
    try {
      await actorsApi.updateStatus(id, newStatus);
      if (selected?.id === id) {
        setSelected({ ...selected, reviewStatus: newStatus });
      }
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al actualizar estado del actor: ${err.message}`);
    }
  }

  async function handleApproveAllActors() {
    try {
      setSaving(true);
      const pendingActors = actors.filter(a => a.reviewStatus !== 'APPROVED');
      for (const a of pendingActors) {
        await actorsApi.updateStatus(a.id, 'APPROVED');
      }
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al aprobar actores: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, e) {
    e?.stopPropagation();
    if (!window.confirm('¿Eliminar este actor?')) return;
    try {
      await actorsApi.delete(id);
      if (selected?.id === id) setSelected(null);
      await onProjectUpdated();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  }

  async function handleOpenUseCaseDiagramFlow() {
    setDiagramModalOpen(true);
    setDiagramError(null);
    setDiagramLoading(true);
    try {
      // 1. Check availability
      const avail = await diagramsApi.getAvailability(project.id);
      const ucCheck = avail?.diagrams?.USE_CASE;

      // 2. Check if already generated
      const diagData = await diagramsApi.getDiagram(project.id, 'USE_CASE');
      if (diagData?.artifact?.mermaidCode) {
        setDiagramCode(diagData.artifact.mermaidCode);
        setIsOutdated(!!diagData.isOutdated);
        setDiagramStatus('ready');
        setDiagramLoading(false);
        return;
      }

      // If not yet generated, check availability
      if (ucCheck?.status === 'INSUFFICIENT') {
        setMissingDetails(ucCheck.missing || ['Se requieren actores y requisitos funcionales']);
        setDiagramStatus('insufficient');
        setDiagramLoading(false);
        return;
      }

      // Auto-generate if sufficient or partial
      await handleGenerateUseCase(false);
    } catch (err) {
      console.error('Error opening use case flow:', err);
      setDiagramError(err.message || 'Error al verificar disponibilidad');
      setDiagramStatus('error');
    } finally {
      setDiagramLoading(false);
    }
  }

  async function handleGenerateUseCase(force = false) {
    setDiagramGenerating(true);
    setDiagramError(null);
    try {
      const res = await diagramsApi.generateDiagram(project.id, 'USE_CASE', { force });
      if (res.alreadyExists && !force) {
        const diagData = await diagramsApi.getDiagram(project.id, 'USE_CASE');
        setDiagramCode(diagData?.artifact?.mermaidCode || '');
        setIsOutdated(false);
        setDiagramStatus('ready');
      } else {
        setDiagramCode(res.diagram?.mermaidCode || res.mermaidCode || '');
        setIsOutdated(false);
        setDiagramStatus('ready');
      }
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      console.error('Generation error:', err);
      setDiagramError(err.message || 'Error al generar diagrama con Gemini');
      setDiagramStatus('error');
    } finally {
      setDiagramGenerating(false);
    }
  }

  // Count requirements per actor
  const requirements = project.requirements || [];
  const reqCountForActor = (actorCodeId) =>
    requirements.filter(r => (r.actorIds || []).includes(actorCodeId)).length;

  const pendingActorsCount = actors.filter(a => a.reviewStatus !== 'APPROVED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Command bar */}
      <div className="full-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 className="page-title">Actores del Sistema</h2>
          <div className="vdivider" />
          <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
            {actors.length} actor{actors.length !== 1 ? 'es' : ''} registrado{actors.length !== 1 ? 's' : ''}
          </span>
          {pendingActorsCount > 0 && (
            <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
              {pendingActorsCount} pendiente{pendingActorsCount !== 1 ? 's' : ''} de aprobación
            </span>
          )}
        </div>
        <div className="page-actions">
          <div className="search-bar" style={{ width: '220px' }}>
            <span className="ms">search</span>
            <input type="text" placeholder="Buscar actores..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {pendingActorsCount > 0 && (
            <button
              className="btn btn-outline btn-sm"
              onClick={handleApproveAllActors}
              style={{ color: '#15803d', borderColor: '#86efac', background: '#f0fdf4' }}
              title="Aprobar todos los actores para habilitar la generación de casos de uso"
            >
              <span className="ms ms-xs">done_all</span>
              <span>Aprobar todos ({pendingActorsCount})</span>
            </button>
          )}

          <button
            className="btn btn-outline btn-sm"
            onClick={handleOpenUseCaseDiagramFlow}
            title="Generar diagrama de casos de uso a partir de actores y requisitos aprobados"
          >
            <span className="ms ms-sm">account_tree</span>
            <span>Generar casos de uso</span>
          </button>
          <button className="btn btn-primary btn-sm" onClick={openNewModal}>
            <span className="ms ms-sm">person_add</span>
            <span>Registrar actor</span>
          </button>
        </div>
      </div>

      {/* Split view */}
      <div className="split-view">
        {/* LEFT: table */}
        <section className="split-left">
          <div className="table-header-bar" style={{ gridTemplateColumns: '80px 1fr 90px 80px 80px' }}>
            <div className="table-col-label">ID</div>
            <div className="table-col-label">Actor</div>
            <div className="table-col-label">Estado</div>
            <div className="table-col-label">Requisitos</div>
            <div className="table-col-label">Acciones</div>
          </div>

          <div className="table-body">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><span className="ms ms-xl">people</span></div>
                <p className="empty-state-title">{search ? 'Sin resultados' : 'Sin actores'}</p>
                <p className="empty-state-desc">
                  {search ? 'No se encontraron actores.' : 'Usa el análisis IA en Resumen o registra actores manualmente.'}
                </p>
                {!search && (
                  <button className="btn btn-primary btn-sm" onClick={openNewModal}>
                    <span className="ms ms-sm">person_add</span><span>Registrar actor</span>
                  </button>
                )}
              </div>
            ) : filtered.map(actor => (
              <div
                key={actor.id}
                className={`table-row ${selected?.id === actor.id ? 'selected' : ''}`}
                style={{ gridTemplateColumns: '80px 1fr 90px 80px 80px' }}
                onClick={() => setSelected(actor)}
              >
                <div>
                  <span className="code-tag" style={{ color: selected?.id === actor.id ? 'var(--primary)' : 'var(--secondary)' }}>
                    {actor.codeId || 'ACT'}
                  </span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontSize: '0.875rem', fontWeight: selected?.id === actor.id ? 500 : 400,
                    color: 'var(--on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {actor.name}
                  </p>
                  {actor.description && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--secondary)', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {actor.description}
                    </p>
                  )}
                </div>
                <div>
                  {actor.reviewStatus === 'APPROVED' ? (
                    <span className="badge badge-success" style={{ fontSize: '0.6875rem' }}>Aprobado</span>
                  ) : (
                    <span className="badge badge-warning" style={{ fontSize: '0.6875rem' }}>Pendiente</span>
                  )}
                </div>
                <div>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)', fontWeight: 600 }}>
                    {reqCountForActor(actor.codeId || actor.id)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={(e) => openEditModal(actor, e)} title="Editar">
                    <span className="ms ms-xs">edit</span>
                  </button>
                  <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--error)' }} onClick={(e) => handleDelete(actor.id, e)} title="Eliminar">
                    <span className="ms ms-xs">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <footer className="table-footer">
            <span className="table-footer-text">Mostrando {filtered.length} de {actors.length} actores</span>
          </footer>
        </section>

        {/* RIGHT: detail inspector */}
        <aside className="split-right">
          {selected ? (
            <>
              <div className="detail-panel-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="code-tag code-tag-primary">{selected.codeId || 'ACT'}</span>
                    <span className="badge badge-neutral">Actor</span>
                    {selected.reviewStatus === 'APPROVED' ? (
                      <span className="badge badge-success">Aprobado</span>
                    ) : (
                      <span className="badge badge-warning">Pendiente</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {selected.reviewStatus === 'APPROVED' ? (
                      <button className="btn btn-outline btn-sm" onClick={() => handleUpdateActorStatus(selected.id, 'PENDING')} title="Marcar como pendiente">
                        <span className="ms ms-xs">undo</span><span>Desaprobar</span>
                      </button>
                    ) : (
                      <button className="btn btn-primary btn-sm" onClick={() => handleUpdateActorStatus(selected.id, 'APPROVED')} title="Aprobar actor para diagramas">
                        <span className="ms ms-xs">check_circle</span><span>Aprobar</span>
                      </button>
                    )}
                    <button className="btn btn-outline btn-sm" onClick={(e) => openEditModal(selected, e)}>
                      <span className="ms ms-sm">edit</span><span>Editar</span>
                    </button>
                    <button className="btn btn-outline btn-sm" style={{ color: 'var(--error)' }} onClick={(e) => handleDelete(selected.id, e)}>
                      <span className="ms ms-sm">delete</span>
                    </button>
                  </div>
                </div>
                <div>
                  <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--on-surface)' }}>
                    {selected.name}
                  </h2>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--secondary)', marginTop: '3px' }}>
                    {reqCountForActor(selected.codeId || selected.id)} requisito{reqCountForActor(selected.codeId || selected.id) !== 1 ? 's' : ''} asociado{reqCountForActor(selected.codeId || selected.id) !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div className="detail-panel-body">
                {/* Profile */}
                <div className="detail-section">
                  <span className="detail-section-label">Perfil del Actor</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: 'var(--radius-lg)', background: 'var(--surface-container-low)', border: '1px solid var(--border-default)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-container-high)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="ms">person</span>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--on-surface)' }}>{selected.name}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
                        {selected.description || 'Sin descripción de rol asignada.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selected.description && (
                  <div className="detail-section">
                    <span className="detail-section-label">Descripción del Rol</span>
                    <p style={{ fontSize: '0.875rem', color: 'var(--on-surface)', lineHeight: 1.6 }}>
                      {selected.description}
                    </p>
                  </div>
                )}

                {/* Associated requirements */}
                {(() => {
                  const actorReqs = requirements.filter(r => (r.actorIds || []).includes(selected.codeId || selected.id));
                  if (actorReqs.length === 0) return null;
                  return (
                    <div className="detail-section">
                      <span className="detail-section-label">Requisitos Asociados ({actorReqs.length})</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {actorReqs.slice(0, 5).map(req => (
                          <div key={req.id} className="trace-link">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              <span className="ms ms-sm" style={{ color: 'var(--secondary)' }}>checklist</span>
                              <div style={{ minWidth: 0 }}>
                                <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--on-surface)', display: 'block' }}>
                                  {req.code} — {req.name}
                                </span>
                                <span style={{ fontSize: '0.6875rem', color: 'var(--secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                                  {req.type === 'FUNCTIONAL' ? 'Funcional' : 'No Funcional'}
                                </span>
                              </div>
                            </div>
                            <span className="ms ms-xs" style={{ color: 'var(--outline)', flexShrink: 0 }}>arrow_forward</span>
                          </div>
                        ))}
                        {actorReqs.length > 5 && (
                          <p style={{ fontSize: '0.75rem', color: 'var(--secondary)', textAlign: 'center', paddingTop: '4px' }}>
                            +{actorReqs.length - 5} más
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ height: '100%', justifyContent: 'center' }}>
              <div className="empty-state-icon"><span className="ms ms-lg">people</span></div>
              <p className="empty-state-title">Selecciona un actor</p>
              <p className="empty-state-desc">Haz clic en un actor para ver su perfil y requisitos asociados.</p>
            </div>
          )}
        </aside>
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingActor ? 'Editar Actor' : 'Registrar Nuevo Actor'}
        footer={(
          <>
            <button className="btn btn-outline btn-md" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
            <button className="btn btn-primary btn-md" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Guardando...' : 'Guardar Actor'}
            </button>
          </>
        )}
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Código ID</label>
              <input type="text" className="form-control" placeholder="ACT-01" value={codeId} onChange={e => setCodeId(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre del Actor *</label>
              <input type="text" className="form-control" placeholder="Ej: Bibliotecario, Médico" value={name} onChange={e => setName(e.target.value)} required autoFocus />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Descripción del Rol</label>
            <textarea className="form-control" rows={3} placeholder="Describa el rol y las responsabilidades del actor..." value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </form>
      </Modal>

      {/* Modal Diagrama de Casos de Uso */}
      <Modal
        isOpen={diagramModalOpen}
        onClose={() => setDiagramModalOpen(false)}
        title="Diagrama de Casos de Uso (UML)"
        maxWidth="1100px"
        footer={(
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button className="btn btn-outline btn-md" onClick={() => setDiagramModalOpen(false)}>
              Cerrar
            </button>
          </div>
        )}
      >
        {diagramLoading || diagramGenerating ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <span className="ms ms-xl spin" style={{ color: 'var(--primary)', fontSize: '40px' }}>autorenew</span>
            <h4 style={{ margin: '16px 0 8px', fontSize: '1rem', fontWeight: 600 }}>
              {diagramGenerating ? 'Generando diagrama de casos de uso con Gemini...' : 'Cargando información del diagrama...'}
            </h4>
            <p style={{ color: 'var(--secondary)', fontSize: '0.8125rem' }}>
              Preparando contexto estructurado de actores y requisitos funcionales...
            </p>
          </div>
        ) : diagramStatus === 'insufficient' ? (
          <div style={{ padding: '24px 16px' }}>
            <div className="alert alert-warning" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                <span className="ms">warning</span>
                <span>No se puede generar el diagrama de casos de uso</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>Falta información esencial en el proyecto:</p>
              <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: '0.8125rem' }}>
                {missingDetails.map((m, idx) => (
                  <li key={idx} style={{ marginTop: '4px' }}>{m}</li>
                ))}
              </ul>
              <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                Agrega o aprueba actores y requisitos antes de solicitar la generación.
              </p>
            </div>
          </div>
        ) : diagramStatus === 'error' ? (
          <div style={{ padding: '24px 16px' }}>
            <div className="alert alert-error" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                <span className="ms">error</span>
                <span>Error al generar el diagrama</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>{diagramError}</p>
              <div style={{ marginTop: '12px' }}>
                <button className="btn btn-primary btn-sm" onClick={() => handleGenerateUseCase(true)}>
                  <span className="ms ms-xs">refresh</span>
                  <span>Reintentar generación</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ minHeight: '520px' }}>
            <DiagramViewport
              code={diagramCode}
              type="flowchart"
              title="Casos de Uso — Vista del Sistema"
              minHeight="500px"
              isOutdated={isOutdated}
              onRegenerate={() => handleGenerateUseCase(true)}
              canGenerate={true}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
