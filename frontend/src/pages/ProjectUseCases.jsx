import React, { useState, useMemo } from 'react';
import MermaidDiagram from '../components/diagrams/MermaidDiagram';
import Modal from '../components/common/Modal';

// 4 Procesos Fundamentales estándar adaptables al proyecto
const DEFAULT_PROCESSES = [
  {
    id: 'PROC-01',
    name: 'Gestión de Acceso, Identidad y Seguridad',
    description: 'Control de autenticación, roles (Administrador, Operador, Cliente), permisos y sesiones de usuario.',
    useCase: {
      code: 'CU-01',
      name: 'Autenticar Usuario en el Sistema',
      actor: 'Usuario del Sistema / Administrador',
      preconditions: 'El usuario debe estar previamente registrado con credenciales válidas y rol asignado.',
      mainFlow: [
        'El usuario ingresa su identificador (correo o usuario) y contraseña.',
        'El sistema valida el formato de las credenciales.',
        'El sistema consulta la base de datos y verifica el hash de la contraseña.',
        'El sistema genera el token de sesión (JWT) y carga los permisos del rol.',
        'El sistema redirige al usuario a su panel de control correspondiente.'
      ],
      altFlows: [
        'Si las credenciales son incorrectas, el sistema muestra mensaje de error y no concede acceso.',
        'Si la cuenta está bloqueada o inactiva, se notifica que debe contactar al administrador.'
      ],
      postconditions: 'El usuario obtiene una sesión activa y auditoría de ingreso registrada.',
      includes: ['CU-01.1: Validar Credenciales'],
      extends: ['CU-01.2: Recuperar Contraseña']
    }
  },
  {
    id: 'PROC-02',
    name: 'Registro y Administración de Entidades Principales',
    description: 'Gestión del catálogo maestro, clientes, activos o recursos medulares del sistema.',
    useCase: {
      code: 'CU-02',
      name: 'Registrar y Administrar Información Maestro',
      actor: 'Operador / Administrador',
      preconditions: 'El usuario debe contar con permisos de escritura y el catálogo base cargado.',
      mainFlow: [
        'El operador selecciona la opción de registrar nueva entidad en el sistema.',
        'El sistema despliega el formulario con los campos obligatorios y reglas de negocio.',
        'El operador ingresa la información requerida y solicita guardar.',
        'El sistema valida unicidad de identificadores (cédula, código, placa o SKU).',
        'El sistema almacena el registro en PostgreSQL y confirma la transacción.'
      ],
      altFlows: [
        'Si existe duplicidad de identificador, el sistema alerta del conflicto y no guarda.',
        'Si faltan campos obligatorios, el sistema resalta los campos inválidos.'
      ],
      postconditions: 'La nueva entidad queda disponible en el catálogo con estado activo.',
      includes: ['CU-02.1: Verificar Unicidad'],
      extends: ['CU-02.2: Cargar Evidencias / Documentos']
    }
  },
  {
    id: 'PROC-03',
    name: 'Operación y Transacción Central del Negocio',
    description: 'Ejecución del flujo medular del negocio (órdenes, servicios, reservas, préstamos o diagnósticos).',
    useCase: {
      code: 'CU-03',
      name: 'Procesar Transacción / Servicio Principal',
      actor: 'Operador / Técnico / Cliente',
      preconditions: 'Entidad principal registrada, recursos disponibles y parámetros de servicio definidos.',
      mainFlow: [
        'El usuario inicia una nueva transacción u orden de trabajo.',
        'El sistema asocia el cliente/recurso y presenta las opciones de servicio.',
        'El usuario selecciona los ítems, servicios o diagnósticos a realizar.',
        'El sistema calcula importes, dependencias de tiempo o asignación de recursos.',
        'El usuario confirma la operación y el sistema emite el comprobante y cambia el estado a En Proceso.'
      ],
      altFlows: [
        'Si los recursos o disponibilidad no son suficientes, el sistema sugiere fecha o recurso alternativo.',
        'Si el cliente cancela la operación antes de confirmar, no se guarda ningún cambio.'
      ],
      postconditions: 'Orden o servicio registrado, recursos bloqueados/asignados y notificación generada.',
      includes: ['CU-03.1: Verificar Disponibilidad', 'CU-03.2: Generar Comprobante'],
      extends: ['CU-03.3: Aplicar Descuento o Promoción']
    }
  },
  {
    id: 'PROC-04',
    name: 'Monitoreo, Reportes y Auditoría de Gestión',
    description: 'Generación de métricas de rendimiento, reportes consolidados y trazabilidad de eventos.',
    useCase: {
      code: 'CU-04',
      name: 'Generar Reporte y Consulta de Rendimiento',
      actor: 'Administrador / Supervisor',
      preconditions: 'Existencia de transacciones registradas en el período consultado.',
      mainFlow: [
        'El supervisor accede al módulo de reportes y analítica.',
        'Selecciona los filtros de búsqueda (rango de fechas, estado, responsable, tipo).',
        'El sistema procesa la consulta y genera indicadores cuantitativos y tablas de detalle.',
        'El sistema renderiza los gráficos de rendimiento y permite exportación en PDF o Excel.'
      ],
      altFlows: [
        'Si no existen registros en el rango seleccionado, el sistema muestra estado vacío.',
        'Si el usuario no tiene permisos de supervisor, la sección no se muestra.'
      ],
      postconditions: 'Reporte generado y registro en bitácora de auditoría del sistema.',
      includes: ['CU-04.1: Filtrar Datos'],
      extends: ['CU-04.2: Exportar a PDF / Excel']
    }
  }
];

