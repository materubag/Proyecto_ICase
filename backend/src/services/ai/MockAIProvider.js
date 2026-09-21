const AIProvider = require('./AIProvider');

class MockAIProvider extends AIProvider {
  /**
   * Main entrypoint for MockAIProvider.
   * Generates structured data without external calls.
   * @param {Object} input - { projectId, name, description, context }
   */
  async analyzeProject(input) {
    const projectName = input.name || (input.context && input.context.name) || 'Sistema de Información';
    const desc = (input.description || (input.context && input.context.description) || '').trim();
    const lower = desc.toLowerCase();

    const isLibrary = lower.includes('biblioteca') || lower.includes('libro') || lower.includes('prestamo') || lower.includes('préstamo');
    const isHospital = lower.includes('hospital') || lower.includes('médic') || lower.includes('medic') || lower.includes('paciente') || lower.includes('salud') || lower.includes('cita');
    const isEcommerce = lower.includes('tienda') || lower.includes('producto') || lower.includes('venta') || lower.includes('carrito') || lower.includes('comercio');
    const isAutomotive = lower.includes('autron') || lower.includes('taller') || lower.includes('vehiculo') || lower.includes('vehículo') || lower.includes('mecanic') || lower.includes('mecánico') || lower.includes('automotriz') || lower.includes('avería') || (input.context && input.context.isDocumentAnalysis);

    let actors = [];
    let requirements = [];
    let entities = [];
    let relationships = [];
    let screens = [];
    let navigation = [];
    let architecture = {};

    if (isAutomotive) {
      actors = (input.context && input.context.detectedActors && input.context.detectedActors.length > 0)
        ? input.context.detectedActors
        : [
            { id: 'ACT-01', name: 'Cliente', description: 'Gestiona citas, revisa cotizaciones y consulta el avance de reparación.' },
            { id: 'ACT-02', name: 'Recepción', description: 'Registra ingresos, coordina la agenda y mantiene datos operativos.' },
            { id: 'ACT-03', name: 'Mecánico', description: 'Documenta diagnósticos, actividades, pruebas y repuestos utilizados.' },
            { id: 'ACT-04', name: 'Administrador', description: 'Configura usuarios, permisos, catálogos, inventario e indicadores.' }
          ];

      const availableActorIds = actors.map(a => a.id);
      const defaultActorId = availableActorIds[0] || 'ACT-01';

      if (input.context && input.context.detectedRequirements && input.context.detectedRequirements.length > 0) {
        requirements = input.context.detectedRequirements.map((r, idx) => ({
          code: r.code || `RF-${String(idx + 1).padStart(2, '0')}`,
          name: r.name,
          description: r.description || r.name,
          type: r.type || 'FUNCTIONAL',
          priority: r.priority || 'HIGH',
          actorIds: [defaultActorId],
          dependencies: r.dependencies || [],
          source: r.source || 'mock'
        }));
      } else {
        const safeActorIds = (ids) => {
          const filtered = ids.filter(id => availableActorIds.includes(id));
          return filtered.length > 0 ? filtered : [defaultActorId];
        };

        requirements = [
          { code: 'RF-01', name: 'Autenticación y Perfiles', description: 'Registrar usuarios, autenticar su identidad y recuperar el acceso.', type: 'FUNCTIONAL', priority: 'HIGH', actorIds: safeActorIds(['ACT-01', 'ACT-04']), dependencies: [] },
          { code: 'RF-02', name: 'Expediente Digital', description: 'Mantener un expediente digital por vehículo con historial de reparaciones.', type: 'FUNCTIONAL', priority: 'HIGH', actorIds: safeActorIds(['ACT-01', 'ACT-02', 'ACT-03']), dependencies: ['RF-01'] },
          { code: 'RF-03', name: 'Agenda de Citas', description: 'Permitir al cliente solicitar, consultar, reprogramar o cancelar citas.', type: 'FUNCTIONAL', priority: 'HIGH', actorIds: safeActorIds(['ACT-01', 'ACT-02']), dependencies: ['RF-02'] },
          { code: 'RF-04', name: 'Diagnóstico Visual', description: 'Representar visualmente las zonas del vehículo con fallas y códigos OBD.', type: 'FUNCTIONAL', priority: 'HIGH', actorIds: safeActorIds(['ACT-03']), dependencies: ['RF-02'] },
          { code: 'RF-05', name: 'Cotizaciones y Aprobaciones', description: 'Generar cotizaciones con repuestos y mano de obra para autorización digital.', type: 'FUNCTIONAL', priority: 'HIGH', actorIds: safeActorIds(['ACT-01', 'ACT-02']), dependencies: ['RF-04'] },
          { code: 'RF-06', name: 'Órdenes de Trabajo', description: 'Generar órdenes de trabajo a partir de ítems autorizados y registrar avance.', type: 'FUNCTIONAL', priority: 'HIGH', actorIds: safeActorIds(['ACT-03']), dependencies: ['RF-05'] },
          { code: 'RF-07', name: 'Control de Inventario', description: 'Descontar repuestos utilizados y generar alertas automáticas de bajo stock.', type: 'FUNCTIONAL', priority: 'HIGH', actorIds: safeActorIds(['ACT-03', 'ACT-04']), dependencies: ['RF-06'] },
          { code: 'RNF-01', name: 'Interfaz Web Responsiva', description: 'Funcionar en navegadores modernos y adaptarse a dispositivos móviles.', type: 'NON_FUNCTIONAL', priority: 'MEDIUM', actorIds: safeActorIds(['ACT-01']), dependencies: [] },
          { code: 'RNF-02', name: 'Integridad y Trazabilidad', description: 'Preservar la integridad entre órdenes, cotizaciones, inventario y vehículos.', type: 'NON_FUNCTIONAL', priority: 'HIGH', actorIds: safeActorIds(['ACT-01']), dependencies: [] }
        ];
      }

      entities = [
        {
          id: 'ENT-01',
          name: 'Cliente',
          description: 'Propietario responsable de uno o varios vehículos.',
          attributes: [
            { name: 'id', type: 'String' },
            { name: 'nombreCompleto', type: 'String' },
            { name: 'email', type: 'String' },
            { name: 'telefono', type: 'String' },
            { name: 'cedulaRuc', type: 'String' }
          ]
        },
        {
          id: 'ENT-02',
          name: 'Vehiculo',
          description: 'Expediente digital del vehículo atendido en el taller.',
          attributes: [
            { name: 'id', type: 'String' },
            { name: 'placa', type: 'String' },
            { name: 'marca', type: 'String' },
            { name: 'modelo', type: 'String' },
            { name: 'anio', type: 'Integer' },
            { name: 'kilometraje', type: 'Integer' },
            { name: 'clienteId', type: 'String' }
          ]
        },
        {
          id: 'ENT-03',
          name: 'Cita',
          description: 'Reserva de turno para recepción o mantenimiento.',
          attributes: [
            { name: 'id', type: 'String' },
            { name: 'fechaHora', type: 'DateTime' },
            { name: 'motivo', type: 'String' },
            { name: 'estado', type: 'String' },
            { name: 'vehiculoId', type: 'String' }
          ]
        },
        {
          id: 'ENT-04',
          name: 'Diagnostico',
          description: 'Registro técnico de inspección con fallas y códigos OBD.',
          attributes: [
            { name: 'id', type: 'String' },
            { name: 'fecha', type: 'DateTime' },
            { name: 'kilometrajeIngreso', type: 'Integer' },
            { name: 'codigosObd', type: 'String' },
            { name: 'observaciones', type: 'String' },
            { name: 'vehiculoId', type: 'String' }
          ]
        },
        {
          id: 'ENT-05',
          name: 'Cotizacion',
          description: 'Presupuesto formal de mano de obra y repuestos.',
          attributes: [
            { name: 'id', type: 'String' },
            { name: 'subtotal', type: 'Float' },
            { name: 'impuestos', type: 'Float' },
            { name: 'total', type: 'Float' },
            { name: 'estado', type: 'String' },
            { name: 'diagnosticoId', type: 'String' }
          ]
        },
        {
          id: 'ENT-06',
          name: 'OrdenTrabajo',
          description: 'Ejecución operativa de trabajos autorizados por el cliente.',
          attributes: [
            { name: 'id', type: 'String' },
            { name: 'numeroOrden', type: 'String' },
            { name: 'estado', type: 'String' },
            { name: 'fechaInicio', type: 'DateTime' },
            { name: 'fechaFin', type: 'DateTime' },
            { name: 'vehiculoId', type: 'String' }
          ]
        },
        {
          id: 'ENT-07',
          name: 'Repuesto',
          description: 'Catálogo de piezas con inventario y precio.',
          attributes: [
            { name: 'id', type: 'String' },
            { name: 'codigo', type: 'String' },
            { name: 'nombre', type: 'String' },
            { name: 'stockActual', type: 'Integer' },
            { name: 'stockMinimo', type: 'Integer' },
            { name: 'precioUnitario', type: 'Float' }
          ]
        }
      ];

      relationships = [
        { id: 'REL-01', source: 'Cliente', target: 'Vehiculo', cardinality: '1:N', description: 'Un cliente puede registrar múltiples vehículos en el taller.' },
        { id: 'REL-02', source: 'Vehiculo', target: 'Cita', cardinality: '1:N', description: 'Un vehículo puede tener múltiples citas programadas.' },
        { id: 'REL-03', source: 'Vehiculo', target: 'Diagnostico', cardinality: '1:N', description: 'El expediente del vehículo acumula diagnósticos técnicos.' },
        { id: 'REL-04', source: 'Diagnostico', target: 'Cotizacion', cardinality: '1:1', description: 'Un diagnóstico genera una propuesta de cotización.' },
        { id: 'REL-05', source: 'Cotizacion', target: 'OrdenTrabajo', cardinality: '1:1', description: 'La cotización autorizada genera la orden de trabajo.' },
        { id: 'REL-06', source: 'OrdenTrabajo', target: 'Repuesto', cardinality: 'N:M', description: 'La orden consume repuestos del inventario del taller.' }
      ];

      screens = [
        {
          id: 'SCR-01',
          name: 'Portal de Clientes',
          route: '/portal-cliente',
          purpose: 'Consultar estado de reparación y agendar citas',
          description: 'Panel responsivo para el cliente del taller automotriz.',
          components: [
            { type: 'heading', label: 'Mi Vehículo y Reparaciones' },
            { type: 'card', label: 'Expediente Digital', placeholder: 'Chevrolet D-Max 2021 - Placa ABC-1234' },
            { type: 'card', label: 'Estado de Orden', placeholder: 'En Proceso - Reemplazo de frenos 65%' },
            { type: 'button', label: 'Solicitar Nueva Cita' }
          ]
        },
        {
          id: 'SCR-02',
          name: 'Recepción y Citas',
          route: '/recepcion',
          purpose: 'Control de ingresos y agenda del taller',
          description: 'Gestión operativa de ingreso de vehículos con kilometraje y combustible.',
          components: [
            { type: 'heading', label: 'Recepción de Vehículo' },
            { type: 'input', label: 'Placa del Vehículo', placeholder: 'Ej: PBX-7890' },
            { type: 'input', label: 'Kilometraje Actual', placeholder: 'Ej: 75200 km' },
            { type: 'input', label: 'Motivo de Ingreso', placeholder: 'Mantenimiento preventivo 75k...' },
            { type: 'button', label: 'Registrar Ingreso y Crear Expediente' }
          ]
        },
        {
          id: 'SCR-03',
          name: 'Diagnóstico y Averías',
          route: '/diagnosticos',
          purpose: 'Inspección técnica visual y códigos OBD',
          description: 'Mapa visual de fallas y registro de evidencias fotográficas.',
          components: [
            { type: 'heading', label: 'Inspección Técnica' },
            { type: 'card', label: 'Mapa Visual del Vehículo', placeholder: 'Zona motor: Alerta OBD P0300' },
            { type: 'input', label: 'Código OBD', placeholder: 'Ej: P0301 Fallo de encendido' },
            { type: 'button', label: 'Generar Cotización para Cliente' }
          ]
        },
        {
          id: 'SCR-04',
          name: 'Órdenes de Trabajo',
          route: '/ordenes',
          purpose: 'Seguimiento de reparaciones en taller',
          description: 'Asignación de mecánicos, repuestos utilizados y avance.',
          components: [
            { type: 'heading', label: 'Control de Reparaciones' },
            { type: 'card', label: 'Orden #OT-2026-042', placeholder: 'Mecánico: Juan Pérez | Estado: En Pruebas' },
            { type: 'button', label: 'Finalizar Trabajo y Entregar' }
          ]
        },
        {
          id: 'SCR-05',
          name: 'Inventario y Repuestos',
          route: '/inventario',
          purpose: 'Control de repuestos y alertas mínimas',
          description: 'Gestión de existencias y descuento automático de piezas.',
          components: [
            { type: 'heading', label: 'Inventario del Taller' },
            { type: 'card', label: 'Filtros de Aceite', placeholder: 'Stock: 14 unidades (Mín: 5)' },
            { type: 'card', label: 'Pastillas de Freno', placeholder: 'Stock Crítico: 2 unidades (Mín: 4)' },
            { type: 'button', label: 'Registrar Compra / Entrada' }
          ]
        }
      ];

      navigation = [
        { from: 'Portal de Clientes', to: 'Recepción y Citas', action: 'Solicitud de Turno' },
        { from: 'Recepción y Citas', to: 'Diagnóstico y Averías', action: 'Inspección del Vehículo' },
        { from: 'Diagnóstico y Averías', to: 'Órdenes de Trabajo', action: 'Aprobación de Cotización' },
        { from: 'Órdenes de Trabajo', to: 'Inventario y Repuestos', action: 'Consumo de Piezas' }
      ];

      architecture = {
        style: 'Arquitectura Web Modular de Tres Capas',
        frontend: 'React 18 + Vite SPA',
        backend: 'Node.js + Express REST API',
        database: 'PostgreSQL 16 Relacional',
        components: [
          { name: 'Portal Web Clientes', layer: 'Presentation', type: 'React Component' },
          { name: 'Módulo Operativo Taller', layer: 'Presentation', type: 'React Component' },
          { name: 'API REST Controllers', layer: 'Application', type: 'Express Route' },
          { name: 'Servicio de Trazabilidad', layer: 'Domain', type: 'Business Logic' },
          { name: 'Prisma Client ORM', layer: 'Infrastructure', type: 'Data Access' },
          { name: 'Base de Datos Centralizada', layer: 'Persistence', type: 'PostgreSQL' }
        ],
        connections: [
          { from: 'Portal Web Clientes', to: 'API REST Controllers', type: 'HTTPS / REST' },
          { from: 'Módulo Operativo Taller', to: 'API REST Controllers', type: 'HTTPS / REST' },
          { from: 'API REST Controllers', to: 'Servicio de Trazabilidad', type: 'In-process Call' },
          { from: 'Servicio de Trazabilidad', to: 'Prisma Client ORM', type: 'ORM Query' },
          { from: 'Prisma Client ORM', to: 'Base de Datos Centralizada', type: 'SQL Connection' }
        ]
      };
    } else if (isLibrary) {
      actors = [
        { id: 'ACT-01', name: 'Bibliotecario', description: 'Supervisa el inventario bibliográfico, emite préstamos y recibe devoluciones.' },
        { id: 'ACT-02', name: 'Usuario Lector', description: 'Consulta el catálogo público, reserva ejemplares y revisa su estado de préstamo.' },
        { id: 'ACT-03', name: 'Administrador', description: 'Gestiona políticas del sistema, multas y cuentas de usuarios.' }
      ];

      requirements = [
        {
          code: 'RF-01',
          name: 'Catálogo de Libros',
          description: 'Permite registrar, actualizar y catalogar libros con título, autor, ISBN y stock.',
          type: 'FUNCIONAL',
          priority: 'ALTA',
          actorIds: ['ACT-01', 'ACT-03'],
          dependencies: []
        },
        {
          code: 'RF-02',
          name: 'Gestión de Préstamos',
          description: 'Registra préstamos de libros a usuarios con fecha límite de devolución.',
          type: 'FUNCIONAL',
          priority: 'ALTA',
          actorIds: ['ACT-01', 'ACT-02'],
          dependencies: ['RF-01']
        },
        {
          code: 'RF-03',
          name: 'Búsqueda y Consulta',
          description: 'Búsqueda de ejemplares con filtros por título, autor y categoría temática.',
          type: 'FUNCIONAL',
          priority: 'MEDIA',
          actorIds: ['ACT-02'],
          dependencies: ['RF-01']
        },
        {
          code: 'RF-04',
          name: 'Control de Devoluciones y Multas',
          description: 'Calcula recargos por días de retraso al devolver ejemplares prestados.',
          type: 'FUNCIONAL',
          priority: 'MEDIA',
          actorIds: ['ACT-01'],
          dependencies: ['RF-02']
        },
        {
          code: 'RNF-01',
          name: 'Disponibilidad del Catálogo',
          description: 'El catálogo público debe garantizar un tiempo de actividad >= 99.5%.',
          type: 'NO_FUNCIONAL',
          priority: 'ALTA',
          actorIds: [],
          dependencies: []
        },
        {
          code: 'RNF-02',
          name: 'Tiempos de Respuesta de Búsqueda',
          description: 'Las consultas de búsqueda en el catálogo deben resolver en menos de 800 ms.',
          type: 'NO_FUNCIONAL',
          priority: 'MEDIA',
          actorIds: [],
          dependencies: []
        }
      ];

      entities = [
        {
          id: 'ENT-01',
          name: 'Libro',
          description: 'Ejemplar bibliográfico físico o digital disponible en el catálogo.',
          attributes: [
            { name: 'id', type: 'Int' },
            { name: 'isbn', type: 'String' },
            { name: 'titulo', type: 'String' },
            { name: 'autor', type: 'String' },
            { name: 'ejemplaresDisponibles', type: 'Int' }
          ]
        },
        {
          id: 'ENT-02',
          name: 'Usuario',
          description: 'Miembro o estudiante registrado para préstamos.',
          attributes: [
            { name: 'id', type: 'Int' },
            { name: 'dni', type: 'String' },
            { name: 'nombreCompleto', type: 'String' },
            { name: 'correo', type: 'String' },
            { name: 'estado', type: 'String' }
          ]
        },
        {
          id: 'ENT-03',
          name: 'Prestamo',
          description: 'Registro de asignación temporal de un libro a un usuario.',
          attributes: [
            { name: 'id', type: 'Int' },
            { name: 'fechaPrestamo', type: 'DateTime' },
            { name: 'fechaVencimiento', type: 'DateTime' },
            { name: 'fechaDevolucion', type: 'DateTime' },
            { name: 'estado', type: 'String' }
          ]
        }
      ];

      relationships = [
        {
          id: 'REL-01',
          source: 'Usuario',
          target: 'Prestamo',
          cardinality: '1:N',
          description: 'Un usuario puede tener múltiples préstamos a lo largo del tiempo.'
        },
        {
          id: 'REL-02',
          source: 'Libro',
          target: 'Prestamo',
          cardinality: '1:N',
          description: 'Un libro puede figurar en varios préstamos históricos.'
        }
      ];

      screens = [
        {
          id: 'SCR-01',
          name: 'Inicio de Sesión',
          description: 'Acceso seguro para bibliotecarios y lectores.',
          route: '/login',
          purpose: 'Autenticación de credenciales de usuario.',
          components: [
            { type: 'heading', label: 'Bienvenido al Sistema de Biblioteca' },
            { type: 'text', label: 'Ingrese sus credenciales universitarias para continuar.' },
            { type: 'input', label: 'Correo Electrónico', placeholder: 'usuario@uni.edu.pe' },
            { type: 'input', label: 'Contraseña', placeholder: '••••••••••••' },
            { type: 'button', label: 'Ingresar al Portal' }
          ]
        },
        {
          id: 'SCR-02',
          name: 'Dashboard Principal',
          description: 'Resumen operativo de préstamos activos, vencimientos y libros populares.',
          route: '/dashboard',
          purpose: 'Panel central de control y métricas clave.',
          components: [
            { type: 'navbar', label: 'Biblioteca Central - Panel de Control' },
            { type: 'heading', label: 'Métricas de Circulación' },
            { type: 'card', label: 'Préstamos Activos', description: '42 préstamos en curso (3 vencen hoy)' },
            { type: 'card', label: 'Total de Libros', description: '1,280 ejemplares registrados en inventario' },
            { type: 'button', label: 'Registrar Nuevo Préstamo' },
            { type: 'button', label: 'Consultar Catálogo' }
          ]
        },
        {
          id: 'SCR-03',
          name: 'Catálogo de Libros',
          description: 'Listado y búsqueda de ejemplares.',
          route: '/libros',
          purpose: 'Gestión y exploración de títulos bibliográficos.',
          components: [
            { type: 'heading', label: 'Catálogo General de Ejemplares' },
            { type: 'input', label: 'Buscar por título, autor o ISBN', placeholder: 'Ej: Clean Architecture' },
            {
              type: 'table',
              label: 'Libros Disponibles',
              meta: {
                headers: ['ISBN', 'Título', 'Autor', 'Disponibles'],
                rows: [
                  ['978-0134494166', 'Clean Architecture', 'Robert C. Martin', '4'],
                  ['978-0201633610', 'Design Patterns (GoF)', 'Erich Gamma et al.', '2'],
                  ['978-0321125217', 'Domain-Driven Design', 'Eric Evans', '3']
                ]
              }
            }
          ]
        },
        {
          id: 'SCR-04',
          name: 'Registro de Préstamo',
          description: 'Formulario de asignación de libros a usuarios.',
          route: '/prestamos/nuevo',
          purpose: 'Captura y validación de una nueva transacción de préstamo.',
          components: [
            { type: 'heading', label: 'Asignar Nuevo Préstamo' },
            { type: 'input', label: 'DNI o Código de Lector', placeholder: 'Ingrese código de estudiante...' },
            { type: 'input', label: 'Código de Barra / ISBN del Libro', placeholder: 'Escanee o digite código...' },
            { type: 'input', label: 'Días de Préstamo', placeholder: '7 días hábiles' },
            { type: 'button', label: 'Confirmar y Emitir Boleta de Préstamo' }
          ]
        }
      ];

      navigation = [
        { from: 'Inicio de Sesión', to: 'Dashboard Principal', action: 'Autenticación Exitosa' },
        { from: 'Dashboard Principal', to: 'Catálogo de Libros', action: 'Ver Catálogo' },
        { from: 'Dashboard Principal', to: 'Registro de Préstamo', action: 'Nuevo Préstamo' },
        { from: 'Catálogo de Libros', to: 'Registro de Préstamo', action: 'Prestar Libro Seleccionado' },
        { from: 'Registro de Préstamo', to: 'Dashboard Principal', action: 'Préstamo Confirmado' }
      ];

      architecture = {
        style: 'Clean Architecture en 3 Capas',
        frontend: 'React 18 + Vite SPA',
        backend: 'Node.js + Express REST API',
        database: 'PostgreSQL 16 (Model First Prisma)',
        components: [
          { name: 'Catálogo UI', layer: 'Presentation', type: 'Component' },
          { name: 'Préstamos UI', layer: 'Presentation', type: 'Component' },
          { name: 'Libro Controller', layer: 'Application', type: 'Controller' },
          { name: 'Préstamo Service', layer: 'Domain', type: 'Service' },
          { name: 'Prisma Client', layer: 'Infrastructure', type: 'ORM' },
          { name: 'PostgreSQL DB', layer: 'Persistence', type: 'Database' }
        ],
        connections: [
          { from: 'Catálogo UI', to: 'Libro Controller', type: 'HTTP' },
          { from: 'Préstamos UI', to: 'Libro Controller', type: 'HTTP' },
          { from: 'Libro Controller', to: 'Préstamo Service', type: 'Internal Call' },
          { from: 'Préstamo Service', to: 'Prisma Client', type: 'ORM Query' },
          { from: 'Prisma Client', to: 'PostgreSQL DB', type: 'TCP / SQL' }
        ]
      };
    } else if (isHospital) {
      actors = [
        { id: 'ACT-01', name: 'Médico', description: 'Atiende consultas, prescribe recetas y actualiza historiales clínicos.' },
        { id: 'ACT-02', name: 'Paciente', description: 'Solicita citas médicas y consulta sus resultados clínicos.' },
        { id: 'ACT-03', name: 'Recepcionista', description: 'Registra pacientes y organiza los turnos de atención.' }
      ];

      requirements = [
        { code: 'RF-01', name: 'Agendamiento de Citas', description: 'Permite programar citas según especialidad y disponibilidad médica.', type: 'FUNCIONAL', priority: 'ALTA', actorIds: ['ACT-02', 'ACT-03'], dependencies: [] },
        { code: 'RF-02', name: 'Historial Clínico', description: 'Registro confidencial de diagnósticos, antecedentes y tratamientos.', type: 'FUNCIONAL', priority: 'ALTA', actorIds: ['ACT-01'], dependencies: ['RF-01'] },
        { code: 'RF-03', name: 'Prescripción Médica', description: 'Emisión digital de recetas farmacéuticas vinculadas a la cita.', type: 'FUNCIONAL', priority: 'MEDIA', actorIds: ['ACT-01'], dependencies: ['RF-02'] },
        { code: 'RNF-01', name: 'Confidencialidad Médica', description: 'Cifrado en reposo y en tránsito de datos sensibles de salud.', type: 'NO_FUNCIONAL', priority: 'ALTA', actorIds: [], dependencies: [] }
      ];

      entities = [
        {
          id: 'ENT-01',
          name: 'Paciente',
          description: 'Persona que recibe atención médica.',
          attributes: [
            { name: 'id', type: 'Int' },
            { name: 'dni', type: 'String' },
            { name: 'nombreCompleto', type: 'String' },
            { name: 'historiaClinicaNum', type: 'String' }
          ]
        },
        {
          id: 'ENT-02',
          name: 'Medico',
          description: 'Profesional de la salud registrado.',
          attributes: [
            { name: 'id', type: 'Int' },
            { name: 'cmp', type: 'String' },
            { name: 'nombreCompleto', type: 'String' },
            { name: 'especialidad', type: 'String' }
          ]
        },
        {
          id: 'ENT-03',
          name: 'CitaMedica',
          description: 'Consulta programada entre paciente y médico.',
          attributes: [
            { name: 'id', type: 'Int' },
            { name: 'fechaHora', type: 'DateTime' },
            { name: 'motivo', type: 'String' },
            { name: 'estado', type: 'String' }
          ]
        }
      ];

      relationships = [
        { id: 'REL-01', source: 'Paciente', target: 'CitaMedica', cardinality: '1:N', description: 'Un paciente tiene múltiples citas programadas.' },
        { id: 'REL-02', source: 'Medico', target: 'CitaMedica', cardinality: '1:N', description: 'Un médico atiende diversas citas médicas.' }
      ];

      screens = [
        {
          id: 'SCR-01',
          name: 'Dashboard Clínico',
          description: 'Resumen de pacientes y agenda del día.',
          route: '/dashboard',
          purpose: 'Control de turnos y estado de consultorios.',
          components: [
            { type: 'navbar', label: 'Clínica Salud - Portal Médico' },
            { type: 'heading', label: 'Turnos del Día' },
            { type: 'card', label: 'Citas Hoy', description: '18 pacientes agendados' },
            { type: 'button', label: 'Programar Cita' }
          ]
        },
        {
          id: 'SCR-02',
          name: 'Nueva Cita Médica',
          description: 'Registro de reserva médica.',
          route: '/citas/nueva',
          purpose: 'Asignación de consultorio y fecha.',
          components: [
            { type: 'heading', label: 'Registrar Cita Médica' },
            { type: 'input', label: 'DNI del Paciente', placeholder: 'Documento nacional...' },
            { type: 'input', label: 'Especialidad', placeholder: 'Ej: Cardiología' },
            { type: 'button', label: 'Agendar Cita' }
          ]
        }
      ];

      navigation = [
        { from: 'Dashboard Clínico', to: 'Nueva Cita Médica', action: 'Agendar Cita' },
        { from: 'Nueva Cita Médica', to: 'Dashboard Clínico', action: 'Cita Confirmada' }
      ];

      architecture = {
        style: 'Microservicios Modulares',
        frontend: 'React SPA',
        backend: 'Node.js Express Gateway',
        database: 'PostgreSQL Relational DB',
        components: [
          { name: 'Citas Portal', layer: 'Presentation', type: 'SPA' },
          { name: 'Citas Service', layer: 'Application', type: 'Microservice' },
          { name: 'Postgres DB', layer: 'Persistence', type: 'Database' }
        ],
        connections: [
          { from: 'Citas Portal', to: 'Citas Service', type: 'REST' },
          { from: 'Citas Service', to: 'Postgres DB', type: 'SQL' }
        ]
      };
    } else if (isEcommerce) {
      actors = [
        { id: 'ACT-01', name: 'Cliente', description: 'Explora productos, llena el carrito y realiza pagos.' },
        { id: 'ACT-02', name: 'Administrador de Tienda', description: 'Gestiona el inventario, precios y despachos.' }
      ];

      requirements = [
        { code: 'RF-01', name: 'Catálogo de Productos', description: 'Publicación de productos con fotos, stock y precio.', type: 'FUNCIONAL', priority: 'ALTA', actorIds: ['ACT-01', 'ACT-02'], dependencies: [] },
        { code: 'RF-02', name: 'Carrito y Checkout', description: 'Acumulación de ítems y liquidación mediante pasarela de pago.', type: 'FUNCIONAL', priority: 'ALTA', actorIds: ['ACT-01'], dependencies: ['RF-01'] },
        { code: 'RF-03', name: 'Seguimiento de Pedidos', description: 'Trazabilidad del estado del pedido (pagado, en ruta, entregado).', type: 'FUNCIONAL', priority: 'MEDIA', actorIds: ['ACT-01'], dependencies: ['RF-02'] },
        { code: 'RNF-01', name: 'Seguridad en Transacciones', description: 'Cumplimiento estándar PCI-DSS para cobros seguros.', type: 'NO_FUNCIONAL', priority: 'ALTA', actorIds: [], dependencies: [] }
      ];

      entities = [
        {
          id: 'ENT-01',
          name: 'Producto',
          description: 'Artículo en venta en el catálogo.',
          attributes: [
            { name: 'id', type: 'Int' },
            { name: 'sku', type: 'String' },
            { name: 'nombre', type: 'String' },
            { name: 'precio', type: 'Decimal' },
            { name: 'stock', type: 'Int' }
          ]
        },
        {
          id: 'ENT-02',
          name: 'Cliente',
          description: 'Comprador registrado en la tienda.',
          attributes: [
            { name: 'id', type: 'Int' },
            { name: 'correo', type: 'String' },
            { name: 'nombre', type: 'String' }
          ]
        },
        {
          id: 'ENT-03',
          name: 'Pedido',
          description: 'Orden de compra confirmada.',
          attributes: [
            { name: 'id', type: 'Int' },
            { name: 'total', type: 'Decimal' },
            { name: 'estado', type: 'String' },
            { name: 'fecha', type: 'DateTime' }
          ]
        }
      ];

      relationships = [
        { id: 'REL-01', source: 'Cliente', target: 'Pedido', cardinality: '1:N', description: 'Un cliente genera múltiples pedidos.' },
        { id: 'REL-02', source: 'Producto', target: 'Pedido', cardinality: '1:N', description: 'Un producto puede estar en múltiples pedidos.' }
      ];

      screens = [
        {
          id: 'SCR-01',
          name: 'Tienda Virtual',
          description: 'Catálogo de productos para clientes.',
          route: '/tienda',
          purpose: 'Navegación comercial de artículos.',
          components: [
            { type: 'navbar', label: 'E-Shop - Catálogo' },
            { type: 'heading', label: 'Productos Destacados' },
            { type: 'card', label: 'Laptop Pro 16"', description: 'S/. 4,500.00 - Stock disponible' },
            { type: 'button', label: 'Añadir al Carrito' }
          ]
        },
        {
          id: 'SCR-02',
          name: 'Pasarela de Pago',
          description: 'Confirmación y pago del pedido.',
          route: '/checkout',
          purpose: 'Cierre de la venta online.',
          components: [
            { type: 'heading', label: 'Finalizar Compra' },
            { type: 'input', label: 'Dirección de Entrega', placeholder: 'Av. Universitaria 123' },
            { type: 'button', label: 'Pagar con Tarjeta' }
          ]
        }
      ];

      navigation = [
        { from: 'Tienda Virtual', to: 'Pasarela de Pago', action: 'Ir al Checkout' },
        { from: 'Pasarela de Pago', to: 'Tienda Virtual', action: 'Compra Exitosa' }
      ];

      architecture = {
        style: 'Event-Driven E-Commerce Architecture',
        frontend: 'React Next.js SPA',
        backend: 'Express.js + Payment Gateway',
        database: 'PostgreSQL Order Store',
        components: [
          { name: 'Storefront', layer: 'Presentation', type: 'Web' },
          { name: 'Order Service', layer: 'Business', type: 'API' },
          { name: 'Postgres DB', layer: 'Persistence', type: 'Database' }
        ],
        connections: [
          { from: 'Storefront', to: 'Order Service', type: 'HTTPS' },
          { from: 'Order Service', to: 'Postgres DB', type: 'SQL' }
        ]
      };
    } else {
      // Caso genérico/empresarial
      actors = [
        { id: 'ACT-01', name: 'Usuario Operador', description: 'Ingresa registros, actualiza estados y ejecuta operaciones diarias.' },
        { id: 'ACT-02', name: 'Supervisor / Gestor', description: 'Revisa métricas, autoriza solicitudes y genera reportes.' },
        { id: 'ACT-03', name: 'Administrador del Sistema', description: 'Gestiona accesos, parámetros globales y auditoría de seguridad.' }
      ];

      requirements = [
        {
          code: 'RF-01',
          name: 'Gestión Principal de Registros',
          description: `Permite crear, actualizar y dar de baja registros de ${projectName}.`,
          type: 'FUNCIONAL',
          priority: 'ALTA',
          actorIds: ['ACT-01', 'ACT-02'],
          dependencies: []
        },
        {
          code: 'RF-02',
          name: 'Búsqueda y Filtros de Auditoría',
          description: 'Búsqueda avanzada de registros por fecha, estado y responsable.',
          type: 'FUNCIONAL',
          priority: 'MEDIA',
          actorIds: ['ACT-02', 'ACT-03'],
          dependencies: ['RF-01']
        },
        {
          code: 'RF-03',
          name: 'Exportación de Reportes',
          description: 'Generación de informes consolidados en formatos estructurados.',
          type: 'FUNCIONAL',
          priority: 'MEDIA',
          actorIds: ['ACT-02'],
          dependencies: ['RF-02']
        },
        {
          code: 'RNF-01',
          name: 'Disponibilidad y Tolerancia a Fallos',
          description: 'El sistema debe garantizar alta disponibilidad con tiempo de actividad >= 99.5%.',
          type: 'NO_FUNCIONAL',
          priority: 'ALTA',
          actorIds: [],
          dependencies: []
        },
        {
          code: 'RNF-02',
          name: 'Trazabilidad de Auditoría',
          description: 'Registro de fecha, hora y usuario para cada transacción crítica.',
          type: 'NO_FUNCIONAL',
          priority: 'MEDIA',
          actorIds: [],
          dependencies: []
        }
      ];

      entities = [
        {
          id: 'ENT-01',
          name: 'RegistroPrincipal',
          description: 'Entidad central del dominio operativo.',
          attributes: [
            { name: 'id', type: 'Int' },
            { name: 'codigo', type: 'String' },
            { name: 'titulo', type: 'String' },
            { name: 'estado', type: 'String' },
            { name: 'fechaCreacion', type: 'DateTime' }
          ]
        },
        {
          id: 'ENT-02',
          name: 'DetalleItem',
          description: 'Sub-elemento descriptivo asociado al registro principal.',
          attributes: [
            { name: 'id', type: 'Int' },
            { name: 'descripcion', type: 'String' },
            { name: 'monto', type: 'Decimal' }
          ]
        },
        {
          id: 'ENT-03',
          name: 'UsuarioSistema',
          description: 'Colaborador acreditado con rol de acceso.',
          attributes: [
            { name: 'id', type: 'Int' },
            { name: 'nombreUsuario', type: 'String' },
            { name: 'correo', type: 'String' },
            { name: 'rol', type: 'String' }
          ]
        }
      ];

      relationships = [
        {
          id: 'REL-01',
          source: 'RegistroPrincipal',
          target: 'DetalleItem',
          cardinality: '1:N',
          description: 'Un registro principal contiene varios detalles de ítem.'
        },
        {
          id: 'REL-02',
          source: 'UsuarioSistema',
          target: 'RegistroPrincipal',
          cardinality: '1:N',
          description: 'Un usuario puede crear múltiples registros principales.'
        }
      ];

      screens = [
        {
          id: 'SCR-01',
          name: 'Dashboard de Control',
          description: 'Panel de métricas y acceso rápido a módulos.',
          route: '/dashboard',
          purpose: 'Visión global del estado del sistema.',
          components: [
            { type: 'navbar', label: `${projectName} - Consola de Gestión` },
            { type: 'heading', label: 'Resumen Operativo' },
            { type: 'card', label: 'Registros Activos', description: 'Estado general y volumen de actividad.' },
            { type: 'button', label: 'Crear Nuevo Registro' }
          ]
        },
        {
          id: 'SCR-02',
          name: 'Formulario de Registro',
          description: 'Formulario estándar para captura de información.',
          route: '/registros/nuevo',
          purpose: 'Captura y guardado de nuevas entidades.',
          components: [
            { type: 'heading', label: 'Nuevo Registro' },
            { type: 'input', label: 'Título o Código', placeholder: 'Ingrese código...' },
            { type: 'input', label: 'Observaciones', placeholder: 'Detalles...' },
            { type: 'button', label: 'Guardar Registro' }
          ]
        }
      ];

      navigation = [
        { from: 'Dashboard de Control', to: 'Formulario de Registro', action: 'Crear Registro' },
        { from: 'Formulario de Registro', to: 'Dashboard de Control', action: 'Guardado Exitoso' }
      ];

      architecture = {
        style: 'Arquitectura por Capas Limpia',
        frontend: 'React 18 + Vite SPA',
        backend: 'Express.js REST API',
        database: 'PostgreSQL 16 Engine',
        components: [
          { name: 'Frontend SPA', layer: 'Presentation', type: 'React' },
          { name: 'API Controllers', layer: 'Application', type: 'Express' },
          { name: 'Prisma Client', layer: 'Infrastructure', type: 'ORM' },
          { name: 'PostgreSQL DB', layer: 'Persistence', type: 'Database' }
        ],
        connections: [
          { from: 'Frontend SPA', to: 'API Controllers', type: 'HTTP / REST' },
          { from: 'API Controllers', to: 'Prisma Client', type: 'Internal Call' },
          { from: 'Prisma Client', to: 'PostgreSQL DB', type: 'SQL' }
        ]
      };
    }

    return {
      project: {
        name: projectName,
        description: desc
      },
      actors,
      requirements,
      entities,
      relationships,
      screens,
      navigation,
      architecture
    };
  }

  // Alias para compatibilidad
  async analyze(description, context = {}) {
    return this.analyzeProject({
      name: context.name,
      description,
      context
    });
  }
}

module.exports = MockAIProvider;
