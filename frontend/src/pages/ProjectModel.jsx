import React, { useState, useEffect, useMemo } from 'react';
import DiagramViewport from '../components/common/DiagramViewport';
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

  const activeCode = activeModelTab === 'er' ? erDiagramCode : classDiagramCode;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Command bar */}
      <div className="full-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 className="page-title">Modelo de Datos</h2>
          <div className="vdivider" />
          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              <strong style={{ color: 'var(--on-surface)', fontWeight: 600 }}>{entities.length}</strong> entidades
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              <strong style={{ color: 'var(--on-surface)', fontWeight: 600 }}>{relationships.length}</strong> relaciones
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              <strong style={{ color: 'var(--on-surface)', fontWeight: 600 }}>{classes.length}</strong> clases
            </span>
          </div>
        </div>

        <div className="page-actions">
          {/* Subtab toggle: DER vs Clases POO */}
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${activeModelTab === 'er' ? 'active' : ''}`}
              onClick={() => setActiveModelTab('er')}
            >
              <span className="ms ms-xs">table_chart</span>
              <span>1. Diagrama E/R</span>
            </button>
            <button
              className={`view-toggle-btn ${activeModelTab === 'classes' ? 'active' : ''}`}
              onClick={() => setActiveModelTab('classes')}
            >
              <span className="ms ms-xs">schema</span>
              <span>2. Clases (POO)</span>
            </button>
          </div>

          {activeModelTab === 'classes' && (
            <button
              className="btn btn-outline btn-sm"
              onClick={handleGenerateClasses}
              disabled={generatingClasses}
              title="Regenerar clases a partir de las entidades"
            >
              <span className={`ms ms-xs ${generatingClasses ? 'spin' : ''}`}>sync</span>
              <span>{generatingClasses ? 'Generando...' : 'Regenerar Clases'}</span>
            </button>
          )}

          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${!showCode ? 'active' : ''}`}
              onClick={() => setShowCode(false)}
            >
              <span className="ms ms-xs">visibility</span>
              <span>Diagrama</span>
            </button>
            <button
              className={`view-toggle-btn ${showCode ? 'active' : ''}`}
              onClick={() => setShowCode(true)}
            >
              <span className="ms ms-xs">code</span>
              <span>Código</span>
            </button>
          </div>
        </div>
      </div>

      <div className="page-scrollable" style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
        {showCode ? (
          <div>
            <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="detail-section-label">
                Código Mermaid ({activeModelTab === 'er' ? 'erDiagram' : 'classDiagram'})
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigator.clipboard?.writeText(activeCode)}
                title="Copiar al portapapeles"
              >
                <span className="ms ms-sm">content_copy</span>
                <span>Copiar</span>
              </button>
            </div>
            <textarea
              className="diagram-raw-editor"
              rows={16}
              readOnly
              value={activeCode}
            />
          </div>
        ) : (
          <>
            {/* VISTA 1: DIAGRAMA ENTIDAD-RELACIÓN */}
            {activeModelTab === 'er' && (
              <>
                {entities.length === 0 ? (
                  <div className="empty-state" style={{ border: '1px dashed var(--outline-variant)', borderRadius: 'var(--radius-lg)' }}>
                    <div className="empty-state-icon"><span className="ms ms-xl">account_tree</span></div>
                    <p className="empty-state-title">Sin entidades generadas</p>
                    <p className="empty-state-desc">Ejecuta el análisis IA en la pestaña Resumen para generar el modelo de datos.</p>
                  </div>
                ) : (
                  <DiagramViewport
                    code={erDiagramCode}
                    type="erDiagram"
                    title="Diagrama Entidad-Relación (DER)"
                    minHeight="520px"
                  />
                )}

                {/* Entity list summary */}
                {entities.length > 0 && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <p className="detail-section-label" style={{ marginBottom: '10px' }}>
                      Entidades del Sistema ({entities.length})
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                      {entities.map(ent => (
                        <div key={ent.id} className="info-card" style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="ms ms-sm" style={{ color: 'var(--primary)' }}>table_chart</span>
                              <strong style={{ fontSize: '0.875rem', color: 'var(--on-surface)' }}>{ent.name}</strong>
                            </div>
                            <span className="tag">{ent.attributes?.length || 0} atributos</span>
                          </div>
                          {ent.description && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--secondary)', margin: '0 0 8px', lineHeight: 1.4 }}>
                              {ent.description}
                            </p>
                          )}
                          {ent.attributes && ent.attributes.length > 0 && (
                            <div style={{ background: 'var(--surface-container-low)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
                              {ent.attributes.map(attr => (
                                <div key={attr.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                                  <span style={{ fontWeight: attr.isPk ? 700 : 400, color: 'var(--on-surface)' }}>
                                    {attr.name} {attr.isPk ? '(PK)' : ''}
                                  </span>
                                  <span style={{ color: 'var(--secondary)' }}>{attr.type}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* VISTA 2: DIAGRAMA DE CLASES UML (POO) */}
            {activeModelTab === 'classes' && (
              <div>
                {classDiagramCode ? (
                  <DiagramViewport
                    code={classDiagramCode}
                    type="classDiagram"
                    title="Diagrama de Clases UML (POO)"
                    minHeight="520px"
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--secondary)' }}>
                    Haz clic en "Regenerar Clases" para derivar automáticamente las clases a partir de las entidades.
                  </div>
                )}

                {/* Grid de Clases con Métodos, Atributos y Gobernanza */}
                <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
                  {classes.map((cls) => (
                    <div key={cls.id} className="info-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '14px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.9375rem', color: 'var(--on-surface)' }}>
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

                        {cls.description && (
                          <p style={{ fontSize: '0.75rem', color: 'var(--secondary)', marginBottom: '10px' }}>
                            {cls.description}
                          </p>
                        )}

                        <div style={{ fontSize: '0.75rem', background: 'var(--surface-container-low)', padding: '8px', borderRadius: 'var(--radius-sm)', marginBottom: '8px' }}>
                          <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--on-surface-variant)' }}>Atributos:</div>
                          {(cls.attributes || []).map((a, i) => (
                            <div key={i} style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-mono)' }}>
                              <code>{a.visibility || '+'}{a.name}: {a.type}</code>
                            </div>
                          ))}
                        </div>

                        <div style={{ fontSize: '0.75rem', background: 'var(--surface-container-low)', padding: '8px', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--on-surface-variant)' }}>Métodos:</div>
                          {(cls.methods || []).map((m, i) => (
                            <div key={i} style={{ color: 'var(--on-surface)', fontFamily: 'var(--font-mono)' }}>
                              <code>{m.visibility || '+'}{m.name}(): {m.returnType}</code>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Gobernanza */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--outline-variant)', paddingTop: '10px', marginTop: '12px' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: '#16a34a' }}
                            onClick={() => handleUpdateClassStatus(cls.id, 'APPROVED')}
                            title="Aprobar clase"
                          >
                            <span className="ms ms-xs">check</span>
                            <span>Aprobar</span>
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: '#dc2626' }}
                            onClick={() => handleUpdateClassStatus(cls.id, 'DISCARDED')}
                            title="Rechazar clase"
                          >
                            <span className="ms ms-xs">close</span>
                            <span>Rechazar</span>
                          </button>
                        </div>

                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => openEditClassModal(cls)}
                          title="Editar clase"
                        >
                          <span className="ms ms-xs">edit</span>
                          <span>Editar</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Editar Clase */}
      <Modal
        isOpen={editClassModalOpen}
        onClose={() => setEditClassModalOpen(false)}
        title="Editar Clase del Modelo"
        footer={(
          <>
            <button className="btn btn-outline btn-md" onClick={() => setEditClassModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-md" onClick={handleSaveClassEdit}>Guardar Cambios</button>
          </>
        )}
      >
        <form onSubmit={handleSaveClassEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Nombre de la Clase *</label>
            <input
              type="text"
              className="form-control"
              value={editClassData.name || ''}
              onChange={(e) => setEditClassData({ ...editClassData, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción de la Clase</label>
            <textarea
              className="form-control"
              rows={3}
              value={editClassData.description || ''}
              onChange={(e) => setEditClassData({ ...editClassData, description: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Estado de Revisión</label>
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
