import DocumentWorkflowPanel from '../components/DocumentWorkflowPanel';
import React, { useState, useEffect } from 'react';
import { engineering } from '../api/engineering.api';
import ImpactModal from '../components/common/ImpactModal';
import { requirementsApi } from '../api/requirements.api';
import { historyApi } from '../api/history.api';
import Modal from '../components/common/Modal';
import ProjectCandidateReview from './ProjectCandidateReview';
import ProjectActors from './ProjectActors';
import ActorMultiSelect from '../components/common/ActorMultiSelect';
import RequirementMultiSelect from '../components/common/RequirementMultiSelect';

const PRIORITY_DOT = {
  HIGH:   'high',
  MEDIUM: 'medium',
  LOW:    'low',
};
const PRIORITY_LABEL = { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };
const STATUS_LABELS = { PENDING: 'Pendiente', APPROVED: 'Aprobado', IN_REVIEW: 'En revisión', REJECTED: 'Rechazado' };
const TYPE_LABELS = { FUNCTIONAL: 'Funcional', NON_FUNCTIONAL: 'No Funcional' };

export default function ProjectRequirements({ project, onProjectUpdated, initialSubTab = 'candidates' }) {
  const [reqSubTab, setReqSubTab] = useState(initialSubTab);

  useEffect(() => {
    if (initialSubTab) setReqSubTab(initialSubTab);
  }, [initialSubTab]);

  const [pendingChange, setPendingChange] = useState(null);
  const [changeError, setChangeError] = useState('');
  const requirements = (project.requirements || []).filter(r=>!r.isDeleted&&r.status!=='REMOVED');
  const actorsMap = new Map((project.actors || []).map(a => [a.id, a.name]));



  const [viewMode, setViewMode] = useState('uta_table'); // 'uta_table' | 'split'
  const [selected, setSelected] = useState(requirements[0] || null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [editingReq, setEditingReq] = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function handleOpenHistory() {
    setHistoryModalOpen(true);
    try {
      setLoadingHistory(true);
      const history = await historyApi.getByProject(project.id);
      setHistoryItems(history.filter(h => h.entityType === 'REQUIREMENT'));
    } catch (err) {
      alert(`Error al cargar historial: ${err.message}`);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleRestoreHistory(historyId) {
    try {
      await historyApi.restore(historyId);
      alert('Requisito recuperado exitosamente con todos sus campos originales.');
      const updatedHistory = await historyApi.getByProject(project.id);
      setHistoryItems(updatedHistory.filter(h => h.entityType === 'REQUIREMENT'));
      await onProjectUpdated();
    } catch (err) {
      alert(`Error al recuperar versión: ${err.message}`);
    }
  }

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('FUNCTIONAL');
  const [priority, setPriority] = useState('MEDIUM');
  const [status, setStatus] = useState('PENDING');
  const [actorIds, setActorIds] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [preconditions, setPreconditions] = useState('');
  const [postconditions, setPostconditions] = useState('');
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
    setActorIds([]); setDependencies([]);
    setPreconditions('El usuario debe estar autenticado con rol y permisos correspondientes.');
    setPostconditions('El sistema actualiza el registro en la base de datos y refleja los cambios.');
    setReqModalOpen(true);
  }

  function openEditModal(req, e) {
    e?.stopPropagation();
    setEditingReq(req);
    setCode(req.code); setName(req.name); setDescription(req.description);
    setType(req.type); setPriority(req.priority); setStatus(req.status);
    setActorIds(Array.isArray(req.actorIds) ? req.actorIds : []);
    setDependencies(Array.isArray(req.dependencies) ? req.dependencies : []);
    setPreconditions(req.qualityReport?.preconditions || req.preconditions || 'El usuario debe estar autenticado con rol y permisos correspondientes.');
    setPostconditions(req.qualityReport?.postconditions || req.postconditions || 'El sistema actualiza el registro en la base de datos y refleja los cambios.');
    setReqModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!code || !name || !description) return;
    try {
      setSavingReq(true);
      const payload = {
        code, name, description, type, priority, status,
        actorIds: Array.isArray(actorIds) ? actorIds : [],
        dependencies: Array.isArray(dependencies) ? dependencies : [],
        qualityReport: {
          ...(editingReq?.qualityReport || {}),
          preconditions,
          postconditions
        }
      };
      if (editingReq) {
        if (['APPROVED', 'IMPLEMENTED', 'REMOVED', 'DEPRECATED'].includes(editingReq.status) || editingReq.revision > 1) {
          setPendingChange(await engineering(project.id, '/changes', { type: 'UPDATE', elementType: 'Requirement', elementId: editingReq.id, proposedState: payload, reason: 'Edición manual del requisito' }));
        } else await requirementsApi.update(editingReq.id, payload);
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
    try {
      setPendingChange(await engineering(project.id, '/changes', { type: 'DELETE', elementType: 'Requirement', elementId: id, reason: 'Desactivar requisito conservando historial' }));
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: '#FFFFFF', padding: '32px 40px' }}>
      <DocumentWorkflowPanel project={project} stage="requirements" onProjectUpdated={onProjectUpdated} />
      {changeError && <p role="alert">{changeError}</p>}
      <ImpactModal change={pendingChange} busy={savingReq} onClose={() => setPendingChange(null)} onConfirm={async () => { setSavingReq(true); setChangeError(''); try { await engineering(project.id, `/changes/${pendingChange.id}`, { status: 'APPROVED', confirmImpact: true }, 'PATCH'); setPendingChange(null); setSelected(null); await onProjectUpdated(); } catch (e) { setChangeError(e.message); } finally { setSavingReq(false); } }} />

      {/* Mockup Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Requerimientos
            </h1>
            <span style={{
              background: '#EEF2FF',
              color: '#4F46E5',
              border: '1px solid #E0E7FF',
              fontSize: '0.75rem',
              fontWeight: 500,
              padding: '2px 10px',
              borderRadius: '9999px'
            }}>
              {requirements.length} especificados
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: '6px 0 0 0' }}>
            Especificación funcional y no funcional bajo estándar ISO/IEC/IEEE 29148.
          </p>
        </div>

        {/* Capsule Switcher & New Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'inline-flex',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '3px',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
          }}>
            {[
              ['uta_table', `Requisitos (${requirements.length})`],
              ['candidates', 'Candidatos por Revisar'],
              ['actors', `Actores (${project.actors?.length || 0})`]
            ].map(([tabKey, label]) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setReqSubTab(tabKey)}
                style={{
                  background: reqSubTab === tabKey ? '#0F172A' : 'transparent',
                  color: reqSubTab === tabKey ? '#FFFFFF' : '#64748B',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '0.8125rem',
                  fontWeight: reqSubTab === tabKey ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openNewModal}
            style={{
              background: '#4F46E5',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 18px',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(79, 70, 229, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            + Nuevo Requisito
          </button>
        </div>
      </div>

      {reqSubTab === 'candidates' && (
        <div className="page-scrollable" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px' }}>
          <ProjectCandidateReview
            project={project}
            onProjectUpdated={onProjectUpdated}
            onNavigateToRequirements={() => setReqSubTab('uta_table')}
          />
        </div>
      )}

      {reqSubTab === 'actors' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <ProjectActors
            project={project}
            onProjectUpdated={onProjectUpdated}
          />
        </div>
      )}

      {reqSubTab === 'uta_table' && (
        <>
          {/* Sub-toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '16px', flexWrap: 'wrap', gap: '12px'
          }}>
            {/* Filter pills */}
            <div style={{
              display: 'inline-flex',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '3px',
              boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
            }}>
              {[
                ['all', `Todos (${counts.all})`],
                ['FUNCTIONAL', `Funcionales (${counts.FUNCTIONAL})`],
                ['NON_FUNCTIONAL', `No Funcionales (${counts.NON_FUNCTIONAL})`]
              ].map(([fKey, label]) => (
                <button
                  key={fKey}
                  type="button"
                  onClick={() => setFilterType(fKey)}
                  style={{
                    background: filterType === fKey ? '#0F172A' : 'transparent',
                    color: filterType === fKey ? '#FFFFFF' : '#64748B',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    fontSize: '0.75rem',
                    fontWeight: filterType === fKey ? 600 : 500,
                    cursor: 'pointer'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Search & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="text"
                placeholder="Buscar requisito..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '240px',
                  padding: '7px 12px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  outline: 'none',
                  background: '#FFFFFF'
                }}
              />
              <div style={{
                display: 'inline-flex',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '3px'
              }}>
                <button
                  type="button"
                  onClick={() => setViewMode('uta_table')}
                  style={{
                    background: viewMode === 'uta_table' ? '#0F172A' : 'transparent',
                    color: viewMode === 'uta_table' ? '#FFFFFF' : '#64748B',
                    border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '0.75rem', cursor: 'pointer'
                  }}
                >
                  Tabla
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  style={{
                    background: viewMode === 'split' ? '#0F172A' : 'transparent',
                    color: viewMode === 'split' ? '#FFFFFF' : '#64748B',
                    border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '0.75rem', cursor: 'pointer'
                  }}
                >
                  Detalle
                </button>
              </div>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleOpenHistory}
                style={{
                  background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#334155',
                  borderRadius: '8px', padding: '7px 14px', fontSize: '0.75rem'
                }}
              >
                Historial
              </button>
            </div>
          </div>

      {viewMode === 'uta_table' ? (
        <div className="page-scrollable" style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
          {/* Table */}
          <div style={{ background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline-variant)', overflowX: 'auto', boxShadow: 'var(--shadow-xs)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-container-low)', borderBottom: '2px solid var(--primary)', color: 'var(--on-surface)' }}>
                  <th style={{ padding: '12px 14px', width: '90px', fontWeight: 700 }}>Código</th>
                  <th style={{ padding: '12px 14px', width: '220px', fontWeight: 700 }}>Nombre</th>
                  <th style={{ padding: '12px 14px', minWidth: '240px', fontWeight: 700 }}>Descripción</th>
                  <th style={{ padding: '12px 14px', width: '120px', fontWeight: 700 }}>Dependencias</th>
                  <th style={{ padding: '12px 14px', width: '100px', fontWeight: 700 }}>Prioridad</th>
                  <th style={{ padding: '12px 14px', width: '140px', fontWeight: 700 }}>Actores</th>
                  <th style={{ padding: '12px 14px', minWidth: '160px', fontWeight: 700 }}>Precondiciones</th>
                  <th style={{ padding: '12px 14px', minWidth: '160px', fontWeight: 700 }}>Postcondiciones</th>
                  <th style={{ padding: '12px 14px', width: '80px', textAlign: 'center', fontWeight: 700 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((req, idx) => {
                  const pre = req.qualityReport?.preconditions || req.preconditions || 'El usuario debe estar autenticado con rol y permisos correspondientes.';
                  const post = req.qualityReport?.postconditions || req.postconditions || 'El sistema actualiza el registro en la base de datos y refleja los cambios.';
                  const actors = (req.actorIds || []).map(id => actorsMap.get(id) || id).join(', ') || 'Sin actor asignado';
                  const deps = (req.dependencies || []).join(', ') || 'Ninguna';

                  return (
                    <tr
                      key={req.id}
                      style={{
                        borderBottom: '1px solid var(--outline-variant)',
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                        verticalAlign: 'top'
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                        {req.code}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--on-surface)' }}>
                        {req.name}
                        <div style={{ marginTop: '4px' }}>
                          <span className="tag" style={{ fontSize: '0.6875rem' }}>
                            {req.type === 'FUNCTIONAL' ? 'Funcional' : 'No Funcional'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
                        {req.description}
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                        {deps}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div className={`priority-dot ${PRIORITY_DOT[req.priority] || 'medium'}`} />
                          <span style={{ fontWeight: 600 }}>{PRIORITY_LABEL[req.priority] || req.priority}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="ms ms-xs" style={{ color: 'var(--primary)' }}>person</span>
                          <span>{actors}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--on-surface-variant)', fontSize: '0.75rem', lineHeight: 1.4 }}>
                        {pre}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--on-surface-variant)', fontSize: '0.75rem', lineHeight: 1.4 }}>
                        {post}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={(e) => openEditModal(req, e)} title="Editar">
                            <span className="ms ms-xs">edit</span>
                          </button>
                          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--error)' }} onClick={(e) => handleDelete(req.id, e)} title="Eliminar">
                            <span className="ms ms-xs">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
      /* Split view */
      <div className="split-view">
        {/* LEFT: table */}
        <section className="split-left">
          {/* Table column headers */}
          <div
            className="table-header-bar"
            style={{ gridTemplateColumns: '90px 1fr 80px 110px 100px' }}
          >
            <div className="table-col-label">Código</div>
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

                {/* ISO 29148 Quality Score & Warnings */}
                {selected.qualityReport && (
                  <div className="detail-section">
                    <span className="detail-section-label">Calidad ISO/IEC/IEEE 29148</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                        Puntaje: {selected.qualityReport.score ?? '100'}/100
                      </span>
                    </div>
                    {Array.isArray(selected.qualityReport.warnings) && selected.qualityReport.warnings.length > 0 && (
                      <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {selected.qualityReport.warnings.map((w, idx) => (
                          <div key={idx} style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', background: 'var(--surface-container-low)', padding: '4px 8px', borderRadius: '4px' }}>
                            ⚠️ {typeof w === 'string' ? w : w.message || JSON.stringify(w)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
      )}

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
                <option value="NEEDS_REVIEW">Requiere Revisión</option>
                <option value="REJECTED">Rechazado</option>
                <option value="IMPLEMENTED">Implementado</option>
                <option value="DISCARDED">Descartado</option>
              </select>
            </div>
          </div>
          <div className="grid-2">
            <ActorMultiSelect
              actors={(project.actors || []).filter(a => a.reviewStatus === 'APPROVED')}
              selectedIds={actorIds}
              onChange={setActorIds}
            />
            <RequirementMultiSelect
              requirements={requirements}
              selectedDependencies={dependencies}
              onChange={setDependencies}
              currentRequirementCode={code}
            />
          </div>

          {editingReq?.sources && Array.isArray(editingReq.sources) && editingReq.sources.length > 1 && (
            <div style={{
              background: 'var(--surface-container-low)',
              border: '1px solid var(--outline-variant)',
              borderRadius: '8px',
              padding: '12px',
              marginTop: '4px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--primary)', marginBottom: '8px' }}>
                <span className="ms ms-xs">merge_type</span>
                <span>Candidatos Originales Consolidados ({editingReq.sources.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '130px', overflowY: 'auto' }}>
                {editingReq.sources.map((s, idx) => (
                  <div key={idx} style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', background: 'var(--surface-container-lowest)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--outline-variant)' }}>
                    <strong>{s.temporaryCode || s.candidateId || `Fuente ${idx + 1}`}:</strong> {s.statement || s.originalStatement}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Precondiciones</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Condiciones previas para ejecutar el requerimiento..."
                value={preconditions}
                onChange={e => setPreconditions(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Postcondiciones</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Resultado esperado tras la ejecución..."
                value={postconditions}
                onChange={e => setPostconditions(e.target.value)}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal Historial de Versiones / Papelera de Recuperación */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Papelera e Historial de Recuperación de Requerimientos"
        footer={(
          <button className="btn btn-outline btn-md" onClick={() => setHistoryModalOpen(false)}>
            Cerrar
          </button>
        )}
      >
        <p style={{ fontSize: '0.85rem', color: 'var(--secondary)', marginBottom: '1rem' }}>
          Si eliminó accidentalmente un requerimiento o desea recuperar una versión anterior, seleccione "Restaurar" para reincorporarlo inmediatamente al catálogo con su trazabilidad.
        </p>

        {loadingHistory ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando versiones...</div>
        ) : historyItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--secondary)' }}>
            No hay versiones o requisitos eliminados en el historial.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
            {historyItems.map((item) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid var(--outline-variant)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'var(--surface-container-low)',
                  gap: '0.75rem'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--on-surface)' }}>
                    <code>{item.snapshot?.code || 'REQ'}</code>: {item.snapshot?.name || 'Requisito'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
                    Acción: {item.action} • {new Date(item.createdAt).toLocaleString()}
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleRestoreHistory(item.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span className="ms ms-xs">restore</span>
                  <span>Restaurar</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>
      </>
      )}
    </div>
  );
}

