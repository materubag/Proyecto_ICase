/**
 * Route Generator for Express
 * Generates entity routes and the master router index.js
 */

const { toPascalCase, toCamelCase, toSnakeCasePlural } = require('./typeMapper');

function generateEntityRoutesFile(entity) {
  const modelName = toPascalCase(entity.name);
  const varName = toCamelCase(entity.name);

  return `/**
 * Rutas REST para ${modelName}
 * Generado automáticamente por ICASE Studio
 */

const express = require('express');
const router = express.Router();
const ${varName}Controller = require('../controllers/${varName}.controller');

router.get('/', ${varName}Controller.getAll);
router.get('/:id', ${varName}Controller.getById);
router.post('/', ${varName}Controller.create);
router.put('/:id', ${varName}Controller.update);
router.delete('/:id', ${varName}Controller.delete);

module.exports = router;
`;
}

function generateMasterRoutesIndexFile(entities = []) {
  const imports = [];
  const mounts = [];

  for (const entity of entities) {
    const varName = toCamelCase(entity.name);
    const pluralRoute = toSnakeCasePlural(entity.name);
    imports.push(`const ${varName}Routes = require('./${varName}.routes');`);
    mounts.push(`router.use('/${pluralRoute}', ${varName}Routes);`);
  }

  return `/**
 * Enrutador Central de la API
 * Generado automáticamente por ICASE Studio
 */

const express = require('express');
const router = express.Router();

// Importación de rutas por entidad
${imports.join('\n')}

// Healthcheck de la API
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Montaje de rutas de entidades
${mounts.join('\n')}

module.exports = router;
`;
}

module.exports = {
  generateEntityRoutesFile,
  generateMasterRoutesIndexFile
};
