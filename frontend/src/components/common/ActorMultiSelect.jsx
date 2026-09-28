import React, { useState, useRef, useEffect } from 'react';

/**
 * Reusable searchable multi-select component for system actors.
 * Stores and emits real actor IDs/references (e.g. ['actor-uuid-1', 'ACT-01']).
 */
export default function ActorMultiSelect({
  actors = [],
  selectedIds = [],
  onChange,
  disabled = false,
  label = 'Actores relacionados',
  placeholder = 'Buscar actor por nombre o código...'
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedSet = new Set(selectedIds || []);

  // Filter available actors
  const filteredActors = actors.filter(actor => {
    const actorId = actor.id || actor.codeId;
    if (selectedSet.has(actorId) || selectedSet.has(actor.codeId) || selectedSet.has(actor.name)) {
      return false;
    }
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (actor.name || '').toLowerCase().includes(q) ||
      (actor.codeId || '').toLowerCase().includes(q) ||
      (actor.description || '').toLowerCase().includes(q)
    );
  });

  const handleSelect = (actor) => {
    const actorRef = actor.id || actor.codeId;
    if (!selectedSet.has(actorRef)) {
      const next = [...(selectedIds || []), actorRef];
      onChange(next);
    }
    setQuery('');
  };

  const handleRemove = (actorRef, e) => {
    e.stopPropagation();
    const next = (selectedIds || []).filter(id => id !== actorRef);
    onChange(next);
  };

  // Find actor display details for selected IDs
  const selectedActorObjects = (selectedIds || []).map(ref => {
    const match = actors.find(a => a.id === ref || a.codeId === ref || a.name === ref);
    return {
      ref,
      name: match ? match.name : ref,
      codeId: match?.codeId || null
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
        {selectedActorObjects.map(item => (
          <span
            key={item.ref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--primary-container, #e0e7ff)',
              color: 'var(--on-primary-container, #1e1b4b)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.8125rem',
              fontWeight: 500
            }}
          >
            {item.codeId && (
              <span style={{ fontSize: '0.6875rem', opacity: 0.75, fontWeight: 700 }}>
                {item.codeId}
              </span>
            )}
            <span>{item.name}</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => handleRemove(item.ref, e)}
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
                title="Quitar actor"
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
            placeholder={selectedActorObjects.length === 0 ? placeholder : ''}
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
          {filteredActors.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              {query.trim() ? 'No se encontraron actores coincidentes' : 'Todos los actores ya han sido seleccionados'}
            </div>
          ) : (
            filteredActors.map(actor => (
              <div
                key={actor.id || actor.codeId}
                onClick={() => handleSelect(actor)}
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
                {actor.codeId && (
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      backgroundColor: 'var(--surface-container-high, #e2e8f0)',
                      padding: '1px 5px',
                      borderRadius: '3px'
                    }}
                  >
                    {actor.codeId}
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{actor.name}</div>
                  {actor.description && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {actor.description}
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
