import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

const caption = name => String(name).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/Id$/, ' ID').replace(/^./, char => char.toUpperCase());
const dataOf = result => result?.operationId ? result.data : result;
const roleOf = () => { try { const user = JSON.parse(localStorage.getItem('user') || '{}'); return user.role || user.rol || ''; } catch { return ''; } };
const permitted = (definition, role) => definition.permissions?.includes(role);
const key = () => globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random();
const initial = definition => definition.schema?.properties?.claveOperacion ? { claveOperacion: key() } : {};

function Result({ value }) {
  if (value == null) return <p>Sin registros.</p>;
  if (Array.isArray(value)) {
    if (!value.length) return <p>Sin registros.</p>;
    if (typeof value[0] !== 'object') return <ul>{value.map((item, index) => <li key={index}>{String(item)}</li>)}</ul>;
    const columns = [...new Set(value.flatMap(row => Object.keys(row || {})))].filter(field => !/password|hash|versionSesion|huella|filename/i.test(field));
    return <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{columns.map(field => <th key={field} style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>{caption(field)}</th>)}</tr></thead><tbody>{value.map((row, index) => <tr key={row.id || index}>{columns.map(field => <td key={field} style={{ padding: 8, borderBottom: '1px solid #e2e8f0', maxWidth: 260, overflowWrap: 'anywhere' }}>{field === 'urlOriginal' && typeof row[field] === 'string' && row[field].startsWith('/api/upload/files/') ? <PrivatePhoto url={row[field]} /> : row[field] !== null && typeof row[field] === 'object' ? <Result value={row[field]} /> : String(row[field] ?? '')}</td>)}</tr>)}</tbody></table></div>;
  }
  if (typeof value === 'object') return <Result value={[value]} />;
  return <p>{String(value)}</p>;
}

function PrivatePhoto({ url }) {
  const [source, setSource] = useState('');
  useEffect(() => {
    let active = true, objectUrl;
    fetch(url, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } }).then(response => { if (!response.ok) throw new Error('Fotografía no disponible'); return response.blob(); }).then(blob => { objectUrl = URL.createObjectURL(blob); if (active) setSource(objectUrl); else URL.revokeObjectURL(objectUrl); }).catch(() => {});
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  return source ? <a href={source} target="_blank" rel="noreferrer"><img src={source} alt="Evidencia del diagnóstico" style={{ maxWidth: 200, maxHeight: 160 }} /></a> : <span>Fotografía no disponible</span>;
}

