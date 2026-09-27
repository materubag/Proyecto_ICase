import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Check, X, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { requirementsApi } from '../api/requirements.api';
import { historyApi } from '../api/history.api';
import Modal from '../components/common/Modal';

export default function ProjectRequirements({ project, onProjectUpdated }) {
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [editingReq, setEditingReq] = useState(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('FUNCTIONAL');
  const [priority, setPriority] = useState('MEDIUM');
  const [status, setStatus] = useState('PENDING');
  const [actorIdsStr, setActorIdsStr] = useState('');
  const [dependenciesStr, setDependenciesStr] = useState('');
  const [preconditions, setPreconditions] = useState('');
  const [postconditions, setPostconditions] = useState('');
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
    setPreconditions('El usuario debe contar con credenciales de acceso activas.');
    setPostconditions('El sistema persiste la transacción y emite confirmación.');
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
    setPreconditions(req.preconditions || '');
    setPostconditions(req.postconditions || '');
    setReqModalOpen(true);
  }

  async function handleSaveRequirement(e) {
    e.preventDefault();
    if (!code || !name || !description) {
      alert('Código, Nombre y Descripción son obligatorios.');
      return;
    }

    try {
      setSavingReq(true);
      const actorIds = actorIdsStr.split(',').map(s => s.trim()).filter(Boolean);
      const dependencies = dependenciesStr.split(',').map(s => s.trim()).filter(Boolean);

      const payload = {
        code,
        name,
        description,
        type,
        priority,
        status,
        actorIds,
        dependencies,
        preconditions,
        postconditions
      };

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

  // Gobernanza: Aceptar o Rechazar
  async function handleUpdateStatus(reqId, newStatus) {
    try {
      await requirementsApi.updateStatus(reqId, newStatus);
      await onProjectUpdated();
    } catch (err) {
      alert(`Error al actualizar estado: ${err.message}`);
    }
  }

  // Eliminación con aviso de cascada
  async function handleDeleteRequirement(req) {
    const confirmMessage = `¿Está seguro de eliminar el requisito ${req.code}: "${req.name}"?\n\n` +
      `⚠️ IMPACTO EN CASCADA:\n` +
      `- Se eliminará como dependencia de otros requisitos.\n` +
      `- Se actualizarán los Casos de Uso y Pantallas asociadas.\n` +
      `- Se guardará una versión de recuperación en el Historial para poder restaurarlo si fue un error.`;

    if (!window.confirm(confirmMessage)) return;

    try {
      await requirementsApi.delete(req.id);
      await onProjectUpdated();
    } catch (err) {
      alert(`Error al eliminar requisito: ${err.message}`);
    }
  }

  // Abrir Historial de Versiones / Papelera
  async function handleOpenHistory() {
    setHistoryModalOpen(true);
    try {
      setLoadingHistory(true);
      const history = await historyApi.getByProject(project.id);
      setHistoryItems(history.filter(h => h.entityType === 'REQUIREMENT'));
    } catch (err) {
      alert(`Error al cargar historial: ${err.message}`);
    } finally {
      setLoadingHistory(false);
    }
  }

  // Recuperar versión de requisito
  async function handleRestoreHistory(historyId) {
    try {
      await historyApi.restore(historyId);
      alert('Requisito recuperado exitosamente con todos sus campos originales.');
      const updatedHistory = await historyApi.getByProject(project.id);
      setHistoryItems(updatedHistory.filter(h => h.entityType === 'REQUIREMENT'));
      await onProjectUpdated();
    } catch (err) {
      alert(`Error al recuperar versión: ${err.message}`);
    }
  }

  return (
    <div>
      {/* Encabezado con Botones de Acción */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={20} color="var(--primary)" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>
              Catálogo de Requerimientos (Norma ISO/IEC/IEEE 29148:2018)
            </h2>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Requerimientos funcionales y no funcionales estructurados con Precondiciones, Postcondiciones, Actores y Dependencias.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleOpenHistory} title="Ver historial de requisitos eliminados o modificados">
            <RotateCcw size={14} />
            <span>Papelera / Recuperar Versión</span>
          </button>
          <button className="btn btn-primary btn-sm" onClick={openNewReqModal}>
            <Plus size={14} />
            <span>Nuevo Requisito</span>
          </button>
        </div>
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
        <div className="table-container" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', minWidth: '1050px' }}>
            <thead>
              <tr>
                <th style={{ width: '90px' }}>ID</th>
                <th style={{ width: '160px' }}>Nombre</th>
                <th style={{ minWidth: '220px' }}>Descripción (ISO 29148)</th>
                <th style={{ width: '100px' }}>Dependencias</th>
                <th style={{ width: '85px' }}>Prioridad</th>
                <th style={{ width: '110px' }}>Actores</th>
                <th style={{ width: '140px' }}>Precondiciones</th>
                <th style={{ width: '140px' }}>Postcondiciones</th>
                <th style={{ width: '100px' }}>Estado</th>
                <th style={{ width: '270px', textAlign: 'center' }}>Acciones (Gobernanza)</th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((req) => (
                <tr key={req.id} style={{ opacity: req.status === 'DISCARDED' ? 0.65 : 1 }}>
                  {/* ID del Requerimiento */}
                  <td>
                    <code style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                      {req.code}
                    </code>
                  </td>

                  {/* Nombre del Requerimiento */}
                  <td style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    {req.name}
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {req.type === 'FUNCTIONAL' ? 'Funcional' : 'No Funcional'}
                    </div>
                  </td>

                  {/* Descripción */}
                  <td style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>
                    {req.description}
                  </td>

                  {/* Dependencias */}
                  <td style={{ fontSize: '0.8rem' }}>
                    {req.dependencies && req.dependencies.length > 0 ? (
                      req.dependencies.map((dep, i) => (
                        <span key={i} className="badge badge-planning" style={{ marginRight: '4px', marginBottom: '2px' }}>
                          {dep}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Ninguna</span>
                    )}
                  </td>

                  {/* Prioridad (alta/media/baja) */}
                  <td>
                    <span className={`badge badge-${req.priority.toLowerCase()}`}>
                      {req.priority === 'HIGH' ? 'Alta' : req.priority === 'MEDIUM' ? 'Media' : 'Baja'}
                    </span>
                  </td>

                  {/* Actores */}
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

                  {/* Precondiciones */}
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {req.preconditions || 'Sesión y permisos de rol'}
                  </td>

                  {/* Postcondiciones */}
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {req.postconditions || 'Persistencia de estado confirmada'}
                  </td>

                  {/* Estado de Gobernanza */}
                  <td>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: req.status === 'APPROVED' ? '#dcfce7' : req.status === 'DISCARDED' ? '#fee2e2' : '#fef3c7',
                        color: req.status === 'APPROVED' ? '#15803d' : req.status === 'DISCARDED' ? '#b91c1c' : '#b45309'
                      }}
                    >
                      {req.status === 'APPROVED' ? 'Aprobado' : req.status === 'DISCARDED' ? 'Rechazado' : 'Pendiente'}
                    </span>
                  </td>

                  {/* Acciones y Gobernanza: Aceptar, Rechazar, Editar, Borrar */}
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', flexWrap: 'wrap' }}>
                      {/* Aceptar */}
                      <button
                        className="btn btn-sm"
                        style={{
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          border: '1px solid #86efac',
                          padding: '3px 8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                        onClick={() => handleUpdateStatus(req.id, 'APPROVED')}
                        title="Aceptar este requerimiento"
                      >
                        <Check size={13} />
                        <span>Aceptar</span>
                      </button>

                      {/* Rechazar */}
                      <button
                        className="btn btn-sm"
                        style={{
                          backgroundColor: '#fee2e2',
                          color: '#b91c1c',
                          border: '1px solid #fca5a5',
                          padding: '3px 8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                        onClick={() => handleUpdateStatus(req.id, 'DISCARDED')}
                        title="Rechazar este requerimiento"
                      >
                        <X size={13} />
                        <span>Rechazar</span>
                      </button>

                      {/* Editar */}
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                        onClick={() => openEditReqModal(req)}
                        title="Editar requerimiento"
                      >
                        <Edit2 size={13} />
                        <span>Editar</span>
                      </button>

                      {/* Borrar en cascada */}
                      <button
                        className="btn btn-sm"
                        style={{
                          backgroundColor: '#fff1f2',
                          color: '#e11d48',
                          border: '1px solid #fecdd3',
                          padding: '3px 8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                        onClick={() => handleDeleteRequirement(req)}
                        title="Borrar en cascada (actualiza casos de uso, pantallas y dependencias)"
                      >
                        <Trash2 size={13} />
                        <span>Borrar</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Crear / Editar Requisito */}
      <Modal
        isOpen={reqModalOpen}
        onClose={() => setReqModalOpen(false)}
        title={editingReq ? `Editar Requisito ${code}` : 'Nuevo Requisito ISO 29148'}
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setReqModalOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSaveRequirement} disabled={savingReq}>
              {savingReq ? 'Guardando...' : 'Guardar Requisito'}
            </button>
          </>
        )}
      >
        <form onSubmit={handleSaveRequirement}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>ID del Requerimiento *</label>
              <input
                type="text"
                className="form-control"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ej. RF-01"
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Nombre del Requerimiento *</label>
              <input
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre representativo"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>
              Descripción Normativa (ISO/IEC/IEEE 29148:2018) *
            </label>
            <textarea
              className="form-control"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="El sistema debe permitir al usuario..."
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Tipo</label>
              <select className="form-control" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="FUNCTIONAL">Funcional (RF)</option>
                <option value="NON_FUNCTIONAL">No Funcional (RNF)</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Prioridad</label>
              <select className="form-control" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="HIGH">Alta</option>
                <option value="MEDIUM">Media</option>
                <option value="LOW">Baja</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Estado de Revisión</label>
              <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="PENDING">Pendiente</option>
                <option value="APPROVED">Aprobado</option>
                <option value="DISCARDED">Rechazado</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Actores (IDs o nombres separados por coma)</label>
              <input
                type="text"
                className="form-control"
                value={actorIdsStr}
                onChange={(e) => setActorIdsStr(e.target.value)}
                placeholder="ACT-01, ACT-02..."
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Dependencias (IDs separados por coma)</label>
              <input
                type="text"
                className="form-control"
                value={dependenciesStr}
                onChange={(e) => setDependenciesStr(e.target.value)}
                placeholder="RF-01, RF-02..."
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Precondiciones</label>
              <textarea
                className="form-control"
                rows={2}
                value={preconditions}
                onChange={(e) => setPreconditions(e.target.value)}
                placeholder="Condiciones que deben cumplirse antes..."
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Postcondiciones</label>
              <textarea
                className="form-control"
                rows={2}
                value={postconditions}
                onChange={(e) => setPostconditions(e.target.value)}
                placeholder="Estado resultante una vez ejecutado..."
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal Historial de Versiones / Papelera de Recuperación */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Papelera e Historial de Recuperación de Requerimientos"
        footer={(
          <button className="btn btn-secondary" onClick={() => setHistoryModalOpen(false)}>
            Cerrar
          </button>
        )}
      >
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Si eliminó accidentalmente un requerimiento o desea recuperar una versión anterior, seleccione "Restaurar" para reincorporarlo inmediatamente al catálogo con su trazabilidad.
        </p>

        {loadingHistory ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando versiones...</div>
        ) : historyItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            No hay versiones o requisitos eliminados en el historial.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
            {historyItems.map((item) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'var(--bg-secondary)',
                  gap: '0.75rem'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    <code>{item.snapshot?.code || 'REQ'}</code>: {item.snapshot?.name || 'Requisito'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Acción: {item.action} • {new Date(item.createdAt).toLocaleString()}
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleRestoreHistory(item.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RotateCcw size={13} />
                  <span>Restaurar</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
