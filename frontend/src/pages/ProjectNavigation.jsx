import React, { useState, useEffect, useMemo } from 'react';
import DiagramViewport from '../components/common/DiagramViewport';
import { generateNavigationDiagram, generateFlowchartDiagram } from '../utils/mermaidGenerators';
import { diagramsApi } from '../api/diagrams.api';

export default function ProjectNavigation({ project, onProjectUpdated }) {
  const [activeTab, setActiveTab] = useState('tree'); // 'tree' | 'flow' | 'hierarchy' | 'matrix' | 'code'

  const screens = project.screens || [];
  const requirements = project.requirements || [];
  const useCases = project.useCases || [];
  const navigationNodes = project.navigationNodes || [];

  // Local fallback generators
  const localNavCode = useMemo(() => generateNavigationDiagram(navigationNodes, screens, project.name), [navigationNodes, screens, project.name]);
  const localFlowCode = useMemo(() => generateFlowchartDiagram(requirements, useCases, project.name), [requirements, useCases, project.name]);

  const NAV_GEN_KEY = `icase_nav_gen_${project.id}`;
  const FLOW_GEN_KEY = `icase_flow_gen_${project.id}`;

  // Árbol de Navegación state
  const [storedNavDiagram, setStoredNavDiagram] = useState('');
  const [isNavOutdated, setIsNavOutdated] = useState(false);
  const [generatingNav, setGeneratingNav] = useState(() => {
    try {
      const raw = localStorage.getItem(`icase_nav_gen_${project.id}`);
      if (raw && Date.now() - parseInt(raw, 10) < 180000) return true;
    } catch (e) { }
    return false;
  });

  // Diagrama de Flujo state
  const [storedFlowDiagram, setStoredFlowDiagram] = useState('');
  const [isFlowOutdated, setIsFlowOutdated] = useState(false);
  const [generatingFlow, setGeneratingFlow] = useState(() => {
    try {
      const raw = localStorage.getItem(`icase_flow_gen_${project.id}`);
      if (raw && Date.now() - parseInt(raw, 10) < 180000) return true;
    } catch (e) { }
    return false;
  });
  const [flowNotice, setFlowNotice] = useState('');

  // Polling si se está generando en segundo plano y el usuario cambia de pestaña
  useEffect(() => {
    if (!generatingNav && !generatingFlow) return;
    const interval = setInterval(() => {
      loadDiagrams();
    }, 2500);
    return () => clearInterval(interval);
  }, [generatingNav, generatingFlow]);

  useEffect(() => {
    loadDiagrams();
  }, [project.id]);

  async function loadDiagrams() {
    try {
      const [avail, navRes, flowRes] = await Promise.allSettled([
        diagramsApi.getAvailability(project.id),
        diagramsApi.getDiagram(project.id, 'NAVIGATION'),
        diagramsApi.getDiagram(project.id, 'FLOWCHART')
      ]);

      if (navRes.status === 'fulfilled') {
        const code = navRes.value?.code || navRes.value?.mermaidCode || navRes.value?.artifact?.mermaidCode;
        if (code) {
          setStoredNavDiagram(code);
          setIsNavOutdated(!!navRes.value.isOutdated);
          setGeneratingNav(false);
          localStorage.removeItem(NAV_GEN_KEY);
        }
      }

      if (flowRes.status === 'fulfilled') {
        const code = flowRes.value?.code || flowRes.value?.mermaidCode || flowRes.value?.artifact?.mermaidCode;
        if (code) {
          setStoredFlowDiagram(code);
          setIsFlowOutdated(!!flowRes.value.isOutdated);
          setGeneratingFlow(false);
          localStorage.removeItem(FLOW_GEN_KEY);
        }
      }

      if (avail.status === 'fulfilled') {
        const d = avail.value?.diagrams;
        if (d?.NAVIGATION?.isOutdated) setIsNavOutdated(true);
        if (d?.FLOWCHART?.isOutdated) setIsFlowOutdated(true);
      }
    } catch (err) {
      console.error('Error loading navigation/flow diagrams:', err);
    }
  }

  async function handleGenerateNav(force = false) {
    try {
      setGeneratingNav(true);
      localStorage.setItem(NAV_GEN_KEY, Date.now().toString());
      const isForce = typeof force === 'object' ? Boolean(force.force) : Boolean(force);
      const res = await diagramsApi.generateDiagram(project.id, 'NAVIGATION', isForce);
      const code = res?.code || res?.mermaidCode || res?.diagram?.mermaidCode || res?.artifact?.mermaidCode;
      if (code) {
        setStoredNavDiagram(code);
        setIsNavOutdated(false);
      }
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al generar árbol de navegación: ${err.message}`);
    } finally {
      setGeneratingNav(false);
      localStorage.removeItem(NAV_GEN_KEY);
    }
  }

  async function handleGenerateFlow(force = false) {
    try {
      setGeneratingFlow(true);
      localStorage.setItem(FLOW_GEN_KEY, Date.now().toString());
      const isForce = typeof force === 'object' ? Boolean(force.force) : Boolean(force);
      const res = await diagramsApi.generateDiagram(project.id, 'FLOWCHART', isForce);
      setFlowNotice(res.warning || '');
      const code = res?.code || res?.mermaidCode || res?.diagram?.mermaidCode || res?.artifact?.mermaidCode;
      if (code) {
        setStoredFlowDiagram(code);
        setIsFlowOutdated(false);
      }
      if (onProjectUpdated) await onProjectUpdated();
    } catch (err) {
      alert(`Error al generar diagrama de flujo: ${err.message}`);
    } finally {
      setGeneratingFlow(false);
      localStorage.removeItem(FLOW_GEN_KEY);
    }
  }

  const effectiveNavCode = storedNavDiagram || ((navigationNodes.length || screens.length) ? localNavCode : '');
  const effectiveFlowCode = storedFlowDiagram || '';



  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header bar */}
      <div className="full-page-header" style={{ borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div>
            <h2 className="page-title" style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="ms ms-sm" style={{ color: 'var(--primary)' }}>account_tree</span>
              Navegación & Procesos
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
              Árbol jerárquico de pantallas de la aplicación y Diagrama de Flujo de procesos operativos
            </span>
          </div>
          <div className="vdivider" />
          <div style={{ display: 'flex', gap: '12px' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              <strong style={{ color: 'var(--on-surface)', fontWeight: 600 }}>{screens.length}</strong> pantallas
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--secondary)' }}>
              <strong style={{ color: 'var(--on-surface)', fontWeight: 600 }}>{requirements.length}</strong> requisitos
            </span>
          </div>
        </div>

        {/* View Toggle & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {activeTab === 'tree' && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => handleGenerateNav(true)}
              disabled={generatingNav}
              title="Generar o regenerar árbol de navegación con IA"
            >
              <span className={`ms ms-xs ${generatingNav ? 'spin' : ''}`}>
                {generatingNav ? 'autorenew' : 'auto_awesome'}
              </span>
              <span>{generatingNav ? 'Generando...' : storedNavDiagram ? 'Regenerar Árbol' : 'Generar Árbol'}</span>
            </button>
          )}

          {activeTab === 'flow' && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => handleGenerateFlow(true)}
              disabled={generatingFlow}
              title="Generar o regenerar diagrama de flujo operativo con IA"
            >
              <span className={`ms ms-xs ${generatingFlow ? 'spin' : ''}`}>
                {generatingFlow ? 'autorenew' : 'auto_awesome'}
              </span>
              <span>{generatingFlow ? 'Generando...' : storedFlowDiagram ? 'Regenerar Flujo' : 'Generar Flujo'}</span>
            </button>
          )}

          <div className="view-toggle" style={{ background: 'var(--surface-container-high)' }}>
            <button
              className={`view-toggle-btn ${activeTab === 'tree' ? 'active' : ''}`}
              onClick={() => setActiveTab('tree')}
              title="Estructura jerárquica de la aplicación (Padre → Hijo)"
            >
              <span className="ms ms-xs">account_tree</span>
              <span>1. Árbol de Navegación</span>
            </button>
            <button
              className={`view-toggle-btn ${activeTab === 'flow' ? 'active' : ''}`}
              onClick={() => setActiveTab('flow')}
              title="Flujo operativo de procesos de negocio"
            >
              <span className="ms ms-xs">alt_route</span>
              <span>2. Diagrama de Flujo</span>
            </button>
            <button
              className={`view-toggle-btn ${activeTab === 'code' ? 'active' : ''}`}
              onClick={() => setActiveTab('code')}
            >
              <span className="ms ms-xs">code</span>
              <span>Mermaid</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="page-scrollable" style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
        {/* SUBTAB 1: ÁRBOL DE NAVEGACIÓN */}
        {activeTab === 'tree' && (
          <div>
            <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                  Árbol de Navegación
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                  Estructura jerárquica de la aplicación: organización multinivel desde la raíz del sistema hasta los módulos y pantallas.
                </p>
              </div>
            </div>


            <DiagramViewport
              code={effectiveNavCode}
              type="flowchart"
              title="Árbol de Navegación (Jerarquía Padre → Hijo)"
              minHeight="520px"
              initialZoom={0.4}
              isOutdated={isNavOutdated}
              onRegenerate={() => handleGenerateNav(true)}
              canGenerate={true}
              isGenerating={generatingNav}
            />

          </div>
        )}

        {flowNotice && <p role="status" style={{ padding: '12px' }}>{flowNotice}</p>}
        {/* SUBTAB 2: DIAGRAMA DE FLUJO */}
        {activeTab === 'flow' && (
          <div>
            <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                  Diagrama de Flujo
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                  Flujo secuencial de procesos operativos de negocio: inicio, pasos de procesamiento, decisiones con bifurcación y fin.
                </p>
              </div>
            </div>

            <DiagramViewport
              code={effectiveFlowCode}
              type="flowchart"
              title="Diagrama de Flujo (Procesos Operativos)"
              minHeight="520px"
              isOutdated={isFlowOutdated}
              onRegenerate={() => handleGenerateFlow(true)}
              canGenerate={true}
              isGenerating={generatingFlow}
            />
          </div>
        )}

        {/* SUBTAB 3: CÓDIGO MERMAID */}
        {activeTab === 'code' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h5 style={{ margin: '0 0 6px', fontSize: '0.875rem', fontWeight: 600 }}>Código: Árbol de Navegación</h5>
              <textarea
                className="diagram-raw-editor"
                rows={10}
                readOnly
                value={effectiveNavCode}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8125rem' }}
              />
            </div>
            <div>
              <h5 style={{ margin: '0 0 6px', fontSize: '0.875rem', fontWeight: 600 }}>Código: Diagrama de Flujo</h5>
              <textarea
                className="diagram-raw-editor"
                rows={10}
                readOnly
                value={effectiveFlowCode}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.8125rem' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
