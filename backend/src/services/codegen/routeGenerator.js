/**
 * Route Generator for Express
 * Generates entity routes and the master router index.js using consistent endpoint paths,
 * with optional JWT route protection.
 */

const { toPascalCase, toCamelCase, deriveNaming } = require('./typeMapper');

function generateEntityRoutesFile(entity, options = {}) {
  const naming = deriveNaming(entity.name);
  const modelName = naming.modelName;
  const varName = naming.paramName;
  const hasAuth = !!options.hasAuth;

  const authImport = hasAuth ? "const { authenticateToken } = require('../middleware/auth.middleware');\n" : "";
  const mid = hasAuth ? "authenticateToken, " : "";

  return `/**
 * Rutas REST para ${modelName}
 * Generado automáticamente por ICASE Studio
 */

const express = require('express');
const router = express.Router();
const ${varName}Controller = require('../controllers/${varName}.controller');
${authImport}
router.get('/', ${mid}${varName}Controller.getAll);
router.get('/:id', ${mid}${varName}Controller.getById);
router.post('/', ${mid}${varName}Controller.create);
router.put('/:id', ${mid}${varName}Controller.update);
router.delete('/:id', ${mid}${varName}Controller.delete);

module.exports = router;
`;
}

function generateUploadMiddlewareFile() {
  return `/**
 * Middleware para Carga y Almacenamiento de Archivos e Imágenes (Multer)
 * Generado automáticamente por ICASE Studio
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const cleanBase = path.basename(file.originalname || 'archivo', ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, \`\${cleanBase}_\${uniqueSuffix}\${ext}\`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10 MB
});

module.exports = { upload };
`;
}

function generateUploadRoutesFile() {
  return `/**
 * Rutas de Carga de Archivos e Imágenes
 * Generado automáticamente por ICASE Studio
 */

const express = require('express');
const router = express.Router();
const { upload } = require('../middleware/upload.middleware');

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No se subió ningún archivo' });
  }
  const fileUrl = \`/uploads/\${req.file.filename}\`;
  res.status(201).json({
    success: true,
    url: fileUrl,
    filename: req.file.filename,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
});

module.exports = router;
`;
}

function generateMasterRoutesIndexFile(entities = [], options = {}) {
  const imports = [];
  const mounts = [];

  if (options.hasAuth) {
    imports.push("const authRoutes = require('./auth.routes');");
    mounts.push("router.use('/auth', authRoutes);");
  }

  // Upload router for images and files
  imports.push("const uploadRoutes = require('./upload.routes');");
  mounts.push("router.use('/upload', uploadRoutes);");

  for (const entity of entities) {
    const naming = deriveNaming(entity.name);
    const varName = naming.paramName;
    const endpoint = naming.endpoint;
    imports.push(`const ${varName}Routes = require('./${varName}.routes');`);
    mounts.push(`router.use('/${endpoint}', ${varName}Routes);`);
  }

  if (options.hasOperations) {
    imports.push("const operationRoutes = require('./operation.routes');");
    mounts.push("router.use('/operations', operationRoutes);");
  }

  return `/**
 * Enrutador Central de la API
 * Generado automáticamente por ICASE Studio
 */

const express = require('express');
const router = express.Router();

// Importación de rutas por entidad y seguridad
${imports.join('\n')}

// Healthcheck de la API
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Montaje de rutas de autenticación, entidades y operaciones
${mounts.join('\n')}

module.exports = router;
`;
}

module.exports = {
  generateEntityRoutesFile,
  generateMasterRoutesIndexFile,
  generateUploadMiddlewareFile,
  generateUploadRoutesFile
};
