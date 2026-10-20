import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DiagramViewport from '../components/common/DiagramViewport';
import Modal from '../components/common/Modal';
import { diagramsApi } from '../api/diagrams.api';

export default function ProjectArchitecture({ project, onProjectUpdated }) {
  const [archType, setArchType] = useState('software');
  const [showCode, setShowCode] = useState(false);

  const [storedSystemDiagram, setStoredSystemDiagram] = useState('');
  const [storedArchDiagram, setStoredArchDiagram] = useState('');
  const [isOutdated, setIsOutdated] = useState(false);
  const [documentedStack, setDocumentedStack] = useState([]);

  const [archError, setArchError] = useState('');
  const [generatingArch, setGeneratingArch] = useState(false);
  const [diagramVersion, setDiagramVersion] = useState(0);

  const [architectureData, setArchitectureData] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingArch, setIsSavingArch] = useState(false);

  const [editForm, setEditForm] = useState({
    style: '',
    frontend: '',
    backend: '',
    database: ''
  });

  const projectId = project?.id;

  // Extraer el código Mermaid de las distintas formas de respuesta
  // que puede devolver el servicio.
  const extractDiagramCode = useCallback((response) => {
    return (
      response?.code ||
      response?.mermaidCode ||
      response?.diagram?.mermaidCode ||
      response?.artifact?.mermaidCode ||
      response?.data?.code ||
      response?.data?.mermaidCode ||
      ''
    );
  }, []);

  const loadArchitectureData = useCallback(async () => {
    if (!projectId) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/architecture`
      );

      if (!response.ok) {
        throw new Error(
          `No se pudo cargar la arquitectura (${response.status}).`
        );
      }

      const json = await response.json();

      if (json.success && json.data) {
        setArchitectureData(json.data);
      }
    } catch (error) {
      console.error('Error cargando arquitectura:', error);
    }
  }, [projectId]);

  const loadArchDiagram = useCallback(async () => {
    if (!projectId) return;

    try {
      const [availabilityResult, diagramResult] = await Promise.allSettled([
        diagramsApi.getAvailability(projectId),
        diagramsApi.getDiagram(projectId, 'ARCHITECTURE')
      ]);

      if (diagramResult.status === 'fulfilled') {
        const response = diagramResult.value;

        const stack =
          response?.architectureProposal?.documentedTechnologies || [];

        setDocumentedStack(Array.isArray(stack) ? stack : []);

        const systemCode =
          response?.architectureProposal?.systemCode ||
          response?.systemCode ||
          response?.deploymentDiagram ||
          response?.diagram?.systemCode ||
          '';

        setStoredSystemDiagram(systemCode);

        const code = extractDiagramCode(response);

        // No borrar un diagrama existente si la respuesta no contiene
        // código. Esto evita perder la vista por una respuesta parcial.
        if (code) {
          setStoredArchDiagram(code);
          setIsOutdated(Boolean(response?.isOutdated));
        }
      }

      if (availabilityResult.status === 'fulfilled') {
        const availability = availabilityResult.value;
        const diagramStatus = availability?.diagrams?.ARCHITECTURE;

        if (diagramStatus?.isOutdated) {
          setIsOutdated(true);
        }
      }
    } catch (error) {
      console.error('Error cargando diagrama de arquitectura:', error);
    }
  }, [projectId, extractDiagramCode]);

  useEffect(() => {
    setArchitectureData(null);
    setStoredArchDiagram('');
    setStoredSystemDiagram('');
    setDocumentedStack([]);
    setIsOutdated(false);
    setArchError('');

    loadArchitectureData();
    loadArchDiagram();
  }, [projectId, loadArchitectureData, loadArchDiagram]);

  // Regenerar el diagrama.
  const handleGenerateArch = async (force = false) => {
    if (!projectId || generatingArch) return;

    const isForce =
      typeof force === 'object' && force !== null
        ? Boolean(force.force)
        : Boolean(force);

    try {
      setGeneratingArch(true);
      setArchError('');

      const availability = await diagramsApi.getAvailability(projectId);
      const archCheck = availability?.diagrams?.ARCHITECTURE;

      if (archCheck?.status === 'INSUFFICIENT' && !isForce) {
        const missing = archCheck.missing || [];

        setArchError(
          missing.length > 0
            ? `Información insuficiente: ${missing.join('; ')}`
            : 'No hay suficiente información para generar la arquitectura.'
        );

        return;
      }

      const response = await diagramsApi.generateDiagram(
        projectId,
        'ARCHITECTURE',
        isForce
      );

      const code = extractDiagramCode(response);

      if (code) {
        setStoredArchDiagram(code);
      }

      const systemCode =
        response?.architectureProposal?.systemCode ||
        response?.systemCode ||
        response?.deploymentDiagram ||
        response?.diagram?.systemCode ||
        '';

      if (systemCode) {
        setStoredSystemDiagram(systemCode);
      }

      setIsOutdated(false);
      setDiagramVersion((version) => version + 1);

      // Volver a consultar los datos persistidos en el servidor.
      await Promise.all([
        loadArchDiagram(),
        loadArchitectureData()
      ]);

      if (onProjectUpdated) {
        await onProjectUpdated();
      }
    } catch (error) {
      console.error('Error generando arquitectura:', error);

      setArchError(
        error?.message ||
          'Ocurrió un error al generar el diagrama de arquitectura.'
      );
    } finally {
      setGeneratingArch(false);
    }
  };

  // Tecnologías documentadas.
  const documentedFe = documentedStack
    .filter((technology) => technology.category === 'frontend')
    .map((technology) => technology.name)
    .filter(Boolean)
    .join(' + ');

  const documentedBe = documentedStack
    .filter((technology) => technology.category === 'backend')
    .map((technology) => technology.name)
    .filter(Boolean)
    .join(' + ');

  const documentedDb = documentedStack
    .filter((technology) => technology.category === 'database')
    .map((technology) => technology.name)
    .filter(Boolean)
    .join(' + ');

  const currentArch =
    architectureData ||
    (project?.architectures?.length > 0
      ? project.architectures[0]
      : null);

  const effectiveStyle =
    currentArch?.style ||
    'Columnas de Responsabilidad (Estilo Kanban / 4 Columnas)';

  const effectiveFrontend =
    currentArch?.frontend || documentedFe || 'React';

  const effectiveBackend =
    currentArch?.backend || documentedBe || 'Node.js + Express';

  const effectiveDatabase =
    currentArch?.database || documentedDb || 'PostgreSQL';

  // Abrir formulario de edición.
  const handleOpenEdit = () => {
    setEditForm({
      style: effectiveStyle,
      frontend: effectiveFrontend,
      backend: effectiveBackend,
      database: effectiveDatabase
    });

    setIsEditModalOpen(true);
  };

  // Guardar tecnologías y regenerar el diagrama.
  const handleSaveArch = async () => {
    if (!projectId || isSavingArch) return;

    try {
      setIsSavingArch(true);
      setArchError('');

      const response = await fetch(
        `/api/projects/${projectId}/architecture`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(editForm)
        }
      );

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.message || 'No se pudo guardar la arquitectura.'
        );
      }

      if (json.data) {
        setArchitectureData(json.data);
      }

      setIsEditModalOpen(false);

      if (onProjectUpdated) {
        await onProjectUpdated();
      }

      // Regenerar usando la configuración recién guardada.
      await handleGenerateArch(true);
    } catch (error) {
      console.error('Error guardando arquitectura:', error);

      setArchError(
        `Error al guardar la arquitectura: ${
          error?.message || 'Error desconocido'
        }`
      );
    } finally {
      setIsSavingArch(false);
    }
  };

  // Diagrama lógico de arquitectura de software.
  const softwareArchCode = useMemo(() => {
    if (currentArch?.softwareDiagram) {
      return currentArch.softwareDiagram;
    }

    const fe = effectiveFrontend || 'React';
    const be = effectiveBackend || 'Node.js + Express';
    const db = effectiveDatabase || 'PostgreSQL';

    return `flowchart LR
  subgraph COL1["USUARIOS Y DISPOSITIVOS"]
    direction TB
    U_REC["Recepción (PC / Laptop)"]
    U_MEC["Mecánico (Tablet / Móvil)"]
    U_CLI["Cliente (Smartphone)"]
    U_ADM["Administrador (PC)"]
  end

  subgraph COL2["INTERFAZ DE USUARIO"]
    direction TB
    UI_APP["Aplicación Web (${fe})"]
    UI_ROUTER["Router y Vistas SPA"]
    UI_APP --> UI_ROUTER
  end

  subgraph COL3["MÓDULOS API - ${be}"]
    direction TB
    API_AUTH["Autenticación y Roles"]
    API_VEH["Vehículos y Clientes"]
    API_CITAS["Atención y Citas"]
    API_DIAG["Diagnóstico OBD"]
    API_COT["Cotizaciones y Presupuestos"]
    API_ORD["Órdenes de Trabajo"]
    API_INV["Inventario y Repuestos"]
    API_MANT["Mantenimiento Preventivo"]
    API_REP["Reportes y Control"]
  end

  subgraph COL4["PERSISTENCIA Y RESPALDOS"]
    direction TB
    DB_STORE[("${db} - Base de Datos")]
    OBJ_STORE[("Almacén de Evidencias")]
    SVC_BACKUP["Servicio de Respaldos (RNF-08)"]
    DB_STORE -.->|Respaldos programados| SVC_BACKUP
    OBJ_STORE -.->|Copias de seguridad| SVC_BACKUP
  end

  U_REC --> UI_APP
  U_MEC --> UI_APP
  U_CLI --> UI_APP
  U_ADM --> UI_APP

  UI_ROUTER --> API_AUTH
  UI_ROUTER --> API_VEH
  UI_ROUTER --> API_CITAS
  UI_ROUTER --> API_DIAG
  UI_ROUTER --> API_COT
  UI_ROUTER --> API_ORD
  UI_ROUTER --> API_INV
  UI_ROUTER --> API_MANT
  UI_ROUTER --> API_REP

  API_AUTH --> DB_STORE
  API_VEH --> DB_STORE
  API_CITAS --> DB_STORE
  API_DIAG --> DB_STORE
  API_DIAG --> OBJ_STORE
  API_COT --> DB_STORE
  API_ORD --> DB_STORE
  API_INV --> DB_STORE
  API_MANT --> DB_STORE
  API_REP --> DB_STORE`;
  }, [
    currentArch,
    effectiveFrontend,
    effectiveBackend,
    effectiveDatabase
  ]);

  // Diagrama de infraestructura y despliegue del sistema.
  const systemArchCode = useMemo(() => {
    if (currentArch?.deploymentDiagram) {
      return currentArch.deploymentDiagram;
    }

    const fe = effectiveFrontend || 'Frontend';
    const be = effectiveBackend || 'Servidor Backend API';
    const db = effectiveDatabase || 'Base de Datos';

    return `flowchart TB
  CLIENT["Dispositivo del Usuario (Navegador Web / Móvil)"]

  subgraph SERVER["Infraestructura del Sistema"]
    PROXY["Proxy Inverso HTTPS (Nginx / SSL)"]
    WEB_SRV["Contenedor Web (${fe})"]
    APP_SRV["Contenedor Backend (${be})"]
    DB_SRV[("Contenedor Base de Datos (${db})")]
    BACKUP_DAEMON["Servicio Automatizado de Respaldos (Cron)"]
    BACKUP_VOL[("Volumen de Respaldos Seguros")]
  end

  CLIENT -->|Acceso HTTPS| PROXY
  PROXY -->|Servir interfaz web| WEB_SRV
  PROXY -->|Rutas API REST| APP_SRV
  APP_SRV -->|Consultas SQL| DB_SRV
  BACKUP_DAEMON -->|Generar volcados| DB_SRV
  BACKUP_DAEMON -->|Guardar copias| BACKUP_VOL`;
  }, [
    currentArch,
    effectiveFrontend,
    effectiveBackend,
    effectiveDatabase
  ]);

  // El código generado se utiliza primero; si no existe, se muestra
  // el diagrama construido a partir de la configuración actual.
  const effectiveSoftwareArchCode =
    storedArchDiagram || softwareArchCode;

  const effectiveSystemArchCode =
    storedSystemDiagram || systemArchCode;

  const activeDiagramCode =
    archType === 'software'
      ? effectiveSoftwareArchCode
      : effectiveSystemArchCode;

  const specItems = [
    {
      label: 'Estilo de Arquitectura',
      value: effectiveStyle,
      icon: 'layers'
    },
    {
      label: 'Frontend',
      value: effectiveFrontend,
      icon: 'web'
    },
    {
      label: 'Backend',
      value: effectiveBackend,
      icon: 'dns'
    },
    {
      label: 'Base de Datos',
      value: effectiveDatabase,
      icon: 'storage'
    }
  ];

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeDiagramCode);
    } catch (error) {
      console.error('No se pudo copiar el código:', error);
      setArchError('No se pudo copiar el código Mermaid.');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {archError && (
        <div
          role="alert"
          className="alert alert-danger"
          style={{ margin: '12px 24px 0' }}
        >
          {archError}

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setArchError('')}
            style={{ marginLeft: '12px' }}
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Encabezado */}
      <div
        className="full-page-header"
        style={{
          borderBottom: '1px solid var(--outline-variant)',
          background: 'var(--surface)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div>
            <h2
              className="page-title"
              style={{
                fontSize: '1.125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span
                className="ms ms-sm"
                style={{ color: 'var(--primary)' }}
              >
                layers
              </span>

              Diseño de la Arquitectura de la Aplicación
            </h2>

            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--secondary)'
              }}
            >
              Arquitectura de software e infraestructura física del sistema.
            </span>
          </div>
        </div>

        <div
          className="page-actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleOpenEdit}
            disabled={generatingArch || isSavingArch}
            title="Modificar tecnologías y estilo arquitectónico"
          >
            <span className="ms ms-xs">edit</span>
            <span>Modificar Arquitectura</span>
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => handleGenerateArch(true)}
            disabled={generatingArch || isSavingArch}
            title="Generar o regenerar el diagrama"
          >
            <span
              className={`ms ms-xs ${generatingArch ? 'spin' : ''}`}
            >
              {generatingArch ? 'autorenew' : 'auto_awesome'}
            </span>

            <span>
              {generatingArch
                ? 'Generando...'
                : storedArchDiagram
                  ? 'Regenerar Arquitectura'
                  : 'Generar arquitectura'}
            </span>
          </button>

          <div className="view-toggle">
            <button
              type="button"
              className={`view-toggle-btn ${
                archType === 'software' ? 'active' : ''
              }`}
              onClick={() => setArchType('software')}
            >
              <span className="ms ms-xs">account_tree</span>
              <span>Arquitectura de Software</span>
            </button>

            <button
              type="button"
              className={`view-toggle-btn ${
                archType === 'system' ? 'active' : ''
              }`}
              onClick={() => setArchType('system')}
            >
              <span className="ms ms-xs">dns</span>
              <span>Arquitectura del Sistema</span>
            </button>
          </div>

          <div className="view-toggle">
            <button
              type="button"
              className={`view-toggle-btn ${!showCode ? 'active' : ''}`}
              onClick={() => setShowCode(false)}
            >
              <span className="ms ms-xs">visibility</span>
              <span>Diagrama</span>
            </button>

            <button
              type="button"
              className={`view-toggle-btn ${showCode ? 'active' : ''}`}
              onClick={() => setShowCode(true)}
            >
              <span className="ms ms-xs">code</span>
              <span>Código</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div
        className="page-scrollable"
        style={{
          padding: '24px',
          flex: 1,
          overflowY: 'auto'
        }}
      >
        {/* Tarjetas de configuración */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
            marginBottom: '20px'
          }}
        >
          {specItems.map((item) => (
            <div
              key={item.label}
              className="info-card"
              role="button"
              tabIndex={0}
              onClick={handleOpenEdit}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleOpenEdit();
                }
              }}
              style={{
                background: 'var(--surface-container-lowest)',
                border: '1px solid var(--outline-variant)',
                boxShadow: 'var(--shadow-xs)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
                padding: '14px 16px'
              }}
              title="Modificar esta propiedad de la arquitectura"
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span
                    className="ms ms-xs"
                    style={{ color: 'var(--primary)' }}
                  >
                    {item.icon}
                  </span>

                  <span
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--secondary)',
                      textTransform: 'uppercase',
                      fontWeight: 600
                    }}
                  >
                    {item.label}
                  </span>
                </div>

                <span
                  className="ms ms-xs"
                  style={{ color: 'var(--primary)', opacity: 0.6 }}
                >
                  edit
                </span>
              </div>

              <span
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: 'var(--on-surface)'
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Descripción del diagrama activo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            background: 'var(--surface-container-low)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-default)',
            marginBottom: '16px',
            fontSize: '0.8125rem'
          }}
        >
          <span
            className="ms ms-sm"
            style={{ color: 'var(--primary)' }}
          >
            layers
          </span>

          <span style={{ color: 'var(--on-surface)' }}>
            <strong>
              {archType === 'software'
                ? 'Arquitectura de Software:'
                : 'Arquitectura del Sistema:'}
            </strong>{' '}

            {archType === 'software'
              ? 'Organización lógica de los componentes, módulos y datos.'
              : 'Infraestructura, contenedores y comunicación entre servicios.'}
          </span>
        </div>

        {/* Diagrama o código */}
        {showCode ? (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}
            >
              <span className="detail-section-label">
                Código Mermaid (
                {archType === 'software' ? 'Software' : 'Sistema'})
              </span>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCopyCode}
              >
                <span className="ms ms-sm">content_copy</span>
                <span>Copiar</span>
              </button>
            </div>

            <textarea
              className="diagram-raw-editor"
              rows={16}
              readOnly
              value={activeDiagramCode}
              style={{
                width: '100%',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'pre',
                resize: 'vertical'
              }}
            />
          </div>
        ) : (
          <DiagramViewport
            key={`${projectId}-${archType}-${diagramVersion}`}
            code={activeDiagramCode}
            type="flowchart"
            title={
              archType === 'software'
                ? 'Arquitectura de Software'
                : 'Arquitectura del Sistema (Despliegue Docker)'
            }
            initialZoom={0.4}
            minHeight="520px"
            isOutdated={archType === 'software' ? isOutdated : false}
            onRegenerate={handleGenerateArch}
            canGenerate={true}
            isGenerating={generatingArch}
          />
        )}
      </div>

      {/* Modal para editar arquitectura */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          if (!isSavingArch && !generatingArch) {
            setIsEditModalOpen(false);
          }
        }}
        title="Modificar Arquitectura del Sistema"
        footer={
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
              width: '100%'
            }}
          >
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSavingArch || generatingArch}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSaveArch}
              disabled={isSavingArch || generatingArch}
            >
              {isSavingArch ? (
                <>
                  <span className="ms ms-xs spin">progress_activity</span>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <span className="ms ms-xs">save</span>
                  <span>Guardar cambios</span>
                </>
              )}
            </button>
          </div>
        }
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--secondary)',
              margin: 0
            }}
          >
            Configura el estilo arquitectónico y las tecnologías principales.
            Al guardar, se solicitará la regeneración del diagrama.
          </p>

          {/* Estilo arquitectónico */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8125rem',
                fontWeight: 600,
                marginBottom: '6px'
              }}
            >
              Estilo de Arquitectura
            </label>

            <input
              type="text"
              className="form-control"
              value={editForm.style}
              onChange={(event) =>
                setEditForm((prev) => ({
                  ...prev,
                  style: event.target.value
                }))
              }
              placeholder="Ej. Arquitectura en 3 Capas"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-default)',
                fontSize: '0.875rem'
              }}
            />

            <div
              style={{
                display: 'flex',
                gap: '6px',
                marginTop: '6px',
                flexWrap: 'wrap'
              }}
            >
              {[
                'Columnas de Responsabilidad (Estilo Kanban)',
                '3 Capas (Cliente-Servidor)',
                'Arquitectura Limpia / Hexagonal',
                'Microservicios',
                'Modular Monolith'
              ].map((style) => (
                <button
                  key={style}
                  type="button"
                  className="btn btn-xs btn-outline"
                  style={{ fontSize: '0.6875rem', padding: '2px 8px' }}
                  onClick={() =>
                    setEditForm((prev) => ({ ...prev, style }))
                  }
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Frontend */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8125rem',
                fontWeight: 600,
                marginBottom: '6px'
              }}
            >
              Tecnología Frontend
            </label>

            <input
              type="text"
              className="form-control"
              value={editForm.frontend}
              onChange={(event) =>
                setEditForm((prev) => ({
                  ...prev,
                  frontend: event.target.value
                }))
              }
              placeholder="Ej. React, Vue.js, Angular, Next.js"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-default)',
                fontSize: '0.875rem'
              }}
            />

            <div
              style={{
                display: 'flex',
                gap: '6px',
                marginTop: '6px',
                flexWrap: 'wrap'
              }}
            >
              {[
                'React',
                'Next.js',
                'Vue.js',
                'Angular',
                'React Native (Móvil)'
              ].map((frontend) => (
                <button
                  key={frontend}
                  type="button"
                  className="btn btn-xs btn-outline"
                  style={{ fontSize: '0.6875rem', padding: '2px 8px' }}
                  onClick={() =>
                    setEditForm((prev) => ({ ...prev, frontend }))
                  }
                >
                  {frontend}
                </button>
              ))}
            </div>
          </div>

          {/* Backend */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8125rem',
                fontWeight: 600,
                marginBottom: '6px'
              }}
            >
              Tecnología Backend
            </label>

            <input
              type="text"
              className="form-control"
              value={editForm.backend}
              onChange={(event) =>
                setEditForm((prev) => ({
                  ...prev,
                  backend: event.target.value
                }))
              }
              placeholder="Ej. Node.js + Express, NestJS, FastAPI"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-default)',
                fontSize: '0.875rem'
              }}
            />

            <div
              style={{
                display: 'flex',
                gap: '6px',
                marginTop: '6px',
                flexWrap: 'wrap'
              }}
            >
              {[
                'Node.js + Express',
                'NestJS (Node.js)',
                'FastAPI (Python)',
                'Spring Boot (Java)',
                '.NET Core'
              ].map((backend) => (
                <button
                  key={backend}
                  type="button"
                  className="btn btn-xs btn-outline"
                  style={{ fontSize: '0.6875rem', padding: '2px 8px' }}
                  onClick={() =>
                    setEditForm((prev) => ({ ...prev, backend }))
                  }
                >
                  {backend}
                </button>
              ))}
            </div>
          </div>

          {/* Base de datos */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8125rem',
                fontWeight: 600,
                marginBottom: '6px'
              }}
            >
              Motor de Base de Datos
            </label>

            <input
              type="text"
              className="form-control"
              value={editForm.database}
              onChange={(event) =>
                setEditForm((prev) => ({
                  ...prev,
                  database: event.target.value
                }))
              }
              placeholder="Ej. PostgreSQL, MySQL, MongoDB"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-default)',
                fontSize: '0.875rem'
              }}
            />

            <div
              style={{
                display: 'flex',
                gap: '6px',
                marginTop: '6px',
                flexWrap: 'wrap'
              }}
            >
              {[
                'PostgreSQL',
                'MySQL',
                'MongoDB',
                'SQL Server',
                'SQLite'
              ].map((database) => (
                <button
                  key={database}
                  type="button"
                  className="btn btn-xs btn-outline"
                  style={{ fontSize: '0.6875rem', padding: '2px 8px' }}
                  onClick={() =>
                    setEditForm((prev) => ({ ...prev, database }))
                  }
                >
                  {database}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}