import React, { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

export default function ContractTask({ contract, layout, onNavigate }) {
  const [data, setData] = useState({});
  const [values, setValues] = useState({});
  const [files, setFiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saved, setSaved] = useState(null);
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
          return [source.name, Array.isArray(result) ? result : []];
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
  const submit = async event => {
    event?.preventDefault?.();
    if (busy || loading) return;
    setBusy(true); setError(''); setConfirmation('');
    try {
      const action = contract.actions.find(a => a.actionId === contract.primaryActionId);
      if (!action) throw new Error('UNRESOLVED: acción principal');
      const payload = {};
      for (const field of fields.filter(f => f.mode === 'editable' && f.submit !== false && f.control !== 'files')) {
        const value = values[field.fieldName];
        if (value !== undefined && value !== '') payload[field.fieldName] = value;
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
      const result = await apiRequest(action.route, { method: action.method, body: payload });
      setSaved(result.data || result);
      setConfirmation(contract.states.confirmation);
      setValues({}); setFiles({});
      await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const form = <form data-contract-form="true" onSubmit={submit} aria-label={contract.purpose}>
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
  const rows = (data[contract.listSource] || []).filter(row => !filter || JSON.stringify(row).toLowerCase().includes(filter.toLowerCase()));
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
    {imageUrl && <div role="dialog" aria-modal="true" aria-label="Fotografía de recepción" className="contract-image-preview" onKeyDown={event => { if (event.key === 'Escape') setImageUrl(null); }}><button type="button" autoFocus onClick={() => setImageUrl(null)}>Cerrar fotografía</button><img src={imageUrl} alt="Fotografía registrada en la recepción" /></div>}
    {error && <p role="alert" className="contract-error">{error}</p>}
    {confirmation && <p role="status" className="contract-success">{confirmation}{saved?.id ? ' · Registro ' + saved.id : ''}</p>}
    {layout({
      form, table,
      summary: <div><h2>Antes de confirmar</h2><p>{contract.summary}</p><p>{busy ? 'Guardando archivos y registros…' : 'Los datos se guardan al confirmar.'}</p></div>,
      values, setField, submit, rows, loading, busy, error, confirmation, filter, setFilter,
      updateFiles: (name, list) => setFiles(prev => ({ ...prev, [name]: list })),
      optionsFor, labelFor, display, columns: contract.columns || [], valueField: contract.valueField || 'id'
    })}
    <nav aria-label="Continuar el proceso">{(contract.navigation || []).map(item => <button type="button" key={item.route} onClick={() => onNavigate?.(item.key)}>{item.label}</button>)}</nav>
  </div>;
}
