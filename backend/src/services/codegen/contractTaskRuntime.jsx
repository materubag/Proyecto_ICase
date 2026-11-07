import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import ReviewedWorkspace from './ReviewedWorkspace';

function ApprovedActionForm({ definition, selectedOrder, onSaved }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({});
  const [data, setData] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  let role = '';
  try { const user = JSON.parse(localStorage.getItem('user') || '{}'); role = user.role || user.rol || ''; } catch (_) { /* The server also checks authorization. */ }
  const allowed = definition.permissions.includes(role);
  const reload = async () => {
    setLoading(true);
    try {
      const entries = await Promise.all(definition.dataSources.map(async source => {
        const result = await apiRequest(source.route);
        return [source.name, Array.isArray(result) ? result : result?.data || []];
      }));
      setData(Object.fromEntries(entries));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (allowed) reload(); }, [allowed]);
  if (!allowed) return null;
  const submit = async event => {
    event.preventDefault();
    if (busy || loading) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const payload = Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== '' && value != null && Object.hasOwn(definition.schema.properties, key)));
      for (const name of definition.schema.required || []) if (payload[name] == null) throw new Error('Campo requerido: ' + name);
      await apiRequest(definition.route, { method: 'POST', body: payload });
      setValues({}); setOpen(false); setMessage(definition.successMessage || 'Actividad registrada');
      await reload();
      await onSaved?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <section aria-label={definition.name} style={{ padding: '16px', border: '1px solid #dbe3ef', borderRadius: '8px', marginBottom: '16px', overflowWrap: 'anywhere' }}>
    <button type="button" style={{ background: '#4f46e5', color: '#fff', padding: '10px 16px', border: 0, borderRadius: '6px' }} data-action-id={definition.openActionId} disabled={loading} onClick={() => { setValues(selectedOrder ? { [definition.selectedOrderField]: Number(selectedOrder) } : {}); setError(''); setMessage(''); setOpen(true); }}>{definition.name}</button>
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    {open && <div role="dialog" aria-modal="true" aria-label={definition.name} onKeyDown={event => { if (event.key === 'Escape' && !busy) setOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#0008', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <form onSubmit={submit} style={{ background: 'white', color: '#172033', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '560px', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto' }}>
        <h2>{definition.name}</h2>
        <p>{definition.helpText || 'El responsable se obtiene de tu sesión. Registrar la actividad conserva el estado de la orden.'}</p>
        {definition.fields.map(field => <label key={field.fieldName} style={{ display: 'block', marginBottom: '12px' }}>
          {field.label}{field.required ? ' *' : ''}
          {field.source ? <select autoFocus={field.required} name={field.fieldName} required={field.required} value={values[field.fieldName] ?? ''} onChange={event => setValues(prev => ({ ...prev, [field.fieldName]: event.target.value === '' ? '' : Number(event.target.value) }))} style={{ display: 'block', width: '100%' }}>
            <option value="">Seleccionar</option>
            {(data[field.source] || []).map(row => <option value={row.id} key={row.id}>{field.labelFields.map(key => row[key]).filter(value => value != null).join(' · ')}</option>)}
          </select> : ['integer', 'number'].includes(field.type) ? <input type="number" name={field.fieldName} min={definition.schema.properties[field.fieldName]?.minimum} step={field.type === 'integer' ? 1 : 'any'} required={field.required} value={values[field.fieldName] ?? ''} onChange={event => setValues(prev => ({ ...prev, [field.fieldName]: event.target.value === '' ? '' : Number(event.target.value) }))} style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} /> : <textarea name={field.fieldName} maxLength={definition.schema.properties[field.fieldName]?.maxLength} required={field.required} value={values[field.fieldName] ?? ''} onChange={event => setValues(prev => ({ ...prev, [field.fieldName]: event.target.value }))} style={{ display: 'block', width: '100%', boxSizing: 'border-box' }} />}
        </label>)}
        <button style={{ background: '#4f46e5', color: '#fff', padding: '10px 16px', border: 0, borderRadius: '6px' }} data-action-id={definition.actionId} disabled={busy || loading} type="submit">{busy ? 'Guardando…' : definition.name}</button>
        <button style={{ background: '#e2e8f0', color: '#172033', padding: '10px 16px', border: 0, borderRadius: '6px', marginLeft: '8px' }} type="button" disabled={busy} onClick={() => setOpen(false)}>Cerrar</button>
      </form>
    </div>}
    <h3>{definition.historyTitle || 'Actividades registradas'}</h3>
    {loading ? <p>Cargando…</p> : !(data[definition.historySource] || []).length ? <p>{definition.emptyMessage || 'Sin actividades registradas'}</p> : <ul>{(data[definition.historySource] || []).map(row => <li key={row.id}>{definition.historyPrefix === undefined ? 'Orden ' + row.ordenTrabajoId + ': ' : definition.historyPrefix}{definition.historyFields.map(field => row[field]).filter(value => value !== null && value !== undefined && value !== '').join(' · ')}</li>)}</ul>}
  </section>;
}

