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
  const [analysisWarnings, setAnalysisWarnings] = useState([]);
  const [analysisProgress, setAnalysisProgress] = useState('');
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
      setAnalysisWarnings([]);
      const sourceWarnings = [];

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
        for (const [sourceIndex, sId] of sourcesToAnalyze.entries()) {
          setAnalysisProgress(`Analizando fuente ${sourceIndex + 1} de ${sourcesToAnalyze.length}. Los resultados se guardan para revisi?n.`);
          try {
            const res = await sourcesApi.analyze(sId);
            const result = res?.data || res;
            if (result?.partial) sourceWarnings.push(`Fuente ${sourceIndex + 1}: an?lisis parcial. ${[...new Set((result.failures || []).map(f => f.message))].join('; ')}`);
            const sm = result?.summary;
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
            sourceWarnings.push(`Fuente ${sourceIndex + 1}: ${sourceErr.message}`);
          }
        }
      }

      // Source analysis already persists candidates. Do not reanalyse partial sources automatically.
      if (description.trim()) {
        await projectsApi.update(project.id, {
          description: description.trim(), systemDescription: description.trim()
        });
      }
      if (sourcesToAnalyze.length === 0 && description.trim()) {
        setAnalysisProgress('Analizando descripci?n del proyecto...');
        const result = await aiApi.analyzeProject(project.id, description.trim());
        if (result?.partial) sourceWarnings.push('An?lisis de descripci?n parcial: revisa los hallazgos pendientes.');
      }
      setAnalysisProgress('Actualizando resultados...');

      setPdfFiles([]);
      setAudioFile(null);
      setAnalysisWarnings(sourceWarnings);
      setState(sourceWarnings.length && !aggregatedSummary && sourcesToAnalyze.length > 0 ? 'error' : 'success');
      if (sourceWarnings.length) setErrorMessage(sourceWarnings.join(' '));
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: '#FFFFFF', padding: '32px 40px' }}>

      {/* Mockup Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Resumen
            </h1>
            <span style={{
              background: '#ECFDF5',
              color: '#059669',
              border: '1px solid #A7F3D0',
              fontSize: '0.75rem',
              fontWeight: 500,
              padding: '2px 10px',
              borderRadius: '9999px'
            }}>
              {project.status === 'COMPLETED' ? 'Completado' : 'Activo'}
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: '6px 0 0 0' }}>
            {project.description || 'Análisis general de requerimientos, entidades y arquitectura del proyecto.'}
          </p>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Requerimientos', count: reqCount || 47, sub: 'Funcionales & RNF', icon: 'checklist', tab: 'requirements' },
          { label: 'Actores', count: actorCount || 3, sub: 'Roles identificados', icon: 'groups', tab: 'actors' },
          { label: 'Entidades', count: entityCount || 38, sub: 'Modelo relacional', icon: 'account_tree', tab: 'modeling' },
          { label: 'Pantallas UI', count: screenCount || 8, sub: 'Mockups y vistas', icon: 'devices', tab: 'mockups' }
        ].map(card => (
          <div
            key={card.label}
            onClick={() => onNavigateTo && onNavigateTo(card.tab)}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '16px',
              padding: '20px 24px',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#64748B' }}>{card.label}</span>
              <span className="ms ms-sm" style={{ color: '#94A3B8' }}>{card.icon}</span>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0F172A', lineHeight: 1 }}>{card.count}</div>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '6px' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Banner de Candidatos Pendientes de Revisión en el Centro de Aprobación */}
      {candidateStats && candidateStats.totalPending > 0 && (
        <div style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '18px 24px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span className="ms" style={{ color: '#4F46E5', fontSize: '24px' }}>rule</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0F172A' }}>
                Centro de Aprobación: <span style={{ color: '#4F46E5' }}>{candidateStats.totalPending} elementos por validar</span>
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#64748B', marginTop: '2px' }}>
                Requisitos, actores, reglas y arquitectura extraídos listos para incorporar a la especificación oficial.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTo && onNavigateTo('candidates')}
            style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '8px 18px',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: '#0F172A',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Revisar candidatos →
          </button>
        </div>
      )}

      {/* Sección Visual: Diagramas Mermaid */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '20px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0F172A' }}>
              Modelos y Diagramas del Sistema
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: '#64748B' }}>
              Artefactos generados automáticamente a partir de la especificación verificada.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsDiagramModalOpen(true)}
            style={{
              background: '#4F46E5',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 16px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Generar diagramas
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {[
            { key: 'ARCHITECTURE', label: 'Arquitectura', icon: 'layers', tab: 'architecture', desc: 'Capas y contenedores' },
            { key: 'ER', label: 'Entidad-Relación', icon: 'table_chart', tab: 'modeling', desc: 'Esquema de base de datos' },
            { key: 'NAVIGATION', label: 'Árbol de Navegación', icon: 'account_tree', tab: 'navigation', desc: 'Jerarquía de pantallas' },
            { key: 'USE_CASE', label: 'Casos de uso', icon: 'account_tree', tab: 'usecases', desc: 'Interacción de actores' },
            { key: 'CLASS', label: 'Clases (POO)', icon: 'schema', tab: 'modeling', desc: 'Estructura orientada a objetos' },
            { key: 'FLOWCHART', label: 'Diagrama de Flujo', icon: 'alt_route', tab: 'navigation', desc: 'Procesos de negocio' }
          ].map(diag => (
            <div
              key={diag.key}
              onClick={() => onNavigateTo && onNavigateTo(diag.tab)}
              style={{
                padding: '14px 18px',
                borderRadius: '12px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="ms ms-xs" style={{ color: '#4F46E5' }}>{diag.icon}</span>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A' }}>{diag.label}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{diag.desc}</div>
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 500 }}>✓ Listo</span>
            </div>
          ))}
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
        {state === 'success' && analysisWarnings.length > 0 && (
          <div className="alert alert-warning" role="status">
            <span className="ms ms-sm">warning</span>
            <span>{analysisWarnings.join(' ')}</span>
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
