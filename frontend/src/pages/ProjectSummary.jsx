import React, { useState } from 'react';
import { aiApi } from '../api/ai.api';
import { projectsApi } from '../api/projects.api';
import { sourcesApi } from '../api/sources.api';
import DocumentImportModal from '../components/DocumentImportModal';

export default function ProjectSummary({ project, onProjectUpdated, onNavigateTo }) {
  const [description, setDescription] = useState(
    project.systemDescription || project.description || ''
  );
  const [state, setState] = useState('idle');
  const [errorMessage, setErrorMessage] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [pdfFiles, setPdfFiles] = useState([]);
  const [audioFile, setAudioFile] = useState(null);

  const reqCount    = project.requirements?.length ?? project._count?.requirements ?? 0;
  const actorCount  = project.actors?.length       ?? project._count?.actors       ?? 0;
  const entityCount = project.entities?.length     ?? project._count?.entities     ?? 0;
  const screenCount = project.screens?.length      ?? project._count?.screens      ?? 0;

  async function handleAnalyze() {
    if (state === 'analyzing') return;
    if (!description.trim()) {
      setState('error');
      setErrorMessage('Ingrese una descripción antes de analizar.');
      return;
    }
    try {
      setState('analyzing');
      setErrorMessage(null);
      if (pdfFiles.length) await sourcesApi.uploadPdfs(project.id, pdfFiles);
      if (audioFile) await sourcesApi.uploadAudio(project.id, audioFile);
      await projectsApi.update(project.id, {
        description: description.trim(),
        systemDescription: description.trim()
      });
      await aiApi.analyzeProject(project.id, description.trim());
      setPdfFiles([]);
      setAudioFile(null);
      setState('success');
      await onProjectUpdated();
    } catch (err) {
      setState('error');
      setErrorMessage(err.message || 'Error al procesar el análisis.');
    }
  }

  const stats = [
    { label: 'Requisitos',  value: reqCount,    desc: 'Funcionales y no funcionales', icon: 'checklist',    tab: 'requirements' },
    { label: 'Actores',     value: actorCount,  desc: 'Roles identificados',           icon: 'people',       tab: 'actors'       },
    { label: 'Entidades',   value: entityCount, desc: 'Modelo de datos E/R',           icon: 'account_tree', tab: 'model'        },
    { label: 'Pantallas',   value: screenCount, desc: 'Vistas del prototipo',           icon: 'devices',      tab: 'prototype'    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Command bar */}
      <div className="full-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 className="page-title">Resumen del Proyecto</h2>
          <div className="vdivider" />
          <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
            Análisis IA · Generación automática de artefactos
          </span>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setIsImportModalOpen(true)}
            disabled={state === 'analyzing'}
            title="Importar especificación en PDF"
          >
            <span className="ms ms-sm">upload_file</span>
            <span>Importar PDF</span>
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleAnalyze}
            disabled={state === 'analyzing' || !description.trim()}
          >
            {state === 'analyzing' ? (
              <>
                <span className="ms ms-sm spin">autorenew</span>
                <span>{pdfFiles.length || audioFile ? 'Procesando fuentes...' : 'Analizando...'}</span>
              </>
            ) : (
              <>
                <span className="ms ms-sm">play_arrow</span>
                <span>Analizar proyecto</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="page-scrollable">
        {/* Status message */}
        {state === 'success' && (
          <div className="alert alert-success">
            <span className="ms ms-sm">check_circle</span>
            <span>Análisis completado exitosamente. Los artefactos han sido generados.</span>
          </div>
        )}
        {state === 'error' && (
          <div className="alert alert-danger">
            <span className="ms ms-sm">error_outline</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Stats grid */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Artefactos Generados
          </p>
          <div className="grid-4">
            {stats.map(s => (
              <div key={s.tab} className="stat-card" onClick={() => onNavigateTo(s.tab)}>
                <div className="stat-card-header">
                  <span className="stat-card-label">{s.label}</span>
                  <span className="ms ms-sm" style={{ color: 'var(--secondary)' }}>{s.icon}</span>
                </div>
                <div className="stat-card-value">{s.value}</div>
                <div className="stat-card-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Analysis input card */}
        <div className="analysis-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-container-low)',
              border: '1px solid var(--outline-variant)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span className="ms ms-sm" style={{ color: 'var(--primary)' }}>bolt</span>
            </div>
            <div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--on-surface)', letterSpacing: '-0.01em' }}>
                Motor de Análisis Inteligente
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
                Transforma la descripción en requisitos, actores, modelo de datos y pantallas.
              </p>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">Descripción del Sistema *</label>
            <textarea
              className="form-control"
              rows={6}
              placeholder="Ejemplo: Quiero desarrollar un sistema para administrar una biblioteca. El sistema permitirá registrar libros, usuarios y préstamos. Los administradores podrán gestionar el catálogo..."
              value={description}
              disabled={state === 'analyzing'}
              onChange={(e) => {
                setDescription(e.target.value);
                if (state !== 'idle') setState('idle');
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px dashed var(--outline-variant)', borderRadius: '6px', background: 'var(--surface-container-low)', cursor: 'pointer' }}>
              <span className="ms ms-sm" style={{ color: 'var(--primary)' }}>description</span>
              <span style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', fontSize: '0.8rem' }}>Documentos PDF</strong><small style={{ color: 'var(--secondary)' }}>{pdfFiles.length ? `${pdfFiles.length} seleccionado(s)` : 'Opcional · varios archivos'}</small></span>
              <input type="file" accept="application/pdf,.pdf" multiple hidden disabled={state === 'analyzing'} onChange={event => setPdfFiles(Array.from(event.target.files || []))} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px dashed var(--outline-variant)', borderRadius: '6px', background: 'var(--surface-container-low)', cursor: 'pointer' }}>
              <span className="ms ms-sm" style={{ color: 'var(--primary)' }}>mic</span>
              <span style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', fontSize: '0.8rem' }}>Audio / entrevista</strong><small style={{ color: 'var(--secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{audioFile?.name || 'Opcional · transcripción n8n'}</small></span>
              <input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm" hidden disabled={state === 'analyzing'} onChange={event => setAudioFile(event.target.files?.[0] || null)} />
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--outline)' }}>
              {description.length} caracteres · El análisis puede tomar entre 30–120 segundos.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleAnalyze}
                disabled={state === 'analyzing' || !description.trim()}
              >
                {state === 'analyzing' ? (
                    <><span className="ms ms-sm spin">autorenew</span><span>{pdfFiles.length || audioFile ? 'Procesando fuentes...' : 'Analizando...'}</span></>
                ) : (
                  <><span className="ms ms-sm">play_arrow</span><span>Analizar proyecto</span></>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Project info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '1rem' }}>
          <div className="info-card">
            <span style={{ fontSize: '0.6875rem', color: 'var(--outline)' }}>Nombre del Proyecto</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)' }}>{project.name}</span>
          </div>
          <div className="info-card">
            <span style={{ fontSize: '0.6875rem', color: 'var(--outline)' }}>Estado</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)' }}>
              {project.status === 'IN_PROGRESS' ? 'En Progreso' : project.status === 'COMPLETED' ? 'Completado' : 'Planificación'}
            </span>
          </div>
          <div className="info-card" style={{ gridColumn: '1 / -1' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--outline)' }}>Última actualización</span>
            <span style={{ fontSize: '0.875rem', color: 'var(--on-surface)' }}>
              {new Date(project.updatedAt).toLocaleString('es', { dateStyle: 'long', timeStyle: 'short' })}
            </span>
          </div>
        </div>
      </div>

      <DocumentImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        projectId={project.id}
        onImportSuccess={onProjectUpdated}
      />
    </div>
  );
}
