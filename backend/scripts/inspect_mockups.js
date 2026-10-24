const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectProject() {
  const projectId = 'a40f13c9-3b2c-435b-90a9-90a4f5dfea66';
  
  const artifacts = await prisma.artifact.findMany({
    where: { projectId },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1
      }
    }
  });

  console.log('ARTIFACTS FOUND:');
  artifacts.forEach(a => console.log(`- [${a.type}] ${a.name} (id: ${a.id})`));

  for (const a of artifacts) {
    const v = a.versions[0];
    const text = (v?.renderedContent || v?.content || '');
    if (a.type.toLowerCase().includes('mockup') || a.name.toLowerCase().includes('mockup') || a.name.toLowerCase().includes('nav') || a.type.toLowerCase().includes('nav')) {
      console.log(`\n=================== ARTIFACT: ${a.name} (${a.type}) ===================`);
      console.log('Length:', text.length);
      console.log(text.substring(0, 1000));
    }
  }

  const reqs = await prisma.requirement.findMany({
    where: { projectId },
    take: 10
  });
  console.log('\nREQUIREMENTS (sample 10):', reqs.map(r => `${r.code}: ${r.name} (${r.category})`));
}

inspectProject()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
