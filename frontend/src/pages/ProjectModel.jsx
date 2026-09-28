import React, { useState, useEffect, useMemo } from 'react';
import DiagramViewport from '../components/common/DiagramViewport';
import { generateERDiagram } from '../utils/mermaidGenerators';
import { classesApi } from '../api/classes.api';
import { diagramsApi } from '../api/diagrams.api';
import { entitiesApi } from '../api/entities.api';
import Modal from '../components/common/Modal';

export default function ProjectModel({ project, onProjectUpdated, initialTab = 'er', hideInternalTabs = false }) {
  const [activeModelTab, setActiveModelTab] = useState(initialTab); // 'er' | 'classes'

  useEffect(() => {
    if (initialTab) setActiveModelTab(initialTab);
  }, [initialTab]);

  // Code editor states
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [editedCode, setEditedCode] = useState('');
  const [savingCode, setSavingCode] = useState(false);

  // Validation states
  const [erValidation, setErValidation] = useState(null);
  const [classValidation, setClassValidation] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  // Cross-validation states
  const [crossValOpen, setCrossValOpen] = useState(false);
  const [crossValLoading, setCrossValLoading] = useState(false);
  const [crossValReport, setCrossValReport] = useState(null);

  // Project data states
  const [classes, setClasses] = useState(project.classModels || []);
  const [classDiagramCode, setClassDiagramCode] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [generatingClasses, setGeneratingClasses] = useState(false);
  const [classIsOutdated, setClassIsOutdated] = useState(false);

  // ER Diagram states
  const [erStoredCode, setErStoredCode] = useState('');
  const [generatingER, setGeneratingER] = useState(false);
  const [erIsOutdated, setErIsOutdated] = useState(false);

  // Edit Class Modal (Governance)
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
  const currentDiagramCode = activeModelTab === 'er' ? effectiveERCode : classDiagramCode;
  const currentValidation = activeModelTab === 'er' ? erValidation : classValidation;

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

      if (erDiag.status === 'fulfilled') {
        const erCode = erDiag.value?.code || erDiag.value?.mermaidCode || erDiag.value?.artifact?.mermaidCode;
        if (erCode) {
          setErStoredCode(erCode);
          setErIsOutdated(!!erDiag.value.isOutdated);
        }
        if (erDiag.value?.validation) {
          setErValidation(erDiag.value.validation);
        } else if (erCode) {
          validateCodeOnDemand('ER', erCode);
        }
      }

      if (classDiag.status === 'fulfilled') {
        const classCode = classDiag.value?.code || classDiag.value?.mermaidCode || classDiag.value?.artifact?.mermaidCode;
        if (classCode) {
          setClassDiagramCode(classCode);
          setClassIsOutdated(!!classDiag.value.isOutdated);
        }
        if (classDiag.value?.validation) {
          setClassValidation(classDiag.value.validation);
        } else if (classCode) {
          validateCodeOnDemand('CLASS', classCode);
        }
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

  async function validateCodeOnDemand(type, code) {
    if (!code || !code.trim()) return;
    try {
      setIsValidating(true);
      const res = await diagramsApi.validateDiagram(project.id, type, code);
      if (type === 'ER') {
        setErValidation(res);
      } else {
        setClassValidation(res);
      }
    } catch (err) {
      console.warn('Error running on-demand validation:', err.message);
    } finally {
      setIsValidating(false);
    }
  }

  async function handleGenerateER(force = false) {
    try {
      setGeneratingER(true);
      const isForce = typeof force === 'object' ? Boolean(force.force) : Boolean(force);
      const res = await diagramsApi.generateDiagram(project.id, 'ER', isForce);
      const newCode = res?.code || res?.mermaidCode || res?.diagram?.mermaidCode || res?.artifact?.mermaidCode;
      if (newCode) {
        setErStoredCode(newCode);
        setErIsOutdated(false);
        if (res.validation) {
          setErValidation(res.validation);
        } else {
          validateCodeOnDemand('ER', newCode);
        }
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
      const isForce = typeof force === 'object' ? Boolean(force.force) : Boolean(force);
      const res = await diagramsApi.generateDiagram(project.id, 'CLASS', isForce);
      const newCode = res?.code || res?.mermaidCode || res?.diagram?.mermaidCode || res?.artifact?.mermaidCode;
      if (newCode) {
        setClassDiagramCode(newCode);
        setClassIsOutdated(false);
        if (res.validation) {
          setClassValidation(res.validation);
        } else {
          validateCodeOnDemand('CLASS', newCode);
        }
      }
      await loadClasses();
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al generar diagrama de clases: ${err.message}`);
    } finally {
      setGeneratingClasses(false);
    }
  }

  // Edit Code toggle
  function handleStartEditing() {
    setEditedCode(currentDiagramCode);
    setIsEditingCode(true);
  }

  function handleCancelEditing() {
    setIsEditingCode(false);
  }

  async function handleSaveEditedCode() {
    try {
      setSavingCode(true);
      const type = activeModelTab === 'er' ? 'ER' : 'CLASS';
      const res = await diagramsApi.saveDiagram(project.id, type, editedCode);
      const savedCode = res?.code || editedCode;

      if (type === 'ER') {
        setErStoredCode(savedCode);
        if (res.validation) setErValidation(res.validation);
      } else {
        setClassDiagramCode(savedCode);
        if (res.validation) setClassValidation(res.validation);
      }

      setIsEditingCode(false);
      alert('Diagrama actualizado y versionado exitosamente.');
    } catch (err) {
      alert(`Error al guardar el diagrama: ${err.message}`);
    } finally {
      setSavingCode(false);
    }
  }

  // Export functions
  function downloadBlob(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleExportMMD() {
    const type = activeModelTab === 'er' ? 'ER' : 'Clases';
    downloadBlob(currentDiagramCode, `${project.name}_${type}.mmd`, 'text/plain;charset=utf-8');
  }

  function handleExportSVG() {
    const svgEl = document.querySelector('.diagram-viewport-content svg');
    if (svgEl) {
      const type = activeModelTab === 'er' ? 'ER' : 'Clases';
      const svgData = new XMLSerializer().serializeToString(svgEl);
      downloadBlob(svgData, `${project.name}_${type}.svg`, 'image/svg+xml;charset=utf-8');
    } else {
      alert('El SVG del diagrama aún no ha terminado de renderizarse.');
    }
  }

  // Cross-Validation trigger
  async function handleOpenCrossValidation() {
    setCrossValOpen(true);
    setCrossValLoading(true);
    try {
      const res = await diagramsApi.crossValidate(project.id, effectiveERCode, classDiagramCode);
      setCrossValReport(res);
    } catch (err) {
      setCrossValReport({
        isConsistent: false,
        score: 0,
        discrepancies: [err.message]
      });
    } finally {
      setCrossValLoading(false);
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header Bar */}
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

        <div className="page-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Subtab toggle: DER vs Clases POO */}
          {!hideInternalTabs && (
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${activeModelTab === 'er' ? 'active' : ''}`}
                onClick={() => { setActiveModelTab('er'); setIsEditingCode(false); }}
              >
                <span className="ms ms-xs">table_chart</span>
                <span>1. Diagrama E/R</span>
              </button>
              <button
                className={`view-toggle-btn ${activeModelTab === 'classes' ? 'active' : ''}`}
                onClick={() => { setActiveModelTab('classes'); setIsEditingCode(false); }}
              >
                <span className="ms ms-xs">schema</span>
                <span>2. Clases (POO)</span>
              </button>
            </div>
          )}

          {/* Botón Validación Cruzada */}
          <button
            className="btn btn-outline btn-sm"
            onClick={handleOpenCrossValidation}
            title="Comparar coherencia conceptual entre Modelo Relacional E/R y Modelo Orientado a Objetos"
            style={{ fontSize: '0.75rem', height: '30px' }}
          >
            <span className="ms ms-xs" style={{ color: 'var(--primary)' }}>compare_arrows</span>
            <span>Validación Cruzada E/R ↔ POO</span>
          </button>

          {/* Acciones para E/R */}
          {activeModelTab === 'er' && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {pendingEntitiesCount > 0 && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleApproveAllEntities}
                  style={{ color: '#15803d', borderColor: '#86efac', background: '#f0fdf4', fontSize: '0.75rem', height: '30px' }}
                  title="Aprobar todas las entidades"
                >
                  <span className="ms ms-xs">done_all</span>
                  <span>Aprobar entidades ({pendingEntitiesCount})</span>
                </button>
              )}
              <button
                className="btn btn-outline btn-sm"
                onClick={() => handleGenerateER(true)}
                disabled={generatingER}
                style={{ fontSize: '0.75rem', height: '30px' }}
                title="Generar o regenerar modelo Entidad-Relación con IA"
              >
                <span className={`ms ms-xs ${generatingER ? 'spin' : ''}`}>
                  {generatingER ? 'autorenew' : 'auto_awesome'}
                </span>
                <span>{generatingER ? 'Generando...' : erStoredCode ? 'Regenerar E/R' : 'Generar E/R'}</span>
              </button>
            </div>
          )}

          {/* Acciones para Clases */}
          {activeModelTab === 'classes' && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => handleGenerateClassDiagram(true)}
              disabled={generatingClasses}
              style={{ fontSize: '0.75rem', height: '30px' }}
              title="Generar o regenerar clases con IA"
            >
              <span className={`ms ms-xs ${generatingClasses ? 'spin' : ''}`}>
                {generatingClasses ? 'autorenew' : 'auto_awesome'}
              </span>
              <span>{generatingClasses ? 'Generando...' : classDiagramCode ? 'Regenerar Clases' : 'Generar Clases'}</span>
            </button>
          )}

          {/* Botón Validar */}
          {currentDiagramCode && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => validateCodeOnDemand(activeModelTab === 'er' ? 'ER' : 'CLASS', isEditingCode ? editedCode : currentDiagramCode)}
              disabled={isValidating}
              style={{ fontSize: '0.75rem', height: '30px' }}
              title="Ejecutar análisis sintáctico y semántico del diagrama"
            >
              <span className={`ms ms-xs ${isValidating ? 'spin' : ''}`}>
                {isValidating ? 'sync' : 'rule'}
              </span>
              <span>{isValidating ? 'Validando...' : 'Validar'}</span>
            </button>
          )}

          {/* Botón Editar código */}
          {currentDiagramCode && (
            <button
              className={`btn btn-sm ${isEditingCode ? 'btn-primary' : 'btn-outline'}`}
              onClick={isEditingCode ? handleCancelEditing : handleStartEditing}
              style={{ fontSize: '0.75rem', height: '30px' }}
              title={isEditingCode ? 'Volver a la vista de diagrama' : 'Editar código Mermaid directamente'}
            >
              <span className="ms ms-xs">{isEditingCode ? 'visibility' : 'edit'}</span>
              <span>{isEditingCode ? 'Ver Diagrama' : 'Editar código'}</span>
            </button>
          )}

          {/* Botón Guardar cambios cuando está editando */}
          {isEditingCode && (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSaveEditedCode}
              disabled={savingCode}
              style={{ fontSize: '0.75rem', height: '30px', background: '#16a34a', borderColor: '#16a34a' }}
              title="Guardar código modificado"
            >
              <span className="ms ms-xs">{savingCode ? 'autorenew' : 'save'}</span>
              <span>{savingCode ? 'Guardando...' : 'Guardar'}</span>
            </button>
          )}

          {/* Botones Descargar / Exportar */}
          {currentDiagramCode && !isEditingCode && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleExportMMD}
                title="Descargar archivo de código fuente (.mmd)"
                style={{ fontSize: '0.75rem', height: '30px', padding: '0 8px' }}
              >
                <span className="ms ms-xs">download</span>
                <span>.mmd</span>
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleExportSVG}
                title="Exportar diagrama en formato vectorial (.svg)"
                style={{ fontSize: '0.75rem', height: '30px', padding: '0 8px' }}
              >
                <span className="ms ms-xs">image</span>
                <span>SVG</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="page-scrollable" style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>

        {/* Quality & Validation Banner (Sección 14) */}
        {currentValidation && currentDiagramCode && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: currentValidation.isValid ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${currentValidation.isValid ? '#86efac' : '#fca5a5'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="ms ms-sm" style={{ color: currentValidation.isValid ? '#16a34a' : '#dc2626' }}>
                  {currentValidation.isValid ? 'check_circle' : 'cancel'}
                </span>
                <strong style={{ fontSize: '0.875rem', color: currentValidation.isValid ? '#15803d' : '#b91c1c' }}>
                  {currentValidation.isValid ? '✓ Mermaid válido' : '✕ Mermaid inválido'}
                </strong>
              </div>

              {/* Statistics counter */}
              {currentValidation.stats && (
                <div style={{ display: 'flex', gap: '10px', fontSize: '0.8125rem', color: 'var(--on-surface-variant)', flexWrap: 'wrap' }}>
                  {activeModelTab === 'er' ? (
                    <>
                      <span>✓ <strong>{currentValidation.stats.entitiesCount || 0}</strong> entidades</span>
                      <span>•</span>
                      <span>✓ <strong>{currentValidation.stats.relationshipsCount || 0}</strong> relaciones</span>
                      <span>•</span>
                      <span>✓ <strong>{currentValidation.stats.pksCount || 0}</strong> PKs</span>
                    </>
                  ) : (
                    <>
                      <span>✓ <strong>{currentValidation.stats.classesCount || 0}</strong> clases</span>
                      <span>•</span>
                      <span>✓ <strong>{currentValidation.stats.relationshipsCount || 0}</strong> relaciones</span>
                      <span>•</span>
                      <span>✓ <strong>{currentValidation.stats.methodsCount || 0}</strong> métodos</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Error notifications */}
            {currentValidation.errors && currentValidation.errors.length > 0 && (
              <div style={{ fontSize: '0.8125rem', color: '#b91c1c', marginTop: '4px' }}>
                {currentValidation.errors.map((err, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '2px 0' }}>
                    <span>✕</span> <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Warnings list */}
            {currentValidation.warnings && currentValidation.warnings.length > 0 && (
              <div style={{ fontSize: '0.8125rem', color: '#b45309', marginTop: '4px' }}>
                {currentValidation.warnings.map((warn, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '2px 0' }}>
                    <span>⚠</span> <span>{warn}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* View Mode: Editor Interactivo vs Viewport de Diagrama */}
        {isEditingCode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="detail-section-label" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  Editor de Código Mermaid ({activeModelTab === 'er' ? 'erDiagram' : 'classDiagram'})
                </span>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                  Puedes modificar las entidades, atributos y relaciones directamente. Haz clic en "Validar" para comprobar la sintaxis.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => validateCodeOnDemand(activeModelTab === 'er' ? 'ER' : 'CLASS', editedCode)}
                  disabled={isValidating}
                >
                  <span className="ms ms-xs">rule</span>
                  <span>Validar cambios</span>
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveEditedCode}
                  disabled={savingCode}
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}
                >
                  <span className="ms ms-xs">save</span>
                  <span>{savingCode ? 'Guardando...' : 'Guardar y aplicar'}</span>
                </button>
              </div>
            </div>

            <textarea
              className="diagram-raw-editor"
              rows={22}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.875rem',
                lineHeight: 1.5,
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface-container-low)',
                border: '1px solid var(--border-default)',
                width: '100%',
                boxSizing: 'border-box'
              }}
              value={editedCode}
              onChange={(e) => setEditedCode(e.target.value)}
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
                    <p className="empty-state-desc">Genera el modelo Entidad-Relación con IA a partir de los datos y requisitos del proyecto.</p>
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
                    minHeight="540px"
                    isOutdated={erIsOutdated}
                    onRegenerate={() => handleGenerateER(true)}
                    canGenerate={true}
                    isGenerating={generatingER}
                  />
                )}

                {/* Resumen de Entidades */}
                {entities.length > 0 && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <p className="detail-section-label" style={{ marginBottom: '10px' }}>
                      Entidades Persistentes del Sistema ({entities.length})
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
                    minHeight="540px"
                    isOutdated={classIsOutdated}
                    onRegenerate={() => handleGenerateClassDiagram(true)}
                    canGenerate={true}
                    isGenerating={generatingClasses}
                  />
                ) : (
                  <div className="empty-state" style={{ border: '1px dashed var(--outline-variant)', borderRadius: 'var(--radius-lg)' }}>
                    <div className="empty-state-icon"><span className="ms ms-xl">schema</span></div>
                    <p className="empty-state-title">Sin diagrama de clases generado</p>
                    <p className="empty-state-desc">Genera el modelo de clases POO del dominio a partir de las entidades, procesos y operaciones del sistema.</p>
                    <div style={{ marginTop: '12px' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleGenerateClassDiagram(true)} disabled={generatingClasses}>
                        <span className="ms ms-xs">auto_awesome</span>
                        <span>Generar Clases</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Grid de Clases de Dominio */}
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
                          <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--on-surface-variant)' }}>Operaciones / Métodos:</div>
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
                            style={{ color: '#f87171' }}
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

      {/* Modal Validación Cruzada E/R ↔ POO */}
      <Modal
        isOpen={crossValOpen}
        onClose={() => setCrossValOpen(false)}
        title="Validación Cruzada de Coherencia: E/R vs POO"
        footer={(
          <button className="btn btn-primary btn-md" onClick={() => setCrossValOpen(false)}>
            Entendido
          </button>
        )}
      >
        {crossValLoading ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <div className="spin" style={{ display: 'inline-block', marginBottom: '8px' }}>
              <span className="ms ms-lg">sync</span>
            </div>
            <p>Comparando correspondencia conceptual entre diagramas...</p>
          </div>
        ) : crossValReport ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: crossValReport.isConsistent ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${crossValReport.isConsistent ? '#86efac' : '#fde68a'}`
            }}>
              <div>
                <strong style={{ fontSize: '0.9375rem', color: crossValReport.isConsistent ? '#15803d' : '#b45309' }}>
                  {crossValReport.isConsistent ? '✓ Modelos Coherentes' : '⚠ Discrepancias Detectadas'}
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                  Puntaje de alineación conceptual
                </p>
              </div>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: crossValReport.score >= 70 ? '#15803d' : '#b45309'
              }}>
                {crossValReport.score}%
              </div>
            </div>

            {crossValReport.discrepancies && crossValReport.discrepancies.length > 0 ? (
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Observaciones de Inconsistencia:</label>
                <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: '0.8125rem', color: 'var(--on-surface)' }}>
                  {crossValReport.discrepancies.map((d, i) => (
                    <li key={i} style={{ marginBottom: '6px' }}>{d}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p style={{ fontSize: '0.8125rem', color: '#15803d', margin: 0 }}>
                Las entidades del modelo relacional corresponden adecuadamente con las clases del dominio orientado a objetos.
              </p>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Modal Editar Clase (Gobernanza) */}
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
