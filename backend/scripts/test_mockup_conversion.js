const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { convertHtmlToJsx } = require('./src/services/codegen/mockupConverter');

async function testAll() {
  const artifacts = await prisma.artifact.findMany({
    where: { projectId: 'a40f13c9-3b2c-435b-90a9-90a4f5dfea66', type: 'MOCKUP' },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
  });

  console.log(`Testing conversion for ${artifacts.length} mockups...`);

  for (const a of artifacts) {
    const v = a.versions[0];
    const s = v?.structuredContent?.screen;
    if (!s?.htmlUrl) continue;

    const res = await fetch(s.htmlUrl);
    const html = await res.text();
    const cleanJsx = convertHtmlToJsx(html, s.name, s.route);
    console.log(`[OK] ${s.name} (${s.route}) -> JSX len: ${cleanJsx.length}`);
  }

  console.log('ALL MOCKUPS CONVERTED SUCCESSFULLY!');
}

testAll().finally(() => prisma.$disconnect());
