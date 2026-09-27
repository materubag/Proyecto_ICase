import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Edit3,
  AlertTriangle,
  Clock,
  HelpCircle,
  Filter,
  RefreshCw,
  Search,
  FileText,
  Mic,
  ShieldCheck,
  Check,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ExternalLink,
  Layers
} from 'lucide-react';
import { candidatesApi } from '../api/candidates.api';

export default function ProjectCandidateReview({ project, onNavigateToRequirements, onProjectUpdated }) {
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL'); // ALL | FUNCTIONAL | NON_FUNCTIONAL | BUSINESS_RULE | CONFLICTS | AMBIGUOUS | PENDING
  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW'); // PENDING_REVIEW | ALL | APPROVED | REJECTED
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [rejectingCandidate, setRejectingCandidate] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [message, setMessage] = useState(null);

  // Form de edición
  const [editTitle, setEditTitle] = useState('');
  const [editStatement, setEditStatement] = useState('');
  const [editPriority, setEditPriority] = useState('MEDIUM');
  const [savingEdit, setSavingEdit] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const filters = {};
      if (statusFilter !== 'ALL') filters.status = statusFilter;

      if (activeFilter === 'FUNCTIONAL') filters.type = 'FUNCTIONAL';
      if (activeFilter === 'NON_FUNCTIONAL') filters.type = 'NON_FUNCTIONAL';
      if (activeFilter === 'BUSINESS_RULE') filters.type = 'BUSINESS_RULE';
      if (activeFilter === 'CONFLICTS') filters.hasConflicts = true;
      if (activeFilter === 'AMBIGUOUS') filters.ambiguous = true;

      const [list, statsData] = await Promise.all([
        candidatesApi.list(project.id, filters),
        candidatesApi.getStats(project.id)
      ]);

      setCandidates(list);
      setStats(statsData);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [project.id, activeFilter, statusFilter]);

  async function handleApprove(candidate) {
    try {
      setMessage(null);
      const res = await candidatesApi.approve(candidate.id);
      await onProjectUpdated?.();
      setMessage({
        type: 'success',
        text: `Candidato ${candidate.temporaryCode} aprobado y promovido a requisito oficial (${res.data?.requirement?.code || 'RF'}).`
      });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: `Error al aprobar: ${err.message}` });
    }
  }

  function openRejectModal(candidate) {
    setRejectingCandidate(candidate);
    setRejectionReason('');
  }

  async function handleConfirmReject() {
    if (!rejectingCandidate) return;
    try {
      await candidatesApi.reject(rejectingCandidate.id, rejectionReason);
      setMessage({
        type: 'warning',
        text: `Candidato ${rejectingCandidate.temporaryCode} rechazado y archivado.`
      });
      setRejectingCandidate(null);
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: `Error al rechazar: ${err.message}` });
    }
  }

  function openEditModal(candidate) {
    setEditingCandidate(candidate);
    setEditTitle(candidate.title || '');
    setEditStatement(candidate.statement || '');
    setEditPriority(candidate.priority || 'MEDIUM');
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingCandidate) return;
    setSavingEdit(true);
    try {
      await candidatesApi.update(editingCandidate.id, {
        title: editTitle,
        statement: editStatement,
        priority: editPriority
      });
      setMessage({
        type: 'success',
        text: `Candidato ${editingCandidate.temporaryCode} actualizado y reevaluado bajo ISO 29148.`
      });
      setEditingCandidate(null);
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: `Error al actualizar: ${err.message}` });
    } finally {
      setSavingEdit(false);
    }
  }

  const filteredCandidates = candidates.filter((c) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      c.temporaryCode.toLowerCase().includes(term) ||
      c.title.toLowerCase().includes(term) ||
      c.statement.toLowerCase().includes(term)
    );
  });

  return (
    <div className="page-scrollable" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <section className="panel" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
              <ShieldCheck size={18} />
              <span>Fase 3: Pipeline Inteligente de Requisitos</span>
            </div>
            <h2 className="section-title" style={{ margin: 0, fontSize: '1.35rem' }}>
              Revisión de Candidatos a Requisito
            </h2>
            <p className="section-subtitle" style={{ margin: '4px 0 0 0', fontSize: '0.86rem' }}>
              Ningún requisito es oficial sin tu aprobación. Evaluación basada en criterios de <strong>ISO/IEC/IEEE 29148:2018</strong>.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn btn-ghost btn-icon" onClick={loadData} title="Refrescar">
              <RefreshCw size={18} className={loading ? 'spin' : ''} />
            </button>
            {onNavigateToRequirements && (
              <button className="btn btn-outline btn-sm" onClick={onNavigateToRequirements} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} />
                <span>Ver Requisitos Oficiales</span>
              </button>
            )}
          </div>
        </div>

        {/* Estadísticas de Ahorro y Calidad */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--outline-variant)' }}>
            <div style={{ padding: '8px 12px', background: 'var(--surface-container-low)', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Total Candidatos</span>
              <strong style={{ display: 'block', fontSize: '1.2rem', color: 'var(--primary)' }}>{stats.total}</strong>
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--surface-container-low)', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Pendientes</span>
              <strong style={{ display: 'block', fontSize: '1.2rem', color: '#b42318' }}>{stats.pending}</strong>
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--surface-container-low)', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Aprobados</span>
              <strong style={{ display: 'block', fontSize: '1.2rem', color: '#157347' }}>{stats.approved}</strong>
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--surface-container-low)', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>100% Deterministas</span>
              <strong style={{ display: 'block', fontSize: '1.2rem', color: '#0078d4' }}>{stats.explicit}</strong>
            </div>
            <div style={{ padding: '8px 12px', background: 'var(--surface-container-low)', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Calidad ISO Promedio</span>
              <strong style={{ display: 'block', fontSize: '1.2rem', color: stats.averageQualityScore > 80 ? '#157347' : '#9a6700' }}>
                {stats.averageQualityScore}/100
              </strong>
            </div>
          </div>
        )}
      </section>

      {/* Mensajes de notificación */}
      {message && (
        <div style={{ padding: '12px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem', background: message.type === 'error' ? 'rgba(180, 35, 24, 0.1)' : message.type === 'warning' ? 'rgba(154, 103, 0, 0.1)' : 'rgba(21, 115, 71, 0.1)', color: message.type === 'error' ? '#b42318' : message.type === 'warning' ? '#9a6700' : '#157347', border: `1px solid ${message.type === 'error' ? '#b42318' : message.type === 'warning' ? '#9a6700' : '#157347'}` }}>
          {message.text}
        </div>
      )}

      {/* Barra de Filtros y Búsqueda */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'FUNCTIONAL', label: 'Funcionales (RF)' },
            { id: 'NON_FUNCTIONAL', label: 'No Funcionales (RNF)' },
            { id: 'BUSINESS_RULE', label: 'Reglas de Negocio' },
            { id: 'CONFLICTS', label: 'Conflictos' },
            { id: 'AMBIGUOUS', label: 'Ambiguos' }
          ].map((f) => (
            <button
              key={f.id}
              className={`btn btn-sm ${activeFilter === f.id ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveFilter(f.id)}
              style={{ fontSize: '0.78rem' }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ fontSize: '0.82rem', padding: '5px 10px', width: '160px' }}
          >
            <option value="PENDING_REVIEW">Por revisar</option>
            <option value="APPROVED">Aprobados</option>
            <option value="REJECTED">Rechazados</option>
            <option value="ALL">Cualquier estado</option>
          </select>

          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--secondary)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Buscar candidato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '30px', fontSize: '0.82rem' }}
            />
          </div>
        </div>
      </div>

      {/* Lista de Candidatos */}
      {loading ? (
        <div className="empty-state" style={{ padding: '40px' }}>
          <RefreshCw size={24} className="spin" style={{ color: 'var(--primary)', marginBottom: '8px' }} />
          <p>Cargando candidatos a revisión...</p>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div style={{ padding: '36px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--outline-variant)', borderRadius: '8px' }}>
          <ShieldCheck size={32} color="var(--secondary)" style={{ marginBottom: '8px' }} />
          <h4 style={{ margin: '4px 0' }}>No se encontraron candidatos en esta vista</h4>
          <p style={{ fontSize: '0.84rem', color: 'var(--secondary)', margin: 0 }}>
            {statusFilter === 'PENDING_REVIEW'
              ? 'Todos los candidatos han sido procesados, o bien necesitas analizar una fuente PDF o de audio en la pestaña Fuentes.'
              : 'Prueba cambiando los filtros seleccionados arriba.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '14px' }}>
          {filteredCandidates.map((candidate) => {
            const isExpanded = expandedId === candidate.id;
            const quality = candidate.qualityReport || {};
            const isConflict = candidate.evidence?.relationship?.relation === 'CONFLICT';
            const isDuplicate = candidate.evidence?.relationship?.relation === 'DUPLICATE';
            const isAudio = candidate.source?.type === 'AUDIO';
            const evidence = candidate.evidence || {};

            return (
              <article
                key={candidate.id}
                className="panel"
                style={{
                  padding: '16px 20px',
                  borderRadius: '8px',
                  border: isConflict
                    ? '1px solid #b42318'
                    : isExpanded
                    ? '1px solid var(--primary)'
                    : '1px solid var(--outline-variant)',
                  background: 'var(--surface)',
                  boxShadow: isConflict ? '0 2px 8px rgba(180, 35, 24, 0.08)' : 'none'
                }}
              >
                {/* Cabecera de la Tarjeta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.88rem', color: 'var(--primary)' }}>
                        {candidate.temporaryCode}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: candidate.type === 'NON_FUNCTIONAL' ? 'rgba(103, 80, 164, 0.12)' : 'rgba(0, 120, 212, 0.12)',
                          color: candidate.type === 'NON_FUNCTIONAL' ? 'var(--primary)' : '#0078d4',
                          fontSize: '0.72rem'
                        }}
                      >
                        {candidate.type === 'NON_FUNCTIONAL' ? 'NO FUNCIONAL' : candidate.type}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: candidate.origin === 'EXPLICIT' ? 'rgba(21, 115, 71, 0.12)' : 'rgba(154, 103, 0, 0.12)',
                          color: candidate.origin === 'EXPLICIT' ? '#157347' : '#9a6700',
                          fontSize: '0.72rem'
                        }}
                      >
                        {candidate.origin === 'EXPLICIT' ? 'DETERMINISTA (CÓDIGO)' : 'INFERIDO (IA)'}
                      </span>

                      {/* Alerta de Conflicto o Duplicado */}
                      {isConflict && (
                        <span className="badge" style={{ background: 'rgba(180, 35, 24, 0.15)', color: '#b42318', fontSize: '0.72rem' }}>
                          <AlertTriangle size={11} style={{ marginRight: '3px' }} /> CONFLICTO DETECTADO
                        </span>
                      )}
                      {isDuplicate && (
                        <span className="badge" style={{ background: 'rgba(154, 103, 0, 0.15)', color: '#9a6700', fontSize: '0.72rem' }}>
                          POSIBLE DUPLICADO ({evidence.relationship?.target})
                        </span>
                      )}

                      {/* Badge de Estado */}
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.72rem',
                          background: candidate.status === 'APPROVED' ? 'rgba(21, 115, 71, 0.15)' : candidate.status === 'REJECTED' ? 'rgba(100, 100, 100, 0.15)' : 'rgba(0, 0, 0, 0.06)',
                          color: candidate.status === 'APPROVED' ? '#157347' : candidate.status === 'REJECTED' ? '#666' : 'var(--on-surface)'
                        }}
                      >
                        {candidate.status === 'APPROVED' ? 'Aprobado ✓' : candidate.status === 'REJECTED' ? 'Rechazado ✕' : 'Pendiente revisión'}
                      </span>
                    </div>

                    <h4 style={{ margin: '0 0 6px 0', fontSize: '0.98rem', fontWeight: 600 }}>
                      {candidate.title}
                    </h4>

                    {/* Enunciado de la Propuesta */}
                    <div
                      style={{
                        padding: '10px 14px',
                        background: 'var(--surface-container-low)',
                        borderRadius: '6px',
                        borderLeft: '3px solid var(--primary)',
                        fontSize: '0.85rem',
                        lineHeight: '1.5'
                      }}
                    >
                      {candidate.statement}
                    </div>

                    {/* Origen y Trazabilidad */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px', fontSize: '0.78rem', color: 'var(--secondary)', flexWrap: 'wrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {isAudio ? <Mic size={13} color="var(--primary)" /> : <FileText size={13} color="#0078d4" />}
                        {candidate.source?.name || 'Fuente externa'} (v{candidate.sourceVersion?.version || 1})
                      </span>
                      {evidence.startTime !== undefined && (
                        <span style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.05)', padding: '1px 6px', borderRadius: '4px' }}>
                          Timestamp: {evidence.startTime}s - {evidence.endTime}s
                        </span>
                      )}
                      {evidence.page && (
                        <span>Página {evidence.page}</span>
                      )}
                      <span>Score Calidad ISO: <strong>{quality.score ?? 'Sin evaluar'}/100</strong></span>
                    </div>
                  </div>

                  {/* Acciones de Revisión */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                    {candidate.status === 'PENDING_REVIEW' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleApprove(candidate)}
                          title="Aprobar y promover a requisito oficial"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Check size={14} /> Aprobar
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => openEditModal(candidate)}
                          title="Editar enunciado antes de aprobar"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openRejectModal(candidate)}
                          title="Rechazar candidato"
                          style={{ color: '#b42318' }}
                        >
                          <XCircle size={15} />
                        </button>
                      </div>
                    )}

                    {candidate.status === 'APPROVED' && (
                      <div style={{ fontSize: '0.78rem', color: '#157347', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={15} /> Promovido a Requisito Oficial
                      </div>
                    )}

                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setExpandedId(isExpanded ? null : candidate.id)}
                      style={{ alignSelf: 'flex-end', fontSize: '0.75rem', marginTop: '4px' }}
                    >
                      {isExpanded ? (
                        <><span>Ocultar evaluación ISO</span> <ChevronUp size={13} /></>
                      ) : (
                        <><span>Ver evaluación ISO 29148 ({quality.warnings?.length || 0} avisos)</span> <ChevronDown size={13} /></>
                      )}
                    </button>
                  </div>
                </div>

                {/* Vista Expandida de Calidad ISO 29148 y Evidencia */}
                {isExpanded && (
                  <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--outline-variant)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--secondary)', marginBottom: '8px' }}>
                      {quality.standard || 'Evaluación de calidad basada en criterios de ISO/IEC/IEEE 29148:2018'}
                    </div>

                    {/* Avisos de Calidad */}
                    {quality.warnings && quality.warnings.length > 0 ? (
                      <div style={{ display: 'grid', gap: '6px', marginBottom: '10px' }}>
                        {quality.warnings.map((w, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#9a6700', background: 'rgba(154, 103, 0, 0.08)', padding: '6px 10px', borderRadius: '4px' }}>
                            <AlertTriangle size={14} />
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: '#157347', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Check size={14} /> Cumple satisfactoriamente los criterios sintácticos, de singularidad y trazabilidad.
                      </div>
                    )}

                    {/* Preguntas de Aclaración para Información Faltante */}
                    {quality.clarificationQuestions && quality.clarificationQuestions.length > 0 && (
                      <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(0, 120, 212, 0.06)', borderRadius: '6px' }}>
                        <strong style={{ fontSize: '0.78rem', color: '#0078d4', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <HelpCircle size={13} /> Pregunta(s) de Aclaración para el Cliente / Experto:
                        </strong>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '0.8rem', color: 'var(--on-surface)' }}>
                          {quality.clarificationQuestions.map((q, idx) => (
                            <li key={idx}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Fragmento de Evidencia Literal */}
                    {evidence.text && (
                      <div style={{ marginTop: '10px', fontSize: '0.78rem' }}>
                        <span style={{ color: 'var(--secondary)', fontWeight: 600 }}>Fragmento extraído de la fuente:</span>
                        <blockquote style={{ margin: '4px 0 0 0', padding: '6px 10px', background: 'var(--surface-container-low)', borderLeft: '3px solid var(--outline)', fontStyle: 'italic' }}>
                          "{evidence.text}"
                        </blockquote>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Modal de Edición Humana */}
      {editingCandidate && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 9999 }}>
          <div className="panel" style={{ width: '90%', maxWidth: '580px', padding: '24px', background: 'var(--surface)', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem' }}>
              Editar Propuesta de Requisito ({editingCandidate.temporaryCode})
            </h3>
            <form onSubmit={handleSaveEdit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Título / Nombre</label>
                <input
                  type="text"
                  className="form-control"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Enunciado del Requisito (Recomendación ISO: "El sistema deberá permitir...")
                </label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={editStatement}
                  onChange={(e) => setEditStatement(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Prioridad</label>
                <select
                  className="form-control"
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                >
                  <option value="HIGH">Alta</option>
                  <option value="MEDIUM">Media</option>
                  <option value="LOW">Baja</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setEditingCandidate(null)} disabled={savingEdit}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? 'Guardando...' : 'Guardar y Reevaluar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Rechazo con Motivo */}
      {rejectingCandidate && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 9999 }}>
          <div className="panel" style={{ width: '90%', maxWidth: '480px', padding: '24px', background: 'var(--surface)', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', color: '#b42318' }}>
              Rechazar Candidato ({rejectingCandidate.temporaryCode})
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--secondary)', marginBottom: '14px' }}>
              El candidato no se eliminará físicamente para evitar que se regenere automáticamente en futuros análisis.
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>Motivo del rechazo (opcional)</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Ej. Fuera de alcance en esta fase, regla de negocio obsoleta..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-outline" onClick={() => setRejectingCandidate(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={handleConfirmReject} style={{ background: '#b42318', borderColor: '#b42318' }}>
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
