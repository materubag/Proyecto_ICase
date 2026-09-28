import React, { useState, useEffect } from 'react';
import { engineering } from '../api/engineering.api';
import { aiApi } from '../api/ai.api';
import { projectsApi } from '../api/projects.api';
import { sourcesApi } from '../api/sources.api';
import { candidatesApi } from '../api/candidates.api';
import DocumentImportModal from '../components/DocumentImportModal';
import AnalysisCompletionModal from '../components/sources/AnalysisCompletionModal';
import DiagramGenerationModal from '../components/diagrams/DiagramGenerationModal';
import { diagramsApi } from '../api/diagrams.api';

export default function ProjectSummary({ project, onProjectUpdated, onNavigateTo }) {
  const [engineeringStats, setEngineeringStats] = useState(null);
  const [sources, setSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [candidateStats, setCandidateStats] = useState(null);
  const [completionModalData, setCompletionModalData] = useState(null);
  const [diagramAvailability, setDiagramAvailability] = useState(null);
  const [isDiagramModalOpen, setIsDiagramModalOpen] = useState(false);

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

  async function loadCandidateStats() {
    try {
      const stats = await candidatesApi.getStats(project.id);
      setCandidateStats(stats);
    } catch {
      setCandidateStats(null);
    }
  }

  async function loadDiagramAvailability() {
    try {
      const data = await diagramsApi.getAvailability(project.id);
      setDiagramAvailability(data);
    } catch (err) {
      console.error('Error loading diagram availability:', err);
    }
  }

  useEffect(() => {
    engineering(project.id).then(setEngineeringStats).catch(() => setEngineeringStats(null));
    loadSources();
    loadCandidateStats();
    loadDiagramAvailability();
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
    try {
      setState('analyzing');
      setErrorMessage(null);

      // 1. Subir archivos nuevos si los hay
      const newlyUploadedSourceIds = [];
      if (pdfFiles.length) {
        const uploadRes = await sourcesApi.uploadPdfs(project.id, pdfFiles);
        const items = Array.isArray(uploadRes.data) ? uploadRes.data : (Array.isArray(uploadRes) ? uploadRes : []);
        items.forEach(item => {
          if (item.source?.id) newlyUploadedSourceIds.push(item.source.id);
          else if (item.id) newlyUploadedSourceIds.push(item.id);
        });
      }
      if (audioFile) {
        const audioRes = await sourcesApi.uploadAudio(project.id, audioFile);
        if (audioRes.source?.id) newlyUploadedSourceIds.push(audioRes.source.id);
        else if (audioRes.id) newlyUploadedSourceIds.push(audioRes.id);
      }

      // 2. Fuentes a analizar: las recién subidas o existentes en el proyecto
      const sourcesToAnalyze = [...newlyUploadedSourceIds];
      if (sourcesToAnalyze.length === 0 && sources && sources.length > 0) {
        sources.forEach(s => sourcesToAnalyze.push(s.id));
      }

      // 3. Ejecutar pipeline en todas las fuentes disponibles
      let aggregatedSummary = null;
      if (sourcesToAnalyze.length > 0) {
        for (const sId of sourcesToAnalyze) {
          try {
            const res = await sourcesApi.analyze(sId);
            const sm = res?.data?.summary || res?.summary;
            if (sm) {
              aggregatedSummary = {
                requirementsCount: (aggregatedSummary?.requirementsCount || 0) + (sm.requirementsCount || 0),
                actorsCount: Math.max(aggregatedSummary?.actorsCount || 0, sm.actorsCount || 0),
                processesCount: (aggregatedSummary?.processesCount || 0) + (sm.processesCount || 0),
                businessRulesCount: (aggregatedSummary?.businessRulesCount || 0) + (sm.businessRulesCount || 0),
                technologiesCount: Math.max(aggregatedSummary?.technologiesCount || 0, sm.technologiesCount || 0),
                entitiesCount: Math.max(aggregatedSummary?.entitiesCount || 0, sm.entitiesCount || 0),
                screensCount: (aggregatedSummary?.screensCount || 0) + (sm.screensCount || 0),
                datesCount: (aggregatedSummary?.datesCount || 0) + (sm.datesCount || 0),
                architectureCount: Math.max(aggregatedSummary?.architectureCount || 0, sm.architectureCount || 0),
                constraintsCount: (aggregatedSummary?.constraintsCount || 0) + (sm.constraintsCount || 0),
                objectivesCount: (aggregatedSummary?.objectivesCount || 0) + (sm.objectivesCount || 0),
                scopeCount: (aggregatedSummary?.scopeCount || 0) + (sm.scopeCount || 0),
                totalPendingReview: (aggregatedSummary?.totalPendingReview || 0) + (sm.totalPendingReview || 0),
                sourcesProcessed: (aggregatedSummary?.sourcesProcessed || 0) + 1
              };
            }
          } catch (sourceErr) {
            console.warn('[ProjectSummary] Error analizando fuente:', sourceErr.message);
          }
        }
      }

      // 4. Actualizar descripción y sincronizar análisis de proyecto
      if (description.trim()) {
        await projectsApi.update(project.id, {
          description: description.trim(),
          systemDescription: description.trim()
        });
        await aiApi.analyzeProject(project.id, description.trim());
      } else if (sourcesToAnalyze.length > 0) {
        await aiApi.analyzeProject(project.id, 'Análisis de fuentes documentales del proyecto');
      }

      setPdfFiles([]);
      setAudioFile(null);
      setState('success');
      await onProjectUpdated();
      await loadSources();
      await loadCandidateStats();

      if (aggregatedSummary) {
        setCompletionModalData(aggregatedSummary);
      }
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
            disabled={state === 'analyzing' || (!description.trim() && pdfFiles.length === 0 && !audioFile && sources.length === 0)}
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
          ['Fuentes', engineeringStats.sources.length, 'source'],
          ['RF aprobados', engineeringStats.Requirement.filter(r => r.status === 'APPROVED' && r.type === 'FUNCTIONAL').length, 'task_alt'],
          ['RNF aprobados', engineeringStats.Requirement.filter(r => r.status === 'APPROVED' && r.type === 'NON_FUNCTIONAL').length, 'verified'],
          ['Casos de uso', engineeringStats.UseCase.filter(r => r.status === 'APPROVED').length, 'person_play'],
          ['Diagramas', engineeringStats.Artifact.filter(a => a.type !== 'MOCKUP').length, 'account_tree'],
          ['Mockups', engineeringStats.Artifact.filter(a => a.type === 'MOCKUP').length, 'devices'],
          ['Cambios pendientes', engineeringStats.changes.filter(c => c.status === 'PENDING_APPROVAL').length, 'pending_actions'],
          ['Sin cobertura', engineeringStats.matrix.filter(r => r.missing.length).length, 'warning'],
        ].map(([label, value, icon]) => (
          <div className="stat-card" key={label}>
            <div className="stat-card-header">
              <span className="stat-card-label">{label}</span>
              <span className="ms ms-sm" style={{ color: 'var(--secondary)', opacity: 0.6 }}>{icon}</span>
            </div>
            <div className="stat-card-value">{value}</div>
          </div>
        ))}</div>}

        {/* Banner de Candidatos Pendientes de Revisión en el Centro de Aprobación */}
        {candidateStats && candidateStats.totalPending > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(99, 102, 241, 0.06) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="ms" style={{ color: '#2563eb', fontSize: '24px' }}>rule</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--on-surface)' }}>
                  Centro de Aprobación: <span style={{ color: '#2563eb' }}>{candidateStats.totalPending} elementos pendientes</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--secondary)' }}>
                  Se han extraído requisitos, actores, procesos, pantallas, reglas, tecnologías y arquitectura de tus fuentes listos para ser validados.
                </div>
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => onNavigateTo && onNavigateTo('candidates')}
            >
              <span>Revisar candidatos</span>
              <span className="ms ms-xs">arrow_forward</span>
            </button>
          </div>
        )}

        {/* Sección Visual: Diagramas Mermaid */}
        <div
          className="panel"
          style={{
            padding: '16px 20px',
            borderRadius: '10px',
            border: '1px solid var(--border-default)',
            marginBottom: '18px',
            background: 'var(--surface-container-lowest)',
            boxShadow: 'var(--shadow-xs)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 600, fontSize: '0.9375rem' }}>
                <span className="ms ms-sm">auto_fix_high</span>
                <span>Diagramas del Sistema</span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: 'var(--secondary)' }}>
                Genera los modelos visuales del proyecto a partir de la información estructurada analizada.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsDiagramModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span className="ms ms-xs">auto_fix_high</span>
              <span>Generar diagramas</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            {[
              { key: 'USE_CASE', label: 'Casos de uso', icon: 'account_tree', tab: 'usecases' },
              { key: 'ER', label: 'Entidad-Relación', icon: 'table_chart', tab: 'modeling' },
              { key: 'CLASS', label: 'Clases (POO)', icon: 'schema', tab: 'modeling' },
              { key: 'FLOWCHART', label: 'Diagrama de Flujo', icon: 'alt_route', tab: 'navigation' },
              { key: 'NAVIGATION', label: 'Árbol de Navegación', icon: 'account_tree', tab: 'navigation' },
              { key: 'ARCHITECTURE', label: 'Arquitectura', icon: 'layers', tab: 'architecture' }
            ].map(diag => {
              const info = diagramAvailability?.diagrams?.[diag.key];
              const isGen = info?.isGenerated;
              const isOutdated = info?.isOutdated;
              const canGen = info?.canGenerate;

              return (
                <div
                  key={diag.key}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'var(--surface-container-low)',
                    border: '1px solid var(--border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease'
                  }}
                  onClick={() => onNavigateTo && onNavigateTo(diag.tab)}
                  title={`Ir a vista de ${diag.label}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span className="ms ms-xs" style={{ color: 'var(--primary)' }}>{diag.icon}</span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--on-surface)' }}>{diag.label}</span>
                  </div>

                  <div>
                    {isGen ? (
                      <span style={{ color: isOutdated ? '#b45309' : '#157347', fontSize: '0.78rem', fontWeight: 600 }}>
                        {isOutdated ? '● Desactualizado' : '✓ Generado'}
                      </span>
                    ) : canGen ? (
                      <span style={{ color: 'var(--primary)', fontSize: '0.72rem' }}>
                        ◌ Disponible
                      </span>
                    ) : (
                      <span style={{ color: 'var(--outline)', fontSize: '0.72rem' }}>
                        ○ Incompleto
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal para Generación Múltiple de Diagramas */}
        {isDiagramModalOpen && (
          <DiagramGenerationModal
            projectId={project.id}
            isOpen={isDiagramModalOpen}
            onClose={() => setIsDiagramModalOpen(false)}
            onGenerated={() => {
              loadDiagramAvailability();
              if (onProjectUpdated) onProjectUpdated();
            }}
          />
        )}

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

        {/* Centro de Estado del Proyecto (Compacto y Accionable) */}
        <div style={{ marginBottom: '1.25rem', padding: '16px 20px', borderRadius: 'var(--radius-md)', background: 'var(--surface-container-lowest)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--on-surface)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="ms ms-xs" style={{ color: 'var(--primary)' }}>dashboard</span>
              Estado Global del Proyecto
            </span>
            {sources.length > 0 && (
              <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
                {sources.length} fuente{sources.length > 1 ? 's' : ''} vinculada{sources.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
            <div
              style={{ padding: '10px 12px', borderRadius: '6px', background: 'var(--surface-container-low)', cursor: 'pointer' }}
              onClick={() => onNavigateTo('sources')}
              title="Ver fuentes y entrevistas"
            >
              <span style={{ fontSize: '0.6875rem', color: 'var(--secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Fuentes</span>
              <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--on-surface)', marginTop: '2px' }}>
                {sources.length} procesadas
              </strong>
            </div>

            <div
              style={{ padding: '10px 12px', borderRadius: '6px', background: 'var(--surface-container-low)', cursor: 'pointer' }}
              onClick={() => onNavigateTo('requirements')}
              title="Ver estado del análisis"
            >
              <span style={{ fontSize: '0.6875rem', color: 'var(--secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Análisis</span>
              <strong style={{ display: 'block', fontSize: '1rem', color: reqCount > 0 ? '#157347' : 'var(--outline)', marginTop: '2px' }}>
                {reqCount > 0 ? '✓ Realizado' : '○ Pendiente'}
              </strong>
            </div>

            <div
              style={{ padding: '10px 12px', borderRadius: '6px', background: 'var(--surface-container-low)', cursor: 'pointer' }}
              onClick={() => onNavigateTo('requirements')}
              title="Ver requisitos oficiales"
            >
              <span style={{ fontSize: '0.6875rem', color: 'var(--secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Requisitos</span>
              <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--primary)', marginTop: '2px' }}>
                {reqCount} oficiales
              </strong>
            </div>

            <div
              style={{ padding: '10px 12px', borderRadius: '6px', background: 'var(--surface-container-low)', cursor: 'pointer' }}
              onClick={() => onNavigateTo('modeling')}
              title="Ver modelo del sistema"
            >
              <span style={{ fontSize: '0.6875rem', color: 'var(--secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Modelado</span>
              <strong style={{ display: 'block', fontSize: '1rem', color: entityCount > 0 ? '#157347' : 'var(--outline)', marginTop: '2px' }}>
                {entityCount > 0 ? '✓ Disponible' : '○ Pendiente'}
              </strong>
            </div>

            <div
              style={{ padding: '10px 12px', borderRadius: '6px', background: 'var(--surface-container-low)', cursor: 'pointer' }}
              onClick={() => onNavigateTo('mockups')}
              title="Ver prototipos y pantallas"
            >
              <span style={{ fontSize: '0.6875rem', color: 'var(--secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Mockups</span>
              <strong style={{ display: 'block', fontSize: '1rem', color: screenCount > 0 ? '#157347' : 'var(--outline)', marginTop: '2px' }}>
                {screenCount > 0 ? '✓ Disponible' : '○ Pendiente'}
              </strong>
            </div>
          </div>
        </div>

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
              <span style={{ minWidth: 0, flex: 1 }}><strong style={{ display: 'block', fontSize: '0.8rem' }}>Audio / entrevista</strong><small style={{ color: 'var(--secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{audioFile?.name || 'Opcional · Faster-Whisper local'}</small></span>
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

      {completionModalData && (
        <AnalysisCompletionModal
          isOpen={!!completionModalData}
          onClose={() => setCompletionModalData(null)}
          onReviewNow={() => {
            setCompletionModalData(null);
            if (onNavigateTo) onNavigateTo('candidates');
          }}
          summaryData={completionModalData}
        />
      )}
    </div>
  );
}
