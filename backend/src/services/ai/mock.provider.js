const AIProviderInterface = require('./ai.provider.interface');

class MockAIProvider extends AIProviderInterface {
  async analyze(systemDescription, projectContext = {}) {
    // Generación de respuesta estructurada canónica simulada
    const projectName = projectContext.name || 'Sistema de Gestión';
    const desc = systemDescription || projectContext.description || 'Plataforma empresarial de gestión y control.';

    // Simulación de detección inteligente basada en palabras clave
    const isLibrary = desc.toLowerCase().includes('biblioteca') || projectName.toLowerCase().includes('biblioteca');
    const isHospital = desc.toLowerCase().includes('hospital') || desc.toLowerCase().includes('salud') || desc.toLowerCase().includes('médic');
    const isEcommerce = desc.toLowerCase().includes('tienda') || desc.toLowerCase().includes('venta') || desc.toLowerCase().includes('comercio');

    let actors = [];
    let requirements = [];
    let entities = [];
    let navigation = [];
    let architecture = {};
    let screens = [];

    if (isLibrary) {
      actors = [
        { name: 'Bibliotecario', description: 'Administra el catálogo de libros, usuarios y supervisa préstamos.' },
        { name: 'Lector / Estudiante', description: 'Consulta el catálogo, reserva ejemplares y visualiza su historial.' },
        { name: 'Administrador', description: 'Gestiona permisos de usuarios y parámetros globales del sistema.' }
      ];

      requirements = [
        { code: 'RF-01', name: 'Catálogo de Libros', description: 'Permite registrar, actualizar y dar de baja ejemplares bibliográficos con ISBN, autor y género.', type: 'FUNCIONAL', priority: 'ALTA' },
        { code: 'RF-02', name: 'Gestión de Préstamos', description: 'Control de préstamos y devoluciones con cálculo de penalidades por mora.', type: 'FUNCIONAL', priority: 'ALTA' },
        { code: 'RF-03', name: 'Búsqueda Avanzada', description: 'Búsqueda por título, autor, editorial o materias clave con filtros facetados.', type: 'FUNCIONAL', priority: 'MEDIA' },
        { code: 'RF-04', name: 'Notificaciones de Vencimiento', description: 'Envío de alertas automáticas previo a la fecha límite de devolución.', type: 'FUNCIONAL', priority: 'MEDIA' },
        { code: 'RNF-01', name: 'Tiempo de Respuesta', description: 'El motor de búsqueda debe responder en menos de 500 ms con catálogos superiores a 50,000 ítems.', type: 'NO_FUNCIONAL', priority: 'ALTA' },
        { code: 'RNF-02', name: 'Seguridad y Privacidad', description: 'Cumplimiento con normativas de protección de datos personales de los usuarios registrados.', type: 'NO_FUNCIONAL', priority: 'MEDIA' }
      ];

      entities = [
        {
          name: 'Book',
          attributes: [
            { name: 'id', type: 'UUID', isPk: true },
            { name: 'isbn', type: 'String', isPk: false },
            { name: 'title', type: 'String', isPk: false },
            { name: 'author', type: 'String', isPk: false },
            { name: 'copiesAvailable', type: 'Int', isPk: false }
          ]
        },
        {
          name: 'Loan',
          attributes: [
            { name: 'id', type: 'UUID', isPk: true },
            { name: 'bookId', type: 'UUID', isPk: false },
            { name: 'userId', type: 'UUID', isPk: false },
            { name: 'loanDate', type: 'DateTime', isPk: false },
            { name: 'dueDate', type: 'DateTime', isPk: false },
            { name: 'returnDate', type: 'DateTime', isPk: false }
          ]
        },
        {
          name: 'User',
          attributes: [
            { name: 'id', type: 'UUID', isPk: true },
            { name: 'dni', type: 'String', isPk: false },
            { name: 'fullName', type: 'String', isPk: false },
            { name: 'email', type: 'String', isPk: false }
          ]
        }
      ];

      navigation = [
        { from: 'Inicio', to: 'Catálogo de Libros' },
        { from: 'Inicio', to: 'Préstamos y Reservas' },
        { from: 'Inicio', to: 'Reportes y Estadísticas' },
        { from: 'Catálogo de Libros', to: 'Ficha Detallada de Libro' },
        { from: 'Préstamos y Reservas', to: 'Registrar Devolución' }
      ];

      architecture = {
        style: 'Clean Architecture en 3 Capas',
        layers: [
          { name: 'Presentation Layer', components: ['React SPA', 'Tailwind/Vanilla CSS UI', 'Mermaid Engine'] },
          { name: 'Application & Business Layer', components: ['Express REST API', 'Loan Domain Service', 'AI Provider Adapter'] },
          { name: 'Infrastructure & Persistence Layer', components: ['Prisma ORM', 'PostgreSQL Database', 'Docker Containers'] }
        ]
      };
    } else {
      // Caso genérico basado en la descripción suministrada
      actors = [
        { name: 'Usuario Final', description: 'Interactúa con los módulos principales del aplicativo según su rol.' },
        { name: 'Operador / Gestor', description: 'Supervisa las operaciones cotidianas y actualiza los registros.' },
        { name: 'Administrador del Sistema', description: 'Configura parámetros, auditoría y accesos de seguridad.' }
      ];

      requirements = [
        { code: 'RF-01', name: 'Gestión Principal de Entidades', description: `Permite administrar el ciclo de vida de los registros requeridos para: ${projectName}.`, type: 'FUNCIONAL', priority: 'ALTA' },
        { code: 'RF-02', name: 'Consulta y Filtrado', description: 'Permite buscar, ordenar y filtrar información con paginación optimizada.', type: 'FUNCIONAL', priority: 'ALTA' },
        { code: 'RF-03', name: 'Exportación de Datos', description: 'Capacidad de emitir informes consolidados en formatos estructurados.', type: 'FUNCIONAL', priority: 'MEDIA' },
        { code: 'RNF-01', name: 'Disponibilidad y Concurrencia', description: 'El sistema debe soportar alta disponibilidad con tiempo de actividad >= 99.5%.', type: 'NO_FUNCIONAL', priority: 'ALTA' },
        { code: 'RNF-02', name: 'Trazabilidad y Auditoría', description: 'Registro de fecha, hora y usuario para cada transacción crítica.', type: 'NO_FUNCIONAL', priority: 'MEDIA' }
      ];

      entities = [
        {
          name: 'MainRecord',
          attributes: [
            { name: 'id', type: 'UUID', isPk: true },
            { name: 'title', type: 'String', isPk: false },
            { name: 'status', type: 'String', isPk: false },
            { name: 'createdAt', type: 'DateTime', isPk: false }
          ]
        },
        {
          name: 'ItemDetail',
          attributes: [
            { name: 'id', type: 'UUID', isPk: true },
            { name: 'mainRecordId', type: 'UUID', isPk: false },
            { name: 'description', type: 'Text', isPk: false },
            { name: 'value', type: 'Decimal', isPk: false }
          ]
        },
        {
          name: 'SystemUser',
          attributes: [
            { name: 'id', type: 'UUID', isPk: true },
            { name: 'username', type: 'String', isPk: false },
            { name: 'role', type: 'String', isPk: false }
          ]
        }
      ];

      navigation = [
        { from: 'Dashboard', to: 'Módulo Principal' },
        { from: 'Dashboard', to: 'Gestión de Registros' },
        { from: 'Dashboard', to: 'Configuración y Auditoría' },
        { from: 'Gestión de Registros', to: 'Crear / Editar Registro' }
      ];

      architecture = {
        style: 'Layered Modular Architecture',
        layers: [
          { name: 'Frontend Layer', components: ['React + Vite Web App', 'Mermaid Engine', 'Dynamic Mockups'] },
          { name: 'API & Orchestration Layer', components: ['Express.js REST Services', 'AI Provider Gateway', 'n8n Webhook Connector'] },
          { name: 'Persistence & Data Layer', components: ['Prisma Client', 'PostgreSQL 16 Engine'] }
        ]
      };
    }

    screens = [
      {
        id: 'dashboard-screen',
        name: 'Dashboard General',
        description: 'Panel de métricas y acceso rápido a módulos',
        route: '/dashboard',
        layout: { type: 'grid' },
        components: [
          { type: 'navbar', label: `${projectName} - Portal Principal` },
          { type: 'heading', label: 'Resumen Operativo del Sistema' },
          { type: 'card', label: 'Métricas Rápidas', description: 'Estado actual de transacciones y registros pendientes.' },
          { type: 'button', label: 'Crear Nuevo Registro' }
        ]
      },
      {
        id: 'management-form',
        name: 'Formulario de Operación',
        description: 'Pantalla de alta y captura de datos',
        route: '/records/new',
        layout: { type: 'form' },
        components: [
          { type: 'heading', label: 'Registrar Información' },
          { type: 'input', label: 'Título / Nombre del Registro', placeholder: 'Ingrese el nombre...' },
          { type: 'input', label: 'Categoría o Tipo', placeholder: 'Seleccione categoría' },
          { type: 'button', label: 'Guardar Registro' }
        ]
      }
    ];

    return {
      project: {
        id: projectContext.id,
        name: projectName,
        description: desc
      },
      actors,
      requirements,
      entities,
      screens,
      navigation,
      architecture,
      meta: {
        provider: 'MockAIProvider',
        analyzedAt: new Date().toISOString(),
        status: 'SUCCESS'
      }
    };
  }
}

module.exports = MockAIProvider;
