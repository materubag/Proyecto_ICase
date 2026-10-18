function reject(message = 'Solo se permiten archivos PDF (.pdf).') {
  return Object.assign(new Error(message), { statusCode: 415, code: 'PDF_REQUIRED' });
}
function validate(file) {
  if (!file || typeof file.originalname!=='string'||typeof (file.mimetype||'')!=='string'||!/\.pdf$/i.test(file.originalname || '') ||
      !['', 'application/pdf', 'application/octet-stream'].includes((file.mimetype || '').toLowerCase())) throw reject();
  return file;
}
function fileFilter(req, file, cb) {
  try { validate(file); cb(null, true); } catch (error) { cb(error); }
}
function validateBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw reject('El contenido del archivo no corresponde a un PDF.');
}
function pdfOnly(req, res, next) { next(reject()); }
module.exports = { validate, validateBuffer, fileFilter, pdfOnly };
