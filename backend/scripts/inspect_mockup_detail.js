const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectArtifacts() {
  const mockup = await prisma.artifact.findFirst({
    where: { type: 'MOCKUP' },
    include: { versions: true }
  });
  console.log('Mockup artifact:', JSON.stringify(mockup, null, 2));
}

inspectArtifacts().catch(console.error).finally(() => prisma.$disconnect());
