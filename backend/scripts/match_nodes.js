const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkIds() {
  const projectId = 'a40f13c9-3b2c-435b-90a9-90a4f5dfea66';
  const navNodes = await prisma.navigationNode.findMany({ where: { projectId } });
  console.log('NavNodes count:', navNodes.length);
  navNodes.forEach(n => console.log(`NavNode: ${n.id} | ${n.label || n.name} | ${n.route}`));

  const artifacts = await prisma.artifact.findMany({ where: { projectId, type: 'MOCKUP' } });
  const matched = artifacts.map(a => {
    const node = navNodes.find(n => n.id === a.name);
    return { artifactName: a.name, matchedNode: node ? `${node.label || node.name} (${node.route})` : 'none' };
  });
  console.log('Artifacts to NavNodes matching:', matched);
}

checkIds().catch(console.error).finally(() => prisma.$disconnect());
