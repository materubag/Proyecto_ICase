import React, { useState, useMemo } from 'react';
import DiagramViewport from '../components/common/DiagramViewport';
import Modal from '../components/common/Modal';

// Tareas predeterminadas basadas en el ciclo de vida de desarrollo de software
const DEFAULT_TASKS = [
  { id: 'T-01', name: 'Lluvia de ideas y definición del alcance del proyecto', phase: 'Planificación', responsible: 'Todo el Equipo', days: 2, startDay: 1, endDay: 2, status: 'DONE', dependsOn: '', isCritical: true },
  { id: 'T-02', name: 'Evaluación y selección de herramientas de gestión', phase: 'Planificación', responsible: 'Líder de Proyecto', days: 2, startDay: 2, endDay: 3, status: 'DONE', dependsOn: 'T-01', isCritical: true },
  { id: 'T-03', name: 'Entrevistas a stakeholders y levantamiento de fuentes', phase: 'Requerimientos', responsible: 'Analista de Negocio', days: 3, startDay: 3, endDay: 5, status: 'DONE', dependsOn: 'T-02', isCritical: true },
  { id: 'T-04', name: 'Especificación de requisitos funcionales y no funcionales (Formato UTA)', phase: 'Requerimientos', responsible: 'Ingeniero de Requisitos', days: 4, startDay: 6, endDay: 9, status: 'DONE', dependsOn: 'T-03', isCritical: true },
  { id: 'T-05', name: 'Identificación de 4 procesos fundamentales y Casos de Uso UML', phase: 'Requerimientos', responsible: 'Ingeniero de Requisitos', days: 3, startDay: 8, endDay: 10, status: 'IN_PROGRESS', dependsOn: 'T-04', isCritical: false },
  { id: 'T-06', name: 'Modelado de datos (Diagrama Entidad-Relación y Diccionario)', phase: 'Diseño', responsible: 'Arquitecto de Datos', days: 4, startDay: 10, endDay: 13, status: 'IN_PROGRESS', dependsOn: 'T-04', isCritical: true },
  { id: 'T-07', name: 'Diseño de arquitectura de software y del sistema en capas', phase: 'Diseño', responsible: 'Arquitecto de Software', days: 3, startDay: 11, endDay: 13, status: 'IN_PROGRESS', dependsOn: 'T-04', isCritical: false },
  { id: 'T-08', name: 'Árbol y mapa de navegación de la aplicación', phase: 'Diseño', responsible: 'Diseñador UI/UX', days: 2, startDay: 12, endDay: 13, status: 'PENDING', dependsOn: 'T-05', isCritical: false },
  { id: 'T-09', name: 'Diseño de prototipos interactivos (Sketches y Mockups)', phase: 'Prototipado', responsible: 'Diseñador UI/UX', days: 5, startDay: 14, endDay: 18, status: 'PENDING', dependsOn: 'T-06,T-08', isCritical: true },
  { id: 'T-10', name: 'Documentación de estructura de organización de la información', phase: 'Prototipado', responsible: 'Líder Técnico', days: 3, startDay: 17, endDay: 19, status: 'PENDING', dependsOn: 'T-09', isCritical: true },
  { id: 'T-11', name: 'Consolidación de evidencias de equipo y sustentación final', phase: 'Cierre', responsible: 'Todo el Equipo', days: 2, startDay: 20, endDay: 21, status: 'PENDING', dependsOn: 'T-10', isCritical: true }
];

