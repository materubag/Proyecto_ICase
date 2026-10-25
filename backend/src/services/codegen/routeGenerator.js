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
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de almacenamiento para evidencias multimedia (RF-12)
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, \`\${Date.now()}-\${base}\${ext}\`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }
});

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

// Endpoint para subida física de fotografías y evidencias multimedia (RF-12)
router.post('/upload', upload.single('archivo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No se envió ningún archivo para almacenar' });
  }
  return res.status(201).json({
    success: true,
    message: 'Archivo almacenado con éxito',
    data: {
      url: \`/uploads/\${req.file.filename}\`,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    }
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
