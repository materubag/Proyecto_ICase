import React from 'react';

export default function TopHeader({ projectName, currentView, onBack }) {
  return (
    <header className="top-header">
      {/* Breadcrumb */}
      <div className="header-breadcrumb">
        {projectName ? (
          <>
            <span
              className="breadcrumb-text"
              style={{ cursor: 'pointer' }}
              onClick={onBack}
            >
              {projectName}
            </span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{currentView}</span>
          </>
        ) : (
          <span className="breadcrumb-current">{currentView}</span>
        )}
      </div>

      {/* Actions */}
      <div className="header-actions">
        {/* Search */}
        <div className="header-search">
          <span className="ms">search</span>
          <input type="text" placeholder="Buscar..." />
          <div className="header-search-kbd">
            <kbd>⌘K</kbd>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button className="header-btn" type="button">
            <span className="ms ms-sm">file_upload</span>
            <span>Exportar</span>
          </button>
          <button className="header-btn header-btn-icon" type="button" title="Configuración">
            <span className="ms">settings</span>
          </button>
        </div>

        {/* Avatar */}
        <div className="header-avatar" title="Usuario">
          <span>IC</span>
        </div>
      </div>
    </header>
  );
}
