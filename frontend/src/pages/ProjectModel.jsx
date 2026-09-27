import React, { useState, useEffect, useMemo } from 'react';
import { Database, Code2, Layers, RefreshCw, Check, X, Edit2, Box } from 'lucide-react';
import MermaidDiagram from '../components/diagrams/MermaidDiagram';
import { generateERDiagram } from '../utils/mermaidGenerators';
import { classesApi } from '../api/classes.api';
import Modal from '../components/common/Modal';

export default function ProjectModel({ project, onProjectUpdated }) {
  const [activeModelTab, setActiveModelTab] = useState('er'); // 'er' | 'classes'
  const [showCode, setShowCode] = useState(false);
  const [classes, setClasses] = useState(project.classModels || []);
  const [classDiagramCode, setClassDiagramCode] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [generatingClasses, setGeneratingClasses] = useState(false);

  const [editClassModalOpen, setEditClassModalOpen] = useState(false);
  const [editClassData, setEditClassData] = useState({});

  const entities = project.entities || [];
  const relationships = project.relationships || [];

  // DER Generado
  const erDiagramCode = useMemo(() => {
    return generateERDiagram(entities, relationships);
  }, [entities, relationships]);

  useEffect(() => {
    loadClasses();
  }, [project.id]);

  async function loadClasses() {
    try {
      setLoadingClasses(true);
      const data = await classesApi.getByProject(project.id);
      setClasses(data);
      if (data.length > 0) {
        const diag = await classesApi.getDiagram(project.id);
        setClassDiagramCode(diag.diagram);
      }
    } catch (err) {
      console.error('Error loading classes:', err);
    } finally {
      setLoadingClasses(false);
    }
  }

  async function handleGenerateClasses() {
    try {
      setGeneratingClasses(true);
      const created = await classesApi.generate(project.id);
      setClasses(created);
      const diag = await classesApi.getDiagram(project.id);
      setClassDiagramCode(diag.diagram);
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al generar clases: ${err.message}`);
    } finally {
      setGeneratingClasses(false);
    }
  }

  async function handleUpdateClassStatus(id, newStatus) {
    try {
      await classesApi.updateStatus(id, newStatus);
      await loadClasses();
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al actualizar estado: ${err.message}`);
    }
  }

  function openEditClassModal(cls) {
    setEditClassData({
      id: cls.id,
      name: cls.name,
      description: cls.description || '',
      reviewStatus: cls.reviewStatus || 'APPROVED'
    });
    setEditClassModalOpen(true);
  }

  async function handleSaveClassEdit(e) {
    e.preventDefault();
    try {
      await classesApi.update(editClassData.id, editClassData);
      setEditClassModalOpen(false);
      await loadClasses();
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al guardar clase: ${err.message}`);
    }
  }

  return (
    <div>
      {/* Selector de Vistas: DER vs Diagrama de Clases */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn ${activeModelTab === 'er' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveModelTab('er')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Database size={15} />
            <span>1. Diagrama Entidad-Relación (DER)</span>
          </button>
          <button
            className={`btn ${activeModelTab === 'classes' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveModelTab('classes')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Box size={15} />
            <span>2. Diagrama de Clases (POO)</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {activeModelTab === 'classes' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleGenerateClasses}
              disabled={generatingClasses}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={13} className={generatingClasses ? 'spin' : ''} />
              <span>{generatingClasses ? 'Generando...' : 'Regenerar Clases'}</span>
            </button>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowCode(!showCode)}
          >
            <Code2 size={14} />
            <span>{showCode ? 'Ocultar Mermaid' : 'Ver Código Mermaid'}</span>
          </button>
        </div>
      </div>

      {/* Vista DER */}
      {activeModelTab === 'er' && (
        <div>
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Entidades detectadas: </span>
                <span className="badge badge-planning" style={{ marginLeft: '4px' }}>{entities.length}</span>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', marginLeft: '1rem' }}>Relaciones E/R: </span>
                <span className="badge badge-planning" style={{ marginLeft: '4px' }}>{relationships.length}</span>
              </div>
            </div>
          </div>

          {showCode && (
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Código Mermaid (erDiagram)</label>
              <textarea className="diagram-raw-editor" rows={8} readOnly value={erDiagramCode} />
            </div>
          )}

          <div className="diagram-container">
            <MermaidDiagram code={erDiagramCode} type="erDiagram" />
          </div>

          {/* Tarjetas de Entidades con Atributos y Gobernanza */}
          <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {entities.map((ent) => (
              <div key={ent.id} className="card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--primary)' }}>{ent.name}</h4>
                  <span className="badge badge-planning">{ent.attributes?.length || 0} atributos</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  {ent.description || 'Entidad de persistencia en PostgreSQL'}
                </p>

                <div style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '6px' }}>
                  {(ent.attributes || []).map((attr) => (
                    <div key={attr.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                      <span style={{ fontWeight: attr.isPk ? 700 : 400 }}>{attr.name}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{attr.type} {attr.isPk ? '(PK)' : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vista Diagrama de Clases */}
      {activeModelTab === 'classes' && (
        <div>
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Clases de Dominio & Servicios: </span>
                <span className="badge badge-planning" style={{ marginLeft: '4px' }}>{classes.length}</span>
              </div>
            </div>
          </div>

          {showCode && (
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Código Mermaid (classDiagram)</label>
              <textarea className="diagram-raw-editor" rows={8} readOnly value={classDiagramCode} />
            </div>
          )}

          <div className="diagram-container">
            {classDiagramCode ? (
              <MermaidDiagram code={classDiagramCode} type="classDiagram" />
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                Haga clic en "Regenerar Clases" para derivar automáticamente las clases a partir de las entidades.
              </div>
            )}
          </div>

          {/* Grid de Clases con Métodos, Atributos y Gobernanza */}
          <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {classes.map((cls) => (
              <div key={cls.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>
                      class {cls.name}
                    </h4>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: cls.reviewStatus === 'APPROVED' ? '#dcfce7' : cls.reviewStatus === 'DISCARDED' ? '#fee2e2' : '#fef3c7',
                        color: cls.reviewStatus === 'APPROVED' ? '#15803d' : cls.reviewStatus === 'DISCARDED' ? '#b91c1c' : '#b45309'
                      }}
                    >
                      {cls.reviewStatus === 'APPROVED' ? 'Aprobado' : cls.reviewStatus === 'DISCARDED' ? 'Rechazado' : 'Pendiente'}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    {cls.description}
                  </p>

                  <div style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '6px', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 600, marginBottom: '2px', color: '#475569' }}>Atributos:</div>
                    {(cls.attributes || []).map((a, i) => (
                      <div key={i} style={{ color: '#1e293b' }}>
                        <code>{a.visibility || '+'}{a.name}: {a.type}</code>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '6px' }}>
                    <div style={{ fontWeight: 600, marginBottom: '2px', color: '#475569' }}>Métodos:</div>
                    {(cls.methods || []).map((m, i) => (
                      <div key={i} style={{ color: '#1e293b' }}>
                        <code>{m.visibility || '+'}{m.name}(): {m.returnType}</code>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gobernanza */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '3px 8px', color: '#16a34a' }}
                      onClick={() => handleUpdateClassStatus(cls.id, 'APPROVED')}
                      title="Aprobar clase"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '3px 8px', color: '#dc2626' }}
                      onClick={() => handleUpdateClassStatus(cls.id, 'DISCARDED')}
                      title="Rechazar clase"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => openEditClassModal(cls)}
                    title="Editar clase"
                  >
                    <Edit2 size={13} />
                    <span>Editar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Editar Clase */}
      <Modal
        isOpen={editClassModalOpen}
        onClose={() => setEditClassModalOpen(false)}
        title="Editar Clase del Modelo"
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setEditClassModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSaveClassEdit}>Guardar Cambios</button>
          </>
        )}
      >
        <form onSubmit={handleSaveClassEdit}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Nombre de la Clase *</label>
            <input
              type="text"
              className="form-control"
              value={editClassData.name || ''}
              onChange={(e) => setEditClassData({ ...editClassData, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Descripción de la Clase</label>
            <textarea
              className="form-control"
              rows={3}
              value={editClassData.description || ''}
              onChange={(e) => setEditClassData({ ...editClassData, description: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Estado de Revisión</label>
            <select
              className="form-control"
              value={editClassData.reviewStatus || 'APPROVED'}
              onChange={(e) => setEditClassData({ ...editClassData, reviewStatus: e.target.value })}
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
