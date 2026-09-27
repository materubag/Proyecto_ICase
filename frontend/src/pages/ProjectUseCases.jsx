import React, { useState, useEffect } from 'react';
import { Layers, RefreshCw, Check, X, Edit2, Play, Users, FileText, CheckCircle2 } from 'lucide-react';
import { useCasesApi } from '../api/useCases.api';
import MermaidDiagram from '../components/diagrams/MermaidDiagram';
import Modal from '../components/common/Modal';

export default function ProjectUseCases({ project, onProjectUpdated }) {
  const [useCases, setUseCases] = useState(project.useCases || []);
  const [diagramCode, setDiagramCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedUC, setSelectedUC] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editData, setEditData] = useState({});

  const actorsMap = new Map((project.actors || []).map(a => [a.codeId || a.id, a.name]));

  useEffect(() => {
    loadUseCasesAndDiagram();
  }, [project.id]);

  async function loadUseCasesAndDiagram() {
    try {
      setLoading(true);
      const data = await useCasesApi.getByProject(project.id);
      setUseCases(data);
      if (data.length > 0) {
        const diag = await useCasesApi.getDiagram(project.id);
        setDiagramCode(diag.diagram);
      }
    } catch (err) {
      console.error('Error loading use cases:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateProcesses() {
    try {
      setGenerating(true);
      const created = await useCasesApi.generate(project.id);
      setUseCases(created);
      const diag = await useCasesApi.getDiagram(project.id);
      setDiagramCode(diag.diagram);
      await onProjectUpdated();
    } catch (err) {
      alert(`Error al generar los 4 procesos fundamentales: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleUpdateStatus(id, newStatus) {
    try {
      await useCasesApi.updateStatus(id, newStatus);
      await loadUseCasesAndDiagram();
      await onProjectUpdated();
    } catch (err) {
      alert(`Error al actualizar estado: ${err.message}`);
    }
  }

  function openEditModal(uc) {
    setEditData({
      id: uc.id,
      name: uc.name,
      description: uc.description || '',
      preconditions: uc.preconditions || '',
      postconditions: uc.postconditions || '',
      reviewStatus: uc.reviewStatus || 'APPROVED'
    });
    setEditModalOpen(true);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    try {
      await useCasesApi.update(editData.id, editData);
      setEditModalOpen(false);
      await loadUseCasesAndDiagram();
      await onProjectUpdated();
    } catch (err) {
      alert(`Error al guardar cambios: ${err.message}`);
    }
  }

  const processLabels = {
    AUTH_ACCESS: { label: 'Proceso 1: Autenticación & Acceso', color: '#3b82f6' },
    CORE_OPERATION: { label: 'Proceso 2: Operación Central de Negocio', color: '#10b981' },
    REPORT_QUERY: { label: 'Proceso 3: Consultas & Reportes', color: '#8b5cf6' },
    NOTIFICATION_AUDIT: { label: 'Proceso 4: Notificaciones & Auditoría', color: '#f59e0b' }
  };

  return (
    <div>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={20} color="#8b5cf6" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>
              Casos de Uso: 4 Procesos Fundamentales del Sistema
            </h2>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Identificación y modelado de los procesos troncales según la ingeniería del software asistida por computadora.
          </p>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={handleGenerateProcesses}
          disabled={generating}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} className={generating ? 'spin' : ''} />
          <span>{generating ? 'Generando Procesos...' : 'Regenerar 4 Procesos Fundamentales'}</span>
        </button>
      </div>

      {/* Visualización del Diagrama Mermaid */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
          Diagrama Global de Casos de Uso (Mermaid)
        </h3>

        {diagramCode ? (
          <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', padding: '1.5rem' }}>
            <MermaidDiagram code={diagramCode} />
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            Haga clic en "Regenerar 4 Procesos Fundamentales" para calcular el diagrama de interacción entre actores y procesos.
          </div>
        )}
      </div>

      {/* Grid de los 4 Procesos Fundamentales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {useCases.map((uc) => {
          const procMeta = processLabels[uc.processType] || { label: 'Proceso Fundamental', color: 'var(--primary)' };
          return (
            <div
              key={uc.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderTop: `4px solid ${procMeta.color}`,
                boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: procMeta.color, textTransform: 'uppercase' }}>
                    {procMeta.label}
                  </span>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: uc.reviewStatus === 'APPROVED' ? '#dcfce7' : uc.reviewStatus === 'DISCARDED' ? '#fee2e2' : '#fef3c7',
                      color: uc.reviewStatus === 'APPROVED' ? '#15803d' : uc.reviewStatus === 'DISCARDED' ? '#b91c1c' : '#b45309'
                    }}
                  >
                    {uc.reviewStatus === 'APPROVED' ? 'Aprobado' : uc.reviewStatus === 'DISCARDED' ? 'Rechazado' : 'Pendiente'}
                  </span>
                </div>

                <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  <code>{uc.codeId}</code>: {uc.name}
                </h4>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.4 }}>
                  {uc.description}
                </p>

                {/* Actores Vinculados */}
                <div style={{ marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                  <strong>Actor Principal: </strong>
                  <span className="badge badge-planning" style={{ marginLeft: '4px' }}>
                    👤 {actorsMap.get(uc.primaryActorId) || uc.primaryActorId || 'Usuario'}
                  </span>
                </div>

                {/* Pre y Postcondiciones */}
                <div style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-secondary)', padding: '0.6rem 0.8rem', borderRadius: '6px', marginBottom: '0.75rem' }}>
                  <div style={{ marginBottom: '4px' }}>
                    <strong>Precondición:</strong> {uc.preconditions || 'Sesión activa'}
                  </div>
                  <div>
                    <strong>Postcondición:</strong> {uc.postconditions || 'Transacción registrada'}
                  </div>
                </div>

                {/* Requisitos Trazables */}
                {uc.requirementIds && uc.requirementIds.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Requerimientos Asociados (Trazabilidad):
                    </span>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {uc.requirementIds.map((rCode, idx) => (
                        <span key={idx} className="badge" style={{ backgroundColor: '#e0e7ff', color: '#3730a3', fontSize: '0.7rem' }}>
                          {rCode}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Botones de Gobernanza: Aceptar, Rechazar, Editar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '4px 8px', color: '#16a34a' }}
                    onClick={() => handleUpdateStatus(uc.id, 'APPROVED')}
                    title="Aprobar caso de uso"
                  >
                    <Check size={14} />
                    <span>Aprobar</span>
                  </button>

                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '4px 8px', color: '#dc2626' }}
                    onClick={() => handleUpdateStatus(uc.id, 'DISCARDED')}
                    title="Rechazar caso de uso"
                  >
                    <X size={14} />
                    <span>Rechazar</span>
                  </button>
                </div>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => openEditModal(uc)}
                  title="Editar caso de uso"
                >
                  <Edit2 size={13} />
                  <span>Editar</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Editar Caso de Uso */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Editar Caso de Uso`}
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSaveEdit}>Guardar Cambios</button>
          </>
        )}
      >
        <form onSubmit={handleSaveEdit}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Nombre del Caso de Uso *</label>
            <input
              type="text"
              className="form-control"
              value={editData.name || ''}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Descripción del Proceso *</label>
            <textarea
              className="form-control"
              rows={3}
              value={editData.description || ''}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Precondiciones</label>
            <input
              type="text"
              className="form-control"
              value={editData.preconditions || ''}
              onChange={(e) => setEditData({ ...editData, preconditions: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Postcondiciones</label>
            <input
              type="text"
              className="form-control"
              value={editData.postconditions || ''}
              onChange={(e) => setEditData({ ...editData, postconditions: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Estado</label>
            <select
              className="form-control"
              value={editData.reviewStatus || 'APPROVED'}
              onChange={(e) => setEditData({ ...editData, reviewStatus: e.target.value })}
            >
              <option value="PENDING">Pendiente</option>
              <option value="APPROVED">Aprobado</option>
              <option value="DISCARDED">Rechazado</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
}
