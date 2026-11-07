const prisma = require('../src/config/prisma');
const stitch = require('../src/services/mockup/GoogleStitchService');

const PROJECT_ID = process.argv[2] || '6ba45264-e3e6-4819-a0dd-18909f1fb674';

async function run() {
  const artifacts = await prisma.artifact.findMany({
    where: { projectId: PROJECT_ID, type: 'MOCKUP' },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
  });

  for (const artifact of artifacts) {
    const version = artifact.versions[0];
    const content = version?.structuredContent;
    const screen = content?.screen;
    if (!screen?.htmlUrl) {
      console.log('skip-no-url', artifact.name);
      continue;
    }
    const html = await stitch.downloadStitchHtml(screen.htmlUrl);
    if (!html || html.length < 8000) {
      console.log('fail', screen.name || artifact.name, html && html.length);
      continue;
    }
    await prisma.artifactVersion.update({
      where: { id: version.id },
      data: { structuredContent: { ...content, screen: { ...screen, html } } }
    });
    console.log('ok', screen.name || artifact.name, html.length);
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
