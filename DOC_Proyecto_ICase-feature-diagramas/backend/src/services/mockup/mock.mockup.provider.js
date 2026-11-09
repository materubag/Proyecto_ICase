/**
 * Mock Mockup Provider
 * Returns controlled declarative JSON screens for the frontend MockupRenderer
 */
class MockMockupProvider {
  async generateMockup(project, prompt = '') {
    const projectName = project.name || 'Sistema Empresarial';

    return {
      success: true,
      provider: 'MockMockupProvider',
      projectId: project.id,
      generatedAt: new Date().toISOString(),
      screens: [
        {
          id: 'dashboard',
          name: 'Panel Principal',
          description: `Vista general de operaciones para ${projectName}`,
          route: '/dashboard',
          layout: { type: 'grid' },
          components: [
            {
              type: 'navbar',
              label: `${projectName} - Console`,
              meta: { brand: 'ICASE' }
            },
            {
              type: 'heading',
              label: 'Indicadores de Gestión',
              meta: { level: 2 }
            },
            {
              type: 'card',
              label: 'Resumen Diario',
              description: 'Últimas 24 horas de registros y actividad del sistema.'
            },
            {
              type: 'table',
              label: 'Registros Recientes',
              meta: {
                headers: ['Código', 'Elemento', 'Responsable', 'Estado'],
                rows: [
                  ['REC-001', 'Actualización de Inventario', 'Admin', 'Activo'],
                  ['REC-002', 'Alta de Usuario', 'Supervisor', 'Completado'],
                  ['REC-003', 'Auditoría de Acceso', 'Sistema', 'En Revisión']
                ]
              }
            }
          ]
        },
        {
          id: 'create-record',
          name: 'Registro y Captura de Datos',
          description: 'Formulario estándar para creación de registros del sistema',
          route: '/records/new',
          layout: { type: 'form' },
          components: [
            {
              type: 'heading',
              label: 'Nuevo Formulario de Registro',
              meta: { level: 2 }
            },
            {
              type: 'text',
              label: 'Complete los campos obligatorios para guardar la entidad en la base de datos.'
            },
            {
              type: 'input',
              label: 'Título / Identificador',
              placeholder: 'Ej: Préstamo #402 o Transacción A-12'
            },
            {
              type: 'input',
              label: 'Correo del Solicitante',
              placeholder: 'usuario@empresa.com'
            },
            {
              type: 'input',
              label: 'Notas Adicionales / Observaciones',
              placeholder: 'Detalles complementarios...'
            },
            {
              type: 'button',
              label: 'Guardar y Procesar'
            }
          ]
        },
        {
          id: 'auth-screen',
          name: 'Inicio de Sesión',
          description: 'Pantalla de autenticación y verificación de credenciales',
          route: '/login',
          layout: { type: 'form' },
          components: [
            {
              type: 'heading',
              label: 'Acceso Seguro al Sistema',
              meta: { level: 2 }
            },
            {
              type: 'input',
              label: 'Correo Electrónico',
              placeholder: 'admin@icase.org'
            },
            {
              type: 'input',
              label: 'Contraseña',
              placeholder: '••••••••••••'
            },
            {
              type: 'button',
              label: 'Ingresar a la Plataforma'
            }
          ]
        }
      ]
    };
  }
}

module.exports = MockMockupProvider;
