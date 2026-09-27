import React, { useState, useEffect, useMemo } from 'react';
import DiagramViewport from '../components/common/DiagramViewport';
import { generateERDiagram } from '../utils/mermaidGenerators';
import { classesApi } from '../api/classes.api';
import { diagramsApi } from '../api/diagrams.api';
import { entitiesApi } from '../api/entities.api';
import Modal from '../components/common/Modal';

export default function ProjectModel({ project, onProjectUpdated }) {
  const [activeModelTab, setActiveModelTab] = useState('er'); // 'er' | 'classes'
  const [showCode, setShowCode] = useState(false);
  const [classes, setClasses] = useState(project.classModels || []);
  const [classDiagramCode, setClassDiagramCode] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [generatingClasses, setGeneratingClasses] = useState(false);
  const [classIsOutdated, setClassIsOutdated] = useState(false);

  // ER Diagram states
  const [erStoredCode, setErStoredCode] = useState('');
  const [generatingER, setGeneratingER] = useState(false);
  const [erIsOutdated, setErIsOutdated] = useState(false);

  const [editClassModalOpen, setEditClassModalOpen] = useState(false);
  const [editClassData, setEditClassData] = useState({});

  const entities = project.entities || [];
  const relationships = project.relationships || [];

  const pendingEntitiesCount = entities.filter(e => e.reviewStatus !== 'APPROVED').length;

  async function handleUpdateEntityStatus(entityId, newStatus) {
    try {
      await entitiesApi.updateStatus(project.id, entityId, newStatus);
      if (onProjectUpdated) await onProjectUpdated();
      await loadDiagrams();
    } catch (err) {
      alert(`Error al actualizar estado de entidad: ${err.message}`);
    }
  }

  async function handleApproveAllEntities() {
    try {
      await entitiesApi.approveAll(project.id);
      if (onProjectUpdated) await onProjectUpdated();
      await loadDiagrams();
    } catch (err) {
      alert(`Error al aprobar entidades: ${err.message}`);
    }
  }

  // DER Generado local (fallback)
  const erLocalCode = useMemo(() => {
    return generateERDiagram(entities, relationships);
  }, [entities, relationships]);

  const effectiveERCode = erStoredCode || erLocalCode;

  useEffect(() => {
    loadClasses();
    loadDiagrams();
  }, [project.id]);

  async function loadClasses() {
    try {
      setLoadingClasses(true);
      const data = await classesApi.getByProject(project.id);
      setClasses(data || []);
      if (data && data.length > 0) {
        const diag = await classesApi.getDiagram(project.id);
        if (diag?.diagram) setClassDiagramCode(diag.diagram);
      }
    } catch (err) {
      console.error('Error loading classes:', err);
    } finally {
      setLoadingClasses(false);
    }
  }

  async function loadDiagrams() {
    try {
      const [avail, erDiag, classDiag] = await Promise.allSettled([
        diagramsApi.getAvailability(project.id),
        diagramsApi.getDiagram(project.id, 'ER'),
        diagramsApi.getDiagram(project.id, 'CLASS')
      ]);

      if (erDiag.status === 'fulfilled' && erDiag.value?.artifact?.mermaidCode) {
        setErStoredCode(erDiag.value.artifact.mermaidCode);
        setErIsOutdated(!!erDiag.value.isOutdated);
      }
      if (classDiag.status === 'fulfilled' && classDiag.value?.artifact?.mermaidCode) {
        setClassDiagramCode(classDiag.value.artifact.mermaidCode);
        setClassIsOutdated(!!classDiag.value.isOutdated);
      }
      if (avail.status === 'fulfilled') {
        const d = avail.value?.diagrams;
        if (d?.ER) setErIsOutdated(!!d.ER.isOutdated);
        if (d?.CLASS) setClassIsOutdated(!!d.CLASS.isOutdated);
      }
    } catch (err) {
      console.error('Error loading diagrams in ProjectModel:', err);
    }
  }

  async function handleGenerateER(force = false) {
    try {
      setGeneratingER(true);
      const res = await diagramsApi.generateDiagram(project.id, 'ER', { force });
      if (res.diagram?.mermaidCode) {
        setErStoredCode(res.diagram.mermaidCode);
        setErIsOutdated(false);
      }
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al generar diagrama E/R: ${err.message}`);
    } finally {
      setGeneratingER(false);
    }
  }

  async function handleGenerateClassDiagram(force = true) {
    try {
      setGeneratingClasses(true);
      // Generate diagram with Gemini
      const res = await diagramsApi.generateDiagram(project.id, 'CLASS', { force });
      if (res.diagram?.mermaidCode) {
        setClassDiagramCode(res.diagram.mermaidCode);
        setClassIsOutdated(false);
      }
      // Also sync class entities if needed
      await loadClasses();
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al generar diagrama de clases: ${err.message}`);
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

  const activeCode = activeModelTab === 'er' ? effectiveERCode : classDiagramCode;

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

          {activeModelTab === 'er' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {pendingEntitiesCount > 0 && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleApproveAllEntities}
                  style={{ color: '#15803d', borderColor: '#86efac', background: '#f0fdf4' }}
                  title="Aprobar todas las entidades para habilitar la generación de diagramas"
                >
                  <span className="ms ms-xs">done_all</span>
                  <span>Aprobar entidades ({pendingEntitiesCount})</span>
                </button>
              )}
              <button
                className="btn btn-outline btn-sm"
                onClick={() => handleGenerateER(true)}
                disabled={generatingER}
                title="Generar o regenerar modelo Entidad-Relación con IA"
              >
                <span className={`ms ms-xs ${generatingER ? 'spin' : ''}`}>
                  {generatingER ? 'autorenew' : 'auto_awesome'}
                </span>
                <span>{generatingER ? 'Generando E/R...' : erStoredCode ? 'Regenerar E/R' : 'Generar diagrama E/R'}</span>
              </button>
            </div>
          )}

          {activeModelTab === 'classes' && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => handleGenerateClassDiagram(true)}
              disabled={generatingClasses}
              title="Generar o regenerar clases con IA"
            >
              <span className={`ms ms-xs ${generatingClasses ? 'spin' : ''}`}>
                {generatingClasses ? 'autorenew' : 'auto_awesome'}
              </span>
              <span>{generatingClasses ? 'Generando...' : classDiagramCode ? 'Regenerar Clases' : 'Generar Clases'}</span>
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
                {entities.length === 0 && !erStoredCode ? (
                  <div className="empty-state" style={{ border: '1px dashed var(--outline-variant)', borderRadius: 'var(--radius-lg)' }}>
                    <div className="empty-state-icon"><span className="ms ms-xl">account_tree</span></div>
                    <p className="empty-state-title">Sin entidades generadas</p>
                    <p className="empty-state-desc">Ejecuta el análisis IA en la pestaña Resumen o genera el diagrama E/R directamente.</p>
                    <div style={{ marginTop: '12px' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleGenerateER(false)} disabled={generatingER}>
                        <span className="ms ms-xs">auto_awesome</span>
                        <span>Generar diagrama E/R</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <DiagramViewport
                    code={effectiveERCode}
                    type="erDiagram"
                    title="Diagrama Entidad-Relación (DER)"
                    minHeight="520px"
                    isOutdated={erIsOutdated}
                    onRegenerate={() => handleGenerateER(true)}
                    canGenerate={true}
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
                    isOutdated={classIsOutdated}
                    onRegenerate={() => handleGenerateClassDiagram(true)}
                    canGenerate={true}
                  />
                ) : (
                  <div className="empty-state" style={{ border: '1px dashed var(--outline-variant)', borderRadius: 'var(--radius-lg)' }}>
                    <div className="empty-state-icon"><span className="ms ms-xl">schema</span></div>
                    <p className="empty-state-title">Sin diagrama de clases generado</p>
                    <p className="empty-state-desc">Genera el diagrama de clases con IA a partir de las entidades, atributos y relaciones del proyecto.</p>
                    <div style={{ marginTop: '12px' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleGenerateClassDiagram(true)} disabled={generatingClasses}>
                        <span className="ms ms-xs">auto_awesome</span>
                        <span>Generar Clases</span>
                      </button>
                    </div>
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
