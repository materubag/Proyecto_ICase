const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectAllMockups() {
  const projectId = 'a40f13c9-3b2c-435b-90a9-90a4f5dfea66';
  const artifacts = await prisma.artifact.findMany({
    where: { projectId, type: 'MOCKUP' },
    include: { versions: { take: 1, orderBy: { version: 'desc' } } }
  });

  console.log(`Found ${artifacts.length} mockup artifacts:`);
  artifacts.forEach((a, i) => {
    const v = a.versions[0];
    const meta = v?.metadata || {};
    const hasContent = Boolean(v?.content || v?.renderedContent);
    const contentLen = (v?.content || v?.renderedContent || '').length;
    console.log(`${i + 1}. Artifact: ${a.name} | screen: ${JSON.stringify(meta.screen || {})} | contentLen: ${contentLen}`);
    if (contentLen > 0) {
      console.log('   Preview:', (v.content || v.renderedContent).substring(0, 150));
    }
  });
}

inspectAllMockups().catch(console.error).finally(() => prisma.$disconnect());
