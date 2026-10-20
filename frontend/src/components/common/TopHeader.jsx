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
          style={{
            cursor: onBack ? 'pointer' : 'default',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #4d8df7, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: '0.8125rem'
          }}
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
              padding: '5px 12px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(77, 141, 247, 0.1)',
              border: '1px solid rgba(77, 141, 247, 0.2)',
              color: 'var(--primary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: onActivityClick ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              boxShadow: '0 0 12px rgba(77, 141, 247, 0.1)'
            }}
            title="Ver progreso de procesamiento"
          >
            <RefreshCw size={12} className="spin" />
            <span>{activeActivity.label}</span>
            {activeActivity.progress && (
              <span style={{ opacity: 0.7, fontWeight: 400, fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>
                ({activeActivity.progress})
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
