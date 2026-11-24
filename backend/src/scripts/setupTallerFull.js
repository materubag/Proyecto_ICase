'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projectId = '548804a3-4620-4e92-aca9-fac3172db604';
  console.log(`Configuring project ${projectId} for Workshop Tool Loan system...`);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error('Project not found');

  // 1. Actores
  const actors = await prisma.actor.findMany({ where: { projectId } });
  let estudiante = actors.find(a => /estudiante/i.test(a.name));
  let encargado = actors.find(a => /encargado/i.test(a.name));

  if (!estudiante) {
    estudiante = await prisma.actor.create({
      data: {
        projectId,
        codeId: 'ACT-01',
        name: 'Estudiante',
        description: 'Consulta herramientas, solicita unidades en préstamo y revisa el estado de sus solicitudes.',
        status: 'APPROVED',
        reviewStatus: 'APPROVED',
        aliases: ['Estudiante', 'Alumno']
      }
    });
  } else {
    await prisma.actor.update({
      where: { id: estudiante.id },
      data: { status: 'APPROVED', reviewStatus: 'APPROVED' }
    });
  }

  if (!encargado) {
    encargado = await prisma.actor.create({
      data: {
        projectId,
        codeId: 'ACT-02',
        name: 'Encargado',
        description: 'Registra herramientas, resuelve solicitudes, confirma entregas, recibe devoluciones y supervisa préstamos vencidos.',
        status: 'APPROVED',
        reviewStatus: 'APPROVED',
        aliases: ['Encargado', 'Administrador de Taller', 'Pañolero']
      }
    });
  } else {
    await prisma.actor.update({
      where: { id: encargado.id },
      data: { status: 'APPROVED', reviewStatus: 'APPROVED' }
    });
  }

  // 2. Requisitos formales
  const requirementsData = [
    {
      code: 'RF-01',
      name: 'Registrar herramientas',
      description: 'Registrar herramientas. El Encargado registra el nombre, la categoría y la cantidad disponible de cada herramienta.',
      type: 'FUNCTIONAL',
      actorIds: [encargado.id],
      preconditions: 'El Encargado debe estar autenticado en el sistema. La cantidad inicial disponible debe ser un número entero mayor o igual a cero.',
      postconditions: 'Herramienta registrada exitosamente en el catálogo del taller con nombre, categoría y cantidad disponible inicial.'
    },
    {
      code: 'RF-02',
      name: 'Consultar herramientas',
      description: 'Consultar herramientas. El Estudiante consulta el catálogo y la cantidad disponible de cada herramienta.',
      type: 'FUNCTIONAL',
      actorIds: [estudiante.id, encargado.id],
      preconditions: 'El usuario debe tener acceso al sistema con el catálogo del taller disponible.',
      postconditions: 'Catálogo de herramientas desplegado mostrando nombre, categoría y cantidad de unidades disponibles en tiempo real.'
    },
    {
      code: 'RF-03',
      name: 'Solicitar un préstamo',
      description: 'Solicitar un préstamo. El Estudiante selecciona una herramienta e indica el plazo solicitado en días. El sistema registra la solicitud como Pendiente si cumple las reglas de negocio.',
      type: 'FUNCTIONAL',
      actorIds: [estudiante.id],
      preconditions: 'El Estudiante debe estar autenticado; la herramienta debe tener cantidad disponible mayor a 0; el plazo solicitado debe ser de 1, 2 o 3 días; y el estudiante no debe registrar préstamos vencidos.',
      postconditions: 'Solicitud de préstamo registrada con estado Pendiente, asociada al estudiante, herramienta seleccionada y plazo solicitado.'
    },
    {
      code: 'RF-04',
      name: 'Resolver una solicitud',
      description: 'Resolver una solicitud. El Encargado consulta las solicitudes pendientes y puede aprobarlas o rechazarlas.',
      type: 'FUNCTIONAL',
      actorIds: [encargado.id],
      preconditions: 'El Encargado debe estar autenticado en el sistema y debe existir al menos una solicitud en estado Pendiente.',
      postconditions: 'Estado de la solicitud actualizado a Aprobada o Rechazada según la decisión del Encargado, quedando registrada la resolución.'
    },
    {
      code: 'RF-05',
      name: 'Registrar la entrega',
      description: 'Registrar la entrega. El Encargado confirma la entrega de una solicitud aprobada. El sistema registra la fecha y hora de entrega, calcula el vencimiento y descuenta una unidad disponible.',
      type: 'FUNCTIONAL',
      actorIds: [encargado.id],
      preconditions: 'La solicitud de préstamo debe encontrarse en estado Aprobada y la herramienta debe contar con existencia física para entrega.',
      postconditions: 'Fecha y hora de entrega registradas; fecha/hora límite de vencimiento calculada (24 horas por día de plazo); estado actualizado a Entregada y cantidad disponible descontada en una unidad.'
    },
    {
      code: 'RF-06',
      name: 'Registrar la devolución',
      description: 'Registrar la devolución. El Encargado registra la fecha y hora de devolución de un préstamo entregado o vencido. El sistema cambia su estado a Devuelta y suma una unidad disponible.',
      type: 'FUNCTIONAL',
      actorIds: [encargado.id],
      preconditions: 'El préstamo debe encontrarse en estado Entregado o Vencido y el Encargado debe verificar el retorno físico de la herramienta.',
      postconditions: 'Fecha y hora de devolución registradas; estado del préstamo actualizado a Devuelta; cantidad disponible de la herramienta incrementada en una unidad y estudiante rehabilitado si no registra otros vencidos.'
    },
    {
      code: 'RF-07',
      name: 'Consultar solicitudes propias',
      description: 'Consultar solicitudes propias. El Estudiante consulta el estado de cada una de sus solicitudes.',
      type: 'FUNCTIONAL',
      actorIds: [estudiante.id],
      preconditions: 'El Estudiante debe estar autenticado en el sistema.',
      postconditions: 'Listado de solicitudes del estudiante desplegado con herramienta, plazo y estado actual (Pendiente, Aprobada, Rechazada, Entregada, Devuelta o Vencida).'
    },
    {
      code: 'RF-08',
      name: 'Consultar préstamos vencidos',
      description: 'Consultar préstamos vencidos. El Encargado consulta los préstamos vencidos y ve el estudiante, la herramienta y la fecha y hora límite de devolución.',
      type: 'FUNCTIONAL',
      actorIds: [encargado.id],
      preconditions: 'El Encargado debe estar autenticado con permisos de supervisión del taller.',
      postconditions: 'Listado de préstamos cuya fecha y hora límite ha expirado sin registrar devolución, mostrando estudiante, herramienta retenida y fecha límite vencida.'
    },
    {
      code: 'RF-09',
      name: 'Iniciar sesión',
      description: 'Iniciar sesión. El Encargado y el Estudiante ingresan su correo institucional y contraseña para validar credenciales y acceder a sus funciones.',
      type: 'FUNCTIONAL',
      actorIds: [estudiante.id, encargado.id],
      preconditions: 'El usuario se encuentra en la pantalla de inicio de sesión con el sistema en ejecución.',
      postconditions: 'Credenciales validadas con JWT emitido; redirección al panel de Encargado o catálogo de Estudiante según su rol.'
    },
    {
      code: 'RF-11',
      name: 'Cerrar sesión',
      description: 'Cerrar sesión. El Encargado y el Estudiante pueden finalizar su sesión en el sistema en cualquier momento.',
      type: 'FUNCTIONAL',
      actorIds: [estudiante.id, encargado.id],
      preconditions: 'El usuario cuenta con una sesión activa en el sistema.',
      postconditions: 'Token JWT destruido del almacenamiento local y redirección a la pantalla de login.'
    },
    {
      code: 'RNF-01',
      name: 'Protección de credenciales',
      description: 'Protección de credenciales. El sistema almacena las contraseñas mediante algoritmo seguro de hash bcrypt con sal única.',
      type: 'NON_FUNCTIONAL',
      actorIds: [encargado.id],
      preconditions: 'Registro o actualización de credenciales de usuario.',
      postconditions: 'Contraseñas almacenadas exclusivamente en formato hash con salt rounds >= 10.'
    },
    {
      code: 'RNF-02',
      name: 'Control de acceso y roles',
      description: 'Control de acceso. El servidor verifica la sesión y el rol en cada operación protegida. El Estudiante solo puede ver y gestionar sus préstamos.',
      type: 'NON_FUNCTIONAL',
      actorIds: [estudiante.id, encargado.id],
      preconditions: 'Toda petición HTTP debe incluir un token de autorización válido en cabecera (Bearer JWT).',
      postconditions: 'Peticiones sin credenciales son rechazadas con 401 Unauthorized; acciones fuera del rol responden 403 Forbidden.'
    },
    {
      code: 'RNF-03',
      name: 'Tiempo de respuesta',
      description: 'Tiempo de respuesta. Las consultas de catálogo y estado de solicitudes responden en 2 segundos o menos bajo carga de 10 usuarios concurrentes.',
      type: 'NON_FUNCTIONAL',
      actorIds: [estudiante.id, encargado.id],
      preconditions: 'Servicio backend e infraestructura de base de datos activa.',
      postconditions: 'Respuesta ágil cumpliendo el umbral de 2 segundos en el 95% de peticiones.'
    },
    {
      code: 'RNF-04',
      name: 'Compatibilidad multiplataforma',
      description: 'Compatibilidad. Interfaz web adaptable a Chrome, Firefox y navegadores móviles a partir de 360px de ancho sin scroll horizontal.',
      type: 'NON_FUNCTIONAL',
      actorIds: [estudiante.id, encargado.id],
      preconditions: 'Navegador web con soporte estándar HTML5/CSS3.',
      postconditions: 'Diseño responsive verificado sin desbordamiento de pantalla.'
    }
  ];

  const reqMap = new Map();
  for (const item of requirementsData) {
    let req = await prisma.requirement.findFirst({ where: { projectId, code: item.code } });
    if (req) {
      req = await prisma.requirement.update({
        where: { id: req.id },
        data: {
          name: item.name,
          description: item.description,
          type: item.type,
          actorIds: item.actorIds,
          preconditions: item.preconditions,
          postconditions: item.postconditions,
          status: 'APPROVED',
          isDeleted: false
        }
      });
    } else {
      req = await prisma.requirement.create({
        data: {
          projectId,
          code: item.code,
          name: item.name,
          description: item.description,
          type: item.type,
          actorIds: item.actorIds,
          preconditions: item.preconditions,
          postconditions: item.postconditions,
          status: 'APPROVED',
          isDeleted: false
        }
      });
    }
    reqMap.set(item.code, req);
  }

  // 3. Casos de Uso formales
  await prisma.useCase.deleteMany({ where: { projectId } });

  const useCasesData = [
    {
      code: 'CU-01',
      name: 'Registrar Herramientas',
      description: 'El Encargado registra una nueva herramienta en el inventario indicando nombre, categoría y existencias iniciales.',
      primaryActorId: encargado.id,
      secondaryActorIds: [],
      preconditions: reqMap.get('RF-01')?.preconditions,
      postconditions: reqMap.get('RF-01')?.postconditions,
      requirementIds: [reqMap.get('RF-01')?.id].filter(Boolean),
      mainFlow: [
        { step: 1, action: 'El Encargado accede a la vista de gestión de herramientas.' },
        { step: 2, action: 'Ingresa nombre, categoría y cantidad disponible inicial.' },
        { step: 3, action: 'El sistema valida que la cantidad sea un entero >= 0.' },
        { step: 4, action: 'El sistema persiste la herramienta y actualiza el catálogo.' }
      ]
    },
    {
      code: 'CU-02',
      name: 'Consultar Catálogo de Herramientas',
      description: 'El Estudiante o Encargado visualiza las herramientas disponibles para solicitar en préstamo.',
      primaryActorId: estudiante.id,
      secondaryActorIds: [encargado.id],
      preconditions: reqMap.get('RF-02')?.preconditions,
      postconditions: reqMap.get('RF-02')?.postconditions,
      requirementIds: [reqMap.get('RF-02')?.id].filter(Boolean),
      mainFlow: [
        { step: 1, action: 'El usuario ingresa al catálogo del taller.' },
        { step: 2, action: 'El sistema consulta las herramientas activas y sus existencias.' },
        { step: 3, action: 'Se presenta la lista con nombre, categoría y cantidad disponible.' }
      ]
    },
    {
      code: 'CU-03',
      name: 'Solicitar Préstamo de Herramienta',
      description: 'El Estudiante solicita el préstamo de una unidad de herramienta indicando el plazo en días (1 a 3 días).',
      primaryActorId: estudiante.id,
      secondaryActorIds: [],
      preconditions: reqMap.get('RF-03')?.preconditions,
      postconditions: reqMap.get('RF-03')?.postconditions,
      requirementIds: [reqMap.get('RF-03')?.id].filter(Boolean),
      mainFlow: [
        { step: 1, action: 'El Estudiante selecciona una herramienta con stock disponible.' },
        { step: 2, action: 'Indica el plazo requerido (1, 2 o 3 días).' },
        { step: 3, action: 'El sistema comprueba que no tenga préstamos vencidos sin devolver.' },
        { step: 4, action: 'El sistema registra la solicitud en estado Pendiente.' }
      ]
    },
    {
      code: 'CU-04',
      name: 'Resolver Solicitud de Préstamo',
      description: 'El Encargado revisa las solicitudes pendientes y aprueba o rechaza cada una.',
      primaryActorId: encargado.id,
      secondaryActorIds: [],
      preconditions: reqMap.get('RF-04')?.preconditions,
      postconditions: reqMap.get('RF-04')?.postconditions,
      requirementIds: [reqMap.get('RF-04')?.id].filter(Boolean),
      mainFlow: [
        { step: 1, action: 'El Encargado abre la bandeja de solicitudes pendientes.' },
        { step: 2, action: 'Selecciona una solicitud y elige Aprobar o Rechazar.' },
        { step: 3, action: 'El sistema actualiza el estado y notifica la resolución.' }
      ]
    },
    {
      code: 'CU-05',
      name: 'Registrar Entrega de Herramienta',
      description: 'El Encargado hace entrega física de la herramienta aprobada, descuenta el stock y calcula el vencimiento.',
      primaryActorId: encargado.id,
      secondaryActorIds: [],
      preconditions: reqMap.get('RF-05')?.preconditions,
      postconditions: reqMap.get('RF-05')?.postconditions,
      requirementIds: [reqMap.get('RF-05')?.id].filter(Boolean),
      mainFlow: [
        { step: 1, action: 'El Encargado localiza la solicitud en estado Aprobada.' },
        { step: 2, action: 'Confirma la entrega física al estudiante.' },
        { step: 3, action: 'El sistema registra fecha/hora de entrega y calcula vencimiento.' },
        { step: 4, action: 'El sistema descuenta 1 unidad disponible en inventario.' }
      ]
    },
    {
      code: 'CU-06',
      name: 'Registrar Devolución de Herramienta',
      description: 'El Encargado recibe la herramienta prestada, finaliza el préstamo y repone la unidad al inventario.',
      primaryActorId: encargado.id,
      secondaryActorIds: [],
      preconditions: reqMap.get('RF-06')?.preconditions,
      postconditions: reqMap.get('RF-06')?.postconditions,
      requirementIds: [reqMap.get('RF-06')?.id].filter(Boolean),
      mainFlow: [
        { step: 1, action: 'El Encargado busca el préstamo por estudiante o herramienta.' },
        { step: 2, action: 'Registra la devolución verificando el buen estado.' },
        { step: 3, action: 'El sistema actualiza el préstamo a Devuelta.' },
        { step: 4, action: 'El sistema incrementa 1 unidad disponible en el inventario.' }
      ]
    },
    {
      code: 'CU-07',
      name: 'Consultar Solicitudes Propias',
      description: 'El Estudiante monitorea el estado y fechas de todas sus solicitudes de préstamo.',
      primaryActorId: estudiante.id,
      secondaryActorIds: [],
      preconditions: reqMap.get('RF-07')?.preconditions,
      postconditions: reqMap.get('RF-07')?.postconditions,
      requirementIds: [reqMap.get('RF-07')?.id].filter(Boolean),
      mainFlow: [
        { step: 1, action: 'El Estudiante ingresa a su historial personal.' },
        { step: 2, action: 'El sistema lista sus solicitudes con estado y fechas.' }
      ]
    },
    {
      code: 'CU-08',
      name: 'Consultar Préstamos Vencidos',
      description: 'El Encargado audita los préstamos cuya fecha límite expiró sin haberse devuelto.',
      primaryActorId: encargado.id,
      secondaryActorIds: [],
      preconditions: reqMap.get('RF-08')?.preconditions,
      postconditions: reqMap.get('RF-08')?.postconditions,
      requirementIds: [reqMap.get('RF-08')?.id].filter(Boolean),
      mainFlow: [
        { step: 1, action: 'El Encargado consulta la lista de vencimientos.' },
        { step: 2, action: 'El sistema filtra préstamos entregados con fecha límite rebasada.' },
        { step: 3, action: 'Muestra estudiante, herramienta y tiempo de demora.' }
      ]
    },
    {
      code: 'CU-09',
      name: 'Autenticación y Control de Sesión',
      description: 'Acceso seguro al sistema mediante credenciales con asignación de funciones por rol.',
      primaryActorId: encargado.id,
      secondaryActorIds: [estudiante.id],
      preconditions: reqMap.get('RF-09')?.preconditions,
      postconditions: reqMap.get('RF-09')?.postconditions,
      requirementIds: [reqMap.get('RF-09')?.id, reqMap.get('RF-11')?.id, reqMap.get('RNF-01')?.id, reqMap.get('RNF-02')?.id].filter(Boolean),
      mainFlow: [
        { step: 1, action: 'El usuario ingresa correo y contraseña.' },
        { step: 2, action: 'El sistema valida credenciales contra hash bcrypt.' },
        { step: 3, action: 'Se emite JWT y se redirecciona según el rol.' }
      ]
    }
  ];

  for (const uc of useCasesData) {
    await prisma.useCase.create({
      data: {
        projectId,
        code: uc.code,
        name: uc.name,
        description: uc.description,
        primaryActorId: uc.primaryActorId,
        secondaryActorIds: uc.secondaryActorIds,
        preconditions: uc.preconditions,
        postconditions: uc.postconditions,
        requirementIds: uc.requirementIds,
        mainFlow: uc.mainFlow,
        status: 'APPROVED',
        reviewStatus: 'APPROVED'
      }
    });
    console.log('Created UseCase:', uc.code, '|', uc.name);
  }

  // 4. Entidades y Modelo de Datos
  await prisma.entityRelationship.deleteMany({ where: { projectId } });
  await prisma.entityAttribute.deleteMany({ where: { entity: { projectId } } });
  await prisma.entity.deleteMany({ where: { projectId } });

  const entHerramienta = await prisma.entity.create({
    data: {
      projectId,
      codeId: 'ENT-01',
      name: 'Herramienta',
      description: 'Catálogo de herramientas disponibles en el taller técnico.',
      status: 'APPROVED',
      reviewStatus: 'APPROVED',
      requirementIds: [reqMap.get('RF-01')?.id, reqMap.get('RF-02')?.id].filter(Boolean),
      attributes: {
        create: [
          { name: 'id', type: 'Int', isPk: true, status: 'APPROVED' },
          { name: 'nombre', type: 'String', status: 'APPROVED' },
          { name: 'categoria', type: 'String', status: 'APPROVED' },
          { name: 'cantidadDisponible', type: 'Int', status: 'APPROVED' },
          { name: 'activo', type: 'Boolean', status: 'APPROVED' }
        ]
      }
    }
  });

  const entPrestamo = await prisma.entity.create({
    data: {
      projectId,
      codeId: 'ENT-02',
      name: 'Prestamo',
      description: 'Registro de solicitudes, entregas y devoluciones de herramientas.',
      status: 'APPROVED',
      reviewStatus: 'APPROVED',
      requirementIds: [reqMap.get('RF-03')?.id, reqMap.get('RF-04')?.id, reqMap.get('RF-05')?.id, reqMap.get('RF-06')?.id, reqMap.get('RF-07')?.id, reqMap.get('RF-08')?.id].filter(Boolean),
      attributes: {
        create: [
          { name: 'id', type: 'Int', isPk: true, status: 'APPROVED' },
          { name: 'estudianteId', type: 'Int', status: 'APPROVED' },
          { name: 'herramientaId', type: 'Int', status: 'APPROVED' },
          { name: 'plazoDias', type: 'Int', status: 'APPROVED' },
          { name: 'estado', type: 'String', status: 'APPROVED' },
          { name: 'fechaSolicitud', type: 'DateTime', status: 'APPROVED' },
          { name: 'fechaEntrega', type: 'DateTime', status: 'APPROVED' },
          { name: 'fechaVencimiento', type: 'DateTime', status: 'APPROVED' },
          { name: 'fechaDevolucion', type: 'DateTime', status: 'APPROVED' },
          { name: 'observaciones', type: 'String', status: 'APPROVED' }
        ]
      }
    }
  });

  const entUsuario = await prisma.entity.create({
    data: {
      projectId,
      codeId: 'ENT-03',
      name: 'Usuario',
      description: 'Cuentas de usuario con rol Encargado o Estudiante.',
      status: 'APPROVED',
      reviewStatus: 'APPROVED',
      requirementIds: [reqMap.get('RF-09')?.id, reqMap.get('RNF-01')?.id, reqMap.get('RNF-02')?.id].filter(Boolean),
      attributes: {
        create: [
          { name: 'id', type: 'Int', isPk: true, status: 'APPROVED' },
          { name: 'nombre', type: 'String', status: 'APPROVED' },
          { name: 'correo', type: 'String', status: 'APPROVED' },
          { name: 'contrasenaHash', type: 'String', status: 'APPROVED' },
          { name: 'rol', type: 'String', status: 'APPROVED' },
          { name: 'activo', type: 'Boolean', status: 'APPROVED' }
        ]
      }
    }
  });

  await prisma.entityRelationship.create({
    data: {
      projectId,
      codeId: 'REL-01',
      source: 'Usuario',
      target: 'Prestamo',
      cardinality: '1:N',
      description: 'Un estudiante realiza una o muchas solicitudes de préstamo.',
      status: 'APPROVED'
    }
  });

  await prisma.entityRelationship.create({
    data: {
      projectId,
      codeId: 'REL-02',
      source: 'Herramienta',
      target: 'Prestamo',
      cardinality: '1:N',
      description: 'Una herramienta puede registrarse en múltiples préstamos.',
      status: 'APPROVED'
    }
  });

  // 5. Pantallas y Mockups
  await prisma.screen.deleteMany({ where: { projectId } });

  const screensData = [
    {
      name: 'Inicio de Sesión',
      route: '/login',
      actorIds: [encargado.id, estudiante.id],
      description: 'Formulario de autenticación para Encargado y Estudiante.'
    },
    {
      name: 'Catálogo de Herramientas',
      route: '/herramientas',
      actorIds: [encargado.id, estudiante.id],
      description: 'Listado de herramientas con stock disponible y botón de préstamo.'
    },
    {
      name: 'Solicitud de Préstamo',
      route: '/solicitar',
      actorIds: [estudiante.id],
      description: 'Formulario para solicitar préstamo por plazo de 1 a 3 días.'
    },
    {
      name: 'Bandeja de Solicitudes',
      route: '/solicitudes',
      actorIds: [encargado.id],
      description: 'Gestión de solicitudes pendientes para aprobar o rechazar.'
    },
    {
      name: 'Entregas y Devoluciones',
      route: '/entregas',
      actorIds: [encargado.id],
      description: 'Control físico de entrega de herramientas y recepción con reposición de inventario.'
    },
    {
      name: 'Mis Solicitudes',
      route: '/mis-solicitudes',
      actorIds: [estudiante.id],
      description: 'Historial y estado de las solicitudes del estudiante.'
    },
    {
      name: 'Préstamos Vencidos',
      route: '/vencidos',
      actorIds: [encargado.id],
      description: 'Monitoreo de préstamos con fecha límite superada sin devolución.'
    }
  ];

  for (const s of screensData) {
    await prisma.screen.create({
      data: {
        projectId,
        name: s.name,
        route: s.route,
        actorIds: s.actorIds,
        description: s.description,
        status: 'APPROVED',
        reviewStatus: 'APPROVED',
        isDeleted: false
      }
    });
    console.log('Created Screen:', s.name, '->', s.route);
  }

  // 5b. Nodos de Navegación Aprobados
  await prisma.navigationNode.deleteMany({ where: { projectId } });
  for (const s of screensData) {
    await prisma.navigationNode.create({
      data: {
        projectId,
        name: s.name,
        route: s.route,
        platform: 'WEB',
        from: s.route === '/login' ? 'Root' : '/herramientas',
        to: s.route,
        action: 'Navegar',
        actorIds: s.actorIds,
        requirementIds: [],
        status: 'APPROVED',
        reviewStatus: 'APPROVED',
        revision: 1,
        isDeleted: false
      }
    });
    console.log('Created NavigationNode:', s.name, '->', s.route);
  }

  // 6. Diagramas Mermaid Pre-renderizados y Aprobados
  const useCaseMermaid = `flowchart LR
    subgraph Actores
      encargado["Encargado del Taller"]
      estudiante["Estudiante"]
    end
    subgraph Sistema["Sistema de Préstamo de Herramientas"]
      cu1(["CU-01: Registrar Herramientas"])
      cu2(["CU-02: Consultar Herramientas"])
      cu3(["CU-03: Solicitar Préstamo"])
      cu4(["CU-04: Resolver Solicitud"])
      cu5(["CU-05: Registrar Entrega"])
      cu6(["CU-06: Registrar Devolución"])
      cu7(["CU-07: Consultar Solicitudes Propias"])
      cu8(["CU-08: Consultar Préstamos Vencidos"])
      cu9(["CU-09: Iniciar Sesión"])
    end
    encargado --> cu1
    encargado --> cu2
    encargado --> cu4
    encargado --> cu5
    encargado --> cu6
    encargado --> cu8
    encargado --> cu9
    estudiante --> cu2
    estudiante --> cu3
    estudiante --> cu7
    estudiante --> cu9`;

  const erMermaid = `erDiagram
    USUARIO ||--o{ PRESTAMO : realiza
    HERRAMIENTA ||--o{ PRESTAMO : incluye
    USUARIO {
      int id PK
      string nombre
      string correo
      string contrasenaHash
      string rol
      boolean activo
    }
    HERRAMIENTA {
      int id PK
      string nombre
      string categoria
      int cantidadDisponible
      boolean activo
    }
    PRESTAMO {
      int id PK
      int estudianteId FK
      int herramientaId FK
      int plazoDias
      string estado
      datetime fechaSolicitud
      datetime fechaEntrega
      datetime fechaVencimiento
      datetime fechaDevolucion
      string observaciones
    }`;

  const navMermaid = `flowchart TD
    login["/login (Inicio de Sesión)"] -->|Rol Encargado| dashboard["/herramientas (Catálogo y Gestión)"]
    login -->|Rol Estudiante| catalogo["/herramientas (Catálogo Estudiante)"]
    catalogo --> solicitar["/solicitar (Solicitar Préstamo)"]
    catalogo --> misSol["/mis-solicitudes (Mis Solicitudes)"]
    dashboard --> solicitudes["/solicitudes (Bandeja de Solicitudes)"]
    solicitudes --> entregas["/entregas (Entregas y Devoluciones)"]
    dashboard --> vencidos["/vencidos (Préstamos Vencidos)"]`;

  const archMermaid = `flowchart TD
    subgraph Frontend["Frontend SPA (React + Vite)"]
      UI["Vistas por Rol (Encargado y Estudiante)"]
      State["Gestor de Estado y Contexto Auth"]
    end
    subgraph Backend["API REST (Node.js + Express)"]
      Auth["Middleware JWT y BCrypt"]
      Controllers["Controladores de Negocio (Herramientas, Préstamos)"]
      Rules["Reglas RN-01 a RN-05 (Stock atómico y vencimientos)"]
    end
    subgraph Persistencia["Base de Datos Relacional"]
      DB[("PostgreSQL 16")]
    end
    UI -->|Peticiones HTTP REST| Auth
    Auth --> Controllers
    Controllers --> Rules
    Rules -->|Sequelize ORM| DB`;

  const diagramsToStore = [
    { type: 'USE_CASE', name: 'USE_CASE', title: 'Diagrama de Casos de Uso', code: useCaseMermaid },
    { type: 'ER', name: 'ER', title: 'Diagrama Entidad-Relación', code: erMermaid },
    { type: 'NAVIGATION', name: 'NAVIGATION', title: 'Diagrama de Navegación', code: navMermaid },
    { type: 'ROBUSTNESS', name: 'ROBUSTNESS', title: 'Diagrama de Robustez / Arquitectura', code: archMermaid }
  ];

  for (const diag of diagramsToStore) {
    let art = await prisma.artifact.findFirst({
      where: { projectId, type: diag.type }
    });
    if (!art) {
      art = await prisma.artifact.create({
        data: {
          projectId,
          type: diag.type,
          name: diag.name,
          revision: 1,
          status: 'APPROVED'
        }
      });
    } else {
      await prisma.artifact.update({
        where: { id: art.id },
        data: { status: 'APPROVED' }
      });
    }

    const version = await prisma.artifactVersion.create({
      data: {
        artifactId: art.id,
        version: art.revision + 1,
        renderedContent: diag.code,
        structuredContent: { type: diag.type, title: diag.title },
        status: 'APPROVED',
        validationStatus: 'RENDERED'
      }
    });

    await prisma.artifact.update({
      where: { id: art.id },
      data: {
        revision: version.version,
        approvedVersionId: version.id,
        status: 'APPROVED'
      }
    });
    console.log('Saved Diagram Artifact:', diag.type);
  }

  // Marcar proyecto como APPROVED
  await prisma.project.update({
    where: { id: projectId },
    data: {
      status: 'APPROVED'
    }
  });

  console.log('FULL SETUP COMPLETED SUCCESSFULLY FOR WORKSHOP TOOL LOAN SYSTEM!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error in setup:', err);
  process.exit(1);
});
