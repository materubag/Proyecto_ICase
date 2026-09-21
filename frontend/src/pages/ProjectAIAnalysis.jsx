import React, { useState } from 'react';
import { Sparkles, Play, Code, CheckCircle, Database, Layout, GitFork, ArrowDownToLine } from 'lucide-react';
import { aiApi } from '../api/ai.api';
import { requirementsApi } from '../api/requirements.api';
import { actorsApi } from '../api/actors.api';
import { projectsApi } from '../api/projects.api';

export default function ProjectAIAnalysis({ project, onProjectUpdated, onNavigateTo }) {
  const [description, setDescription] = useState(
    project.systemDescription || project.description || ''
  );
  const [provider, setProvider] = useState('mock');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [error, setError] = useState(null);

  async function handleAnalyze() {
    if (!description.trim()) {
      alert('Por favor ingrese una descripción general del sistema antes de analizar.');
      return;
    }

    try {
      setAnalyzing(true);
      setError(null);
      setImportSuccess(false);

      // Save updated description to project
      await projectsApi.update(project.id, { systemDescription: description });

      const result = await aiApi.analyzeProject(project.id, description, provider);
      setAnalysisResult(result);
    } catch (err) {
      setError(err.message || 'Error al ejecutar el análisis con IA.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleImportToDatabase() {
    if (!analysisResult) return;

    try {
      setImporting(true);
      const existingReqCodes = new Set((project.requirements || []).map(r => r.code));
      const existingActorNames = new Set((project.actors || []).map(a => a.name.toLowerCase()));

      // Import requirements
      if (analysisResult.requirements && Array.isArray(analysisResult.requirements)) {
        for (const req of analysisResult.requirements) {
          if (!existingReqCodes.has(req.code)) {
            await requirementsApi.create(project.id, {
              code: req.code,
              name: req.name,
              description: req.description,
              type: req.type === 'NO_FUNCIONAL' ? 'NON_FUNCTIONAL' : 'FUNCTIONAL',
              priority: req.priority === 'ALTA' ? 'HIGH' : req.priority === 'BAJA' ? 'LOW' : 'MEDIUM',
              status: 'PENDING'
            });
          }
        }
      }

      // Import actors
      if (analysisResult.actors && Array.isArray(analysisResult.actors)) {
        for (const act of analysisResult.actors) {
          if (!existingActorNames.has(act.name.toLowerCase())) {
            await actorsApi.create(project.id, {
              name: act.name,
              description: act.description
            });
          }
        }
      }

      setImportSuccess(true);
      onProjectUpdated();
    } catch (err) {
      alert(`Error al importar elementos a la base de datos: ${err.message}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Sparkles size={18} color="var(--primary)" />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Análisis del Proyecto Asistido por IA</h2>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Ingrese la especificación narrativa o requerimientos de negocio. El motor de IA analizará la descripción y generará una especificación canónica estructurada en JSON.
        </p>

        <div className="form-group">
          <label className="form-label">Descripción General del Sistema *</label>
          <textarea
            className="form-control"
            rows={5}
            placeholder="Ejemplo: Desarrollar un sistema de biblioteca universitaria que permita registrar préstamos de libros, gestionar el catálogo con ISBN, alertar sobre fechas de vencimiento y generar reportes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Proveedor de IA:</span>
            <select
              className="form-control"
              style={{ width: 'auto', padding: '0.35rem 0.65rem' }}
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="mock">MockAIProvider (Simulado - Activo)</option>
              <option value="gemini" disabled>Gemini Pro (Fase 2)</option>
              <option value="ollama" disabled>Ollama Local (Fase 2)</option>
              <option value="openai" disabled>OpenAI GPT-4o (Fase 2)</option>
              <option value="n8n" disabled>n8n Webhook (Fase 2)</option>
            </select>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={analyzing || !description.trim()}
          >
            {analyzing ? (
              <span>Analizando sistema...</span>
            ) : (
              <>
                <Play size={14} />
                <span>Analizar con IA</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Resultados Estructurados del Análisis */}
      {analysisResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={16} color="var(--primary)" />
                  Estructura Canónica Generada
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Proveedor: {analysisResult.meta?.provider} • Generado: {new Date(analysisResult.meta?.analyzedAt).toLocaleTimeString()}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleImportToDatabase}
                  disabled={importing || importSuccess}
                >
                  <ArrowDownToLine size={14} />
                  <span>{importSuccess ? '¡Requisitos y Actores Sincronizados!' : 'Importar a Requisitos del Proyecto'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tarjetas de Resumen por Capa */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div className="card">
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Requisitos Detectados</span>
                <span className="badge badge-planning">{analysisResult.requirements?.length || 0}</span>
              </h4>
              <ul style={{ fontSize: '0.8125rem', paddingLeft: '1.25rem', color: 'var(--text-muted)' }}>
                {analysisResult.requirements?.slice(0, 4).map((r, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>
                    <strong style={{ color: 'var(--text-main)' }}>{r.code}:</strong> {r.name}
                  </li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Actores del Sistema</span>
                <span className="badge badge-planning">{analysisResult.actors?.length || 0}</span>
              </h4>
              <ul style={{ fontSize: '0.8125rem', paddingLeft: '1.25rem', color: 'var(--text-muted)' }}>
                {analysisResult.actors?.map((a, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>
                    <strong style={{ color: 'var(--text-main)' }}>{a.name}</strong>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Entidades Identificadas</span>
                <span className="badge badge-planning">{analysisResult.entities?.length || 0}</span>
              </h4>
              <ul style={{ fontSize: '0.8125rem', paddingLeft: '1.25rem', color: 'var(--text-muted)' }}>
                {analysisResult.entities?.map((e, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>
                    <strong style={{ color: 'var(--text-main)' }}>{e.name}</strong> ({e.attributes?.length || 0} atributos)
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Visualizador del JSON Canónico */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Code size={16} />
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Payload JSON Canónico (Fuente de Verdad)</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Consumible por los generadores de Modelo, Mockup, Navegación y Arquitectura
              </span>
            </div>
            <pre style={{
              backgroundColor: '#0f172a',
              color: '#38bdf8',
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              fontFamily: 'var(--font-mono)',
              maxHeight: '340px',
              overflowY: 'auto'
            }}>
              {JSON.stringify(analysisResult, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
