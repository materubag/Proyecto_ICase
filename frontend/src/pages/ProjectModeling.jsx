import React, { useState } from 'react';
import ProjectModel from './ProjectModel';
import ProjectUseCases from './ProjectUseCases';

export default function ProjectModeling({ project, onProjectUpdated }) {
  const [activeSubTab, setActiveSubTab] = useState('er'); // 'er' | 'usecases' | 'classes'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: '#FFFFFF', padding: '32px 40px' }}>
      {/* Mockup Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Modelado
            </h1>
            <span style={{
              background: '#EEF2FF',
              color: '#4F46E5',
              border: '1px solid #E0E7FF',
              fontSize: '0.75rem',
              fontWeight: 500,
              padding: '2px 10px',
              borderRadius: '9999px'
            }}>
              E/R & Clases
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: '6px 0 0 0' }}>
            Modelos estructurados de datos, entidades y casos de uso del sistema.
          </p>
        </div>

        {/* Capsule Switcher */}
        <div style={{
          display: 'inline-flex',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          padding: '3px',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
        }}>
          {[
            ['er', 'Entidad–Relación'],
            ['classes', 'Clases (POO)'],
            ['usecases', 'Casos de Uso']
          ].map(([tabKey, label]) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveSubTab(tabKey)}
              style={{
                background: activeSubTab === tabKey ? '#0F172A' : 'transparent',
                color: activeSubTab === tabKey ? '#FFFFFF' : '#64748B',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 16px',
                fontSize: '0.8125rem',
                fontWeight: activeSubTab === tabKey ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-view content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {activeSubTab === 'er' && (
          <ProjectModel
            project={project}
            onProjectUpdated={onProjectUpdated}
            initialTab="er"
            hideInternalTabs={true}
          />
        )}
        {activeSubTab === 'usecases' && (
          <ProjectUseCases
            project={project}
            onProjectUpdated={onProjectUpdated}
          />
        )}
        {activeSubTab === 'classes' && (
          <ProjectModel
            project={project}
            onProjectUpdated={onProjectUpdated}
            initialTab="classes"
            hideInternalTabs={true}
          />
        )}
      </div>
    </div>
  );
}
