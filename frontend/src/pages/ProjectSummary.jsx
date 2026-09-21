import React, { useState } from 'react';
import { Sparkles, Play, CheckCircle, AlertCircle, FileText, Users, Database, Layout, Loader2, FileUp } from 'lucide-react';
import { aiApi } from '../api/ai.api';
import { projectsApi } from '../api/projects.api';
import DocumentImportModal from '../components/DocumentImportModal';

export default function ProjectSummary({ project, onProjectUpdated, onNavigateTo }) {
  const [description, setDescription] = useState(
    project.systemDescription || project.description || ''
  );
  // Estados claros: 'idle' | 'analyzing' | 'success' | 'error'
  const [state, setState] = useState('idle');
  const [errorMessage, setErrorMessage] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const reqCount = project.requirements?.length ?? project._count?.requirements ?? 0;
  const actorCount = project.actors?.length ?? project._count?.actors ?? 0;
  const entityCount = project.entities?.length ?? project._count?.entities ?? 0;
  const screenCount = project.screens?.length ?? project._count?.screens ?? 0;

  async function handleAnalyze() {
    if (state === 'analyzing') return; // Evitar múltiples solicitudes simultáneas

    if (!description.trim()) {
      setState('error');
      setErrorMessage('Por favor ingrese o mantenga una descripción del proyecto antes de analizar.');
      return;
    }

    try {
      setState('analyzing');
      setErrorMessage(null);

      // 1. Guardar la descripción en el proyecto primero
      await projectsApi.update(project.id, {
        description: description.trim(),
        systemDescription: description.trim()
      });

      // 2. Invocar análisis inteligente (el backend procesa con el proveedor configurado)
      await aiApi.analyzeProject(project.id, description.trim());

      setState('success');
      await onProjectUpdated();
    } catch (err) {
      console.error('[Analyze Error]:', err);
      setState('error');
      setErrorMessage(err.message || 'Ocurrió un error al procesar el análisis del proyecto.');
    }
  }

  return (
    <div>
      {/* Sección Análisis del Proyecto */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <Sparkles size={20} color="var(--primary)" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Análisis del proyecto</h2>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          Ingrese la especificación narrativa o requerimientos de negocio. El motor de análisis transformará la descripción en requisitos, actores, modelo de datos, pantallas, navegación y arquitectura. También puede importar directamente un documento técnico en formato PDF.
        </p>

        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600 }}>
            Descripción del proyecto *
          </label>
          <textarea
            className="form-control"
            rows={5}
            placeholder="Ejemplo: Quiero desarrollar un sistema para administrar una biblioteca. El sistema permitirá registrar libros, usuarios y préstamos..."
            value={description}
            disabled={state === 'analyzing'}
            onChange={(e) => {
              setDescription(e.target.value);
              if (state !== 'idle') setState('idle');
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem' }}>
          <div>
            {state === 'success' && (
              <span style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem' }}>
                <CheckCircle size={16} />
                Análisis completado
              </span>
            )}
            {state === 'error' && (
              <span style={{ color: 'var(--danger)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem' }}>
                <AlertCircle size={16} />
                {errorMessage}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setIsImportModalOpen(true)}
              disabled={state === 'analyzing'}
              title="Cargar propuesta técnica o especificación en PDF"
            >
              <FileUp size={14} />
              <span>Importar documento PDF</span>
            </button>

            <button
              className="btn btn-primary"
              onClick={handleAnalyze}
              disabled={state === 'analyzing' || !description.trim()}
            >
              {state === 'analyzing' ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Loader2 size={14} className="spin" />
                  Analizando...
                </span>
              ) : (
                <>
                  <Play size={14} />
                  <span>Analizar proyecto</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Resumen Real de Elementos */}
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.85rem', color: 'var(--text-main)' }}>
          Resumen Estructurado del Proyecto
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div
            className="card"
            style={{ cursor: 'pointer', transition: 'border-color 0.15s ease' }}
            onClick={() => onNavigateTo('requirements')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Requisitos</span>
              <FileText size={18} color="var(--primary)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {reqCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Requisitos funcionales y no funcionales
            </div>
          </div>

          <div
            className="card"
            style={{ cursor: 'pointer', transition: 'border-color 0.15s ease' }}
            onClick={() => onNavigateTo('actors')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Actores</span>
              <Users size={18} color="var(--primary)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {actorCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Roles identificados en el sistema
            </div>
          </div>

          <div
            className="card"
            style={{ cursor: 'pointer', transition: 'border-color 0.15s ease' }}
            onClick={() => onNavigateTo('model')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Entidades</span>
              <Database size={18} color="var(--primary)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {entityCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Entidades del modelo de datos E/R
            </div>
          </div>

          <div
            className="card"
            style={{ cursor: 'pointer', transition: 'border-color 0.15s ease' }}
            onClick={() => onNavigateTo('prototype')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Pantallas</span>
              <Layout size={18} color="var(--primary)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {screenCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Vistas declarativas en el prototipo
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Importación de Documentos PDF */}
      <DocumentImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        projectId={project.id}
        onImportSuccess={onProjectUpdated}
      />
    </div>
  );
}
