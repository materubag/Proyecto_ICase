import React, { useState, useEffect } from 'react';
import { useCasesApi } from '../api/useCases.api';
import Modal from '../components/common/Modal';
import DiagramViewport from '../components/common/DiagramViewport';
import RequirementMultiSelect from '../components/common/RequirementMultiSelect';

export default function ProjectUseCases({ project, onProjectUpdated }) {
  const [useCases, setUseCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  
  // Edit/Create modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUC, setEditingUC] = useState(null);
  const [codeId, setCodeId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [primaryActorId, setPrimaryActorId] = useState('');
  const [requirementIds, setRequirementIds] = useState([]);
  const [reviewStatus, setReviewStatus] = useState('PENDING');
  const [saving, setSaving] = useState(false);
  const [preGenModalOpen, setPreGenModalOpen] = useState(false);

  // Diagram modal
  const [diagramModalOpen, setDiagramModalOpen] = useState(false);
  const [diagramCode, setDiagramCode] = useState('');
  const [diagramLoading, setDiagramLoading] = useState(false);
  const [diagramError, setDiagramError] = useState(null);

  const actors = project.actors || [];

  useEffect(() => {
    loadUseCases();
  }, [project.id]);

  async function loadUseCases() {
    try {
      setLoading(true);
      const res = await useCasesApi.getByProject(project.id);
      const data = res?.data || res || [];
      setUseCases(data);
      if (data.length > 0 && !selected) {
        setSelected(data[0]);
      }
    } catch (err) {
      console.error('Error loading use cases:', err);
    } finally {
      setLoading(false);
    }
  }

  const functionalReqs = (project.requirements || []).filter(r => r.type === 'FUNCTIONAL' || !r.type);
  const relevantReqsCount = functionalReqs.length;
  const actorsCount = actors.length;
  const estimatedCases = Math.max(1, Math.min(10, Math.ceil(relevantReqsCount / 3)));

  function requestGenerate() {
    setPreGenModalOpen(true);
  }

  async function executeGenerate() {
    setPreGenModalOpen(false);
    try {
      setGenerating(true);
      const res = await useCasesApi.generate(project.id);
      const data = res?.data || res || [];
      setUseCases(data);
      if (data.length > 0) setSelected(data[0]);
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al generar casos de uso: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleStatusChange(id, status, e) {
    e?.stopPropagation();
    try {
      await useCasesApi.updateStatus(id, status);
      setUseCases(prev => prev.map(u => u.id === id ? { ...u, reviewStatus: status } : u));
      if (selected?.id === id) {
        setSelected(prev => ({ ...prev, reviewStatus: status }));
      }
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al actualizar estado: ${err.message}`);
    }
  }

  async function handleApproveAll() {
    try {
      setSaving(true);
      const pending = useCases.filter(u => u.reviewStatus !== 'APPROVED');
      for (const u of pending) {
        await useCasesApi.updateStatus(u.id, 'APPROVED');
      }
      setUseCases(prev => prev.map(u => ({ ...u, reviewStatus: 'APPROVED' })));
      if (selected) setSelected(prev => ({ ...prev, reviewStatus: 'APPROVED' }));
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al aprobar casos de uso: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, e) {
    e?.stopPropagation();
    if (!window.confirm('¿Eliminar este caso de uso?')) return;
    try {
      await useCasesApi.delete(id);
      setUseCases(prev => prev.filter(u => u.id !== id));
      if (selected?.id === id) setSelected(null);
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al eliminar caso de uso: ${err.message}`);
    }
  }

  function openNewModal() {
    setEditingUC(null);
    const n = useCases.length + 1;
    setCodeId(`UC-${String(n).padStart(2, '0')}`);
    setName('');
    setDescription('');
    setPrimaryActorId(actors[0]?.codeId || actors[0]?.name || '');
    setRequirementIds([]);
    setReviewStatus('PENDING');
    setModalOpen(true);
  }

  function openEditModal(uc, e) {
    e?.stopPropagation();
    setEditingUC(uc);
    setCodeId(uc.codeId || '');
    setName(uc.name || '');
    setDescription(uc.description || '');
    setPrimaryActorId(uc.primaryActorId || '');
    setRequirementIds(Array.isArray(uc.requirementIds) ? uc.requirementIds : []);
    setReviewStatus(uc.reviewStatus || 'PENDING');
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSaving(true);
      const payload = {
        codeId: codeId.trim(),
        name: name.trim(),
        description: description.trim(),
        primaryActorId: primaryActorId.trim(),
        requirementIds: Array.isArray(requirementIds) ? requirementIds : [],
        reviewStatus
      };

      if (editingUC) {
        await useCasesApi.update(editingUC.id, payload);
      } else {
        await useCasesApi.create(project.id, payload);
      }
      setModalOpen(false);
      await loadUseCases();
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenDiagram() {
    setDiagramModalOpen(true);
    setDiagramLoading(true);
    setDiagramError(null);
    try {
      const res = await useCasesApi.getDiagram(project.id);
      const code = res?.data?.diagram || res?.diagram || '';
      setDiagramCode(code);
    } catch (err) {
      setDiagramError(err.message || 'Error al obtener diagrama');
    } finally {
      setDiagramLoading(false);
    }
  }

  const filtered = useCases.filter(u =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.codeId || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.description || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.primaryActorId || '').toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = useCases.filter(u => u.reviewStatus !== 'APPROVED').length;
  const approvedCount = useCases.filter(u => u.reviewStatus === 'APPROVED').length;

  // Resolve actor name
  const resolveActorName = (actorCode) => {
    if (!actorCode) return 'No asignado';
    const found = actors.find(a => a.codeId === actorCode || a.id === actorCode || a.name === actorCode);
    return found ? found.name : actorCode;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Header bar */}
      <div className="full-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 className="page-title">Casos de Uso del Sistema</h2>
          <div className="vdivider" />
          <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
            {useCases.length} caso{useCases.length !== 1 ? 's' : ''} registrado{useCases.length !== 1 ? 's' : ''}
          </span>
          {approvedCount > 0 && (
            <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
              {approvedCount} aprobado{approvedCount !== 1 ? 's' : ''}
            </span>
          )}
          {pendingCount > 0 && (
            <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
              {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="page-actions">
          <div className="search-bar" style={{ width: '220px' }}>
            <span className="ms">search</span>
            <input
              type="text"
              placeholder="Buscar casos de uso..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <button
            className="btn btn-outline btn-sm"
            onClick={requestGenerate}
            disabled={generating}
            title="Agrupar semánticamente los requisitos funcionales en casos de uso trazables"
          >
            <span className="ms ms-xs">auto_awesome</span>
            <span>{generating ? 'Generando...' : (useCases.length > 0 ? 'Regenerar Casos de Uso' : 'Generar Casos de Uso')}</span>
          </button>

          {pendingCount > 0 && (
            <button
              className="btn btn-outline btn-sm"
              onClick={handleApproveAll}
              disabled={saving}
              style={{ color: '#15803d', borderColor: '#86efac', background: '#f0fdf4' }}
              title="Aprobar todos los casos de uso pendientes"
            >
              <span className="ms ms-xs">done_all</span>
              <span>Aprobar todos ({pendingCount})</span>
            </button>
          )}

          <button
            className="btn btn-outline btn-sm"
            onClick={handleOpenDiagram}
            title="Visualizar diagrama Mermaid de Casos de Uso"
          >
            <span className="ms ms-xs">account_tree</span>
            <span>Ver Diagrama</span>
          </button>

          <button className="btn btn-primary btn-sm" onClick={openNewModal}>
            <span className="ms ms-xs">add</span>
            <span>Nuevo Caso de Uso</span>
          </button>
        </div>
      </div>

      {/* Split view: Left list, Right detail */}
      <div className="split-view">
        <section className="split-left">
          <div className="table-header-bar" style={{ gridTemplateColumns: '70px 1.5fr 1fr 100px 90px 80px' }}>
            <div className="table-col-label">ID</div>
            <div className="table-col-label">Caso de Uso</div>
            <div className="table-col-label">Actor Principal</div>
            <div className="table-col-label">Requisitos</div>
            <div className="table-col-label">Estado</div>
            <div className="table-col-label">Acciones</div>
          </div>

          <div className="table-body">
            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--secondary)' }}>
                Cargando casos de uso...
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><span className="ms ms-xl">account_tree</span></div>
                <p className="empty-state-title">{search ? 'Sin resultados' : 'Sin Casos de Uso'}</p>
                <p className="empty-state-desc">
                  {search
                    ? 'No se encontraron casos de uso coincidentes.'
                    : 'Haz clic en "Generar Casos de Uso" para estructurar los requisitos del proyecto.'}
                </p>
                {!search && (
                  <button className="btn btn-primary btn-sm" onClick={requestGenerate} disabled={generating}>
                    <span className="ms ms-xs">auto_awesome</span>
                    <span>{generating ? 'Generando...' : 'Generar Casos de Uso'}</span>
                  </button>
                )}
              </div>
            ) : (
              filtered.map(uc => (
                <div
                  key={uc.id}
                  className={`table-row ${selected?.id === uc.id ? 'selected' : ''}`}
                  style={{ gridTemplateColumns: '70px 1.5fr 1fr 100px 90px 80px' }}
                  onClick={() => setSelected(uc)}
                >
                  <div>
                    <span className="code-tag" style={{ color: selected?.id === uc.id ? 'var(--primary)' : 'var(--secondary)' }}>
                      {uc.codeId || 'UC'}
                    </span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      fontSize: '0.875rem',
                      fontWeight: selected?.id === uc.id ? 600 : 500,
                      color: 'var(--on-surface)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {uc.name}
                    </p>
                    {uc.description && (
                      <p style={{
                        fontSize: '0.75rem',
                        color: 'var(--secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {uc.description}
                      </p>
                    )}
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', fontWeight: 500 }}>
                      👤 {resolveActorName(uc.primaryActorId)}
                    </span>
                  </div>
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                      {(uc.requirementIds || []).slice(0, 3).map(rf => (
                        <span key={rf} className="code-tag" style={{ fontSize: '0.6875rem', padding: '1px 4px' }}>
                          {rf}
                        </span>
                      ))}
                      {(uc.requirementIds || []).length > 3 && (
                        <span style={{ fontSize: '0.6875rem', color: 'var(--secondary)' }}>
                          +{(uc.requirementIds.length - 3)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    {uc.reviewStatus === 'APPROVED' ? (
                      <span className="badge badge-success" style={{ fontSize: '0.6875rem' }}>Aprobado</span>
                    ) : uc.reviewStatus === 'REJECTED' ? (
                      <span className="badge badge-error" style={{ fontSize: '0.6875rem' }}>Rechazado</span>
                    ) : (
                      <span className="badge badge-warning" style={{ fontSize: '0.6875rem' }}>Pendiente</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                    {uc.reviewStatus !== 'APPROVED' ? (
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={(e) => handleStatusChange(uc.id, 'APPROVED', e)}
                        title="Aprobar caso de uso"
                        style={{ color: '#16a34a' }}
                      >
                        <span className="ms ms-xs">check</span>
                      </button>
                    ) : (
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={(e) => handleStatusChange(uc.id, 'PENDING', e)}
                        title="Marcar como pendiente"
                        style={{ color: '#d97706' }}
                      >
                        <span className="ms ms-xs">undo</span>
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={(e) => openEditModal(uc, e)}
                      title="Editar"
                    >
                      <span className="ms ms-xs">edit</span>
                    </button>
                    <button
                      className="btn btn-ghost btn-icon btn-sm text-error"
                      onClick={(e) => handleDelete(uc.id, e)}
                      title="Eliminar"
                    >
                      <span className="ms ms-xs">delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* RIGHT: Detail View */}
        <aside className="split-right">
          {selected ? (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="code-tag" style={{ fontSize: '0.875rem', fontWeight: 700 }}>
                    {selected.codeId}
                  </span>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--on-surface)', marginTop: '6px' }}>
                    {selected.name}
                  </h3>
                </div>
                <div>
                  {selected.reviewStatus === 'APPROVED' ? (
                    <span className="badge badge-success">Aprobado</span>
                  ) : (
                    <span className="badge badge-warning">Pendiente de Aprobación</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="card" style={{ padding: '12px' }}>
                  <label className="field-label" style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
                    Actor Principal
                  </label>
                  <p style={{ fontWeight: 600, marginTop: '4px' }}>
                    👤 {resolveActorName(selected.primaryActorId)}
                  </p>
                </div>
                <div className="card" style={{ padding: '12px' }}>
                  <label className="field-label" style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
                    Requisitos Relacionados
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {(selected.requirementIds || []).map(rf => (
                      <span key={rf} className="code-tag">{rf}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                  Descripción y Alcance
                </label>
                <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', lineHeight: 1.6, marginTop: '6px' }}>
                  {selected.description || 'Sin descripción detallada.'}
                </p>
              </div>

              {selected.preconditions && (
                <div>
                  <label className="field-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                    Precondiciones
                  </label>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', marginTop: '4px' }}>
                    {selected.preconditions}
                  </p>
                </div>
              )}

              {selected.postconditions && (
                <div>
                  <label className="field-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                    Postcondiciones
                  </label>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', marginTop: '4px' }}>
                    {selected.postconditions}
                  </p>
                </div>
              )}

              {Array.isArray(selected.mainFlow) && selected.mainFlow.length > 0 && (
                <div>
                  <label className="field-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                    Flujo Principal
                  </label>
                  <ol style={{ paddingLeft: '18px', marginTop: '6px', fontSize: '0.8125rem', color: 'var(--on-surface)' }}>
                    {selected.mainFlow.map((step, idx) => (
                      <li key={idx} style={{ marginBottom: '6px' }}>
                        {step.action || step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--outline-variant)' }}>
                {selected.reviewStatus !== 'APPROVED' ? (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={(e) => handleStatusChange(selected.id, 'APPROVED', e)}
                  >
                    <span className="ms ms-xs">check</span>
                    <span>Aprobar Caso de Uso</span>
                  </button>
                ) : (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={(e) => handleStatusChange(selected.id, 'PENDING', e)}
                  >
                    <span className="ms ms-xs">undo</span>
                    <span>Cambiar a Pendiente</span>
                  </button>
                )}
                <button className="btn btn-outline btn-sm" onClick={(e) => openEditModal(selected, e)}>
                  <span className="ms ms-xs">edit</span>
                  <span>Editar</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--secondary)' }}>
              Selecciona un caso de uso de la lista para ver su trazabilidad y detalles.
            </div>
          )}
        </aside>
      </div>

      {/* Edit/Create Modal */}
      {modalOpen && (
        <Modal
          title={editingUC ? `Editar Caso de Uso (${codeId})` : 'Nuevo Caso de Uso'}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px' }}>
              <div>
                <label className="field-label">Código</label>
                <input
                  className="input"
                  type="text"
                  value={codeId}
                  onChange={e => setCodeId(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="field-label">Nombre del Caso de Uso</label>
                <input
                  className="input"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej. Gestionar Citas y Turnos"
                  required
                />
              </div>
            </div>

            <div>
              <label className="field-label">Actor Principal</label>
              <select
                className="input"
                value={primaryActorId}
                onChange={e => setPrimaryActorId(e.target.value)}
              >
                {actors.map(a => (
                  <option key={a.id} value={a.codeId || a.name}>
                    {a.name} ({a.codeId || 'ACT'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <RequirementMultiSelect
                requirements={project.requirements || []}
                selectedDependencies={requirementIds}
                onChange={setRequirementIds}
                label="Requisitos Funcionales Asociados"
                placeholder="Buscar y asociar requisitos al caso de uso..."
              />
            </div>

            <div>
              <label className="field-label">Descripción del Caso de Uso</label>
              <textarea
                className="input"
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe el objetivo y alcance de este caso de uso..."
              />
            </div>

            <div>
              <label className="field-label">Estado de Revisión</label>
              <select
                className="input"
                value={reviewStatus}
                onChange={e => setReviewStatus(e.target.value)}
              >
                <option value="PENDING">Pendiente</option>
                <option value="APPROVED">Aprobado</option>
                <option value="REJECTED">Rechazado</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Caso de Uso'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Diagram Modal */}
      {diagramModalOpen && (
        <Modal
          title={`Diagrama de Casos de Uso — ${project.name}`}
          onClose={() => setDiagramModalOpen(false)}
          size="xlarge"
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
            {diagramLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p>Cargando diagrama de casos de uso...</p>
              </div>
            ) : diagramError ? (
              <div className="alert alert-error" style={{ margin: '16px' }}>
                {diagramError}
              </div>
            ) : (
              <DiagramViewport
                code={diagramCode}
                title="Casos de Uso del Proyecto"
              />
            )}
          </div>
        </Modal>
      )}
      {/* Modal de Validación Previa de Información para Casos de Uso (Req #15) */}
      {preGenModalOpen && (
        <Modal
          title="Verificación de Información para Casos de Uso"
          onClose={() => setPreGenModalOpen(false)}
          footer={(
            <>
              <button className="btn btn-outline btn-md" onClick={() => setPreGenModalOpen(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary btn-md"
                onClick={executeGenerate}
                disabled={generating}
              >
                {generating ? 'Generando...' : (actorsCount === 0 || relevantReqsCount === 0 ? 'Generar con información disponible' : 'Confirmar y Generar')}
              </button>
            </>
          )}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
              Antes de estructurar los casos de uso con IA, el sistema analiza los elementos canónicos existentes en el proyecto:
            </p>

            <div style={{
              background: 'var(--surface-container-low)',
              border: '1px solid var(--outline-variant)',
              borderRadius: '8px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <strong style={{ fontSize: '0.875rem', color: 'var(--primary)' }}>Información encontrada:</strong>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                <span>👤 Actores del sistema:</span>
                <strong>{actorsCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                <span>📋 Requisitos funcionales relevantes:</span>
                <strong>{relevantReqsCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                <span>🎯 Casos candidatos proyectados:</span>
                <strong>~{estimatedCases}</strong>
              </div>
            </div>

            {(actorsCount === 0 || relevantReqsCount === 0) && (
              <div className="alert alert-warning" style={{ fontSize: '0.8125rem' }}>
                <strong>Información insuficiente detectada:</strong>
                {actorsCount === 0 && <p>• No se han registrado actores del sistema.</p>}
                {relevantReqsCount === 0 && <p>• No se han detectado requisitos funcionales.</p>}
                <p style={{ marginTop: '4px' }}>Se recomienda aprobar actores y requisitos previamente para garantizar trazabilidad.</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
