import React from 'react';
import {
  ShieldCheck,
  FileText,
  FileAudio,
  CheckCircle2,
  XCircle,
  Edit3,
  AlertTriangle,
  X,
  Tag,
  Check
} from 'lucide-react';

/**
 * CandidateDetailModal
 * In-depth review modal for a candidate requirement before human approval.
 * Shows where the requirement originated, its evidence snippet, and ISO 29148 assessment.
 */
export default function CandidateDetailModal({
  candidate,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onEdit
}) {
  if (!isOpen || !candidate) return null;

  const quality = candidate.qualityReport || {};
  const evidence = candidate.evidence || {};
  const isAudio = candidate.source?.type === 'AUDIO';
  const isConflict = evidence.relationship?.relation === 'CONFLICT';
  const isDuplicate = evidence.relationship?.relation === 'DUPLICATE';

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
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-default)',
            background: 'var(--surface-container-low)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '0.875rem',
                color: 'var(--primary)',
                background: 'var(--surface-container)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-xs)'
              }}
            >
              {candidate.temporaryCode}
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              Detalle & Origen del Candidato
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Title & Statement */}
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--on-surface)', margin: '0 0 6px' }}>
              {candidate.title}
            </h3>
            <p
              style={{
                fontSize: '0.875rem',
                lineHeight: 1.5,
                color: 'var(--on-surface)',
                background: 'var(--surface-container-low)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                margin: 0
              }}
            >
              {candidate.statement}
            </p>
          </div>

          {/* Badges / Metadata */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span className="badge badge-planning" style={{ fontSize: '0.75rem' }}>
              {candidate.type === 'FUNCTIONAL' ? 'Requisito Funcional' : 'No Funcional'}
            </span>
            <span className="badge badge-planning" style={{ fontSize: '0.75rem' }}>
              Prioridad: {candidate.priority === 'HIGH' ? 'Alta' : candidate.priority === 'LOW' ? 'Baja' : 'Media'}
            </span>
            {candidate.isExplicit ? (
              <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                100% Determinista (Por Código)
              </span>
            ) : (
              <span className="badge badge-in-progress" style={{ fontSize: '0.75rem' }}>
                Inferido Semánticamente
              </span>
            )}
            {candidate.qualityScore && (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: candidate.qualityScore > 80 ? '#157347' : '#9a6700',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-container-low)'
                }}
              >
                Calidad ISO: {candidate.qualityScore}/100
              </span>
            )}
          </div>

          {/* Origin & Evidence */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              background: 'var(--surface-container-low)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--secondary)' }}>
              {isAudio ? <FileAudio size={16} /> : <FileText size={16} />}
              <strong style={{ fontSize: '0.8125rem' }}>Fuente de Origen</strong>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface)', margin: '0 0 6px' }}>
              Documento: <strong>{candidate.source?.name || 'Fuente no especificada'}</strong>
            </p>

            {(evidence.rawTextSnippet || evidence.text || evidence.snippet) && (
              <div style={{ marginTop: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--outline)', display: 'block', marginBottom: '4px' }}>
                  Fragmento / Evidencia textual extraída:
                </span>
                <blockquote
                  style={{
                    margin: 0,
                    padding: '8px 12px',
                    borderLeft: '3px solid var(--primary)',
                    background: 'var(--surface-container-lowest)',
                    fontSize: '0.8125rem',
                    fontStyle: 'italic',
                    color: 'var(--on-surface-variant)'
                  }}
                >
                  "{evidence.rawTextSnippet || evidence.text || evidence.snippet}"
                </blockquote>
              </div>
            )}
          </div>

          {/* Conflicts or Duplicates alert if present */}
          {(isConflict || isDuplicate) && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: isConflict ? 'rgba(180, 35, 24, 0.08)' : 'rgba(154, 103, 0, 0.08)',
                border: `1px solid ${isConflict ? '#b42318' : '#9a6700'}`,
                color: isConflict ? '#b42318' : '#9a6700',
                fontSize: '0.8125rem'
              }}
            >
              <strong>{isConflict ? 'Conflicto potencial detectado: ' : 'Posible duplicidad: '}</strong>
              <span>{evidence.relationship?.reason || 'Revisar relación con otros requisitos existentes.'}</span>
            </div>
          )}

          {/* ISO 29148 Assessment Checklist */}
          {quality.checklist && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                background: 'var(--surface-container-lowest)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--primary)' }}>
                <ShieldCheck size={16} />
                <strong style={{ fontSize: '0.8125rem' }}>Criterios de Calidad ISO/IEC/IEEE 29148</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                {Object.entries(quality.checklist).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                    {val ? (
                      <Check size={14} style={{ color: '#157347' }} />
                    ) : (
                      <AlertTriangle size={14} style={{ color: '#9a6700' }} />
                    )}
                    <span style={{ color: val ? 'var(--on-surface)' : 'var(--secondary)' }}>
                      {key}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-default)',
            background: 'var(--surface-container-low)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
          >
            Cerrar
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                onClose();
                onEdit?.(candidate);
              }}
            >
              <Edit3 size={14} />
              <span>Editar</span>
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => {
                onClose();
                onReject?.(candidate);
              }}
            >
              <XCircle size={14} />
              <span>Rechazar</span>
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                onClose();
                onApprove?.(candidate);
              }}
            >
              <CheckCircle2 size={14} />
              <span>Aprobar Requisito Oficial</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
