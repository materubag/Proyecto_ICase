import React, { useEffect, useState } from 'react';
import { engineering } from '../api/engineering.api';
import MermaidDiagram from '../components/diagrams/MermaidDiagram';
import MockupRenderer from '../components/mockup-renderer/MockupRenderer';
import Modal from '../components/common/Modal';
import ImpactModal from '../components/common/ImpactModal';
import StatusBadge from '../components/common/StatusBadge';
import ModelEditor from '../components/ModelEditor';

const kinds = { Actor: 'Actores', UseCase: 'Casos de uso', Entity: 'Entidades', EntityAttribute: 'Atributos', EntityRelationship: 'Relaciones', BusinessRule: 'Reglas', NavigationNode: 'Navegación', Architecture: 'Arquitectura', Technology: 'Tecnologías' };
const diagramTypes = { ER_DIAGRAM: 'Entidad–relación', USE_CASE_DIAGRAM: 'Casos de uso', NAVIGATION_DIAGRAM: 'Navegación', SOFTWARE_ARCHITECTURE: 'Arquitectura de software', SYSTEM_ARCHITECTURE: 'Arquitectura del sistema' };
const examples = {
  Actor: { name: '', description: '' }, Entity: { name: '', description: '' }, BusinessRule: { name: '', description: '' },
  UseCase: { name: '', code: '', description: '', actorIds: [], relations: [] },
  EntityAttribute: { name: '', entityId: '', type: '', isPk: false },
  EntityRelationship: { name: '', source: '', target: '', cardinality: '', description: '' },
  NavigationNode: { name: '', route: '', platform: 'UNKNOWN', parentId: null, actorIds: [], useCaseIds: [] },
  Technology: { name: '', category: 'OTHER', version: null },
  Architecture: { name: '', kind: 'SOFTWARE_ARCHITECTURE', components: [], connections: [] }
};
const Json = ({ value }) => <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12, background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>{JSON.stringify(value, null, 2)}</pre>;

