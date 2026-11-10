import React, { useEffect, useState } from 'react';
import { request } from '../api/client';
const names = ['Stack tecnológico', 'Estructura del proyecto', 'Base de datos', 'Endpoints y Swagger', 'Backend integrado', 'Frontend conectado', 'Docker y entrega'];
export default function DeliveryWorkflowPanel({ project, mode = 'implementation', onProjectUpdated }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(1), [screenId, setScreenId] = useState(''), [endpoint, setEndpoint] = useState(''), [endpointPhase, setEndpointPhase] = useState('definition');
  const [draft, setDraft] = useState(null), [draftRevision, setDraftRevision] = useState(null), [reason, setReason] = useState('');
  const [selectedFile, setSelectedFile] = useState(''), [file, setFile] = useState(null), [preview, setPreview] = useState(null);
  const [changeReason, setChangeReason] = useState(''), [affected, setAffected] = useState('[]'),[changeId,setChangeId]=useState(''),[remoteScreenId,setRemoteScreenId]=useState('');
  const base = `/projects/${project.id}/codegen/workflow`;
  async function refresh() { const value = await request(base); setData(value); return value; }
  useEffect(() => { refresh().catch(e => setError(e.message)); const timer = setInterval(() => refresh().catch(e => setError(e.message)), 2500); return () => clearInterval(timer); }, [project.id]);
  useEffect(() => { setDraft(null); setFile(null); }, [stage, endpoint, endpointPhase, mode, screenId]);
  const target = changeId ? `change:${changeId}` : mode === 'screens' ? 'screens' : mode === 'mockups' ? `mockup:${screenId}` : stage === 4 && endpoint ? `${endpointPhase}:${endpoint}` : String(stage);
  const artifact = changeId ? data?.changes.find(c=>c.id===changeId)?.proposal : mode === 'screens' ? data?.catalog : mode === 'mockups' ? data?.mockups?.[screenId] : stage === 4 && endpoint ? data?.endpoints?.[endpoint]?.[endpointPhase] : data?.stages?.[stage];
  const active = data?.jobs?.find(j => j.id === data.activeJobId);
  const running = active && ['RUNNING', 'QUEUED'].includes(active.status);
  const previousApproved = !!changeId || mode !== 'implementation' || stage === 1 || !!data?.stages?.[stage - 1]?.approval;
  const blocked = busy || running || data?.paused || !data?.documentApproved || !previousApproved || mode === 'implementation' && stage === 4 && endpointPhase === 'execution' && !!endpoint && !data?.endpoints?.[endpoint]?.definition?.approval;
  async function call(path, body, method = 'POST') {
    setBusy(true); setError('');
    try { const result = await request(base + path, { method, ...(body ? { body } : {}) });
      if (path === '/artifacts') setDraft(null);
      if (path === '/preview/start') setPreview(result);
      await refresh(); if (path === '/approve') await onProjectUpdated?.(); return result;
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const task = name => call('/tasks', { target, task: name,options:{requestId:crypto.randomUUID()} });
  const editContent = event => { if (draft == null) setDraftRevision(data.revision); setDraft(event.target.value); };
  const content = draft ?? JSON.stringify(artifact?.content || (mode === 'screens' ? { screens: [], questions: [] } : {}), null, 2);
  const canEdit = !!changeId || mode === 'screens' || mode === 'implementation' && (stage === 1 || stage === 4 && endpoint && endpointPhase === 'definition');
  const heading = mode === 'screens' ? 'Especificación funcional de pantallas' : mode === 'mockups' ? 'Diseños de Google Stitch' : 'Implementación por etapas';
  return <section className="delivery-workflow card" style={{ marginBottom: 24, padding: 20 }} aria-label={heading}>
    <h2>{heading}</h2>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    {!data ? <p>Consultando versiones y trabajos guardados…</p> : <>
      <p>Contexto: {data.prerequisites.context ? 'aprobado' : 'pendiente'} · Actores: {data.prerequisites.actors ? 'aprobados' : 'pendientes'} · Requisitos: {data.prerequisites.requirements ? 'aprobados' : 'pendientes'}</p>
      <details><summary>Estado de reglas, modelos y mockups necesarios</summary>
        <ul>{(data.prerequisites.rules || []).map(r => <li key={r.id}>Regla {r.name}: {r.status}</li>)}{(data.prerequisites.models || []).map(r => <li key={r.id}>Modelo {r.name}: {r.status}</li>)}{data.prerequisites.mockups.map(m => <li key={m.id}>Mockup {m.id} v{m.version}: {m.approved ? 'aprobado' : 'pendiente o desactualizado'}</li>)}</ul>
        <p>Catálogo funcional de pantallas: {data.prerequisites.catalog ? 'aprobado' : 'pendiente o desactualizado'}</p>
      </details>
      {!data.documentApproved && <p role="status">Complete las aprobaciones vigentes del flujo documental antes de continuar.</p>}
      {mode === 'implementation' && <ol style={{ display: 'flex', flexWrap: 'wrap', gap: 14, paddingLeft: 20 }}>{names.map((name, i) => <li key={name} style={{ minWidth: 190 }}><button className="btn btn-secondary" onClick={() => { setStage(i + 1); setEndpoint(''); }}>{i + 1}. {name}</button><p>{data.stages[i + 1]?.approval ? `Aprobada v${data.stages[i + 1].version}` : data.stages[i + 1]?.review?.status || 'Sin ejecutar'}</p></li>)}</ol>}
      {mode === 'mockups' && <><p>Solo se envían a Stitch pantallas del catálogo funcional aprobado. Cada diseño requiere su propia revisión y aprobación.</p><select className="form-control" aria-label="Pantalla aprobada" value={screenId} onChange={e => setScreenId(e.target.value)}><option value="">Seleccione pantalla</option>{data.catalog?.content?.screens?.map(s => <option key={s.id} value={s.id}>{s.name} · {s.route}</option>)}</select></>}
      {mode === 'implementation' && stage === 4 && <>
        <p>Cada endpoint tiene dos aprobaciones: definición y funcionamiento después de pruebas reales. Al terminar todos, valide y apruebe el cierre de esta etapa.</p>
        <select className="form-control" aria-label="Endpoint" value={endpoint} onChange={e => setEndpoint(e.target.value)}><option value="">Cierre de la etapa: todos los endpoints</option>{data.availableOperations.map(op => <option key={op.id} value={op.id}>{op.method} {op.route} · {op.name}</option>)}</select>
        {endpoint && <div><button className="btn btn-secondary" onClick={() => setEndpointPhase('definition')}>Definición</button><button className="btn btn-secondary" onClick={() => setEndpointPhase('execution')}>Funcionamiento</button><p>Definición: {data.endpoints[endpoint]?.definition?.approval ? 'aprobada' : 'pendiente'} · Funcionamiento: {data.endpoints[endpoint]?.execution?.approval ? 'aprobado' : 'pendiente'}</p></div>}
      </>}
      <h3>{changeId?'Cambio incremental':mode === 'implementation' ? `${stage}. ${names[stage - 1]}` : mode === 'screens' ? 'Catálogo' : data.catalog?.content.screens.find(s => s.id === screenId)?.name} · versión {artifact?.version || 'sin preparar'}</h3>
      {changeId&&<><button className="btn btn-secondary" onClick={()=>setChangeId('')}>Volver a las etapas</button><button className="btn btn-secondary" disabled={blocked} onClick={()=>task('prepare')}>Preparar cambios con Luna</button><button className="btn btn-secondary" disabled={blocked||!artifact} onClick={()=>task('validate')}>Validar propuesta incremental</button><button className="btn btn-secondary" disabled={blocked||!artifact?.approval} onClick={()=>task('execute')}>Aplicar archivos aprobados sin sobrescribir otros archivos</button></>}
      <p>Validación iCASE: {artifact?.validation?.passed ? 'correcta' : 'pendiente o fallida'} · Revisión Sonnet: {artifact?.review?.status || 'PENDING'} · Aprobación humana: {artifact?.approval ? `versión ${artifact.approval.version}` : 'pendiente'}</p>
      {!previousApproved && <p>La etapa anterior debe pasar sus comprobaciones y recibir aprobación humana.</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBlock: 12 }}>
        {(mode === 'screens' || mode === 'implementation' && (stage === 1 || stage === 4 && endpoint && endpointPhase === 'definition')) && <button className="btn btn-primary" disabled={blocked || draft != null} onClick={() => task('prepare')}>Proponer con Luna</button>}
        {mode === 'mockups' && <button className="btn btn-primary" disabled={blocked || !screenId || !data.catalog?.approval} onClick={() => task('stitch')}>Generar esta pantalla en Stitch</button>}
        <button className="btn btn-secondary" disabled={blocked || draft != null || mode === 'mockups' && !artifact} onClick={() => task(mode === 'implementation' && stage >= 2 && !(stage === 4 && endpointPhase === 'definition' && endpoint) ? 'execute' : 'validate')}>{mode === 'implementation' && stage >= 2 && !(stage === 4 && endpointPhase === 'definition' && endpoint) ? 'Generar o ejecutar comprobaciones' : 'Validar o volver a validar'}</button>
        <button className="btn btn-secondary" disabled={blocked || !artifact || draft != null} onClick={() => task('review')}>Solicitar revisión Sonnet</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => call('/control', { action: 'pause', jobId: active?.id })}>Guardar y pausar</button>
        <button className="btn btn-secondary" disabled={busy} onClick={() => call('/control', { action: 'resume', jobId: active?.id })}>Reanudar</button>
        {active && <button className="btn btn-secondary" disabled={busy} onClick={() => call('/control', { action: 'cancel', jobId: active.id })}>Cancelar trabajo</button>}
      </div>
      <details open={mode === 'screens' || mode === 'implementation' && stage === 4 && endpointPhase === 'definition'}><summary>Especificación, preguntas y resultados de esta versión</summary>
        {canEdit ? <label>Especificación editable<textarea className="form-control" rows={20} value={content} onChange={editContent} spellCheck={false} /></label> : <pre style={{ maxHeight: 350, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{JSON.stringify(artifact?.content || {}, null, 2)}</pre>}
        {canEdit && <button className="btn btn-secondary" disabled={blocked || draft == null || !reason.trim()} onClick={() => { try { const parsed = JSON.parse(draft); call('/artifacts', { target, content: parsed, revision: draftRevision, reason }, 'PUT'); } catch { setError('La especificación debe contener JSON válido.'); } }}>Guardar versión y solicitar nueva revisión</button>}
      </details>
      <details><summary>Observaciones de Sonnet y diferencias propuestas</summary>{artifact?.review?.error && <p role="alert">{artifact.review.error}</p>}<p>Inspección visual Sonnet: {artifact?.review?.visualInspection || 'NOT_PERFORMED'}</p>
        {(artifact?.review?.observations || []).map((o, i) => <p key={i}>{o.reason}</p>)}{(artifact?.review?.corrections || []).map((o, i) => <div key={i}><p>{o.reason}</p><pre>Anterior: {JSON.stringify(o.before)}</pre><pre>Propuesto: {JSON.stringify(o.after)}</pre></div>)}{(artifact?.review?.questions || []).map((q, i) => <p key={i}>{typeof q === 'string' ? q : JSON.stringify(q)}</p>)}</details>
      <label>Motivo del cambio / resolución de observaciones<textarea className="form-control" value={reason} onChange={e => setReason(e.target.value)} /></label>
      {mode === 'implementation' && stage === 1&&!changeId ? <div>{['backend', 'database', 'frontend', 'services'].map(component => <button className="btn btn-primary" key={component} disabled={blocked || !artifact?.validation?.passed || artifact?.review?.status !== 'SUCCEEDED' || draft != null} onClick={() => call('/approve', { target, revision: data.revision, component, resolution: reason })}>Aprobar {component} {artifact?.componentApprovals?.[component] ? '✓' : ''}</button>)}</div> : <button className="btn btn-primary" disabled={blocked || !artifact?.validation?.passed || artifact?.review?.status !== 'SUCCEEDED' || draft != null} onClick={() => call('/approve', { target, revision: data.revision, resolution: reason })}>Aprobar esta versión y continuar</button>}
      <details><summary>Evidencia de pruebas ejecutadas</summary><p>Una propuesta, una captura o una descarga ZIP no acreditan funcionamiento.</p><pre style={{ maxHeight: 350, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{JSON.stringify(artifact?.validation || { passed: false, message: 'No hay evidencia ejecutada' }, null, 2)}</pre></details>
      {mode === 'mockups' && artifact?.content?.html && <><h3>Vista previa del diseño</h3><iframe title="Diseño generado por Stitch" sandbox="" src={`/api${base}/mockups/${encodeURIComponent(screenId)}/html`} style={{ width: '100%', height: 550, border: '1px solid #ddd' }} /><p>Esta vista no acredita conexión con backend ni persistencia.</p></>}
      {mode === 'implementation' && <>
        <details><summary>Vista previa de archivos</summary><p>Inspección de código de la versión de trabajo.</p><select className="form-control" aria-label="Archivo generado" value={selectedFile} onChange={async e => { setSelectedFile(e.target.value); try { setFile(await request(`${base}/files?path=${encodeURIComponent(e.target.value)}`)); } catch (err) { setError(err.message); } }}><option value="">Seleccione archivo</option>{Object.keys(data.files).filter(f => !/(^|\/)\.env$|secret/.test(f)).map(f => <option key={f} value={f}>{f}</option>)}</select><pre style={{ maxHeight: 400, overflow: 'auto' }}>{file?.content}</pre></details>
        <h3>Vista previa ejecutable</h3><button className="btn btn-secondary" disabled={busy || running || !data.stages[3]?.approval} onClick={() => call('/preview/start')}>Levantar entorno real de pruebas</button>
        {preview && <p><a href={preview.url} target="_blank" rel="noreferrer">Abrir aplicación de pruebas</a> · <a href={preview.swagger} target="_blank" rel="noreferrer">Abrir Swagger y Try it out</a></p>}
        <details><summary>Solicitar cambios incrementales y revisar impacto</summary><label>Cambio solicitado<textarea className="form-control" value={changeReason} onChange={e => setChangeReason(e.target.value)} /></label><label>Referencias afectadas (tipo e ID)<textarea className="form-control" value={affected} onChange={e => setAffected(e.target.value)} /></label><button className="btn btn-secondary" disabled={busy || !changeReason.trim()} onClick={() => { try { call('/changes', { reason: changeReason, affected: JSON.parse(affected), files:selectedFile?[selectedFile]:[], revision: data.revision, stage }); } catch { setError('Las referencias deben ser una lista JSON de objetos type e id.'); } }}>Registrar impacto y solicitar revisión</button><p>Los requisitos, modelos y mockups aprobados no se modifican silenciosamente.</p>{data.changes.map(change=><article key={change.id}><p>{change.reason} · {change.status}</p><button className="btn btn-secondary" onClick={()=>{setChangeId(change.id);setDraft(null);}}>Inspeccionar y preparar esta solicitud</button><pre>{JSON.stringify(change.affected,null,2)}</pre></article>)}</details>
        {data.stages[7]?.approval && data.stages[7]?.validation?.containerBehaviorPassed && <a className="btn btn-primary" href={`/api${base}/download`}>Descargar entrega verificada</a>}
      </>}
      {mode === 'mockups' && <label>ID remoto de pantalla para recuperar una generación pendiente<input className="form-control" value={remoteScreenId} onChange={e=>setRemoteScreenId(e.target.value)} /></label>}
      <details open={!!active || data.jobs?.[0]?.status === 'FAILED'}><summary>Trabajos, progreso, errores y recuperación</summary><p>{data.paused ? 'Pausado' : active ? `Trabajo ${active.target}: ${active.status}` : 'Sin trabajo activo'}</p>{data.jobs.map(job => <article key={job.id} style={{ borderBottom: '1px solid #ddd', padding: 8 }}><b>{job.target} / {job.task}: {job.status}</b>{job.error && <p role="alert">{job.error}</p>}<pre style={{ maxHeight: 150, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{job.logs.map(l => `${l.at} ${l.message}`).join('\n')}</pre>{['FAILED', 'INTERRUPTED', 'PAUSED'].includes(job.status) && <button className="btn btn-secondary" disabled={busy || running} onClick={() => call('/control', { action: 'resume', jobId: job.id,...(remoteScreenId?{remoteScreenId}:{} ) })}>Reanudar este trabajo (máximo tres intentos)</button>}</article>)}</details>
      <details><summary>Consumo reportado por proveedores</summary>{data.calls.map(call => <p key={call.id}>{call.provider} · {call.model} · {call.target}/{call.task} · {call.status} · {call.usage ? JSON.stringify(call.usage) : 'Consumo desconocido'} {call.error}</p>)}</details>
    </>}
  </section>;
}
