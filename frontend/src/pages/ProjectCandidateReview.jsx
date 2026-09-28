import React, { useEffect, useState, useMemo } from 'react';
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
  FileAudio,
  Mic,
  ShieldCheck,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  ExternalLink,
  Layers,
  LayoutGrid,
  List,
  Eye,
  ArrowRight,
  CheckSquare,
  Users,
  GitBranch,
  Shield,
  Cpu,
  Database,
  Layout,
  Calendar,
  Building,
  AlertCircle
} from 'lucide-react';
import { candidatesApi } from '../api/candidates.api';
import CandidateDetailModal from '../components/requirements/CandidateDetailModal';

export default function ProjectCandidateReview({ project, onNavigateToRequirements, onProjectUpdated }) {
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Active category filter
  const [activeCategory, setActiveCategory] = useState('ALL');
  // Status filter: PENDING_REVIEW | ALL | APPROVED | REJECTED
  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // Modals & Actions
  const [editingCandidate, setEditingCandidate] = useState(null);
  const [rejectingCandidate, setRejectingCandidate] = useState(null);
  const [inspectingCandidate, setInspectingCandidate] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [message, setMessage] = useState(null);

  // View mode: 'cards' or 'table'
  const [viewMode, setViewMode] = useState('cards');

  // Control de visualización de métricas/KPIs (colapsable para ahorrar espacio vertical)
  const [showMetrics, setShowMetrics] = useState(false);

  // Paginación y Densidad
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [cardDensity, setCardDensity] = useState('normal'); // 'normal' | 'compact'
  const containerRef = React.useRef(null);

  const scrollToTop = () => {
    if (containerRef.current) {
      const scrollParent = containerRef.current.closest('.page-scrollable') || containerRef.current.parentElement || window;
      scrollParent.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Multi-selection for batch operations
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchOperating, setBatchOperating] = useState(false);

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

      const [list, statsData] = await Promise.all([
        candidatesApi.list(project.id, filters),
        candidatesApi.getStats(project.id)
      ]);

      setCandidates(list || []);
      setStats(statsData);
      setSelectedIds(new Set());
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [project.id, statusFilter]);

  // Contadores por categoría calculados a partir de los candidatos
  const categoryCounts = useMemo(() => {
    const counts = {
      ALL: candidates.length,
      REQUISITOS: 0,
      ACTORES: 0,
      PROCESOS: 0,
      'REGLAS DE NEGOCIO': 0,
      TECNOLOGÍAS: 0,
      ARQUITECTURA: 0,
      ENTIDADES: 0,
      PANTALLAS: 0,
      FECHAS: 0,
      RESTRICCIONES: 0,
      'OBJETIVOS Y ALCANCE': 0,
      CONFLICTS: 0
    };

    candidates.forEach((c) => {
      const grp = c.categoryGroup || 'OTROS';
      if (counts[grp] !== undefined) counts[grp]++;
      if (c.evidence?.relationship?.relation === 'CONFLICT') counts.CONFLICTS++;
    });

    return counts;
  }, [candidates]);

  // Filtrado final en memoria por categoría activa y búsqueda
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (activeCategory === 'CONFLICTS') {
        if (c.evidence?.relationship?.relation !== 'CONFLICT') return false;
      } else if (activeCategory !== 'ALL') {
        if (c.categoryGroup !== activeCategory) return false;
      }

      if (search.trim()) {
        const query = search.toLowerCase();
        const code = (c.temporaryCode || '').toLowerCase();
        const title = (c.title || '').toLowerCase();
        const statement = (c.statement || '').toLowerCase();
        const src = (c.source?.name || '').toLowerCase();
        if (!code.includes(query) && !title.includes(query) && !statement.includes(query) && !src.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [candidates, activeCategory, search]);

  // Reiniciar a página 1 al cambiar categoría, filtro de estado o búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, statusFilter, search]);

  const totalItems = filteredCandidates.length;
  const effectivePageSize = pageSize >= 999 ? (totalItems || 1) : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * effectivePageSize;
  const endIndex = Math.min(startIndex + effectivePageSize, totalItems);

  const paginatedCandidates = useMemo(() => {
    if (pageSize >= 999) return filteredCandidates;
    return filteredCandidates.slice(startIndex, endIndex);
  }, [filteredCandidates, startIndex, endIndex, pageSize]);

  // Aprobación individual rápida
  async function handleApprove(candidate) {
    try {
      setMessage(null);
      const res = await candidatesApi.approve(candidate.id);
      await onProjectUpdated?.();
      setMessage({
        type: 'success',
        text: res.message || `Candidato "${candidate.title || candidate.temporaryCode}" aprobado e integrado a la información oficial.`
      });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: `Error al aprobar: ${err.message}` });
    }
  }

  // Aprobación en lote de selección
  async function handleBatchApprove() {
    if (selectedIds.size === 0 || batchOperating) return;
    if (!window.confirm(`¿Aprobar los ${selectedIds.size} candidatos seleccionados como información oficial?`)) return;

    setBatchOperating(true);
    setMessage(null);
    try {
      await candidatesApi.approveBatch(project.id, Array.from(selectedIds));
      await onProjectUpdated?.();
      setMessage({
        type: 'success',
        text: `${selectedIds.size} candidatos aprobados exitosamente.`
      });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: `Error en aprobación por lote: ${err.message}` });
    } finally {
      setBatchOperating(false);
    }
  }

  // Rechazo en lote de selección
  async function handleBatchReject() {
    if (selectedIds.size === 0 || batchOperating) return;
    if (!window.confirm(`¿Rechazar los ${selectedIds.size} candidatos seleccionados?`)) return;

    setBatchOperating(true);
    setMessage(null);
    try {
      await candidatesApi.rejectBatch(project.id, Array.from(selectedIds), 'Rechazo en lote');
      setMessage({
        type: 'warning',
        text: `${selectedIds.size} candidatos rechazados.`
      });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: `Error en rechazo por lote: ${err.message}` });
    } finally {
      setBatchOperating(false);
    }
  }

  // Aprobar toda la categoría actual
  async function handleApproveAllCategory() {
    if (activeCategory === 'ALL' || activeCategory === 'CONFLICTS') return;
    const count = categoryCounts[activeCategory] || 0;
    if (count === 0) return;

    if (!window.confirm(`¿Aprobar todos los ${count} elementos de la categoría "${activeCategory}"?`)) return;

    setBatchOperating(true);
    setMessage(null);
    try {
      await candidatesApi.approveCategory(project.id, activeCategory);
      await onProjectUpdated?.();
      setMessage({
        type: 'success',
        text: `Todos los elementos de "${activeCategory}" fueron aprobados.`
      });
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: `Error al aprobar categoría: ${err.message}` });
    } finally {
      setBatchOperating(false);
    }
  }

  const toggleSelectCandidate = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedCandidates.length && paginatedCandidates.length > 0) {
      setSelectedIds(new Set());
    } else {
      const next = new Set(selectedIds);
      paginatedCandidates.forEach((c) => next.add(c.id));
      setSelectedIds(next);
    }
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredCandidates.map((c) => c.id)));
  };

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
        text: `Candidato "${rejectingCandidate.title || rejectingCandidate.temporaryCode}" rechazado.`
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
        text: `Candidato actualizado correctamente.`
      });
      setEditingCandidate(null);
      await loadData();
    } catch (err) {
      setMessage({ type: 'error', text: `Error al guardar cambios: ${err.message}` });
    } finally {
      setSavingEdit(false);
    }
  }

  // Métricas de progreso
  const totalCount = stats?.total || candidates.length;
  const approvedCount = stats?.approved || 0;
  const pendingCount = stats?.pending || 0;
  const reviewedCount = approvedCount + (stats?.rejected || 0);
  const approvalPercent = totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : 0;

  // Lista de pestañas de categoría
  const categoryTabs = [
    { id: 'ALL', label: 'Todos', icon: <Layers size={13} />, count: categoryCounts.ALL },
    { id: 'REQUISITOS', label: 'Requisitos', icon: <FileText size={13} />, count: categoryCounts.REQUISITOS },
    { id: 'ACTORES', label: 'Actores', icon: <Users size={13} />, count: categoryCounts.ACTORES },
    { id: 'PROCESOS', label: 'Procesos', icon: <GitBranch size={13} />, count: categoryCounts.PROCESOS },
    { id: 'REGLAS DE NEGOCIO', label: 'Reglas de Negocio', icon: <Shield size={13} />, count: categoryCounts['REGLAS DE NEGOCIO'] },
    { id: 'TECNOLOGÍAS', label: 'Tecnologías', icon: <Cpu size={13} />, count: categoryCounts.TECNOLOGÍAS },
    { id: 'ARQUITECTURA', label: 'Arquitectura', icon: <Building size={13} />, count: categoryCounts.ARQUITECTURA },
    { id: 'ENTIDADES', label: 'Entidades & Datos', icon: <Database size={13} />, count: categoryCounts.ENTIDADES },
    { id: 'PANTALLAS', label: 'Pantallas / Vistas', icon: <Layout size={13} />, count: categoryCounts.PANTALLAS },
    { id: 'FECHAS', label: 'Fechas & Hitos', icon: <Calendar size={13} />, count: categoryCounts.FECHAS },
    { id: 'RESTRICCIONES', label: 'Restricciones / Supuestos', icon: <AlertCircle size={13} />, count: categoryCounts.RESTRICCIONES },
    { id: 'OBJETIVOS Y ALCANCE', label: 'Objetivos & Alcance', icon: <Layers size={13} />, count: categoryCounts['OBJETIVOS Y ALCANCE'] },
    { id: 'CONFLICTS', label: 'Conflictos', icon: <AlertTriangle size={13} />, count: categoryCounts.CONFLICTS }
  ].filter(tab => tab.id === 'ALL' || tab.count > 0 || tab.id === activeCategory);

  const renderPaginationBar = () => {
    if (totalItems === 0) return null;

    return (
      <div
        className="pagination-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 18px',
          background: 'var(--surface-container-low)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-default)',
          margin: '18px 0 28px 0',
          fontSize: '0.8125rem',
          boxShadow: 'var(--shadow-xs)'
        }}
      >
        {/* Info de cantidad */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--on-surface)', fontWeight: 500 }}>
            Mostrando <strong style={{ color: 'var(--primary)' }}>{totalItems > 0 ? startIndex + 1 : 0}</strong>–<strong style={{ color: 'var(--primary)' }}>{endIndex}</strong> de <strong>{totalItems}</strong> candidatos
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Por página:</span>
            <div className="seg-control" style={{ transform: 'scale(0.92)', transformOrigin: 'left center' }}>
              {[10, 15, 25, 50, 999].map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`seg-btn ${pageSize === size ? 'active' : ''}`}
                  onClick={() => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                >
                  {size === 999 ? 'Todos' : size}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Botones de navegación de página (al final de la lista) */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--primary)',
                background: 'rgba(41, 82, 217, 0.08)',
                padding: '3px 8px',
                borderRadius: '4px'
              }}
            >
              Página {currentPage} de {totalPages}
            </span>

            {/* Controles de avance */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setCurrentPage(1);
                  scrollToTop();
                }}
                disabled={currentPage === 1}
                title="Primera página"
                style={{ padding: '4px 6px' }}
              >
                «
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setCurrentPage(p => Math.max(1, p - 1));
                  scrollToTop();
                }}
                disabled={currentPage === 1}
                title="Página anterior"
                style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                <ChevronLeft size={14} />
                <span>Ant</span>
              </button>

              {/* Botones numéricos */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  return (
                    <React.Fragment key={p}>
                      {prev && p - prev > 1 && <span style={{ padding: '0 3px', color: 'var(--outline)' }}>…</span>}
                      <button
                        type="button"
                        className={`btn btn-sm ${currentPage === p ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => {
                          setCurrentPage(p);
                          scrollToTop();
                        }}
                        style={{ minWidth: '28px', padding: '4px 6px', fontSize: '0.75rem' }}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setCurrentPage(p => Math.min(totalPages, p + 1));
                  scrollToTop();
                }}
                disabled={currentPage === totalPages}
                title="Siguiente página"
                style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                <span>Sig</span>
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setCurrentPage(totalPages);
                  scrollToTop();
                }}
                disabled={currentPage === totalPages}
                title="Última página"
                style={{ padding: '4px 6px' }}
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="tab-pane animate-fade" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      {/* 1. Header Panel & Dashboard de Aprobación */}
      <section className="panel" style={{ padding: '18px 20px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 600, fontSize: '0.8125rem', marginBottom: '4px' }}>
              <ShieldCheck size={16} />
              <span>Centro Unificado de Revisión y Aprobación</span>
            </div>
            <h2 className="section-title" style={{ margin: 0, fontSize: '1.25rem' }}>
              Información del Proyecto Pendiente de Aprobación
            </h2>
            <p className="section-subtitle" style={{ margin: '4px 0 0 0', fontSize: '0.8125rem' }}>
              Toda la información extraída permanece como candidata hasta que tú decidas aprobarla, editarla o rechazarla.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setShowMetrics(v => !v)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              title={showMetrics ? 'Ocultar panel de métricas' : 'Mostrar panel de métricas'}
            >
              {showMetrics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span>{showMetrics ? 'Ocultar KPIs' : 'Ver KPIs'}</span>
            </button>
            <button className="btn btn-ghost btn-icon" onClick={loadData} title="Refrescar">
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </button>
            {onNavigateToRequirements && (
              <button
                className="btn btn-outline btn-sm"
                onClick={onNavigateToRequirements}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Layers size={14} />
                <span>Ver Requisitos Oficiales ({project.requirements?.length || 0})</span>
              </button>
            )}
          </div>
        </div>

        {/* Dashboard de métricas colapsable */}
        {stats && showMetrics && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-default)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '14px' }}>
              <div style={{ padding: '10px 14px', background: 'var(--surface-container-low)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Total Extraídos</span>
                <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--primary)' }}>{totalCount}</strong>
              </div>
              <div style={{ padding: '10px 14px', background: 'rgba(217, 119, 6, 0.08)', borderRadius: '6px', border: '1px solid rgba(217, 119, 6, 0.25)' }}>
                <span style={{ fontSize: '0.75rem', color: '#b45309' }}>Pendientes de Revisión</span>
                <strong style={{ display: 'block', fontSize: '1.25rem', color: '#b45309' }}>{pendingCount}</strong>
              </div>
              <div style={{ padding: '10px 14px', background: 'rgba(21, 115, 71, 0.05)', borderRadius: '6px', border: '1px solid rgba(21, 115, 71, 0.15)' }}>
                <span style={{ fontSize: '0.75rem', color: '#157347' }}>Aprobados Oficiales</span>
                <strong style={{ display: 'block', fontSize: '1.25rem', color: '#157347' }}>{approvedCount}</strong>
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--surface-container-low)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Rechazados</span>
                <strong style={{ display: 'block', fontSize: '1.25rem', color: 'var(--outline)' }}>{stats.rejected || 0}</strong>
              </div>
            </div>

            {/* Progreso de revisión */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--secondary)', marginBottom: '4px' }}>
                <span>Progreso de aprobación del proyecto</span>
                <strong>{reviewedCount} de {totalCount} revisados ({approvalPercent}%)</strong>
              </div>
              <div style={{ width: '100%', height: '7px', background: 'var(--surface-container-high)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${approvalPercent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--primary) 0%, #10b981 100%)',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Mensajes de notificación */}
      {message && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '0.85rem',
            background:
              message.type === 'error'
                ? 'rgba(180, 35, 24, 0.08)'
                : message.type === 'warning'
                ? 'rgba(154, 103, 0, 0.08)'
                : 'rgba(21, 115, 71, 0.08)',
            color:
              message.type === 'error'
                ? '#b42318'
                : message.type === 'warning'
                ? '#9a6700'
                : '#157347',
            border: `1px solid ${
              message.type === 'error'
                ? '#b42318'
                : message.type === 'warning'
                ? '#9a6700'
                : '#157347'
            }`
          }}
        >
          {message.text}
        </div>
      )}

      {/* 2. Pestañas de Agrupación por Categoría */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '14px',
          borderBottom: '1px solid var(--border-default)'
        }}
      >
        {categoryTabs.map((tab) => {
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveCategory(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                whiteSpace: 'nowrap',
                padding: '6px 12px'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: isActive ? 'rgba(255, 255, 255, 0.25)' : 'var(--surface-container-high)',
                  color: isActive ? '#fff' : 'var(--on-surface)'
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Filtros secundarios: Estado, Búsqueda, Vista y Acción de grupo */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px'
        }}
      >
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ fontSize: '0.8125rem', padding: '5px 10px', width: '160px' }}
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
              placeholder={`Buscar en ${categoryTabs.find(t => t.id === activeCategory)?.label || 'candidatos'}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '30px', fontSize: '0.8125rem' }}
            />
          </div>

          {activeCategory !== 'ALL' && activeCategory !== 'CONFLICTS' && categoryCounts[activeCategory] > 0 && statusFilter === 'PENDING_REVIEW' && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleApproveAllCategory}
              disabled={batchOperating}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#157347' }}
            >
              <CheckCircle2 size={13} />
              <span>Aprobar todo {activeCategory} ({categoryCounts[activeCategory]})</span>
            </button>
          )}
        </div>

        {/* View mode switcher y control de densidad */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {viewMode === 'cards' && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setCardDensity(d => d === 'normal' ? 'compact' : 'normal')}
              title={cardDensity === 'normal' ? 'Cambiar a vista compacta' : 'Cambiar a vista expandida'}
              style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <SlidersHorizontal size={13} />
              <span>{cardDensity === 'normal' ? 'Compacto' : 'Expandido'}</span>
            </button>
          )}

          <div className="seg-control">
            <button
              type="button"
              className={`seg-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Vista de Tarjetas"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              className={`seg-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Vista Compacta / Tabla"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Barra de Acciones por Lote (cuando hay seleccionados) */}
      {selectedIds.size > 0 && (
        <div
          style={{
            padding: '10px 16px',
            background: 'var(--surface-container-low)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <strong style={{ fontSize: '0.8125rem', color: 'var(--on-surface)' }}>
              {selectedIds.size} elemento{selectedIds.size > 1 ? 's' : ''} seleccionado{selectedIds.size > 1 ? 's' : ''}
            </strong>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Desmarcar
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleBatchReject}
              disabled={batchOperating}
              style={{ color: '#b42318' }}
            >
              <XCircle size={14} />
              <span>Rechazar selección ({selectedIds.size})</span>
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleBatchApprove}
              disabled={batchOperating}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <CheckCircle2 size={14} />
              <span>Aprobar selección ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. Lista / Grid de Candidatos */}
      {loading ? (
        <div className="empty-state" style={{ padding: '40px' }}>
          <RefreshCw size={24} className="spin" style={{ color: 'var(--primary)', marginBottom: '8px' }} />
          <p>Cargando información del proyecto...</p>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div style={{ padding: '36px', textAlign: 'center', background: 'var(--surface-container-low)', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
          <ShieldCheck size={32} color="var(--secondary)" style={{ marginBottom: '8px' }} />
          <h4 style={{ margin: '4px 0' }}>No se encontraron elementos en esta categoría</h4>
          <p style={{ fontSize: '0.84rem', color: 'var(--secondary)', margin: 0 }}>
            {statusFilter === 'PENDING_REVIEW'
              ? 'Todos los candidatos de esta categoría han sido revisados.'
              : 'Prueba cambiando los filtros seleccionados.'}
          </p>
        </div>
      ) : (
        <>
          <div className="candidates-container" style={{ marginBottom: '16px' }}>
            {viewMode === 'table' ? (
              /* VISTA TABLA COMPACTA */
              <div
                className="table-responsive"
                style={{
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-container-lowest)',
                  overflowX: 'auto',
                  maxWidth: '100%'
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-container-low)', borderBottom: '1px solid var(--border-default)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px', width: '36px' }}>
                        <input
                          type="checkbox"
                          checked={paginatedCandidates.length > 0 && paginatedCandidates.every(c => selectedIds.has(c.id))}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th style={{ padding: '10px 12px', width: '100px' }}>Código</th>
                      <th style={{ padding: '10px 12px', width: '110px' }}>Categoría</th>
                      <th style={{ padding: '10px 12px' }}>Nombre / Enunciado</th>
                      <th style={{ padding: '10px 12px', width: '120px' }}>Origen / Confianza</th>
                      <th style={{ padding: '10px 12px', width: '120px' }}>Fuente</th>
                      <th style={{ padding: '10px 12px', width: '90px' }}>Estado</th>
                      <th style={{ padding: '10px 12px', width: '140px', textAlign: 'right' }}>Acciones rápidas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCandidates.map((c) => {
                      const isSelected = selectedIds.has(c.id);
                      const isConflict = c.evidence?.relationship?.relation === 'CONFLICT';
                      const isExplicit = c.origin === 'EXPLICIT' || c.origin === 'RULE';

                      return (
                        <tr
                          key={c.id}
                          style={{
                            borderBottom: '1px solid var(--surface-container)',
                            background: isConflict
                              ? 'rgba(180, 35, 24, 0.04)'
                              : isSelected
                              ? 'rgba(41, 82, 217, 0.05)'
                              : 'transparent'
                          }}
                        >
                          <td style={{ padding: '10px 12px' }}>
                            {c.status === 'PENDING_REVIEW' && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectCandidate(c.id)}
                              />
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary)' }}>
                            {c.temporaryCode}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span className="badge badge-planning" style={{ fontSize: '0.6875rem' }}>
                              {c.categoryGroup || c.kind}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', minWidth: '220px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--on-surface)', marginBottom: '2px' }}>{c.title}</div>
                            <div
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--secondary)',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              {c.statement}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {isConflict ? (
                              <span className="badge badge-danger" style={{ fontSize: '0.6875rem' }}>
                                🔴 Conflicto
                              </span>
                            ) : isExplicit ? (
                              <span className="badge" style={{ fontSize: '0.6875rem', background: 'rgba(21, 115, 71, 0.12)', color: '#157347' }}>
                                🟢 Explícito (Regla)
                              </span>
                            ) : (
                              <span className="badge" style={{ fontSize: '0.6875rem', background: 'rgba(217, 119, 6, 0.12)', color: '#b45309' }}>
                                🟡 Inferido (IA)
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                            {c.source?.name || c.evidence?.sourceFile || 'Documento'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span
                              className="badge"
                              style={{
                                fontSize: '0.6875rem',
                                background: c.status === 'APPROVED' ? 'rgba(21, 115, 71, 0.12)' : c.status === 'REJECTED' ? 'rgba(100,100,100,0.1)' : 'rgba(0,0,0,0.06)',
                                color: c.status === 'APPROVED' ? '#157347' : c.status === 'REJECTED' ? '#666' : 'var(--on-surface)'
                              }}
                            >
                              {c.status === 'APPROVED' ? 'Aprobado ✓' : c.status === 'REJECTED' ? 'Rechazado' : 'Por revisar'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm btn-icon"
                                onClick={() => setInspectingCandidate(c)}
                                title="Ver detalle"
                              >
                                <Eye size={13} />
                              </button>
                              {c.status === 'PENDING_REVIEW' && (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm btn-icon"
                                    onClick={() => openEditModal(c)}
                                    title="Editar"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm btn-icon"
                                    onClick={() => openRejectModal(c)}
                                    title="Rechazar"
                                    style={{ color: '#b42318' }}
                                  >
                                    <XCircle size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm btn-icon"
                                    onClick={() => handleApprove(c)}
                                    title="Aprobar inmediatamente"
                                  >
                                    <Check size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* VISTA CARDS INTERACTIVAS */
              <div style={{ display: 'grid', gap: cardDensity === 'compact' ? '8px' : '12px' }}>
                {paginatedCandidates.map((candidate) => {
                  const isConflict = candidate.evidence?.relationship?.relation === 'CONFLICT';
                  const isExplicit = candidate.origin === 'EXPLICIT' || candidate.origin === 'RULE';
                  const isSelected = selectedIds.has(candidate.id);

                  return (
                    <article
                      key={candidate.id}
                      className="panel"
                      style={{
                        padding: cardDensity === 'compact' ? '10px 14px' : '14px 18px',
                        borderRadius: 'var(--radius-md)',
                        border: isConflict
                          ? '1.5px solid #b42318'
                          : isSelected
                          ? '1.5px solid var(--primary)'
                          : '1px solid var(--border-default)',
                        background: isConflict
                          ? 'rgba(180, 35, 24, 0.02)'
                          : isSelected
                          ? 'rgba(41, 82, 217, 0.02)'
                          : 'var(--surface-container-lowest)',
                        boxShadow: isConflict ? '0 2px 8px rgba(180, 35, 24, 0.06)' : 'var(--shadow-xs)'
                      }}
                    >
                      {/* Header de tarjeta */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ minWidth: 0, flex: 1, display: 'flex', gap: '10px' }}>
                          {candidate.status === 'PENDING_REVIEW' && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectCandidate(candidate.id)}
                              style={{ marginTop: '3px' }}
                            />
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: cardDensity === 'compact' ? '3px' : '5px' }}>
                              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--primary)' }}>
                                {candidate.temporaryCode}
                              </span>

                              <span className="badge badge-planning" style={{ fontSize: '0.6875rem' }}>
                                {candidate.categoryGroup || candidate.kind}
                              </span>

                              {/* Prioridad visual: Verde / Amarillo / Rojo */}
                              {isConflict ? (
                                <span className="badge badge-danger" style={{ fontSize: '0.6875rem' }}>
                                  🔴 CONFLICTO
                                </span>
                              ) : isExplicit ? (
                                <span
                                  className="badge"
                                  style={{
                                    background: 'rgba(21, 115, 71, 0.12)',
                                    color: '#157347',
                                    fontSize: '0.6875rem'
                                  }}
                                >
                                  🟢 EXPLÍCITO (REGLA)
                                </span>
                              ) : (
                                <span
                                  className="badge"
                                  style={{
                                    background: 'rgba(217, 119, 6, 0.12)',
                                    color: '#b45309',
                                    fontSize: '0.6875rem'
                                  }}
                                >
                                  🟡 INFERIDO
                                </span>
                              )}

                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.6875rem',
                                  background: candidate.status === 'APPROVED' ? 'rgba(21, 115, 71, 0.15)' : candidate.status === 'REJECTED' ? 'rgba(100, 100, 100, 0.15)' : 'rgba(0, 0, 0, 0.06)',
                                  color: candidate.status === 'APPROVED' ? '#157347' : candidate.status === 'REJECTED' ? '#666' : 'var(--on-surface)'
                                }}
                              >
                                {candidate.status === 'APPROVED' ? 'Aprobado ✓' : candidate.status === 'REJECTED' ? 'Rechazado' : 'Por revisar'}
                              </span>
                            </div>

                            <h4 style={{ margin: cardDensity === 'compact' ? '0 0 3px 0' : '0 0 5px 0', fontSize: cardDensity === 'compact' ? '0.875rem' : '0.9375rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                              {candidate.title}
                            </h4>

                            {/* Statement / Contenido */}
                            <div
                              style={{
                                padding: cardDensity === 'compact' ? '6px 10px' : '8px 12px',
                                background: 'var(--surface-container-low)',
                                borderRadius: '6px',
                                borderLeft: '3px solid var(--primary)',
                                fontSize: '0.8125rem',
                                lineHeight: '1.45',
                                color: 'var(--on-surface)',
                                display: cardDensity === 'compact' ? '-webkit-box' : 'block',
                                WebkitLineClamp: cardDensity === 'compact' ? 2 : 'unset',
                                WebkitBoxOrient: cardDensity === 'compact' ? 'vertical' : 'unset',
                                overflow: cardDensity === 'compact' ? 'hidden' : 'visible'
                              }}
                            >
                              {candidate.statement}
                            </div>

                            {/* Advertencia de conflicto si aplica */}
                            {isConflict && (
                              <div
                                style={{
                                  marginTop: '6px',
                                  padding: '6px 10px',
                                  borderRadius: '4px',
                                  background: 'rgba(180, 35, 24, 0.08)',
                                  border: '1px solid rgba(180, 35, 24, 0.3)',
                                  fontSize: '0.75rem',
                                  color: '#b42318'
                                }}
                              >
                                <strong>⚠ INFORMACIÓN EN CONFLICTO:</strong> Existe contradicción con información de otra fuente.
                              </div>
                            )}

                            {/* Proveniencia y Fuente */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                              <span>Fuente: <strong>{candidate.source?.name || candidate.evidence?.sourceFile || 'Documento'}</strong></span>
                              {candidate.evidence?.method && <span>Método: <strong>{candidate.evidence.method}</strong></span>}
                            </div>
                          </div>
                        </div>

                        {/* Botones de acción rápida: [✓ Aprobar] [✎ Editar] [✕ Rechazar] */}
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setInspectingCandidate(candidate)}
                            title="Ver detalles completos"
                            style={{ fontSize: '0.75rem' }}
                          >
                            <Eye size={13} style={{ marginRight: '4px' }} />
                            <span>Detalles</span>
                          </button>

                          {candidate.status === 'PENDING_REVIEW' && (
                            <>
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => openEditModal(candidate)}
                                title="Editar"
                                style={{ fontSize: '0.75rem' }}
                              >
                                <Edit3 size={13} style={{ marginRight: '4px' }} />
                                <span>Editar</span>
                              </button>

                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => openRejectModal(candidate)}
                                title="Rechazar"
                                style={{ fontSize: '0.75rem', color: '#b42318' }}
                              >
                                <XCircle size={14} style={{ marginRight: '4px' }} />
                                <span>Rechazar</span>
                              </button>

                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleApprove(candidate)}
                                title="Aprobar inmediatamente como información oficial"
                                style={{ fontSize: '0.75rem', fontWeight: 600 }}
                              >
                                <Check size={14} style={{ marginRight: '4px' }} />
                                <span>Aprobar</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {renderPaginationBar()}
        </>
      )}

      {/* MODAL 1: EDICIÓN RÁPIDA DE CANDIDATO */}
      {editingCandidate && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(11, 23, 48, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
          onClick={() => setEditingCandidate(null)}
        >
          <div
            className="modal-card"
            style={{
              background: 'var(--surface-container-lowest)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-xl)',
              maxWidth: '560px',
              width: '100%',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)', background: 'var(--surface-container-low)' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                Editar Candidato ({editingCandidate.temporaryCode})
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                Se conserva el texto original extraído como referencia de auditoría y trazabilidad.
              </p>
            </div>

            <form onSubmit={handleSaveEdit} style={{ padding: '18px 20px' }}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontSize: '0.8125rem' }}>Nombre / Título:</label>
                <input
                  type="text"
                  className="form-control"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontSize: '0.8125rem' }}>Descripción / Enunciado:</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={editStatement}
                  onChange={(e) => setEditStatement(e.target.value)}
                  required
                />
              </div>

              {editingCandidate.originalStatement && editingCandidate.originalStatement !== editStatement && (
                <div style={{ marginBottom: '14px', padding: '8px 10px', background: 'var(--surface-container-low)', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                  <strong>Texto original extraído:</strong> "{editingCandidate.originalStatement}"
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setEditingCandidate(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={savingEdit}
                >
                  {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRMAR RECHAZO */}
      {rejectingCandidate && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(11, 23, 48, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
          onClick={() => setRejectingCandidate(null)}
        >
          <div
            className="modal-card"
            style={{
              background: 'var(--surface-container-lowest)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-xl)',
              maxWidth: '480px',
              width: '100%',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-default)', background: 'var(--surface-container-low)' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#b42318' }}>
                Rechazar Candidato ({rejectingCandidate.temporaryCode})
              </h3>
            </div>
            <div style={{ padding: '18px 20px' }}>
              <p style={{ margin: '0 0 12px', fontSize: '0.84rem', color: 'var(--on-surface)' }}>
                ¿Deseas descartar "{rejectingCandidate.title}"? El candidato no se eliminará físicamente para preservar la auditoría documental.
              </p>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontSize: '0.8125rem' }}>Motivo de descarte (opcional):</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: Fuera del alcance acordado, redundante..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setRejectingCandidate(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleConfirmReject}
                  style={{ background: '#b42318', color: '#fff', border: 'none' }}
                >
                  Confirmar Rechazo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DETALLE COMPLETO Y ORIGEN */}
      {inspectingCandidate && (
        <CandidateDetailModal
          candidate={inspectingCandidate}
          isOpen={!!inspectingCandidate}
          onClose={() => setInspectingCandidate(null)}
          onApprove={() => {
            handleApprove(inspectingCandidate);
            setInspectingCandidate(null);
          }}
          onReject={() => {
            const cand = inspectingCandidate;
            setInspectingCandidate(null);
            openRejectModal(cand);
          }}
          onEdit={() => {
            const cand = inspectingCandidate;
            setInspectingCandidate(null);
            openEditModal(cand);
          }}
        />
      )}
    </div>
  );
}
