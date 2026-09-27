import React, { useState, useEffect } from 'react';
import { engineering } from '../api/engineering.api';
import { aiApi } from '../api/ai.api';
import { projectsApi } from '../api/projects.api';
import { sourcesApi } from '../api/sources.api';
import DocumentImportModal from '../components/DocumentImportModal';

export default function ProjectSummary({ project, onProjectUpdated, onNavigateTo }) {
  const [engineeringStats, setEngineeringStats] = useState(null);
  const [sources, setSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(false);

  async function loadSources() {
    try {
      setLoadingSources(true);
      const res = await sourcesApi.list(project.id);
      setSources(res || []);
    } catch {
      setSources([]);
    } finally {
      setLoadingSources(false);
    }
  }

  useEffect(() => {
    engineering(project.id).then(setEngineeringStats).catch(() => setEngineeringStats(null));
    loadSources();
  }, [project.id, project.updatedAt]);
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
        {engineeringStats && <div className="grid-4" style={{ marginBottom: 20 }}>{[
          ['Fuentes', engineeringStats.sources.length],
          ['RF aprobados', engineeringStats.Requirement.filter(r => r.status === 'APPROVED' && r.type === 'FUNCTIONAL').length],
          ['RNF aprobados', engineeringStats.Requirement.filter(r => r.status === 'APPROVED' && r.type === 'NON_FUNCTIONAL').length],
          ['Casos de uso', engineeringStats.UseCase.filter(r => r.status === 'APPROVED').length],
          ['Diagramas', engineeringStats.Artifact.filter(a => a.type !== 'MOCKUP').length],
          ['Mockups', engineeringStats.Artifact.filter(a => a.type === 'MOCKUP').length],
          ['Cambios pendientes', engineeringStats.changes.filter(c => c.status === 'PENDING_APPROVAL').length],
          ['OUTDATED', ['Actor', 'UseCase', 'Entity', 'NavigationNode', 'Architecture', 'Artifact'].flatMap(t => engineeringStats[t]).filter(x => x.status === 'OUTDATED').length],
          ['Requisitos sin cobertura completa', engineeringStats.matrix.filter(r => r.missing.length).length]
        ].map(([label, value]) => <div className="stat-card" key={label}><span>{label}</span><strong className="stat-card-value">{value}</strong></div>)}</div>}
        {/* Status message */}
        {state === 'success' && (
          <div className="alert alert-success">
            <span className="ms ms-sm">check_circle</span>
            <span>Análisis completado. Revisa y aprueba los candidatos antes de generar modelos.</span>
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
              <input
                type="file"
                accept="application/pdf,.pdf"
                multiple
                hidden
                disabled={state === 'analyzing'}
                onChange={event => {
                  const files = Array.from(event.target.files || []);
                  const invalid = files.filter(f => !f.name.toLowerCase().endsWith('.pdf'));
                  if (invalid.length > 0) {
                    const audioExts = ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.aac', '.flac', '.mp4'];
                    const hasAudio = invalid.some(f => audioExts.some(ext => f.name.toLowerCase().endsWith(ext)));
                    setState('error');
                    setErrorMessage(hasAudio
                      ? `Has seleccionado un archivo de audio en la opción de PDF ("${invalid.map(f => f.name).join(', ')}"). Utiliza la opción de "Audio / entrevista".`
                      : `Solo se permiten archivos PDF. Archivo no válido: "${invalid.map(f => f.name).join(', ')}".`);
                  }
                  setPdfFiles(files.filter(f => f.name.toLowerCase().endsWith('.pdf')));
                }}
              />
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

        {/* Uploaded Documents & Audio Sources Section */}
        <div className="analysis-card" style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-container-low)',
                border: '1px solid var(--outline-variant)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="ms ms-sm" style={{ color: 'var(--primary)' }}>folder_open</span>
              </div>
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--on-surface)', letterSpacing: '-0.01em', margin: 0 }}>
                  Documentos y Fuentes Subidas ({sources.length})
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--secondary)', margin: '2px 0 0' }}>
                  Archivos PDF de especificaciones y audios de entrevistas vinculados a este proyecto.
                </p>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={loadSources} disabled={loadingSources}>
              <span className={`ms ms-xs ${loadingSources ? 'spin' : ''}`}>refresh</span>
              <span>Actualizar fuentes</span>
            </button>
          </div>

          {sources.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', border: '1px dashed var(--outline-variant)', borderRadius: 'var(--radius-md)', background: 'var(--surface-container-lowest)' }}>
              <span className="ms ms-lg" style={{ color: 'var(--outline)', display: 'block', marginBottom: '8px' }}>cloud_upload</span>
              <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--on-surface)', margin: 0 }}>No hay documentos ni audios subidos aún.</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--secondary)', margin: '4px 0 0' }}>
                Selecciona tus archivos PDF o audios arriba y haz clic en <strong>"Analizar proyecto"</strong> para procesarlos.
              </p>
            </div>
          ) : (
            <div style={{ background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline-variant)', overflowX: 'auto', boxShadow: 'var(--shadow-xs)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-container-low)', borderBottom: '1px solid var(--outline-variant)', color: 'var(--on-surface-variant)' }}>
                    <th style={{ padding: '8px 12px', width: '50px' }}>Tipo</th>
                    <th style={{ padding: '8px 12px' }}>Nombre del Archivo</th>
                    <th style={{ padding: '8px 12px', width: '90px' }}>Tamaño</th>
                    <th style={{ padding: '8px 12px', width: '130px' }}>Estado</th>
                    <th style={{ padding: '8px 12px', width: '130px' }}>Fecha Subida</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map(src => {
                    const isAudio = src.type === 'AUDIO' || (src.mimeType && src.mimeType.startsWith('audio'));
                    const sizeStr = src.fileSize ? `${(src.fileSize / 1024).toFixed(1)} KB` : '—';
                    return (
                      <tr key={src.id} style={{ borderBottom: '1px solid var(--outline-variant)' }}>
                        <td style={{ padding: '8px 12px' }}>
                          <span className="ms ms-sm" style={{ color: isAudio ? '#9333ea' : '#dc2626' }}>
                            {isAudio ? 'mic' : 'picture_as_pdf'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--on-surface)' }}>
                          {src.name}
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--secondary)' }}>
                          {sizeStr}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span className={`badge ${
                            src.status === 'ANALYZED' || src.status === 'TRANSCRIBED' ? 'badge-success' :
                            src.status === 'TRANSCRIBING' || src.status === 'PENDING' ? 'badge-warning' : 'badge-neutral'
                          }`} style={{ fontSize: '0.6875rem' }}>
                            {src.status === 'TRANSCRIBED' ? 'Transcrito' :
                             src.status === 'ANALYZED' ? 'Analizado' :
                             src.status === 'TRANSCRIBING' ? 'Transcribiendo...' :
                             src.status === 'EXTRACTED' ? 'Texto Extraído' : src.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', color: 'var(--secondary)', fontSize: '0.75rem' }}>
                          {new Date(src.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
