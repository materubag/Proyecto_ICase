import React from 'react';

/**
 * Botón Minimalista estandarizado según DESIGN_SYSTEM.md (Sección 4.2)
 */
export default function Button({ children, onClick, type = 'button', variant = 'primary', disabled = false, fullWidth = false }) {
  const isPrimary = variant === 'primary';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: fullWidth ? '100%' : 'auto',
        height: '44px',
        padding: '0 20px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: isPrimary ? 'var(--color-primary)' : 'var(--color-surface)',
        color: isPrimary ? '#ffffff' : 'var(--color-text-body)',
        border: isPrimary ? 'none' : '1px solid var(--color-border)',
        fontSize: '0.875rem',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.15s ease',
        boxSizing: 'border-box'
      }}
    >
      {children}
    </button>
  );
}
