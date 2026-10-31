import React from 'react';

/**
 * Campo de Entrada estandarizado según DESIGN_SYSTEM.md (Sección 4.1)
 */
export default function FormField({ label, name, type = 'text', value, onChange, placeholder, required = false, error = null }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      {label && (
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-body)', marginBottom: '6px' }}>
          {label} {required && <span style={{ color: 'var(--status-danger)' }}>*</span>}
        </label>
      )}
      <input
        type={type}
        name={name}
        id={name}
        value={value !== undefined && value !== null ? value : ''}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%',
          height: '44px',
          padding: '0 14px',
          borderRadius: 'var(--radius-md)',
          border: error ? '1px solid var(--status-danger)' : '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          fontSize: '0.875rem',
          color: 'var(--color-text-title)',
          outline: 'none',
          boxSizing: 'border-box'
        }}
      />
      {error && (
        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--status-danger)', marginTop: '4px' }}>
          {error}
        </span>
      )}
    </div>
  );
}
