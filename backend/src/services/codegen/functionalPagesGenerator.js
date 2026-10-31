/**
 * Dynamic Functional Pages Generator for React 18 SPA
 * Produces interactive, accessible, domain-agnostic CRUD pages with live API persistence,
 * relational lookups, validation preservation and clean error feedback.
 */

const { deriveNaming, normalizeAttributes, toPascalCase, toCamelCase, toSnakeCasePlural } = require('./typeMapper');

/**
 * Generates an interactive CRUD page component for any domain entity.
 */
function generateEntityViewPage(entity, relationships = []) {
  const naming = deriveNaming(entity.name);
  const modelName = naming.modelName;
  const pkAttr = (entity.attributes || []).find(a => a.isPk) || { fieldName: 'id' };
  const pkField = pkAttr.fieldName || pkAttr.name || 'id';
  const endpoint = naming.endpoint;
  const normalizedAttrs = normalizeAttributes(entity.attributes || []);
  const formAttrs = normalizedAttrs.filter(a => !a.isPk);

  // Identify foreign keys strictly from explicit relationships in the specification
  const fkLookups = [];
  for (const rel of (relationships || [])) {
    const isSource = (rel.sourceEntityId === entity.id || rel.sourceEntity === naming.modelName || rel.source === entity.id || rel.source === entity.name);
    const isTarget = (rel.targetEntityId === entity.id || rel.targetEntity === naming.modelName || rel.target === entity.id || rel.target === entity.name);

    if (rel.cardinality === 'N:1' && isSource) {
      const targetNaming = deriveNaming(rel.targetEntity || rel.target || 'Item');
      const fkField = rel.foreignKey || `${targetNaming.paramName}Id`;
      if (formAttrs.some(a => a.fieldName === fkField)) {
        fkLookups.push({
          fieldName: fkField,
          targetModel: targetNaming.modelName,
          targetEndpoint: targetNaming.endpoint,
          stateName: `${toCamelCase(targetNaming.modelName)}Options`,
          pkField: targetNaming.pkField || 'id'
        });
      }
    } else if (rel.cardinality === '1:N' && isTarget) {
      const sourceNaming = deriveNaming(rel.sourceEntity || rel.source || 'Item');
      const fkField = rel.foreignKey || `${sourceNaming.paramName}Id`;
      if (formAttrs.some(a => a.fieldName === fkField)) {
        fkLookups.push({
          fieldName: fkField,
          targetModel: sourceNaming.modelName,
          targetEndpoint: sourceNaming.endpoint,
          stateName: `${toCamelCase(sourceNaming.modelName)}Options`,
          pkField: sourceNaming.pkField || 'id'
        });
      }
    }
  }

  // State hooks for relational lookup options
  const lookupStates = fkLookups.map(l => `  const [${l.stateName}, set${toPascalCase(l.stateName)}] = useState([]);`).join('\n');
  const lookupFetches = fkLookups.map(l => `    apiRequest('/${l.targetEndpoint}').then(res => set${toPascalCase(l.stateName)}(Array.isArray(res) ? res : [])).catch(() => {});`).join('\n');

  // Initial form state
  const initialFormState = Object.fromEntries(
    formAttrs.map(a => [a.fieldName, a.defaultValue !== null ? a.defaultValue : (a.dataType.includes('BOOLEAN') ? false : '')])
  );

  // Form input elements
  const inputElements = formAttrs.map(a => {
    const isFk = fkLookups.find(l => l.fieldName === a.fieldName);

    if (isFk) {
      return `              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>
                  ${a.fieldName} ${!a.allowNull ? '*' : ''}
                </label>
                <select
                  className="form-control"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  value={formData.${a.fieldName} || ''}
                  onChange={e => setFormData({ ...formData, ${a.fieldName}: e.target.value })}
                  ${!a.allowNull ? 'required' : ''}
                >
                  <option value="">-- Seleccionar ${isFk.targetModel} --</option>
                  {${isFk.stateName}.map(opt => {
                    const optId = opt['${isFk.pkField || 'id'}'] ?? opt.id;
                    return (
                      <option key={optId} value={optId}>
                        {opt.nombre || opt.name || opt.titulo || opt.title || opt.codigo || opt.code || \`ID #\${optId}\`}
                      </option>
                    );
                  })}
                </select>
              </div>`;
    }

    if (a.dataType.includes('BOOLEAN')) {
      return `              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <input
                  type="checkbox"
                  id="${a.fieldName}"
                  checked={Boolean(formData.${a.fieldName})}
                  onChange={e => setFormData({ ...formData, ${a.fieldName}: e.target.checked })}
                />
                <label htmlFor="${a.fieldName}" style={{ fontSize: '0.85rem', fontWeight: 500, margin: 0 }}>
                  ${a.fieldName}
                </label>
              </div>`;
    }

    let inputType = 'text';
    if (a.dataType.includes('INTEGER') || a.dataType.includes('DECIMAL') || a.dataType.includes('FLOAT') || a.dataType.includes('BIGINT')) {
      inputType = 'number';
    } else if (a.dataType.includes('DATEONLY')) {
      inputType = 'date';
    } else if (a.dataType.includes('DATE')) {
      inputType = 'datetime-local';
    }

    if (a.dataType.includes('TEXT')) {
      return `              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label htmlFor="${a.fieldName}" style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>
                  ${a.fieldName} ${!a.allowNull ? '*' : ''}
                </label>
                <textarea
                  id="${a.fieldName}"
                  className="form-control"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  rows={3}
                  value={formData.${a.fieldName} || ''}
                  onChange={e => setFormData({ ...formData, ${a.fieldName}: e.target.value })}
                  ${!a.allowNull ? 'required' : ''}
                />
              </div>`;
    }

    return `              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label htmlFor="${a.fieldName}" style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>
                  ${a.fieldName} ${!a.allowNull ? '*' : ''}
                </label>
                <input
                  type="${inputType}"
                  id="${a.fieldName}"
                  className="form-control"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  value={formData.${a.fieldName} || ''}
                  onChange={e => setFormData({ ...formData, ${a.fieldName}: e.target.value })}
                  ${!a.allowNull ? 'required' : ''}
                />
              </div>`;
  }).join('\n');

  // Table headers and cell displays
  const thHeaders = normalizedAttrs.slice(0, 6).map(a => `<th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>${a.fieldName}</th>`).join('\n                ');
  const tdCells = normalizedAttrs.slice(0, 6).map(a => `<td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>{String(item.${a.fieldName} ?? '')}</td>`).join('\n                ');

  return `import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';

export default function ${modelName}Page() {
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
    setFormData({ ...item });
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
    <div style={{ padding: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Gestión de ${modelName}</h2>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '4px 0 0' }}>
            ${entity.description || `Módulo operativo para la entidad ${modelName}`}
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#2563eb', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
          onClick={handleOpenCreate}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
          Nuevo ${modelName}
        </button>
      </div>

      {serverError && !modalOpen && (
        <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #f87171', color: '#b91c1c', borderRadius: '6px', marginBottom: '16px' }}>
          <strong>Error del Servidor:</strong> {serverError}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          <p>Cargando datos desde la API...</p>
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#94a3b8' }}>inbox</span>
          <p style={{ marginTop: '10px', color: '#64748b' }}>No existen registros de ${modelName} creados.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                ${thHeaders}
                <th style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const itemPk = item['${pkField}'] ?? item.id;
                return (
                  <tr key={itemPk} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  ${tdCells}
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', marginRight: '8px' }}
                        onClick={() => handleOpenEdit(item)}
                        title="Editar"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                      </button>
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                        onClick={() => handleDelete(itemPk)}
                        title="Eliminar"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: '#fff', borderRadius: '8px', width: '90%', maxWidth: '520px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', fontWeight: 700, fontSize: '1.15rem' }}>
              {editingItem ? \`Editar \${modelName} #\${editingItem['${pkField}'] ?? editingItem.id}\` : \`Nuevo \${modelName}\`}
            </h3>

            {serverError && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem' }}>
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
${inputElements}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                <button
                  type="button"
                  style={{ padding: '8px 16px', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  onClick={() => setModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  {actionLoading ? 'Guardando...' : (editingItem ? 'Actualizar' : 'Crear')}
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
