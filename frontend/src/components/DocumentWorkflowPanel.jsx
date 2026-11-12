import React, { useEffect, useState } from 'react';
import { request } from '../api/client';
const titles = { context: 'Contexto', actors: 'Actores', requirements: 'Requisitos y relaciones' };
const roleLabels = { INITIATES: 'Inicia', EXECUTES: 'Ejecuta', APPROVES: 'Aprueba', CONSULTS: 'Consulta', RECEIVES_INFORMATION: 'Recibe información' };
const lines = value => (value || []).join('\n');
const list = value => value.split('\n').filter(s => s.trim());
export default function DocumentWorkflowPanel({ project, stage: initialStage = 'context', onProjectUpdated }) {
  const [stage, setStage] = useState(initialStage);
  const [state, setState] = useState(null);
  const [draft, setDraft] = useState(null);
  const [draftRevision, setDraftRevision] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const base = `/projects/${project.id}/document-workflow`;
  async function refresh() { const next = await request(base); setState(next); return next; }
  useEffect(() => { setState(null); setDraft(null); refresh().catch(e => setError(e.message));
    const timer = setInterval(() => refresh().catch(e => setError(e.message)), 3000);
    return () => clearInterval(timer);
  }, [project.id]);
  useEffect(() => { if (!draft) return; setNotice('Hay cambios sin guardar. Guárdelos antes de revisar.'); }, [draft]);
  async function action(path, body, method = 'POST') {
    setBusy(true); setError(''); setNotice('');
    try {
      await request(`${base}${path}`, { method, body });
      if (method === 'PUT') setDraft(null);
      if (path.endsWith('/prepare') || path.endsWith('/review')) setNotice('Trabajo solicitado. El avance y las llamadas aparecerán aquí.');
      await refresh();
      if (path.endsWith('/approve')) await onProjectUpdated?.();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const artifact = state?.[stage];
  const content = draft || artifact?.content;
  const allowed = stage === 'context' || state?.context?.approval && (stage !== 'requirements' || state?.actors?.approval);
  const running = state?.calls?.some(c => c.status === 'RUNNING' && Date.now() - new Date(c.updatedAt).getTime() < 180000);
  const blocked = busy || running || !allowed;
  function change(patch) { if (!draft) setDraftRevision(state.revision); setDraft({ ...content, ...patch }); }
  function itemChange(index, patch) { change({ items: content.items.map((item, i) => i === index ? { ...item, ...patch } : item) }); }
  const approvedActors = (state?.actors?.approval && state.actors.content.items.filter(a => a.status !== 'REJECTED' && !a.mergedInto)) || [];
  return <section className="card" style={{ marginBottom: 24, flexShrink: 0, maxHeight: '75vh', overflowY: 'auto' }} aria-label="Análisis documental por etapas">
    <h2>Análisis documental por etapas</h2>
    <p>Extracción → Contexto → Actores → Requisitos y relaciones → Revisión final</p>
    <p>Extracción: {state ? `${state.units.length} unidades de texto disponibles` : 'Consultando…'}. Este orden es una decisión de producto de iCASE.</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{Object.entries(titles).map(([key, title]) => <button className="btn btn-secondary" key={key} onClick={() => { setStage(key); setDraft(null); setNotice(''); }}>{title}</button>)}</div>
    {error && <p role="alert" style={{ color: 'var(--danger, #b91c1c)' }}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {state?.legacyReviewRequired && <p>Los datos anteriores se conservan. Esta fase requiere revisión y aprobación de sus versiones actuales.</p>}
    <h3>{titles[stage]} · versión {artifact?.version || 'sin preparar'}</h3>
    <p>Preparado por Luna: {artifact ? 'Disponible' : 'Pendiente'} · Revisado por Sonnet: {artifact?.review?.status || 'PENDING'} · Validado por iCASE: {artifact?.validation || 'PENDING'} · Aprobado por el usuario: {artifact?.approval ? `versión ${artifact.approval.version}` : 'Pendiente'}</p>
    {artifact?.review?.error && <p role="alert">{artifact.review.error}</p>}
    {artifact?.validationError && <p role="alert">{artifact.validationError}</p>}
    {!allowed && <p>Apruebe primero el contexto y el catálogo de actores vigente.</p>}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button className="btn btn-secondary" disabled={blocked || !!draft} onClick={() => action(`/${stage}/prepare`)}>Preparar con Luna</button>
      <button className="btn btn-secondary" disabled={blocked || !artifact || !!draft} onClick={() => action(`/${stage}/review`)}>Revisar con Sonnet</button>
    </div>
    {content && <div>
      {stage === 'context' ? <label>Resumen general<textarea className="form-control" rows={6} value={content.summary || ''} onChange={e => change({ summary: e.target.value })} /></label> : <>
        {(content.items || []).map((item, index) => <article key={item.id || index} style={{ padding: 16, borderBottom: '1px solid #ddd' }}>
          <label>Nombre<input className="form-control" value={item.name || ''} onChange={e => itemChange(index, { name: e.target.value })} /></label>
          <label>Descripción<textarea className="form-control" value={item.description || ''} onChange={e => itemChange(index, { description: e.target.value })} /></label>
          <p>Origen: {item.origin} · {item.id}</p>
          <label>Clasificación del origen<select className="form-control" value={item.origin} onChange={e => itemChange(index, { origin: e.target.value })}><option value="EXPLICIT">Explícito en el documento</option><option value="INFERRED">Inferencia propuesta</option><option value="USER">Decisión del usuario</option></select></label>
          {stage === 'actors' ? <>
            <label>Alias (uno por línea)<textarea className="form-control" value={lines(item.aliases)} onChange={e => itemChange(index, { aliases: list(e.target.value) })} /></label>
            <label>Responsabilidades respaldadas<textarea className="form-control" value={lines(item.responsibilities)} onChange={e => itemChange(index, { responsibilities: list(e.target.value) })} /></label>
            <label>Fusionar en<select className="form-control" value={item.mergedInto || ''} onChange={e => itemChange(index, { mergedInto: e.target.value || null })}><option value="">Sin fusión</option>{content.items.filter(a => a.id !== item.id && !a.mergedInto && a.status !== 'REJECTED').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
          </> : <>
            <label>Tipo<select className="form-control" value={item.type} onChange={e => itemChange(index, { type: e.target.value })}><option value="FUNCTIONAL">RF</option><option value="NON_FUNCTIONAL">RNF</option></select></label>
            <label>Criterios de aceptación<textarea className="form-control" value={lines(item.acceptanceCriteria)} onChange={e => itemChange(index, { acceptanceCriteria: list(e.target.value) })} /></label>
            <label>Reglas<textarea className="form-control" value={lines(item.rules)} onChange={e => itemChange(index, { rules: list(e.target.value) })} /></label>
            <label>Dependencias (ID o código, uno por línea)<textarea className="form-control" value={lines(item.dependencies)} onChange={e => itemChange(index, { dependencies: list(e.target.value) })} /></label>
            {(item.participants || []).map((p, n) => <div key={n} style={{ display: 'flex', gap: 8 }}>
              <select aria-label="Participante" className="form-control" value={p.actorId} onChange={e => itemChange(index, { participants: item.participants.map((old, j) => j === n ? { ...old, actorId: e.target.value } : old) })}><option value="">Seleccione actor aprobado</option>{approvedActors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              <select aria-label="Participación" className="form-control" value={p.role} onChange={e => itemChange(index, { participants: item.participants.map((old, j) => j === n ? { ...old, role: e.target.value } : old) })}>{Object.entries(roleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select>
              <button className="btn btn-secondary" onClick={() => itemChange(index, { participants: item.participants.filter((_, j) => j !== n) })}>Quitar</button>
            </div>)}
            <button className="btn btn-secondary" onClick={() => itemChange(index, { participants: [...(item.participants || []), { actorId: approvedActors[0]?.id || '', role: 'EXECUTES' }] })}>Agregar participante</button>
          </>}
          <label>Preguntas pendientes<textarea className="form-control" value={lines(item.questions)} onChange={e => itemChange(index, { questions: list(e.target.value) })} /></label>
          <label>Estado<select className="form-control" value={item.status} onChange={e => itemChange(index, { status: e.target.value })}><option value="PENDING_REVIEW">Propuesto</option><option value="REJECTED">Rechazado</option></select></label>
          <details><summary>Evidencias originales ({item.evidence?.length || 0})</summary>{(item.evidence || []).map((e, n) => { const unit = state.units.find(u => u.id === e.unitId); return <blockquote key={n}><label>Fragmento literal<textarea className="form-control" value={e.quote || ''} onChange={event => itemChange(index, { evidence: item.evidence.map((old, j) => j === n ? { ...old, quote: event.target.value } : old) })} /></label><footer>{unit?.section} · página {unit?.page ?? 'no disponible'} · versión {e.sourceVersionId}</footer><p>{unit?.text}</p><button className="btn btn-secondary" onClick={() => itemChange(index, { evidence: item.evidence.filter((_, j) => j !== n) })}>Quitar cita</button></blockquote>; })}
            <label>Agregar evidencia desde una sección<select className="form-control" value="" onChange={event => { const unit = state.units.find(u => u.id === event.target.value); if (unit) itemChange(index, { evidence: [...(item.evidence || []), { unitId: unit.id, sourceVersionId: unit.sourceVersionId, quote: unit.text, page: unit.page, section: unit.section }] }); }}><option value="">Seleccione sección original</option>{state.units.map(u => <option key={u.id} value={u.id}>{u.section} · página {u.page ?? '?'} · {u.text.slice(0, 70)}</option>)}</select></label>
          </details>
        </article>)}
        <button className="btn btn-secondary" onClick={() => change({ items: [...(content.items || []), { id: crypto.randomUUID(), name: '', description: '', origin: 'USER', evidence: [], questions: [], aliases: [], responsibilities: [], type: 'FUNCTIONAL', participants: [], status: 'PENDING_REVIEW' }] })}>Agregar {stage === 'actors' ? 'actor' : 'requisito'} por decisión del usuario</button>
      </>}
      <label>Preguntas de la etapa<textarea className="form-control" value={lines(content.questions)} onChange={e => change({ questions: list(e.target.value) })} /></label>
      <details><summary>Observaciones y diferencias propuestas por Sonnet</summary>{artifact?.review?.outputs?.map((o, i) => <div key={i}>{o.observations.map((v, n) => <p key={n}>{v.reason}</p>)}{o.corrections.map((v, n) => <div key={n}><p>{v.reason}</p><p>Anterior: {typeof v.before === 'string' ? v.before : JSON.stringify(v.before)}</p><p>Propuesto: {typeof v.after === 'string' ? v.after : JSON.stringify(v.after)}</p></div>)}{o.questions.map((q, n) => <p key={n}>{typeof q === 'string' ? q : JSON.stringify(q)}</p>)}</div>)}</details>
      <label>Motivo del cambio / resolución de observaciones<textarea className="form-control" value={reason} onChange={e => setReason(e.target.value)} /></label>
      <button className="btn btn-secondary" disabled={blocked || !draft || !reason.trim()} onClick={() => action(`/${stage}`, { content: draft, revision: draftRevision, reason }, 'PUT')}>Guardar cambios y solicitar nueva revisión</button>
      <button className="btn btn-primary" disabled={blocked || !!draft || artifact?.review?.status !== 'SUCCEEDED'} onClick={() => action(`/${stage}/approve`, { revision: state.revision, resolution: reason })}>{stage === 'actors' ? 'Aprobar actores y continuar' : `Aprobar ${titles[stage].toLowerCase()}`}</button>
    </div>}
    <details><summary>Consumo y estado de llamadas</summary><table><thead><tr><th>Etapa / tarea</th><th>Proveedor / modelo</th><th>Estado</th><th>Consumo reportado</th><th>Reintento</th></tr></thead><tbody>{state?.calls?.map(call => <tr key={call.id}><td>{call.stage} / {call.task}</td><td>{call.provider} / {call.model || 'sin configurar'}</td><td>{call.status}<p>{call.error}</p></td><td>{call.usage ? JSON.stringify(call.usage) : 'Desconocido'}</td><td>{call.status !== 'SUCCEEDED' && <button className="btn btn-secondary" disabled={busy || call.attempts >= 3} onClick={() => action(`/calls/${call.id}/retry`)}>Habilitar reintento</button>}</td></tr>)}</tbody></table></details>
    <p>Revisión final: {state?.requirements?.approval ? 'Especificación aprobada disponible para los consumidores existentes.' : 'Pendiente de aprobación de requisitos y relaciones.'}</p>
  </section>;
}
