'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const projectId = '548804a3-4620-4e92-aca9-fac3172db604';

async function main() {
  console.log('Cleaning up duplicate/bloated entities for project:', projectId);

  const cleanEntityNames = ['Herramienta', 'Prestamo', 'Usuario'];

  // 1. Delete relationships that reference entities other than the clean ones
  const deletedRels = await prisma.entityRelationship.deleteMany({
    where: {
      projectId,
      OR: [
        { source: { notIn: cleanEntityNames } },
        { target: { notIn: cleanEntityNames } }
      ]
    }
  });
  console.log('Deleted obsolete relationships:', deletedRels.count);

  // 2. Delete attributes of entities other than the clean ones
  const deletedAttrs = await prisma.entityAttribute.deleteMany({
    where: {
      entity: {
        projectId,
        name: { notIn: cleanEntityNames }
      }
    }
  });
  console.log('Deleted obsolete attributes:', deletedAttrs.count);

  // 3. Delete entities other than the clean ones
  const deletedEnts = await prisma.entity.deleteMany({
    where: {
      projectId,
      name: { notIn: cleanEntityNames }
    }
  });
  console.log('Deleted obsolete entities:', deletedEnts.count);

  // 4. Ensure clean relationships exist
  const rels = await prisma.entityRelationship.findMany({ where: { projectId } });
  const hasUserPrestamo = rels.some(r => r.source === 'Usuario' && r.target === 'Prestamo');
  const hasToolPrestamo = rels.some(r => r.source === 'Herramienta' && r.target === 'Prestamo');

  if (!hasUserPrestamo) {
    await prisma.entityRelationship.create({
      data: {
        projectId,
        codeId: 'REL-01',
        source: 'Usuario',
        target: 'Prestamo',
        cardinality: '1:N',
        description: 'Un usuario (estudiante) puede registrar una o múltiples solicitudes de préstamo.',
        status: 'APPROVED'
      }
    });
    console.log('Created relationship Usuario -> Prestamo');
  }

  if (!hasToolPrestamo) {
    await prisma.entityRelationship.create({
      data: {
        projectId,
        codeId: 'REL-02',
        source: 'Herramienta',
        target: 'Prestamo',
        cardinality: '1:N',
        description: 'Una herramienta puede ser prestada en múltiples préstamos.',
        status: 'APPROVED'
      }
    });
    console.log('Created relationship Herramienta -> Prestamo');
  }

  console.log('Cleanup finished successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