function IndicatorDashboard({ contract }) {
  const definition = contract.dashboard;
  const [values, setValues] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const query = async payload => {
    setBusy(true); setError('');
    try {
      const response = await apiRequest(definition.route, { method: 'POST', body: payload });
      setResult(response?.data || response);
      try { sessionStorage.setItem(definition.storageKey, JSON.stringify(payload)); } catch (_) { /* Filters can also remain in memory. */ }
    } catch (err) { setResult(null); setError(err.message); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(definition.storageKey) || 'null');
      if (stored && contract.fields.every(field => typeof stored[field.fieldName] === 'string')) {
        const payload = Object.fromEntries(contract.fields.map(field => [field.fieldName, stored[field.fieldName]]));
        setValues(payload); query(payload);
      }
    } catch (_) { /* No prior valid filters. */ }
  }, []);
  const valueAt = (object, path) => String(path).split('.').reduce((value, key) => ['__proto__', 'constructor', 'prototype'].includes(key) ? undefined : value?.[key], object);
  const display = value => value == null ? 'Sin dato' : typeof value === 'boolean' ? value ? 'Disponible' : 'Sin stock' : String(value);
  const displayCell = (row, column) => column.format === 'dateTime' && row[column.field] != null
    ? new Intl.DateTimeFormat('es-EC', { timeZone: definition.timeZone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(row[column.field]))
    : display(row[column.field]);
  return <main style={{ padding: '16px', color: '#172033', overflowWrap: 'anywhere' }}>
    <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '12px' }}>{contract.purpose}</h1>
    <p>{contract.summary}</p>
    <form onSubmit={event => { event.preventDefault(); if (!busy) query(values); }} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: '16px', marginBottom: '20px' }}>
      {contract.fields.map(field => <label key={field.fieldName}>{field.label}<input name={field.fieldName} type="date" required value={values[field.fieldName] || ''} onChange={event => setValues(previous => ({ ...previous, [field.fieldName]: event.target.value }))} style={{ display: 'block', maxWidth: '100%' }} /></label>)}
      <button type="submit" data-action-id={contract.primaryActionId} disabled={busy} style={{ background: '#4f46e5', color: 'white', padding: '10px 16px', border: 0, borderRadius: '6px' }}>{busy ? 'Consultando…' : 'Consultar indicadores'}</button>
    </form>
    <p>Zona horaria: {definition.timeZone}. El período se aplica a las ventas; la fecha final queda excluida.</p>
    {busy && <p role="status">Consultando indicadores…</p>}
    {error && <p role="alert">{error}</p>}
    {!result && !busy && !error && <p>Selecciona el período y consulta los indicadores.</p>}
    {result && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '16px' }}>
      {definition.panels.map(panel => {
        const rows = panel.rowsPath ? valueAt(result, panel.rowsPath) || [] : [];
        return <section key={panel.id} aria-label={panel.title} style={{ minWidth: 0, background: 'white', border: '1px solid #dbe3ef', borderRadius: '8px', padding: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>{panel.title}</h2>
          {panel.valuePath && <p style={{ fontSize: '24px', fontWeight: 600 }}>{display(valueAt(result, panel.valuePath))}</p>}
          {panel.rowsPath && <div style={{ overflowX: 'auto' }}>{!rows.length ? <p>Sin registros (0)</p> : <table style={{ minWidth: '100%' }}><thead><tr>{panel.columns.map(column => <th key={column.field} style={{ textAlign: 'left', padding: '8px', whiteSpace: 'nowrap' }}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id ?? index}>{panel.columns.map(column => <td key={column.field} style={{ padding: '8px', whiteSpace: 'nowrap' }}>{displayCell(row, column)}</td>)}</tr>)}</tbody></table>}</div>}
        </section>;
      })}
    </div>}
  </main>;
}