function Fields({ properties, required = [], value, onChange, lookups, lookupData, parentValues, files, setFiles, prefix = '' }) {
  return Object.entries(properties || {}).filter(([name]) => name !== 'claveOperacion').map(([name, definition]) => {
    const path = prefix + name;
    const fieldValue = value[name];
    const set = next => onChange({ ...value, [name]: next });
    const must = required.includes(name);
    const label = caption(name);
    const style = { display: 'grid', gap: 5, minWidth: 0 };
    const inputStyle = { width: '100%', boxSizing: 'border-box', padding: 9, border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff' };
    if (name === 'archivoId' || name === 'evidencias') return <label key={path} style={style}>{label}{must ? ' *' : ''}<input name={path} type="file" accept="image/jpeg,image/png" multiple={name === 'evidencias'} required={must} onChange={event => setFiles(previous => ({ ...previous, [path]: [...event.target.files] }))} />{(files[path] || []).map(file => <span key={file.name}>{file.name}</span>)}</label>;
    if (definition.type === 'object') return <fieldset key={path} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}><legend>{label}</legend><Fields properties={definition.properties} required={definition.required} value={fieldValue || {}} onChange={set} lookups={lookups} lookupData={lookupData} parentValues={parentValues} files={files} setFiles={setFiles} prefix={path + '.'} /></fieldset>;
    if (definition.type === 'array') {
      const rows = fieldValue || [];
      return <fieldset key={path} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}><legend>{label}{must ? ' *' : ''}</legend>{rows.map((row, index) => <div key={index} style={{ marginBottom: 12, display: 'grid', gap: 8 }}><Fields properties={definition.items?.type === 'object' ? definition.items.properties : { valor: definition.items || text }} required={definition.items?.type === 'object' ? definition.items.required : ['valor']} value={definition.items?.type === 'object' ? row : { valor: row }} onChange={next => set(rows.map((item, i) => i === index ? definition.items?.type === 'object' ? next : next.valor : item))} lookups={lookups} lookupData={lookupData} parentValues={parentValues} files={files} setFiles={setFiles} prefix={path + '.' + index + '.'} /><button type="button" onClick={() => set(rows.filter((_, i) => i !== index))}>Quitar</button></div>)}<button type="button" onClick={() => set([...rows, definition.items?.type === 'object' ? {} : ''])}>Añadir {label.toLowerCase()}</button></fieldset>;
    }
    const source = lookups[name];
    let rows = lookupData[source?.operationId] || [];
    if (source?.filter && (parentValues[source.filter.from] !== undefined || !source.filter.optional)) rows = rows.filter(row => String(row[source.filter.field]) === String(parentValues[source.filter.from]));
    if (source?.route) return <label key={path} style={style}>{label}{must ? ' *' : ''}<select name={path} value={fieldValue ?? ''} required={must} style={inputStyle} onChange={event => set(event.target.value === '' ? undefined : Number(event.target.value))}><option value="">Seleccionar</option>{rows.map(row => <option key={row.id} value={row.id}>{source.label.map(field => row[field]).filter(item => item !== null && item !== undefined).join(' · ') || row.id}</option>)}</select></label>;
    if (definition.enum || definition.type === 'boolean') {
      const options = definition.enum || [true, false];
      return <label key={path} style={style}>{label}{must ? ' *' : ''}<select name={path} style={inputStyle} value={fieldValue === undefined ? '' : String(fieldValue)} required={must} onChange={event => set(event.target.value === '' ? undefined : definition.type === 'boolean' ? event.target.value === 'true' : event.target.value)}><option value="">Seleccionar</option>{options.map(item => <option key={String(item)} value={String(item)}>{typeof item === 'boolean' ? item ? 'Sí' : 'No' : item}</option>)}</select></label>;
    }
    const numeric = ['integer', 'number'].includes(definition.type);
    return <label key={path} style={style}>{label}{must ? ' *' : ''}<input name={path} type={/password/i.test(name) ? 'password' : numeric ? 'number' : definition.format === 'date-time' ? 'datetime-local' : definition.format === 'date' ? 'date' : definition.format === 'email' ? 'email' : 'text'} value={fieldValue ?? ''} required={must} min={definition.minimum ?? definition.exclusiveMinimum} max={definition.maximum} minLength={definition.minLength} maxLength={definition.maxLength} step={definition.type === 'integer' ? 1 : numeric ? 'any' : undefined} style={inputStyle} onChange={event => set(event.target.value === '' ? undefined : numeric ? Number(event.target.value) : event.target.value)} /></label>;
  });
}
const text = { type: 'string' };

