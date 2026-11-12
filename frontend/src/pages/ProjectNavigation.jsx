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
    } catch (e) {}
    return false;
  });

  // Diagrama de Flujo state
  const [storedFlowDiagram, setStoredFlowDiagram] = useState('');
  const [isFlowOutdated, setIsFlowOutdated] = useState(false);
  const [generatingFlow, setGeneratingFlow] = useState(() => {
    try {
      const raw = localStorage.getItem(`icase_flow_gen_${project.id}`);
      if (raw && Date.now() - parseInt(raw, 10) < 180000) return true;
    } catch (e) {}
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
      setFlowNotice(res.warning||'');
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

  const effectiveNavCode = storedNavDiagram || ((navigationNodes.length||screens.length)?localNavCode:'');
  const effectiveFlowCode = storedFlowDiagram || '';

  

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: '#FFFFFF', padding: '32px 40px' }}>
      
      {/* Mockup Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '1.625rem', fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
              Navegación
            </h1>
            <span style={{
              background: '#EEF2FF',
              color: '#4F46E5',
              border: '1px solid #E0E7FF',
              fontSize: '0.75rem',
              fontWeight: 500,
              padding: '2px 10px',
              borderRadius: '9999px'
            }}>
              Flujo & Pantallas
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: '6px 0 0 0' }}>
            Jerarquía de pantallas y flujo de procesos operativos del sistema.
          </p>
        </div>

        {/* Actions & Capsule Switch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {activeTab === 'tree' && (
            <button
              type="button"
              onClick={() => handleGenerateNav(true)}
              disabled={generatingNav}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#334155',
                borderRadius: '8px',
                padding: '8px 18px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
              }}
            >
              {generatingNav ? 'Generando...' : 'Regenerar Árbol'}
            </button>
          )}

          {activeTab === 'flow' && (
            <button
              type="button"
              onClick={() => handleGenerateFlow(true)}
              disabled={generatingFlow}
              style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#334155',
                borderRadius: '8px',
                padding: '8px 18px',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
              }}
            >
              {generatingFlow ? 'Generando...' : 'Regenerar Flujo'}
            </button>
          )}

          <div style={{
            display: 'inline-flex',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '3px',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
          }}>
            {[
              ['tree', 'Árbol de Navegación'],
              ['flow', 'Diagrama de Flujo'],
              ['code', 'Mermaid']
            ].map(([tabKey, label]) => (
              <button
                key={tabKey}
                type="button"
                onClick={() => setActiveTab(tabKey)}
                style={{
                  background: activeTab === tabKey ? '#0F172A' : 'transparent',
                  color: activeTab === tabKey ? '#FFFFFF' : '#64748B',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '0.8125rem',
                  fontWeight: activeTab === tabKey ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Main Content */}
      <div style={{ flex: 1, minHeight: 0 }}>
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
              isOutdated={isNavOutdated}
              onRegenerate={() => handleGenerateNav(true)}
              canGenerate={true}
              isGenerating={generatingNav}
            />
          </div>
        )}

        {flowNotice&&<p role="status" style={{padding:'12px'}}>{flowNotice}</p>}
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
    </div>
  );
}
