import React, { useState, useRef, useEffect } from 'react';

/**
 * Reusable searchable multi-select component for requirement dependencies.
 * Prevents self-dependencies, duplicate entries, and guarantees valid references.
 */
export default function RequirementMultiSelect({
  requirements = [],
  selectedCodes = [],
  onChange,
  currentCode = null,
  currentId = null,
  disabled = false,
  label = 'Dependencias del Requisito',
  placeholder = 'Buscar requisito por código o nombre...'
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedSet = new Set(selectedCodes || []);

  // Filter available requirements: exclude self and already selected
  const availableRequirements = requirements.filter(req => {
    // 1. Exclude self
    if (currentCode && req.code === currentCode) return false;
    if (currentId && req.id === currentId) return false;

    // 2. Exclude already selected
    if (selectedSet.has(req.code) || selectedSet.has(req.id)) return false;

    // 3. Search query
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (req.code || '').toLowerCase().includes(q) ||
      (req.name || '').toLowerCase().includes(q) ||
      (req.description || '').toLowerCase().includes(q)
    );
  });

  const handleSelect = (req) => {
    const code = req.code || req.id;
    if (!selectedSet.has(code)) {
      const next = [...(selectedCodes || []), code];
      onChange(next);
    }
    setQuery('');
  };

  const handleRemove = (code, e) => {
    e.stopPropagation();
    const next = (selectedCodes || []).filter(c => c !== code);
    onChange(next);
  };

  // Find details for selected codes
  const selectedObjects = (selectedCodes || []).map(code => {
    const match = requirements.find(r => r.code === code || r.id === code);
    return {
      code,
      name: match ? match.name : code,
      type: match?.type || 'FUNCTIONAL'
    };
  });

  return (
    <div className="form-group" ref={containerRef} style={{ position: 'relative' }}>
      {label && <label className="form-label">{label}</label>}

      {/* Selected tags */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          padding: '6px 8px',
          minHeight: '38px',
          border: '1px solid var(--outline-variant)',
          borderRadius: 'var(--radius-sm, 6px)',
          backgroundColor: disabled ? 'var(--surface-container-highest)' : 'var(--surface)',
          cursor: disabled ? 'not-allowed' : 'text'
        }}
        onClick={() => !disabled && setIsOpen(true)}
      >
        {selectedObjects.map(item => (
          <span
            key={item.code}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--secondary-container, #f1f5f9)',
              color: 'var(--on-secondary-container, #0f172a)',
              border: '1px solid var(--outline-variant, #cbd5e1)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.8125rem',
              fontWeight: 500
            }}
          >
            <code style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>
              {item.code}
            </code>
            <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.name}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => handleRemove(item.code, e)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '1rem',
                  lineHeight: 1,
                  color: 'inherit',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Quitar dependencia"
              >
                ×
              </button>
            )}
          </span>
        ))}

        {/* Search input */}
        {!disabled && (
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={selectedObjects.length === 0 ? placeholder : ''}
            style={{
              flex: 1,
              minWidth: '120px',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '0.8125rem',
              color: 'var(--on-surface)'
            }}
          />
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            marginTop: '4px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--outline-variant)',
            borderRadius: '6px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
            maxHeight: '220px',
            overflowY: 'auto'
          }}
        >
          {availableRequirements.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              {query.trim() ? 'No se encontraron requisitos coincidentes' : 'No hay más requisitos disponibles'}
            </div>
          ) : (
            availableRequirements.map(req => (
              <div
                key={req.id || req.code}
                onClick={() => handleSelect(req)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderBottom: '1px solid var(--outline-variant, #f1f5f9)',
                  fontSize: '0.8125rem',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-container-low, #f8fafc)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    backgroundColor: req.type === 'NON_FUNCTIONAL' ? '#fef3c7' : '#e0e7ff',
                    color: req.type === 'NON_FUNCTIONAL' ? '#92400e' : '#3730a3',
                    padding: '1px 6px',
                    borderRadius: '3px'
                  }}
                >
                  {req.code}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{req.name}</div>
                  {req.description && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {req.description}
                    </div>
                  )}
                </div>
                <span className="ms ms-xs" style={{ color: 'var(--primary)' }}>add</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
