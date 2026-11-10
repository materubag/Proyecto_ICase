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
  // If inside a project and no global activity is running, keep layout clean matching the mockup
  if (projectName && !activeActivity) {
    return null;
  }

  return (
    <header className="top-header" style={{ background: '#FFFFFF', borderBottom: '1px solid #F1F5F9', padding: '8px 24px' }}>
      {/* Left: Breadcrumb / Current Context */}
      <div className="header-breadcrumb">
        <span
          className="breadcrumb-text breadcrumb-brand"
          style={{ cursor: onBack ? 'pointer' : 'default', fontWeight: 600, color: 'var(--primary)' }}
          onClick={onBack || undefined}
          title="ICASE Studio"
        >
          iCASE Studio
        </span>

        {projectName && (
          <>
            <span className="breadcrumb-sep" style={{ color: '#CBD5E1' }}>/</span>
            <span
              className="breadcrumb-text"
              style={{ cursor: onBack ? 'pointer' : 'default', fontWeight: 500, color: '#475569' }}
              onClick={onBack || undefined}
              title={`Volver a ${projectName}`}
            >
              {projectName}
            </span>
          </>
        )}

        <span className="breadcrumb-sep" style={{ color: '#CBD5E1' }}>/</span>
        <span className="breadcrumb-current" style={{ fontWeight: 600, color: '#0F172A' }}>{currentView}</span>
      </div>

      {/* Right: Global Activity Pill */}
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
              padding: '4px 12px',
              borderRadius: '9999px',
              background: '#EEF2FF',
              border: '1px solid #E0E7FF',
              color: '#4F46E5',
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
