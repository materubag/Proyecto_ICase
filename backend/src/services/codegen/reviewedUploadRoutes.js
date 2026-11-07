// Copied only into exports with approved persistent private-file contracts.
const router = require('express').Router();
const fs = require('fs');
const { Op } = require('sequelize');
const models = require('../models');
const { authenticateToken } = require('../middleware/auth.middleware');
const { upload } = require('../middleware/upload.middleware');
const { signUpload, readUpload, resolveFile, detectImage } = require('../services/upload.storage');
const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });

async function authorizeDiagnostic(user, diagnosticId) {
  if ((user.role || user.rol) !== 'Mecánico') throw fail(403, 'Mecánico requerido');
  const diagnostic = await models.DIAGNOSTICO.findByPk(diagnosticId);
  if (!diagnostic) throw fail(404, 'Diagnóstico no encontrado');
  const quotes = await models.COTIZACION.findAll({ where: { diagnosticoId: diagnostic.id } });
  const orders = await models.ORDENTRABAJO.findAll({ where: { cotizacionId: { [Op.in]: quotes.map(row => row.id) } } });
  const assigned = await models.ORDENMECANICO.findOne({ where: { ordenTrabajoId: { [Op.in]: orders.map(row => row.id) }, usuarioId: user.id } });
  if (!assigned) throw fail(403, 'Mecánico no asignado al diagnóstico');
}

router.use(authenticateToken);
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) throw fail(400, 'Seleccione una fotografía');
    const diagnosticId = req.body.diagnosticoId === undefined ? null : Number(req.body.diagnosticoId);
    if (diagnosticId !== null) {
      if (!Number.isSafeInteger(diagnosticId) || diagnosticId < 1) throw fail(400, 'Diagnóstico inválido');
      await authorizeDiagnostic(req.user, diagnosticId);
    } else if ((req.user.role || req.user.rol) !== 'Recepción') throw fail(403, 'Recepción requerida');
    const mime = detectImage(fs.readFileSync(req.file.path));
    if (!['image/png', 'image/jpeg'].includes(mime)) throw fail(415, 'Se admiten fotografías JPEG o PNG');
    const token = signUpload(req.file, req.user, { diagnosticoId: diagnosticId });
    const metadata = readUpload(token, req.user);
    await models.ARCHIVOPRIVADO.create({ archivoId: metadata.archivoId, usuarioId: req.user.id, diagnosticoId: diagnosticId, filename: req.file.filename, formatoMime: metadata.formatoMime, pesoBytes: metadata.pesoBytes });
    res.status(201).json({ success: true, token, archivoId: metadata.archivoId });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(error.statusCode || 400).json({ success: false, message: error.message });
  }
});
router.get('/files/:filename', async (req, res) => {
  try {
    const file = await models.ARCHIVOPRIVADO.findOne({ where: { filename: req.params.filename } });
    if (!file) throw fail(404, 'Archivo no encontrado');
    if (file.diagnosticoId) await authorizeDiagnostic(req.user, file.diagnosticoId);
    else if (String(file.usuarioId) !== String(req.user.id) || (req.user.role || req.user.rol) !== 'Recepción') throw fail(404, 'Archivo no encontrado');
    const filename = resolveFile(file.filename);
    res.type(file.formatoMime).set('Cache-Control', 'private, no-store').set('X-Content-Type-Options', 'nosniff').sendFile(filename);
  } catch (error) { res.status(error.statusCode || 404).json({ success: false, message: error.message }); }
});
module.exports = router;
