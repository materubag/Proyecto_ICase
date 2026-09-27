import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Play,
  CheckCircle,
  AlertCircle,
  FileText,
  Users,
  Database,
  Layout,
  Loader2,
  UploadCloud,
  Music,
  Trash2,
  FileCheck,
  Cpu,
  Layers,
  GitFork,
  Radio,
  BookOpen
} from 'lucide-react';
import { aiApi } from '../api/ai.api';
import { projectsApi } from '../api/projects.api';
import { filesApi } from '../api/files.api';

export default function ProjectSummary({ project, onProjectUpdated, onNavigateTo }) {
  const [description, setDescription] = useState(
    project.systemDescription || project.description || ''
  );
  const [state, setState] = useState('idle'); // 'idle' | 'analyzing' | 'uploading' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const fileInputRef = useRef(null);
  const projectFiles = project.files || [];

  const reqCount = project.requirements?.length ?? project._count?.requirements ?? 0;
  const actorCount = project.actors?.length ?? project._count?.actors ?? 0;
  const useCaseCount = project.useCases?.length ?? 4;
  const entityCount = project.entities?.length ?? project._count?.entities ?? 0;
  const classCount = project.classModels?.length ?? entityCount;
  const screenCount = project.screens?.length ?? project._count?.screens ?? 0;

  // Manejo de subida múltiple de archivos y audios (opcionales)
  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      setState('uploading');
      setErrorMessage(null);
      setSuccessMessage(null);

      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      await filesApi.uploadFiles(project.id, formData);
      setSuccessMessage(`Se procesaron ${files.length} archivo(s) correctamente.`);
      setState('idle');
      await onProjectUpdated();
    } catch (err) {
      console.error('[Upload Error]:', err);
      setState('error');
      setErrorMessage(err.message || 'Error al procesar la subida de archivos.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeleteFile(fileId) {
    if (!window.confirm('¿Desea eliminar este archivo del proyecto?')) return;
    try {
      await filesApi.deleteFile(fileId);
      await onProjectUpdated();
    } catch (err) {
      alert(`Error al eliminar archivo: ${err.message}`);
    }
  }

  // Análisis integral (Descripción + Documentos ISO 29148 + Audios n8n)
  async function handleAnalyze() {
    if (state === 'analyzing') return;

    const hasText = description.trim().length > 0;
    const hasFiles = projectFiles.length > 0;

    if (!hasText && !hasFiles) {
      setState('error');
      setErrorMessage('Por favor ingrese una descripción o suba al menos un documento/audio para analizar.');
      return;
    }

    try {
      setState('analyzing');
      setErrorMessage(null);
      setSuccessMessage(null);

      // Guardar la descripción actualizada si existe
      if (hasText) {
        await projectsApi.update(project.id, {
          description: description.trim(),
          systemDescription: description.trim()
        });
      }

      // Si hay archivos subidos, invocar análisis consolidado
      if (hasFiles) {
        await filesApi.analyzeConsolidated(project.id);
      } else {
        await aiApi.analyzeProject(project.id, description.trim());
      }

      setState('success');
      setSuccessMessage('Análisis ISO/IEC/IEEE 29148:2018 y artefactos generados exitosamente.');
      await onProjectUpdated();
    } catch (err) {
      console.error('[Analyze Error]:', err);
      setState('error');
      setErrorMessage(err.message || 'Ocurrió un error al procesar el análisis del proyecto.');
    }
  }

  return (
    <div>
      {/* Banner Informativo ISO 29148 y n8n */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(99,102,241,0.06) 100%)',
          borderColor: 'rgba(59,130,246,0.25)',
          marginBottom: '1.5rem',
          padding: '1.25rem 1.5rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <BookOpen size={18} color="var(--primary)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Ingeniería de Requerimientos ISO/IEC/IEEE 29148:2018 & n8n
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, maxWidth: '850px' }}>
              Análisis optimizado en tokens con <strong>gpt-5.4-nano</strong> para requerimientos funcionales/no funcionales estructurados (Precondiciones, Postcondiciones, Actores, Dependencias). Procesamiento de grabaciones de voz y audios integrado con <strong>n8n Webhook</strong>.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="badge" style={{ backgroundColor: '#e0e7ff', color: '#3730a3', fontWeight: 600 }}>
              <Radio size={12} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
              n8n Audio Activo
            </span>
            <span className="badge" style={{ backgroundColor: '#f0fdf4', color: '#166534', fontWeight: 600 }}>
              gpt-5.4-nano Token-Save
            </span>
          </div>
        </div>
      </div>

      {/* Sección Entrada de Datos: Descripción y Subida de Archivos y Audios */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
          <Sparkles size={20} color="var(--primary)" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Especificación y Carga de Fuentes (Opcionales)</h2>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
          Puede ingresar una descripción narrativa en texto, subir múltiples documentos técnicos (PDF, DOCX, TXT) o notas de voz/audios de reuniones (MP3, WAV, M4A). Todo es <strong>opcional</strong> y se combina automáticamente.
        </p>

        {/* Input Texto */}
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 600 }}>
            Descripción o Especificación Narrativa del Sistema
          </label>
          <textarea
            className="form-control"
            rows={4}
            placeholder="Ejemplo: Se requiere un sistema para gestión de biblioteca digital con roles de estudiante, bibliotecario y administrador..."
            value={description}
            disabled={state === 'analyzing' || state === 'uploading'}
            onChange={(e) => {
              setDescription(e.target.value);
              if (state !== 'idle') setState('idle');
            }}
          />
        </div>

        {/* Zona de Subida Múltiple de Documentos y Audios */}
        <div style={{ marginTop: '1.25rem', marginBottom: '1.25rem' }}>
          <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UploadCloud size={16} />
            <span>Subir Documentos y Audios (Archivos Múltiples)</span>
          </label>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFilesSelected}
            multiple
            accept=".pdf,.txt,.doc,.docx,.md,audio/*,.mp3,.wav,.m4a,.ogg,.aac"
            style={{ display: 'none' }}
          />

          <div
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            style={{
              border: '2px dashed var(--border)',
              borderRadius: '10px',
              padding: '1.5rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-secondary)',
              cursor: 'pointer',
              transition: 'border-color 0.2s, background-color 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <FileText size={24} color="var(--primary)" />
              <Music size={24} color="#8b5cf6" />
            </div>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              Haga clic aquí para seleccionar múltiples archivos o audios
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Formatos soportados: PDF, TXT, DOCX, MD y Audios MP3, WAV, M4A, OGG
            </div>
          </div>
        </div>

        {/* Apartado en la misma página: Lista de Documentos y Audios Subidos */}
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
              Documentos y Audios Registrados ({projectFiles.length})
            </h3>
            {state === 'uploading' && (
              <span style={{ fontSize: '0.8rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Loader2 size={13} className="spin" />
                Procesando archivos con n8n/extractores...
              </span>
            )}
          </div>

          {projectFiles.length === 0 ? (
            <div style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
              No se han subido documentos ni audios aún. La subida es opcional.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {projectFiles.map((file) => {
                const isAudio = file.fileType === 'AUDIO';
                return (
                  <div
                    key={file.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-primary)',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '220px' }}>
                      {isAudio ? (
                        <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: '#ede9fe', color: '#7c3aed' }}>
                          <Music size={18} />
                        </div>
                      ) : (
                        <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: '#e0e7ff', color: '#3730a3' }}>
                          <FileText size={18} />
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                          {file.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {(file.size / 1024).toFixed(1)} KB • {isAudio ? 'Audio procesado con n8n' : 'Documento técnico'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: file.status === 'ANALYZED' ? '#dcfce7' : file.status === 'ERROR' ? '#fee2e2' : '#f1f5f9',
                          color: file.status === 'ANALYZED' ? '#15803d' : file.status === 'ERROR' ? '#b91c1c' : '#475569'
                        }}
                      >
                        {file.status === 'ANALYZED' ? (isAudio ? 'Transcrito n8n' : 'Extraído') : file.status}
                      </span>

                      {file.summary && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.summary}>
                          {file.summary}
                        </span>
                      )}

                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--danger)', padding: '4px 8px' }}
                        onClick={() => handleDeleteFile(file.id)}
                        title="Eliminar archivo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Botón de Ejecución del Análisis */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '1.5rem' }}>
          <div>
            {state === 'success' && (
              <span style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem' }}>
                <CheckCircle size={16} />
                {successMessage || 'Análisis completado'}
              </span>
            )}
            {state === 'error' && (
              <span style={{ color: 'var(--danger)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem' }}>
                <AlertCircle size={16} />
                {errorMessage}
              </span>
            )}
          </div>

          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={state === 'analyzing' || state === 'uploading' || (!description.trim() && projectFiles.length === 0)}
            style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem', fontWeight: 600 }}
          >
            {state === 'analyzing' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Loader2 size={16} className="spin" />
                Ejecutando Pipeline ICASE (gpt-5.4-nano & n8n)...
              </span>
            ) : (
              <>
                <Play size={16} />
                <span>Analizar Proyecto (Requerimientos, Casos, Modelo y Arquitectura)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tarjetas Metodológicas de Navegación por Etapas */}
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.85rem', color: 'var(--text-main)' }}>
          Etapas del Ciclo de Vida del Software (ICASE Metodología)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {/* Requerimientos ISO 29148 */}
          <div
            className="card"
            style={{ cursor: 'pointer', transition: 'transform 0.15s ease, border-color 0.15s ease' }}
            onClick={() => onNavigateTo('requirements')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>1. Requisitos ISO 29148</span>
              <FileCheck size={18} color="var(--primary)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {reqCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              RF / RNF con Pre y Postcondiciones
            </div>
          </div>

          {/* Actores */}
          <div
            className="card"
            style={{ cursor: 'pointer', transition: 'transform 0.15s ease, border-color 0.15s ease' }}
            onClick={() => onNavigateTo('actors')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>2. Actores del Sistema</span>
              <Users size={18} color="var(--primary)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {actorCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Roles y responsabilidades de negocio
            </div>
          </div>

          {/* Casos de Uso (4 Procesos Fundamentales) */}
          <div
            className="card"
            style={{ cursor: 'pointer', transition: 'transform 0.15s ease, border-color 0.15s ease' }}
            onClick={() => onNavigateTo('usecases')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>3. Casos de Uso (4 Procesos)</span>
              <Layers size={18} color="#8b5cf6" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {useCaseCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Autenticación, Operación, Consultas, Auditoría
            </div>
          </div>

          {/* Modelado de Datos (DER y Diagrama de Clases) */}
          <div
            className="card"
            style={{ cursor: 'pointer', transition: 'transform 0.15s ease, border-color 0.15s ease' }}
            onClick={() => onNavigateTo('model')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>4. Modelo (DER / Clases)</span>
              <Database size={18} color="#059669" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {entityCount} Entidades / {classCount} Clases
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Diagrama ER y Diagrama de Clases UML
            </div>
          </div>

          {/* Prototipos y Selección de Pantallas */}
          <div
            className="card"
            style={{ cursor: 'pointer', transition: 'transform 0.15s ease, border-color 0.15s ease' }}
            onClick={() => onNavigateTo('prototype')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>5. Prototipos / Mockups</span>
              <Layout size={18} color="#ea580c" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {screenCount} Pantallas
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Selección personalizada y generación HTML
            </div>
          </div>

          {/* Diagrama de Navegación */}
          <div
            className="card"
            style={{ cursor: 'pointer', transition: 'transform 0.15s ease, border-color 0.15s ease' }}
            onClick={() => onNavigateTo('navigation')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>6. Diagrama Navegación</span>
              <GitFork size={18} color="#2563eb" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Flujo
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Transición de vistas e interacciones
            </div>
          </div>

          {/* Arquitectura Software y Despliegue */}
          <div
            className="card"
            style={{ cursor: 'pointer', transition: 'transform 0.15s ease, border-color 0.15s ease' }}
            onClick={() => onNavigateTo('architecture')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>7. Arquitectura (Dual)</span>
              <Cpu size={18} color="#4f46e5" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
              2 Diagramas
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Software (Capas) & Despliegue (Docker/Infra)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
