import React, { useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { requirementsApi } from '../api/requirements.api';
import Modal from '../components/common/Modal';

export default function ProjectRequirements({ project, onProjectUpdated }) {
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [editingReq, setEditingReq] = useState(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('FUNCTIONAL');
  const [priority, setPriority] = useState('MEDIUM');
  const [status, setStatus] = useState('PENDING');
  const [actorIdsStr, setActorIdsStr] = useState('');
  const [dependenciesStr, setDependenciesStr] = useState('');
  const [savingReq, setSavingReq] = useState(false);

  const requirements = project.requirements || [];
  const actorsMap = new Map((project.actors || []).map(a => [a.codeId || a.id, a.name]));

  function openNewReqModal() {
    setEditingReq(null);
    const count = requirements.length + 1;
    setCode(`RF-${count < 10 ? '0' + count : count}`);
    setName('');
    setDescription('');
    setType('FUNCTIONAL');
    setPriority('MEDIUM');
    setStatus('PENDING');
    setActorIdsStr('');
    setDependenciesStr('');
    setReqModalOpen(true);
  }

  function openEditReqModal(req) {
    setEditingReq(req);
    setCode(req.code);
    setName(req.name);
    setDescription(req.description);
    setType(req.type);
    setPriority(req.priority);
    setStatus(req.status);
    setActorIdsStr((req.actorIds || []).join(', '));
    setDependenciesStr((req.dependencies || []).join(', '));
    setReqModalOpen(true);
  }

  async function handleSaveRequirement(e) {
    e.preventDefault();
    if (!code || !name || !description) return;

    try {
      setSavingReq(true);
      const actorIds = actorIdsStr.split(',').map(s => s.trim()).filter(Boolean);
      const dependencies = dependenciesStr.split(',').map(s => s.trim()).filter(Boolean);

      const payload = { code, name, description, type, priority, status, actorIds, dependencies };

      if (editingReq) {
        await requirementsApi.update(editingReq.id, payload);
      } else {
        await requirementsApi.create(project.id, payload);
      }
      setReqModalOpen(false);
      await onProjectUpdated();
    } catch (err) {
      alert(`Error al guardar requisito: ${err.message}`);
    } finally {
      setSavingReq(false);
    }
  }

  async function handleDeleteRequirement(id) {
    if (!window.confirm('¿Está seguro de eliminar este requisito?')) return;
    try {
      await requirementsApi.delete(id);
      await onProjectUpdated();
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Catálogo de Requisitos del Sistema</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Requisitos funcionales y no funcionales generados o editados manualmente.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNewReqModal}>
          <Plus size={14} />
          <span>Nuevo Requisito</span>
        </button>
      </div>

      {requirements.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            No hay requisitos registrados para este proyecto.
          </p>
          <button className="btn btn-primary btn-sm" onClick={openNewReqModal}>
            <Plus size={14} />
            <span>Crear Primer Requisito</span>
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '85px' }}>Código</th>
                <th style={{ width: '190px' }}>Nombre</th>
                <th>Descripción</th>
                <th style={{ width: '120px' }}>Tipo</th>
                <th style={{ width: '90px' }}>Prioridad</th>
                <th style={{ width: '130px' }}>Actor</th>
                <th style={{ width: '120px' }}>Dependencias</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((req) => (
                <tr key={req.id}>
                  <td>
                    <code style={{ fontWeight: 600, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                      {req.code}
                    </code>
                  </td>
                  <td style={{ fontWeight: 500 }}>{req.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{req.description}</td>
                  <td>
                    <span className="badge" style={{ backgroundColor: req.type === 'FUNCTIONAL' ? '#e0e7ff' : '#f1f5f9', color: req.type === 'FUNCTIONAL' ? '#3730a3' : '#475569' }}>
                      {req.type === 'FUNCTIONAL' ? 'Funcional' : 'No Funcional'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${req.priority.toLowerCase()}`}>
                      {req.priority === 'HIGH' ? 'Alta' : req.priority === 'MEDIUM' ? 'Media' : 'Baja'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {req.actorIds && req.actorIds.length > 0 ? (
                      req.actorIds.map((actId, i) => (
                        <span key={i} className="badge badge-planning" style={{ marginRight: '4px', marginBottom: '2px' }}>
                          {actorsMap.get(actId) || actId}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {req.dependencies && req.dependencies.length > 0 ? (
                      req.dependencies.map((dep, i) => (
                        <span key={i} className="badge badge-planning" style={{ marginRight: '4px', marginBottom: '2px' }}>
                          {dep}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px' }}
                        onClick={() => openEditReqModal(req)}
                        title="Editar"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px', color: 'var(--danger)' }}
                        onClick={() => handleDeleteRequirement(req.id)}
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Requisito */}
      <Modal
        isOpen={reqModalOpen}
        onClose={() => setReqModalOpen(false)}
        title={editingReq ? 'Editar Requisito' : 'Nuevo Requisito'}
        footer={(
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setReqModalOpen(false)}
              disabled={savingReq}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveRequirement}
              disabled={savingReq || !code || !name || !description}
            >
              {savingReq ? 'Guardando...' : 'Guardar Requisito'}
            </button>
          </>
        )}
      >
        <form onSubmit={handleSaveRequirement}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Código *</label>
              <input
                type="text"
                className="form-control"
                placeholder="RF-01"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre del Requisito *</label>
              <input
                type="text"
                className="form-control"
                placeholder="Ej: Catálogo de Libros"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Descripción Detallada *</label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="Descripción del comportamiento esperado..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-control" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="FUNCTIONAL">Funcional</option>
                <option value="NON_FUNCTIONAL">No Funcional</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Prioridad</label>
              <select className="form-control" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="HIGH">Alta</option>
                <option value="MEDIUM">Media</option>
                <option value="LOW">Baja</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Actores Asociados (separados por coma)</label>
              <input
                type="text"
                className="form-control"
                placeholder="ACT-01, ACT-02"
                value={actorIdsStr}
                onChange={(e) => setActorIdsStr(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Dependencias (códigos separados por coma)</label>
              <input
                type="text"
                className="form-control"
                placeholder="RF-01, RF-02"
                value={dependenciesStr}
                onChange={(e) => setDependenciesStr(e.target.value)}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