const TOOLS_EVALUATION = [
  {
    name: 'GitHub Projects / Issues',
    category: 'Gestión Ágil & Código',
    pros: 'Integración nativa con repositorios Git, seguimiento de issues vinculado a commits y PRs, tableros Kanban automatizados, sin costo para estudiantes.',
    cons: 'Gráficos de Gantt y PERT nativos limitados; requiere plugins o extensiones.',
    score: 9.4,
    recommended: true,
    justification: 'Herramienta principal seleccionada. Permite centralizar el código fuente, la trazabilidad de requerimientos, las discusiones en equipo y los tableros Kanban en un único ecosistema colaborativo sin fricción técnica.'
  },
  {
    name: 'Jira Software (Atlassian)',
    category: 'Gestión Empresarial Scrum/Kanban',
    pros: 'Estandar de la industria, potentes flujos de trabajo personalizados, control de versiones de requerimientos y métricas de velocidad.',
    cons: 'Curva de aprendizaje elevada, configuración compleja para proyectos académicos rápidos.',
    score: 8.8,
    recommended: false,
    justification: 'Excelente para proyectos a gran escala corporativa, pero agrega sobrecarga de configuración innecesaria para el ciclo de desarrollo asistido por software en el aula.'
  },
  {
    name: 'Trello',
    category: 'Tableros Kanban Visuales',
    pros: 'Extremadamente intuitivo, interfaz limpia, inicio inmediato con power-ups sencillos.',
    cons: 'Falta de soporte robusto para dependencias complejas, cálculo de ruta crítica y trazabilidad formal.',
    score: 7.9,
    recommended: false,
    justification: 'Ideal para lluvia de ideas preliminar, pero insuficiente para la gestión de dependencias técnicas y modelado de ingeniería.'
  },
  {
    name: 'ClickUp',
    category: 'Suite Todo en Uno',
    pros: 'Vistas múltiples (Gantt, Lista, Tablero, Calendario, Documentos) integradas.',
    cons: 'Interfaz saturada, tiempos de carga variables y límites estrictos en el plan gratuito para automatizaciones.',
    score: 8.5,
    recommended: false,
    justification: 'Buena alternativa para visualización de cronogramas, pero menos integrada con el flujo de commits que GitHub Projects.'
  }
];

