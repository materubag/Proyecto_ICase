const fs = require('fs');
const path = require('path');
const codeGeneratorService = require('./services/codegen/codeGenerator.service');

async function run() {
  const projectId = '6ba45264-e3e6-4819-a0dd-18909f1fb674';
  console.log('Iniciando generación de archivos para proyecto:', projectId);
  const result = await codeGeneratorService.generateProjectFiles(projectId, { includeDocker: true });
  console.log(`Generación completada: ${result.files.length} archivos.`);

  const exportDir = '/usr/src/app/dist_export';
  for (const file of result.files) {
    const fullPath = path.join(exportDir, file.path);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, file.content, 'utf8');
  }
  console.log('Archivos escritos exitosamente en:', exportDir);
}

run().catch(err => {
  console.error('Error generando proyecto:', err);
  process.exit(1);
});

