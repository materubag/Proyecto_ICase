import React from 'react';
const labels = { name: 'Nombre', description: 'Descripción', code: 'Código', type: 'Tipo de dato', route: 'Ruta', version: 'Versión conocida', style: 'Nombre de arquitectura' };
export default function ModelEditor({ kind, value, onChange, data, targetId }) {
  let content;
  try { content = JSON.parse(value); } catch { return <textarea className="form-control" rows={12} value={value} onChange={e => onChange(e.target.value)} aria-label="Corregir contenido" />; }
  const set = (key, v) => onChange(JSON.stringify({ ...content, [key]: v }, null, 2));
  const field = key => <label key={key} className="form-group">{labels[key] || key}<input className="form-control" value={content[key] ?? ''} onChange={e => set(key, e.target.value)} /></label>;
  const select = (key, title, rows, multiple = false) => <label className="form-group">{title}<select multiple={multiple} className="form-control" value={content[key] || (multiple ? [] : '')} onChange={e => set(key, multiple ? [...e.target.selectedOptions].map(o => o.value) : e.target.value || null)}>{!multiple && <option value="">No especificado</option>}{rows.map(r => <option key={r.id} value={r.id}>{r.name || r.id}</option>)}</select></label>;
  const approved = type => (data[type] || []).filter(x => x.status === 'APPROVED' && x.id !== targetId);
  const options = values => values.map(id => ({ id, name: id }));
  return <div style={{ display: 'grid', gap: 12 }}>
    {field(content.style !== undefined && content.name === undefined ? 'style' : 'name')}
    {['Actor', 'Entity', 'UseCase', 'BusinessRule', 'EntityRelationship'].includes(kind) && <label>Descripción<textarea className="form-control" value={content.description || ''} onChange={e => set('description', e.target.value)} rows={3} /></label>}
    {kind === 'UseCase' && <>{field('code')}{select('actorIds', 'Actores confirmados', approved('Actor'), true)}</>}
    {kind === 'EntityAttribute' && <>{select('entityId', 'Entidad', approved('Entity'))}{field('type')}<label><input type="checkbox" checked={content.isPk === true} onChange={e => set('isPk', e.target.checked)} /> Clave primaria confirmada</label></>}
    {kind === 'EntityRelationship' && <>{select('source', 'Entidad de origen', approved('Entity'))}{select('target', 'Entidad de destino', approved('Entity'))}{select('cardinality', 'Cardinalidad confirmada', [{ id: 'ONE_TO_ONE', name: 'Uno a uno' }, { id: 'ONE_TO_MANY', name: 'Uno a muchos' }, { id: 'MANY_TO_MANY', name: 'Muchos a muchos' }])}</>}
    {kind === 'NavigationNode' && <>{field('route')}{select('platform', 'Plataforma', options(['UNKNOWN', 'WEB', 'MOBILE', 'BOTH']))}{select('parentId', 'Pantalla anterior', approved('NavigationNode'))}{select('actorIds', 'Actores', approved('Actor'), true)}{select('useCaseIds', 'Casos de uso', approved('UseCase'), true)}</>}
    {kind === 'Technology' && <>{field('version')}{select('category', 'Categoría', options(['FRONTEND', 'BACKEND', 'DATABASE', 'INFRASTRUCTURE', 'AI', 'AUTOMATION', 'MOBILE', 'OTHER']))}</>}
    {kind === 'Architecture' && <>
      {select('kind', 'Artefacto de arquitectura', [{ id: 'SOFTWARE_ARCHITECTURE', name: 'Software: capas, módulos, servicios' }, { id: 'SYSTEM_ARCHITECTURE', name: 'Sistema: dispositivos e infraestructura' }])}
      <h4>Componentes confirmados</h4>{(content.components || []).map((c, index) => <div key={index} className="grid-2"><input aria-label={`Componente ${index + 1}`} placeholder="Nombre confirmado" className="form-control" value={c.name} onChange={e => set('components', content.components.map((x, i) => i === index ? { ...x, name: e.target.value } : x))} /><input aria-label={`Capa ${index + 1}`} placeholder="Capa o ubicación, si se conoce" className="form-control" value={c.layer || ''} onChange={e => set('components', content.components.map((x, i) => i === index ? { ...x, layer: e.target.value } : x))} /></div>)}
      <button className="btn btn-outline" onClick={() => set('components', [...(content.components || []), { name: '', layer: '' }])}>Agregar componente</button>
      <h4>Conexiones con evidencia</h4>{(content.connections || []).map((c, index) => <div key={index} className="info-card">{['from', 'to'].map(key => <select aria-label={`${key} conexión ${index + 1}`} key={key} className="form-control" value={c[key]} onChange={e => set('connections', content.connections.map((x, i) => i === index ? { ...x, [key]: e.target.value } : x))}><option value="">{key === 'from' ? 'Origen' : 'Destino'}</option>{(content.components || []).filter(x => x.name).map(x => <option key={x.name}>{x.name}</option>)}</select>)}<input aria-label={`Evidencia conexión ${index + 1}`} placeholder="Evidencia de la conexión" className="form-control" value={c.evidence} onChange={e => set('connections', content.connections.map((x, i) => i === index ? { ...x, evidence: e.target.value } : x))} /></div>)}
      <button className="btn btn-outline" onClick={() => set('connections', [...(content.connections || []), { from: '', to: '', evidence: '' }])}>Agregar conexión</button>
    </>}
    <details><summary>Edición estructurada avanzada</summary><textarea className="form-control" rows={12} value={value} onChange={e => onChange(e.target.value)} aria-label="Contenido estructurado" /></details>
  </div>;
}