export default function ReviewedWorkspace({ contract }) {
  const workspace = contract.workspace;
  const role = roleOf();
  const forms = workspace.forms.filter(form => permitted(form, role));
  const tables = workspace.tables.filter(table => permitted(table, role));
  const [active, setActive] = useState(forms[0]?.operationId || '');
  const form = forms.find(item => item.operationId === active);
  const [values, setValues] = useState(() => form ? initial(form) : {});
  const [files, setFiles] = useState({});
  const [lookupData, setLookupData] = useState({});
  const [availableSlots, setAvailableSlots] = useState([]);
  const [tableData, setTableData] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const storageKey = 'reviewed-query:' + JSON.parse(localStorage.getItem('user') || '{}').id + ':' + contract.purpose;
  const query = definition => apiRequest(definition.route, { method: definition.method, ...(definition.method === 'GET' ? {} : { body: {} }) });
  const reload = async () => {
    const readers = [...tables, ...Object.values(workspace.lookups || {}).filter(source => source.route && permitted(source, role))];
    const unique = [...new Map(readers.map(reader => [reader.operationId, reader])).values()];
    const responses = await Promise.allSettled(unique.map(async reader => [reader.operationId, dataOf(await query(reader))]));
    const successful = Object.fromEntries(responses.filter(response => response.status === 'fulfilled').map(response => response.value));
    setLookupData(successful); setTableData(successful);
    const failed = responses.find(response => response.status === 'rejected' && tables.some(table => table.route && table.operationId === unique[responses.indexOf(response)]?.operationId));
    if (failed) setError(failed.reason.message);
  };
  useEffect(() => {
    reload();
    let saved; try { saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch { return; }
    const reader = forms.find(item => item.operationId === saved?.operationId && item.readOnly);
    if (reader) { setActive(reader.operationId); setValues(saved.payload); apiRequest(reader.route, { method: reader.method, body: saved.payload }).then(response => { const value = dataOf(response); setResult(value); if (reader.operationId === 'UC-14-disponibilidad') setAvailableSlots(value); }).catch(error => setError(error.message)); }
  }, []);
  const normalize = (value, definition) => definition.type === 'object' ? Object.fromEntries(Object.entries(value || {}).filter(([, item]) => item !== undefined).map(([key, item]) => [key, normalize(item, definition.properties[key] || {})])) : definition.type === 'array' ? (value || []).map(item => normalize(item, definition.items || {})) : definition.format === 'date-time' && value ? new Date(value).toISOString() : value;
  const submit = async event => {
    event.preventDefault(); if (!form || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const payload = normalize(values, form.schema);
      for (const [field, selected] of Object.entries(files)) {
        const uploaded = [];
        for (const file of selected) {
          const body = new FormData(); body.append('file', file);
          if (payload.diagnosticoId) body.append('diagnosticoId', String(payload.diagnosticoId));
          uploaded.push(await apiRequest('/api/upload', { method: 'POST', body }));
        }
        payload[field] = field === 'archivoId' ? uploaded[0]?.archivoId : uploaded.map(item => ({ token: item.token }));
      }
      const response = dataOf(await apiRequest(form.route, { method: form.method, body: payload }));
      if (form.operationId === 'UC-14-disponibilidad') setAvailableSlots(response);
      setResult(response); setMessage('Operación completada.');
      if (form.readOnly) sessionStorage.setItem(storageKey, JSON.stringify({ operationId: form.operationId, payload }));
      else { sessionStorage.removeItem(storageKey); setValues(initial(form)); }
      setFiles({}); await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const slots = { operationId: 'availableSlots', route: true, label: ['inicio', 'fin'] };
  const lookups = { ...workspace.lookups, ...(workspace.clientOnly ? { espacioId: slots, nuevoEspacioId: slots } : {}) };
  return <main style={{ padding: 24, color: '#172033', maxWidth: 1400, margin: '0 auto' }}>
    <h1 style={{ fontSize: 26, marginBottom: 16 }}>{contract.purpose}</h1>
    {forms.length > 0 && <><nav aria-label="Acciones" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>{forms.map(item => <button type="button" key={item.operationId} disabled={busy} onClick={() => { setActive(item.operationId); setValues(initial(item)); setFiles({}); setError(''); setResult(null); setMessage(''); }} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: active === item.operationId ? '#4f46e5' : 'white', color: active === item.operationId ? 'white' : '#172033' }}>{item.name}</button>)}</nav>{form && <form onSubmit={submit} aria-label={form.name} style={{ background: '#fff', border: '1px solid #dbe3ef', borderRadius: 12, padding: 20, display: 'grid', gap: 14, marginBottom: 20 }}><h2>{form.name}</h2><Fields properties={form.schema.properties} required={form.schema.required} value={values} onChange={setValues} parentValues={values} lookups={lookups} lookupData={{ ...lookupData, availableSlots }} files={files} setFiles={setFiles} /><button data-action-id={form.operationId} disabled={busy} style={{ justifySelf: 'start', padding: '10px 18px', border: 0, borderRadius: 8, color: 'white', background: '#4f46e5' }}>{busy ? 'Procesando…' : form.name}</button></form>}</>}
    {error && <p role="alert" style={{ color: '#b91c1c', padding: 12, background: '#fff1f2' }}>{error}</p>}
    {message && <p role="status" style={{ color: '#166534' }}>{message}</p>}
    {result !== null && <section style={{ marginBottom: 24 }} aria-label="Resultado"><h2>Resultado</h2><Result value={result} /></section>}
    <button type="button" onClick={() => { setError(''); reload(); }} disabled={busy}>Actualizar listados</button>
    {tables.map(table => <section key={table.operationId} style={{ marginTop: 20, background: 'white', border: '1px solid #dbe3ef', padding: 16, borderRadius: 10 }}><h2>{table.name}</h2><Result value={tableData[table.operationId]} /></section>)}
  </main>;
}