export default function ContractTask(props) {
  return props.contract?.workspace ? <ReviewedWorkspace contract={props.contract} /> : props.contract?.dashboard ? <IndicatorDashboard contract={props.contract} /> : <ContractTaskBody {...props} />;
}

function ContractTaskBody({ contract, layout, onNavigate }) {
  contract = { ...contract, states: { loading: 'Cargando', empty: 'Sin registros', error: 'No se pudo completar la operación', confirmation: 'Operación completada', ...contract?.states } };
  const [data, setData] = useState({});
  const [values, setValues] = useState({});
  const [files, setFiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saved, setSaved] = useState(null);
  const [actionRows, setActionRows] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [filter, setFilter] = useState('');
  const fields = contract.fields || [];
  const sources = contract.dataSources || [];
  const reload = async () => {
    setLoading(true);
    try {
      const errors = [];
      const entries = await Promise.all(sources.map(async source => {
        try {
          const result = await apiRequest(source.route);
          return [source.name, Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : []];
        } catch (err) {
          errors.push(err.message);
          return [source.name, []];
        }
      }));
      setData(Object.fromEntries(entries));
      if (errors.length) setError(errors[0]);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, []);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  const previewImage = async url => {
    try {
      if (!url.startsWith('/api/')) throw new Error('La fotografía no tiene una ruta autorizada');
      const token = localStorage.getItem('token');
      const response = await fetch(url, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
      if (!response.ok) throw new Error('No se pudo consultar la fotografía');
      setImageUrl(URL.createObjectURL(await response.blob()));
    } catch (err) { setError(err.message); }
  };
  const label = (row, relation) => (relation.labelFields || [relation.labelField]).map(key => row?.[key]).filter(v => v !== undefined && v !== null && v !== '').join(' · ') || 'Sin etiqueta';
  const options = field => {
    const relation = field.relation || {};
    const source = sources.find(item => item.name === relation.dataSource || item.route === relation.endpoint);
    let rows = data[relation.dataSource] || data[source?.name] || [];
    if (relation.filter) rows = rows.filter(row => values[relation.filter.valueFrom] !== undefined && String(row[relation.filter.field]) === String(values[relation.filter.valueFrom]));
    return rows;
  };
  const setValue = (field, value) => {
    setValues(previous => {
      const next = { ...previous, [field.fieldName]: value };
      // Dependent selectors cannot retain an ID from another parent record.
      const clearChildren = parent => fields.filter(f => f.relation?.filter?.valueFrom === parent).forEach(child => {
        next[child.fieldName] = '';
        clearChildren(child.fieldName);
      });
      clearChildren(field.fieldName);
      return next;
    });
    setConfirmation('');
  };
  const setField = (name, value) => {
    const field = fields.find(item => item.fieldName === name) || { fieldName: name };
    const numeric = /INTEGER|FLOAT|DECIMAL|NUMBER|BIGINT/.test(field.dataType || '');
    setValue(field, value === '' || value === undefined || value === null ? '' : numeric ? Number(value) : value);
  };
  const submit = async (event, actionId = contract.primaryActionId) => {
    event?.preventDefault?.();
    if (busy || loading) return;
    setBusy(true); setError(''); setConfirmation('');
    try {
      if ((contract.unresolved || []).length) throw new Error('UNRESOLVED: contrato de pantalla incompleto');
      const action = contract.actions.find(a => a.actionId === actionId);
      if (!action) throw new Error('UNRESOLVED: acción principal');
      const schema = action.parameters?.bodySchema || action.input?.bodySchema;
      const payload = {};
      for (const field of fields.filter(f => f.mode === 'editable' && f.submit !== false && f.control !== 'files')) {
        const value = values[field.fieldName];
        if (value !== undefined && value !== '' && (!schema?.properties || Object.hasOwn(schema.properties, field.fieldName))) payload[field.fieldName] = value;
      }
      for (const field of fields.filter(f => f.control === 'files')) {
        payload[field.fieldName] = [];
        // Finish every selected upload before executing the business operation.
        for (const file of files[field.fieldName] || []) {
          const body = new FormData(); body.append('file', file);
          const token = localStorage.getItem('token');
          const response = await fetch(field.uploadEndpoint, { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body });
          const result = await response.json();
          if (!response.ok || !result.token) throw new Error(result.message || 'No se pudo cargar ' + file.name);
          payload[field.fieldName].push({ token: result.token });
        }
      }
      for (const name of schema?.required || []) if (payload[name] === undefined || payload[name] === '') throw new Error('Campo requerido: ' + name);
      const result = await apiRequest(action.route, { method: action.method, body: payload });
      const savedResult = result.data || result;
      setSaved(savedResult);
      if (Array.isArray(savedResult)) setActionRows(savedResult);
      setConfirmation(contract.states.confirmation);
      setValues({}); setFiles({});
      await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const form = <form data-contract-generic="true" data-contract-form="true" onSubmit={submit} aria-label={contract.purpose}>
    {fields.filter(f => f.mode === 'editable' && f.fieldName !== 'id' && f.control !== 'hidden' && !f.isPk && (f.relation || f.options || !/Id$/i.test(f.fieldName || ''))).map(field => {
      const numeric = /INTEGER|FLOAT|DECIMAL|NUMBER|BIGINT/.test(field.dataType || '');
      return <div className="form-group" key={field.fieldName}>
        <label htmlFor={field.fieldName}>{field.label || field.fieldName}{field.required ? ' *' : ''}</label>
        {field.control === 'files' ? <><input key={saved?.id || 'new'} id={field.fieldName} type="file" accept="image/*" multiple required={field.required} onChange={event => setFiles(prev => ({ ...prev, [field.fieldName]: Array.from(event.target.files) }))} />
          <p>{(files[field.fieldName] || []).map(file => file.name).join(', ') || 'Sin fotografías seleccionadas'}</p></>
          : (field.control === 'password' || /^(passwordHash|password_hash|password|contrasena|clave)$/i.test(field.fieldName || '')) ? <input id={field.fieldName} type="password" autoComplete="new-password" required={field.required} placeholder="Contraseña" value={values[field.fieldName] ?? ''} onChange={event => setValue(field, event.target.value)} />
          : field.relation ? <select id={field.fieldName} required={field.required} value={values[field.fieldName] ?? ''} onChange={event => setValue(field, event.target.value === '' ? '' : event.target.value === '' ? '' : numeric ? Number(event.target.value) : event.target.value)}>
            <option value="">{loading ? contract.states.loading : 'Seleccionar'}</option>
            {options(field).map(row => <option key={row[field.relation.valueField]} value={row[field.relation.valueField]}>{label(row, field.relation)}</option>)}
          </select> : field.options ? <select id={field.fieldName} required={field.required} value={values[field.fieldName] ?? ''} onChange={event => setValue(field, numeric ? Number(event.target.value) : event.target.value)}>
            <option value="">Seleccionar</option>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select> : <input id={field.fieldName} type={numeric ? 'number' : 'text'} step={numeric ? field.step || 'any' : undefined} min={field.minimum} max={field.maximum} required={field.required} value={values[field.fieldName] ?? ''} onChange={event => setValue(field, event.target.value === '' ? '' : numeric ? Number(event.target.value) : event.target.value)} />}
        {field.help && <small>{field.help}</small>}
      </div>;
    })}
    <button data-action-id={contract.primaryActionId} type="submit" disabled={busy || loading}>{busy ? 'Guardando…' : contract.actions.find(a => a.actionId === contract.primaryActionId)?.name}</button>
  </form>;
  const optionsFor = name => options(fields.find(item => item.fieldName === name) || {});
  const labelFor = (name, row) => {
    const field = fields.find(item => item.fieldName === name);
    return field?.relation ? label(row, field.relation) : String(row?.[field?.fieldName] ?? '');
  };
  const display = (row, column) => {
    const source = column.relation;
    const related = source && (data[source.dataSource] || []).find(item => String(item[source.valueField]) === String(row[column.field]));
    const attachments = column.attachments && (data[column.attachments.dataSource] || []).filter(file => String(file[column.attachments.foreignKey]) === String(row[column.field]));
    const text = column.options?.find(option => option.value === row[column.field])?.label ?? String(row[column.field] ?? '');
    if (attachments) return attachments.length ? attachments.map((file, index) => <button type="button" key={file.id} onClick={() => previewImage(file[column.attachments.urlField])}>Ver fotografía {index + 1}</button>) : 'Sin fotografías';
    if (source) return related ? label(related, source) : 'Sin vincular';
    return text;
  };
  const rows = (actionRows || data[contract.listSource] || []).filter(row => !filter || JSON.stringify(row).toLowerCase().includes(filter.toLowerCase()));
  const table = <div className="contract-table">
    <h2>{contract.listTitle || 'Registros'}</h2>
    {loading ? <p role="status">{contract.states.loading}</p> : !rows.length ? <p>{contract.states.empty}</p> : <table><thead><tr>{(contract.columns || []).map(column => <th key={column.field}>{column.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row[contract.valueField || 'id']}>{(contract.columns || []).map(column => {
      const source = column.relation;
      const related = source && (data[source.dataSource] || []).find(item => String(item[source.valueField]) === String(row[column.field]));
      const attachments = column.attachments && (data[column.attachments.dataSource] || []).filter(file => String(file[column.attachments.foreignKey]) === String(row[column.field]));
      const display = column.options?.find(option => option.value === row[column.field])?.label ?? String(row[column.field] ?? '');
      return <td key={column.field} data-label={column.label}>{attachments ? attachments.length ? attachments.map((file, index) => <button type="button" key={file.id} onClick={() => previewImage(file[column.attachments.urlField])}>Ver fotografía {index + 1}</button>) : 'Sin fotografías' : source ? related ? label(related, source) : 'Sin vincular' : display}</td>;
    })}</tr>)}</tbody></table>}
  </div>;
  return <div className="contract-task">
    {(contract.actionForms || []).map(definition => <ApprovedActionForm key={definition.actionId} definition={definition} selectedOrder={values.id} onSaved={reload} />)}
    {contract.visualReference && <p className="contract-reference-note">Vista en revisión: algunos paneles conservan ejemplos del diseño. Los formularios y listados vinculados consultan datos guardados.</p>}
    {(contract.unresolved || []).length > 0 && <div role="alert" className="contract-error"><strong>{contract.actionForms?.length ? 'Hay secciones pendientes de aprobación. Puedes usar las acciones aprobadas que aparecen arriba.' : 'UNRESOLVED — maqueta de referencia; puede contener datos ilustrativos. Envío bloqueado.'}</strong><ul>{contract.unresolved.map((message, index) => <li key={index}>{message}</li>)}</ul></div>}
    {imageUrl && <div role="dialog" aria-modal="true" aria-label="Fotografía de recepción" className="contract-image-preview" onKeyDown={event => { if (event.key === 'Escape') setImageUrl(null); }}><button type="button" autoFocus onClick={() => setImageUrl(null)}>Cerrar fotografía</button><img src={imageUrl} alt="Fotografía registrada en la recepción" /></div>}
    {error && <p role="alert" className="contract-error">{error}</p>}
    {confirmation && <p role="status" className="contract-success">{confirmation}{saved?.id ? ' · Registro ' + saved.id : ''}</p>}
    {layout({
      form, table,
      summary: <div><h2>Antes de confirmar</h2><p>{contract.summary}</p><p>{busy ? 'Guardando archivos y registros…' : 'Los datos se guardan al confirmar.'}</p></div>,
      values, setField, submit, execute: actionId => submit(null, actionId), rows, loading, busy, error, confirmation, filter, setFilter,
      updateFiles: (name, list) => setFiles(prev => ({ ...prev, [name]: list })),
      optionsFor, labelFor, display, columns: contract.columns || [], valueField: contract.valueField || 'id'
    })}
    <nav aria-label="Continuar el proceso">{(contract.navigation || []).map(item => <button type="button" key={item.route} onClick={() => onNavigate?.(item.key)}>{item.label}</button>)}</nav>
  </div>;
}
