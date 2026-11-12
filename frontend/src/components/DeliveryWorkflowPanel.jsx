import React, { useEffect, useState, useRef } from 'react';
import { request, apiUrl } from '../api/client';
import { codegenApi } from '../api/codegen.api';

const STAGE_NAMES = [
  'Stack tecnológico',
  'Estructura del proyecto',
  'Base de datos',
  'Endpoints y Swagger',
  'Backend integrado',
  'Frontend conectado',
  'Docker y entrega'
];

export default function DeliveryWorkflowPanel({ project, mode = 'implementation', onProjectUpdated }) {
  const projectRef = useRef(project.id);
  projectRef.current = project.id;
  const [manualConfirmed, setManualConfirmed] = useState(false);
  const [manualNotes, setManualNotes] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(1);
  const [screenId, setScreenId] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [endpointPhase, setEndpointPhase] = useState('definition');
  const [draft, setDraft] = useState(null);
  const [draftRevision, setDraftRevision] = useState(null);
  const [reason, setReason] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [changeReason, setChangeReason] = useState('');
  const [affected, setAffected] = useState('[]');
  const [changeId, setChangeId] = useState('');
  const [remoteScreenId, setRemoteScreenId] = useState('');

  const base = `/projects/${project.id}/codegen/workflow`;

  async function refresh() {
    const value = await request(base);
    if (projectRef.current === project.id) setData(value);
    return value;
  }

  useEffect(() => {
    setData(null); setError(''); setPreview(null); setStage(1);
    refresh().catch(e => setError(e.message));
    const timer = setInterval(() => refresh().catch(e => setError(e.message)), 2500);
    return () => clearInterval(timer);
  }, [project.id]);

  useEffect(() => {
    setDraft(null);
    setFile(null); setReason('');
  }, [stage, endpoint, endpointPhase, mode, screenId]);

  const target = changeId
    ? `change:${changeId}`
    : mode === 'screens'
    ? 'screens'
    : mode === 'mockups'
    ? `mockup:${screenId}`
    : stage === 4 && endpoint
    ? `${endpointPhase}:${endpoint}`
    : String(stage);

  const artifact = changeId
    ? data?.changes.find(c => c.id === changeId)?.proposal
    : mode === 'screens'
    ? data?.catalog
    : mode === 'mockups'
    ? data?.mockups?.[screenId]
    : stage === 4 && endpoint
    ? data?.endpoints?.[endpoint]?.[endpointPhase]
    : data?.stages?.[stage];

  useEffect(() => { setManualConfirmed(false); setManualNotes(''); }, [project.id, target, artifact?.version, artifact?.review?.contentHash, artifact?.validation?.executedAt]);
  const verifiedStages = new Set(data?.approvedStages || []);
  const manualReview = { confirmed: manualConfirmed, notes: manualNotes };
  const previewLink = value => value?.startsWith('/api/') ? apiUrl(value.slice(4)) : value;
  const active = data?.jobs?.find(j => j.id === data.activeJobId);
  const running = active && ['RUNNING', 'QUEUED'].includes(active.status);
  const previousApproved = !!changeId || mode !== 'implementation' || stage === 1 || verifiedStages.has(stage - 1);
  const blocked = busy || running || data?.paused || !data?.documentApproved || (!!data?.contractError && (stage >= 3 || mode !== 'implementation')) || !previousApproved ||
    (mode === 'implementation' && stage === 4 && endpointPhase === 'execution' && !!endpoint && !data?.endpoints?.[endpoint]?.definition?.approval);

  async function call(path, body, method = 'POST') {
    setBusy(true);
    setError('');
    try {
      const result = await request(base + path, { method, ...(body ? { body: path === '/approve' ? { ...body, manualReview } : body } : {}) });
      if (path === '/artifacts') setDraft(null);
      if (path === '/preview/start') setPreview(result);
      await refresh();
      if (path === '/approve') {
        setManualConfirmed(false);
        if (mode === 'implementation' && !endpoint && !changeId && stage < 7 && result?.state?.stages?.[stage]?.approval) setStage(stage + 1);
        await onProjectUpdated?.();
      }
      return result;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const task = name => call('/tasks', { target, task: name, options: { requestId: crypto.randomUUID() } });

  const editContent = event => {
    if (draft == null) setDraftRevision(data.revision);
    setDraft(event.target.value);
  };

  const content = draft ?? JSON.stringify(artifact?.content || (mode === 'screens' ? { screens: [], questions: [] } : {}), null, 2);
  const canEdit = !!changeId || mode === 'screens' || (mode === 'implementation' && (stage === 1 || (stage === 4 && endpoint && endpointPhase === 'definition')));
  const heading = mode === 'screens' ? 'Especificación funcional de pantallas' : mode === 'mockups' ? 'Diseños de Google Stitch' : 'Implementación y Verificación por Etapas';

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
      fontFamily: 'inherit'
    }} aria-label={heading}>

      {/* ── CABECERA ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#EEF2FF',
              color: '#4F46E5',
              fontWeight: 700,
              fontSize: '1rem'
            }}>⚡</span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              {heading}
            </h2>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '4px 0 0 42px' }}>
            Control de gobernanza continua, auditoría asistida y validación ejecutable de la API
          </p>
        </div>

        {data && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: '9999px',
              background: data.documentApproved ? '#ECFDF5' : '#FFFBEB',
              color: data.documentApproved ? '#059669' : '#B45309',
              border: `1px solid ${data.documentApproved ? '#A7F3D0' : '#FDE68A'}`
            }}>
              {data.documentApproved ? '✓ Flujo Documental Aprobado' : 'Flujo Documental en Proceso'}
            </span>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color: '#64748B',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              padding: '3px 8px',
              borderRadius: '6px'
            }}>
              Rev. #{data.revision || 1}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '8px',
          color: '#B91C1C',
          fontSize: '0.85rem',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }} role="alert">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {!data ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: '0.9rem' }}>
          <span className="spin" style={{ display: 'inline-block', marginRight: '8px' }}>⏳</span>
          Consultando estado de sincronización y versiones guardadas…
        </div>
      ) : (
        <>
          {/* ── PRERREQUISITOS STATUS BAR ────────────────────────────────────── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '10px 14px',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            marginBottom: '18px',
            fontSize: '0.78rem'
          }}>
            <span style={{ fontWeight: 600, color: '#334155' }}>Prerrequisitos funcionales:</span>
            <span style={{
              padding: '2px 8px',
              borderRadius: '9999px',
              background: data.prerequisites?.context ? '#ECFDF5' : '#FEF3C7',
              color: data.prerequisites?.context ? '#059669' : '#92400E',
              border: `1px solid ${data.prerequisites?.context ? '#A7F3D0' : '#FCD34D'}`
            }}>
              Contexto: {data.prerequisites?.context ? 'Aprobado' : 'Pendiente'}
            </span>
            <span style={{
              padding: '2px 8px',
              borderRadius: '9999px',
              background: data.prerequisites?.actors ? '#ECFDF5' : '#FEF3C7',
              color: data.prerequisites?.actors ? '#059669' : '#92400E',
              border: `1px solid ${data.prerequisites?.actors ? '#A7F3D0' : '#FCD34D'}`
            }}>
              Actores: {data.prerequisites?.actors ? 'Aprobados' : 'Pendientes'}
            </span>
            <span style={{
              padding: '2px 8px',
              borderRadius: '9999px',
              background: data.prerequisites?.requirements ? '#ECFDF5' : '#FEF3C7',
              color: data.prerequisites?.requirements ? '#059669' : '#92400E',
              border: `1px solid ${data.prerequisites?.requirements ? '#A7F3D0' : '#FCD34D'}`
            }}>
              Requisitos: {data.prerequisites?.requirements ? 'Aprobados' : 'Pendientes'}
            </span>
          </div>

          {/* ── NAVEGADOR DE ETAPAS (TABS RESPONSIVAS) ───────────────────────── */}
          {mode === 'implementation' && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
                gap: '8px'
              }}>
                {STAGE_NAMES.map((name, i) => {
                  const stageNum = i + 1;
                  const isSelected = stage === stageNum;
                  const isApproved = verifiedStages.has(stageNum);
                  const reviewStatus = data.stages?.[stageNum]?.review?.status;

                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => { setStage(stageNum); setEndpoint(''); }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid #6366F1' : '1px solid #E2E8F0',
                        background: isSelected ? '#EEF2FF' : '#FFFFFF',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 2px 4px rgba(99, 102, 241, 0.15)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: isSelected ? '#4338CA' : '#64748B'
                        }}>
                          Fase {stageNum}
                        </span>
                        {isApproved ? (
                          <span style={{ fontSize: '0.7rem', color: '#059669' }} title="Aprobada">✓</span>
                        ) : null}
                      </div>
                      <div style={{
                        fontSize: '0.78rem',
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? '#1E1B4B' : '#334155',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginBottom: '6px'
                      }}>
                        {name}
                      </div>
                      <span style={{
                        display: 'inline-block',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: isApproved ? '#DCFCE7' : reviewStatus === 'SUCCEEDED' ? '#E0E7FF' : '#F1F5F9',
                        color: isApproved ? '#15803D' : reviewStatus === 'SUCCEEDED' ? '#3730A3' : '#64748B'
                      }}>
                        {isApproved ? `Aprobada v${data.stages?.[stageNum]?.version || 1}` : reviewStatus || 'Sin ejecutar'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── MOCKUPS SELECTOR ────────────────────────────────────────────── */}
          {mode === 'mockups' && (
            <div style={{ marginBottom: '16px', background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Seleccionar Pantalla del Catálogo Aprobado:
              </label>
              <select
                aria-label="Pantalla aprobada"
                className="form-control"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                value={screenId}
                onChange={e => setScreenId(e.target.value)}
              >
                <option value="">-- Seleccione una pantalla aprobada --</option>
                {data.catalog?.content?.screens?.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.route})</option>
                ))}
              </select>
            </div>
          )}

          {/* ── ENDPOINT SELECTOR FOR STAGE 4 ────────────────────────────────── */}
          {mode === 'implementation' && stage === 4 && (
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '18px'
            }}>
              <p style={{ fontSize: '0.8rem', color: '#475569', margin: '0 0 10px 0' }}>
                Cada endpoint requiere dos aprobaciones consecutivas: definición del contrato y funcionamiento verificado en pruebas.
              </p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  style={{ flex: 1, minWidth: '240px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                  value={endpoint}
                  onChange={e => setEndpoint(e.target.value)}
                >
                  <option value="">Cierre de Etapa: Todos los endpoints</option>
                  {data.availableOperations?.map(op => (
                    <option key={op.id} value={op.id}>{op.method} {op.route} · {op.name}</option>
                  ))}
                </select>
                {endpoint && (
                  <div style={{ display: 'inline-flex', gap: '6px' }}>
                    <button
                      type="button"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        background: endpointPhase === 'definition' ? '#4F46E5' : '#E2E8F0',
                        color: endpointPhase === 'definition' ? '#FFFFFF' : '#475569'
                      }}
                      onClick={() => setEndpointPhase('definition')}
                    >
                      Definición {data.endpoints?.[endpoint]?.definition?.approval ? '✓' : ''}
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        background: endpointPhase === 'execution' ? '#4F46E5' : '#E2E8F0',
                        color: endpointPhase === 'execution' ? '#FFFFFF' : '#475569'
                      }}
                      onClick={() => setEndpointPhase('execution')}
                    >
                      Funcionamiento {data.endpoints?.[endpoint]?.execution?.approval ? '✓' : ''}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ARTIFACT STATUS BANNER ──────────────────────────────────────── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '12px 16px',
            background: '#F1F5F9',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <div>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>
                {changeId
                  ? 'Cambio incremental'
                  : mode === 'implementation'
                  ? `${stage}. ${STAGE_NAMES[stage - 1]}`
                  : mode === 'screens'
                  ? 'Catálogo'
                  : data.catalog?.content?.screens?.find(s => s.id === screenId)?.name || 'Pantalla'}
              </span>
              <span style={{ fontSize: '0.78rem', color: '#64748B', marginLeft: '8px' }}>
                Versión {artifact?.version || 1}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.75rem' }}>
              <span style={{
                padding: '3px 8px',
                borderRadius: '6px',
                background: artifact?.validation?.passed ? '#ECFDF5' : '#FEF2F2',
                color: artifact?.validation?.passed ? '#059669' : '#DC2626',
                border: `1px solid ${artifact?.validation?.passed ? '#A7F3D0' : '#FECACA'}`,
                fontWeight: 600
              }}>
                Validación: {artifact?.validation?.passed ? 'Correcta ✓' : 'Pendiente'}
              </span>
              <span style={{
                padding: '3px 8px',
                borderRadius: '6px',
                background: artifact?.review?.status === 'SUCCEEDED' ? '#EEF2FF' : '#F8FAFC',
                color: artifact?.review?.status === 'SUCCEEDED' ? '#4F46E5' : '#64748B',
                border: '1px solid #CBD5E1',
                fontWeight: 600
              }}>
                Sonnet: {artifact?.review?.status || 'PENDING'}
              </span>
              <span style={{
                padding: '3px 8px',
                borderRadius: '6px',
                background: artifact?.approval ? '#ECFDF5' : '#FFFBEB',
                color: artifact?.approval ? '#059669' : '#B45309',
                border: `1px solid ${artifact?.approval ? '#A7F3D0' : '#FDE68A'}`,
                fontWeight: 600
              }}>
                Aprobación: {artifact?.approval ? `v${artifact.version || 1} ✓` : 'Pendiente'}
              </span>
            </div>
          </div>

          {/* ── ACCIONES PRINCIPALES ────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {(mode === 'screens' || (mode === 'implementation' && (stage === 1 || (stage === 4 && endpoint && endpointPhase === 'definition')))) && (
              <button
                type="button"
                style={{
                  background: '#4F46E5',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: blocked || draft != null ? 'not-allowed' : 'pointer',
                  opacity: blocked || draft != null ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                disabled={blocked || draft != null}
                onClick={() => task('prepare')}
              >
                ✨ Proponer con Luna
              </button>
            )}

            {mode === 'mockups' && (
              <button
                type="button"
                style={{
                  background: '#4F46E5',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: blocked || !screenId || !data.catalog?.approval ? 'not-allowed' : 'pointer',
                  opacity: blocked || !screenId || !data.catalog?.approval ? 0.6 : 1
                }}
                disabled={blocked || !screenId || !data.catalog?.approval}
                onClick={() => task('stitch')}
              >
                🎨 Generar pantalla en Stitch
              </button>
            )}

            <button
              type="button"
              style={{
                background: '#FFFFFF',
                color: '#334155',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: blocked || draft != null || (mode === 'mockups' && !artifact) ? 'not-allowed' : 'pointer',
                opacity: blocked || draft != null || (mode === 'mockups' && !artifact) ? 0.6 : 1
              }}
              disabled={blocked || draft != null || (mode === 'mockups' && !artifact)}
              onClick={() => task(changeId ? 'validate' : mode === 'implementation' && stage >= 2 && !(stage === 4 && endpointPhase === 'definition' && endpoint) ? 'execute' : 'validate')}
            >
              ⚙️ {mode === 'implementation' && stage >= 2 && !(stage === 4 && endpointPhase === 'definition' && endpoint) ? 'Generar y Ejecutar Pruebas' : 'Validar Sintaxis'}
            </button>

            <button
              type="button"
              style={{
                background: '#FFFFFF',
                color: '#334155',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: blocked || !artifact || draft != null ? 'not-allowed' : 'pointer',
                opacity: blocked || !artifact || draft != null ? 0.6 : 1
              }}
              disabled={blocked || !artifact || draft != null}
              onClick={() => task('review')}
            >
              🔍 Solicitar Revisión Sonnet
            </button>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
              <button
                type="button"
                style={{
                  background: '#FFFFFF',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: busy ? 'not-allowed' : 'pointer'
                }}
                disabled={busy}
                onClick={() => call('/control', { action: 'pause', jobId: active?.id })}
              >
                ⏸ Guardar y pausar
              </button>
              <button
                type="button"
                style={{
                  background: '#FFFFFF',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: busy ? 'not-allowed' : 'pointer'
                }}
                disabled={busy}
                onClick={() => call('/control', { action: 'resume', jobId: active?.id })}
              >
                ▶ Reanudar
              </button>
              {active && (
                <button
                  type="button"
                  style={{
                    background: '#FEE2E2',
                    color: '#DC2626',
                    border: '1px solid #FCA5A5',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: busy ? 'not-allowed' : 'pointer'
                  }}
                  disabled={busy}
                  onClick={() => call('/control', { action: 'cancel', jobId: active.id })}
                >
                  ✕ Cancelar
                </button>
              )}
            </div>
          </div>

          {/* ── BOTONES DE APROBACIÓN POR COMPONENTES (FASE 1) ───────────────── */}
          <div style={{ padding: 14, marginBottom: 16, border: '1px solid #CBD5E1', borderRadius: 8 }}>
            <label>Resolución de observaciones y motivo de la aprobación
              <textarea className="form-control" value={reason} onChange={e => setReason(e.target.value)} />
            </label>
            <label>Resultado de mi revisión y pruebas
              <textarea className="form-control" value={manualNotes} onChange={e => setManualNotes(e.target.value)} placeholder="Qué revisaste, qué probaste y el resultado" />
            </label>
            <label><input type="checkbox" checked={manualConfirmed} onChange={e => setManualConfirmed(e.target.checked)} /> Revisé esta versión y probé el resultado disponible para esta etapa.</label>
          </div>
          {mode === 'implementation' && stage === 1 && !changeId ? (
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '20px'
            }}>
              <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                Aprobación de componentes del stack base:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['backend', 'database', 'frontend', 'services'].map(component => {
                  const isCompApproved = !!artifact?.componentApprovals?.[component];
                  return (
                    <button
                      key={component}
                      type="button"
                      style={{
                        padding: '7px 14px',
                        borderRadius: '6px',
                        border: isCompApproved ? '1px solid #A7F3D0' : '1px solid #CBD5E1',
                        background: isCompApproved ? '#ECFDF5' : '#FFFFFF',
                        color: isCompApproved ? '#065F46' : '#1E293B',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: blocked || !artifact?.validation?.passed || artifact?.review?.status !== 'SUCCEEDED' || draft != null ? 'not-allowed' : 'pointer',
                        opacity: blocked || !artifact?.validation?.passed || artifact?.review?.status !== 'SUCCEEDED' || draft != null ? 0.6 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      disabled={blocked || !manualConfirmed || !artifact?.validation?.passed || artifact?.review?.status !== 'SUCCEEDED' || draft != null}
                      onClick={() => call('/approve', { target, revision: data.revision, component, resolution: reason })}
                    >
                      {isCompApproved ? '✓' : '+'} Aprobar {component} {isCompApproved ? '(Listo)' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: '20px' }}>
              <button
                type="button"
                style={{
                  background: '#10B981',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: blocked || !artifact?.validation?.passed || artifact?.review?.status !== 'SUCCEEDED' || draft != null ? 'not-allowed' : 'pointer',
                  opacity: blocked || !artifact?.validation?.passed || artifact?.review?.status !== 'SUCCEEDED' || draft != null ? 0.6 : 1,
                  boxShadow: '0 2px 4px rgba(16, 185, 129, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                disabled={blocked || !manualConfirmed || !artifact?.validation?.passed || artifact?.review?.status !== 'SUCCEEDED' || draft != null}
                onClick={() => call('/approve', { target, revision: data.revision, resolution: reason })}
              >
                ✓ Aprobar esta versión y continuar a la siguiente fase →
              </button>
            </div>
          )}

          {/* ── SECCIÓN RUNTIME Y SWAGGER EN VIVO ────────────────────────────── */}
          {mode === 'implementation' && (
            <div style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: '10px',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.1rem' }}>🚀</span>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#166534', margin: 0 }}>
                    Entorno Real de Pruebas y Swagger Interactivo
                  </h3>
                </div>
                <p style={{ fontSize: '0.78rem', color: '#15803D', margin: '4px 0 0 28px' }}>
                  Levanta el servidor Node.js aislado conectado a PostgreSQL para probar rutas y ejecutar contratos.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  style={{
                    background: '#16A34A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: busy || running || !verifiedStages.has(3) ? 'not-allowed' : 'pointer',
                    opacity: busy || running || !verifiedStages.has(3) ? 0.6 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
                  }}
                  disabled={busy || running || !verifiedStages.has(3)}
                  onClick={() => call('/preview/start')}
                >
                  ⚡ Levantar entorno real de pruebas
                </button>

                {preview && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a
                      href={previewLink(preview.swagger)}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        background: '#0F172A',
                        color: '#FFFFFF',
                        textDecoration: 'none',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      📖 Abrir Swagger (Try it out) ↗
                    </a>
                    <a
                      href={previewLink(preview.url)}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        background: '#FFFFFF',
                        color: '#0F172A',
                        border: '1px solid #CBD5E1',
                        textDecoration: 'none',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 600
                      }}
                    >
                      🌐 Abrir aplicación de pruebas
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── ACCORDIONS DE DIAGNÓSTICO Y ESPECIFICACIÓN ────────────────────── */}
          {data.contractError && <p role="alert">Contrato pendiente: {data.contractError}</p>}
          {mode === 'implementation' && stage === 7 && artifact?.validation?.endpoints && <p>
            <a href={artifact.validation.endpoints.application} target="_blank" rel="noreferrer">Probar aplicación en los contenedores verificados</a>
            {' · '}<a href={artifact.validation.endpoints.api + '/api/health'} target="_blank" rel="noreferrer">Comprobar API del contenedor</a>
          </p>}
          {mode === 'mockups' && artifact?.content?.html && <div>
            <h3>Diseño de esta versión · {artifact.version}</h3>
            <iframe title="Diseño generado por Stitch" sandbox="" src={apiUrl(base + '/mockups/' + encodeURIComponent(screenId) + '/html')} style={{ width: '100%', height: 500, border: '1px solid #ddd' }} />
          </div>}
          {mode === 'implementation' && <details><summary>Archivos de la versión de trabajo</summary>
            <select aria-label="Archivo generado" className="form-control" value={selectedFile} onChange={async e => {
              setSelectedFile(e.target.value); setFile(null);
              try { setFile(await request(base + '/files?path=' + encodeURIComponent(e.target.value))); } catch (err) { setError(err.message); }
            }}><option value="">Seleccione archivo</option>{Object.keys(data.files || {}).filter(name => !/(^|\/)\.env(?:$|\.(?!example$))|secret/.test(name)).map(name => <option key={name} value={name}>{name}</option>)}</select>
            <pre style={{ maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{file?.content}</pre>
          </details>}
          <details open={!!active || data.jobs?.[0]?.status === 'FAILED'}><summary>Trabajos, progreso, errores y recuperación</summary>
            <p>{data.paused ? 'Pausado' : active ? active.target + ': ' + active.status : 'Sin trabajo activo'}</p>
            {mode === 'mockups' && <label>ID remoto de Stitch para recuperar una generación<input className="form-control" value={remoteScreenId} onChange={e => setRemoteScreenId(e.target.value)} /></label>}
            {(data.jobs || []).map(job => <article key={job.id} style={{ borderBottom: '1px solid #ddd', padding: 8 }}>
              <strong>{job.target} / {job.task}: {job.status}</strong>
              {job.error && <p role="alert">{job.error}</p>}
              <pre style={{ maxHeight: 180, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{(job.logs || []).map(line => line.at + ' ' + line.message).join('\n')}</pre>
              {job.result && <details><summary>Resultado y evidencia</summary><pre style={{ maxHeight: 250, overflow: 'auto' }}>{JSON.stringify(job.result, null, 2)}</pre></details>}
              {['FAILED', 'INTERRUPTED', 'PAUSED'].includes(job.status) && <button className="btn btn-secondary" disabled={busy || running || job.attempts >= 3} onClick={() => call('/control', { action: 'resume', jobId: job.id, ...(remoteScreenId ? { remoteScreenId } : {}) })}>Reanudar este trabajo</button>}
            </article>)}
          </details>
          <details><summary>Consumo reportado por proveedores</summary>{(data.calls || []).map(call => <p key={call.id}>{call.provider} · {call.model} · {call.target}/{call.task} · {call.status} · {call.usage ? JSON.stringify(call.usage) : 'Consumo desconocido'} {call.error}</p>)}</details>
          {mode === 'implementation' && <details><summary>Solicitar cambios y revisar impacto</summary>
            <label>Cambio solicitado<textarea className="form-control" value={changeReason} onChange={e => setChangeReason(e.target.value)} /></label>
            <label>Referencias afectadas (lista JSON con tipo e ID)<textarea className="form-control" value={affected} onChange={e => setAffected(e.target.value)} /></label>
            <button className="btn btn-secondary" disabled={busy || running || !changeReason.trim()} onClick={() => { try { call('/changes', { reason: changeReason, affected: JSON.parse(affected), files: selectedFile ? [selectedFile] : [], revision: data.revision, stage }); } catch { setError('Ingrese una lista JSON válida de referencias.'); } }}>Registrar cambio e impacto</button>
            {(data.changes || []).map(change => <article key={change.id}><p>{change.reason} · {change.status}</p><button className="btn btn-secondary" onClick={() => setChangeId(change.id)}>Revisar esta solicitud</button></article>)}
            {changeId && <div><button className="btn btn-secondary" onClick={() => setChangeId('')}>Volver a las etapas</button><button className="btn btn-secondary" disabled={blocked} onClick={() => task('prepare')}>Preparar cambios</button><button className="btn btn-secondary" disabled={blocked || !artifact?.approval} onClick={() => task('execute')}>Aplicar propuesta aprobada</button></div>}
          </details>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <details style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
              <summary style={{ padding: '10px 14px', fontWeight: 600, fontSize: '0.82rem', color: '#334155', cursor: 'pointer' }}>
                📋 Especificación y Contenido JSON de esta versión
              </summary>
              <div style={{ padding: '14px', borderTop: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                {canEdit ? (
                  <div>
                    <textarea
                      style={{ width: '100%', minHeight: '220px', padding: '10px', fontFamily: 'monospace', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #CBD5E1' }}
                      value={content}
                      onChange={editContent}
                      spellCheck={false}
                    />
                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Motivo del cambio..."
                        style={{ flex: 1, padding: '7px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8rem' }}
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                      />
                      <button
                        type="button"
                        style={{ background: '#4F46E5', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                        disabled={blocked || draft == null || !reason.trim()}
                        onClick={() => {
                          try {
                            const parsed = JSON.parse(draft);
                            call('/artifacts', { target, content: parsed, revision: draftRevision, reason }, 'PUT');
                          } catch {
                            setError('La especificación debe contener JSON válido.');
                          }
                        }}
                      >
                        Guardar cambios
                      </button>
                    </div>
                  </div>
                ) : (
                  <pre style={{ maxHeight: '250px', overflow: 'auto', fontSize: '0.75rem', margin: 0, padding: '10px', background: '#F8FAFC', borderRadius: '6px' }}>
                    {JSON.stringify(artifact?.content || {}, null, 2)}
                  </pre>
                )}
              </div>
            </details>

            <details style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
              <summary style={{ padding: '10px 14px', fontWeight: 600, fontSize: '0.82rem', color: '#334155', cursor: 'pointer' }}>
                🔍 Observaciones de Sonnet y correcciones propuestas
              </summary>
              <div style={{ padding: '14px', borderTop: '1px solid #E2E8F0', background: '#FFFFFF', fontSize: '0.82rem' }}>
                {artifact?.review?.error && (
                  <p style={{ color: '#DC2626', fontWeight: 600 }}>{artifact.review.error}</p>
                )}
                <p style={{ color: '#64748B', margin: '0 0 10px 0' }}>
                  Inspección visual: <b>{artifact?.review?.visualInspection || 'NOT_PERFORMED'}</b>
                </p>
                {(artifact?.review?.observations || []).map((o, i) => (
                  <div key={i} style={{ padding: '8px 10px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '6px', color: '#92400E', marginBottom: '6px' }}>
                    {o.reason}
                  </div>
                ))}
                {(artifact?.review?.corrections || []).map((correction, i) => <div key={i}><p>{correction.reason}</p><pre>Anterior: {JSON.stringify(correction.before)}</pre><pre>Propuesto: {JSON.stringify(correction.after)}</pre></div>)}
                {(artifact?.review?.questions || []).map((q, i) => (
                  <div key={i} style={{ padding: '8px 10px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '6px', color: '#1E40AF', marginBottom: '6px' }}>
                    {typeof q === 'string' ? q : JSON.stringify(q)}
                  </div>
                ))}
              </div>
            </details>

            <details style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
              <summary style={{ padding: '10px 14px', fontWeight: 600, fontSize: '0.82rem', color: '#334155', cursor: 'pointer' }}>
                🧪 Evidencia de pruebas ejecutadas
              </summary>
              <div style={{ padding: '14px', borderTop: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                <pre style={{ maxHeight: '250px', overflow: 'auto', fontSize: '0.75rem', margin: 0, padding: '10px', background: '#0F172A', color: '#F8FAFC', borderRadius: '6px' }}>
                  {JSON.stringify(artifact?.validation || { passed: false, message: 'No hay evidencia ejecutada' }, null, 2)}
                </pre>
              </div>
            </details>
          </div>

          {/* ── DESCARGA DE ENTREGA FINAL VERIFICADA ─────────────────────────── */}
          {mode === 'implementation' && verifiedStages.has(7) && data.stages?.[7]?.validation?.containerBehaviorPassed && (
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <a
                style={{
                  background: '#0F172A',
                  color: '#FFFFFF',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(15, 23, 42, 0.25)'
                }}
                href={apiUrl(base + '/download')} onClick={async e => { e.preventDefault(); setBusy(true); setError(''); try { await codegenApi.downloadZip(project.id); } catch (err) { setError(err.message); } finally { setBusy(false); } }}
              >
                📦 Descargar Entrega Verificada (ZIP)
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
