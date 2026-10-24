const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectStructuredMockups() {
  const projectId = 'a40f13c9-3b2c-435b-90a9-90a4f5dfea66';
  const artifacts = await prisma.artifact.findMany({
    where: { projectId, type: 'MOCKUP' },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
  });

  console.log(`Artifacts with structured content:`);
  for (const a of artifacts) {
    const v = a.versions[0];
    const s = v?.structuredContent?.screen;
    if (s) {
      console.log(`\n=============================`);
      console.log(`SCREEN: ${s.name} (route: ${s.route})`);
      console.log(`Description: ${s.description || 'N/A'}`);
      console.log(`Components: ${(s.components || []).length}`);
      (s.components || []).slice(0, 5).forEach((c, idx) => {
        console.log(`   [${c.type}] ${c.label || c.name || ''} | meta/props:`, JSON.stringify(c.meta || c.props || {}));
      });
    } else {
      console.log(`Artifact ${a.name} has NO structuredContent.screen. structuredContent keys:`, Object.keys(v?.structuredContent || {}));
    }
  }
}

inspectStructuredMockups().catch(console.error).finally(() => prisma.$disconnect());
