'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const projectId = '548804a3-4620-4e92-aca9-fac3172db604';

async function main() {
  console.log(`Seeding NavigationNodes for project ${projectId}...`);

  const actors = await prisma.actor.findMany({ where: { projectId } });
  const estudiante = actors.find(a => /estudiante/i.test(a.name));
  const encargado = actors.find(a => /encargado/i.test(a.name));

  if (!estudiante || !encargado) {
    throw new Error('Actors Estudiante or Encargado not found!');
  }

  const reqs = await prisma.requirement.findMany({ where: { projectId } });
  const reqMap = new Map();
  reqs.forEach(r => reqMap.set(r.code, r.id));

  const nodesData = [
    {
      name: 'Inicio de Sesión',
      route: '/login',
      platform: 'WEB',
      from: 'Root',
      to: '/login',
      action: 'Autenticar',
      actorIds: [encargado.id, estudiante.id],
      requirementIds: [reqMap.get('RF-09'), reqMap.get('RF-11')].filter(Boolean),
      status: 'APPROVED',
      reviewStatus: 'APPROVED'
    },
    {
      name: 'Catálogo de Herramientas',
      route: '/herramientas',
      platform: 'WEB',
      from: '/login',
      to: '/herramientas',
      action: 'Consultar Catálogo',
      actorIds: [encargado.id, estudiante.id],
      requirementIds: [reqMap.get('RF-01'), reqMap.get('RF-02')].filter(Boolean),
      status: 'APPROVED',
      reviewStatus: 'APPROVED'
    },
    {
      name: 'Solicitud de Préstamo',
      route: '/solicitar',
      platform: 'WEB',
      from: '/herramientas',
      to: '/solicitar',
      action: 'Solicitar Préstamo',
      actorIds: [estudiante.id],
      requirementIds: [reqMap.get('RF-03')].filter(Boolean),
      status: 'APPROVED',
      reviewStatus: 'APPROVED'
    },
    {
      name: 'Bandeja de Solicitudes',
      route: '/solicitudes',
      platform: 'WEB',
      from: '/herramientas',
      to: '/solicitudes',
      action: 'Resolver Solicitudes',
      actorIds: [encargado.id],
      requirementIds: [reqMap.get('RF-04')].filter(Boolean),
      status: 'APPROVED',
      reviewStatus: 'APPROVED'
    },
    {
      name: 'Entregas y Devoluciones',
      route: '/entregas',
      platform: 'WEB',
      from: '/solicitudes',
      to: '/entregas',
      action: 'Registrar Entrega y Devolución',
      actorIds: [encargado.id],
      requirementIds: [reqMap.get('RF-05'), reqMap.get('RF-06')].filter(Boolean),
      status: 'APPROVED',
      reviewStatus: 'APPROVED'
    },
    {
      name: 'Mis Solicitudes',
      route: '/mis-solicitudes',
      platform: 'WEB',
      from: '/herramientas',
      to: '/mis-solicitudes',
      action: 'Consultar Solicitudes Propias',
      actorIds: [estudiante.id],
      requirementIds: [reqMap.get('RF-07')].filter(Boolean),
      status: 'APPROVED',
      reviewStatus: 'APPROVED'
    },
    {
      name: 'Préstamos Vencidos',
      route: '/vencidos',
      platform: 'WEB',
      from: '/herramientas',
      to: '/vencidos',
      action: 'Consultar Préstamos Vencidos',
      actorIds: [encargado.id],
      requirementIds: [reqMap.get('RF-08')].filter(Boolean),
      status: 'APPROVED',
      reviewStatus: 'APPROVED'
    }
  ];

  await prisma.navigationNode.deleteMany({ where: { projectId } });

  for (const n of nodesData) {
    const created = await prisma.navigationNode.create({
      data: {
        projectId,
        name: n.name,
        route: n.route,
        platform: n.platform,
        from: n.from,
        to: n.to,
        action: n.action,
        actorIds: n.actorIds,
        requirementIds: n.requirementIds,
        status: n.status,
        reviewStatus: n.reviewStatus,
        revision: 1,
        isDeleted: false
      }
    });
    console.log(`Created NavigationNode: ${created.name} (${created.route}) -> ID: ${created.id}`);
  }

  // Also verify screen components or screens have their status APPROVED
  await prisma.screen.updateMany({
    where: { projectId },
    data: { status: 'APPROVED', reviewStatus: 'APPROVED' }
  });

  console.log('Successfully created all 7 NavigationNodes for Workshop project!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
