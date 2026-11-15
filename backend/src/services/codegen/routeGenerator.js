/**
 * Route Generator for Express
 * Generates entity routes and the master router index.js using consistent endpoint paths,
 * with optional JWT route protection.
 */

const { toPascalCase, toCamelCase, deriveNaming } = require('./typeMapper');
const mutates = (steps, model) => (steps || []).some(step =>
  (step.entity === model && ['CREATE', 'UPDATE', 'DELETE'].includes(step.action)) || mutates(step.steps, model));

function generateEntityRoutesFile(entity, options = {}) {
  const naming = deriveNaming(entity.name);
  const modelName = entity.modelName || naming.modelName;
  const varName = naming.paramName;
  const hasAuth = !!options.hasAuth;

  const authImport = hasAuth ? "const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');\n" : "";
  const mid = hasAuth ? "authenticateToken, " : "";
  const defaultRoles = ['Administrador', 'Recepción', 'Mecánico', 'Cliente'];

  const isAudit = /auditoria/i.test(modelName);
  const isInventoryMove = /movimientoinventario/i.test(modelName);
  const isUserOrRole = /usuario|rol\b/i.test(modelName);
  const isSensitiveEntity = /movimientoinventario|proveedor|compra|venta/i.test(modelName);
  const isCatalog = /producto|inventario|alerta/i.test(modelName);
  const isWorkshop = /diagnostico|falla|ordentrabajo|recepcion|mantenimiento|obd|evidencia|zona/i.test(modelName);
  const isCustomerFacing = /cita|vehiculo|cotizacion|aviso/i.test(modelName);

  const permission = (method, item = false) => {
    const op = (options.operations || []).find(o => o.entity === modelName && o.method === method && !o.route.includes('/operations/') && (o.route.includes(':') === item));

    let roles = (op?.authorizedRoles && op.authorizedRoles.length > 0) ? [...op.authorizedRoles] : [];
    if (!roles.length) {
      if (isAudit || isUserOrRole) roles = ['Administrador'];
      else if (isInventoryMove || isSensitiveEntity) roles = ['Administrador', 'Recepción'];
      else if (isCatalog) roles = method === 'GET' ? ['Administrador', 'Recepción', 'Mecánico'] : ['Administrador', 'Recepción'];
      else if (isWorkshop) roles = ['Administrador', 'Recepción', 'Mecánico'];
      else if (isCustomerFacing) roles = method === 'GET' ? ['Administrador', 'Recepción', 'Cliente'] : ['Administrador', 'Recepción'];
      else roles = ['Administrador', 'Recepción'];
    }
    // Normalizar 'Recepcionista' a 'Recepción'
    roles = roles.map(r => r === 'Recepcionista' ? 'Recepción' : r);
    if (isAudit || isUserOrRole) roles = ['Administrador'];
    // Least privilege: Clientes y Mecánicos no acceden a entidades financieras o proveedor
    if (isSensitiveEntity || isInventoryMove) {
      roles = roles.filter(r => r !== 'Cliente' && r !== 'Mecánico');
    }
    // Mecánico no muta catálogo de productos ni proveedores
    if (['POST', 'PUT', 'DELETE'].includes(method) && isCatalog) {
      roles = roles.filter(r => r !== 'Mecánico');
    }
    if (!roles.length) roles = ['Administrador'];

    const safeOp = op ? {
      ...op,
      authorizedRoles: roles,
      permissionSource: 'RESOLVED_RBAC'
    } : {
      entity: modelName,
      method,
      authorizedRoles: roles,
      permissionSource: 'RESOLVED_RBAC'
    };

    const contract = '(req, res, next) => { req.crudContract = ' + JSON.stringify(safeOp) + '; next(); }, ';
    if (!hasAuth) return contract;

    return mid + 'authorizeRoles(' + roles.map(r => `'${r}'`).join(', ') + '), ' + contract;
  };

  let routeLines = `router.get('/', ${permission('GET')}${varName}Controller.getAll);\nrouter.get('/:id', ${permission('GET', true)}${varName}Controller.getById);\n`;
  if (!isAudit) {
    routeLines += `router.post('/', ${permission('POST')}${varName}Controller.create);\n`;
  }
  if (!isAudit && !isInventoryMove) {
    routeLines += `router.put('/:id', ${permission('PUT', true)}${varName}Controller.update);\n`;
    routeLines += `router.delete('/:id', ${permission('DELETE', true)}${varName}Controller.delete);\n`;
  }

  return `/**
 * Rutas REST para ${modelName}
 * Generado automáticamente por ICASE Studio
 */

const express = require('express');
const router = express.Router();
const ${varName}Controller = require('../controllers/${varName}.controller');
${authImport}
${routeLines}
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

function generateUploadRoutesFile(options = {}) {
  if (options.privateUploads) return `const router = require('express').Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');
const { signUpload, resolveFile, detectImage } = require('../services/upload.storage');
router.use(authenticateToken, authorizeRoles(...${JSON.stringify(options.roles || [])}));
router.post('/', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Seleccione un archivo' });
    return res.status(201).json({ success: true, token: signUpload(req.file, req.user) });
  } catch (err) { return res.status(err.statusCode || 400).json({ success: false, message: err.message }); }
});
router.get('/files/:filename', (req, res) => {
  try { const filename = resolveFile(req.params.filename); const mime = detectImage(require('fs').readFileSync(filename)); if (!mime) return res.sendStatus(415); res.type(mime).set('X-Content-Type-Options', 'nosniff').sendFile(filename); } catch (err) { res.status(err.statusCode || 404).json({ message: err.message }); }
});
module.exports = router;
`;
  return `/**
 * Rutas de Carga de Archivos e Imágenes
 * Generado automáticamente por ICASE Studio
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');

router.post('/', authenticateToken, authorizeRoles('Administrador', 'Recepción', 'Mecánico'), upload.single('file'), (req, res) => {
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
