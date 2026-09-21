import React from 'react';
import { Layers, FolderGit2, Sparkles, CheckSquare, Users, Database, Layout, GitFork, Cpu } from 'lucide-react';

export default function Navbar({ activeView, onViewChange, currentProject }) {
  return (
    <header className="navbar">
      <div className="nav-brand" onClick={() => onViewChange('projects')}>
        <Layers size={22} color="var(--primary)" />
        <span>ICASE</span>
        <span className="brand-badge">MVP</span>
      </div>

      <nav className="nav-links">
        <button
          className={`nav-item ${activeView === 'projects' ? 'active' : ''}`}
          onClick={() => onViewChange('projects')}
        >
          <FolderGit2 size={16} />
          <span>Proyectos</span>
        </button>

        {currentProject && (
          <>
            <button
              className={`nav-item ${activeView === 'summary' ? 'active' : ''}`}
              onClick={() => onViewChange('summary')}
            >
              <Sparkles size={16} />
              <span>Resumen</span>
            </button>
            <button
              className={`nav-item ${activeView === 'requirements' ? 'active' : ''}`}
              onClick={() => onViewChange('requirements')}
            >
              <CheckSquare size={16} />
              <span>Requisitos</span>
            </button>
            <button
              className={`nav-item ${activeView === 'actors' ? 'active' : ''}`}
              onClick={() => onViewChange('actors')}
            >
              <Users size={16} />
              <span>Actores</span>
            </button>
            <button
              className={`nav-item ${activeView === 'model' ? 'active' : ''}`}
              onClick={() => onViewChange('model')}
            >
              <Database size={16} />
              <span>Modelo</span>
            </button>
            <button
              className={`nav-item ${activeView === 'prototype' ? 'active' : ''}`}
              onClick={() => onViewChange('prototype')}
            >
              <Layout size={16} />
              <span>Prototipo</span>
            </button>
            <button
              className={`nav-item ${activeView === 'navigation' ? 'active' : ''}`}
              onClick={() => onViewChange('navigation')}
            >
              <GitFork size={16} />
              <span>Navegación</span>
            </button>
            <button
              className={`nav-item ${activeView === 'architecture' ? 'active' : ''}`}
              onClick={() => onViewChange('architecture')}
            >
              <Cpu size={16} />
              <span>Arquitectura</span>
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
