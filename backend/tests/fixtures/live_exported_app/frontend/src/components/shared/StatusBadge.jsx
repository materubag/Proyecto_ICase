import React from 'react';

/**
 * Badge de Estado Semántico Ligero según DESIGN_SYSTEM.md (Sección 4.3)
 */
export default function StatusBadge({ status = 'info', label }) {
  let bg = '#eff6ff';
  let text = '#1d4ed8';
  let dot = '#3b82f6';

  const s = String(status).toLowerCase();
  if (s.includes('succ') || s.includes('aprob') || s.includes('complet') || s.includes('confirm') || s.includes('act')) {
    bg = 'var(--status-success-bg, #f0fdf4)';
    text = 'var(--status-success, #16a34a)';
    dot = '#16a34a';
  } else if (s.includes('warn') || s.includes('pend') || s.includes('proc') || s.includes('revis')) {
    bg = 'var(--status-warning-bg, #fffbeb)';
    text = 'var(--status-warning, #d97706)';
    dot = '#d97706';
  } else if (s.includes('dang') || s.includes('err') || s.includes('rech') || s.includes('canc')) {
    bg = 'var(--status-danger-bg, #fef2f2)';
    text = 'var(--status-danger, #dc2626)';
    dot = '#dc2626';
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      borderRadius: 'var(--radius-sm)',
      backgroundColor: bg,
      color: text,
      fontSize: '0.75rem',
      fontWeight: 500,
      border: '1px solid rgba(0,0,0,0.05)'
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dot }} />
      <span>{label || status}</span>
    </span>
  );
}
