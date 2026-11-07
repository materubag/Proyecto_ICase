import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';

export default function UsuarioPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [formData, setFormData] = useState({
  "email": "",
  "password": "",
  "rolId": ""
});
  const [rolOptions, setRolOptions] = useState([]);

  const loadData = () => {
    setLoading(true);
    setServerError(null);
    apiRequest('/usuarios')
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
    apiRequest('/roles').then(res => setRolOptions(Array.isArray(res) ? res : [])).catch(() => {});
  }, []);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
  "email": "",
  "password": "",
  "rolId": ""
});
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
        const itemPk = editingItem['idUsuario'] ?? editingItem.id;
        await apiRequest(`/usuarios/${itemPk}`, {
          method: 'PUT',
          body: formData
        });
      } else {
        await apiRequest('/usuarios', {
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
      await apiRequest(`/usuarios/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert(`No se pudo eliminar: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Gestión de Usuario</h2>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '4px 0 0' }}>
            Módulo operativo para la entidad Usuario
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#2563eb', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
          onClick={handleOpenCreate}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
          Nuevo Usuario
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
          <p style={{ marginTop: '10px', color: '#64748b' }}>No existen registros de Usuario creados.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>idUsuario</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>email</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>password</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>rolId</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const itemPk = item['idUsuario'] ?? item.id;
                return (
                  <tr key={itemPk} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>{String(item.idUsuario ?? '')}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>{String(item.email ?? '')}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>{String(item.password ?? '')}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>{String(item.rolId ?? '')}</td>
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
              {editingItem ? `Editar ${modelName} #${editingItem['idUsuario'] ?? editingItem.id}` : `Nuevo ${modelName}`}
            </h3>

            {serverError && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', marginBottom: '14px', fontSize: '0.85rem' }}>
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label htmlFor="email" style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>
                  email *
                </label>
                <input
                  type="text"
                  id="email"
                  className="form-control"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  value={formData.email || ''}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label htmlFor="password" style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>
                  password *
                </label>
                <input
                  type="text"
                  id="password"
                  className="form-control"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  value={formData.password || ''}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, fontSize: '0.85rem' }}>
                  rolId *
                </label>
                <select
                  className="form-control"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  value={formData.rolId || ''}
                  onChange={e => setFormData({ ...formData, rolId: e.target.value })}
                  required
                >
                  <option value="">-- Seleccionar Rol --</option>
                  {rolOptions.map(opt => {
                    const optId = opt['id'] ?? opt.id;
                    return (
                      <option key={optId} value={optId}>
                        {opt.nombre || opt.name || opt.titulo || opt.title || opt.codigo || opt.code || `ID #${optId}`}
                      </option>
                    );
                  })}
                </select>
              </div>
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
