import React from 'react';
import {
  CheckCircle2,
  FileText,
  Layers,
  AlertCircle,
  ArrowRight,
  Eye,
  CheckSquare,
  Users,
  Cpu,
  GitBranch,
  Shield,
  Layout,
  Calendar,
  Database,
  Building
} from 'lucide-react';

/**
 * AnalysisCompletionModal
 * Pantalla/modal de resumen posterior al análisis de fuentes.
 * Muestra el desglose detallado de toda la información extraída (requisitos, actores, procesos,
 * reglas, tecnologías, entidades, pantallas, fechas, arquitectura, restricciones) y candidatos pendientes.
 */
export default function AnalysisCompletionModal({
  isOpen,
  onClose,
  onNavigateToReview,
  onNavigateToSummary,
  summaryData = {}
}) {
  if (!isOpen) return null;

  const {
    sourcesCount = 1,
    pdfCount = 1,
    audioCount = 0,
    totalCandidates = 0,
    requirementsCount = 0,
    actorsCount = 0,
    processesCount = 0,
    businessRulesCount = 0,
    technologiesCount = 0,
    entitiesCount = 0,
    screensCount = 0,
    datesCount = 0,
    architectureCount = 0,
    constraintsCount = 0,
    objectivesCount = 0,
    scopeCount = 0,
    explicitCount = 0,
    inferredCount = 0,
    totalPendingReview = 0,
    pendingReviewCount = 0
  } = summaryData;

  const totalPending = totalPendingReview || pendingReviewCount || totalCandidates;

  const categoryItems = [
    { label: 'Requisitos', count: requirementsCount, icon: <FileText size={14} color="#0052cc" /> },
    { label: 'Actores', count: actorsCount, icon: <Users size={14} color="#0e7490" /> },
    { label: 'Procesos', count: processesCount, icon: <GitBranch size={14} color="#7c3aed" /> },
    { label: 'Reglas de negocio', count: businessRulesCount, icon: <Shield size={14} color="#b45309" /> },
    { label: 'Tecnologías', count: technologiesCount, icon: <Cpu size={14} color="#047857" /> },
    { label: 'Entidades y datos', count: entitiesCount, icon: <Database size={14} color="#4338ca" /> },
    { label: 'Pantallas y módulos', count: screensCount, icon: <Layout size={14} color="#be185d" /> },
    { label: 'Fechas y planificación', count: datesCount, icon: <Calendar size={14} color="#0369a1" /> },
    { label: 'Arquitectura', count: architectureCount, icon: <Building size={14} color="#334155" /> },
    { label: 'Restricciones y supuestos', count: constraintsCount, icon: <AlertCircle size={14} color="#dc2626" /> },
    { label: 'Objetivos y alcance', count: (objectivesCount + scopeCount), icon: <Layers size={14} color="#475569" /> }
  ].filter(item => item.count > 0);

  return (
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
      onClick={onClose}
    >
      <div
        className="modal-card"
        style={{
          background: 'var(--surface-container-lowest)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-xl)',
          maxWidth: '580px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner superior */}
        <div
          style={{
            padding: '20px 24px 14px',
            textAlign: 'center',
            background: 'linear-gradient(180deg, rgba(21, 115, 71, 0.08) 0%, transparent 100%)',
            borderBottom: '1px solid var(--border-default)'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'rgba(21, 115, 71, 0.12)',
              color: '#157347',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px'
            }}
          >
            <CheckCircle2 size={26} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--on-surface)', margin: 0 }}>
            Análisis Completado
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '4px 0 0' }}>
            {sourcesCount} archivo(s) procesado(s) ({pdfCount} PDF, {audioCount} Audio)
          </p>
        </div>

        {/* Cuerpo del modal con scroll si es necesario */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Información encontrada ({totalCandidates} elementos)
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
              marginBottom: '16px'
            }}
          >
            {categoryItems.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-container-low)',
                  border: '1px solid var(--border-default)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {item.icon}
                  <span style={{ fontSize: '0.8125rem', color: 'var(--on-surface)', fontWeight: 500 }}>
                    {item.label}
                  </span>
                </div>
                <strong style={{ fontSize: '0.875rem', color: 'var(--primary)' }}>
                  {item.count}
                </strong>
              </div>
            ))}
          </div>

          {/* Caja destacada de pendientes */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(217, 119, 6, 0.08)',
              border: '1px solid rgba(217, 119, 6, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b45309', fontWeight: 600, fontSize: '0.875rem' }}>
                <AlertCircle size={16} />
                <span>Información pendiente de revisión</span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                Ningún candidato se promovió a oficial automáticamente. Se requiere tu aprobación.
              </p>
            </div>
            <strong style={{ fontSize: '1.5rem', color: '#b45309', marginLeft: '12px' }}>
              {totalPending}
            </strong>
          </div>
        </div>

        {/* Pie de acciones */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-default)',
            background: 'var(--surface-container-low)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
          >
            Revisar después
          </button>

          <button
            type="button"
            className="btn btn-primary btn-md"
            onClick={() => {
              onClose();
              onNavigateToReview?.();
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span>Revisar ahora ({totalPending})</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
