const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/prisma');
const codegen = require('../src/services/codegen/codeGenerator.service');
const { buildProjectSpec } = require('../src/services/codegen/projectSpecBuilder');
const { createZipBuffer } = require('../src/services/codegen/zipHelper');

async function run() {
  const projectId = '6ba45264-e3e6-4819-a0dd-18909f1fb674';
  const spec = await buildProjectSpec(projectId);
  const result = await codegen.generateProjectFiles(projectId, { spec, reviewOnly: true });
  if (!result.files.length || !result.reviewOnly || result.ready) throw new Error('No se produjo una exportación de revisión válida');
  const root = path.resolve(__dirname, '../../.verification');
  fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, 'autron5-review-'));
  for (const file of result.files) {
    const target = path.resolve(directory, file.path);
    if (!target.startsWith(directory + path.sep)) throw new Error('Ruta de exportación inválida');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
  }
  const zip = directory + '.zip';
  fs.writeFileSync(zip, createZipBuffer(result.files));
  const report = { directory, zip, ready: false, reviewOnly: true, files: result.files.length, blockers: result.diagnostics.errors };
  fs.writeFileSync(path.join(root, 'autron5-last-export.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ directory, zip, ready: false, files: result.files.length, blockers: report.blockers.length }));
}

run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
