const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const root = path.resolve(__dirname, '../../uploads');

function resolveFile(filename) {
  if (typeof filename !== 'string' || filename !== path.basename(filename)) throw Object.assign(new Error('Archivo inválido'), { statusCode: 400 });
  return path.join(root, filename);
}

function detectImage(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function signUpload(file, user) {
  const bytes = fs.readFileSync(file.path);
  const formatoMime = detectImage(bytes);
  if (!formatoMime) {
    fs.unlinkSync(file.path);
    throw Object.assign(new Error('Se requiere una fotografía PNG, JPEG o WebP'), { statusCode: 415 });
  }
  return jwt.sign({ purpose: 'icase-upload', ownerId: user.id, filename: file.filename, pesoBytes: bytes.length, formatoMime }, process.env.JWT_SECRET, { expiresIn: '8h' });
}

function readUpload(token, user) {
  let upload;
  try { upload = jwt.verify(token, process.env.JWT_SECRET); }
  catch { throw Object.assign(new Error('Carga inválida o vencida'), { statusCode: 422, code: 'INVALID_UPLOAD' }); }
  if (upload.purpose !== 'icase-upload' || String(upload.ownerId) !== String(user?.id)) throw Object.assign(new Error('La carga no pertenece al usuario autenticado'), { statusCode: 403 });
  const filename = resolveFile(upload.filename);
  if (!fs.existsSync(filename) || fs.statSync(filename).size !== upload.pesoBytes) throw Object.assign(new Error('El archivo seleccionado no está disponible'), { statusCode: 422, code: 'UPLOAD_MISSING' });
  return { urlOriginal: '/api/upload/files/' + upload.filename, pesoBytes: upload.pesoBytes, formatoMime: upload.formatoMime };
}

module.exports = { resolveFile, signUpload, readUpload, detectImage };