export default function ProjectPlanning({ project }) {
  const [activeSubTab, setActiveSubTab] = useState('pert'); // 'pert' | 'gantt' | 'wbs' | 'tools'
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem(`icase_planning_tasks_${project.id}`);
    return saved ? JSON.parse(saved) : DEFAULT_TASKS;
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [phase, setPhase] = useState('Planificación');
  const [responsible, setResponsible] = useState('Equipo');
  const [days, setDays] = useState(3);
  const [dependsOn, setDependsOn] = useState('');
  const [status, setStatus] = useState('PENDING');

  function saveTasks(updated) {
    setTasks(updated);
    localStorage.setItem(`icase_planning_tasks_${project.id}`, JSON.stringify(updated));
  }

  function handleOpenNew() {
    setEditingTask(null);
    const nextNum = tasks.length + 1;
    setName('');
    setPhase('Planificación');
    setResponsible('Equipo');
    setDays(2);
    setDependsOn('');
    setStatus('PENDING');
    setModalOpen(true);
  }

  function handleOpenEdit(task) {
    setEditingTask(task);
    setName(task.name);
    setPhase(task.phase);
    setResponsible(task.responsible);
    setDays(task.days);
    setDependsOn(task.dependsOn || '');
    setStatus(task.status);
    setModalOpen(true);
  }

  function handleSaveTask(e) {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingTask) {
      const updated = tasks.map(t => t.id === editingTask.id ? {
        ...t, name, phase, responsible, days: Number(days), dependsOn, status
      } : t);
      saveTasks(updated);
    } else {
      const nextId = `T-${tasks.length + 1 < 10 ? '0' + (tasks.length + 1) : tasks.length + 1}`;
      const newTask = {
        id: nextId,
        name,
        phase,
        responsible,
        days: Number(days),
        startDay: 1,
        endDay: Number(days),
        status,
        dependsOn,
        isCritical: false
      };
      saveTasks([...tasks, newTask]);
    }
    setModalOpen(false);
  }

  function handleDeleteTask(id) {
    if (confirm('¿Eliminar esta tarea de la planificación?')) {
      saveTasks(tasks.filter(t => t.id !== id));
    }
  }

  // Generate Mermaid GANTT code using explicit dates (avoids 'Invalid date' errors with 'after' syntax)
  const ganttCode = useMemo(() => {
    // Use Monday of current week as base
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - baseDate.getDay() + 1);

    function addWorkdays(date, days) {
      const d = new Date(date);
      let added = 0;
      while (added < days) {
        d.setDate(d.getDate() + 1);
        if (d.getDay() !== 0 && d.getDay() !== 6) added++;
      }
      return d;
    }

    function toYMD(date) {
      return date.toISOString().slice(0, 10);
    }

    let code = `gantt\n  title Cronograma del Proyecto - ${project.name || 'Sistema'}\n  dateFormat YYYY-MM-DD\n  axisFormat %d/%m\n\n`;
    const phases = [...new Set(tasks.map(t => t.phase))];

    phases.forEach(ph => {
      code += `  section ${ph}\n`;
      const phaseTasks = tasks.filter(t => t.phase === ph);
      phaseTasks.forEach(t => {
        const cleanName = t.name.replace(/[,:;#]/g, ' ').slice(0, 50);
        const taskState = t.status === 'DONE' ? 'done, ' : t.status === 'IN_PROGRESS' ? 'active, ' : '';
        const crit = t.isCritical ? 'crit, ' : '';
        // Compute start date from startDay offset (1-based)
        const startDate = toYMD(addWorkdays(baseDate, (t.startDay || 1) - 1));
        const taskId = t.id.replace(/-/g, '_');
        code += `  ${cleanName} :${crit}${taskState}${taskId}, ${startDate}, ${t.days}d\n`;
      });
    });
    return code;
  }, [tasks, project.name]);

  // Generate Mermaid PERT/CPM Flowchart code
  const pertCode = useMemo(() => {
    let code = `graph LR\n`;
    code += `  %% Estilos para PERT / CPM\n`;
    code += `  classDef critical fill:#fef2f2,stroke:#dc2626,stroke-width:3px,color:#991b1b,font-weight:bold;\n`;
    code += `  classDef normal fill:#f0fdf4,stroke:#16a34a,stroke-width:1.5px,color:#166534;\n`;
    code += `  classDef startEnd fill:#2563eb,stroke:#1d4ed8,stroke-width:2px,color:#ffffff,font-weight:bold;\n\n`;

    code += `  START((INICIO<br/>Día 0)):::startEnd\n`;
    code += `  END_NODE((FIN<br/>Entrega)):::startEnd\n\n`;

    // Tasks without dependencies connect to START
    tasks.forEach(t => {
      const sanitizedName = t.name.replace(/["()]/g, '').slice(0, 30);
      const nodeClass = t.isCritical ? 'critical' : 'normal';
      code += `  ${t.id.replace('-', '')}["<b>${t.id}: ${sanitizedName}</b><br/>Duración: ${t.days}d | Resp: ${t.responsible}"]:::${nodeClass}\n`;

      if (!t.dependsOn || !t.dependsOn.trim()) {
        code += `  START --> ${t.id.replace('-', '')}\n`;
      } else {
        const deps = t.dependsOn.split(',').map(d => d.trim()).filter(Boolean);
        deps.forEach(d => {
          const isCritEdge = t.isCritical && (tasks.find(x => x.id === d)?.isCritical);
          if (isCritEdge) {
            code += `  ${d.replace('-', '')} ==>|Ruta Crítica| ${t.id.replace('-', '')}\n`;
          } else {
            code += `  ${d.replace('-', '')} --> ${t.id.replace('-', '')}\n`;
          }
        });
      }
    });

    // Leaves connect to END
    const allDepIds = new Set(tasks.flatMap(t => (t.dependsOn || '').split(',').map(x => x.trim())));
    const leaves = tasks.filter(t => !allDepIds.has(t.id));
    leaves.forEach(t => {
      code += `  ${t.id.replace('-', '')} --> END_NODE\n`;
    });

    return code;
  }, [tasks]);

  const totalDays = tasks.reduce((sum, t) => sum + (t.isCritical ? t.days : 0), 0) || tasks.reduce((sum, t) => sum + t.days, 0);
  const completedCount = tasks.filter(t => t.status === 'DONE').length;
  const progressPercent = Math.round((completedCount / (tasks.length || 1)) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Subheader / Sub-tabs */}
      <div className="full-page-header" style={{ borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div>
            <h2 className="page-title" style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="ms ms-sm" style={{ color: 'var(--primary)' }}>calendar_month</span>
              1. Planificación y Gestión de Proyectos
            </h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
              Cronograma temporal, Diagramas GANTT y PERT/CPM, y Selección de Herramientas
            </span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="view-toggle" style={{ background: 'var(--surface-container-high)' }}>
          <button
            className={`view-toggle-btn ${activeSubTab === 'pert' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('pert')}
          >
            <span className="ms ms-xs">hub</span>
            <span>Diagrama PERT / CPM (Ruta Crítica)</span>
          </button>
          <button
            className={`view-toggle-btn ${activeSubTab === 'gantt' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('gantt')}
          >
            <span className="ms ms-xs">timeline</span>
            <span>Diagrama GANTT</span>
          </button>
          <button
            className={`view-toggle-btn ${activeSubTab === 'wbs' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('wbs')}
          >
            <span className="ms ms-xs">format_list_bulleted</span>
            <span>Lluvia & Matriz WBS</span>
          </button>
          <button
            className={`view-toggle-btn ${activeSubTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('tools')}
          >
            <span className="ms ms-xs">handyman</span>
            <span>Herramientas Seleccionadas</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="page-scrollable" style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
        {/* KPI Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
            <span className="stat-card-label">Tareas Totales</span>
            <div className="stat-card-value">{tasks.length}</div>
            <span className="stat-card-desc">Lluvia de ideas estructurada</span>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #16a34a' }}>
            <span className="stat-card-label">Progreso del Plan</span>
            <div className="stat-card-value">{progressPercent}%</div>
            <span className="stat-card-desc">{completedCount} de {tasks.length} completadas</span>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #dc2626' }}>
            <span className="stat-card-label">Duración Ruta Crítica</span>
            <div className="stat-card-value">~{totalDays} días</div>
            <span className="stat-card-desc">Calculada vía PERT/CPM</span>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #9333ea' }}>
            <span className="stat-card-label">Herramienta Seleccionada</span>
            <div className="stat-card-value" style={{ fontSize: '1rem', marginTop: '6px' }}>GitHub Projects</div>
            <span className="stat-card-desc">Gestión ágil + Repositorio Git</span>
          </div>
        </div>

        {/* 1. VIEW: WBS & BRAINSTORMING TABLE */}
        {activeSubTab === 'wbs' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--on-surface)', margin: 0 }}>
                  Tabla de Actividades y Tiempos Estimados
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '2px 0 0' }}>
                  Resultado de la lluvia de ideas con asignación de responsables, duraciones y dependencias del proyecto.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary btn-sm" onClick={handleOpenNew}>
                  <span className="ms ms-sm">add</span>
                  <span>Nueva Actividad</span>
                </button>
              </div>
            </div>

            <div style={{ background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline-variant)', overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-container-low)', borderBottom: '1px solid var(--outline-variant)', color: 'var(--on-surface-variant)' }}>
                    <th style={{ padding: '10px 14px', width: '70px' }}>ID</th>
                    <th style={{ padding: '10px 14px' }}>Actividad / Tarea</th>
                    <th style={{ padding: '10px 14px', width: '130px' }}>Fase</th>
                    <th style={{ padding: '10px 14px', width: '160px' }}>Responsable</th>
                    <th style={{ padding: '10px 14px', width: '90px' }}>Tiempo</th>
                    <th style={{ padding: '10px 14px', width: '110px' }}>Depende de</th>
                    <th style={{ padding: '10px 14px', width: '110px' }}>Estado</th>
                    <th style={{ padding: '10px 14px', width: '80px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t, idx) => (
                    <tr
                      key={t.id}
                      style={{
                        borderBottom: '1px solid var(--outline-variant)',
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary)' }}>
                        {t.id}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--on-surface)', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {t.isCritical && (
                            <span className="badge badge-danger" style={{ fontSize: '0.625rem', padding: '1px 5px' }}>
                              CRÍTICA
                            </span>
                          )}
                          <span>{t.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className="tag" style={{ fontSize: '0.75rem' }}>{t.phase}</span>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="ms ms-xs" style={{ color: 'var(--primary)' }}>person</span>
                          <span>{t.responsible}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                        {t.days} día{t.days !== 1 ? 's' : ''}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--secondary)' }}>
                        {t.dependsOn || <span style={{ opacity: 0.5 }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className={`badge ${
                          t.status === 'DONE' ? 'badge-success' :
                          t.status === 'IN_PROGRESS' ? 'badge-warning' : 'badge-neutral'
                        }`} style={{ fontSize: '0.6875rem' }}>
                          {t.status === 'DONE' ? 'Completado' : t.status === 'IN_PROGRESS' ? 'En Progreso' : 'Por Iniciar'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleOpenEdit(t)} title="Editar">
                            <span className="ms ms-xs">edit</span>
                          </button>
                          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--error)' }} onClick={() => handleDeleteTask(t.id)} title="Eliminar">
                            <span className="ms ms-xs">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. VIEW: GANTT CHART */}
        {activeSubTab === 'gantt' && (
          <div>
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--on-surface)', margin: 0 }}>
                Diagrama de GANTT del Proyecto
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '2px 0 0' }}>
                Visualización temporal secuencial de las actividades ordenadas por fases y dependencias.
              </p>
            </div>

            <DiagramViewport
              code={ganttCode}
              type="flowchart"
              title="Cronograma de Actividades (GANTT)"
              minHeight="450px"
            />

            <div className="alert alert-info" style={{ marginTop: '16px' }}>
              <span className="ms ms-sm">info</span>
              <div>
                <strong>Interpretación del GANTT:</strong> Las barras rojas indican actividades sobre la <strong>Ruta Crítica</strong> (aquellas cuyo retraso posterga la fecha final de entrega). Las tareas en gris o azul corresponden a actividades en progreso o completadas.
              </div>
            </div>
          </div>
        )}

        {/* 3. VIEW: PERT / CPM CHART */}
        {activeSubTab === 'pert' && (
          <div>
            <div style={{ marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--on-surface)', margin: 0 }}>
                Diagrama PERT / CPM (Red de Dependencias y Ruta Crítica)
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '2px 0 0' }}>
                Método del Camino Crítico (CPM) para identificar cuellos de botella, predecesoras y secuencia lógica óptima.
              </p>
            </div>

            <DiagramViewport
              code={pertCode}
              type="flowchart"
              title="Red de Dependencias y Ruta Crítica (PERT / CPM)"
              minHeight="480px"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginTop: '16px' }}>
              <div className="info-card" style={{ borderLeft: '4px solid #dc2626' }}>
                <strong style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="ms ms-xs">warning</span> Ruta Crítica (Líneas Dobles / Rojo)
                </strong>
                <p style={{ fontSize: '0.75rem', color: 'var(--secondary)', margin: '4px 0 0' }}>
                  T-01 &rarr; T-02 &rarr; T-03 &rarr; T-04 &rarr; T-06 &rarr; T-09 &rarr; T-10 &rarr; T-11. Holgura cero (0).
                </p>
              </div>
              <div className="info-card" style={{ borderLeft: '4px solid #16a34a' }}>
                <strong style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="ms ms-xs">check_circle</span> Actividades con Holgura (Verde)
                </strong>
                <p style={{ fontSize: '0.75rem', color: 'var(--secondary)', margin: '4px 0 0' }}>
                  T-05 (Casos de Uso), T-07 (Arquitectura), T-08 (Navegación). Se ejecutan en paralelo sin comprometer el deadline.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 4. VIEW: TOOLS SELECTION */}
        {activeSubTab === 'tools' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--on-surface)', margin: 0 }}>
                Búsqueda, Evaluación y Selección de Herramientas de Gestión
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '2px 0 0' }}>
                Análisis comparativo justificado según criterios de agilidad, integración con control de versiones y curva de aprendizaje.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {TOOLS_EVALUATION.map((tool) => (
                <div
                  key={tool.name}
                  className="info-card"
                  style={{
                    border: tool.recommended ? '2px solid var(--primary)' : '1px solid var(--outline-variant)',
                    background: tool.recommended ? 'var(--surface-container-low)' : 'var(--surface-container-lowest)',
                    position: 'relative'
                  }}
                >
                  {tool.recommended && (
                    <span className="badge badge-success" style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="ms ms-xs">verified</span> SELECCIONADA
                    </span>
                  )}
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--on-surface)', margin: '0 0 4px' }}>
                    {tool.name}
                  </h4>
                  <span className="tag" style={{ fontSize: '0.6875rem', marginBottom: '12px' }}>{tool.category}</span>

                  <div style={{ margin: '12px 0' }}>
                    <div style={{ fontSize: '0.75rem', marginBottom: '6px' }}>
                      <strong style={{ color: '#16a34a' }}>+ Ventajas:</strong> {tool.pros}
                    </div>
                    <div style={{ fontSize: '0.75rem' }}>
                      <strong style={{ color: '#dc2626' }}>- Desventajas:</strong> {tool.cons}
                    </div>
                  </div>

                  <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--outline-variant)' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontStyle: 'italic', margin: 0 }}>
                      <strong>Justificación:</strong> "{tool.justification}"
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal Nueva / Editar Tarea */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTask ? `Editar Tarea: ${editingTask.id}` : 'Nueva Tarea de Planificación'}
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button className="btn btn-outline btn-sm" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveTask}>Guardar Tarea</button>
          </div>
        }
      >
        <form onSubmit={handleSaveTask} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="field-label">Nombre de la Actividad / Tarea *</label>
            <input
              type="text"
              className="form-control"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Elaborar especificación de requerimientos"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="field-label">Fase del Proyecto</label>
              <select className="form-control" value={phase} onChange={e => setPhase(e.target.value)}>
                <option>Planificación</option>
                <option>Requerimientos</option>
                <option>Diseño</option>
                <option>Prototipado</option>
                <option>Pruebas</option>
                <option>Cierre</option>
              </select>
            </div>
            <div>
              <label className="field-label">Responsable</label>
              <input
                type="text"
                className="form-control"
                value={responsible}
                onChange={e => setResponsible(e.target.value)}
                placeholder="Ej: Ing. Requisitos"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label className="field-label">Duración (Días) *</label>
              <input
                type="number"
                min="1"
                max="90"
                className="form-control"
                value={days}
                onChange={e => setDays(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="field-label">Dependencias (IDs)</label>
              <input
                type="text"
                className="form-control"
                value={dependsOn}
                onChange={e => setDependsOn(e.target.value)}
                placeholder="Ej: T-01, T-02"
              />
            </div>
            <div>
              <label className="field-label">Estado</label>
              <select className="form-control" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="PENDING">Por Iniciar</option>
                <option value="IN_PROGRESS">En Progreso</option>
                <option value="DONE">Completado</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