export default function ProjectEngineering({ project, view = 'chat', onProjectUpdated }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [kind, setKind] = useState('Actor'), [editor, setEditor] = useState(null), [content, setContent] = useState(''), [reqIds, setReqIds] = useState([]);
  const [selected, setSelected] = useState(null), [rendered, setRendered] = useState(false), [change, setChange] = useState(null);
  const [baselineName, setBaselineName] = useState(''), [before, setBefore] = useState(''), [after, setAfter] = useState(''), [comparison, setComparison] = useState(null);
  const [message, setMessage] = useState(''), [chat, setChat] = useState(null), [proposeChange, setProposeChange] = useState(false), [provider, setProvider] = useState('hybrid');
  const api = (path, body, method) => engineering(project.id, path, body, method);

  async function load() { setData(await api('')); }
  useEffect(() => { setSelected(null); setComparison(null); load().catch(e => setError(e.message)); }, [project.id, view]);
  async function run(fn) { setBusy(true); setError(''); try { const result = await fn(); await load(); await onProjectUpdated?.(); return result; } catch (e) { setError(e.message); } finally { setBusy(false); } }

  function inspect(v) { setSelected(v); setRendered(false); }
  async function reviewVersion(status) { await run(async () => { await api(`/versions/${selected.id}`, { status, renderedSuccessfully: rendered }, 'PATCH'); setSelected(null); }); }
  function versions() { return (data?.Artifact || []).flatMap(a => a.versions.map(v => ({ ...v, label: `${diagramTypes[a.type] || 'Mockup'} · ${a.name} · v${v.version}`, category: 'Artifact' }))).concat((data?.requirementVersions || []).map(v => ({ ...v, label: `${v.content.code} · v${v.version}`, category: 'Requirement' })), (data?.baselines || []).map(v => ({ ...v, label: `Baseline ${v.name} · v${v.version}`, category: 'Baseline' }))); }

  if (!data) return <div style={{ padding: 40, background: '#FFFFFF', height: '100%' }}>{error || 'Cargando información del proyecto…'}</div>;

  const viewHeaders = {
    chat: { title: 'Chat IA', badge: 'Asistente iCASE', desc: 'Consulta evidencia, reglas de negocio e impacto sobre tu arquitectura.' },
    traceability: { title: 'Trazabilidad', badge: 'Matriz ISO 29148', desc: 'Cobertura de requisitos respecto a fuentes y artefactos del sistema.' },
    changes: { title: 'Control de Cambios', badge: 'Auditoría', desc: 'Gestión y aprobación de cambios propuestos con análisis de impacto.' },
    versions: { title: 'Versiones', badge: 'Baselines', desc: 'Historial de versiones y control de instantáneas del proyecto.' }
  };
  const currentHeader = viewHeaders[view] || { title: 'Ingeniería', badge: 'Auditoría', desc: 'Configuración técnica avanzada.' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: '#FFFFFF', padding: '32px 40px' }}>
      {error && <div role="alert" className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Mockup Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              {currentHeader.title}
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
              {currentHeader.badge}
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: '6px 0 0 0' }}>
            {currentHeader.desc}
          </p>
        </div>

        {/* Header Right Actions */}
        {view === 'chat' && (
          <div style={{
            display: 'inline-flex',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '3px',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
          }}>
            {[
              ['hybrid', 'Híbrido (Claude + GPT)'],
              ['anthropic', 'Claude 3.5'],
              ['openai', 'GPT-4o mini'],
              ['ollama', 'Ollama IA'],
              ['local', 'Local']
            ].map(([pKey, label]) => (
              <button
                key={pKey}
                type="button"
                onClick={() => setProvider(pKey)}
                style={{
                  background: provider === pKey ? '#0F172A' : 'transparent',
                  color: provider === pKey ? '#FFFFFF' : '#64748B',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '0.8125rem',
                  fontWeight: provider === pKey ? 600 : 500,
                  cursor: 'pointer'
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── VIEW: CHAT IA ── */}
      {view === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '860px', width: '100%' }}>
          {/* Chat response */}
          {chat ? (
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span className="ms ms-sm" style={{ color: '#4F46E5' }}>smart_toy</span>
                <strong style={{ fontSize: '0.875rem', color: '#0F172A' }}>Respuesta de iCASE IA</strong>
              </div>
              <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#334155', margin: '0 0 16px 0', whiteSpace: 'pre-wrap' }}>
                {chat.answer}
              </p>
              {chat.context && (
                <details style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Ver contexto de evidencias y requisitos</summary>
                  <div style={{ marginTop: 8 }}><Json value={chat.context} /></div>
                </details>
              )}
            </div>
          ) : (
            <div style={{
              background: '#F8FAFC',
              border: '1px dashed #CBD5E1',
              borderRadius: '20px',
              padding: '32px',
              textAlign: 'center',
              color: '#64748B'
            }}>
              <span className="ms" style={{ fontSize: '32px', color: '#4F46E5', marginBottom: '8px' }}>chat</span>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#0F172A', fontWeight: 600 }}>Asistente del Proyecto</h3>
              <p style={{ margin: 0, fontSize: '0.8125rem' }}>Escribe tu consulta abajo para analizar requerimientos, validar arquitectura o proponer cambios.</p>
            </div>
          )}

          {/* Prompt input card */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '20px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
          }}>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="¿Qué deseas consultar o ajustar en la arquitectura y requisitos del proyecto?..."
              rows={3}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontSize: '0.875rem',
                color: '#0F172A',
                lineHeight: 1.5,
                background: 'transparent'
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid #F1F5F9', marginTop: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: '#64748B', cursor: 'pointer' }}>
                <input type="checkbox" checked={proposeChange} onChange={e => setProposeChange(e.target.checked)} />
                <span>Proponer cambio formal para revisión</span>
              </label>
              <button
                type="button"
                onClick={() => run(async () => setChat(await api('/chat', { message, proposeChange, provider })))}
                disabled={busy || !message.trim()}
                style={{
                  background: '#4F46E5',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 20px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(79, 70, 229, 0.25)'
                }}
              >
                {busy ? 'Consultando...' : 'Enviar consulta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW: TRAZABILIDAD ── */}
      {view === 'traceability' && (
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Requisito</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Fuente Original</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Modelos y Artefactos</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Estado de Cobertura</th>
              </tr>
            </thead>
            <tbody>
              {data.matrix.map(row => (
                <tr key={row.requirement.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: '#0F172A' }}>
                    {row.requirement.code}: {row.requirement.name}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#64748B' }}>
                    {data.sources.find(s => s.id === row.evidence?.sourceId)?.name || 'Manual / sin fuente'}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#334155' }}>
                    {row.coverage.map(c => (
                      <span key={c.id} style={{ display: 'inline-block', background: '#F1F5F9', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', margin: '2px 4px 2px 0' }}>
                        {c.type}
                      </span>
                    ))}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {row.missing.length === 0 ? (
                      <span style={{ color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 500 }}>
                        ✓ Cubierto
                      </span>
                    ) : (
                      <span style={{ color: '#D97706', background: '#FFFBEB', border: '1px solid #FDE68A', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 500 }}>
                        {row.missing.join(', ')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── VIEW: CAMBIOS ── */}
      {view === 'changes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {data.changes.length === 0 ? (
            <div style={{ background: '#F8FAFC', padding: '32px', borderRadius: '20px', border: '1px solid #E2E8F0', textAlign: 'center', color: '#64748B' }}>
              No hay cambios pendientes de aprobación.
            </div>
          ) : (
            data.changes.map(c => (
              <div key={c.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '0.875rem', color: '#0F172A' }}>{c.type}: {c.previousState.code || c.previousState.name || c.elementId}</strong>
                  <StatusBadge status={c.status} />
                </div>
                <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: '0 0 12px 0' }}>{c.reason}</p>
                {c.status === 'PENDING_APPROVAL' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setChange(c)}>Revisar impacto</button>
                    <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => run(() => api(`/changes/${c.id}`, { status: 'REJECTED' }, 'PATCH'))}>Rechazar</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── VIEW: VERSIONES ── */}
      {view === 'versions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '20px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Nombre de la nueva baseline..."
              value={baselineName}
              onChange={e => setBaselineName(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '0.8125rem' }}
            />
            <button
              type="button"
              onClick={() => run(() => api('/baselines', { name: baselineName }))}
              disabled={busy || !baselineName.trim()}
              style={{ background: '#4F46E5', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Crear baseline
            </button>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.875rem', fontWeight: 600, color: '#0F172A' }}>Historial de Artefactos</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {versions().slice(0, 15).map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F8FAFC', borderRadius: '8px', fontSize: '0.8125rem' }}>
                  <span style={{ fontWeight: 500, color: '#0F172A' }}>{v.label}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => inspect(v)} style={{ fontSize: '0.75rem' }}>
                    Consultar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modales */}
      <ImpactModal change={change} busy={busy} onClose={() => setChange(null)} onConfirm={() => run(async () => { await api(`/changes/${change.id}`, { status: 'APPROVED', confirmImpact: true }, 'PATCH'); setChange(null); })} />
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={`Versión ${selected?.version} · ${selected?.status}`} footer={<button className="btn btn-outline" onClick={() => setSelected(null)}>Cerrar</button>}>
        {selected?.renderedContent && <MermaidDiagram key={selected.id} code={selected.renderedContent} onValidated={(ok, err) => { setRendered(ok); if (!ok && selected.status === 'PENDING_REVIEW') run(async () => { await api(`/versions/${selected.id}`, { status: 'ERROR', error: err }, 'PATCH'); setSelected(v => ({ ...v, status: 'ERROR', technicalError: err })); }); }} />}
        {selected?.structuredContent?.screen && (selected.structuredContent.screen.html ? <iframe title="Mockup candidato" sandbox="" srcDoc={selected.structuredContent.screen.html} style={{ width: '100%', height: 500, border: 0 }} /> : <MockupRenderer screen={selected.structuredContent.screen} />)}
        <details style={{ marginTop: 12 }}><summary>Modelo estructurado</summary><Json value={selected?.structuredContent} /></details>
      </Modal>
    </div>
  );
}
