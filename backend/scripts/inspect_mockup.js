const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const a = await prisma.artifact.findFirst({
    where: { projectId: 'a40f13c9-3b2c-435b-90a9-90a4f5dfea66', type: 'MOCKUP' },
    include: { versions: true }
  });
  const s = a.versions[0]?.structuredContent?.screen;
  const res = await fetch(s.htmlUrl);
  const text = await res.text();
  const match = text.match(/<script id="tailwind-config">([\s\S]*?)<\/script>/i);
  console.log('=== TAILWIND CONFIG ===');
  console.log(match ? match[1].trim() : 'none');

  const styleMatch = text.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  console.log('=== CUSTOM STYLE ===');
  console.log(styleMatch ? styleMatch[1].trim().substring(0, 1000) : 'none');
}

run().finally(() => prisma.$disconnect());
