/**
 * Dynamic Functional Pages Generator for React 18 SPA
 * Produces interactive, accessible, domain-agnostic CRUD pages with live API persistence,
 * relational lookups, validation preservation and clean error feedback.
 */

const { buildFieldContract, renderFields } = require('./screenContract');
const { deriveNaming, toPascalCase, toCamelCase } = require('./typeMapper');

/**
 * Generates an interactive CRUD page component for any domain entity.
 */
function generateEntityViewPage(entity, relationships = [], entities = [], options = {}) {
  const naming = deriveNaming(entity.name);
  const modelName = naming.modelName;
  const pkAttr = (entity.attributes || []).find(a => a.isPk) || { fieldName: 'id' };
  const pkField = pkAttr.fieldName || pkAttr.name || 'id';
  const endpoint = naming.endpoint;
  const fields = buildFieldContract(entity, relationships, entities);
  const formAttrs = fields.filter(a => a.mode === 'editable' && a.fieldName !== 'id' && !a.isPk && (a.relation || !/Id$/i.test(a.fieldName || '')));

  const fkLookups = formAttrs.filter(f => f.relation).map(f => ({
    fieldName: f.fieldName, targetModel: f.relation.entityId,
    targetEndpoint: (f.relation.endpoint || '').replace(/^\/api\//, ''),
    stateName: toCamelCase(f.fieldName) + 'Options', pkField: f.relation.valueField,
    labelField: f.relation.labelField
  }));

  // State hooks for relational lookup options
  const lookupStates = fkLookups.map(l => `  const [${l.stateName}, set${toPascalCase(l.stateName)}] = useState([]);`).join('\n');
  const lookupFetches = fkLookups.map(l => `    apiRequest('/${l.targetEndpoint}').then(res => set${toPascalCase(l.stateName)}(Array.isArray(res) ? res : [])).catch(err => setServerError(err.message));`).join('\n');

  // Initial form state
  const initialFormState = Object.fromEntries(
    formAttrs.map(a => [a.fieldName, a.defaultValue != null ? a.defaultValue : ((a.dataType || '').includes('BOOLEAN') ? false : '')])
  );

  // Form input elements
  const permissions = Object.fromEntries(['POST', 'PUT', 'DELETE'].map(method => [method, options.operations?.find(op => op.entity === modelName && op.method === method)?.authorizedRoles || []]));
  const inputElements = renderFields(fields, { lookup: f => fkLookups.find(l => l.fieldName === f.fieldName)?.stateName, editingFlag: 'editingItem' });

  const tableFields = formAttrs.filter(a => a.control !== 'password').slice(0, 6);
  const thHeaders = tableFields.map(a => `<th>${a.label || a.fieldName}</th>`).join('\n                ');
  const tdCells = tableFields.map(a => {
    if (a.relation) {
      const lookup = fkLookups.find(l => l.fieldName === a.fieldName);
      return `<td data-label={${JSON.stringify(a.label || a.fieldName)}}>{(${lookup.stateName}.find(opt => String(opt[${JSON.stringify(lookup.pkField)}]) === String(item.${a.fieldName})) || {})[${JSON.stringify(lookup.labelField)}] || 'Seleccionar pendiente'}</td>`;
    }
    return `<td data-label={${JSON.stringify(a.label || a.fieldName)}}>{String(item.${a.fieldName} ?? '')}</td>`;
  }).join('\n                ');

  return `import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';

export default function ${modelName}Page() {
  const permissions = ${JSON.stringify(permissions)};
  const role = JSON.parse(localStorage.getItem('user') || 'null')?.role;
  const canCreate = ${!options.hasAuth} || permissions.POST.includes(role);
  const canUpdate = ${!options.hasAuth} || permissions.PUT.includes(role);
  const canDelete = ${!options.hasAuth} || permissions.DELETE.includes(role);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [formData, setFormData] = useState(${JSON.stringify(initialFormState, null, 2)});
${lookupStates}

  const loadData = () => {
    setLoading(true);
    setServerError(null);
    apiRequest('/${endpoint}')
      .then(data => {
        setItems(Array.isArray(data) ? data : []);
      })
      .catch(err => {
        setServerError(err.message || 'Error al cargar los registros');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
${lookupFetches}
  }, []);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData(${JSON.stringify(initialFormState, null, 2)});
    setServerError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({ ...item, ${formAttrs.filter(a => a.control === 'password').map(a => `${a.fieldName}: ''`).join(', ')} });
    setServerError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setServerError(null);

    try {
      if (editingItem) {
        const itemPk = editingItem['${pkField}'] ?? editingItem.id;
        await apiRequest(\`/${endpoint}/\${itemPk}\`, {
          method: 'PUT',
          body: formData
        });
      } else {
        await apiRequest('/${endpoint}', {
          method: 'POST',
          body: formData
        });
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      setServerError(err.message || 'Error al guardar los cambios');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este registro?')) return;
    try {
      await apiRequest(\`/${endpoint}/\${id}\`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert(\`No se pudo eliminar: \${err.message}\`);
    }
  };

  return (
    <div className="contract-task entity-page">
      <section className="contract-panel">
        <h1>${entity.name || modelName}</h1>
        <p className="contract-purpose">${entity.description || `Registra y consulta ${(entity.name || modelName).toLowerCase()} sin capturar identificadores a mano.`}</p>
        {canCreate && <button type="button" data-action-id="nuevo" onClick={handleOpenCreate}>Nuevo</button>}
      </section>

      {serverError && !modalOpen && (
        <p role="alert" className="contract-error">{serverError}</p>
      )}

      {loading ? (
        <p role="status">Cargando…</p>
      ) : items.length === 0 ? (
        <section className="contract-panel"><p>Sin registros.</p></section>
      ) : (
        <div className="contract-table">
          <table>
            <thead>
              <tr>
                ${thHeaders}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const itemPk = item['${pkField}'] ?? item.id;
                return (
                  <tr key={itemPk}>
                  ${tdCells}
                    <td>
                      {canUpdate && <button type="button" onClick={() => handleOpenEdit(item)}>Editar</button>}
                      {canDelete && <button type="button" onClick={() => handleDelete(itemPk)}>Eliminar</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="contract-image-preview" style={{ background: '#0f172a88' }}>
          <div className="contract-panel" style={{ width: 'min(520px, 92vw)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2>{editingItem ? 'Editar' : 'Nuevo'}</h2>
            {serverError && <p role="alert" className="contract-error">{serverError}</p>}
            <form data-contract-form="true" onSubmit={handleSubmit}>
${inputElements}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                <button type="button" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button data-action-id="guardar" type="submit" disabled={actionLoading}>
                  {actionLoading ? 'Guardando…' : (editingItem ? 'Actualizar' : 'Guardar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
`;
}

module.exports = {
  generateEntityViewPage
};
