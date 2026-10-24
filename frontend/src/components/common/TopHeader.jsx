import React from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * TopHeader
 * Minimal, focused header providing breadcrumb context and active project activity indicators.
 * Global fake search, unused export/settings/avatar buttons have been removed.
 */
export default function TopHeader({
  projectName,
  currentView,
  onBack,
  activeActivity = null,
  onActivityClick = null
}) {
  return (
    <header className="top-header">
      {/* Left: Breadcrumb / Current Context */}
      <div className="header-breadcrumb">
        <span
          className="breadcrumb-text breadcrumb-brand"
          style={{ cursor: onBack ? 'pointer' : 'default', fontWeight: 600, color: 'var(--primary)' }}
          onClick={onBack || undefined}
          title="ICASE Studio"
        >
          ICASE Studio
        </span>

        {projectName && (
          <>
            <span className="breadcrumb-sep">/</span>
            <span
              className="breadcrumb-text"
              style={{ cursor: onBack ? 'pointer' : 'default', fontWeight: 500 }}
              onClick={onBack || undefined}
              title={`Volver a ${projectName}`}
            >
              {projectName}
            </span>
          </>
        )}

        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{currentView}</span>
      </div>

      {/* Right: Real Functional Actions & Global Activity Pill */}
      <div className="header-actions">
        {activeActivity && (
          <button
            type="button"
            className="global-activity-pill"
            onClick={onActivityClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(41, 82, 217, 0.1)',
              border: '1px solid rgba(41, 82, 217, 0.25)',
              color: 'var(--primary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: onActivityClick ? 'pointer' : 'default'
            }}
            title="Ver progreso de procesamiento"
          >
            <RefreshCw size={12} className="spin" />
            <span>{activeActivity.label}</span>
            {activeActivity.progress && (
              <span style={{ opacity: 0.8, fontWeight: 400 }}>({activeActivity.progress})</span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
