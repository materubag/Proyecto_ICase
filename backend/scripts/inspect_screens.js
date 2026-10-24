const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectScreens() {
  const projectId = 'a40f13c9-3b2c-435b-90a9-90a4f5dfea66';
  const screens = await prisma.screen.findMany({
    where: { projectId, isDeleted: false },
    include: { components: { orderBy: { order: 'asc' } } },
    orderBy: { route: 'asc' }
  });
  console.log('TOTAL SCREENS:', screens.length);
  for (const s of screens) {
    console.log(`\nScreen: ${s.name} | Route: ${s.route} | Desc: ${s.description || 'N/A'}`);
    console.log(`Components (${s.components.length}):`);
    for (const c of s.components) {
      console.log(`  - [${c.type}] ${c.name} (order: ${c.order})`);
      console.log(`    props:`, JSON.stringify(c.props));
    }
  }
}

inspectScreens()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