export default function ProjectUseCases({ project }) {
  const [selectedProcess, setSelectedProcess] = useState(DEFAULT_PROCESSES[0]);
  const [editingProcess, setEditingProcess] = useState(null);

  // Generate Mermaid Use Case Diagram
  const umlDiagramCode = useMemo(() => {
    let code = `graph LR\n`;
    code += `  %% Estilos para Diagrama UML de Casos de Uso\n`;
    code += `  classDef actor fill:#dbeafe,stroke:#1d4ed8,stroke-width:2px,color:#1e3a8a,font-weight:bold;\n`;
    code += `  classDef uc fill:#ffffff,stroke:#0284c7,stroke-width:2px,color:#0f172a,rx:20,ry:20;\n`;
    code += `  classDef inc fill:#f8fafc,stroke:#94a3b8,stroke-width:1px,stroke-dasharray: 4 4,color:#475569;\n\n`;

    // Actors
    code += `  Admin(("👤 Administrador")):::actor\n`;
    code += `  Operator(("👤 Operador / Técnico")):::actor\n`;
    code += `  Client(("👤 Cliente")):::actor\n\n`;

    // Use cases
    DEFAULT_PROCESSES.forEach(p => {
      const uc = p.useCase;
      const cleanCode = uc.code.replace('-', '');
      code += `  ${cleanCode}(["<b>${uc.code}</b><br/>${uc.name}"]):::uc\n`;

      if (p.id === 'PROC-01') {
        code += `  Admin --- ${cleanCode}\n`;
        code += `  Client --- ${cleanCode}\n`;
      } else if (p.id === 'PROC-02') {
        code += `  Operator --- ${cleanCode}\n`;
        code += `  Admin --- ${cleanCode}\n`;
      } else if (p.id === 'PROC-03') {
        code += `  Operator --- ${cleanCode}\n`;
        code += `  Client --- ${cleanCode}\n`;
      } else if (p.id === 'PROC-04') {
        code += `  Admin --- ${cleanCode}\n`;
      }

      // Includes & Extends
      uc.includes?.forEach((inc, idx) => {
        const incId = `${cleanCode}_inc${idx}`;
        code += `  ${incId}(["${inc}"]):::inc\n`;
        code += `  ${cleanCode} -.->|&laquo;include&raquo;| ${incId}\n`;
      });

      uc.extends?.forEach((ext, idx) => {
        const extId = `${cleanCode}_ext${idx}`;
        code += `  ${extId}(["${ext}"]):::inc\n`;
        code += `  ${extId} -.->|&laquo;extend&raquo;| ${cleanCode}\n`;
      });
    });

    return code;
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="full-page-header" style={{ borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface)' }}>
        <div>
          <h2 className="page-title" style={{ fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="ms ms-sm" style={{ color: 'var(--primary)' }}>account_tree</span>
            2.2 Cuatro (4) Procesos Fundamentales y Casos de Uso
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>
            Diagrama UML de Casos de Uso con relaciones &laquo;include&raquo; / &laquo;extend&raquo; y fichas de especificación formal
          </span>
        </div>
      </div>

      {/* Main split content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: 4 processes selector */}
        <div style={{ width: '320px', borderRight: '1px solid var(--outline-variant)', background: 'var(--surface-container-lowest)', overflowY: 'auto', padding: '16px' }}>
          <h3 style={{ fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--secondary)', marginBottom: '12px', fontWeight: 600 }}>
            Procesos Fundamentales
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {DEFAULT_PROCESSES.map((proc, index) => {
              const isSelected = selectedProcess.id === proc.id;
              return (
                <div
                  key={proc.id}
                  onClick={() => setSelectedProcess(proc)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--outline-variant)',
                    background: isSelected ? 'var(--surface-container-low)' : 'var(--surface)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span className="code-tag code-tag-primary" style={{ fontSize: '0.6875rem' }}>{proc.id}</span>
                    <span className="tag" style={{ fontSize: '0.6875rem' }}>Proceso {index + 1}/4</span>
                  </div>
                  <strong style={{ fontSize: '0.875rem', color: 'var(--on-surface)', display: 'block', lineHeight: 1.3 }}>
                    {proc.name}
                  </strong>
                  <p style={{ fontSize: '0.75rem', color: 'var(--secondary)', margin: '6px 0 0', lineHeight: 1.4 }}>
                    {proc.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="alert alert-info" style={{ marginTop: '20px', fontSize: '0.75rem' }}>
            <span className="ms ms-xs">verified</span>
            <div>
              Cumple con el requisito de <strong>4 procesos fundamentales</strong> con casos de uso estructurados.
            </div>
          </div>
        </div>

        {/* Right: Detailed Specification & Diagram */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {/* UML Diagram View */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--on-surface)', marginBottom: '6px' }}>
              Diagrama UML de Casos de Uso (Visión General de los 4 Procesos)
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', marginBottom: '14px' }}>
              Relaciones entre Actores del sistema y los Casos de Uso con dependencias &laquo;include&raquo; y extensiones &laquo;extend&raquo;.
            </p>
            <div style={{ background: 'var(--surface-container-lowest)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline-variant)', boxShadow: 'var(--shadow-xs)', overflowX: 'auto' }}>
              <MermaidDiagram code={umlDiagramCode} />
            </div>
          </div>

          {/* Selected Process Use Case Specification Card */}
          <div style={{ background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius-md)', border: '1px solid var(--outline-variant)', boxShadow: 'var(--shadow-xs)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--outline-variant)', paddingBottom: '14px', marginBottom: '16px' }}>
              <div>
                <span className="code-tag code-tag-primary" style={{ fontSize: '0.75rem', marginRight: '8px' }}>
                  {selectedProcess.useCase.code}
                </span>
                <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--on-surface)' }}>
                  {selectedProcess.useCase.name}
                </span>
                <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', margin: '4px 0 0' }}>
                  Pertenece a: <strong>{selectedProcess.name}</strong> ({selectedProcess.id})
                </p>
              </div>
              <span className="badge badge-success">Especificación Completa</span>
            </div>

            {/* Spec grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div className="info-card">
                <span style={{ fontSize: '0.6875rem', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Actor(es) Principal(es)</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)', marginTop: '4px', display: 'block' }}>
                  {selectedProcess.useCase.actor}
                </span>
              </div>
              <div className="info-card">
                <span style={{ fontSize: '0.6875rem', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Precondiciones</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--on-surface)', marginTop: '4px', display: 'block' }}>
                  {selectedProcess.useCase.preconditions}
                </span>
              </div>
            </div>

            {/* Main Flow */}
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)', marginBottom: '8px' }}>
                Flujo Principal de Eventos (Paso a Paso)
              </h4>
              <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.8 }}>
                {selectedProcess.useCase.mainFlow.map((step, idx) => (
                  <li key={idx}><strong>Paso {idx + 1}:</strong> {step}</li>
                ))}
              </ol>
            </div>

            {/* Alternative Flows */}
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface)', marginBottom: '8px' }}>
                Flujos Alternativos / Excepciones
              </h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8125rem', color: '#b91c1c', lineHeight: 1.6 }}>
                {selectedProcess.useCase.altFlows.map((alt, idx) => (
                  <li key={idx}>{alt}</li>
                ))}
              </ul>
            </div>

            {/* Postconditions & Relations */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="info-card">
                <span style={{ fontSize: '0.6875rem', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Postcondiciones</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--on-surface)', marginTop: '4px', display: 'block' }}>
                  {selectedProcess.useCase.postconditions}
                </span>
              </div>
              <div className="info-card">
                <span style={{ fontSize: '0.6875rem', color: 'var(--outline)', textTransform: 'uppercase', fontWeight: 600 }}>Relaciones UML</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {selectedProcess.useCase.includes?.map((inc, i) => (
                    <span key={i} className="tag" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                      &laquo;include&raquo; {inc}
                    </span>
                  ))}
                  {selectedProcess.useCase.extends?.map((ext, i) => (
                    <span key={i} className="tag" style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                      &laquo;extend&raquo; {ext}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
